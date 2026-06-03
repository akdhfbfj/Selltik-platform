import { NextResponse } from "next/server";
import { addContactImage, getContactById, removeContactImage } from "@/lib/db";
import { deleteUploadedFile, saveUploadedFile } from "@/lib/upload";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const contact = await getContactById(id);
  if (!contact) {
    return NextResponse.json({ error: "업체를 찾을 수 없습니다." }, { status: 404 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
    }

    const imagePath = await saveUploadedFile(file, `contact-${id}`);
    const updated = await addContactImage(id, imagePath);
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "이미지 업로드에 실패했습니다." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const { imagePath } = (await request.json()) as { imagePath: string };

  const contact = await getContactById(id);
  if (!contact) {
    return NextResponse.json({ error: "업체를 찾을 수 없습니다." }, { status: 404 });
  }

  await deleteUploadedFile(imagePath);
  const updated = await removeContactImage(id, imagePath);
  return NextResponse.json(updated);
}
