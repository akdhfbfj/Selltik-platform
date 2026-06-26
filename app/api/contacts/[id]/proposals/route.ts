import { NextResponse } from "next/server";
import { getContactById } from "@/lib/db";
import {
  createProposal,
  formatProposalDbError,
  getProposalsByContactId,
} from "@/lib/proposals";
import { saveProposalFile } from "@/lib/upload";

type RouteParams = { params: Promise<{ id: string }> };

const ALLOWED_EXT = new Set([".xlsx", ".xls", ".csv"]);

function isAllowedProposalFile(name: string): boolean {
  const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
  return ALLOWED_EXT.has(ext);
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const contact = await getContactById(id);
  if (!contact) {
    return NextResponse.json({ error: "업체를 찾을 수 없습니다." }, { status: 404 });
  }

  try {
    const proposals = await getProposalsByContactId(id);
    return NextResponse.json({ proposals });
  } catch (e) {
    const err = e as { message?: string; code?: string };
    return NextResponse.json(
      { error: formatProposalDbError(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const contact = await getContactById(id);
  if (!contact) {
    return NextResponse.json({ error: "업체를 찾을 수 없습니다." }, { status: 404 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const notes = (formData.get("notes") as string | null)?.trim() ?? "";

    if (!file) {
      return NextResponse.json({ error: "파일을 선택해주세요." }, { status: 400 });
    }

    if (!isAllowedProposalFile(file.name)) {
      return NextResponse.json(
        { error: "xlsx, xls, csv 파일만 업로드할 수 있습니다." },
        { status: 400 }
      );
    }

    const { storagePath } = await saveProposalFile(file, id);
    const proposal = await createProposal(id, {
      fileName: file.name,
      filePath: storagePath,
      notes,
    });

    return NextResponse.json({ proposal });
  } catch (e) {
    const err = e as { message?: string; code?: string };
    return NextResponse.json(
      { error: formatProposalDbError(err) || "제안서 업로드에 실패했습니다." },
      { status: 500 }
    );
  }
}
