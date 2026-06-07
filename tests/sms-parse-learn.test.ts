import test from "node:test";
import assert from "node:assert/strict";
import { emptyResult, type ParsedOrderSms } from "../lib/parse-order-sms";
import {
  applyLearnedLabelPatterns,
  applyProductHints,
  applySmsLearnings,
  extractLearnedLabelPatterns,
  extractProductHints,
} from "../lib/sms-parse-learn";
import type { SmsParseSampleRow } from "../lib/sms-parse-samples";

function emptyParsed(): ParsedOrderSms {
  return emptyResult();
}

test("extractLearnedLabelPatterns: 전역 라벨 패턴 추출", () => {
  const samples: SmsParseSampleRow[] = [
    {
      shop_id: "shop-a",
      raw_sms_text: "성함: 홍길동\n주소: 서울시 강남구",
      auto_parsed: emptyParsed(),
      seller_final: {
        productName: "",
        quantity: 1,
        ordererName: "",
        recipientName: "홍길동",
        contactPhone: "",
        contactPhone2: "",
        postalCode: "",
        address: "서울시 강남구",
        shippingMemo: "",
      },
      corrected_fields: ["recipientName", "address"],
    },
    {
      shop_id: "shop-b",
      raw_sms_text: "성함: 김철수\n핸 010-1111-2222",
      auto_parsed: emptyParsed(),
      seller_final: {
        productName: "",
        quantity: 1,
        ordererName: "",
        recipientName: "김철수",
        contactPhone: "010-1111-2222",
        contactPhone2: "",
        postalCode: "",
        address: "",
        shippingMemo: "",
      },
      corrected_fields: ["recipientName", "contactPhone"],
    },
  ];

  const patterns = extractLearnedLabelPatterns(samples);
  assert.ok(patterns.some((p) => p.field === "recipientName"));
  assert.ok(patterns.some((p) => p.field === "contactPhone"));
});

test("applyLearnedLabelPatterns: 학습 패턴으로 수령인·연락처 채움", () => {
  const patterns = extractLearnedLabelPatterns([
    {
      shop_id: "shop-a",
      raw_sms_text: "성함: 홍길동\n핸 010-9999-8888",
      auto_parsed: emptyParsed(),
      seller_final: {
        productName: "",
        quantity: 1,
        ordererName: "",
        recipientName: "홍길동",
        contactPhone: "010-9999-8888",
        contactPhone2: "",
        postalCode: "",
        address: "",
        shippingMemo: "",
      },
      corrected_fields: ["recipientName", "contactPhone"],
    },
    {
      shop_id: "shop-b",
      raw_sms_text: "성함: 이영희\n핸 010-7777-6666",
      auto_parsed: emptyParsed(),
      seller_final: {
        productName: "",
        quantity: 1,
        ordererName: "",
        recipientName: "이영희",
        contactPhone: "010-7777-6666",
        contactPhone2: "",
        postalCode: "",
        address: "",
        shippingMemo: "",
      },
      corrected_fields: ["recipientName", "contactPhone"],
    },
  ]);

  const raw = "성함: 박민수\n핸 010 5555 4444";
  const result = applyLearnedLabelPatterns(emptyParsed(), raw, patterns);

  assert.equal(result.recipientName, "박민수");
  assert.equal(result.contactPhone, "010-5555-4444");
});

test("extractProductHints + applyProductHints: 셀러별 상품명", () => {
  const samples: SmsParseSampleRow[] = [
    {
      shop_id: "mango",
      raw_sms_text: "망고몰 특가상품 x2\n홍길동 010-1234-5678",
      auto_parsed: {
        ...emptyParsed(),
        productName: "특가상품",
        quantity: 1,
      },
      seller_final: {
        productName: "망고 유산균 30포",
        quantity: 2,
        ordererName: "",
        recipientName: "홍길동",
        contactPhone: "010-1234-5678",
        contactPhone2: "",
        postalCode: "",
        address: "",
        shippingMemo: "",
      },
      corrected_fields: ["productName", "quantity"],
    },
  ];

  const hints = extractProductHints(samples);
  const parsed = { ...emptyParsed(), productName: "특가상품", quantity: 1 };
  const result = applyProductHints(
    parsed,
    "망고몰 특가상품 x2\n홍길동",
    hints
  );

  assert.equal(result.productName, "망고 유산균 30포");
  assert.equal(result.quantity, 2);
});

test("applySmsLearnings: 전역+셀러 분리 적용", () => {
  const globalSamples: SmsParseSampleRow[] = [
    {
      shop_id: "dando",
      raw_sms_text: "성함: 단도고객",
      auto_parsed: emptyParsed(),
      seller_final: {
        productName: "",
        quantity: 1,
        ordererName: "",
        recipientName: "단도고객",
        contactPhone: "",
        contactPhone2: "",
        postalCode: "",
        address: "",
        shippingMemo: "",
      },
      corrected_fields: ["recipientName"],
    },
    {
      shop_id: "mango",
      raw_sms_text: "성함: 망고고객",
      auto_parsed: emptyParsed(),
      seller_final: {
        productName: "",
        quantity: 1,
        ordererName: "",
        recipientName: "망고고객",
        contactPhone: "",
        contactPhone2: "",
        postalCode: "",
        address: "",
        shippingMemo: "",
      },
      corrected_fields: ["recipientName"],
    },
  ];

  const shopProduct: SmsParseSampleRow[] = [
    {
      shop_id: "mango",
      raw_sms_text: "망고상품 x1",
      auto_parsed: { ...emptyParsed(), productName: "망고상품" },
      seller_final: {
        productName: "망고 프리미엄",
        quantity: 1,
        ordererName: "",
        recipientName: "",
        contactPhone: "",
        contactPhone2: "",
        postalCode: "",
        address: "",
        shippingMemo: "",
      },
      corrected_fields: ["productName"],
    },
  ];

  const raw = "성함: 신규고객\n망고상품 x1";
  const result = applySmsLearnings(emptyParsed(), raw, {
    global: globalSamples,
    shopProduct,
  });

  assert.equal(result.recipientName, "신규고객");
  assert.equal(result.productName, "망고 프리미엄");
});
