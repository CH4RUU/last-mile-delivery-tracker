import { useEffect, useState } from "react";
import { api, apiErrorMessage } from "../api/client";
import { AgentAvailability, AgentProfile, Order, OrderStatus } from "../types";
import { StatusBadge, AvailabilityBadge } from "../components/StatusBadge";
import StatusStepper from "../components/StatusStepper";

const NEXT_STATUS: Partial<Record<OrderStatus, { status: OrderStatus; label: string }[]>> = {
  ASSIGNED: [{ status: "PICKED_UP", label: "Mark picked up" }],
  PICKED_UP: [{ status: "IN_TRANSIT", label: "Mark in transit" }],
  IN_TRANSIT: [{ status: "OUT_FOR_DELIVERY", label: "Mark out for delivery" }],
  OUT_FOR_DELIVERY: [
    { status: "DELIVERED", label: "Mark delivered" },
    { status: "FAILED", label: "Mark failed" },
  ],
};

export default function AgentDashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function load() {
    const [ordersRes, profileRes] = await Promise.all([api.get("/orders"), api.get("/agents/me")]);
    setOrders(ordersRes.data.orders);
    setProfile(profileRes.data.agentProfile);
  }

  useEffect(() => {
    load().catch((err) => setError(apiErrorMessage(err)));
  }, []);

  async function updateStatus(orderId: string, status: OrderStatus) {
    setBusy(orderId);
    setError("");
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function setAvailability(availability: AgentAvailability) {
    await api.patch("/agents/me", { availability });
    await load();
  }

  const active = orders.filter((o) => !["DELIVERED", "FAILED", "CANCELLED"].includes(o.status));
  const past = orders.filter((o) => ["DELIVERED", "FAILED", "CANCELLED"].includes(o.status));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>My deliveries</h1>
          <p>Update the status of packages assigned to you.</p>
        </div>
        {profile && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <AvailabilityBadge status={profile.availability} />
            <select
              value={profile.availability}
              onChange={(e) => setAvailability(e.target.value as AgentAvailability)}
              style={{ width: "auto" }}
            >
              <option value="AVAILABLE">Available</option>
              <option value="BUSY">Busy</option>
              <option value="OFFLINE">Offline</option>
            </select>
          </div>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="section-title">Active ({active.length})</div>
      {active.length === 0 && <p className="muted text-sm">No active deliveries right now.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 28 }}>
        {active.map((order) => (
          <div className="card" key={order.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 700 }}>#{order.id.slice(0, 8)}</div>
                <div className="text-sm muted">
                  {order.pickupZone?.name} → {order.dropZone?.name} · {order.pickupAddress} → {order.dropAddress}
                </div>
              </div>
              <StatusBadge status={order.status} />
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              {(NEXT_STATUS[order.status] ?? []).map((n) => (
                <button
                  key={n.status}
                  className={n.status === "FAILED" ? "btn btn-danger btn-sm" : "btn btn-sm"}
                  disabled={busy === order.id}
                  onClick={() => updateStatus(order.id, n.status)}
                >
                  {n.label}
                </button>
              ))}
              <button className="btn btn-outline btn-sm" onClick={() => setExpanded(expanded === order.id ? null : order.id)}>
                {expanded === order.id ? "Hide timeline" : "View timeline"}
              </button>
            </div>

            {expanded === order.id && (
              <div style={{ marginTop: 16 }}>
                <StatusStepper order={order} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="section-title">Completed / closed ({past.length})</div>
      <div className="card" style={{ padding: 0 }}>
        {past.length === 0 && <div className="empty-state">Nothing here yet.</div>}
        {past.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Route</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {past.map((o) => (
                <tr key={o.id}>
                  <td>#{o.id.slice(0, 8)}</td>
                  <td>
                    {o.pickupZone?.name} → {o.dropZone?.name}
                  </td>
                  <td>
                    <StatusBadge status={o.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
