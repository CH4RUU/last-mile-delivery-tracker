import { Router } from "express";
import { z } from "zod";
import { OrderType, RateZoneType, Role, SurchargeUnit } from "@prisma/client";
import { prisma } from "../config/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth, requireRole } from "../middleware/auth";

export const rateCardsRouter = Router();

rateCardsRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const rateCards = await prisma.rateCard.findMany({ orderBy: [{ orderType: "asc" }, { zoneType: "asc" }] });
    res.json({ rateCards });
  })
);

const rateCardSchema = z.object({
  orderType: z.nativeEnum(OrderType),
  zoneType: z.nativeEnum(RateZoneType),
  baseCharge: z.number().nonnegative(),
  perKgRate: z.number().nonnegative(),
  minChargeableWeight: z.number().nonnegative().optional(),
  isActive: z.boolean().optional(),
});

rateCardsRouter.post(
  "/",
  requireAuth,
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const data = rateCardSchema.parse(req.body);
    const rateCard = await prisma.rateCard.upsert({
      where: { orderType_zoneType: { orderType: data.orderType, zoneType: data.zoneType } },
      update: data,
      create: data,
    });
    res.status(201).json({ rateCard });
  })
);

rateCardsRouter.put(
  "/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const data = rateCardSchema.partial().parse(req.body);
    const rateCard = await prisma.rateCard.update({ where: { id: req.params.id }, data });
    res.json({ rateCard });
  })
);

rateCardsRouter.get(
  "/cod-surcharges",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const codSurcharges = await prisma.codSurcharge.findMany({ orderBy: { orderType: "asc" } });
    res.json({ codSurcharges });
  })
);

const codSchema = z.object({
  orderType: z.nativeEnum(OrderType),
  unit: z.nativeEnum(SurchargeUnit),
  value: z.number().nonnegative(),
  isActive: z.boolean().optional(),
});

rateCardsRouter.post(
  "/cod-surcharges",
  requireAuth,
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const data = codSchema.parse(req.body);
    const codSurcharge = await prisma.codSurcharge.upsert({
      where: { orderType: data.orderType },
      update: data,
      create: data,
    });
    res.status(201).json({ codSurcharge });
  })
);

rateCardsRouter.put(
  "/cod-surcharges/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const data = codSchema.partial().parse(req.body);
    const codSurcharge = await prisma.codSurcharge.update({ where: { id: req.params.id }, data });
    res.json({ codSurcharge });
  })
);
