import { v4 as uuidv4 } from "uuid";
import type { ParsedOrderSms } from "./parse-order-sms";
import type { OrderInput } from "./types";
import { createServerClient } from "./supabase/server";

const LEARN_FIELDS = [
  "productName",
  "quantity",
  "ordererName",
  "recipientName",
  "contactPhone",
  "contactPhone2",
  "postalCode",
  "address",
  "shippingMemo",
] as const;

export type LearnField = (typeof LEARN_FIELDS)[number];

export interface SmsParseSampleInput {
  shopId: string;
  orderId: string | null;
  rawSmsText: string;
  autoParsed: ParsedOrderSms;
  sellerFinal: OrderInput;
}

export function toLearnSnapshot(input: OrderInput): Record<LearnField, string | number> {
  return {
    productName: input.productName.trim(),
    quantity: input.quantity,
    ordererName: input.ordererName.trim(),
    recipientName: input.recipientName.trim(),
    contactPhone: input.contactPhone.trim(),
    contactPhone2: input.contactPhone2?.trim() ?? "",
    postalCode: input.postalCode.trim(),
    address: input.address.trim(),
    shippingMemo: input.shippingMemo?.trim() ?? "",
  };
}

export function diffLearnFields(
  autoParsed: ParsedOrderSms,
  sellerFinal: OrderInput
): LearnField[] {
  const auto = toLearnSnapshot({
    ...sellerFinal,
    productName: autoParsed.productName,
    quantity: autoParsed.quantity,
    ordererName: autoParsed.ordererName,
    recipientName: autoParsed.recipientName,
    contactPhone: autoParsed.contactPhone,
    contactPhone2: autoParsed.contactPhone2,
    postalCode: autoParsed.postalCode,
    address: autoParsed.address,
    shippingMemo: autoParsed.shippingMemo,
  });
  const final = toLearnSnapshot(sellerFinal);

  return LEARN_FIELDS.filter((key) => {
    const a = String(auto[key] ?? "");
    const b = String(final[key] ?? "");
    return a !== b;
  });
}

export async function saveSmsParseSample(
  input: SmsParseSampleInput
): Promise<void> {
  if (!input.rawSmsText.trim()) return;

  const correctedFields = diffLearnFields(
    input.autoParsed,
    input.sellerFinal
  );

  const supabase = createServerClient();
  const { error } = await supabase.from("sms_parse_samples").insert({
    id: uuidv4(),
    shop_id: input.shopId,
    order_id: input.orderId,
    raw_sms_text: input.rawSmsText.trim(),
    auto_parsed: input.autoParsed,
    seller_final: toLearnSnapshot(input.sellerFinal),
    corrected_fields: correctedFields,
    created_at: new Date().toISOString(),
  });

  if (error?.message?.includes("sms_parse_samples") && error.message.includes("does not exist")) {
    console.error("sms_parse_samples 테이블 없음 — 007_sms_parse_samples.sql 실행 필요");
    return;
  }
  if (error) {
    console.error("sms_parse_samples insert failed:", error.message);
  }
}
