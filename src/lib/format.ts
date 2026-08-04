import { format, formatDistanceToNow, differenceInDays } from "date-fns";

export function money(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export function num(value: number | null | undefined, digits = 0): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(value);
}

export function meter(value: number | null | undefined, unit = "mi"): string {
  if (value == null) return "—";
  return `${num(value)} ${unit}`;
}

export function shortDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return format(new Date(d), "MMM d, yyyy");
}

export function dateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return format(new Date(d), "MMM d, yyyy h:mm a");
}

export function relative(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return formatDistanceToNow(new Date(d), { addSuffix: true });
}

export function daysUntil(d: Date | string | null | undefined): number | null {
  if (!d) return null;
  return differenceInDays(new Date(d), new Date());
}

export function vehicleTitle(v: {
  year?: number | null;
  make?: string | null;
  model?: string | null;
}): string {
  return [v.year, v.make, v.model].filter(Boolean).join(" ") || "—";
}
