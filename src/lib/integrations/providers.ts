// Provider directory for the /integrations page.
// Descriptions summarize what each integration syncs (see docs/research/integrations-api-platform.md).

export type IntegrationKind = "telematics" | "fuel_card" | "accounting";

export type ProviderDef = {
  provider: string;
  name: string;
  kind: IntegrationKind;
  description: string;
};

export const PROVIDERS: ProviderDef[] = [
  // ── Telematics / GPS ──
  {
    provider: "geotab",
    name: "Geotab",
    kind: "telematics",
    description:
      "Nightly odometer & engine-hour sync, GPS locations, fault codes (DTCs) and DVIR defects that auto-create issues.",
  },
  {
    provider: "samsara",
    name: "Samsara",
    kind: "telematics",
    description:
      "Meter readings, vehicle locations, engine faults and DVIR defect import with two-way resolution push.",
  },
  {
    provider: "motive",
    name: "Motive",
    kind: "telematics",
    description:
      "Odometer and engine-hour updates, GPS breadcrumbs and fault/DTC alerts feeding preventive-maintenance reminders.",
  },
  {
    provider: "verizon_connect",
    name: "Verizon Connect",
    kind: "telematics",
    description:
      "Automatic meter sync, location entries and diagnostic trouble codes with device-to-vehicle VIN matching.",
  },
  // ── Fuel cards ──
  {
    provider: "wex",
    name: "WEX",
    kind: "fuel_card",
    description:
      "Nightly fuel-transaction import — each card purchase auto-creates a fuel entry with meter, volume and cost.",
  },
  {
    provider: "comdata",
    name: "Comdata",
    kind: "fuel_card",
    description:
      "Card transactions mapped to vehicles create fuel entries automatically; unmatched purchases queue for review.",
  },
  {
    provider: "fleetcor",
    name: "Corpay / FLEETCOR",
    kind: "fuel_card",
    description:
      "Fuelman & Universal card imports with odometer reconciliation and fuel-location fraud cross-checks.",
  },
  // ── Accounting ──
  {
    provider: "quickbooks",
    name: "QuickBooks",
    kind: "accounting",
    description:
      "Push service entries, fuel costs and purchase orders to QuickBooks via trigger + field-mapping templates.",
  },
  {
    provider: "xero",
    name: "Xero",
    kind: "accounting",
    description:
      "Sync fleet expenses and vendor bills into Xero with configurable triggers, actions and field mappings.",
  },
];

export function providersByKind(kind: IntegrationKind): ProviderDef[] {
  return PROVIDERS.filter((p) => p.kind === kind);
}

export function providerDef(provider: string): ProviderDef | undefined {
  return PROVIDERS.find((p) => p.provider === provider);
}
