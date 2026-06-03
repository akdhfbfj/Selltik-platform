import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  createRecommendation,
  getAllRecommendations,
  getRecommendationStats,
} from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import type { RecommendationInput } from "@/lib/types";

export async function GET() {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const recommendations = await getAllRecommendations();
  const stats = await getRecommendationStats();
  return NextResponse.json({ recommendations, stats });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RecommendationInput;
    if (!body.productName?.trim()) {
      return NextResponse.json(
        { error: "상품명은 필수입니다." },
        { status: 400 }
      );
    }
    if (!body.sellerName?.trim()) {
      return NextResponse.json(
        { error: "쇼핑몰 이름은 필수입니다." },
        { status: 400 }
      );
    }
    const rec = await createRecommendation(uuidv4(), body);
    return NextResponse.json(rec, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "추천 등록에 실패했습니다." },
      { status: 500 }
    );
  }
}
