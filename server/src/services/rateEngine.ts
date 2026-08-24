import { OrderType, PaymentType, RateZoneType } from "@prisma/client";
import { prisma } from "../config/prisma";
import { HttpError } from "../utils/asyncHandler";

const VOLUMETRIC_DIVISOR = 5000;

export function calculateVolumetricWeightKg(lengthCm: number, breadthCm: number, heightCm: number): number {
  return (lengthCm * breadthCm * heightCm) / VOLUMETRIC_DIVISOR;
}

export function determineZoneType(pickupZoneId: string, dropZoneId: string): RateZoneType {
  return pickupZoneId === dropZoneId ? RateZoneType.INTRA : RateZoneType.INTER;
}

export interface ChargeInput {
  lengthCm: number;
  breadthCm: number;
  heightCm: number;
  actualWeightKg: number;
  orderType: OrderType;
  paymentType: PaymentType;
  pickupZoneId: string;
  dropZoneId: string;
}

export interface ChargeBreakdown {
  volumetricWeightKg: number;
  chargeableWeightKg: number;
  zoneType: RateZoneType;
  rateCardId: string;
  baseCharge: number;
  weightCharge: number;
  codSurcharge: number;
  totalCharge: number;
}

// Pure calculation, no side effects. All numbers except geometry/weight input
// come from admin-configured RateCard / CodSurcharge rows - nothing hardcoded.
export async function computeCharge(input: ChargeInput): Promise<ChargeBreakdown> {
  const zoneType = determineZoneType(input.pickupZoneId, input.dropZoneId);

  const rateCard = await prisma.rateCard.findFirst({
    where: { orderType: input.orderType, zoneType, isActive: true },
  });
  if (!rateCard) {
    throw new HttpError(
      422,
      `No active rate card configured for ${input.orderType} / ${zoneType}. Ask an admin to configure one.`
    );
  }

  const volumetricWeightKg = calculateVolumetricWeightKg(input.lengthCm, input.breadthCm, input.heightCm);
  const chargeableWeightKg = Math.max(
    input.actualWeightKg,
    volumetricWeightKg,
    rateCard.minChargeableWeight
  );

  const weightCharge = chargeableWeightKg * rateCard.perKgRate;
  const baseCharge = rateCard.baseCharge;

  let codSurcharge = 0;
  if (input.paymentType === PaymentType.COD) {
    const surcharge = await prisma.codSurcharge.findFirst({
      where: { orderType: input.orderType, isActive: true },
    });
    if (surcharge) {
      codSurcharge =
        surcharge.unit === "PERCENT" ? ((baseCharge + weightCharge) * surcharge.value) / 100 : surcharge.value;
    }
  }

  const totalCharge = Math.round((baseCharge + weightCharge + codSurcharge) * 100) / 100;

  return {
    volumetricWeightKg: round2(volumetricWeightKg),
    chargeableWeightKg: round2(chargeableWeightKg),
    zoneType,
    rateCardId: rateCard.id,
    baseCharge: round2(baseCharge),
    weightCharge: round2(weightCharge),
    codSurcharge: round2(codSurcharge),
    totalCharge,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
