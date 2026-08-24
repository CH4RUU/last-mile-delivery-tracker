import { PrismaClient, OrderType, RateZoneType, SurchargeUnit, Role, AgentAvailability } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding zones + areas...");
  const zoneNorth = await prisma.zone.upsert({
    where: { name: "North" },
    update: {},
    create: { name: "North" },
  });
  const zoneSouth = await prisma.zone.upsert({
    where: { name: "South" },
    update: {},
    create: { name: "South" },
  });
  const zoneEast = await prisma.zone.upsert({
    where: { name: "East" },
    update: {},
    create: { name: "East" },
  });

  const areas: Array<[string, string, string]> = [
    ["Rohini", "110085", zoneNorth.id],
    ["Model Town", "110009", zoneNorth.id],
    ["Saket", "110017", zoneSouth.id],
    ["Hauz Khas", "110016", zoneSouth.id],
    ["Preet Vihar", "110092", zoneEast.id],
    ["Mayur Vihar", "110091", zoneEast.id],
  ];
  for (const [name, pincode, zoneId] of areas) {
    await prisma.area.upsert({
      where: { pincode },
      update: { name, zoneId },
      create: { name, pincode, zoneId },
    });
  }

  console.log("Seeding rate cards...");
  const rateCards = [
    { orderType: OrderType.B2C, zoneType: RateZoneType.INTRA, baseCharge: 30, perKgRate: 15 },
    { orderType: OrderType.B2C, zoneType: RateZoneType.INTER, baseCharge: 50, perKgRate: 22 },
    { orderType: OrderType.B2B, zoneType: RateZoneType.INTRA, baseCharge: 60, perKgRate: 12 },
    { orderType: OrderType.B2B, zoneType: RateZoneType.INTER, baseCharge: 90, perKgRate: 18 },
  ];
  for (const rc of rateCards) {
    await prisma.rateCard.upsert({
      where: { orderType_zoneType: { orderType: rc.orderType, zoneType: rc.zoneType } },
      update: rc,
      create: { ...rc, minChargeableWeight: 0.5 },
    });
  }

  console.log("Seeding COD surcharges...");
  await prisma.codSurcharge.upsert({
    where: { orderType: OrderType.B2C },
    update: {},
    create: { orderType: OrderType.B2C, unit: SurchargeUnit.FLAT, value: 20 },
  });
  await prisma.codSurcharge.upsert({
    where: { orderType: OrderType.B2B },
    update: {},
    create: { orderType: OrderType.B2B, unit: SurchargeUnit.PERCENT, value: 2 },
  });

  console.log("Seeding users...");
  const passwordHash = await bcrypt.hash("password123", 10);

  await prisma.user.upsert({
    where: { email: "admin@tracker.dev" },
    update: {},
    create: { name: "Admin", email: "admin@tracker.dev", passwordHash, role: Role.ADMIN },
  });

  await prisma.user.upsert({
    where: { email: "customer@tracker.dev" },
    update: {},
    create: { name: "Sample Customer", email: "customer@tracker.dev", passwordHash, role: Role.CUSTOMER },
  });

  const agentSeeds = [
    { email: "agent.north@tracker.dev", name: "Agent North", zoneId: zoneNorth.id, lat: 28.7041, lng: 77.1025 },
    { email: "agent.south@tracker.dev", name: "Agent South", zoneId: zoneSouth.id, lat: 28.5245, lng: 77.2066 },
    { email: "agent.east@tracker.dev", name: "Agent East", zoneId: zoneEast.id, lat: 28.6358, lng: 77.295 },
  ];
  for (const a of agentSeeds) {
    const existing = await prisma.user.findUnique({ where: { email: a.email } });
    if (existing) continue;
    await prisma.user.create({
      data: {
        name: a.name,
        email: a.email,
        passwordHash,
        role: Role.AGENT,
        agentProfile: {
          create: {
            currentZoneId: a.zoneId,
            currentLat: a.lat,
            currentLng: a.lng,
            availability: AgentAvailability.AVAILABLE,
          },
        },
      },
    });
  }

  console.log("Seed complete. Login with password 'password123' for all seeded users.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
