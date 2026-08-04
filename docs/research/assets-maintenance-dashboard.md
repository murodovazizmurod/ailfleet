# Fleetio Research: Asset Management + Maintenance + Dashboard

## 1. Asset / Vehicle Management

### Asset model
- Vehicles = anything with a meter: cars, trucks, vans, buses, trailers, forklifts, boats, excavators (trailers/equipment are Vehicles with a Type + hour meters).
- Tools/Equipment = auxiliary assets (generators, chainsaws): brand, model, serial, status, photos, purchase details, check-out/check-in, contact assignment, link to a Vehicle. Service entries but no WO/reminder machinery.

### Vehicle fields
Required: name (unique), meter_unit (mi/km/hr), fuel_volume_units, status, type, ownership (owned/leased/rented/customer/financed/rent_to_own), system_of_measurement.
Identification: VIN (unique), plate, year/make/model/trim, color, group (hierarchical), registration state, fuel type, external IDs, labels.
Specs sections: Body (body_type/subtype, drive type, axle config, brake system), Dimensions, Engine (12+ fields), Transmission, Wheels/tires, Capacity (fuel tank, GVWR, payload, MSRP, EPA mpg).
Financial tab:
- Purchase: date, price, meter at purchase, vendor, warranty expiration date + meter, purchase custom fields
- Loan/Lease: type, lender, dates, monthly cost, loan amount/cap cost, down payment, APR, payments, residual value, mileage cap + overage, generate_expenses toggle → auto recurring Expense Entries
- Lifecycle: in/out-of-service date + meter, est. service life (months + meter), est. resale. UI: % through useful life as two bars (time vs meter). No true depreciation engine (gap/opportunity).
Settings per vehicle: primary meter unit, secondary meter, usage/day (manual or auto — drives reminder forecasting).

### Types & Statuses (lookup tables)
- Types: predefined + custom, one default, delete only when unused.
- Statuses: defaults Active, Inactive, In Shop, Out of Service, Sold; custom = name + color + default flag; delete only if unused. Archive vehicle = removes from billing/reminders, keeps history.

### Groups
Hierarchical tree for Vehicles, Tools, Contacts; drives filtering + record-set permissions. Dashboard global group filter.

### Meters
- Primary + optional secondary. Append-only Meter Entries fed by: manual, CSV, fuel entries, service entries/WOs, inspections, telematics.
- Validation: monotonically increasing by date; backdated entry must fit between neighbors; failing entries → Void (kept, excluded from calcs). Stale-meter highlight after 30 days. Avg usage/day auto-computed.

### Assignments
Contact + start + optional end. One operator per vehicle at a time (overlap validation). History tab: future = yellow, current = green flag; current operator in vehicle header.

### Index UI
Tabs (Assigned/Unassigned/Archived + saved views), search, quick filters (Type/Group/Status), advanced filters, Manage Columns, CSV export/import, bulk actions (update, archive, watchers).

### Detail page UI
Tabs: Overview, Telematics, Service History, Work Orders, Warranties (reorderable). Overview = cards: Fields, Open Issues, Service Reminders, photos/comments/docs. Per-user pinned fields + layout management. Header "+ Add" menu for all record types. Uniform chrome: watchers, comments/@mentions, attachments, change history.

### Custom Fields
7 types: Text, Number, Currency, Date, DateTime, Dropdown, Checkbox. On 13 record types. Required toggle, per-role view/edit.

## 2. Maintenance Management

### Core loop
Service Task (catalog) → Service Reminder (per-vehicle) or Service Program (fleet template) → Work Order (in-house) or Service Entry (log/outsourced) → completion resets reminders, resolves Issues, decrements stock, writes history + costs.

### Service Tasks
Unique name, description, subtasks (1 level; subtask can have multiple parents; parent added to WO auto-adds subtask lines), default VMRS codes, linked Parts with expected qty (auto-populate on WO), Expected Labor Hours (drives under/over status tags), linked Inspection Form. Standard (VMRS-coded) vs custom; merge; archive vs delete.

### Service Reminders
Vehicle + task + intervals: primary meter, secondary meter, and/or time — whichever comes first. Due-soon thresholds per dimension. States: OK → Due Soon → Overdue; auto-reset when task appears in saved Service Entry or completed WO. Next due = last completed + interval. Optional assignee (auto-cleared on reset); snooze; watchers. Notifications at 7:00 AM on state change, repeat every 7 days; Monday weekly digest. "Enter Service" pre-populates SE/WO. Forecasting via avg usage/day.

