# AIlFleet — Build Spec

AIlFleet is a fleet-management platform matching Fleetio feature-for-feature with an original
implementation and UI. Detailed research: `docs/research/*.md`.

## Core object model (the spine)

```
Vehicle → MeterEntries → ServiceReminders ─┐
Inspections (fail) ──→ Issues ←── Faults    │
                         │                  ▼
                         └──→ WorkOrders (in-house, labor+parts)
                                   │ complete
                                   ▼
                             ServiceEntry (cost history) → Reports (cost/meter, TCO)
```
Everything that "needs attention" converges on **Issues**. Work-order completion is the
transactional pivot: resolve issues + generate service entry + reset reminders + decrement stock.

## Modules (v1 scope — this build)

### Dashboard
Widget grid: vehicle status breakdown, open/overdue issues, service reminders due, incomplete
WOs by status, costs 6-month bars (fuel/service/other/total), cost-per-meter, low-stock parts,
inspection submissions & failure rate, renewals due, recent comments.

### Vehicles
List (tabs: all/assigned/unassigned/archived; search, filters by type/group/status; column set;
CSV export). Detail page with Overview cards (specs, open issues, reminders), tabs: Service
History, Work Orders, Fuel, Expenses, Meters, Assignments, Renewals. Statuses: active, inactive,
in_shop, out_of_service, sold. Groups (hierarchical). Assignments (one operator at a time).
Meter entries: append-only, monotonic validation, void flag, sources (manual/fuel/WO/inspection/
telematics), stale highlight at 30 days.

### Issues
Statuses open → (overdue overlay) → resolved | closed, reopen. Sources: manual, inspection fail,
fault. Priority, assignee, due date/meter, photos. Resolve via note / add to WO. Bulk add to WO.
Resolution metadata incl. time-to-resolve.

### Inspections
Form builder: item types pass_fail, number (range), meter, text, dropdown (per-choice pass/fail),
date, photo, signature, section. Per-item required + require photo/comment on fail. Submission
flow with duration tracking; failed items auto-create issues (default workflow). Submission list
+ detail; failure-rate stats.

### Maintenance
- Service tasks catalog (seeded with standard tasks)
- Service reminders: time and/or meter intervals, whichever-first, due-soon thresholds,
  OK/due_soon/overdue, auto-reset on completed service, forecasting via avg usage/day
- Service programs: schedules + vehicle assignment, reminder inheritance
- Work orders: number, status (open/pending/in_progress/waiting_on_parts/completed/closed),
  priority, repair class, assigned tech, vendor, line items (task + labor lines + part lines),
  totals with tax; completion side effects (issues resolved, service entry generated, reminders
  reset, stock decremented); reopening deletes service entry
- Service entries: standalone log or auto-generated from WO

### Fuel & Energy
Fuel entries: date, meter, volume, price/unit, vendor, partial/personal/reset flags, receipt
reference. Economy calc: usage ÷ volume between consecutive complete entries; first entry no
metrics; partial excludes interval. Exception flags (volume > tank capacity). EV charging
entries (kWh, duration, cost, location). History lists with header totals.

### Parts & Inventory
Parts (number, category, manufacturer, cost), locations, per-location stock with reorder points
(orange at reorder, red at zero), adjustments with reasons + activity log, low-stock view.
Parts consumed by WOs decrement stock on completion.

### Purchase Orders
Draft → pending_approval → approved/rejected → purchased → received_partial → received_full →
closed. Line items, receive flow creates inventory adjustments.

### Vendors
Classifications (fuel/service/parts/vehicles) scope dropdowns. Detail rollup of linked records.

### Contacts & Users
Contacts (operator/technician flags, license info, renewals). Users with roles: admin, manager,
technician, operator. Simple auth (email+password, session cookie).

### Renewals
Vehicle renewals (registration, insurance, emission, inspection) and contact renewals (license,
certification): due date + due-soon threshold, OK/due_soon/overdue, complete → roll forward.

### Reports
Operating cost summary (service vs fuel vs other + cost/meter), fuel summary, service history by
vehicle, issues list, WO status summary, parts activity, utilization/status summary. Filterable
tables + CSV export.

### Integrations (architecture + simulated providers)
- Integration connections registry (telematics: geotab/samsara/motive; fuel cards: wex/comdata;
  accounting: quickbooks) with connect/disconnect/sync status
- Simulated sync endpoints that demonstrate the real data flow: telematics sync → meter entries
  + fault codes (→ issues via fault rules); fuel card sync → fuel entries
- REST API v1 (`/api/v1/*`): token auth (Authorization: Token), cursor pagination, resources for
  vehicles, issues, work_orders, fuel_entries, parts, service_entries, contacts, vendors
- Webhooks: per-event subscription, HMAC-SHA256 signature, delivery log with retries

## Deliberately deferred (v2+)
Mobile app, offline mode, real provider OAuth/API connections, SSO/SAML, workflow automation
builder, tire tracking, warranties, VMRS coding, custom fields UI, multi-dashboard, shop network,
AI receipt OCR, record sets (row-level permissions), audit trail UI.

## Conventions
- Next.js App Router + server components; server actions for mutations
- Prisma + SQLite (`prisma/dev.db`); enum-likes are strings validated in `src/lib/enums.ts`
- Money: floats, formatted via `src/lib/format.ts`; dates ISO
- UI: Tailwind, lucide-react icons, recharts for charts; shared components in
  `src/components/ui/*` (DataTable, StatusBadge, PageHeader, StatCard, EmptyState, Modal forms)
- Each module: `src/app/(app)/<module>/page.tsx` list, `[id]/page.tsx` detail, `new/page.tsx`
  create; server actions in `src/app/(app)/<module>/actions.ts`
```
