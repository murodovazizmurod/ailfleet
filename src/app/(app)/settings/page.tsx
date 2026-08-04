import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Field, TextInput } from "@/components/ui/FormField";
import { USER_ROLE } from "@/lib/enums";
import { relative, shortDate } from "@/lib/format";
import { KeyRound } from "lucide-react";
import {
  updateCompanySettings,
  createApiToken,
  revokeApiToken,
  createWebhook,
  toggleWebhook,
  deleteWebhook,
} from "./actions";

export const dynamic = "force-dynamic";

const WEBHOOK_EVENTS = [
  "issue.created",
  "issue.resolved",
  "work_order.completed",
  "fuel_entry.created",
  "vehicle.created",
  "purchase_order.approved",
];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const { created } = await searchParams;

  const [settings, tokens, webhooks, users] = await Promise.all([
    db.accountSetting.findMany(),
    db.apiToken.findMany({ orderBy: { createdAt: "desc" } }),
    db.webhook.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        deliveries: { orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { deliveries: true } },
      },
    }),
    db.user.findMany({ orderBy: { email: "asc" } }),
  ]);

  const settingsMap = new Map(settings.map((s) => [s.key, s.value]));

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Account preferences, API access and webhook subscriptions."
        actions={<ButtonLink href="/settings/api-docs" variant="secondary">API docs</ButtonLink>}
      />

      {created ? (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
            <KeyRound className="h-4 w-4 text-amber-600" />
            API token created — copy it now, it will not be shown again.
          </div>
          <code className="mt-2 block w-fit rounded-lg bg-white px-3 py-1.5 font-mono text-sm text-slate-800 ring-1 ring-inset ring-amber-200">
            {created}
          </code>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* ── API Tokens ── */}
          <Card title="API Tokens">
            {tokens.length === 0 ? (
              <p className="text-sm text-slate-500">
                No tokens yet. Create one to call the REST API.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {tokens.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800">{t.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        <code className="font-mono">{t.prefix}…</code>
                        {" · "}created {shortDate(t.createdAt)}
                        {" · "}
                        {t.lastUsedAt ? `last used ${relative(t.lastUsedAt)}` : "never used"}
                      </p>
                    </div>
                    {t.revokedAt ? (
                      <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
                        Revoked
                      </span>
                    ) : (
                      <form action={revokeApiToken}>
                        <input type="hidden" name="tokenId" value={t.id} />
                        <Button type="submit" variant="secondary">
                          Revoke
                        </Button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            )}
            <form
              action={createApiToken}
              className="mt-4 flex items-end gap-2 border-t border-slate-100 pt-4"
            >
              <div className="flex-1">
                <Field label="Token name" required>
                  <TextInput name="name" placeholder="e.g. Zapier integration" required />
                </Field>
              </div>
              <Button type="submit">Create token</Button>
            </form>
          </Card>

          {/* ── Webhooks ── */}
          <Card title="Webhooks">
            {webhooks.length === 0 ? (
              <p className="text-sm text-slate-500">
                No webhooks configured. Add one to receive event notifications.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {webhooks.map((w) => {
                  const last = w.deliveries[0];
                  return (
                    <div key={w.id} className="flex items-start justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-mono text-sm text-slate-800">{w.url}</p>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap ${
                              w.active
                                ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                                : "bg-slate-100 text-slate-600 ring-slate-500/20"
                            }`}
                          >
                            {w.active ? "Active" : "Paused"}
                          </span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {((): string[] => {
                            try {
                              const ev: unknown = JSON.parse(w.events ?? "[]");
                              return Array.isArray(ev) ? ev.map(String) : [];
                            } catch {
                              return [];
                            }
                          })().map((e) => (
                            <span
                              key={e}
                              className="rounded bg-indigo-50 px-1.5 py-0.5 font-mono text-xs text-indigo-700"
                            >
                              {e}
                            </span>
                          ))}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {w._count.deliveries} deliveries
                          {last
                            ? ` · last: ${
                                last.statusCode != null ? `HTTP ${last.statusCode}` : "no response"
                              } ${last.success ? "(ok)" : "(failed)"} ${relative(last.createdAt)}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <form action={toggleWebhook}>
                          <input type="hidden" name="webhookId" value={w.id} />
                          <Button type="submit" variant="secondary">
                            {w.active ? "Pause" : "Activate"}
                          </Button>
                        </form>
                        <form action={deleteWebhook}>
                          <input type="hidden" name="webhookId" value={w.id} />
                          <Button type="submit" variant="danger">
                            Delete
                          </Button>
                        </form>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <form action={createWebhook} className="mt-4 space-y-3 border-t border-slate-100 pt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Payload URL" required>
                  <TextInput
                    name="url"
                    type="url"
                    placeholder="https://example.com/hooks/ailfleet"
                    required
                  />
                </Field>
                <Field label="Signing secret" hint="Left blank, a random secret is generated.">
                  <TextInput name="secret" placeholder="whsec_…" />
                </Field>
              </div>
              <fieldset>
                <legend className="mb-1 block text-sm font-medium text-slate-700">Events</legend>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {WEBHOOK_EVENTS.map((e) => (
                    <label key={e} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        name="events"
                        value={e}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                      />
                      <code className="font-mono text-xs">{e}</code>
                    </label>
                  ))}
                </div>
              </fieldset>
              <Button type="submit">Add webhook</Button>
            </form>
          </Card>
        </div>

        <div className="space-y-4">
          {/* ── Company ── */}
          <Card title="Company">
            <form action={updateCompanySettings} className="space-y-3">
              <Field label="Company name">
                <TextInput
                  name="company_name"
                  defaultValue={settingsMap.get("company_name") ?? ""}
                  placeholder="Acme Logistics"
                />
              </Field>
              <Field label="Currency">
                <TextInput
                  name="currency"
                  defaultValue={settingsMap.get("currency") ?? "USD"}
                  placeholder="USD"
                />
              </Field>
              <Field label="Distance unit">
                <TextInput
                  name="distance_unit"
                  defaultValue={settingsMap.get("distance_unit") ?? "mi"}
                  placeholder="mi"
                />
              </Field>
              <Button type="submit">Save</Button>
            </form>
          </Card>

          {/* ── Users ── */}
          <Card title="Users">
            {users.length === 0 ? (
              <p className="text-sm text-slate-500">No users found.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between gap-3 py-2">
                    <p className="truncate text-sm text-slate-800">{u.email}</p>
                    <StatusBadge def={USER_ROLE} value={u.role} />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
