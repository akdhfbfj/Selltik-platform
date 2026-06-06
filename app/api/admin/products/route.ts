import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  createMasterProduct,
  formatDbError,
  getAllMasterProducts,
} from "@/lib/products";
import type { MasterProductInput } from "@/lib/types";

export async function GET() {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  try {
    const products = await getAllMasterProducts();
    return NextResponse.json({ products, total: products.length });
  } catch (e) {
    const err = e as { message?: string; code?: string };
    return NextResponse.json({ error: formatDbError(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as MasterProductInput;
    if (!body.officialName?.trim()) {
      return NextResponse.json({ error: "상품명은 필수입니다." }, { status: 400 });
    }
    if (!body.consumerPrice || body.consumerPrice <= 0) {
      return NextResponse.json({ error: "판매가를 입력해주세요." }, { status: 400 });
    }

    const product = await createMasterProduct({
      officialName: body.officialName,
      description: body.description,
      purchasePrice: body.purchasePrice ?? 0,
      baseShipping: body.baseShipping ?? 0,
      consumerPrice: body.consumerPrice,
      profitAmount: body.profitAmount,
      profitRate: body.profitRate,
    });
    return NextResponse.json(product, { status: 201 });
  } catch (e) {
    const err = e as { message?: string; code?: string };
    return NextResponse.json({ error: formatDbError(err) }, { status: 500 });
  }
}
