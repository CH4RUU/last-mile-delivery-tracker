import { Router } from "express";
import { z } from "zod";
import { AgentAvailability, OrderStatus, OrderType, PaymentType, Role } from "@prisma/client";
import { prisma } from "../config/prisma";
import { asyncHandler, HttpError } from "../utils/asyncHandler";
import { requireAuth, requireRole } from "../middleware/auth";
import { computeCharge } from "../services/rateEngine";
import { resolveZoneForPincode } from "../services/zoneService";
import { assignAgentToOrder, findNearestAvailableAgent } from "../services/assignmentService";
import { notifyOrderStatus } from "../services/notificationService";
import { safeUserSelect } from "../utils/selects";

export const ordersRouter = Router();

const orderInputSchema = z.object({
  customerEmail: z.string().email().optional(), // admin-on-behalf-of-customer
  pickupAddress: z.string().min(1),
  pickupPincode: z.string().min(1),
  dropAddress: z.string().min(1),
  dropPincode: z.string().min(1),
  lengthCm: z.number().positive(),
  breadthCm: z.number().positive(),
  heightCm: z.number().positive(),
  actualWeightKg: z.number().positive(),
  orderType: z.nativeEnum(OrderType),
  paymentType: z.nativeEnum(PaymentType),
});

async function buildQuote(input: z.infer<typeof orderInputSchema>) {
  const [pickupZone, dropZone] = await Promise.all([
    resolveZoneForPincode(input.pickupPincode),
    resolveZoneForPincode(input.dropPincode),
  ]);
  const breakdown = await computeCharge({
    lengthCm: input.lengthCm,
    breadthCm: input.breadthCm,
    heightCm: input.heightCm,
    actualWeightKg: input.actualWeightKg,
    orderType: input.orderType,
    paymentType: input.paymentType,
    pickupZoneId: pickupZone.zoneId,
    dropZoneId: dropZone.zoneId,
  });
  return { pickupZone, dropZone, breakdown };
}

// Charge preview shown to the customer before they confirm the order.
ordersRouter.post(
  "/quote",
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = orderInputSchema.parse(req.body);
    const quote = await buildQuote(input);
    res.json(quote);
  })
);

ordersRouter.post(
  "/",
  requireAuth,
  requireRole(Role.CUSTOMER, Role.ADMIN),
  asyncHandler(async (req, res) => {
    const input = orderInputSchema.parse(req.body);

    let customerId = req.user!.sub;
    if (req.user!.role === Role.ADMIN) {
      if (!input.customerEmail) throw new HttpError(400, "customerEmail is required when admin creates an order");
      const customer = await prisma.user.findUnique({ where: { email: input.customerEmail } });
      if (!customer || customer.role !== Role.CUSTOMER) throw new HttpError(404, "Customer not found");
      customerId = customer.id;
    }

    const { pickupZone, dropZone, breakdown } = await buildQuote(input);

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          customerId,
          createdById: req.user!.sub,
          pickupAddress: input.pickupAddress,
          pickupPincode: input.pickupPincode,
          pickupZoneId: pickupZone.zoneId,
          dropAddress: input.dropAddress,
          dropPincode: input.dropPincode,
          dropZoneId: dropZone.zoneId,
          lengthCm: input.lengthCm,
          breadthCm: input.breadthCm,
          heightCm: input.heightCm,
          actualWeightKg: input.actualWeightKg,
          volumetricWeightKg: breakdown.volumetricWeightKg,
          chargeableWeightKg: breakdown.chargeableWeightKg,
          orderType: input.orderType,
          paymentType: input.paymentType,
          baseCharge: breakdown.baseCharge,
          weightCharge: breakdown.weightCharge,
          codSurcharge: breakdown.codSurcharge,
          totalCharge: breakdown.totalCharge,
          status: OrderStatus.CREATED,
        },
      });
      await tx.orderStatusEvent.create({
        data: {
          orderId: created.id,
          status: OrderStatus.CREATED,
          actorId: req.user!.sub,
          actorRole: req.user!.role,
          note: "Order created",
        },
      });
      return created;
    });

    await notifyOrderStatus(order.id, OrderStatus.CREATED);
    res.status(201).json({ order });
  })
);

const listQuerySchema = z.object({
  status: z.nativeEnum(OrderStatus).optional(),
  zoneId: z.string().uuid().optional(),
  agentProfileId: z.string().uuid().optional(),
});

ordersRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    const where: Record<string, unknown> = {};

    if (req.user!.role === Role.CUSTOMER) {
      where.customerId = req.user!.sub;
    } else if (req.user!.role === Role.AGENT) {
      const profile = await prisma.agentProfile.findUnique({ where: { userId: req.user!.sub } });
      where.assignedAgentId = profile?.id ?? "__none__";
    }

    if (query.status) where.status = query.status;
    if (query.zoneId) where.OR = [{ pickupZoneId: query.zoneId }, { dropZoneId: query.zoneId }];
    if (query.agentProfileId) where.assignedAgentId = query.agentProfileId;

    const orders = await prisma.order.findMany({
      where,
      include: {
        pickupZone: true,
        dropZone: true,
        assignedAgent: { include: { user: { select: safeUserSelect } } },
        customer: { select: safeUserSelect },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ orders });
  })
);

