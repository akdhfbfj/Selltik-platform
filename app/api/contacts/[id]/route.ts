import { NextResponse } from "next/server";
import {
  deleteContact,
  getContactById,
  updateContact,
} from "@/lib/db";
import { deleteContactImages } from "@/lib/upload";
import type { ContactInput } from "@/lib/types";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const contact = await getContactById(id);
  if (!contact) {
    return NextResponse.json({ error: "업체를 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json(contact);
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { id } = await params;
  try {
    const body = (await request.json()) as Partial<ContactInput>;
    const contact = await updateContact(id, body);
    if (!contact) {
      return NextResponse.json({ error: "업체를 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json(contact);
  } catch {
    return NextResponse.json(
      { error: "업체 수정에 실패했습니다." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const contact = await getContactById(id);
  if (!contact) {
    return NextResponse.json({ error: "업체를 찾을 수 없습니다." }, { status: 404 });
  }
  await deleteContactImages(contact.images);
  await deleteContact(id);
  return NextResponse.json({ success: true });
}
