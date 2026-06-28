import { redirect } from "next/navigation";

/** 이전 URL 호환 */
export default function LegacyOrdersImportPage() {
  redirect("/seller/reply/import");
}
