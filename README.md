# AIlFleet

Fleet operations platform — an original, feature-for-feature implementation of the Fleetio
feature set: vehicles, preventive maintenance, DVIR inspections, issues, work orders, fuel &
EV charging, parts inventory, purchasing, reports, integrations, and a REST API.

## Quick start

```bash
npm install
npx prisma db push        # creates prisma/dev.db (SQLite)
npx tsx prisma/seed.ts    # loads the demo fleet
npm run dev               # http://localhost:3000
```

Demo users (email / password): `alex@ailfleet.test` / `admin123` (admin),
`priya@ailfleet.test` / `tech123`, `carlos@ailfleet.test` / `driver123`.
(Passwords stored as sha256; auth UI is on the v2 list — the app currently runs open.)

Demo API token: `aif_demo_token_123`

```bash
curl -H "Authorization: Token aif_demo_token_123" http://localhost:3000/api/v1/vehicles
```

## Modules

| Route | What it does |
|---|---|
| `/dashboard` | KPI cards, vehicle status, 6-month cost chart, reminders/issues/WO widgets |
| `/vehicles` | Asset registry: tabs, filters, 8-tab detail (service, fuel, meters, assignments…) |
| `/issues` | Defect lifecycle: open → resolved/closed, attach to WO, comments, fault links |
| `/inspections` | DVIR form builder, inspection runner, failed items auto-create issues |
| `/work-orders` | Line items (tasks + labor + parts); completing resolves issues, writes service entry, resets reminders, decrements stock |
| `/reminders` | PM schedules: meter/time intervals, whichever-first, due-soon thresholds |
| `/fuel` | Fuel + EV charging history, MPG calculation, exception flagging |
| `/parts` | Inventory by location, reorder points, adjustments log |
| `/purchase-orders` | Draft → approval → purchase → receive-to-stock → close |
| `/vendors` | Classification-scoped vendor registry with linked-record rollups |
| `/contacts` | Operators/technicians, license info, renewals |
| `/renewals` | Vehicle + contact renewal reminders with live-derived status |
| `/reports` | 7 reports with filters + CSV export |
| `/integrations` | Telematics/fuel-card/accounting registry with simulated sync engines |
| `/settings` | Company settings, API tokens, webhooks (HMAC-signed), users |

## Architecture

- **Next.js 16** (App Router, server components + server actions), React 19, Tailwind v4
- **Prisma 6 + SQLite** — 35+ models in `prisma/schema.prisma`; enum-likes are strings
  validated in `src/lib/enums.ts`
- **REST API** `/api/v1/*` — token auth, cursor pagination, zod validation
- **Webhooks** — per-event subscriptions, HMAC-SHA256 signatures, delivery log
- Research corpus + build spec: `docs/FEATURES.md`, `docs/research/*.md`

The core loop (see `src/lib/workorder.ts`): inspections, driver reports, and telematics fault
codes all converge into **Issues**; issues feed **Work Orders**; WO completion is a
transaction that resolves issues, generates the **Service Entry** cost record, resets
**Service Reminders**, and decrements **Part Stock** — reopening reverses it.
