import { readFileSync } from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

// dynamic import ts
const { parseOrderSms, looksLikeAddress } = await import("../lib/parse-order-sms.ts");

const input = `이수진
010 7768 8856
경기광주 포돌이로117
서희스타힐스 102동603호
이수진입니다`;

for (const l of input.trim().split("\n")) {
  console.log(JSON.stringify(l), looksLikeAddress(l));
}

console.log(JSON.stringify(parseOrderSms(input), null, 2));
