import { NextResponse } from "next/server";
import { requireSellerShop } from "@/lib/seller";
import {
  deleteWorkItem,
  getWorkItemById,
  getWorkItemReplies,
  updateWorkItem,
} from "@/lib/work-items";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const shop = await requireSellerShop();
  if (!shop) {
    return NextResponse.json({ error: "셀러 로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const item = await getWorkItemById(id);
    if (!item || item.shopId !== shop.id) {
      return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
    }
    const replies = await getWorkItemReplies(id);
    return NextResponse.json({ item, replies });
  } catch {
    return NextResponse.json(
      { error: "불러오지 못했습니다." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const shop = await requireSellerShop();
  if (!shop) {
    return NextResponse.json({ error: "셀러 로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const existing = await getWorkItemById(id);
    if (!existing || existing.shopId !== shop.id) {
      return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
    }

    const { title, body } = (await request.json()) as {
      title?: string;
      body?: string;
    };
    if (title !== undefined && !title.trim()) {
      return NextResponse.json({ error: "제목은 필수입니다." }, { status: 400 });
    }
    if (body !== undefined && !body.trim()) {
      return NextResponse.json({ error: "내용은 필수입니다." }, { status: 400 });
    }

    const item = await updateWorkItem(id, { title, body });
    return NextResponse.json(item);
  } catch {
    return NextResponse.json({ error: "수정에 실패했습니다." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const shop = await requireSellerShop();
  if (!shop) {
    return NextResponse.json({ error: "셀러 로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const existing = await getWorkItemById(id);
    if (!existing || existing.shopId !== shop.id) {
      return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
    }

    await deleteWorkItem(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "삭제에 실패했습니다." }, { status: 500 });
  }
}
