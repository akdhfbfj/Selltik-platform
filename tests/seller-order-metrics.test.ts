import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildRevenueTrendsFromDailyMap,
  shiftDateKey,
  weekStartKey,
} from "../lib/seller-order-metrics";

describe("seller-order-metrics date helpers", () => {
  it("shiftDateKey moves calendar days", () => {
    assert.equal(shiftDateKey("2026-07-21", -1), "2026-07-20");
    assert.equal(shiftDateKey("2026-07-01", -1), "2026-06-30");
  });

  it("weekStartKey is Monday", () => {
    // 2026-07-21 is Tuesday → Monday 2026-07-20
    assert.equal(weekStartKey("2026-07-21"), "2026-07-20");
    // Sunday → previous Monday
    assert.equal(weekStartKey("2026-07-19"), "2026-07-13");
  });
});

describe("buildRevenueTrendsFromDailyMap", () => {
  it("builds daily / weekly / monthly period sums", () => {
    const byDate = new Map<string, { sales: number; margin: number }>([
      ["2026-07-20", { sales: 1000, margin: 200 }],
      ["2026-07-21", { sales: 3000, margin: 600 }],
      ["2026-06-15", { sales: 5000, margin: 1000 }],
    ]);

    const trends = buildRevenueTrendsFromDailyMap(byDate, "2026-07-21", {
      dailyDays: 3,
      weekCount: 2,
      monthCount: 2,
    });

    assert.equal(trends.daily.length, 3);
    assert.deepEqual(
      trends.daily.map((d) => d.key),
      ["2026-07-19", "2026-07-20", "2026-07-21"]
    );
    assert.equal(trends.daily[1].sales, 1000);
    assert.equal(trends.daily[2].sales, 3000);
    assert.equal(trends.daily[2].margin, 600);

    assert.equal(trends.weekly.length, 2);
    const thisWeek = trends.weekly[1];
    assert.equal(thisWeek.key, "2026-07-20");
    assert.equal(thisWeek.sales, 4000);
    assert.equal(thisWeek.margin, 800);

    assert.equal(trends.monthly.length, 2);
    assert.equal(trends.monthly[0].key, "2026-06");
    assert.equal(trends.monthly[0].sales, 5000);
    assert.equal(trends.monthly[1].key, "2026-07");
    assert.equal(trends.monthly[1].sales, 4000);
    assert.equal(trends.monthly[1].label, "2026년 7월");
  });
});
