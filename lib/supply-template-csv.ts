/** 관리자 공급가 CSV 업로드 열 순서 (parseSupplyCsv 고정 위치) */
export const SUPPLY_TEMPLATE_HEADERS = [
  "상품명",
  "설명",
  "매입가",
  "택배비",
  "계",
  "판매가",
  "이익액",
  "이익률",
] as const;

export const SUPPLY_TEMPLATE_CSV_FILENAME = "공급가_양식.csv";

function csvCell(value: string | number): string {
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function csvRow(cells: (string | number)[]): string {
  return cells.map(csvCell).join(",");
}

/** 예시 행은 업로드 시 반영되지 않는다. 계·이익액·이익률은 비워도 된다. */
export function buildSupplyPriceTemplateCsv(): string {
  const rows: (string | number)[][] = [
    [...SUPPLY_TEMPLATE_HEADERS],
    ["예시) 상품 A", "간단 설명", 17000, 0, 17000, 28000, 11000, "39.3%"],
    ["예시) 상품 B", "", 44000, 4000, 48000, 60000, 12000, "20.0%"],
  ];
  return rows.map(csvRow).join("\r\n") + "\r\n";
}

export function buildSupplyPriceTemplateCsvDownload(): string {
  return `\uFEFF${buildSupplyPriceTemplateCsv()}`;
}
