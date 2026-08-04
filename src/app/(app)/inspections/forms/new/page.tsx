import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { FormBuilder } from "./FormBuilder";

export const dynamic = "force-dynamic";

export default function NewInspectionFormPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="New Inspection Form"
        subtitle="Build a reusable checklist for vehicle inspections"
      />
      <Card>
        <FormBuilder />
      </Card>
    </div>
  );
}
