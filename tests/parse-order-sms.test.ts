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
