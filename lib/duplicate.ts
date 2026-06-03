import type { Contact } from "./types";

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function normalizeCompanyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/\(주\)|주식회사|\(유\)|유한회사|㈜|（주）/g, "");
}

export function getDuplicateReasons(
  companyName: string,
  phone: string,
  contact: Contact
): string[] {
  const reasons: string[] = [];
  const normName = normalizeCompanyName(companyName);
  const normPhone = normalizePhone(phone);

  if (normName.length >= 2 && normalizeCompanyName(contact.companyName) === normName) {
    reasons.push("업체명");
  }
  if (normPhone.length >= 9 && normalizePhone(contact.phone) === normPhone) {
    reasons.push("전화번호");
  }
  return reasons;
}

export function findDuplicatesAmong(
  contacts: Contact[],
  companyName: string,
  phone: string,
  excludeId?: string
): { contact: Contact; reasons: string[] }[] {
  const results: { contact: Contact; reasons: string[] }[] = [];

  for (const contact of contacts) {
    if (excludeId && contact.id === excludeId) continue;
    const reasons = getDuplicateReasons(companyName, phone, contact);
    if (reasons.length > 0) {
      results.push({ contact, reasons });
    }
  }

  return results;
}
