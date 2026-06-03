import type {
  Contact,
  ContactInput,
  ContactStatus,
  Recommendation,
  RecommendationInput,
  RecommendationStatus,
} from "./types";
import { normalizeContactStatus } from "./types";
import { findDuplicatesAmong } from "./duplicate";
import { createServerClient } from "./supabase/server";

type DbRow = Record<string, unknown>;

function rowToContact(row: DbRow): Contact {
  const images = row.images;
  return {
    id: row.id as string,
    companyName: row.company_name as string,
    contactPerson: row.contact_person as string,
    phone: row.phone as string,
    email: row.email as string,
    website: row.website as string,
    address: row.address as string,
    productInfo: row.product_info as string,
    notes: row.notes as string,
    status: normalizeContactStatus(row.status as string),
    tags: row.tags as string,
    uploadedBy: row.uploaded_by as string,
    recommendationId: (row.recommendation_id as string) || "",
    images: Array.isArray(images) ? (images as string[]) : [],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToRecommendation(row: DbRow): Recommendation {
  const images = row.images;
  return {
    id: row.id as string,
    productName: row.product_name as string,
    brand: row.brand as string,
    reason: row.reason as string,
    referenceUrl: row.reference_url as string,
    desiredPrice: (row.desired_price as string) ?? "",
    sellerName: row.seller_name as string,
    status: row.status as RecommendationStatus,
    images: Array.isArray(images) ? (images as string[]) : [],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToActivity(row: DbRow) {
  return {
    id: row.id as string,
    contactId: row.contact_id as string,
    content: row.content as string,
    author: row.author as string,
    createdAt: row.created_at as string,
  };
}

// ── Contacts ──

export async function getAllContacts(): Promise<Contact[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToContact);
}

export async function getContactById(id: string): Promise<Contact | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToContact(data) : null;
}

export async function createContact(
  id: string,
  input: ContactInput
): Promise<Contact> {
  const now = new Date().toISOString();
  const supabase = createServerClient();
  const { error } = await supabase.from("contacts").insert({
    id,
    company_name: input.companyName,
    contact_person: input.contactPerson ?? "",
    phone: input.phone ?? "",
    email: input.email ?? "",
    website: input.website ?? "",
    address: input.address ?? "",
    product_info: input.productInfo ?? "",
    notes: input.notes ?? "",
    status: input.status ?? "new",
    tags: input.tags ?? "",
    uploaded_by: input.uploadedBy ?? "",
    recommendation_id: input.recommendationId || null,
    images: [],
    created_at: now,
    updated_at: now,
  });
  if (error) throw error;
  return (await getContactById(id))!;
}

export async function updateContact(
  id: string,
  input: Partial<ContactInput>
): Promise<Contact | null> {
  const existing = await getContactById(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const supabase = createServerClient();
  const { error } = await supabase
    .from("contacts")
    .update({
      company_name: input.companyName ?? existing.companyName,
      contact_person: input.contactPerson ?? existing.contactPerson,
      phone: input.phone ?? existing.phone,
      email: input.email ?? existing.email,
      website: input.website ?? existing.website,
      address: input.address ?? existing.address,
      product_info: input.productInfo ?? existing.productInfo,
      notes: input.notes ?? existing.notes,
      status: input.status ?? existing.status,
      tags: input.tags ?? existing.tags,
      uploaded_by: input.uploadedBy ?? existing.uploadedBy,
      recommendation_id:
        (input.recommendationId ?? existing.recommendationId) || null,
      updated_at: now,
    })
    .eq("id", id);
  if (error) throw error;
  return getContactById(id);
}

export async function updateContactStatus(
  id: string,
  status: ContactStatus
): Promise<Contact | null> {
  return updateContact(id, { status });
}

export async function addContactImage(
  id: string,
  imagePath: string
): Promise<Contact | null> {
  const existing = await getContactById(id);
  if (!existing) return null;

  const images = [...existing.images, imagePath];
  const now = new Date().toISOString();
  const supabase = createServerClient();
  const { error } = await supabase
    .from("contacts")
    .update({ images, updated_at: now })
    .eq("id", id);
  if (error) throw error;
  return getContactById(id);
}

export async function removeContactImage(
  id: string,
  imagePath: string
): Promise<Contact | null> {
  const existing = await getContactById(id);
  if (!existing) return null;

  const images = existing.images.filter((img) => img !== imagePath);
  const now = new Date().toISOString();
  const supabase = createServerClient();
  const { error } = await supabase
    .from("contacts")
    .update({ images, updated_at: now })
    .eq("id", id);
  if (error) throw error;
  return getContactById(id);
}

export async function deleteContact(id: string): Promise<boolean> {
  await deleteActivitiesByContactId(id);
  const supabase = createServerClient();
  const { error, count } = await supabase
    .from("contacts")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function getStats() {
  const contacts = await getAllContacts();
  const byStatus: Record<string, number> = {};
  contacts.forEach((c) => {
    byStatus[c.status] = (byStatus[c.status] || 0) + 1;
  });
  return { total: contacts.length, byStatus };
}

// ── Recommendations ──

export async function getAllRecommendations(): Promise<Recommendation[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("recommendations")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToRecommendation);
}

export async function getRecommendationById(
  id: string
): Promise<Recommendation | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("recommendations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToRecommendation(data) : null;
}

export async function createRecommendation(
  id: string,
  input: RecommendationInput
): Promise<Recommendation> {
  const now = new Date().toISOString();
  const supabase = createServerClient();
  const { error } = await supabase.from("recommendations").insert({
    id,
    product_name: input.productName,
    brand: input.brand ?? "",
    reason: input.reason ?? "",
    reference_url: input.referenceUrl ?? "",
    desired_price: input.desiredPrice ?? "",
    seller_name: input.sellerName,
    status: "new",
    images: [],
    created_at: now,
    updated_at: now,
  });
  if (error) throw error;
  return (await getRecommendationById(id))!;
}

export async function updateRecommendationStatus(
  id: string,
  status: RecommendationStatus
): Promise<Recommendation | null> {
  const existing = await getRecommendationById(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const supabase = createServerClient();
  const { error } = await supabase
    .from("recommendations")
    .update({ status, updated_at: now })
    .eq("id", id);
  if (error) throw error;
  return getRecommendationById(id);
}

export async function addRecommendationImage(
  id: string,
  imagePath: string
): Promise<Recommendation | null> {
  const existing = await getRecommendationById(id);
  if (!existing) return null;

  const images = [...existing.images, imagePath];
  const now = new Date().toISOString();
  const supabase = createServerClient();
  const { error } = await supabase
    .from("recommendations")
    .update({ images, updated_at: now })
    .eq("id", id);
  if (error) throw error;
  return getRecommendationById(id);
}

export async function getRecommendationStats() {
  const items = await getAllRecommendations();
  const byStatus: Record<string, number> = {};
  items.forEach((r) => {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  });
  return { total: items.length, byStatus };
}

export async function findDuplicateContacts(
  companyName: string,
  phone: string,
  excludeId?: string
) {
  const contacts = await getAllContacts();
  return findDuplicatesAmong(contacts, companyName, phone, excludeId);
}

// ── Activities ──

export async function getActivitiesByContactId(contactId: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("contact_activities")
    .select("*")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToActivity);
}

export async function createActivity(
  id: string,
  contactId: string,
  content: string,
  author = ""
) {
  const now = new Date().toISOString();
  const supabase = createServerClient();
  const { error } = await supabase.from("contact_activities").insert({
    id,
    contact_id: contactId,
    content,
    author,
    created_at: now,
  });
  if (error) throw error;
  const activities = await getActivitiesByContactId(contactId);
  return activities.find((a) => a.id === id)!;
}

export async function deleteActivity(id: string): Promise<boolean> {
  const supabase = createServerClient();
  const { error, count } = await supabase
    .from("contact_activities")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) throw error;
  return (count ?? 0) > 0;
}

async function deleteActivitiesByContactId(contactId: string) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("contact_activities")
    .delete()
    .eq("contact_id", contactId);
  if (error) throw error;
}
