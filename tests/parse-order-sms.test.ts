import { readFileSync } from "fs";
import { join } from "path";
import test from "node:test";
import assert from "node:assert/strict";
import { parseOrderSms } from "../lib/parse-order-sms";

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
