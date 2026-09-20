/** Client-side GET cache for admin APIs (stale-while-revalidate). */

export const ADMIN_API = {
  me: "/api/admin/me",
  workItems: "/api/admin/work-items?",
} as const;

export const DEFAULT_STALE_MS = 60_000;

export type AdminApiResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
};

type CacheEntry = {
  result: AdminApiResult<unknown>;
  fetchedAt: number;
};

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<AdminApiResult<unknown>>>();

export function peekAdminApiData<T>(url: string): T | null {
  const entry = cache.get(url);
  if (!entry?.result.ok || entry.result.data == null) return null;
  return entry.result.data as T;
}

async function doFetch<T>(url: string): Promise<AdminApiResult<T>> {
  try {
    const res = await fetch(url);
    let data: T | null = null;
    try {
      data = (await res.json()) as T;
    } catch {
      data = null;
    }
    const result: AdminApiResult<T> = { ok: res.ok, status: res.status, data };
    if (res.ok && data != null) {
      cache.set(url, { result: result as AdminApiResult<unknown>, fetchedAt: Date.now() });
    }
    return result;
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

export async function fetchAdminApi<T>(
  url: string,
  opts?: { force?: boolean; staleMs?: number }
): Promise<AdminApiResult<T>> {
  const staleMs = opts?.staleMs ?? DEFAULT_STALE_MS;
  const entry = cache.get(url);

  if (
    !opts?.force &&
    entry?.result.ok &&
    entry.result.data != null &&
    Date.now() - entry.fetchedAt < staleMs
  ) {
    return entry.result as AdminApiResult<T>;
  }

  const existing = inflight.get(url);
  if (existing) {
    return existing as Promise<AdminApiResult<T>>;
  }

  const promise = doFetch<T>(url).finally(() => {
    inflight.delete(url);
  });
  inflight.set(url, promise as Promise<AdminApiResult<unknown>>);
  return promise;
}

/** Warm cache without blocking (nav hover / focus). */
export function prefetchAdminApi(url: string): void {
  void fetchAdminApi(url);
}

export function prefetchAdminTab(href: string): void {
  switch (href) {
    case "/admin/board":
      prefetchAdminApi(ADMIN_API.workItems);
      prefetchAdminApi(ADMIN_API.me);
      break;
    default:
      break;
  }
}
