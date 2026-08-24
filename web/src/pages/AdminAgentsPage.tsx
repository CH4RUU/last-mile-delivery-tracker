import { FormEvent, useEffect, useState } from "react";
import { api, apiErrorMessage } from "../api/client";
import { AgentProfile, Zone } from "../types";
import { AvailabilityBadge } from "../components/StatusBadge";

export default function AdminAgentsPage() {
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", currentZoneId: "" });
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    const [a, z] = await Promise.all([api.get("/agents"), api.get("/zones")]);
    setAgents(a.data.agents);
    setZones(z.data.zones);
  }

  useEffect(() => {
    load().catch((err) => setError(apiErrorMessage(err)));
  }, []);

  async function createAgent(e: FormEvent) {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      await api.post("/agents", { ...form, currentZoneId: form.currentZoneId || undefined, phone: form.phone || undefined });
      setForm({ name: "", email: "", phone: "", password: "", currentZoneId: "" });
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Delivery agents</h1>
          <p>Create agent accounts and see who's available for auto-assignment.</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="grid grid-2">
        <div className="card">
          <div className="section-title">Add agent</div>
          <form onSubmit={createAgent}>
            <div className="form-field">
              <label>Name</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="form-field">
              <label>Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
            </div>
            <div className="form-field">
              <label>Phone</label>
              <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="form-field">
              <label>Temporary password</label>
              <input type="password" minLength={6} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required />
            </div>
            <div className="form-field">
              <label>Home zone</label>
              <select value={form.currentZoneId} onChange={(e) => setForm((f) => ({ ...f, currentZoneId: e.target.value }))}>
                <option value="">Unassigned</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn" disabled={creating}>
              {creating ? "Creating..." : "Create agent"}
            </button>
          </form>
        </div>

        <div className="card" style={{ padding: 0 }}>
          <div className="section-title" style={{ padding: "18px 20px 0" }}>
            All agents ({agents.length})
          </div>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Zone</th>
                <th>Availability</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.id}>
                  <td>
                    {a.user.name}
                    <div className="text-sm muted">{a.user.email}</div>
                  </td>
                  <td>{a.currentZone?.name ?? <span className="muted">-</span>}</td>
                  <td>
                    <AvailabilityBadge status={a.availability} />
                  </td>
                </tr>
              ))}
              {agents.length === 0 && (
                <tr>
                  <td colSpan={3} className="empty-state">
                    No agents yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
