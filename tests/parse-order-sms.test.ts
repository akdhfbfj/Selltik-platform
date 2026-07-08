import { readFileSync } from "fs";
import { join } from "path";
import test from "node:test";
import assert from "node:assert/strict";
import { parseOrderSms, parseProductLinesFromSms } from "../lib/parse-order-sms";

interface FixtureCase {
  id: string;
  note: string;
  input: string;
  expect: {
    ordererName?: string;
    recipientName?: string;
    contactPhone?: string;
    addressIncludes?: string[];
  };
}

const fixturesPath = join(__dirname, "fixtures", "sms-cases.json");
const cases = JSON.parse(readFileSync(fixturesPath, "utf-8")) as FixtureCase[];

for (const fc of cases) {
  test(`${fc.id}: ${fc.note}`, () => {
    const parsed = parseOrderSms(fc.input);
    const exp = fc.expect;

    if (exp.ordererName) {
      assert.equal(parsed.ordererName, exp.ordererName);
    }
    if (exp.recipientName) {
      assert.equal(parsed.recipientName, exp.recipientName);
    }
    if (exp.contactPhone) {
      assert.equal(parsed.contactPhone, exp.contactPhone);
    }
    if (exp.addressIncludes) {
      for (const part of exp.addressIncludes) {
        assert.ok(
          parsed.address.includes(part),
          `주소에 "${part}" 포함 기대, 실제: ${parsed.address}`
        );
      }
    }
  });
}

test("extractOutboundProductLines: 안내 문자 가격 라인", () => {
  const text = "세탁캡슐세제 5봉 1세트 29000";
  const lines = parseProductLinesFromSms(text);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].productName, "세탁캡슐세제 5봉 1세트");
  assert.equal(lines[0].quantity, 1);
});

test("parseProductLinesFromSms: 복수 상품 라인 추출", () => {
  const text = [
    "셀틱 유산균 x2",
    "비타민D x1",
    "",
    "주문자 홍길동",
    "받는분 김철수",
    "연락처 010-1234-5678",
    "주소 서울시 강남구",
  ].join("\n");

  const lines = parseProductLinesFromSms(text);
  assert.equal(lines.length, 2);
  assert.equal(lines[0].productName, "셀틱 유산균");
  assert.equal(lines[0].quantity, 2);
  assert.equal(lines[1].productName, "비타민D");
  assert.equal(lines[1].quantity, 1);
});

test("parseOrderSms: 주소 끝 이름 + 별도 연락처", () => {
  const parsed = parseOrderSms(
    [
      "강원특별자치도 원주시 시청로 524 단관청솔5차 502동 204호 장요한",
      "010 2899 6150",
      "롤팬블랙.",
    ].join("\n")
  );
  assert.equal(parsed.ordererName, "장요한");
  assert.equal(parsed.recipientName, "장요한");
  assert.equal(parsed.contactPhone, "010-2899-6150");
  assert.ok(parsed.address.includes("원주시"));
  assert.ok(!parsed.address.includes("장요한"));
  assert.ok(parsed.productName.includes("롤팬"));
});

test("parseOrderSms: 주문자.이름.연락처 점 구분", () => {
  const parsed = parseOrderSms(
    [
      "전남목포시   원산중앙로   108 .205동1103호(연산동 주공2단지APT)",
      "주문자.김성자.010 5664 4040.",
    ].join("\n")
  );
  assert.equal(parsed.ordererName, "김성자");
  assert.equal(parsed.recipientName, "김성자");
  assert.equal(parsed.contactPhone, "010-5664-4040");
  assert.ok(parsed.address.includes("목포시"));
});

test("parseOrderSms: 이름 칸에 전화번호 금지", () => {
  const parsed = parseOrderSms("홍길동\n010-1234-5678\n롤팬");
  assert.equal(parsed.ordererName, "홍길동");
  assert.equal(parsed.recipientName, "홍길동");
  assert.equal(parsed.contactPhone, "010-1234-5678");
});
