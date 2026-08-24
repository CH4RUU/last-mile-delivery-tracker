# System Design — Last-Mile Delivery Tracker

## Rate calculation engine

The engine (`server/src/services/rateEngine.ts`) is a pure function:
`(dimensions, weight, orderType, paymentType, pickupZone, dropZone) →
ChargeBreakdown`. It has no hardcoded prices — every number it emits traces
back to an admin-editable `RateCard` or `CodSurcharge` row.

Design choices:

- **One rate card per `(orderType, zoneType)` pair**, not a full
  zone-to-zone matrix. The spec asks for "intra and inter-zone rates
  separately for B2B and B2C" — four numbers, not N². A full matrix would
  need a rate card per zone *pair*, which balloons combinatorially as zones
  are added and wasn't asked for. If a future requirement needs zone-pair
  pricing, the schema already carries an optional `zoneId` on `RateCard` to
  extend into that without a migration.
- **Chargeable weight = max(actual, volumetric, minChargeableWeight)**.
  Volumetric weight uses the standard `L×B×H/5000` divisor. The minimum is
  itself admin-configurable per rate card rather than a global constant, so
  different order types can carry different floors.
- **COD surcharge is a separate table**, not a column on `RateCard`,
  because it varies by `orderType` alone (not by zone type) — collapsing it
  into `RateCard` would mean redundantly repeating the same COD value on
  both the INTRA and INTER row and risking them drifting apart.
- **The charge is snapshotted onto the `Order` row at creation** (base,
  weight, COD, total, plus the volumetric/chargeable weight used). This is
  deliberate: if an admin edits a rate card next week, historical orders
  must still show what the customer actually paid. The engine is
  re-invoked live for the pre-confirmation quote and again at order
  creation (never trusting a client-supplied price), but never after that.

## Zone detection

Rather than integrating a paid geocoding API, zones are resolved from
**pincode**, via an admin-managed `Area → Zone` table. Every address on an
order carries a pincode; `zoneService.resolveZoneForPincode` looks it up and
throws a clear 422 if unmapped, rather than guessing a zone. This keeps the
entire system runnable on free-tier infra with zero external API
dependencies, at the cost of needing an admin to pre-populate area mappings
— an acceptable tradeoff since a real logistics operator already knows
exactly which pincodes it serves.

## Auto-assignment logic

`assignmentService.findNearestAvailableAgent` layers three strategies,
falling through in order:

1. **Geo-nearest** (haversine distance) when the pickup has lat/lng and at
   least one available agent has live coordinates — the "real" nearest-agent
   behavior the spec asks for.
2. **Zone match**: agents currently stationed in the order's pickup zone,
   oldest-updated first. This is the common case in this implementation,
   since orders are pincode/zone-based rather than lat/lng-based by
   default.
3. **Any available agent**, oldest-updated first, as a last resort so an
   order never goes unassignable just because its zone has no dedicated
   agent right now.

`updatedAt`-ordering in strategies 2 and 3 acts as a crude round-robin —
whichever agent was assigned longest ago gets the next job — without
needing a separate load-tracking table. Assignment itself
(`assignAgentToOrder`) is wrapped in a single `prisma.$transaction` that
flips the order to `ASSIGNED`, the agent to `BUSY`, and writes the tracking
event atomically, so a crash mid-assignment can never leave an agent
double-booked or an order silently unassigned.

## Order status lifecycle & immutable tracking

`Order.status` is a denormalized "current state" column for fast filtering;
the real source of truth is `OrderStatusEvent`, an append-only table — rows
are only ever inserted, never updated or deleted, each carrying `status`,
`actorId`/`actorRole`, an optional note, and a timestamp. This gives a
tamper-evident audit trail for free: "who moved this order to `FAILED` and
when" is always answerable, and admin overrides are distinguishable from
agent-driven transitions via `actorRole`.

Agents are restricted to a hardcoded forward-transition map (`ASSIGNED →
PICKED_UP → IN_TRANSIT → OUT_FOR_DELIVERY → {DELIVERED, FAILED}`), enforced
server-side so the API can't be driven out of order even if the UI is
bypassed. Admins bypass this map entirely, matching "admin can override any
order status."

## Failed delivery handling

`FAILED` is not a dead end: the customer-facing order page exposes a
reschedule form exactly when `status === FAILED`. Submitting it is one
transaction — write a `RescheduleRequest`, flip the order to
`RESCHEDULED`, clear `assignedAgentId` — followed by an immediate re-run of
the same auto-assignment pipeline used for new orders, so a rescheduled
delivery re-enters the normal `ASSIGNED → ...` flow (potentially with a
different agent) rather than needing a separate "resume" code path.

## Notifications

Email (Nodemailer/SMTP) and SMS (Twilio REST, no SDK) both write a
`Notification` row regardless of outcome (`SENT`/`FAILED`/`SKIPPED`), so the
notification pipeline is auditable and testable even with zero external
credentials configured — a deliberate choice for a take-home/free-tier
context where the grader shouldn't need a paid SMTP account to see the
feature work.
