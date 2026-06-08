/** SMS Backup & Restore 앱 XML 백업 파싱 (브라우저·Node 공통) */

export const SMS_TYPE_RECEIVED = 1;
export const SMS_TYPE_SENT = 2;

export type SmsBackupKind = "sms" | "mms";

export interface SmsBackupMessage {
  /** 목록 키 (date+address+index) */
  id: string;
  kind: SmsBackupKind;
  address: string;
  body: string;
  /** Unix ms (앱 원본) */
  dateMs: number;
  /** Asia/Seoul 기준 YYYY-MM-DD */
  dateIso: string;
  /** 1=수신, 2=발신, … */
  type: number;
  readableDate?: string;
}

export interface SmsBackupParseResult {
  messages: SmsBackupMessage[];
  smsCount: number;
  mmsCount: number;
  backupDate?: string;
}

export interface SmsImportFilter {
  receivedOnly?: boolean;
  orderLikeOnly?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

const ATTR_RE = /([\w-]+)="([^"]*)"/g;

export function decodeXmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"');
}

function parseAttrs(fragment: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  let m: RegExpExecArray | null;
  const re = new RegExp(ATTR_RE.source, "g");
  while ((m = re.exec(fragment)) !== null) {
    attrs[m[1]] = decodeXmlEntities(m[2]);
  }
  return attrs;
}

/** Java ms → KST 날짜 (YYYY-MM-DD) */
export function smsDateToIso(dateMs: number): string {
  return new Date(dateMs).toLocaleDateString("en-CA", {
    timeZone: "Asia/Seoul",
  });
}

const PHONE_RE = /01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/;

/** 발주 답장으로 보이는 문자 (필터용 휴리스틱) */
export function looksLikeOrderSms(body: string): boolean {
  const t = body.trim();
  if (t.length < 8) return false;
  if (
    /^\[Web발신\]|\(광고\)|무료거부|입금\s*(?:되었|완료|확인)|이벤트|쿠폰|마케팅/i.test(
      t
    )
  ) {
    return false;
  }
  const hasPhone = PHONE_RE.test(t);
  const hasAddress =
    /(?:시|군|구|동|로|길|읍|면|리)|^\d{5}|받는\s*분|주소|배송/i.test(t);
  return hasPhone && hasAddress;
}

export function formatSmsPreview(body: string, maxLen = 80): string {
  const oneLine = body.replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxLen) return oneLine;
  return `${oneLine.slice(0, maxLen)}…`;
}

function mmsDirection(attrs: Record<string, string>): number {
  const box = Number(attrs.msg_box);
  if (box === 2) return SMS_TYPE_SENT;
  if (box === 1) return SMS_TYPE_RECEIVED;
  return Number(attrs.type) || SMS_TYPE_RECEIVED;
}

/** 한 줄짜리 `<sms … />` 태그 파싱 */
export function parseSmsLine(
  line: string,
  index: number
): SmsBackupMessage | null {
  const trimmed = line.trimStart();
  if (!trimmed.startsWith("<sms")) return null;

  const m = trimmed.match(/<sms\s+([^>]+)\s*\/?>/i);
  if (!m) return null;

  const attrs = parseAttrs(m[1]);
  const body = attrs.body?.trim();
  if (!body) return null;

  const dateMs = Number(attrs.date);
  if (!Number.isFinite(dateMs)) return null;

  return {
    id: `sms-${dateMs}-${attrs.address ?? index}-${index}`,
    kind: "sms",
    address: attrs.address ?? "",
    body,
    dateMs,
    dateIso: smsDateToIso(dateMs),
    type: Number(attrs.type) || 0,
    readableDate: attrs.readable_date,
  };
}

async function* iterateFileLines(file: File): AsyncGenerator<string> {
  const reader = file.stream().pipeThrough(new TextDecoderStream()).getReader();
  let partial = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    partial += value;
    let nl = partial.indexOf("\n");
    while (nl !== -1) {
      yield partial.slice(0, nl).replace(/\r$/, "");
      partial = partial.slice(nl + 1);
      nl = partial.indexOf("\n");
    }
  }
  if (partial.length > 0) {
    yield partial.replace(/\r$/, "");
  }
}

/**
 * 대용량 XML (MMS 이미지 포함) — 줄 단위 스트리밍으로 SMS만 추출.
 * MMS 블록은 건너뛰고 개수만 집계합니다.
 */
