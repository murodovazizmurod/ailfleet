"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function str(fd: FormData, name: string): string | null {
  const v = fd.get(name);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

function intVal(fd: FormData, name: string): number | null {
  const s = str(fd, name);
  if (s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function dateVal(fd: FormData, name: string): Date | null {
  const s = str(fd, name);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function contactData(fd: FormData) {
  return {
    firstName: str(fd, "firstName") ?? "",
    lastName: str(fd, "lastName") ?? "",
    email: str(fd, "email"),
    phone: str(fd, "phone"),
    jobTitle: str(fd, "jobTitle"),
    employeeNumber: str(fd, "employeeNumber"),
    isOperator: fd.get("isOperator") === "on",
    isTechnician: fd.get("isTechnician") === "on",
    licenseNumber: str(fd, "licenseNumber"),
    licenseClass: str(fd, "licenseClass"),
    licenseState: str(fd, "licenseState"),
    hireDate: dateVal(fd, "hireDate"),
    address: str(fd, "address"),
  };
}

export async function createContact(formData: FormData) {
  const contact = await db.contact.create({ data: contactData(formData) });
  revalidatePath("/contacts");
  redirect(`/contacts/${contact.id}`);
}

export async function updateContact(id: string, formData: FormData) {
  await db.contact.update({ where: { id }, data: contactData(formData) });
  revalidatePath("/contacts");
  revalidatePath(`/contacts/${id}`);
  redirect(`/contacts/${id}`);
}

export async function addContactRenewal(contactId: string, formData: FormData) {
  const dueDate = dateVal(formData, "dueDate");
  if (!dueDate) {
    redirect(`/contacts/${contactId}?error=${encodeURIComponent("Due date is required.")}`);
  }
  await db.contactRenewal.create({
    data: {
      contactId,
      type: str(formData, "type") ?? "custom",
      name: str(formData, "name"),
      dueDate,
      dueSoonDays: intVal(formData, "dueSoonDays") ?? 30,
    },
  });
  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/contacts");
  revalidatePath("/renewals");
  redirect(`/contacts/${contactId}`);
}
