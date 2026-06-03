import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { createContact, getAllContacts, getStats } from "@/lib/db";
import type { ContactInput } from "@/lib/types";

export async function GET() {
  const contacts = await getAllContacts();
  const stats = await getStats();
  return NextResponse.json({ contacts, stats });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ContactInput;
    if (!body.companyName?.trim()) {
      return NextResponse.json(
        { error: "업체명은 필수입니다." },
        { status: 400 }
      );
    }
    const contact = await createContact(uuidv4(), body);
    return NextResponse.json(contact, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "업체 등록에 실패했습니다." },
      { status: 500 }
    );
  }
}
