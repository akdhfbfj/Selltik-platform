"use client";

import { useCallback, useEffect, useState } from "react";
import type { VendorProposal } from "@/lib/types";
import {
  Download,
  FileSpreadsheet,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";

interface Props {
  contactId: string;
}

export default function ContactProposals({ contactId }: Props) {
  const [proposals, setProposals] = useState<VendorProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);

  const loadProposals = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/contacts/${contactId}/proposals`);
    const data = await res.json();
    if (res.ok) {
      setProposals(data.proposals);
    } else {
      setError(data.error || "제안서 목록을 불러오지 못했습니다.");
    }
    setLoading(false);
  }, [contactId]);

  useEffect(() => {
    loadProposals();
  }, [loadProposals]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`/api/contacts/${contactId}/proposals`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "업로드에 실패했습니다.");
    } else {
      setExpanded(true);
      await loadProposals();
    }

    setUploading(false);
    e.target.value = "";
  };

  const handleDelete = async (proposal: VendorProposal) => {
    if (
      !confirm(
        `"${proposal.fileName}" 제안서를 삭제할까요?\n선별 상품도 함께 삭제됩니다.`
      )
    ) {
      return;
    }

    const res = await fetch(`/api/proposals/${proposal.id}`, {
      method: "DELETE",
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "삭제에 실패했습니다.");
    } else {
      await loadProposals();
    }
  };

  const handleDownload = (proposalId: string) => {
    window.location.href = `/api/proposals/${proposalId}/download`;
  };

  return (
    <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-medium text-slate-700 hover:text-brand-700"
        >
          <FileSpreadsheet className="h-4 w-4 shrink-0 text-brand-600" />
          <span className="truncate">
            제안서 {loading ? "…" : `${proposals.length}건`}
          </span>
          {proposals.some((p) => p.curatedCount > 0) && (
            <span className="shrink-0 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-medium text-brand-700">
              선별 {proposals.reduce((s, p) => s + p.curatedCount, 0)}
            </span>
          )}
        </button>
        <label
          className={`flex shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition ${
            uploading
              ? "bg-slate-200 text-slate-500"
              : "bg-white text-brand-700 shadow-sm hover:bg-brand-50"
          }`}
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          업로드
          <input
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}

      {expanded && (
        <div className="mt-3 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-4 text-xs text-slate-400">
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              불러오는 중…
            </div>
          ) : proposals.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-center">
              <Upload className="mx-auto mb-1.5 h-5 w-5 text-slate-300" />
              <p className="text-xs text-slate-500">
                받은 제안서 엑셀을 업로드하세요
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">
                xlsx · xls · csv
              </p>
            </div>
          ) : (
            proposals.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
              >
                <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-600" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-slate-800">
                    {p.fileName}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {new Date(p.createdAt).toLocaleDateString("ko-KR")}
                    {p.curatedCount > 0 && ` · 선별 ${p.curatedCount}건`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownload(p.id)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
                  title="다운로드"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(p)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                  title="삭제"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
