export function parsePrice(val: string): number {
  if (!val?.trim()) return 0;
  const n = parseInt(val.replace(/[₩,\s"]/g, ""), 10);
  return Number.isNaN(n) ? 0 : n;
}

/** 따옴표 안 줄바꿈을 한 행으로 묶음 (RFC 4180) */
export function parseCsvRecords(text: string): string[] {
  const records: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
      continue;
    }
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      if (current.trim()) records.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) records.push(current);
  return records;
}

/** 간단 CSV 행 파싱 (따옴표 필드 지원) */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  fields.push(current.trim());
  return fields;
}

export function readCsvText(file: File | Blob): Promise<string> {
  return file.text().then((t) => t.replace(/^\uFEFF/, ""));
}
