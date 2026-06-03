import { NextResponse } from "next/server";
import { addRecommendationImage, getRecommendationById } from "@/lib/db";
import { saveUploadedFile } from "@/lib/upload";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const rec = await getRecommendationById(id);
  if (!rec) {
    return NextResponse.json({ error: "추천을 찾을 수 없습니다." }, { status: 404 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
    }

    const imagePath = await saveUploadedFile(file, `rec-${id}`);
    const updated = await addRecommendationImage(id, imagePath);
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "이미지 업로드에 실패했습니다." },
      { status: 500 }
    );
  }
}
