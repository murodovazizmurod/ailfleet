import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { INTEGRATION_STATUS } from "@/lib/enums";
import { relative } from "@/lib/format";
import { providersByKind, type IntegrationKind } from "@/lib/integrations/providers";
import {
  connectIntegration,
  connectSamsara,
  disconnectIntegration,
  syncIntegration,
} from "./actions";
import { readSamsaraConfig, resolveSamsaraToken } from "@/lib/integrations/samsara";
import { Satellite, Fuel, Calculator, CheckCircle2, AlertTriangle } from "lucide-react";
import type { IntegrationConnection } from "@prisma/client";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

const SECTIONS: { kind: IntegrationKind; title: string; blurb: string; icon: ReactNode }[] = [
  {
    kind: "telematics",
    title: "Telematics / GPS",
    blurb: "Automatic odometer updates, locations and engine fault codes from in-vehicle devices.",
    icon: <Satellite className="h-4 w-4 text-slate-400" />,
  },
  {
    kind: "fuel_card",
    title: "Fuel Cards",
    blurb: "Card transactions imported as fuel entries with meter readings and cost data.",
    icon: <Fuel className="h-4 w-4 text-slate-400" />,
  },
  {
    kind: "accounting",
    title: "Accounting",
    blurb: "Push fleet costs, service entries and purchase orders to your accounting system.",
    icon: <Calculator className="h-4 w-4 text-slate-400" />,
  },
];

type SyncBanner = {
  provider?: string;
  metersCreated?: number;
  faultsCreated?: number;
  issuesCreated?: number;
  fuelEntriesCreated?: number;
  vehiclesMatched?: number;
  vehiclesImported?: number;
  vehiclesUnmatched?: number;
  connectedVehiclesSeen?: number;
};

function parseBanner(raw: string | undefined): SyncBanner | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as SyncBanner) : null;
  } catch {
    return null;
  }
}

function bannerText(b: SyncBanner): string {
  const parts: string[] = [];
  if (b.connectedVehiclesSeen != null)
    parts.push(`connection verified — ${b.connectedVehiclesSeen} vehicles visible in Samsara`);
  if (b.vehiclesMatched != null)
    parts.push(
      `${b.vehiclesMatched} vehicles matched by VIN${
        b.vehiclesImported ? `, ${b.vehiclesImported} imported` : ""
      }${b.vehiclesUnmatched ? ` (${b.vehiclesUnmatched} unmatched)` : ""}`
    );
  if (b.fuelEntriesCreated != null) parts.push(`${b.fuelEntriesCreated} fuel entries`);
  if (b.metersCreated != null) parts.push(`${b.metersCreated} meter entries`);
  if (b.faultsCreated != null) parts.push(`${b.faultsCreated} fault codes`);
  if (b.issuesCreated != null) parts.push(`${b.issuesCreated} issues`);
  return parts.join(", ");
}

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ synced?: string; error?: string }>;
}) {
  const { synced, error } = await searchParams;
  const banner = parseBanner(synced);

  const connections = await db.integrationConnection.findMany();
  const byProvider = new Map<string, IntegrationConnection>(
    connections.map((c) => [c.provider, c])
  );

  return (
    <div>
      <PageHeader
        title="Integrations"
        subtitle="Connect telematics devices, fuel cards and accounting systems to AIlFleet."
      />

      {banner ? (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <div className="text-sm text-emerald-800">
            <span className="font-semibold">{banner.provider ?? "Integration"}:</span>{" "}
            {bannerText(banner) || "sync complete — no new records"}.
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <div className="text-sm text-red-700">{error}</div>
        </div>
      ) : null}

      <div className="space-y-8">
        {SECTIONS.map((section) => (
          <section key={section.kind}>
            <div className="mb-1 flex items-center gap-2">
              {section.icon}
              <h2 className="text-base font-semibold text-slate-900">{section.title}</h2>
            </div>
            <p className="mb-3 text-sm text-slate-500">{section.blurb}</p>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {providersByKind(section.kind).map((p) => {
                const conn = byProvider.get(p.provider);
                const connected = conn?.status === "connected";
                const canSync =
                  connected && (p.kind === "telematics" || p.kind === "fuel_card");
                const isSamsara = p.provider === "samsara";
                const samsaraLive =
                  isSamsara && !!resolveSamsaraToken(readSamsaraConfig(conn?.config ?? null));
                return (
                  <div
                    key={p.provider}
                    className="flex flex-col rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">{p.name}</h3>
                      {conn ? (
                        <StatusBadge def={INTEGRATION_STATUS} value={conn.status} />
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/20 whitespace-nowrap">
                          Not connected
                        </span>
                      )}
                    </div>
                    <p className="mt-2 flex-1 text-sm text-slate-500">{p.description}</p>
                    {isSamsara ? (
                      <p className="mt-2 text-xs font-medium">
                        {samsaraLive ? (
                          <span className="text-emerald-600">
                            ● Live API — token configured
                          </span>
                        ) : (
                          <span className="text-amber-600">
                            ● Simulated — add an API token to sync your real fleet
                          </span>
                        )}
                      </p>
                    ) : null}
                    {conn?.lastSyncAt ? (
                      <p className="mt-2 text-xs text-slate-400">
                        Last synced {relative(conn.lastSyncAt)}
                      </p>
                    ) : null}
                    {conn?.status === "error" && conn.lastError ? (
                      <p className="mt-2 break-words text-xs text-red-600">{conn.lastError}</p>
                    ) : null}
                    {isSamsara && !samsaraLive ? (
                      <form
                        action={connectSamsara}
                        className="mt-3 space-y-2 border-t border-slate-100 pt-3"
                      >
                        <input
                          type="password"
                          name="token"
                          placeholder="Samsara API token (samsara_api_…)"
                          className="block w-full rounded-lg border-0 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600"
                        />
                        <div className="flex items-center gap-2">
                          <select
                            name="region"
                            className="rounded-lg border-0 bg-white px-2 py-1.5 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300"
                          >
                            <option value="us">US (api.samsara.com)</option>
                            <option value="eu">EU (api.eu.samsara.com)</option>
                          </select>
                          <Button type="submit" variant="primary">
                            {connected ? "Save token" : "Connect"}
                          </Button>
                        </div>
                        <p className="text-xs text-slate-400">
                          Samsara dashboard → Settings → API Tokens. Read-only scope is enough.
                        </p>
                      </form>
                    ) : null}
                    <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
                      {connected || (isSamsara && conn?.status === "error") ? (
                        <>
                          {canSync || (isSamsara && samsaraLive) ? (
                            <form action={syncIntegration}>
                              <input type="hidden" name="provider" value={p.provider} />
                              <Button type="submit" variant="primary">
                                Sync now
                              </Button>
                            </form>
                          ) : null}
                          <form action={disconnectIntegration}>
                            <input type="hidden" name="provider" value={p.provider} />
                            <Button type="submit" variant="secondary">
                              Disconnect
                            </Button>
                          </form>
                        </>
                      ) : !isSamsara ? (
                        <form action={connectIntegration}>
                          <input type="hidden" name="provider" value={p.provider} />
                          <Button type="submit" variant="primary">
                            Connect
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
