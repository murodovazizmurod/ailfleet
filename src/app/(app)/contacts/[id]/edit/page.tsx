import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { ContactForm } from "../../ContactForm";
import { updateContact } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contact = await db.contact.findUnique({ where: { id } });
  if (!contact) notFound();

  const action = updateContact.bind(null, contact.id);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={`Edit ${contact.firstName} ${contact.lastName}`}
        subtitle="Update contact details"
      />
      <ContactForm action={action} contact={contact} submitLabel="Save Changes" />
    </div>
  );
}
