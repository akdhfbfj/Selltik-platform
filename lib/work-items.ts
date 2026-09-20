import { v4 as uuidv4 } from "uuid";
import type {
  WorkItem,
  WorkItemInput,
  WorkItemReply,
  WorkItemStatus,
  WorkItemType,
} from "./types";
import { createServerClient } from "./supabase/server";

type DbRow = Record<string, unknown>;

function rowToWorkItem(row: DbRow): WorkItem {
  const shop = row.shops as { name?: string } | null;
  const replies = row.work_item_replies as { count: number }[] | undefined;
  return {
    id: row.id as string,
    type: row.type as WorkItemType,
    title: row.title as string,
    body: row.body as string,
    authorType: row.author_type as WorkItem["authorType"],
    authorName: (row.author_name as string) ?? "",
    shopId: (row.shop_id as string) ?? "",
    shopName: shop?.name ?? "",
    assignee: (row.assignee as string) ?? "",
    status: row.status as WorkItemStatus,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    resolvedAt: (row.resolved_at as string) ?? "",
    replyCount: replies?.[0]?.count ?? 0,
  };
}

function rowToReply(row: DbRow): WorkItemReply {
  return {
    id: row.id as string,
    workItemId: row.work_item_id as string,
    authorType: row.author_type as WorkItemReply["authorType"],
    authorName: (row.author_name as string) ?? "",
    body: row.body as string,
    createdAt: row.created_at as string,
  };
}

const LIST_SELECT = "*, shops(name), work_item_replies(count)";

export async function getAllWorkItems(filter?: {
  type?: WorkItemType;
  status?: WorkItemStatus;
}): Promise<WorkItem[]> {
  const supabase = createServerClient();
  let query = supabase.from("work_items").select(LIST_SELECT);
  if (filter?.type) query = query.eq("type", filter.type);
  if (filter?.status) query = query.eq("status", filter.status);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToWorkItem);
}

export async function getWorkItemsForShop(shopId: string): Promise<WorkItem[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("work_items")
    .select(LIST_SELECT)
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToWorkItem);
}

export async function getWorkItemById(id: string): Promise<WorkItem | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("work_items")
    .select(LIST_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToWorkItem(data) : null;
}

export async function getWorkItemReplies(
  workItemId: string
): Promise<WorkItemReply[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("work_item_replies")
    .select("*")
    .eq("work_item_id", workItemId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToReply);
}

export async function createWorkItem(
  input: WorkItemInput,
  authorType: "admin" | "seller",
  authorName: string,
  shopId: string | null
): Promise<WorkItem> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const supabase = createServerClient();
  const { error } = await supabase.from("work_items").insert({
    id,
    type: input.type,
    title: input.title.trim(),
    body: input.body.trim(),
    author_type: authorType,
    author_name: authorName.trim(),
    shop_id: shopId,
    assignee: input.assignee?.trim() ?? "",
    status: "open",
    created_at: now,
    updated_at: now,
  });
  if (error) throw error;
  return (await getWorkItemById(id))!;
}

export async function updateWorkItemStatus(
  id: string,
  status: WorkItemStatus
): Promise<WorkItem | null> {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("work_items")
    .update({
      status,
      updated_at: new Date().toISOString(),
      resolved_at: status === "done" ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) throw error;
  return getWorkItemById(id);
}

export async function addWorkItemReply(
  workItemId: string,
  authorType: "admin" | "seller",
  authorName: string,
  body: string
): Promise<WorkItemReply> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const supabase = createServerClient();
  const { error } = await supabase.from("work_item_replies").insert({
    id,
    work_item_id: workItemId,
    author_type: authorType,
    author_name: authorName.trim(),
    body: body.trim(),
    created_at: now,
  });
  if (error) throw error;

  // 운영진이 답하면 답변완료로, 셀러가 후속 메시지를 남기면 다시 대기로 돌린다.
  await supabase
    .from("work_items")
    .update({
      status: authorType === "admin" ? "answered" : "open",
      updated_at: now,
    })
    .eq("id", workItemId)
    .neq("status", "done");

  const { data, error: fetchError } = await supabase
    .from("work_item_replies")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchError) throw fetchError;
  return rowToReply(data);
}
