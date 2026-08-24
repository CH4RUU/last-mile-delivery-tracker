import { OrderStatus, AgentAvailability } from "../types";

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`badge badge-${status.toLowerCase()}`}>{status.replace(/_/g, " ")}</span>;
}

export function AvailabilityBadge({ status }: { status: AgentAvailability }) {
  return <span className={`badge badge-${status.toLowerCase()}`}>{status}</span>;
}
