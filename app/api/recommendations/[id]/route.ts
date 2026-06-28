import { NextResponse } from "next/server";
import { getRecommendationById, updateRecommendationStatus, deleteRecommendation } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import type { RecommendationStatus } from "@/lib/types";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const { id } = await params;
  const rec = await getRecommendationById(id);
  if (!rec) {
    return NextResponse.json({ error: "추천을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json(rec);
}

export async function PUT(request: Request, { params }: RouteParams) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const { id } = await params;
  const { status } = (await request.json()) as { status: RecommendationStatus };
  const rec = await updateRecommendationStatus(id, status);
  if (!rec) {
    return NextResponse.json({ error: "추천을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json(rec);
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const { id } = await params;
  const ok = await deleteRecommendation(id);
  if (!ok) {
    return NextResponse.json({ error: "추천을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
