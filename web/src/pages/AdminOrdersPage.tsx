import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, apiErrorMessage } from "../api/client";
import { AgentProfile, Order, OrderStatus, Zone } from "../types";
import { StatusBadge } from "../components/StatusBadge";

const ALL_STATUSES: OrderStatus[] = [
  "CREATED",
  "ASSIGNED",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "FAILED",
  "RESCHEDULED",
  "CANCELLED",
];

export default function AdminOrdersPage() {
  const [params, setParams] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const status = params.get("status") ?? "";
  const zoneId = params.get("zoneId") ?? "";

  async function load() {
    const query: Record<string, string> = {};
    if (status) query.status = status;
    if (zoneId) query.zoneId = zoneId;
    const [ordersRes, zonesRes, agentsRes] = await Promise.all([
      api.get("/orders", { params: query }),
      api.get("/zones"),
      api.get("/agents"),
    ]);
    setOrders(ordersRes.data.orders);
    setZones(zonesRes.data.zones);
    setAgents(agentsRes.data.agents);
  }

  useEffect(() => {
    load().catch((err) => setError(apiErrorMessage(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, zoneId]);

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  }

  async function autoAssign(orderId: string) {
    setBusyId(orderId);
    setError("");
    try {
      await api.post(`/orders/${orderId}/assign`, { auto: true });
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function manualAssign(orderId: string, agentProfileId: string) {
    if (!agentProfileId) return;
    setBusyId(orderId);
    setError("");
    try {
      await api.post(`/orders/${orderId}/assign`, { agentProfileId });
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function overrideStatus(orderId: string, newStatus: string) {
    if (!newStatus) return;
    setBusyId(orderId);
    setError("");
    try {
      await api.patch(`/orders/${orderId}/status`, { status: newStatus, note: "Admin override" });
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>All orders</h1>
          <p>Filter, assign agents, and override status where needed.</p>
        </div>
      </div>

      <div className="filters-bar">
        <select value={status} onChange={(e) => updateParam("status", e.target.value)}>
          <option value="">All statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={zoneId} onChange={(e) => updateParam("zoneId", e.target.value)}>
          <option value="">All zones</option>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))}
        </select>
        {(status || zoneId) && (
          <button className="chip" onClick={() => setParams({})}>
            Clear filters ✕
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        {orders.length === 0 ? (
          <div className="empty-state">No orders match these filters.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Route</th>
                <th>Charge</th>
                <th>Status</th>
                <th>Agent</th>
                <th style={{ minWidth: 260 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link to={`/orders/${o.id}`}>#{o.id.slice(0, 8)}</Link>
                  </td>
                  <td>{o.customer?.name}</td>
                  <td>
                    {o.pickupZone?.name} → {o.dropZone?.name}
                  </td>
                  <td>₹{o.totalCharge}</td>
                  <td>
                    <StatusBadge status={o.status} />
                  </td>
                  <td>{o.assignedAgent?.user.name ?? <span className="muted">Unassigned</span>}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      {!o.assignedAgentId && (
                        <button className="btn btn-sm" disabled={busyId === o.id} onClick={() => autoAssign(o.id)}>
                          Auto-assign
                        </button>
                      )}
                      <select
                        defaultValue=""
                        disabled={busyId === o.id}
                        onChange={(e) => manualAssign(o.id, e.target.value)}
                        style={{ width: 130, fontSize: "0.78rem" }}
                      >
                        <option value="">Assign to...</option>
                        {agents
                          .filter((a) => a.availability === "AVAILABLE" || a.id === o.assignedAgentId)
                          .map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.user.name}
                            </option>
                          ))}
                      </select>
                      <select
                        defaultValue=""
                        disabled={busyId === o.id}
                        onChange={(e) => overrideStatus(o.id, e.target.value)}
                        style={{ width: 120, fontSize: "0.78rem" }}
                      >
                        <option value="">Override...</option>
                        {ALL_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
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
