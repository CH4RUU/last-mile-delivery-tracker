import { useEffect, useState } from "react";
import { api, apiErrorMessage } from "../api/client";
import { CodSurcharge, OrderType, RateCard, RateZoneType, SurchargeUnit } from "../types";

const ORDER_TYPES: OrderType[] = ["B2B", "B2C"];
const ZONE_TYPES: RateZoneType[] = ["INTRA", "INTER"];

export default function AdminRateCardsPage() {
  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [codSurcharges, setCodSurcharges] = useState<CodSurcharge[]>([]);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  async function load() {
    const [rc, cod] = await Promise.all([api.get("/rate-cards"), api.get("/rate-cards/cod-surcharges")]);
    setRateCards(rc.data.rateCards);
    setCodSurcharges(cod.data.codSurcharges);
  }

  useEffect(() => {
    load().catch((err) => setError(apiErrorMessage(err)));
  }, []);

  function findCard(orderType: OrderType, zoneType: RateZoneType) {
    return rateCards.find((r) => r.orderType === orderType && r.zoneType === zoneType);
  }

  async function saveCard(orderType: OrderType, zoneType: RateZoneType, baseCharge: number, perKgRate: number) {
    setError("");
    setSaved("");
    try {
      await api.post("/rate-cards", { orderType, zoneType, baseCharge, perKgRate });
      setSaved(`${orderType} / ${zoneType} rate card saved.`);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function saveCod(orderType: OrderType, unit: SurchargeUnit, value: number) {
    setError("");
    setSaved("");
    try {
      await api.post("/rate-cards/cod-surcharges", { orderType, unit, value });
      setSaved(`${orderType} COD surcharge saved.`);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Rate cards</h1>
          <p>Base charge + per-kg rate, split by order type and intra/inter zone. No hardcoded pricing anywhere else in the system.</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {saved && <div className="alert alert-success">{saved}</div>}

      <div className="grid grid-2">
        {ORDER_TYPES.map((orderType) => (
          <div className="card" key={orderType}>
            <div className="section-title">{orderType} rate cards</div>
            {ZONE_TYPES.map((zoneType) => (
              <RateCardRow
                key={zoneType}
                orderType={orderType}
                zoneType={zoneType}
                card={findCard(orderType, zoneType)}
                onSave={saveCard}
              />
            ))}
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
              <CodRow orderType={orderType} surcharge={codSurcharges.find((c) => c.orderType === orderType)} onSave={saveCod} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RateCardRow({
  orderType,
  zoneType,
  card,
  onSave,
}: {
  orderType: OrderType;
  zoneType: RateZoneType;
  card?: RateCard;
  onSave: (orderType: OrderType, zoneType: RateZoneType, base: number, perKg: number) => void;
}) {
  const [base, setBase] = useState(card?.baseCharge?.toString() ?? "");
  const [perKg, setPerKg] = useState(card?.perKgRate?.toString() ?? "");

  useEffect(() => {
    setBase(card?.baseCharge?.toString() ?? "");
    setPerKg(card?.perKgRate?.toString() ?? "");
  }, [card]);

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 10 }}>
      <div style={{ width: 60, fontSize: "0.82rem", fontWeight: 600, paddingBottom: 9 }}>{zoneType}</div>
      <div className="form-field" style={{ marginBottom: 0 }}>
        <label>Base ₹</label>
        <input type="number" min={0} value={base} onChange={(e) => setBase(e.target.value)} />
      </div>
      <div className="form-field" style={{ marginBottom: 0 }}>
        <label>₹/kg</label>
        <input type="number" min={0} value={perKg} onChange={(e) => setPerKg(e.target.value)} />
      </div>
      <button className="btn btn-sm" onClick={() => onSave(orderType, zoneType, Number(base), Number(perKg))} disabled={!base || !perKg}>
        Save
      </button>
    </div>
  );
}

function CodRow({
  orderType,
  surcharge,
  onSave,
}: {
  orderType: OrderType;
  surcharge?: CodSurcharge;
  onSave: (orderType: OrderType, unit: SurchargeUnit, value: number) => void;
}) {
  const [unit, setUnit] = useState<SurchargeUnit>(surcharge?.unit ?? "FLAT");
  const [value, setValue] = useState(surcharge?.value?.toString() ?? "");

  useEffect(() => {
    setUnit(surcharge?.unit ?? "FLAT");
    setValue(surcharge?.value?.toString() ?? "");
  }, [surcharge]);

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
      <div style={{ fontSize: "0.82rem", fontWeight: 600, paddingBottom: 9, width: 60 }}>COD</div>
      <div className="form-field" style={{ marginBottom: 0 }}>
        <label>Unit</label>
        <select value={unit} onChange={(e) => setUnit(e.target.value as SurchargeUnit)}>
          <option value="FLAT">Flat ₹</option>
          <option value="PERCENT">% of charge</option>
        </select>
      </div>
      <div className="form-field" style={{ marginBottom: 0 }}>
        <label>Value</label>
        <input type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
      <button className="btn btn-sm" onClick={() => onSave(orderType, unit, Number(value))} disabled={!value}>
        Save
      </button>
    </div>
  );
}
