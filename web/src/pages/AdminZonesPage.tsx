import { FormEvent, useEffect, useState } from "react";
import { api, apiErrorMessage } from "../api/client";
import { Area, Zone } from "../types";

export default function AdminZonesPage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [zoneName, setZoneName] = useState("");
  const [areaForm, setAreaForm] = useState({ name: "", pincode: "", zoneId: "" });
  const [error, setError] = useState("");

  async function load() {
    const [zonesRes, areasRes] = await Promise.all([api.get("/zones"), api.get("/zones/areas")]);
    setZones(zonesRes.data.zones);
    setAreas(areasRes.data.areas);
  }

  useEffect(() => {
    load().catch((err) => setError(apiErrorMessage(err)));
  }, []);

  async function createZone(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.post("/zones", { name: zoneName });
      setZoneName("");
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function createArea(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.post("/zones/areas", areaForm);
      setAreaForm({ name: "", pincode: "", zoneId: areaForm.zoneId });
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function deleteZone(id: string) {
    setError("");
    try {
      await api.delete(`/zones/${id}`);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function deleteArea(id: string) {
    setError("");
    try {
      await api.delete(`/zones/areas/${id}`);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Zones &amp; areas</h1>
          <p>Every pincode must map to a zone before it can be used in an order.</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="grid grid-2">
        <div className="card">
          <div className="section-title">Zones</div>
          <form onSubmit={createZone} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input placeholder="Zone name, e.g. West" value={zoneName} onChange={(e) => setZoneName(e.target.value)} required />
            <button className="btn btn-sm">Add</button>
          </form>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Areas</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <tr key={z.id}>
                  <td>{z.name}</td>
                  <td className="muted">{areas.filter((a) => a.zoneId === z.id).length}</td>
                  <td>
                    <button className="btn btn-outline btn-sm" onClick={() => deleteZone(z.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="section-title">Areas (pincode → zone)</div>
          <form onSubmit={createArea} style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input placeholder="Area name" value={areaForm.name} onChange={(e) => setAreaForm((f) => ({ ...f, name: e.target.value }))} required />
              <input placeholder="Pincode" value={areaForm.pincode} onChange={(e) => setAreaForm((f) => ({ ...f, pincode: e.target.value }))} required />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <select value={areaForm.zoneId} onChange={(e) => setAreaForm((f) => ({ ...f, zoneId: e.target.value }))} required>
                <option value="">Select zone...</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
              <button className="btn btn-sm">Map area</button>
            </div>
          </form>
          <div style={{ maxHeight: 340, overflowY: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Pincode</th>
                  <th>Area</th>
                  <th>Zone</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {areas.map((a) => (
                  <tr key={a.id}>
                    <td>{a.pincode}</td>
                    <td>{a.name}</td>
                    <td className="muted">{zones.find((z) => z.id === a.zoneId)?.name}</td>
                    <td>
                      <button className="btn btn-outline btn-sm" onClick={() => deleteArea(a.id)}>
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
