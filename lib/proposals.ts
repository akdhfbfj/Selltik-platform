import { v4 as uuidv4 } from "uuid";
import type {
  VendorProposal,
  VendorProposalInput,
} from "./types";
import { createServerClient } from "./supabase/server";

type DbRow = Record<string, unknown>;

function rowToProposal(row: DbRow): VendorProposal {
  return {
    id: row.id as string,
    contactId: row.contact_id as string,
    fileName: row.file_name as string,
    filePath: row.file_path as string,
    notes: (row.notes as string) ?? "",
    curatedCount: Number(row.curated_count ?? 0),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function formatProposalDbError(error: {
  message?: string;
  code?: string;
}): string {
  const msg = error.message ?? "";
  if (msg.includes("vendor_proposals") && msg.includes("does not exist")) {
    return "DB 테이블이 없습니다. Supabase SQL Editor에서 010_vendor_proposals.sql을 실행하세요.";
  }
  return msg || "DB 오류가 발생했습니다.";
}

export async function getProposalsByContactId(
  contactId: string
): Promise<VendorProposal[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("vendor_proposals")
    .select("*, curated_items(count)")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => {
    const items = row.curated_items as { count: number }[] | null;
    const count = items?.[0]?.count ?? 0;
    return rowToProposal({ ...row, curated_count: count });
  });
}

export async function getProposalById(
  id: string
): Promise<VendorProposal | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("vendor_proposals")
    .select("*, curated_items(count)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const items = data.curated_items as { count: number }[] | null;
  const count = items?.[0]?.count ?? 0;
  return rowToProposal({ ...data, curated_count: count });
}

export async function createProposal(
  contactId: string,
  input: VendorProposalInput
): Promise<VendorProposal> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const supabase = createServerClient();

  const { error } = await supabase.from("vendor_proposals").insert({
    id,
    contact_id: contactId,
    file_name: input.fileName,
    file_path: input.filePath,
    notes: input.notes?.trim() ?? "",
    created_at: now,
    updated_at: now,
  });

  if (error) throw error;
  return (await getProposalById(id))!;
}

export async function deleteProposal(id: string): Promise<boolean> {
  const existing = await getProposalById(id);
  if (!existing) return false;

  const supabase = createServerClient();
  const { error } = await supabase.from("vendor_proposals").delete().eq("id", id);
  if (error) throw error;
  return true;
}
