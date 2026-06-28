import { cleanOcrAddress, mergeAddressDetail } from "./ocr-cleanup";
import { searchKakaoAddress } from "./kakao-address";
/** 주소 문자열로 우편번호 자동 조회 (카카오 로컬 API) */
export async function resolvePostalCodeFromAddress(
  address: string
): Promise<string> {
  const resolved = await resolveFullAddressFromText(address);
  return resolved?.postalCode ?? "";
}

/** 분석 주소 → 우편번호 + 표준 주소 (도로명/지번) */
export async function resolveFullAddressFromText(
  rawAddress: string
): Promise<{ postalCode: string; address: string } | null> {
  const cleaned = cleanOcrAddress(rawAddress);
  const query = cleaned.trim();
  if (query.length < 4) return null;

  try {
    const queries = [
      query,
      query.replace(/\s*\([^)]+\)\s*/g, " "),
      query.replace(/\s+[가-힣]+(?:타운|아파트|빌라|마을).*$/i, ""),
    ];

    for (const q of [...new Set(queries.map((s) => s.replace(/\s+/g, " ").trim()))]) {
      if (q.length < 4) continue;
      const results = await searchKakaoAddress(q);
      const best = results[0];
      if (!best?.postalCode) continue;

      const base = best.roadAddress || best.address || best.jibunAddress;
      if (!base) continue;

      return {
        postalCode: best.postalCode,
        address: mergeAddressDetail(cleaned, base),
      };
    }
    return null;
  } catch {
    return null;
  }
}
