import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/FormField";
import { createVendor } from "../actions";

export const dynamic = "force-dynamic";

const CLASSIFICATIONS = [
  { key: "fuel", label: "Fuel" },
  { key: "service", label: "Service" },
  { key: "parts", label: "Parts" },
  { key: "vehicles", label: "Vehicles" },
];

export default function NewVendorPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="New Vendor"
        subtitle="Add a fuel, service or parts vendor"
        actions={<ButtonLink href="/vendors" variant="secondary">Cancel</ButtonLink>}
      />
      <Card>
        <form action={createVendor} className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required>
            <TextInput type="text" name="name" required />
          </Field>
          <Field
            label="Classifications"
            hint="Controls which dropdowns show this vendor"
          >
            <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1.5">
              {CLASSIFICATIONS.map((c) => (
                <label
                  key={c.key}
                  className="flex items-center gap-2 text-sm text-slate-700"
                >
                  <input
                    type="checkbox"
                    name={`classification_${c.key}`}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Contact Name">
            <TextInput type="text" name="contactName" />
          </Field>
          <Field label="Phone">
            <TextInput type="tel" name="phone" />
          </Field>
          <Field label="Email">
            <TextInput type="email" name="email" />
          </Field>
          <Field label="Website">
            <TextInput type="url" name="website" placeholder="https://" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Address">
              <TextInput type="text" name="address" />
            </Field>
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2 border-t border-slate-100 pt-4">
            <ButtonLink href="/vendors" variant="secondary">
              Cancel
            </ButtonLink>
            <Button type="submit">Create Vendor</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
