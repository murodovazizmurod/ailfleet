import type { Contact } from "@prisma/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/FormField";

function dateInput(d: Date | null | undefined): string | undefined {
  return d ? new Date(d).toISOString().slice(0, 10) : undefined;
}

export function ContactForm({
  action,
  contact,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  contact?: Contact | null;
  submitLabel: string;
}) {
  return (
    <Card>
      <form action={action} className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" required>
          <TextInput name="firstName" required defaultValue={contact?.firstName} />
        </Field>
        <Field label="Last name" required>
          <TextInput name="lastName" required defaultValue={contact?.lastName} />
        </Field>
        <Field label="Email">
          <TextInput name="email" type="email" defaultValue={contact?.email ?? ""} />
        </Field>
        <Field label="Phone">
          <TextInput name="phone" defaultValue={contact?.phone ?? ""} />
        </Field>
        <Field label="Job title">
          <TextInput name="jobTitle" defaultValue={contact?.jobTitle ?? ""} />
        </Field>
        <Field label="Employee number">
          <TextInput name="employeeNumber" defaultValue={contact?.employeeNumber ?? ""} />
        </Field>

        <div className="sm:col-span-2 flex flex-wrap gap-6 rounded-lg bg-slate-50 px-4 py-3">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              name="isOperator"
              defaultChecked={contact ? contact.isOperator : true}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
            />
            Operator
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              name="isTechnician"
              defaultChecked={contact?.isTechnician ?? false}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
            />
            Technician
          </label>
        </div>

        <Field label="License number">
          <TextInput name="licenseNumber" defaultValue={contact?.licenseNumber ?? ""} />
        </Field>
        <Field label="License class">
          <TextInput name="licenseClass" placeholder="e.g. CDL-A" defaultValue={contact?.licenseClass ?? ""} />
        </Field>
        <Field label="License state">
          <TextInput name="licenseState" defaultValue={contact?.licenseState ?? ""} />
        </Field>
        <Field label="Hire date">
          <TextInput name="hireDate" type="date" defaultValue={dateInput(contact?.hireDate)} />
        </Field>

        <div className="sm:col-span-2">
          <Field label="Address">
            <TextInput name="address" defaultValue={contact?.address ?? ""} />
          </Field>
        </div>

        <div className="sm:col-span-2 flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="submit">{submitLabel}</Button>
        </div>
      </form>
    </Card>
  );
}
