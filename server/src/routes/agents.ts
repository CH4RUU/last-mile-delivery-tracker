import { Router } from "express";
import { z } from "zod";
import { AgentAvailability, Role } from "@prisma/client";
import { prisma } from "../config/prisma";
import { asyncHandler, HttpError } from "../utils/asyncHandler";
import { requireAuth, requireRole } from "../middleware/auth";
import { hashPassword } from "../utils/auth";
import { safeUserSelect } from "../utils/selects";

export const agentsRouter = Router();

agentsRouter.get(
  "/",
  requireAuth,
  requireRole(Role.ADMIN),
  asyncHandler(async (_req, res) => {
    const agents = await prisma.agentProfile.findMany({
      include: { user: { select: safeUserSelect }, currentZone: true },
      orderBy: { updatedAt: "desc" },
    });
    res.json({ agents });
  })
);

const createAgentSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(6).optional(),
  password: z.string().min(6),
  currentZoneId: z.string().uuid().optional(),
});

agentsRouter.post(
  "/",
  requireAuth,
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const data = createAgentSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new HttpError(409, "Email already registered");

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        passwordHash: await hashPassword(data.password),
        role: Role.AGENT,
        agentProfile: {
          create: { currentZoneId: data.currentZoneId, availability: AgentAvailability.AVAILABLE },
        },
      },
      select: { ...safeUserSelect, agentProfile: true },
    });
    res.status(201).json({ agent: user });
  })
);

const updateSelfSchema = z.object({
  availability: z.nativeEnum(AgentAvailability).optional(),
  currentZoneId: z.string().uuid().optional(),
  currentLat: z.number().optional(),
  currentLng: z.number().optional(),
});

// Agents update their own live location/availability, which the assignment
// engine reads when picking the nearest agent for a new order.
agentsRouter.patch(
  "/me",
  requireAuth,
  requireRole(Role.AGENT),
  asyncHandler(async (req, res) => {
    const data = updateSelfSchema.parse(req.body);
    const profile = await prisma.agentProfile.update({
      where: { userId: req.user!.sub },
      data,
    });
    res.json({ agentProfile: profile });
  })
);

agentsRouter.get(
  "/me",
  requireAuth,
  requireRole(Role.AGENT),
  asyncHandler(async (req, res) => {
    const profile = await prisma.agentProfile.findUnique({
      where: { userId: req.user!.sub },
      include: { currentZone: true },
    });
    if (!profile) throw new HttpError(404, "Agent profile not found");
    res.json({ agentProfile: profile });
  })
);
