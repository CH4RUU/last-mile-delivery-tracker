import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { motion } from "framer-motion";
import { api } from "../api/client";
import { AgentProfile, Order, OrderStatus, Zone } from "../types";

const STATUS_COLORS: Record<OrderStatus, string> = {
  CREATED: "#6366f1",
  ASSIGNED: "#0891b2",
  PICKED_UP: "#7c3aed",
  IN_TRANSIT: "#d97706",
  OUT_FOR_DELIVERY: "#ea580c",
  DELIVERED: "#16a34a",
  FAILED: "#dc2626",
  RESCHEDULED: "#a855f7",
  CANCELLED: "#64748b",
};

export default function AdminDashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([api.get("/orders"), api.get("/agents"), api.get("/zones")]).then(([o, a, z]) => {
      setOrders(o.data.orders);
      setAgents(a.data.agents);
      setZones(z.data.zones);
    });
  }, []);

  const statusData = useMemo(() => {
    const counts = new Map<OrderStatus, number>();
    for (const o of orders) counts.set(o.status, (counts.get(o.status) ?? 0) + 1);
    return Array.from(counts.entries()).map(([status, count]) => ({ status, count }));
  }, [orders]);

  const zoneData = useMemo(() => {
    return zones.map((z) => ({
      zone: z.name,
      pickups: orders.filter((o) => o.pickupZoneId === z.id).length,
      drops: orders.filter((o) => o.dropZoneId === z.id).length,
    }));
  }, [orders, zones]);

  const agentData = useMemo(() => {
    return agents.map((a) => ({
      name: a.user.name,
      active: orders.filter((o) => o.assignedAgentId === a.id && !["DELIVERED", "FAILED", "CANCELLED"].includes(o.status)).length,
      availability: a.availability,
    }));
  }, [agents, orders]);

  const totalRevenue = orders
    .filter((o) => o.status === "DELIVERED")
    .reduce((sum, o) => sum + o.totalCharge, 0);

  const availableAgents = agents.filter((a) => a.availability === "AVAILABLE").length;
  const activeOrders = orders.filter((o) => !["DELIVERED", "FAILED", "CANCELLED"].includes(o.status)).length;
  const failedOrders = orders.filter((o) => o.status === "FAILED").length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Operations dashboard</h1>
          <p>Live view of orders, zones, and delivery agent load.</p>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 20 }}>
        <StatCard label="Active orders" value={activeOrders} onClick={() => navigate("/admin/orders")} />
        <StatCard label="Available agents" value={`${availableAgents} / ${agents.length}`} onClick={() => navigate("/admin/agents")} />
        <StatCard label="Failed deliveries" value={failedOrders} onClick={() => navigate("/admin/orders?status=FAILED")} />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="section-title">Orders by status</div>
          <p className="text-sm muted" style={{ marginTop: -8, marginBottom: 4 }}>Click a slice to filter the orders table.</p>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={statusData}
                dataKey="count"
                nameKey="status"
                innerRadius={60}
                outerRadius={95}
                paddingAngle={2}
                animationBegin={0}
                animationDuration={800}
                cursor="pointer"
                label={(props: unknown) => {
                  const entry = props as { status: OrderStatus; count: number };
                  return `${entry.status}: ${entry.count}`;
                }}
                labelLine={false}
                fontSize={11}
              >
                {statusData.map((entry) => (
                  <Cell
                    key={entry.status}
                    fill={STATUS_COLORS[entry.status]}
                    onClick={() => navigate(`/admin/orders?status=${entry.status}`)}
                    style={{ cursor: "pointer" }}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="section-title">Order volume by zone</div>
          <p className="text-sm muted" style={{ marginTop: -8, marginBottom: 4 }}>Pickups vs. drops handled per zone.</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={zoneData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="zone" fontSize={12} />
              <YAxis fontSize={12} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="pickups" fill="#4f46e5" radius={[4, 4, 0, 0]} animationDuration={800} />
              <Bar dataKey="drops" fill="#a5b4fc" radius={[4, 4, 0, 0]} animationDuration={800} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="section-title">Agent workload</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {agentData.map((a) => (
            <div key={a.name} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 130, fontSize: "0.86rem", fontWeight: 600 }}>{a.name}</div>
              <div style={{ flex: 1, background: "var(--bg)", borderRadius: 6, height: 18, overflow: "hidden" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(a.active * 25, 100)}%` }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                  style={{ height: "100%", background: a.availability === "AVAILABLE" ? "#4f46e5" : "#cbd5e1", borderRadius: 6 }}
                />
              </div>
              <div style={{ width: 90, fontSize: "0.8rem" }} className="muted">
                {a.active} active
              </div>
            </div>
          ))}
          {agentData.length === 0 && <p className="muted text-sm">No agents yet.</p>}
        </div>
      </div>

      <p className="text-sm muted" style={{ marginTop: 14 }}>
        Total collected from delivered orders: <strong>₹{totalRevenue.toFixed(2)}</strong>
      </p>
    </div>
  );
}

function StatCard({ label, value, onClick }: { label: string; value: string | number; onClick: () => void }) {
  return (
    <motion.div className="stat-card" onClick={onClick} whileTap={{ scale: 0.97 }}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </motion.div>
  );
}
