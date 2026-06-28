import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanOcrAddress,
  cleanOcrAddressLine,
  cleanOcrProductName,
  extractAddressFromOcrText,
  mergeAddressDetail,
} from "../lib/ocr-cleanup";
import { ocrPreprocessScale } from "../lib/extract-image-text";

test("cleanOcrProductName: 2<9 → 2kg", () => {
  assert.equal(cleanOcrProductName("하미과메론 2<9"), "하미과메론 2kg");
});

test("cleanOcrAddress: 327-2204% → 327-2 204호", () => {
  const cleaned = cleanOcrAddress(
    "경기도 광주시 도척면 도척로 327-2204% 진우리 동화타운"
  );
  assert.ok(cleaned.includes("327-2"));
  assert.ok(cleaned.includes("204호"));
});

test("mergeAddressDetail: 리·단지·호수 보존", () => {
  const raw =
    "경기도 광주시 도척면 도척로 327-2 204호 진우리 동화타운";
  const base = "경기 광주시 도척면 도척로 327-2";
  const merged = mergeAddressDetail(raw, base);
  assert.ok(merged.includes("327-2"));
  assert.ok(merged.includes("동화타운"));
  assert.ok(merged.includes("204호"));
});

test("cleanOcrAddressLine: OCR 잡음 접두 제거", () => {
  const cleaned = cleanOcrAddressLine(
    "WISHYFNTUS 금강로 1567-31 현대아파트 101동 313호"
  );
  assert.ok(cleaned.includes("금강로 1567-31"));
  assert.ok(!cleaned.startsWith("WISHY"));
});

test("extractAddressFromOcrText: 도로명 주소 복원", () => {
  const text = `입금했습니다
경기도 남양주시 진접읍 금강로 1567-31 현대아파트 101동 313호 윤석고
010-4293-2989
그리들팬 38cm : 40,000원`;
  const addr = extractAddressFromOcrText(text);
  assert.ok(addr.includes("금강로"));
  assert.ok(addr.includes("1567-31"));
  assert.ok(addr.includes("남양주"));
});

test("ocrPreprocessScale: 작은 스크린샷은 적당히 확대", () => {
  assert.ok(ocrPreprocessScale(400, 800) >= 1.5);
  assert.ok(ocrPreprocessScale(1080, 1920) <= 1.5);
});
