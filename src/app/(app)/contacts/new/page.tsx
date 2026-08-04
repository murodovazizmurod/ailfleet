import { PageHeader } from "@/components/ui/PageHeader";
import { ContactForm } from "../ContactForm";
import { createContact } from "../actions";

export const dynamic = "force-dynamic";

export default function NewContactPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New Contact" subtitle="Add an operator, technician, or other team member" />
      <ContactForm action={createContact} submitLabel="Create Contact" />
    </div>
  );
}
