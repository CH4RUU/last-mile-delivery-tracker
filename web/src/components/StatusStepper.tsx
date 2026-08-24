import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Order, OrderStatus, StatusEvent } from "../types";

const HAPPY_PATH: OrderStatus[] = [
  "CREATED",
  "ASSIGNED",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Interactive, animated tracking timeline: filled/pulsing steps reflect the
// order's real progress, and clicking any reached step reveals who did it and
// when, pulled straight from the immutable OrderStatusEvent log.
export default function StatusStepper({ order }: { order: Order }) {
  const events = order.statusEvents ?? [];
  const [selected, setSelected] = useState<number | null>(null);

  const isTerminalFailure = order.status === "FAILED" || order.status === "RESCHEDULED" || order.status === "CANCELLED";

  const latestEventForStatus = useMemo(() => {
    const map = new Map<OrderStatus, StatusEvent>();
    for (const ev of events) map.set(ev.status, ev);
    return map;
  }, [events]);

  const reachedIndex = HAPPY_PATH.indexOf(order.status);
  const effectiveReached = reachedIndex === -1 ? HAPPY_PATH.length - 1 : reachedIndex;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 0, width: "100%" }}>
        {HAPPY_PATH.map((step, i) => {
          const reached = i <= effectiveReached && !(isTerminalFailure && i === effectiveReached && step !== order.status);
          const isCurrent = step === order.status;
          const event = latestEventForStatus.get(step);
          return (
            <div key={step} style={{ display: "flex", alignItems: "center", flex: i < HAPPY_PATH.length - 1 ? 1 : "0 0 auto", minWidth: 0 }}>
              <div
                style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: event ? "pointer" : "default", minWidth: 0, width: 56 }}
                onClick={() => event && setSelected(selected === i ? null : i)}
              >
                <motion.div
                  initial={false}
                  animate={{
                    scale: isCurrent ? [1, 1.15, 1] : 1,
                    backgroundColor: reached ? "var(--primary)" : "#e2e8f0",
                  }}
                  transition={isCurrent ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: reached ? "white" : "var(--text-muted)",
                    fontSize: 13,
                    fontWeight: 700,
                    boxShadow: isCurrent ? "0 0 0 4px var(--primary-light)" : "none",
                  }}
                >
                  {reached ? "✓" : i + 1}
                </motion.div>
                <div style={{ fontSize: 9.5, marginTop: 6, textAlign: "center", color: reached ? "var(--text)" : "var(--text-muted)", fontWeight: reached ? 600 : 400, lineHeight: 1.2, wordBreak: "break-word" }}>
                  {step.replace(/_/g, " ")}
                </div>
              </div>
              {i < HAPPY_PATH.length - 1 && (
                <motion.div
                  initial={false}
                  animate={{ backgroundColor: i < effectiveReached ? "var(--primary)" : "#e2e8f0" }}
                  transition={{ duration: 0.4 }}
                  style={{ height: 3, minWidth: 6, flex: 1, marginBottom: 22, borderRadius: 2 }}
                />
              )}
            </div>
          );
        })}
      </div>

      {isTerminalFailure && (
        <div style={{ marginTop: 14 }}>
          <span className={`badge badge-${order.status.toLowerCase()}`}>{order.status.replace(/_/g, " ")}</span>
          {order.status === "FAILED" && <span className="muted text-sm" style={{ marginLeft: 8 }}>Delivery attempt failed — customer can reschedule.</span>}
        </div>
      )}

      <AnimatePresence>
        {selected !== null && latestEventForStatus.get(HAPPY_PATH[selected]) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: "hidden" }}
          >
            <div className="card" style={{ marginTop: 14, background: "var(--primary-light)", border: "none" }}>
              {(() => {
                const ev = latestEventForStatus.get(HAPPY_PATH[selected])!;
                return (
                  <>
                    <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{ev.status.replace(/_/g, " ")}</div>
                    <div className="text-sm muted" style={{ marginTop: 4 }}>
                      {fmtTime(ev.createdAt)} {ev.actor ? `· by ${ev.actor.name} (${ev.actorRole})` : "· system"}
                    </div>
                    {ev.note && <div className="text-sm" style={{ marginTop: 6 }}>{ev.note}</div>}
                  </>
                );
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="text-sm muted" style={{ marginTop: 10 }}>
        Full history
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "flex", flexDirection: "column", gap: 8 }}>
        {events.map((ev) => (
          <li key={ev.id} className="text-sm" style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px dashed var(--border)", paddingBottom: 6 }}>
            <span>
              <span className={`badge badge-${ev.status.toLowerCase()}`} style={{ marginRight: 8 }}>
                {ev.status.replace(/_/g, " ")}
              </span>
              {ev.note && <span className="muted">{ev.note}</span>}
            </span>
            <span className="muted">{fmtTime(ev.createdAt)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
