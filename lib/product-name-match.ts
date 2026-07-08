import type { MasterProduct } from "./types";

function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[·\*×]/g, "")
    .replace(/[^\p{L}\p{N}\[\]()/_-]/gu, "");
}

export function matchMasterProductByName(
  rawName: string,
  products: MasterProduct[]
): MasterProduct | null {
  const query = normalizeProductName(rawName.trim());
  if (!query) return null;

  const exact = products.find(
    (p) => normalizeProductName(p.officialName) === query
  );
  if (exact) return exact;

  const contains = products.filter((p) => {
    const official = normalizeProductName(p.officialName);
    return official.includes(query) || query.includes(official);
  });
  if (contains.length === 1) return contains[0];

  if (contains.length > 1) {
    contains.sort(
      (a, b) =>
        normalizeProductName(a.officialName).length -
        normalizeProductName(b.officialName).length
    );
    const best = contains[0];
    const bestNorm = normalizeProductName(best.officialName);
    const secondNorm = normalizeProductName(contains[1].officialName);
    if (bestNorm.length <= secondNorm.length * 0.85) return best;
  }

  return null;
}

export function normalizeSellerName(name: string): string {
  return name.trim().replace(/\s+/g, "").toLowerCase();
}
