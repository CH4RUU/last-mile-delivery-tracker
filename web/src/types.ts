export type Role = "CUSTOMER" | "AGENT" | "ADMIN";
export type OrderType = "B2B" | "B2C";
export type PaymentType = "PREPAID" | "COD";
export type RateZoneType = "INTRA" | "INTER";
export type SurchargeUnit = "FLAT" | "PERCENT";
export type AgentAvailability = "AVAILABLE" | "BUSY" | "OFFLINE";
export type OrderStatus =
  | "CREATED"
  | "ASSIGNED"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "FAILED"
  | "RESCHEDULED"
  | "CANCELLED";

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
}

export interface Zone {
  id: string;
  name: string;
  areas?: Area[];
}

export interface Area {
  id: string;
  name: string;
  pincode: string;
  zoneId: string;
  zone?: Zone;
}

export interface RateCard {
  id: string;
  orderType: OrderType;
  zoneType: RateZoneType;
  baseCharge: number;
  perKgRate: number;
  minChargeableWeight: number;
  isActive: boolean;
}

export interface CodSurcharge {
  id: string;
  orderType: OrderType;
  unit: SurchargeUnit;
  value: number;
  isActive: boolean;
}

export interface AgentProfile {
  id: string;
  userId: string;
  user: User;
  currentZoneId: string | null;
  currentZone?: Zone | null;
  currentLat: number | null;
  currentLng: number | null;
  availability: AgentAvailability;
  updatedAt: string;
}

export interface StatusEvent {
  id: string;
  orderId: string;
  status: OrderStatus;
  note: string | null;
  actorId: string | null;
  actorRole: Role | null;
  actor: User | null;
  createdAt: string;
}

export interface RescheduleRequest {
  id: string;
  orderId: string;
  requestedById: string;
  newDate: string;
  createdAt: string;
}

export interface Order {
  id: string;
  customerId: string;
  customer?: User;
  createdById: string;
  pickupAddress: string;
  pickupPincode: string;
  pickupZoneId: string;
  pickupZone?: Zone;
  dropAddress: string;
  dropPincode: string;
  dropZoneId: string;
  dropZone?: Zone;
  lengthCm: number;
  breadthCm: number;
  heightCm: number;
  actualWeightKg: number;
  volumetricWeightKg: number;
  chargeableWeightKg: number;
  orderType: OrderType;
  paymentType: PaymentType;
  baseCharge: number;
  weightCharge: number;
  codSurcharge: number;
  totalCharge: number;
  status: OrderStatus;
  assignedAgentId: string | null;
  assignedAgent?: AgentProfile | null;
  scheduledFor: string | null;
  createdAt: string;
  updatedAt: string;
  statusEvents?: StatusEvent[];
  rescheduleReqs?: RescheduleRequest[];
}

export interface ChargeQuote {
  pickupZone: { zoneId: string; zoneName: string };
  dropZone: { zoneId: string; zoneName: string };
  breakdown: {
    volumetricWeightKg: number;
    chargeableWeightKg: number;
    zoneType: RateZoneType;
    rateCardId: string;
    baseCharge: number;
    weightCharge: number;
    codSurcharge: number;
    totalCharge: number;
  };
}
