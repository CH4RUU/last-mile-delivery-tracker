import { AgentAvailability } from "@prisma/client";
import { prisma } from "../config/prisma";
import { HttpError } from "../utils/asyncHandler";

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Nearest-available-agent selection:
// 1. Only AVAILABLE agents are eligible.
// 2. If the order's pickup has lat/lng and candidate agents have lat/lng, pick
//    the geographically nearest one (haversine distance).
// 3. Otherwise fall back to agents currently stationed in the pickup zone.
// 4. Otherwise fall back to any available agent (oldest-updated first, a crude
//    round-robin so load spreads instead of always hitting the same agent).
export async function findNearestAvailableAgent(params: {
  pickupZoneId: string;
  pickupLat?: number | null;
  pickupLng?: number | null;
}): Promise<{ agentProfileId: string } | null> {
  const available = await prisma.agentProfile.findMany({
    where: { availability: AgentAvailability.AVAILABLE },
    include: { user: true },
  });

  if (available.length === 0) return null;

  if (params.pickupLat != null && params.pickupLng != null) {
    const withCoords = available.filter((a) => a.currentLat != null && a.currentLng != null);
    if (withCoords.length > 0) {
      let best = withCoords[0];
      let bestDist = haversineKm(params.pickupLat, params.pickupLng, best.currentLat!, best.currentLng!);
      for (const agent of withCoords.slice(1)) {
        const d = haversineKm(params.pickupLat, params.pickupLng, agent.currentLat!, agent.currentLng!);
        if (d < bestDist) {
          best = agent;
          bestDist = d;
        }
      }
      return { agentProfileId: best.id };
    }
  }

  const inZone = available.filter((a) => a.currentZoneId === params.pickupZoneId);
  if (inZone.length > 0) {
    inZone.sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
    return { agentProfileId: inZone[0].id };
  }

  const sorted = [...available].sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
  return { agentProfileId: sorted[0].id };
}

export async function assignAgentToOrder(orderId: string, agentProfileId: string) {
  const agent = await prisma.agentProfile.findUnique({ where: { id: agentProfileId } });
  if (!agent) throw new HttpError(404, "Agent not found");
  if (agent.availability !== AgentAvailability.AVAILABLE) {
    throw new HttpError(409, "Agent is not available");
  }

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.update({
      where: { id: orderId },
      data: { assignedAgentId: agentProfileId, status: "ASSIGNED" },
    });
    await tx.agentProfile.update({
      where: { id: agentProfileId },
      data: { availability: AgentAvailability.BUSY },
    });
    await tx.orderStatusEvent.create({
      data: {
        orderId,
        status: "ASSIGNED",
        note: `Assigned to agent ${agent.id}`,
      },
    });
    return order;
  });
}
