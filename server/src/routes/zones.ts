import { Router } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../config/prisma";
import { asyncHandler, HttpError } from "../utils/asyncHandler";
import { requireAuth, requireRole } from "../middleware/auth";

export const zonesRouter = Router();

zonesRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const zones = await prisma.zone.findMany({
      include: { areas: true },
      orderBy: { name: "asc" },
    });
    res.json({ zones });
  })
);

const zoneSchema = z.object({ name: z.string().min(1) });

zonesRouter.post(
  "/",
  requireAuth,
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const data = zoneSchema.parse(req.body);
    const existing = await prisma.zone.findUnique({ where: { name: data.name } });
    if (existing) throw new HttpError(409, "Zone with this name already exists");
    const zone = await prisma.zone.create({ data });
    res.status(201).json({ zone });
  })
);

zonesRouter.put(
  "/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const data = zoneSchema.parse(req.body);
    const zone = await prisma.zone.update({ where: { id: req.params.id }, data });
    res.json({ zone });
  })
);

zonesRouter.delete(
  "/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    await prisma.zone.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

const areaSchema = z.object({
  name: z.string().min(1),
  pincode: z.string().min(1),
  zoneId: z.string().uuid(),
});

zonesRouter.post(
  "/areas",
  requireAuth,
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const data = areaSchema.parse(req.body);
    const existing = await prisma.area.findUnique({ where: { pincode: data.pincode } });
    if (existing) throw new HttpError(409, "Pincode already mapped to a zone");
    const area = await prisma.area.create({ data });
    res.status(201).json({ area });
  })
);

zonesRouter.get(
  "/areas",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const areas = await prisma.area.findMany({ include: { zone: true }, orderBy: { pincode: "asc" } });
    res.json({ areas });
  })
);

zonesRouter.put(
  "/areas/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const data = areaSchema.parse(req.body);
    const area = await prisma.area.update({ where: { id: req.params.id }, data });
    res.json({ area });
  })
);

zonesRouter.delete(
  "/areas/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    await prisma.area.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);
