# Fleetio Research: Inspections, Issues, Reminders, Mobile

## 1. Inspections (DVIR)

### Form builder
Create from scratch / template / copy (copy can include workflows + schedules). Form settings: title, description, color indicator, location exception tracking, Prevent Stored Photos (live camera only). Versioning: any item change creates a new form version; submissions retain version tag (audit integrity). Lifecycle: edit/archive/delete (delete destroys submissions).

### Item types (12)
- Pass/Fail: binary + optional N/A; customizable labels
- Dropdown: each choice flagged pass or fail
- Number: min/max range; out-of-range = fail
- Meter Entry: validated vs odometer; optional secondary meter + verification photo
- Free Text, Date/Time, Photo, Signature (saved/reusable on mobile)
- Tire Readings: tread + pressure per tire; grid from axle config; min/max thresholds
- Inventory Adjustment (Premium): parts consumed → auto-decrement
- Section: grouping header
Per-item: label, required, short description, instructions; pass/fail types support "require photo and/or comment on Pass and/or Fail" (anti-pencil-whipping).

### Vehicle enablement + schedules
Modes: All Vehicles rule / attribute rule (Type or Group, AND-OR) / manual. Schedules: daily/weekly/monthly/yearly with intervals, or as-needed. Due Anytime vs Specific Day; allow early submissions (N days); delayed start. Statuses: Due Soon → Overdue; tabs All/Due Soon/Overdue/Skipped. Skip advances one interval, recorded who/when. Reminder notification to assigned operator + weekly summary email. Compliance reporting.

### Submission workflow
Sequential items; required marked; open-issue awareness (items with prior open issues flagged; after resolution, next inspection prompts operator to confirm/reject the fix). Comments/photos per item. Duration tracking (timer first-response → submit) — surfaces pencil-whipped inspections. Validation on submit; in-progress persists with Resume/Start Over. Post-submit only vehicle + meter editable — rest immutable. Offline mode with later sync. Public submission links (no login; auto guest user); unavailable if Prevent Stored Photos. 

### Workflows (automation)
Per-form if-then rules. Triggers (3): item passes / item fails (specific or ANY) / form submitted. Actions (5): Create Issue (fail only; default on every new form: any fail → issue), Change Vehicle Status (grounding mechanism), Send Email (watchers and/or explicit users; includes remarks/photos; PDF attach for submit trigger), Assign/Unassign User to Vehicle (submit trigger).

### DVIR compliance
Signature = driver certification; issue→WO chain = repair certification; confirm/reject prompt = reviewing-driver acknowledgment (FMCSA three-signature cycle §396.11). Versioned immutable submissions support 90-day/1-year retention.

## 2. Issues & Faults

### Issue
Bridge between detection (driver report, failed inspection, fault) and repair (WO/SE).
Sources: failed inspection items (auto), manual (index/quick add/vehicle/mobile), faults, sensor snapshots, API.
Fields — Required: asset, reported date, summary. Optional: priority (Critical/High/Medium/Low), description, labels, reported by, assigned to, due date, primary/secondary meter due, meter at report, photos, documents, comments, custom fields. Pinned fields per user.

### Status machine
Open (initial) → Overdue overlay (past due date/meter) → Resolved (via Add to Service Entry | Add to Work Order [resolves on WO completion] | Resolve with Note) or Closed (no work done) → Reopen → Open.
On resolve via SE/WO: prompt to sweep other open issues on same asset. Bulk: select issues → Add to Work Order (new or existing).
Resolution metadata: date-time, who, notes, Time to Resolve, Resolution Variances (date variance, meter variance = miles driven on known defect).

### Watchers & notifications
Watch/unwatch per issue; vehicle watchers auto-notified of new issues; configurable events (assigned/resolved/closed/comment). Assignees get reminders. Email + push; self-action suppression; daily Overdue Issues digest 7 AM.

### Views
Tabs All/Open/Overdue/Resolved/Closed; search/filter/sort; group by asset/priority/group; saved views; CSV. Issues List report; Time to Resolve widget.

### Faults (telematics pipeline)
Fields: code (required), name, description, count, status, critical/ignored. Fault Rules: map code → standard name/description/priority fleet-wide, retroactive. Status machine: Open (actions: Create Issue, Ignore) → Pending (issue linked) → Resolved (auto when issue resolves). Ignored = suppressed. Critical faults prioritized on dashboard. Nightly import (configurable hourly). Faults Summary report.

## 3. Reminders & Notifications

### Service Reminders — see assets-maintenance doc. Key: meter OR time whichever first, thresholds, OK/Due Soon/Overdue, auto-reset, snooze, 7-day re-nag.

### Vehicle Renewal Reminders (date-only)
Default types: Emission Test, Inspection, Insurance, Registration (customizable). Fields: type, due date, due-soon threshold, watchers, notifications, custom fields. OK/Due Soon/Overdue. 7 AM notify, every 7 days. Resolve: edit → next due date (recurring) or delete (one-time); optionally record SE or Expense.

### Contact Renewal Reminders
License renewals, medical cards, certifications. Types customizable. Contact NOT auto-watcher. Same threshold/notify pattern. Dedicated report.

### Notification platform
Channels: email, mobile push, in-app notification center. Per-user granular toggles. Watching pattern universal: record watchers ∩ their preferences (workflow explicit recipients bypass). Digests: daily overdue issues (7 AM), weekly vehicle summary (Mon 7 AM), weekly inspection summary. Account timezone. Self-action suppression.

## 4. Mobile (driver & technician)
Drivers: inspections (offline, duration, photos, signatures), issue reporting + all resolve paths, fuel entries with receipt photo + Smart Upload OCR → manager approval queue, barcode/QR/NFC asset lookup, meter entry with validation, vehicle alerts, renewals.
Technicians: work orders (view/manage/status), clock in/out per line item (Track Labor → General Labor or task line; pause/resume; feeds Labor in Progress widget), service entries, tool checkout via QR.

## 5. Build takeaways
1. Everything converges on the Issue — one defect entity, one lifecycle; WOs consume issues in bulk
2. Default automation out of the box (fail → issue pre-wired)
3. Tiny trigger/action model (3×5) is expressive enough
4. Integrity mechanics: duration timer, live-only photos, meter verification, immutable versioned submissions, resolution variances
5. Closed-loop DVIR: fail → issue → WO → complete → next inspection confirms fix
6. Universal notification pattern: threshold + watchers + 7 AM + 7-day re-nag + digests + snooze/skip
7. Three reminder archetypes, one mental model
8. Assignment-by-rule for form enablement
9. Frictionless capture: public links, QR lookup, receipt OCR with approval queue
