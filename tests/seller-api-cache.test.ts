import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import {
  DEFAULT_STALE_MS,
  fetchSellerApi,
  hasFreshSellerApiCache,
  invalidateSellerApiCache,
  peekSellerApiData,
  prefetchSellerTab,
  resetSellerApiCacheForTests,
  SELLER_API,
  writeSellerApiCache,
} from "../lib/seller-api-cache";

afterEach(() => {
  resetSellerApiCacheForTests();
  mock.restoreAll();
});

describe("seller-api-cache", () => {
  it("write/peek/invalidate round-trip", () => {
    writeSellerApiCache(SELLER_API.products, { products: [{ id: "1" }] });
    assert.deepEqual(peekSellerApiData(SELLER_API.products), {
      products: [{ id: "1" }],
    });
    assert.equal(hasFreshSellerApiCache(SELLER_API.products), true);

    invalidateSellerApiCache(SELLER_API.products);
    assert.equal(peekSellerApiData(SELLER_API.products), null);
    assert.equal(hasFreshSellerApiCache(SELLER_API.products), false);
  });

  it("returns fresh cache without refetch", async () => {
    let calls = 0;
    mock.method(globalThis, "fetch", async () => {
      calls += 1;
      return new Response(JSON.stringify({ products: [{ id: "a" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const first = await fetchSellerApi<{ products: { id: string }[] }>(
      SELLER_API.products
    );
    const second = await fetchSellerApi<{ products: { id: string }[] }>(
      SELLER_API.products
    );

    assert.equal(first.ok, true);
    assert.deepEqual(first.data?.products, [{ id: "a" }]);
    assert.deepEqual(second.data?.products, [{ id: "a" }]);
    assert.equal(calls, 1);
  });

  it("force bypasses fresh cache", async () => {
    let calls = 0;
    mock.method(globalThis, "fetch", async () => {
      calls += 1;
      return new Response(
        JSON.stringify({ products: [{ id: String(calls) }] }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    });

    await fetchSellerApi(SELLER_API.products);
    const forced = await fetchSellerApi<{ products: { id: string }[] }>(
      SELLER_API.products,
      { force: true }
    );

    assert.equal(calls, 2);
    assert.deepEqual(forced.data?.products, [{ id: "2" }]);
  });

  it("dedupes in-flight requests", async () => {
    let calls = 0;
    mock.method(globalThis, "fetch", async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 20));
      return new Response(JSON.stringify({ orders: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const [a, b] = await Promise.all([
      fetchSellerApi(SELLER_API.orders, { force: true }),
      fetchSellerApi(SELLER_API.orders, { force: true }),
    ]);

    assert.equal(calls, 1);
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
  });

  it("refetches when cache is stale", async () => {
    let calls = 0;
    mock.method(globalThis, "fetch", async () => {
      calls += 1;
      return new Response(JSON.stringify({ shop: { name: "셀틱" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    await fetchSellerApi(SELLER_API.me);
    writeSellerApiCache(SELLER_API.me, { shop: { name: "셀틱" } });
    // Backdate by writing then manually... writeSellerApiCache sets now.
    // Use staleMs: 0 to treat any cache as stale.
    await fetchSellerApi(SELLER_API.me, { staleMs: 0 });
    assert.equal(calls, 2);
    assert.ok(DEFAULT_STALE_MS > 0);
  });

  it("prefetchSellerTab warms related endpoints", async () => {
    const seen = new Set<string>();
    mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
      const url = String(input);
      seen.add(url);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    prefetchSellerTab("/seller/orders");
    await new Promise((r) => setTimeout(r, 30));

    assert.ok(seen.has(SELLER_API.orders));
    assert.ok(seen.has(SELLER_API.products));
    assert.ok(seen.has(SELLER_API.me));
  });
});
