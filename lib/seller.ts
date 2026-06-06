import { getShopByAuthUserId } from "./shops";
import { getSellerSession } from "./supabase/server-auth";
import type { Shop } from "./types";

export async function requireSellerShop(): Promise<Shop | null> {
  const user = await getSellerSession();
  if (!user) return null;
  return getShopByAuthUserId(user.id);
}
