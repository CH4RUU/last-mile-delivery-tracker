import { prisma } from "../config/prisma";
import { HttpError } from "../utils/asyncHandler";

// Zone detection is pincode-based: admins map Areas (pincodes) to Zones,
// and every address is resolved to a zone through that admin-owned mapping.
export async function resolveZoneForPincode(pincode: string): Promise<{ zoneId: string; zoneName: string }> {
  const area = await prisma.area.findUnique({
    where: { pincode },
    include: { zone: true },
  });
  if (!area) {
    throw new HttpError(422, `Pincode ${pincode} is not mapped to any zone. Ask an admin to add this area.`);
  }
  return { zoneId: area.zoneId, zoneName: area.zone.name };
}
