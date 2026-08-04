import { differenceInCalendarDays } from "date-fns";

export type DerivedRenewalStatus = "upcoming" | "due_soon" | "overdue" | "completed";

// Live status derivation — never trust the stale `status` column alone.
export function deriveRenewalStatus(r: {
  dueDate: Date | string;
  dueSoonDays: number;
  completedAt: Date | string | null;
}): DerivedRenewalStatus {
  if (r.completedAt) return "completed";
  const days = differenceInCalendarDays(new Date(r.dueDate), new Date());
  if (days < 0) return "overdue";
  if (days <= r.dueSoonDays) return "due_soon";
  return "upcoming";
}
