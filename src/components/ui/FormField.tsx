import { ReactNode } from "react";
import type { EnumDef } from "@/lib/enums";

const INPUT =
  "block w-full rounded-lg border-0 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600";

export function Field({
  label,
  children,
  required,
  hint,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-slate-400">{hint}</span> : null}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={INPUT} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={INPUT} />;
}

export function Select({
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select {...props} className={INPUT}>
      {children}
    </select>
  );
}

export function EnumSelect({
  def,
  allowEmpty,
  emptyLabel = "—",
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  def: EnumDef;
  allowEmpty?: boolean;
  emptyLabel?: string;
}) {
  return (
    <Select {...props}>
      {allowEmpty ? <option value="">{emptyLabel}</option> : null}
      {Object.entries(def).map(([k, v]) => (
        <option key={k} value={k}>
          {v.label}
        </option>
      ))}
    </Select>
  );
}