export async function parseSmsBackupFile(
  file: File,
  onProgress?: (count: number) => void
): Promise<SmsBackupParseResult> {
  const messages: SmsBackupMessage[] = [];
  let smsCount = 0;
  let mmsCount = 0;
  let backupDate: string | undefined;
  let smsIndex = 0;
  let skippingMms = false;

  for await (const line of iterateFileLines(file)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (!backupDate) {
      const root = trimmed.match(/<smses\s+([^>]+)>/i);
      if (root) backupDate = parseAttrs(root[1]).backup_date;
    }

    if (skippingMms) {
      if (trimmed.includes("</mms>")) skippingMms = false;
      continue;
    }

    if (/<mms\s/i.test(trimmed)) {
      mmsCount += 1;
      if (!trimmed.includes("</mms>")) skippingMms = true;
      continue;
    }

    const sms = parseSmsLine(trimmed, smsIndex);
    if (!sms) continue;

    messages.push(sms);
    smsCount += 1;
    smsIndex += 1;
    if (smsIndex % 200 === 0) onProgress?.(smsIndex);
  }

  onProgress?.(smsCount);
  messages.sort((a, b) => a.dateMs - b.dateMs);

  return { messages, smsCount, mmsCount, backupDate };
}

function parseSmsElements(xml: string): SmsBackupMessage[] {
  const out: SmsBackupMessage[] = [];
  let index = 0;

  for (const line of xml.split(/\r?\n/)) {
    const sms = parseSmsLine(line, index);
    if (!sms) continue;
    out.push(sms);
    index += 1;
  }

  if (out.length > 0) return out;

  const re = /<sms\s+([^>]+?)\s*\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const sms = parseSmsLine(`<sms ${m[1]}/>`, index);
    if (!sms) continue;
    out.push(sms);
    index += 1;
  }

  return out;
}

function parseMmsElements(xml: string): SmsBackupMessage[] {
  const out: SmsBackupMessage[] = [];
  const blockRe = /<mms\s+([^>]+)>([\s\S]*?)<\/mms>/gi;
  let m: RegExpExecArray | null;
  let index = 0;

  while ((m = blockRe.exec(xml)) !== null) {
    const attrs = parseAttrs(m[1]);
    const inner = m[2];
    const dateMs = Number(attrs.date);
    if (!Number.isFinite(dateMs)) continue;

    const textParts: string[] = [];
    const partRe = /<part\s+([^>]+?)\s*\/?>/gi;
    let pm: RegExpExecArray | null;
    while ((pm = partRe.exec(inner)) !== null) {
      const partAttrs = parseAttrs(pm[1]);
      if (partAttrs.text?.trim()) {
        textParts.push(partAttrs.text.trim());
      }
    }
    const body = textParts.join("\n").trim();
    if (!body) continue;

    let address = attrs.address ?? attrs.from_address ?? "";
    if (!address) {
      const addrRe = /<addr\s+([^>]+?)\s*\/?>/gi;
      let am: RegExpExecArray | null;
      while ((am = addrRe.exec(inner)) !== null) {
        const addrAttrs = parseAttrs(am[1]);
        if (addrAttrs.address) {
          address = addrAttrs.address;
          break;
        }
      }
    }

    out.push({
      id: `mms-${dateMs}-${address || index}-${index}`,
      kind: "mms",
      address,
      body,
      dateMs,
      dateIso: smsDateToIso(dateMs),
      type: mmsDirection(attrs),
      readableDate: attrs.readable_date,
    });
    index += 1;
  }

  return out;
}

export function parseSmsBackupXml(xmlText: string): SmsBackupParseResult {
  const trimmed = xmlText.trim();
  if (!trimmed) {
    return { messages: [], smsCount: 0, mmsCount: 0 };
  }

  const rootAttrs = trimmed.match(/<(?:smses|mmss)\s+([^>]+)>/i);
  const backupDate = rootAttrs ? parseAttrs(rootAttrs[1]).backup_date : undefined;

  const smsList = parseSmsElements(trimmed);
  const mmsList = parseMmsElements(trimmed);
  const messages = [...smsList, ...mmsList].sort((a, b) => a.dateMs - b.dateMs);

  return {
    messages,
    smsCount: smsList.length,
    mmsCount: mmsList.length,
    backupDate,
  };
}

export function filterSmsBackupMessages(
  messages: SmsBackupMessage[],
  filter: SmsImportFilter
): SmsBackupMessage[] {
  return messages.filter((msg) => {
    if (filter.receivedOnly && !isReceivedMessage(msg)) return false;

    if (filter.dateFrom && msg.dateIso < filter.dateFrom) return false;
    if (filter.dateTo && msg.dateIso > filter.dateTo) return false;

    if (filter.orderLikeOnly && !looksLikeOrderSms(msg.body)) return false;

    return true;
  });
}

/** 수신 문자만 (sms type=1, mms 수신함) */
export function isReceivedMessage(msg: SmsBackupMessage): boolean {
  if (msg.kind === "sms") return msg.type === SMS_TYPE_RECEIVED;
  return msg.type !== SMS_TYPE_SENT;
}
