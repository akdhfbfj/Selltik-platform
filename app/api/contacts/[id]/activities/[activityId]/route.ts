import { NextResponse } from "next/server";
import { deleteActivity, getContactById } from "@/lib/db";

type RouteParams = { params: Promise<{ id: string; activityId: string }> };

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id, activityId } = await params;
  const contact = await getContactById(id);
  if (!contact) {
    return NextResponse.json({ error: "업체를 찾을 수 없습니다." }, { status: 404 });
  }

  await deleteActivity(activityId);
  return NextResponse.json({ success: true });
}
