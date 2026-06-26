import { NextResponse } from "next/server";
import {
  deleteProposal,
  formatProposalDbError,
  getProposalById,
} from "@/lib/proposals";
import { deleteStorageFile } from "@/lib/upload";

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  try {
    const existing = await getProposalById(id);
    if (!existing) {
      return NextResponse.json({ error: "제안서를 찾을 수 없습니다." }, { status: 404 });
    }

    await deleteProposal(id);
    await deleteStorageFile(existing.filePath);

    return NextResponse.json({ success: true });
  } catch (e) {
    const err = e as { message?: string; code?: string };
    return NextResponse.json(
      { error: formatProposalDbError(err) || "제안서 삭제에 실패했습니다." },
      { status: 500 }
    );
  }
}
