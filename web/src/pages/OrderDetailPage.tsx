import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, apiErrorMessage } from "../api/client";
import { Order } from "../types";
import { StatusBadge } from "../components/StatusBadge";
import StatusStepper from "../components/StatusStepper";
import { useAuth } from "../context/AuthContext";

export default function OrderDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleMsg, setRescheduleMsg] = useState("");

  async function load() {
    const res = await api.get(`/orders/${id}`);
    setOrder(res.data.order);
  }

  useEffect(() => {
    load().catch((err) => setError(apiErrorMessage(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onReschedule(e: FormEvent) {
    e.preventDefault();
    setRescheduling(true);
    setRescheduleMsg("");
    try {
      await api.post(`/orders/${id}/reschedule`, { newDate: new Date(rescheduleDate).toISOString() });
      setRescheduleMsg("Delivery rescheduled and reassigned where possible.");
      await load();
    } catch (err) {
      setRescheduleMsg(apiErrorMessage(err));
    } finally {
      setRescheduling(false);
    }
  }

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!order) return <div className="empty-state">Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <Link to={user?.role === "ADMIN" ? "/admin/orders" : "/orders"} className="text-sm">
            ← Back to orders
          </Link>
          <h1 style={{ marginTop: 8 }}>Order #{order.id.slice(0, 8)}</h1>
          <p>
            {order.pickupZone?.name} → {order.dropZone?.name} · {order.orderType} · {order.paymentType}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="section-title">Tracking</div>
          <StatusStepper order={order} />

          {order.status === "FAILED" && user?.role === "CUSTOMER" && (
            <div className="card" style={{ marginTop: 18, background: "var(--bg)" }}>
              <div className="section-title" style={{ fontSize: "0.9rem" }}>
                Reschedule delivery
              </div>
              <form onSubmit={onReschedule} style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div className="form-field" style={{ marginBottom: 0 }}>
                  <label>New date</label>
                  <input
                    type="datetime-local"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                    required
                  />
                </div>
                <button className="btn" disabled={rescheduling}>
                  {rescheduling ? "Rescheduling..." : "Reschedule"}
                </button>
              </form>
              {rescheduleMsg && <p className="text-sm" style={{ marginTop: 8 }}>{rescheduleMsg}</p>}
            </div>
          )}
        </div>

        <div className="card">
          <div className="section-title">Shipment details</div>
          <Detail label="Pickup address" value={`${order.pickupAddress} (${order.pickupPincode})`} />
          <Detail label="Drop address" value={`${order.dropAddress} (${order.dropPincode})`} />
          <Detail label="Dimensions" value={`${order.lengthCm} × ${order.breadthCm} × ${order.heightCm} cm`} />
          <Detail label="Actual weight" value={`${order.actualWeightKg} kg`} />
          <Detail label="Volumetric weight" value={`${order.volumetricWeightKg} kg`} />
          <Detail label="Chargeable weight" value={`${order.chargeableWeightKg} kg`} />
          {order.assignedAgent && <Detail label="Delivery agent" value={order.assignedAgent.user.name} />}

          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
            <Detail label="Base charge" value={`₹${order.baseCharge}`} />
            <Detail label="Weight charge" value={`₹${order.weightCharge}`} />
            <Detail label="COD surcharge" value={`₹${order.codSurcharge}`} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontWeight: 700 }}>
              <span>Total charge</span>
              <span>₹{order.totalCharge}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.86rem", padding: "5px 0" }}>
      <span className="muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}
