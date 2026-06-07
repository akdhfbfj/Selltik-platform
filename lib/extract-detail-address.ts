export interface ParsedAddressParts {
  base: string;
  detail: string;
}

function normalizeSpaces(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function normalizeRoadSpacing(text: string): string {
  return normalizeSpaces(
    text
      .replace(/(로|길|대로|거리)(\d)/g, "$1 $2")
      .replace(/(번길|번로)(\d)/g, "$1 $2")
  );
}

/** post 저장소 script.js — 문자 주소에서 검색용 기본주소·상세주소 분리 */
export function extractDetailAddress(rawText: string): ParsedAddressParts {
  const lines = rawText
    .split("\n")
    .map((line) =>
      normalizeSpaces(
        line.replace(/,/g, " ").replace(/\d{2,3}-\d{3,4}-\d{4}/g, " ")
      )
    )
    .filter(Boolean);

  const cleaned = normalizeSpaces(
    rawText.replace(/[,\n]/g, " ").replace(/\d{2,3}-\d{3,4}-\d{4}/g, " ")
  );

  const roadAddressPattern =
    /(.*?[가-힣A-Za-z0-9]+(?:로|길|대로|거리|번길|번로)\s*\d[\d\-]*)(?:\s+(.+))?$/;

  for (const line of lines) {
    const roadAddressMatch = line.match(roadAddressPattern);

    if (roadAddressMatch) {
      const base = normalizeRoadSpacing(roadAddressMatch[1]);
      const detail = normalizeSpaces(roadAddressMatch[2] || "");

      if (detail) {
        return {
          base: normalizeSpaces(
            `${lines[0] === line ? "" : lines[0]} ${base}`
          ),
          detail,
        };
      }

      return {
        base: normalizeSpaces(`${lines[0] === line ? "" : lines[0]} ${base}`),
        detail: "",
      };
    }
  }

  const roadAddressMatch = cleaned.match(roadAddressPattern);

  if (roadAddressMatch) {
    const base = normalizeRoadSpacing(roadAddressMatch[1]);
    const detail = normalizeSpaces(roadAddressMatch[2] || "");
    return { base, detail };
  }

  const detailPatterns = [
    /((?:산)?\d+[A-Za-z\-]*동\s*\d+[A-Za-z\-]*호(?:\s*\d+층)?)/,
    /(\d+[A-Za-z\-]*동\s*\d+[A-Za-z\-]*호)/,
    /((?:지하\s*)?\d+층\s*[A-Za-z0-9가-힣]+)/,
    /(\d+층\s*\d+[A-Za-z\-]*호)/,
    /([A-Za-z0-9가-힣]+동\s*\d+호)/,
    /(\d+[A-Za-z\-]*호)/,
    /(\d+층)/,
  ];

  for (const pattern of detailPatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      const detail = normalizeSpaces(match[1]);
      const base = normalizeSpaces(cleaned.replace(match[1], " "));
      return { base, detail };
    }
  }

  return { base: cleaned, detail: "" };
}

export function buildPostcodeExtra(data: {
  bname?: string;
  buildingName?: string;
}): string {
  const extras: string[] = [];
  if (data.bname) extras.push(data.bname);
  if (data.buildingName) extras.push(data.buildingName);
  return extras.length ? ` (${extras.join(", ")})` : "";
}

export interface PostcodeSelection {
  zonecode: string;
  userSelectedType: "R" | "J";
  roadAddress: string;
  jibunAddress: string;
  bname?: string;
  buildingName?: string;
}

export function formatSelectedPostcodeAddress(
  data: PostcodeSelection,
  detail: string
): { postalCode: string; address: string; detailAddress: string } {
  const selectedBase =
    data.userSelectedType === "R" ? data.roadAddress : data.jibunAddress;
  const roadExtra =
    data.userSelectedType === "R" ? buildPostcodeExtra(data) : "";
  const baseAddress = `${selectedBase}${roadExtra}`.trim();
  const fullAddress = detail ? `${baseAddress} ${detail}`.trim() : baseAddress;

  return {
    postalCode: data.zonecode,
    address: fullAddress,
    detailAddress: detail,
  };
}
