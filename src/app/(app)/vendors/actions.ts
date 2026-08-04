"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

const CLASSIFICATION_KEYS = ["fuel", "service", "parts", "vehicles"] as const;

export async function createVendor(formData: FormData) {
  const name = str(formData, "name");
  if (!name) throw new Error("Vendor name is required");

  const classifications = CLASSIFICATION_KEYS.filter(
    (key) => formData.get(`classification_${key}`) === "on"
  );

  const vendor = await db.vendor.create({
    data: {
      name,
      classifications: JSON.stringify(classifications),
      contactName: str(formData, "contactName"),
      phone: str(formData, "phone"),
      email: str(formData, "email"),
      website: str(formData, "website"),
      address: str(formData, "address"),
    },
  });

  revalidatePath("/vendors");
  redirect(`/vendors/${vendor.id}`);
}
