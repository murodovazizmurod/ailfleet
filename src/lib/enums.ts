// Enum-like string constants (SQLite has no native enums).
// Each entry: value → { label, color } where color is a Tailwind-friendly token
// consumed by <StatusBadge>.

export type EnumDef = Record<string, { label: string; color: BadgeColor }>;
export type BadgeColor =
  | "green"
  | "yellow"
  | "orange"
  | "red"
  | "blue"
  | "indigo"
  | "gray"
  | "purple";

export const VEHICLE_STATUS: EnumDef = {
  active: { label: "Active", color: "green" },
  inactive: { label: "Inactive", color: "gray" },
  in_shop: { label: "In Shop", color: "yellow" },
  out_of_service: { label: "Out of Service", color: "red" },
  sold: { label: "Sold", color: "purple" },
};

export const ASSET_TYPE: EnumDef = {
  vehicle: { label: "Vehicle", color: "blue" },
  equipment: { label: "Equipment", color: "indigo" },
  trailer: { label: "Trailer", color: "purple" },
};

export const OWNERSHIP: EnumDef = {
  owned: { label: "Owned", color: "green" },
  leased: { label: "Leased", color: "blue" },
  rented: { label: "Rented", color: "yellow" },
};

export const FUEL_TYPE: EnumDef = {
  gasoline: { label: "Gasoline", color: "blue" },
  diesel: { label: "Diesel", color: "indigo" },
  electric: { label: "Electric", color: "green" },
  hybrid: { label: "Hybrid", color: "purple" },
  cng: { label: "CNG", color: "gray" },
  propane: { label: "Propane", color: "orange" },
};

export const ISSUE_STATUS: EnumDef = {
  open: { label: "Open", color: "yellow" },
  overdue: { label: "Overdue", color: "red" },
  resolved: { label: "Resolved", color: "green" },
  closed: { label: "Closed", color: "gray" },
};

export const PRIORITY: EnumDef = {
  none: { label: "No Priority", color: "gray" },
  low: { label: "Low", color: "blue" },
  medium: { label: "Medium", color: "yellow" },
  high: { label: "High", color: "orange" },
  critical: { label: "Critical", color: "red" },
};

export const ISSUE_SOURCE: EnumDef = {
  manual: { label: "Manual", color: "gray" },
  inspection: { label: "Inspection", color: "blue" },
  fault_code: { label: "Fault Code", color: "orange" },
  telematics: { label: "Telematics", color: "indigo" },
};

export const WORK_ORDER_STATUS: EnumDef = {
  open: { label: "Open", color: "blue" },
  pending: { label: "Pending", color: "gray" },
  in_progress: { label: "In Progress", color: "yellow" },
  waiting_on_parts: { label: "Waiting on Parts", color: "orange" },
  completed: { label: "Completed", color: "green" },
  closed: { label: "Closed", color: "gray" },
};

export const REPAIR_CLASS: EnumDef = {
  scheduled: { label: "Scheduled", color: "blue" },
  non_scheduled: { label: "Non-Scheduled", color: "yellow" },
  emergency: { label: "Emergency", color: "red" },
};

export const REMINDER_STATUS: EnumDef = {
  upcoming: { label: "OK", color: "green" },
  due_soon: { label: "Due Soon", color: "yellow" },
  overdue: { label: "Overdue", color: "red" },
  snoozed: { label: "Snoozed", color: "gray" },
};

export const RENEWAL_STATUS: EnumDef = {
  upcoming: { label: "OK", color: "green" },
  due_soon: { label: "Due Soon", color: "yellow" },
  overdue: { label: "Overdue", color: "red" },
  completed: { label: "Completed", color: "gray" },
};

export const PO_STATUS: EnumDef = {
  draft: { label: "Draft", color: "gray" },
  pending_approval: { label: "Pending Approval", color: "yellow" },
  approved: { label: "Approved", color: "blue" },
  rejected: { label: "Rejected", color: "red" },
  purchased: { label: "Purchased", color: "indigo" },
  received_partial: { label: "Received Partial", color: "orange" },
  received_full: { label: "Received Full", color: "green" },
  closed: { label: "Closed", color: "gray" },
};

export const INSPECTION_ITEM_TYPE: EnumDef = {
  pass_fail: { label: "Pass / Fail", color: "green" },
  number: { label: "Number", color: "blue" },
  meter: { label: "Meter Entry", color: "indigo" },
  text: { label: "Free Text", color: "gray" },
  dropdown: { label: "Dropdown", color: "purple" },
  date: { label: "Date", color: "blue" },
  photo: { label: "Photo", color: "yellow" },
  signature: { label: "Signature", color: "orange" },
  section: { label: "Section", color: "gray" },
};

export const FAULT_STATUS: EnumDef = {
  open: { label: "Open", color: "red" },
  acknowledged: { label: "Acknowledged", color: "yellow" },
  resolved: { label: "Resolved", color: "green" },
  ignored: { label: "Ignored", color: "gray" },
};

export const USER_ROLE: EnumDef = {
  admin: { label: "Administrator", color: "purple" },
  manager: { label: "Fleet Manager", color: "blue" },
  technician: { label: "Technician", color: "indigo" },
  operator: { label: "Operator", color: "gray" },
};

export const EXPENSE_TYPE: EnumDef = {
  insurance: { label: "Insurance", color: "blue" },
  registration: { label: "Registration", color: "indigo" },
  tolls: { label: "Tolls", color: "yellow" },
  washing: { label: "Washing", color: "gray" },
  parking: { label: "Parking", color: "gray" },
  fines: { label: "Fines", color: "red" },
  depreciation: { label: "Depreciation", color: "purple" },
  other: { label: "Other", color: "gray" },
};

export const VEHICLE_RENEWAL_TYPE: EnumDef = {
  registration: { label: "Registration", color: "blue" },
  insurance: { label: "Insurance", color: "indigo" },
  emission_test: { label: "Emission Test", color: "green" },
  dot_inspection: { label: "DOT Inspection", color: "orange" },
  custom: { label: "Custom", color: "gray" },
};

export const CONTACT_RENEWAL_TYPE: EnumDef = {
  license: { label: "Driver's License", color: "blue" },
  certification: { label: "Certification", color: "indigo" },
  medical_exam: { label: "Medical Exam", color: "green" },
  training: { label: "Training", color: "yellow" },
  custom: { label: "Custom", color: "gray" },
};

export const INTEGRATION_KIND: EnumDef = {
  telematics: { label: "Telematics / GPS", color: "indigo" },
  fuel_card: { label: "Fuel Card", color: "blue" },
  accounting: { label: "Accounting", color: "green" },
};

export const INTEGRATION_STATUS: EnumDef = {
  connected: { label: "Connected", color: "green" },
  disconnected: { label: "Disconnected", color: "gray" },
  syncing: { label: "Syncing", color: "yellow" },
  error: { label: "Error", color: "red" },
};

export const ADJUSTMENT_REASON: EnumDef = {
  received: { label: "Received", color: "green" },
  used: { label: "Used", color: "blue" },
  damaged: { label: "Damaged", color: "red" },
  lost: { label: "Lost", color: "orange" },
  correction: { label: "Correction", color: "gray" },
  returned: { label: "Returned", color: "purple" },
};

export function enumLabel(def: EnumDef, value: string | null | undefined): string {
  if (!value) return "—";
  return def[value]?.label ?? value;
}

export function enumKeys(def: EnumDef): string[] {
  return Object.keys(def);
}
