# Fleetio Research: Integrations, API & Webhooks, Platform

## 1. Pricing Tiers
Per vehicle per month, 5-vehicle minimum, unlimited users (pay per asset, not per seat).

| | Essential ($4) | Professional ($7) | Premium ($10) |
|---|---|---|---|
| Custom roles | 4 | 15 | 30 |
| Custom Record Sets (row-level access) | ✗ | ✓ | ✓ |
| Technician labor on WOs | ✗ | ✓ | ✓ |
| Webhooks + Integration Links | ✗ | ✓ | ✓ |
| Maintenance Shop Network | ✗ | ✓ | ✓ |
| SAML SSO | add-on | ✓ | ✓ |
| Workflow automations | 0 | ~5 | ~40 |
| Parts inventory | ✗ | records only | full |
| Purchase orders / Tires / Warranties | ✗ | ✗ | ✓ |
| Two-way DVIR resolution push | ✗ | ✗ | ✓ |

Gating pattern: collaboration/automation gates at Professional; inventory/procurement depth at Premium.

## 2. Telematics Integrations
~15 native (Geotab, Samsara, Motive, Verizon Connect, Azuga, Ford Pro, GPS Trackit, Webfleet, Zubie...) + ~35 API-built.

Data synced:
1. Odometer/Meter 1 — nightly at midnight account TZ + manual sync; feeds PM reminders (core value loop)
2. Engine hours / Meter 2
3. Location — nightly; new entry only if 15+ min since last
4. Faults/DTCs — nightly, configurable hourly
5. DVIR defects — hourly import; each defect auto-creates an Issue; Premium = two-way resolution push back to Geotab/Samsara
6. Fuel vendor location alerts (geofence fraud check)
7. Auto Links — device↔vehicle mapping via VIN matching; manual mapping screen for unmatched

Fault → Issue workflow:
- Faults first-class entity; carries code, description, count, criticality, source device
- Fault Rules: rename/describe a code fleet-wide, Flag as Critical, Ignore Code (nuisance suppression)
- Automations on fault receipt: auto-create Issue, auto-assign, set priority (conditions on code/count/criticality). Manual path: email → one-click create Issue or ignore
- Same-code aggregation across vehicles

## 3. Fuel Card Integrations
WEX, Comdata, EFS, Corpay/FLEETCOR (Fuelman, Universal), SC Fuels (CFN, Pac Pride, Voyager). Nightly import. Card mapped to vehicle once; each transaction auto-creates Fuel Entry. Unmatched → manual assignment queue. Cross-checks: fuel-location geofence alerts, odometer reconciliation.

## 4. Other Integrations
- Maintenance Shop Network (Pro+): external repair shops; ROs flow from shop POS (Auto Integrate) into Fleetio; electronic RO approval (one-click, auto-approval rules under thresholds); auto Service Entries; consolidated monthly billing
- Accounting: Integration Builder (no/low-code trigger+actions+field mappings; QuickBooks, Xero, Zoho Books, Slack, Google Drive templates). No legacy native QuickBooks sync; else CSV/webhooks/API
- Zapier: via webhooks (no first-party app)
- Integration Links (Pro+): configurable deep links on vehicle/contact profiles
- SSO: SAML 2.0 (Okta, Azure AD); password login stays available

## 5. REST API
- Auth: per-user API keys; headers `Authorization: Token KEY` + `Account-Token: TOKEN`; keys inherit user role/record-set permissions
- Date-based API versioning (e.g. 2025-05-05)
- Cursor pagination: `next_cursor` → `start_cursor` param; `per_page` default 50
- Rate limits by plan; 429 + Retry-After
- Resources: Vehicles (+Types/Statuses/StatusChanges/Assignments/Acquisitions/RenewalReminders), Equipment, Work Orders (+Statuses), Service Entries, Service Reminders, Service Tasks, Inspection Forms, Submitted Inspections, Inspection Schedules, Faults, Fault Rules, Issues (+Priorities), Comments, Watchers, Meter Entries, Location Entries, Parts, Part Locations, Inventory Journal Entries, Adjustment Reasons, Tires, Axle Configurations, Fuel Entries (+Types), Expense Entries (+Types), Charging Entries, Purchase Orders, Contacts (+RenewalReminders), Vendors, Places, Groups, Accounts, Roles, Labels, Custom Fields/Records/Objects, Webhooks, Imports, VMRS codes

### Webhooks
- Per-event subscription; HMAC-SHA256 body signature in `X-Fleetio-Webhook-Signature`
- Payload: `{ id, event, timestamp, triggered_by, payload }`
- Update events debounced (~1 min per record); create/delete immediate
- Delivery: expect 200 within 30s; 5 retries in 1h, then hourly 24h; auto-disable after 3 consecutive failures; 30-day log with response inspection UI
- ~50 events: contact_*, dtc_alert_*, equipment_*, expense_entry_*, fuel_entry_*, submitted_inspection_form_*, issue_created/updated/resolved/closed/comment_added, meter_entry_*, part_*, purchase_order_* (full state machine), service_entry_*, vehicle_created/updated/status_changed/group_changed/assigned/..., work_order_created/updated/status_changed/comment_added/document_added

## 6. Users, Roles & Permissions (3-layer model)
1. User types: Account Owner → Administrator → Regular User. Admin toggles: Manage Account Settings, Manage Other Users.
2. Roles = permission bundles by module (Vehicles, Meter Entries, Inspections, Issues, Fuel, Parts, WOs, POs...). Per module: Full Access / Some Access (granular CRUD) / No Access (module hidden). Default role for new users; role copy; view implies commenting.
3. Record Sets = row-level scoping (Vehicles, Contacts, Part Locations, Inspection Forms). Scope by: group, assets assigned to user, explicit list, vehicle groups, statuses, custom-field values.

Contacts vs Users: Contact = person record (license info, certifications, labor rates, renewal reminders); can't log in. Granting credentials makes a User. Classifications (stackable): Operator (vehicle-assignable), Technician (WO labor, Pro+), Employee.

## 7. Notable Platform Features
- Audit Trail: per-record change timeline at bottom of record pages
- Localization: major currencies, Spanish UI, account timezone drives sync scheduling
- AI: Smart Uploads (photo/PDF of invoice → AI-extracted Service Entry); Service Advisor (AI approve/deny recommendation on incoming shop ROs)
- Fleetio Go mobile: driver inspections, issue reporting with photos, fuel entries, technician work orders
- Custom Fields/Records/Objects; VMRS repair-reason taxonomy on WOs
- Core object model: Vehicle → Meter Entries → Service Reminders → Issues (from driver reports, inspections, faults, DVIRs) → Work Orders (internal) or Shop Network ROs (external) → Service Entries → reports. Issues = universal "something needs attention" convergence point.
