# Fleetio Research: Fuel/EV, Parts & Inventory, Purchasing, Expenses & Reporting

## 1. Fuel Management

### Fuel Entries
One fuel transaction per vehicle. Channels: manual web, mobile, CSV import, fuel card integration.

Fields — Required: Date, Meter (odometer/hours at fill-up), Volume (gal/L, 3 decimals). Optional: price per unit, fuel type/grade (picklist, defaults from vehicle), Vendor (Fuel-classified only), reference (invoice/transaction #), custom fields, photos/documents, comment (@mentions). Flags: Personal use (informational), Partial fuel-up (excludes interval from economy calc), Reset usage (clears interval after missed fill-up).

Derived metrics (needs two consecutive complete entries): total cost = volume × price; distance since previous; fuel economy (MPG, km/L, or L/100km — per-user display preference); cost per mile/km/hour; cost per gallon/liter.

Calculation rules:
- Usage = current meter − previous entry meter. Economy = usage ÷ volume.
- First entry for a vehicle never gets economy metrics.
- Void meter flag: excludes meter from distance calcs, keeps volume/cost in spend reports. Metrics resume at next complete consecutive entry.
- Missed fill-up → next entry marked "Reset usage".
- Units: account defaults (General Settings), overridable per vehicle; display format per user.

Exception flagging (per-user notification toggles): Fuel Capacity Alert (volume > tank capacity — fraud/typo), Vendor Location Alert (GPS outside vendor radius), Missing GPS Location Alert.

UI: Fuel History list per-vehicle + fleet-wide; header totals (total cost, total volume, avg economy); pinnable/reorderable detail fields (per-user); column management + CSV export; Quick Add global menu.

### Fuel Card Integrations
Native: WEX, EFS, Comdata, FLEETCOR/Corpay (Fuelman, Universal Fleet Mastercard), SC Fuels (covers CFN, Pac Pride, Voyager). API partners: AtoB, Car IQ, Coast, Intevacon.
- Cards assigned to vehicles (not drivers). Transactions match card → vehicle, import nightly as Fuel Entries (vendor, volume, price, meter when captured at pump).
- Imported entries auto-create meter entries, trigger recalc. Unknown vendors auto-created with Fuel classification + "Integration Vendor" flag.
- Suspect pump-entered odometers: editable after import; auto-void option (reversible).
- Unmatched transactions land in a queue for manual vehicle assignment.

### EV Charging Entries
Parallel to fuel entries. Fields — Required: vehicle, start date/time, duration (min), total energy (kWh). Optional: price per kWh, reference, location (public/home/custom — enables home-charging reimbursement analysis), custom fields, photos, comments.
- Manual, CSV import, or automated via Geotab sensor data (with optional approval workflow for incoming entries).
- Index shows total charging cost, total energy, avg energy economy, avg cost. Rolls into Cost of Ownership and mixed-fleet cost reports.

## 2. Parts & Inventory

### Part Records
Fields: Part Number (required, unique), description, category, manufacturer, manufacturer part #, UPC, unit cost, measurement unit, photos, documents, custom fields. Two modes: Inventory Part (Track Inventory ON) vs Non-stock item (OFF; usable on WOs without qty tracking).

Part warranty (Premium): type (Limited/Lifetime/Limited Lifetime), duration (months/years) + distance, start basis (purchase vs install date), "must be returned for claim" flag. Feeds Part Warranty Opportunities report.

Lifecycle: Archive (hidden, history retained; blocked if on incomplete WOs; auto-restored if completed WO reopened) vs Delete (permanent; blocked if used in completed WOs or non-draft POs).

### Inventory Locations & Stock
- Multiple Part Locations. Part made Active per location; per-location: Aisle/Row/Bin, qty on hand, Track Inventory toggle, Reorder Point (> 0).
- Color coding: orange = at/below reorder point, red = at/below zero. Filters: Low Stock / In Stock / Out of Stock.
- Low-stock alerts: on-screen + email at reorder point, plus daily inventory digest. Alert view shows demand (qty on open WOs + pending POs).
- Transfers between locations; bulk operations.

### Adjustments & Valuation
- Manual adjustment = new qty + reason (customizable list) + comment. All movements in per-part Inventory Activity tab; fleet-wide Parts Activity Report.
- Valuation methods (account-level): Static Pricing, Average Cost, FIFO, LIFO. Advanced methods: unit cost read-only once received/consumed; location required on WO part lines.

### Tire Tracking (Premium)
- Tire part categories get spec fields: tire type, width, aspect ratio, construction, rim diameter, load index, speed rating, factory/min tread depth, life expectancy.
- Individual tire identity via TIN/DOT number; tracked through lifecycle.
- Axle configuration per vehicle → interactive axle diagram on Tire Management tab; install/remove/rotate (predefined + custom rotation patterns); tread depth & pressure readings (auto via Geotab TPMS); Tire Activity tab.

### Parts in Work Orders
- WO Part Line Item: part, quantity, unit cost, optional inventory location, toggle inventory adjustment, linked service task.
- Completing WO auto-decrements stock; costs roll into WO and vehicle totals. Parts by Vehicle report; Work Order Activity on part record.
- PartsTech integration: search/compare/order parts & tires in-app.

## 3. Purchase Orders & Vendors

### Purchase Orders
Fields: PO number, Vendor (required, Parts-classified), Part Location (required — receiving destination), description, labels, custom fields, documents, line items (part + qty + unit cost; only parts active at PO's location), order-level Discount/Shipping/Tax.

Status lifecycle (names & colors customizable): Draft → Pending Approval → (Rejected | Approved) → Purchased → Received Partial → Received Full → Closed.

Approval: admins "Save and Approve" directly; others "Submit for Approval"; approvers get email; policy-based automations can auto-approve low-dollar POs.

Receiving: from Purchased, "Receive" button → per-line received qty → auto inventory adjustments (cost layered per valuation method). Receive-to-Work-Order (Premium): each line → inventory, existing WO, or new WO; stock recorded even if WO save fails.

UI: stage tabs/filters; Details/Line Items/Documents tabs; comments with @mentions; watchers (auto-subscribe on create/edit/status change/comment); pinnable fields.

### Vendors
Fields: name (required), phone, website, address (maps link; powers fuel geofence alerts), primary contact, labels, custom fields, notes, photos.
Classifications (multi-select): Fuel, Service, Parts, Equipment/Tools, Vehicles — scopes which dropdowns show the vendor. Auto-classification from integrations.
Detail page: rollup of linked fuel entries, charging entries, service entries, WOs, POs; map; watch; pinned fields.
List: classification tabs + Archived + user-saved custom view tabs; bulk actions; Merge for duplicates; archive vs delete with integrity guards.

## 4. Expenses & Cost Reporting

### Expense Entries
Fields: vehicle, date, Expense Type (account-managed picklist), vendor, amount, notes, custom fields, photos/documents. Web-only.
Recurring: start/end date + frequency → system generates series (end-date exclusive). 
Surfaces: vehicle Expense History tab (Past/Future), dashboard "Other Costs" widget, Cost of Ownership card, cost-per-meter, reports.

### Cost Model
Total Cost = fuel (+ EV energy) + service/WO + other expenses. Cost per Meter = total ÷ (mi|km|hr), per vehicle and fleet.
Operating Cost Summary report: service vs fuel vs other breakdown + avg cost/meter. Also: cost by month trend, cost-per-mile trend, cost comparison by year-in-service (replacement analysis).

## 5. Reports Module

Sidebar "Reports", ~10 categories. Every report = filterable, column-configurable grid (Summary or Details layout), CSV + PDF export. AND across fields, OR within a field.

Catalog:
- Vehicles: Cost Comparison by Year in Service, Cost/Meter Trend, Expense Summary, Expenses by Vehicle, Group Changes, Operating Costs Summary, Status Changes, Status Summary, Tire Activity, Total Cost Trend, Utilization Summary, Vehicle Details, Vehicle Renewal Reminders, Vehicles Report
- Vehicle Assignments: Assignment Log, Assignments Summary
- Inspections: Failures List, Schedules, Submission List, Submissions Summary
- Issues: Issues List, Faults Summary
- Service: Maintenance Categorization Summary, Repair Priority Class Summary, Service Entries Summary, Service History by Vehicle, Service Reminder Compliance, Service Reminders, Service Task Summary, Vehicles without Service
- Warranties: Part Warranty Opportunities, Vehicle Warranty Opportunities
- Work Orders: Labor Time Entries List, Technician Labor Summary, WO Status Summary, WOs by Vehicle, WOs List
- Contacts: Contact Renewal Reminders, Contacts List
- Parts: Parts Activity, Parts by Location, Parts by Vehicle, Purchase Orders List
- Fuel: Fuel Entries by Vehicle, Fuel Summary, Fuel Summary by Location (IFTA-oriented)

Saved & scheduled: save filters/columns/sort as named report; copyable; favorites; schedule email delivery weekly/monthly with time of day; test email preview.

## 6. Cross-Cutting UI Patterns
1. Pinnable, reorderable detail fields (per-user)
2. Watchers + @mention comments with notification fan-out
3. Tabbed saved views on index pages
4. Column management → export on every list
5. Customizable enums (PO statuses, expense types, adjustment reasons, fuel types, part categories)
6. Classification-scoped vendor dropdowns
7. Flags-not-deletes for data quality (partial, reset usage, void meter)
8. Merge for duplicates; archive vs delete with referential guards
9. Plan-gating: tires, part warranties, receive-to-WO are premium
