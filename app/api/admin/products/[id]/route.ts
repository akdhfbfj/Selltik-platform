import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  deleteMasterProduct,
  formatDbError,
  getMasterProductById,
  setMasterProductSoldOut,
  updateMasterProduct,
} from "@/lib/products";
import type { MasterProductInput } from "@/lib/types";

type RouteParams = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: RouteParams) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  try {
    const body = (await request.json()) as MasterProductInput;
    if (!body.officialName?.trim()) {
      return NextResponse.json({ error: "상품명은 필수입니다." }, { status: 400 });
    }

    const product = await updateMasterProduct(id, body);
    if (!product) {
      return NextResponse.json({ error: "상품을 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json(product);
  } catch (e) {
    const err = e as { message?: string; code?: string };
    return NextResponse.json({ error: formatDbError(err) }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  try {
    const body = (await request.json()) as { isSoldOut?: boolean };
    if (typeof body.isSoldOut !== "boolean") {
      return NextResponse.json({ error: "품절 상태를 지정해주세요." }, { status: 400 });
    }

    const product = await setMasterProductSoldOut(id, body.isSoldOut);
    if (!product) {
      return NextResponse.json({ error: "상품을 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json(product);
  } catch (e) {
    const err = e as { message?: string; code?: string };
    return NextResponse.json({ error: formatDbError(err) }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  try {
    const existing = await getMasterProductById(id);
    if (!existing) {
      return NextResponse.json({ error: "상품을 찾을 수 없습니다." }, { status: 404 });
    }
    await deleteMasterProduct(id);
    return NextResponse.json({ success: true });
  } catch (e) {
    const err = e as { message?: string; code?: string };
    return NextResponse.json({ error: formatDbError(err) }, { status: 500 });
  }
}