ordersRouter.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        pickupZone: true,
        dropZone: true,
        assignedAgent: { include: { user: { select: safeUserSelect } } },
        customer: { select: safeUserSelect },
        statusEvents: { orderBy: { createdAt: "asc" }, include: { actor: { select: safeUserSelect } } },
        rescheduleReqs: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!order) throw new HttpError(404, "Order not found");

    if (req.user!.role === Role.CUSTOMER && order.customerId !== req.user!.sub) {
      throw new HttpError(403, "Not your order");
    }
    if (req.user!.role === Role.AGENT) {
      const profile = await prisma.agentProfile.findUnique({ where: { userId: req.user!.sub } });
      if (order.assignedAgentId !== profile?.id) throw new HttpError(403, "Not your assignment");
    }

    res.json({ order });
  })
);

const assignSchema = z.object({
  agentProfileId: z.string().uuid().optional(),
  auto: z.boolean().optional(),
});

ordersRouter.post(
  "/:id/assign",
  requireAuth,
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const data = assignSchema.parse(req.body);
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) throw new HttpError(404, "Order not found");

    let agentProfileId = data.agentProfileId;
    if (data.auto || !agentProfileId) {
      const pickup = await prisma.zone.findUnique({ where: { id: order.pickupZoneId } });
      const nearest = await findNearestAvailableAgent({
        pickupZoneId: order.pickupZoneId,
        pickupLat: null,
        pickupLng: null,
      });
      if (!nearest) throw new HttpError(409, `No available agents right now${pickup ? ` for zone ${pickup.name}` : ""}`);
      agentProfileId = nearest.agentProfileId;
    }

    const updated = await assignAgentToOrder(order.id, agentProfileId);
    await notifyOrderStatus(order.id, OrderStatus.ASSIGNED);
    res.json({ order: updated });
  })
);

const AGENT_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  ASSIGNED: [OrderStatus.PICKED_UP],
  PICKED_UP: [OrderStatus.IN_TRANSIT],
  IN_TRANSIT: [OrderStatus.OUT_FOR_DELIVERY],
  OUT_FOR_DELIVERY: [OrderStatus.DELIVERED, OrderStatus.FAILED],
};

const statusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
  note: z.string().optional(),
});

ordersRouter.patch(
  "/:id/status",
  requireAuth,
  requireRole(Role.AGENT, Role.ADMIN),
  asyncHandler(async (req, res) => {
    const data = statusSchema.parse(req.body);
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) throw new HttpError(404, "Order not found");

    if (req.user!.role === Role.AGENT) {
      const profile = await prisma.agentProfile.findUnique({ where: { userId: req.user!.sub } });
      if (order.assignedAgentId !== profile?.id) throw new HttpError(403, "Not your assignment");

      const allowed = AGENT_TRANSITIONS[order.status] ?? [];
      if (!allowed.includes(data.status)) {
        throw new HttpError(422, `Cannot move order from ${order.status} to ${data.status}`);
      }
    }
    // Admins can override to any status directly.

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.order.update({ where: { id: order.id }, data: { status: data.status } });
      await tx.orderStatusEvent.create({
        data: {
          orderId: order.id,
          status: data.status,
          actorId: req.user!.sub,
          actorRole: req.user!.role,
          note: data.note,
        },
      });
      if (
        (data.status === OrderStatus.DELIVERED ||
          data.status === OrderStatus.FAILED ||
          data.status === OrderStatus.CANCELLED) &&
        order.assignedAgentId
      ) {
        await tx.agentProfile.update({
          where: { id: order.assignedAgentId },
          data: { availability: AgentAvailability.AVAILABLE },
        });
      }
      return result;
    });

    await notifyOrderStatus(order.id, data.status);
    res.json({ order: updated });
  })
);

const rescheduleSchema = z.object({
  newDate: z.coerce.date(),
});

// Customer reschedules a failed delivery; the order re-enters the assignment
// pipeline so a (possibly different) agent picks up the next attempt.
ordersRouter.post(
  "/:id/reschedule",
  requireAuth,
  requireRole(Role.CUSTOMER, Role.ADMIN),
  asyncHandler(async (req, res) => {
    const data = rescheduleSchema.parse(req.body);
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) throw new HttpError(404, "Order not found");
    if (req.user!.role === Role.CUSTOMER && order.customerId !== req.user!.sub) {
      throw new HttpError(403, "Not your order");
    }
    if (order.status !== OrderStatus.FAILED) {
      throw new HttpError(422, "Only a FAILED order can be rescheduled");
    }

    await prisma.$transaction(async (tx) => {
      await tx.rescheduleRequest.create({
        data: { orderId: order.id, requestedById: req.user!.sub, newDate: data.newDate },
      });
      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.RESCHEDULED, scheduledFor: data.newDate, assignedAgentId: null },
      });
      await tx.orderStatusEvent.create({
        data: {
          orderId: order.id,
          status: OrderStatus.RESCHEDULED,
          actorId: req.user!.sub,
          actorRole: req.user!.role,
          note: `Rescheduled for ${data.newDate.toISOString()}`,
        },
      });
    });
    await notifyOrderStatus(order.id, OrderStatus.RESCHEDULED);

    const nearest = await findNearestAvailableAgent({ pickupZoneId: order.pickupZoneId });
    let updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    if (nearest) {
      updated = await assignAgentToOrder(order.id, nearest.agentProfileId);
      await notifyOrderStatus(order.id, OrderStatus.ASSIGNED);
    }

    res.json({ order: updated });
  })
);
