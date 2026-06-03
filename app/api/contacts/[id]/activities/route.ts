import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  createActivity,
  getActivitiesByContactId,
  getContactById,
} from "@/lib/db";
import type { ContactActivityInput } from "@/lib/types";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const contact = await getContactById(id);
  if (!contact) {
    return NextResponse.json({ error: "업체를 찾을 수 없습니다." }, { status: 404 });
  }
  const activities = await getActivitiesByContactId(id);
  return NextResponse.json(activities);
}

export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const contact = await getContactById(id);
  if (!contact) {
    return NextResponse.json({ error: "업체를 찾을 수 없습니다." }, { status: 404 });
  }

  const body = (await request.json()) as ContactActivityInput;
  if (!body.content?.trim()) {
    return NextResponse.json({ error: "내용을 입력해주세요." }, { status: 400 });
  }

  const activity = await createActivity(
    uuidv4(),
    id,
    body.content.trim(),
    body.author?.trim() ?? ""
  );
  return NextResponse.json(activity, { status: 201 });
}
