"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, TextInput, TextArea, Select } from "@/components/ui/FormField";
import { createServiceEntry } from "./actions";

export type FormVehicle = {
  id: string;
  name: string;
  title: string;
  currentMeter: number;
  meterUnit: string;
};
export type FormIssue = { id: string; number: number; summary: string; vehicleId: string };
export type FormTask = { id: string; name: string };
export type FormVendor = { id: string; name: string };

type Line = {
  key: number;
  taskId: string;
  description: string;
  laborCost: string;
  partsCost: string;
};

const REPAIR_CLASSES = [
  { value: "", label: "Please select" },
  { value: "scheduled", label: "Scheduled" },
  { value: "non_scheduled", label: "Non-Scheduled" },
  { value: "emergency", label: "Emergency" },
];

function toMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function ServiceEntryForm({
  vehicles,
  issues,
  tasks,
  vendors,
  preselectVehicleId,
}: {
  vehicles: FormVehicle[];
  issues: FormIssue[];
  tasks: FormTask[];
  vendors: FormVendor[];
  preselectVehicleId?: string;
}) {
  const [vehicleId, setVehicleId] = useState(preselectVehicleId ?? "");
  const [meterTouched, setMeterTouched] = useState(false);
  const [meterValue, setMeterValue] = useState("");
  const [showStart, setShowStart] = useState(false);
  const [lines, setLines] = useState<Line[]>([
    { key: 0, taskId: "", description: "", laborCost: "", partsCost: "" },
  ]);
  const [nextKey, setNextKey] = useState(1);
  const [discount, setDiscount] = useState("");
  const [tax, setTax] = useState("");

  const vehicle = vehicles.find((v) => v.id === vehicleId) ?? null;
  const vehicleIssues = useMemo(
    () => issues.filter((i) => i.vehicleId === vehicleId),
    [issues, vehicleId]
  );

  const laborTotal = lines.reduce((s, l) => s + (Number(l.laborCost) || 0), 0);
  const partsTotal = lines.reduce((s, l) => s + (Number(l.partsCost) || 0), 0);
  const subtotal = laborTotal + partsTotal;
  const total = subtotal - (Number(discount) || 0) + (Number(tax) || 0);

  const linesJson = JSON.stringify(
    lines.map((l) => ({
      taskId: l.taskId || undefined,
      description: l.description || undefined,
      laborCost: Number(l.laborCost) || 0,
      partsCost: Number(l.partsCost) || 0,
    }))
  );

  const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  const setLine = (key: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  return (
    <form action={createServiceEntry} className="mx-auto max-w-3xl space-y-4">
      <input type="hidden" name="linesJson" value={linesJson} />

      <Card title="Details">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Vehicle" required>
              <Select
                name="vehicleId"
                required
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
              >
                <option value="">Please select</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} — {v.title}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field
            label="Repair Priority Class"
            hint="Classifies whether a service was scheduled, non-scheduled, or an emergency."
          >
            <Select name="repairClass" defaultValue="">
              {REPAIR_CLASSES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Completion Date" required>
            <TextInput type="datetime-local" name="date" required defaultValue={nowLocal} />
          </Field>
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={showStart}
                onChange={(e) => setShowStart(e.target.checked)}
                className="rounded border-slate-300"
              />
              Set Start Date
            </label>
            {showStart ? (
              <div className="mt-2 max-w-xs">
                <TextInput type="datetime-local" name="startDate" />
              </div>
            ) : null}
          </div>
          <Field label={`Meter (${vehicle?.meterUnit ?? "mi"})`}>
            <TextInput
              type="number"
              name="meter"
              step="1"
              placeholder={vehicle ? String(Math.round(vehicle.currentMeter)) : ""}
              value={
                meterTouched
                  ? meterValue
                  : vehicle
                    ? String(Math.round(vehicle.currentMeter))
                    : ""
              }
              onChange={(e) => {
                setMeterTouched(true);
                setMeterValue(e.target.value);
              }}
            />
          </Field>
          <Field label="Vendor">
            <Select name="vendorId" defaultValue="">
              <option value="">Please select</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reference">
            <TextInput name="reference" placeholder="RO #, PO #…" />
          </Field>
        </div>
      </Card>

      <Card title="Issues">
        {!vehicleId ? (
          <p className="text-sm text-slate-400">Select a vehicle first.</p>
        ) : vehicleIssues.length === 0 ? (
          <p className="text-sm text-slate-400">No open issues on this vehicle.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-slate-500">
              Check the issues this service resolved — they will be marked resolved on save.
            </p>
            {vehicleIssues.map((i) => (
              <label key={i.id} className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="issueIds"
                  value={i.id}
                  className="mt-0.5 rounded border-slate-300"
                />
                <span>
                  <span className="font-medium">#{i.number}</span> {i.summary}
                </span>
              </label>
            ))}
          </div>
        )}
      </Card>

      <Card title="Line Items">
        {!vehicleId ? (
          <p className="text-sm text-slate-400">Select a vehicle first.</p>
        ) : (
          <div className="space-y-3">
            {lines.map((l) => (
              <div
                key={l.key}
                className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[2fr_1fr_1fr_auto]"
              >
                <div className="sm:col-span-4">
                  <Select
                    value={l.taskId}
                    onChange={(e) => setLine(l.key, { taskId: e.target.value })}
                  >
                    <option value="">Service task…</option>
                    {tasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <TextInput
                  placeholder="Description (optional)"
                  value={l.description}
                  onChange={(e) => setLine(l.key, { description: e.target.value })}
                />
                <TextInput
                  type="number"
                  step="0.01"
                  placeholder="Labor $"
                  value={l.laborCost}
                  onChange={(e) => setLine(l.key, { laborCost: e.target.value })}
                />
                <TextInput
                  type="number"
                  step="0.01"
                  placeholder="Parts $"
                  value={l.partsCost}
                  onChange={(e) => setLine(l.key, { partsCost: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                  className="self-center text-sm text-slate-400 hover:text-red-500"
                  aria-label="Remove line"
                >
                  ✕
                </button>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setLines((ls) => [
                  ...ls,
                  { key: nextKey, taskId: "", description: "", laborCost: "", partsCost: "" },
                ]);
                setNextKey((k) => k + 1);
              }}
            >
              + Add Line Item
            </Button>

            <div className="grid grid-cols-3 gap-3 border-t border-slate-100 pt-3">
              <div className="rounded-lg bg-slate-50 p-3 text-center">
                <p className="text-xs text-slate-500">Labor</p>
                <p className="text-lg font-semibold text-slate-900">{toMoney(laborTotal)}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 text-center">
                <p className="text-xs text-slate-500">Parts</p>
                <p className="text-lg font-semibold text-slate-900">{toMoney(partsTotal)}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 text-center">
                <p className="text-xs text-slate-500">Subtotal</p>
                <p className="text-lg font-semibold text-slate-900">{toMoney(subtotal)}</p>
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card title="Invoice">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Invoice Number">
            <TextInput name="invoiceNumber" placeholder="INV-…" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Discount ($)">
              <TextInput
                type="number"
                step="0.01"
                name="discount"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
            </Field>
            <Field label="Tax ($)">
              <TextInput
                type="number"
                step="0.01"
                name="tax"
                value={tax}
                onChange={(e) => setTax(e.target.value)}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field
              label="Invoice / Receipt Files"
              hint="Photos or PDFs of the invoice — jpg, png, webp, pdf (max 15 MB each)."
            >
              <input
                type="file"
                name="invoiceFiles"
                multiple
                accept=".jpg,.jpeg,.png,.webp,.gif,.pdf"
                className="block w-full cursor-pointer rounded-lg border border-dashed border-slate-300 bg-white px-3 py-6 text-center text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700"
              />
            </Field>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 sm:col-span-2">
            <span className="text-sm font-medium text-slate-600">Invoice Total</span>
            <span className="text-xl font-semibold text-slate-900">{toMoney(total)}</span>
          </div>
        </div>
      </Card>

      <Card title="Comments">
        <TextArea name="comment" placeholder="Add an optional comment" />
      </Card>

      <div className="flex items-center justify-end gap-2 pb-8">
        <Button type="submit" variant="secondary" name="saveAndAddAnother" value="1">
          Save &amp; Add Another
        </Button>
        <Button type="submit" variant="primary">
          Save Service Entry
        </Button>
      </div>
    </form>
  );
}
