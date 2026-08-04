import type { EnumDef } from "@/lib/enums";

// Vendor classification badges (JSON array on Vendor.classifications).
export const VENDOR_CLASSIFICATION: EnumDef = {
  fuel: { label: "Fuel", color: "blue" },
  service: { label: "Service", color: "indigo" },
  parts: { label: "Parts", color: "green" },
  vehicles: { label: "Vehicles", color: "purple" },
  vehicle: { label: "Vehicles", color: "purple" },
};

export function parseClassifications(json: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(json ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((c) => typeof c === "string") : [];
  } catch {
    return [];
  }
}
