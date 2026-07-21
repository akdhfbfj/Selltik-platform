/** Client-side GET cache for seller APIs (stale-while-revalidate). */

export const SELLER_API = {
  products: "/api/seller/products",
  orders: "/api/seller/orders",
  me: "/api/seller/me",
  settings: "/api/seller/settings",
} as const;

export const DEFAULT_STALE_MS = 60_000;

export type SellerApiResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
};

type CacheEntry = {
  result: SellerApiResult<unknown>;
  fetchedAt: number;
};

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<SellerApiResult<unknown>>>();

export function peekSellerApiData<T>(url: string): T | null {
  const entry = cache.get(url);
  if (!entry?.result.ok || entry.result.data == null) return null;
  return entry.result.data as T;
}

export function hasFreshSellerApiCache(
  url: string,
  staleMs = DEFAULT_STALE_MS
): boolean {
  const entry = cache.get(url);
  if (!entry?.result.ok || entry.result.data == null) return false;
  return Date.now() - entry.fetchedAt < staleMs;
}

export function writeSellerApiCache<T>(
  url: string,
  data: T,
  status = 200
): void {
  cache.set(url, {
    result: { ok: true, status, data },
    fetchedAt: Date.now(),
  });
}

export function invalidateSellerApiCache(url?: string): void {
  if (url) {
    cache.delete(url);
    inflight.delete(url);
    return;
  }
  cache.clear();
  inflight.clear();
}

async function doFetch<T>(url: string): Promise<SellerApiResult<T>> {
  try {
    const res = await fetch(url);
    let data: T | null = null;
    try {
      data = (await res.json()) as T;
    } catch {
      data = null;
    }
    const result: SellerApiResult<T> = {
      ok: res.ok,
      status: res.status,
      data,
    };
    if (res.ok && data != null) {
      cache.set(url, {
        result: result as SellerApiResult<unknown>,
        fetchedAt: Date.now(),
      });
    }
    return result;
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

export async function fetchSellerApi<T>(
  url: string,
  opts?: { force?: boolean; staleMs?: number }
): Promise<SellerApiResult<T>> {
  const staleMs = opts?.staleMs ?? DEFAULT_STALE_MS;
  const entry = cache.get(url);

  if (
    !opts?.force &&
    entry?.result.ok &&
    entry.result.data != null &&
    Date.now() - entry.fetchedAt < staleMs
  ) {
    return entry.result as SellerApiResult<T>;
  }

  const existing = inflight.get(url);
  if (existing) {
    return existing as Promise<SellerApiResult<T>>;
  }

  const promise = doFetch<T>(url).finally(() => {
    inflight.delete(url);
  });
  inflight.set(url, promise as Promise<SellerApiResult<unknown>>);
  return promise;
}

/** Warm cache without blocking (nav hover / focus). */
export function prefetchSellerApi(url: string): void {
  void fetchSellerApi(url);
}

export function prefetchSellerTab(href: string): void {
  switch (href) {
    case "/seller/products":
      prefetchSellerApi(SELLER_API.products);
      break;
    case "/seller/outbound-sms":
      prefetchSellerApi(SELLER_API.products);
      prefetchSellerApi(SELLER_API.settings);
      prefetchSellerApi(SELLER_API.me);
      break;
    case "/seller/reply":
      prefetchSellerApi(SELLER_API.products);
      break;
    case "/seller/orders":
      prefetchSellerApi(SELLER_API.orders);
      prefetchSellerApi(SELLER_API.products);
      prefetchSellerApi(SELLER_API.me);
      break;
    default:
      break;
  }
}

/** Test helper — clears in-memory store. */
export function resetSellerApiCacheForTests(): void {
  cache.clear();
  inflight.clear();
}
