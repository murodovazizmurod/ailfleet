"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, TextInput, TextArea } from "@/components/ui/FormField";
import { INSPECTION_ITEM_TYPE } from "@/lib/enums";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { createInspectionForm } from "../../actions";

type BuilderRow = {
  key: number;
  label: string;
  type: string;
  required: boolean;
  optionsText: string;
};

const INPUT =
  "block w-full rounded-lg border-0 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600";

let keyCounter = 1;
function newRow(): BuilderRow {
  return { key: keyCounter++, label: "", type: "pass_fail", required: false, optionsText: "" };
}

export function FormBuilder() {
  const [rows, setRows] = useState<BuilderRow[]>([newRow()]);

  const update = (key: number, patch: Partial<BuilderRow>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const remove = (key: number) => setRows((rs) => rs.filter((r) => r.key !== key));

  const move = (key: number, dir: -1 | 1) =>
    setRows((rs) => {
      const idx = rs.findIndex((r) => r.key === key);
      const to = idx + dir;
      if (idx < 0 || to < 0 || to >= rs.length) return rs;
      const next = [...rs];
      [next[idx], next[to]] = [next[to], next[idx]];
      return next;
    });

  const itemsJson = JSON.stringify(
    rows
      .filter((r) => r.label.trim() !== "")
      .map((r) => ({
        label: r.label,
        type: r.type,
        required: r.required,
        options:
          r.type === "dropdown"
            ? r.optionsText
                .split(",")
                .map((o) => o.trim())
                .filter((o) => o !== "")
            : [],
      }))
  );

  return (
    <form action={createInspectionForm} className="space-y-4">
      <input type="hidden" name="itemsJson" value={itemsJson} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" required>
          <TextInput name="title" required placeholder="e.g. Daily Driver Inspection (DVIR)" />
        </Field>
        <Field label="Description">
          <TextArea name="description" rows={1} placeholder="What this inspection covers…" />
        </Field>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">Items</p>
        <div className="space-y-2">
          {rows.map((r, idx) => (
            <div
              key={r.key}
              className="flex flex-wrap items-start gap-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3"
            >
              <span className="mt-2 w-6 text-right text-xs font-medium text-slate-400">
                {idx + 1}.
              </span>
              <div className="min-w-48 flex-1">
                <input
                  className={INPUT}
                  placeholder={r.type === "section" ? "Section header…" : "Item label…"}
                  value={r.label}
                  onChange={(e) => update(r.key, { label: e.target.value })}
                />
                {r.type === "dropdown" ? (
                  <input
                    className={`${INPUT} mt-2`}
                    placeholder="Options, comma-separated (e.g. Good, Worn, Damaged)"
                    value={r.optionsText}
                    onChange={(e) => update(r.key, { optionsText: e.target.value })}
                  />
                ) : null}
              </div>
              <select
                className={`${INPUT} w-36`}
                value={r.type}
                onChange={(e) => update(r.key, { type: e.target.value })}
              >
                {Object.entries(INSPECTION_ITEM_TYPE).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
              <label className="mt-2 flex items-center gap-1.5 text-sm text-slate-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                  checked={r.required}
                  onChange={(e) => update(r.key, { required: e.target.checked })}
                />
                Required
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(r.key, -1)}
                  disabled={idx === 0}
                  className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30"
                  title="Move up"
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => move(r.key, 1)}
                  disabled={idx === rows.length - 1}
                  className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30"
                  title="Move down"
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => remove(r.key)}
                  className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  title="Remove item"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <Button type="button" variant="secondary" onClick={() => setRows((rs) => [...rs, newRow()])}>
            <Plus size={16} className="text-slate-400" /> Add Item
          </Button>
        </div>
      </div>

      <div className="flex justify-end border-t border-slate-100 pt-4">
        <Button type="submit">Create Form</Button>
      </div>
    </form>
  );
}
