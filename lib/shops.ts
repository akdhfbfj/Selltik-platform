import { v4 as uuidv4 } from "uuid";
import type { Shop, ShopInput } from "./types";
import { createServerClient } from "./supabase/server";

type DbRow = Record<string, unknown>;

function rowToShop(row: DbRow): Shop {
  return {
    id: row.id as string,
    name: row.name as string,
    plan: row.plan as Shop["plan"],
    contactEmail: (row.contact_email as string) ?? "",
    authUserId: (row.auth_user_id as string) ?? "",
    createdAt: row.created_at as string,
  };
}

export async function getAllShops(): Promise<Shop[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("shops")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToShop);
}

export async function getShopByAuthUserId(
  authUserId: string
): Promise<Shop | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("shops")
    .select("*")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToShop(data) : null;
}

export async function getShopById(id: string): Promise<Shop | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("shops")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToShop(data) : null;
}

export async function createShopWithAuthUser(
  input: ShopInput,
  authUserId: string
): Promise<Shop> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const supabase = createServerClient();
  const { error } = await supabase.from("shops").insert({
    id,
    name: input.name.trim(),
    contact_email: input.contactEmail.trim().toLowerCase(),
    auth_user_id: authUserId,
    plan: input.plan ?? "free",
    created_at: now,
  });
  if (error) throw error;
  return (await getShopById(id))!;
}
