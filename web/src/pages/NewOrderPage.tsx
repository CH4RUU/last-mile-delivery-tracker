import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { api, apiErrorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { ChargeQuote, OrderType, PaymentType } from "../types";

const initialForm = {
  customerEmail: "",
  pickupAddress: "",
  pickupPincode: "",
  dropAddress: "",
  dropPincode: "",
  lengthCm: "",
  breadthCm: "",
  heightCm: "",
  actualWeightKg: "",
  orderType: "B2C" as OrderType,
  paymentType: "PREPAID" as PaymentType,
};

export default function NewOrderPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [form, setForm] = useState(initialForm);
  const [quote, setQuote] = useState<ChargeQuote | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  function set<K extends keyof typeof initialForm>(key: K, value: (typeof initialForm)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const numericReady =
    form.pickupPincode && form.dropPincode && form.lengthCm && form.breadthCm && form.heightCm && form.actualWeightKg;

  useEffect(() => {
    if (!numericReady) {
      setQuote(null);
      return;
    }
    const handle = setTimeout(async () => {
      setQuoting(true);
      setQuoteError("");
      try {
        const res = await api.post("/orders/quote", {
          pickupAddress: form.pickupAddress || "-",
          pickupPincode: form.pickupPincode,
          dropAddress: form.dropAddress || "-",
          dropPincode: form.dropPincode,
          lengthCm: Number(form.lengthCm),
          breadthCm: Number(form.breadthCm),
          heightCm: Number(form.heightCm),
          actualWeightKg: Number(form.actualWeightKg),
          orderType: form.orderType,
          paymentType: form.paymentType,
        });
        setQuote(res.data);
      } catch (err) {
        setQuote(null);
        setQuoteError(apiErrorMessage(err));
      } finally {
        setQuoting(false);
      }
    }, 450);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.pickupPincode, form.dropPincode, form.lengthCm, form.breadthCm, form.heightCm, form.actualWeightKg, form.orderType, form.paymentType]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!quote) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await api.post("/orders", {
        customerEmail: isAdmin ? form.customerEmail : undefined,
        pickupAddress: form.pickupAddress,
        pickupPincode: form.pickupPincode,
        dropAddress: form.dropAddress,
        dropPincode: form.dropPincode,
        lengthCm: Number(form.lengthCm),
        breadthCm: Number(form.breadthCm),
        heightCm: Number(form.heightCm),
        actualWeightKg: Number(form.actualWeightKg),
        orderType: form.orderType,
        paymentType: form.paymentType,
      });
      navigate(`/orders/${res.data.order.id}`);
    } catch (err) {
      setSubmitError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>New order</h1>
          <p>Enter package details to see the auto-calculated charge before confirming.</p>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="section-title">Order details</div>
          <form onSubmit={onSubmit}>
            {isAdmin && (
              <div className="form-field">
                <label>Customer email (order placed on their behalf)</label>
                <input
                  type="email"
                  value={form.customerEmail}
                  onChange={(e) => set("customerEmail", e.target.value)}
                  placeholder="customer@tracker.dev"
                  required
                />
              </div>
            )}
            <div className="form-row" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div className="form-field">
                <label>Pickup address</label>
                <input value={form.pickupAddress} onChange={(e) => set("pickupAddress", e.target.value)} required />
              </div>
              <div className="form-field">
                <label>Pickup pincode</label>
                <input value={form.pickupPincode} onChange={(e) => set("pickupPincode", e.target.value)} placeholder="110085" required />
              </div>
            </div>
            <div className="form-row" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div className="form-field">
                <label>Drop address</label>
                <input value={form.dropAddress} onChange={(e) => set("dropAddress", e.target.value)} required />
              </div>
              <div className="form-field">
                <label>Drop pincode</label>
                <input value={form.dropPincode} onChange={(e) => set("dropPincode", e.target.value)} placeholder="110017" required />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label>Length (cm)</label>
                <input type="number" min={1} value={form.lengthCm} onChange={(e) => set("lengthCm", e.target.value)} required />
              </div>
              <div className="form-field">
                <label>Breadth (cm)</label>
                <input type="number" min={1} value={form.breadthCm} onChange={(e) => set("breadthCm", e.target.value)} required />
              </div>
              <div className="form-field">
                <label>Height (cm)</label>
                <input type="number" min={1} value={form.heightCm} onChange={(e) => set("heightCm", e.target.value)} required />
              </div>
            </div>

            <div className="form-row" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
              <div className="form-field">
                <label>Actual weight (kg)</label>
                <input type="number" min={0.1} step={0.1} value={form.actualWeightKg} onChange={(e) => set("actualWeightKg", e.target.value)} required />
              </div>
              <div className="form-field">
                <label>Order type</label>
                <select value={form.orderType} onChange={(e) => set("orderType", e.target.value as OrderType)}>
                  <option value="B2C">B2C</option>
                  <option value="B2B">B2B</option>
                </select>
              </div>
              <div className="form-field">
                <label>Payment type</label>
                <select value={form.paymentType} onChange={(e) => set("paymentType", e.target.value as PaymentType)}>
                  <option value="PREPAID">Prepaid</option>
                  <option value="COD">Cash on delivery</option>
                </select>
              </div>
            </div>

            {submitError && <div className="alert alert-error">{submitError}</div>}

            <button className="btn" type="submit" disabled={!quote || submitting} style={{ marginTop: 6 }}>
              {submitting ? "Placing order..." : "Confirm & place order"}
            </button>
          </form>
        </div>

        <div>
          <div className="card" style={{ position: "sticky", top: 28 }}>
            <div className="section-title">Charge preview</div>
            {!numericReady && <p className="muted text-sm">Fill in pincodes, dimensions and weight to see the calculated charge.</p>}
            {quoting && <p className="muted text-sm">Calculating...</p>}
            {quoteError && numericReady && !quoting && <div className="alert alert-error">{quoteError}</div>}
            <AnimatePresence mode="wait">
              {quote && !quoting && (
                <motion.div
                  key={quote.breakdown.totalCharge}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <Row label="Pickup zone" value={quote.pickupZone.zoneName} />
                  <Row label="Drop zone" value={quote.dropZone.zoneName} />
                  <Row label="Zone type" value={quote.breakdown.zoneType} />
                  <Row label="Volumetric weight" value={`${quote.breakdown.volumetricWeightKg} kg`} />
                  <Row label="Chargeable weight" value={`${quote.breakdown.chargeableWeightKg} kg (higher of actual vs volumetric)`} />
                  <hr style={{ border: "none", borderTop: "1px dashed var(--border)", margin: "10px 0" }} />
                  <Row label="Base charge" value={`₹${quote.breakdown.baseCharge}`} />
                  <Row label="Weight charge" value={`₹${quote.breakdown.weightCharge}`} />
                  <Row label="COD surcharge" value={`₹${quote.breakdown.codSurcharge}`} />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                    <span style={{ fontWeight: 700 }}>Total</span>
                    <motion.span
                      key={quote.breakdown.totalCharge + "-total"}
                      initial={{ scale: 1.15, color: "#4f46e5" }}
                      animate={{ scale: 1, color: "#1a2233" }}
                      transition={{ duration: 0.4 }}
                      style={{ fontWeight: 800, fontSize: "1.15rem" }}
                    >
                      ₹{quote.breakdown.totalCharge}
                    </motion.span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.86rem", padding: "3px 0" }}>
      <span className="muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}
