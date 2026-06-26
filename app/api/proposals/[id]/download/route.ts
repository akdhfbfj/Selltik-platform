import { NextResponse } from "next/server";
import {
  formatProposalDbError,
  getProposalById,
} from "@/lib/proposals";
import { downloadStorageFile } from "@/lib/upload";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  try {
    const proposal = await getProposalById(id);
    if (!proposal) {
      return NextResponse.json({ error: "제안서를 찾을 수 없습니다." }, { status: 404 });
    }

    const { buffer, contentType } = await downloadStorageFile(proposal.filePath);
    const encodedName = encodeURIComponent(proposal.fileName);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodedName}`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (e) {
    const err = e as { message?: string; code?: string };
    return NextResponse.json(
      { error: formatProposalDbError(err) || "다운로드에 실패했습니다." },
      { status: 500 }
    );
  }
}