### Service Programs
Program = Service Schedules (task set + time/meter interval + threshold) + assigned assets. Inheritance: add vehicle → inherits reminders; schedule edits propagate. Program reminders locked per-vehicle. Assignment: by year/make/model, hand-picked, all, or attribute rules (auto-enroll). Conflicts on join: individual duplicates replaced, other-program duplicates duplicated (preview shown). First Service option for OEM break-in.

### Service Entries
Fields: vehicle, completion date (+start), meter (+void), secondary meter, vendor (Service-classified), reference #, labels, repair priority code. Line items = tasks with notes, labor + parts cost (direct or itemized), VMRS auto-fill, linked open Issues, inline reminder view. Money: subtotals → markup, warranty credits, discount (% or fixed), tax → total. On save: resolves Issues, resets reminders.

### Work Orders
Header: auto WO number (configurable), vehicle, status, issue date, scheduled start, actual start, expected/actual completion, start + completion meter, assigned contact, vendor, invoice #, PO #, labels, custom fields, issued-by.
Statuses: defaults Open, Pending, Completed; custom (name + color + default + order).
Completion side effects: status → Completed: resolve all attached Issues, log tasks, auto-generate Service Entry, reset reminders, decrement stock. Reopening deletes the Service Entry. Edit completed = reopen → edit → re-complete.
Line items (3 types):
- Service Task lines: from due reminders or search; VMRS; Complaint/Cause/Correction fields; task history + warranty visibility
- Labor sub-lines: technician, hours (manual or stopwatch time entries with punch in/out), rate; expected-vs-actual tag
- Parts sub-lines: part search, qty, unit cost, location; stock auto-decremented on completion; task-linked parts auto-populate
Standalone lines can be moved under a task line. Totals: discounts, markups, tax.
Views: List (saved views), Calendar (drag-drop), Resource Scheduler (lanes by vehicle/assignee; day/week/month). Copy WO. Bulk WO generation from issues.

### Outsourced / Shop Network
Basic: WO/SE with Vendor + invoice/PO. MSN: shop directory → shop keys estimate → manager emailed → Approve All or line-by-line approve/reject → approved RO syncs as completed Service Entry. Auto-approval rules by cost ceiling/provider/line type. Consolidated monthly billing. "ROs Needing Approval" dashboard widget.

### PM compliance
Service Reminder Compliance report + On-Time Service Compliance widget (30-day + all-time %).

## 3. Dashboard
Widget grid: drag/resize/rename/filter/duplicate/remove per widget; dashboard-level group filter; multiple named dashboards with visibility scopes (Only Me/Everyone/Admin/Specific Users/Roles). Widgets respect viewer permissions.

Widget catalog:
- Vehicles: Latest Meter Readings, Vehicle Assignments counts, Vehicle Locations, Renewal Reminders, Status breakdown
- Inspections: item failure rate, submissions (7-day vs prior), summary, overdue
- Issues: open issues (open + overdue), faults (all/critical), avg time-to-resolve (6-month)
- Service: Incomplete WOs by status, Service Reminders (overdue/upcoming), On-Time Compliance %, ROs Needing Approval, Labor in Progress, Repair Priority trends, Top VMRS codes
- Costs: 6-month bars Fuel/Service/Other/Total, Cost per Meter
- Parts: out-of-stock + low-stock counts, PO counts by status, monthly usage, inventory value
- Contacts: renewal reminders
- Other: recent comments feed

## 4. Build takeaways
1. Everything is a configurable lookup (statuses, types, labels): name + color + default + order + delete-only-if-unused
2. Uniform record chrome: watchers, comments, attachments, history, custom fields, pinned fields
3. Uniform index chrome: tabs + saved views + filters + column manager + bulk + CSV
4. WO completion = transactional pivot with reversible side effects
5. Reminder engine: interval + threshold per dimension, reset-on-service, forecasting, snooze, re-notify
6. Program → reminder inheritance with locked children
7. Meter log = validated append-only stream with void escape hatch
8. Gaps: no depreciation engine, reminder suppression not tied to status, clunky completed-WO editing
