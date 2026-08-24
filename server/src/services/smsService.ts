import { NotificationChannel, NotificationStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { env } from "../config/env";

// Twilio's trial tier is free and needs no extra npm dependency - a plain
// HTTPS POST to their REST API is enough. Falls back to a SKIPPED
// Notification row when no phone number or no Twilio credentials exist, so
// the rest of the app never has to special-case "SMS not configured".
export async function sendOrderSms(orderId: string, toPhone: string | null, body: string) {
  if (!toPhone) {
    await prisma.notification.create({
      data: {
        orderId,
        channel: NotificationChannel.SMS,
        toAddress: "unknown",
        body,
        status: NotificationStatus.SKIPPED,
        error: "Customer has no phone number on file",
      },
    });
    return;
  }

  if (!env.twilioSid || !env.twilioAuthToken || !env.twilioFromNumber) {
    await prisma.notification.create({
      data: {
        orderId,
        channel: NotificationChannel.SMS,
        toAddress: toPhone,
        body,
        status: NotificationStatus.SKIPPED,
        error: "Twilio not configured (set TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_FROM_NUMBER)",
      },
    });
    return;
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${env.twilioSid}/Messages.json`;
    const auth = Buffer.from(`${env.twilioSid}:${env.twilioAuthToken}`).toString("base64");
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: toPhone, From: env.twilioFromNumber, Body: body }).toString(),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Twilio responded ${res.status}: ${text}`);
    }
    await prisma.notification.create({
      data: { orderId, channel: NotificationChannel.SMS, toAddress: toPhone, body, status: NotificationStatus.SENT },
    });
  } catch (err) {
    await prisma.notification.create({
      data: {
        orderId,
        channel: NotificationChannel.SMS,
        toAddress: toPhone,
        body,
        status: NotificationStatus.FAILED,
        error: err instanceof Error ? err.message : String(err),
      },
    });
  }
}
