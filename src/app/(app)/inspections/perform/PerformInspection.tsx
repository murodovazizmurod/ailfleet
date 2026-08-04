"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { submitInspection, type PerformResult } from "../actions";

type PerformItem = {
  id: string;
  type: string;
  label: string;
  instructions: string | null;
  required: boolean;
  options: string[];
};

type ItemState = {
  passed: boolean | null; // pass_fail only
  value: string;
  flaggedFailed: boolean; // number / dropdown manual fail flag
  comment: string;
};

const INPUT =
  "block w-full rounded-lg border-0 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600";

export function PerformInspection({
  formId,
  vehicleId,
  items,
  contacts,
}: {
  formId: string;
  vehicleId: string;
  items: PerformItem[];
  contacts: { id: string; name: string }[];
}) {
  const [state, setState] = useState<Record<string, ItemState>>(() =>
    Object.fromEntries(
      items.map((it) => [
        it.id,
        { passed: null, value: "", flaggedFailed: false, comment: "" },
      ])
    )
  );
  const [submittedById, setSubmittedById] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const startedAtRef = useRef<number | null>(null);

  const markStarted = () => {
    if (startedAtRef.current == null) startedAtRef.current = Date.now();
  };

  const update = (id: string, patch: Partial<ItemState>) => {
    markStarted();
    setState((s) => ({ ...s, [id]: { ...s[id], ...patch } }));
  };

  const isFailed = (it: PerformItem, st: ItemState): boolean => {
    if (it.type === "pass_fail") return st.passed === false;
    if (it.type === "number" || it.type === "dropdown") return st.flaggedFailed;
    return false;
  };

  const isAnswered = (it: PerformItem, st: ItemState): boolean => {
    if (it.type === "pass_fail") return st.passed !== null;
    return st.value.trim() !== "";
  };

  const handleSubmit = () => {
    const errs: string[] = [];
    for (const it of items) {
      if (it.type === "section") continue;
      const st = state[it.id];
      if (it.required && !isAnswered(it, st)) {
        errs.push(`"${it.label}" is required.`);
      }
      if (isFailed(it, st) && st.comment.trim() === "") {
        errs.push(`"${it.label}" failed — a comment is required.`);
      }
    }
    setErrors(errs);
    if (errs.length > 0) return;

    const started = startedAtRef.current ?? Date.now();
    const durationSec = Math.round((Date.now() - started) / 1000);

    const results: PerformResult[] = items
      .filter((it) => it.type !== "section")
      .map((it) => {
        const st = state[it.id];
        return {
          itemId: it.id,
          passed: it.type === "pass_fail" ? st.passed : null,
          failed: isFailed(it, st),
          value: st.value.trim() === "" ? null : st.value.trim(),
          comment: st.comment.trim() === "" ? null : st.comment.trim(),
        };
      });

    startTransition(async () => {
      await submitInspection({
        formId,
        vehicleId,
        submittedById: submittedById || null,
        startedAt: new Date(started).toISOString(),
        durationSec,
        results,
      });
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Inspected By</span>
          <select
            className={INPUT}
            value={submittedById}
            onChange={(e) => {
              markStarted();
              setSubmittedById(e.target.value);
            }}
          >
            <option value="">—</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        {items.map((it) => {
          if (it.type === "section") {
            return (
              <div key={it.id} className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {it.label}
                </p>
              </div>
            );
          }

          const st = state[it.id];
          const failed = isFailed(it, st);

          return (
            <div key={it.id} className="border-b border-slate-100 px-4 py-4 last:border-b-0">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {it.label}
                    {it.required ? <span className="text-red-500"> *</span> : null}
                  </p>
                  {it.instructions ? (
                    <p className="mt-0.5 text-xs text-slate-400">{it.instructions}</p>
                  ) : null}
                </div>

                {it.type === "pass_fail" ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => update(it.id, { passed: true })}
                      className={`rounded-lg px-4 py-1.5 text-sm font-medium ring-1 ring-inset transition-colors ${
                        st.passed === true
                          ? "bg-emerald-600 text-white ring-emerald-600"
                          : "bg-white text-slate-700 ring-slate-300 hover:bg-emerald-50"
                      }`}
                    >
                      Pass
                    </button>
                    <button
                      type="button"
                      onClick={() => update(it.id, { passed: false })}
                      className={`rounded-lg px-4 py-1.5 text-sm font-medium ring-1 ring-inset transition-colors ${
                        st.passed === false
                          ? "bg-red-600 text-white ring-red-600"
                          : "bg-white text-slate-700 ring-slate-300 hover:bg-red-50"
                      }`}
                    >
                      Fail
                    </button>
                  </div>
                ) : null}
              </div>

              {it.type === "number" || it.type === "meter" ? (
                <input
                  type="number"
                  step="any"
                  className={`${INPUT} mt-2 max-w-xs`}
                  placeholder={it.type === "meter" ? "Meter reading…" : "Value…"}
                  value={st.value}
                  onChange={(e) => update(it.id, { value: e.target.value })}
                />
              ) : null}

              {it.type === "text" ? (
                <textarea
                  rows={2}
                  className={`${INPUT} mt-2`}
                  placeholder="Enter text…"
                  value={st.value}
                  onChange={(e) => update(it.id, { value: e.target.value })}
                />
              ) : null}

              {it.type === "dropdown" ? (
                <select
                  className={`${INPUT} mt-2 max-w-xs`}
                  value={st.value}
                  onChange={(e) => update(it.id, { value: e.target.value })}
                >
                  <option value="">Select…</option>
                  {it.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : null}

              {it.type === "date" ? (
                <input
                  type="date"
                  className={`${INPUT} mt-2 max-w-xs`}
                  value={st.value}
                  onChange={(e) => update(it.id, { value: e.target.value })}
                />
              ) : null}

              {it.type === "photo" || it.type === "signature" ? (
                <input
                  type="text"
                  className={`${INPUT} mt-2`}
                  placeholder={
                    it.type === "photo" ? "Photo URL…" : "Type your name to sign…"
                  }
                  value={st.value}
                  onChange={(e) => update(it.id, { value: e.target.value })}
                />
              ) : null}

              {it.type === "number" || it.type === "dropdown" ? (
                <label className="mt-2 flex items-center gap-1.5 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-600"
                    checked={st.flaggedFailed}
                    onChange={(e) => update(it.id, { flaggedFailed: e.target.checked })}
                  />
                  Flag as failed
                </label>
              ) : null}

              {failed ? (
                <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-red-700">
                      Comment (required on fail)
                    </span>
                    <textarea
                      rows={2}
                      className={INPUT}
                      placeholder="Describe the defect…"
                      value={st.comment}
                      onChange={(e) => update(it.id, { comment: e.target.value })}
                    />
                  </label>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {errors.length > 0 ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="mb-1 text-sm font-semibold text-red-700">
            Please fix before submitting:
          </p>
          <ul className="list-inside list-disc text-sm text-red-600">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button type="button" onClick={handleSubmit} disabled={isPending}>
          {isPending ? "Submitting…" : "Submit Inspection"}
        </Button>
      </div>
    </div>
  );
}
