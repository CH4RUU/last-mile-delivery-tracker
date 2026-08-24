import nodemailer, { Transporter } from "nodemailer";
import { NotificationChannel, NotificationStatus, OrderStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { sendOrderSms } from "./smsService";

let transporter: Transporter | null = null;
function getTransporter(): Transporter | null {
  if (!env.smtpHost || !env.smtpUser || !env.smtpPass) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort ?? 587,
      secure: env.smtpPort === 465,
      auth: { user: env.smtpUser, pass: env.smtpPass },
    });
  }
  return transporter;
}

const STATUS_COPY: Record<OrderStatus, string> = {
  CREATED: "Your order has been created and is awaiting agent assignment.",
  ASSIGNED: "A delivery agent has been assigned to your order.",
  PICKED_UP: "Your package has been picked up.",
  IN_TRANSIT: "Your package is in transit.",
  OUT_FOR_DELIVERY: "Your package is out for delivery.",
  DELIVERED: "Your package has been delivered. Thank you!",
  FAILED: "Delivery attempt failed. You can reschedule from your order page.",
  RESCHEDULED: "Your delivery has been rescheduled and reassigned.",
  CANCELLED: "Your order has been cancelled.",
};

// Sends an email for every order status change, and always writes a
// Notification row (SENT/FAILED/SKIPPED) so there is an auditable record even
// when no SMTP credentials are configured in the environment (e.g. local dev).
export async function notifyOrderStatus(orderId: string, status: OrderStatus) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { customer: true },
  });
  if (!order) return;

  const subject = `Order ${order.id.slice(0, 8)} - ${status.replace(/_/g, " ")}`;
  const body = STATUS_COPY[status] ?? `Order status updated to ${status}.`;

  await Promise.all([
    sendEmail(orderId, order.customer.email, subject, body),
    sendOrderSms(orderId, order.customer.phone, `${subject}: ${body}`),
  ]);
}

async function sendEmail(orderId: string, to: string, subject: string, body: string) {
  const tx = getTransporter();
  if (!tx) {
    await prisma.notification.create({
      data: {
        orderId,
        channel: NotificationChannel.EMAIL,
        toAddress: to,
        subject,
        body,
        status: NotificationStatus.SKIPPED,
        error: "SMTP not configured (set SMTP_HOST/SMTP_USER/SMTP_PASS)",
      },
    });
    // eslint-disable-next-line no-console
    console.log(`[email:skipped] to=${to} subject="${subject}"`);
    return;
  }

  try {
    await tx.sendMail({ from: env.smtpFrom, to, subject, text: body });
    await prisma.notification.create({
      data: { orderId, channel: NotificationChannel.EMAIL, toAddress: to, subject, body, status: NotificationStatus.SENT },
    });
  } catch (err) {
    await prisma.notification.create({
      data: {
        orderId,
        channel: NotificationChannel.EMAIL,
        toAddress: to,
        subject,
        body,
        status: NotificationStatus.FAILED,
        error: err instanceof Error ? err.message : String(err),
      },
    });
  }
}
