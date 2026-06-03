import { NextResponse } from "next/server";
import { findDuplicateContacts } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const companyName = searchParams.get("companyName") ?? "";
  const phone = searchParams.get("phone") ?? "";
  const excludeId = searchParams.get("excludeId") ?? undefined;

  const duplicates = await findDuplicateContacts(companyName, phone, excludeId);
  return NextResponse.json({ duplicates });
}
