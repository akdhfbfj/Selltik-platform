import assert from "node:assert/strict";
import test from "node:test";
import { parseSupplyCsv } from "../lib/parse-supply-csv";
import { buildSupplyPriceTemplateCsv } from "../lib/supply-template-csv";

test("공급가 CSV 양식의 예시 행은 업로드되지 않는다", () => {
  const products = parseSupplyCsv(buildSupplyPriceTemplateCsv());
  assert.equal(products.length, 0);
});

test("양식 헤더 뒤에 실제 상품 행을 붙이면 열 위치대로 읽는다", () => {
  const csv =
    buildSupplyPriceTemplateCsv() +
    "마데카크림 110ml,세트,27000,0,27000,32000,5000,15.6%\r\n";
  const products = parseSupplyCsv(csv);
  assert.equal(products.length, 1);
  assert.equal(products[0].officialName, "마데카크림 110ml");
  assert.equal(products[0].description, "세트");
  assert.equal(products[0].purchasePrice, 27000);
  assert.equal(products[0].baseShipping, 0);
  assert.equal(products[0].supplyTotal, 27000);
  assert.equal(products[0].consumerPrice, 32000);
});
