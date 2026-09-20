"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchSellerApi,
  peekSellerApiData,
  SELLER_API,
} from "@/lib/seller-api-cache";
import type { WorkItem, WorkItemReply, WorkItemStatus } from "@/lib/types";
import { HelpCircle, Loader2, MessageCircle, Plus, Send, X } from "lucide-react";

type QuestionsPayload = { items: WorkItem[] };

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_LABEL: Record<WorkItemStatus, string> = {
  open: "답변 대기",
  answered: "답변 완료",
  done: "처리 완료",
};

const STATUS_CLASS: Record<WorkItemStatus, string> = {
  open: "bg-amber-50 text-amber-700 border-amber-200",
  answered: "bg-blue-50 text-blue-700 border-blue-200",
  done: "bg-green-50 text-green-700 border-green-200",
};

export default function SellerQuestionsPage() {
  const [items, setItems] = useState<WorkItem[]>(
    () => peekSellerApiData<QuestionsPayload>(SELLER_API.questions)?.items ?? []
  );
  const [loading, setLoading] = useState(
    () => !peekSellerApiData<QuestionsPayload>(SELLER_API.questions)
  );
  const [composing, setComposing] = useState(false);
  const [form, setForm] = useState({ title: "", body: "" });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replies, setReplies] = useState<WorkItemReply[]>([]);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [replying, setReplying] = useState(false);

  const loadItems = useCallback(async (force = false) => {
    if (!peekSellerApiData<QuestionsPayload>(SELLER_API.questions)) {
      setLoading(true);
    }
    const res = await fetchSellerApi<QuestionsPayload>(SELLER_API.questions, {
      force,
    });
    if (res.ok && res.data) {
      setItems(res.data.items);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) return;
    setCreating(true);
    setError("");

    const res = await fetch("/api/seller/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "등록에 실패했습니다.");
    } else {
      setForm({ title: "", body: "" });
      setComposing(false);
      await loadItems(true);
    }
    setCreating(false);
  };

  const openItem = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    setRepliesLoading(true);
    const res = await fetch(`/api/seller/questions/${id}`);
    if (res.ok) {
      const data = await res.json();
      setReplies(data.replies);
    }
    setRepliesLoading(false);
  };

  const handleReply = async (id: string) => {
    if (!replyBody.trim()) return;
    setReplying(true);
    const res = await fetch(`/api/seller/questions/${id}/replies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: replyBody }),
    });
    if (res.ok) {
      setReplyBody("");
      const detail = await fetch(`/api/seller/questions/${id}`);
      if (detail.ok) {
        const data = await detail.json();
        setReplies(data.replies);
      }
      await loadItems(true);
    }
    setReplying(false);
  };

  const inputClass =
    "w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-4">
        <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <HelpCircle className="h-7 w-7 text-emerald-600" />
          문의하기
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          운영진에게 궁금한 점을 남겨주세요. 답변이 오면 여기서 확인할 수 있어요.
        </p>
      </div>

      <button
        type="button"
        onClick={() => setComposing((c) => !c)}
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
      >
        {composing ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        {composing ? "닫기" : "새 문의"}
      </button>

      {composing && (
        <form
          onSubmit={handleCreate}
          className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Plus className="h-4 w-4" />
            새 문의
          </h3>
          <div className="space-y-3">
            <input
              className={inputClass}
              placeholder="제목"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
              autoFocus
            />
            <textarea
              className={`${inputClass} min-h-[80px] resize-y`}
              placeholder="내용"
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              required
            />
            <button
              type="submit"
              disabled={creating}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              문의 등록
            </button>
          </div>
          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-400">
          아직 등록한 문의가 없습니다.
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const expanded = expandedId === item.id;
            return (
              <li
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => openItem(item.id)}
                  className="flex w-full items-start justify-between gap-3 p-4 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASS[item.status]}`}
                      >
                        {STATUS_LABEL[item.status]}
                      </span>
                    </div>
                    <p className="truncate font-medium text-slate-900">{item.title}</p>
                    <p className="mt-0.5 line-clamp-1 text-sm text-slate-500">{item.body}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {formatWhen(item.createdAt)}
                      {item.replyCount > 0 && ` · 답변 ${item.replyCount}`}
                    </p>
                  </div>
                </button>

                {expanded && (
                  <div className="border-t border-slate-100 bg-slate-50/60 p-4">
                    <p className="mb-3 whitespace-pre-wrap text-sm text-slate-700">
                      {item.body}
                    </p>

                    {repliesLoading ? (
                      <div className="flex justify-center py-3">
                        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                      </div>
                    ) : (
                      <ul className="mb-3 space-y-2">
                        {replies.map((r) => (
                          <li
                            key={r.id}
                            className={`rounded-lg px-3 py-2 text-sm shadow-sm ${
                              r.authorType === "admin" ? "bg-emerald-50" : "bg-white"
                            }`}
                          >
                            <p className="whitespace-pre-wrap text-slate-700">{r.body}</p>
                            <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
                              <MessageCircle className="h-3 w-3" />
                              {r.authorType === "admin" ? `운영진 · ${r.authorName}` : r.authorName}{" "}
                              · {formatWhen(r.createdAt)}
                            </p>
                          </li>
                        ))}
                        {replies.length === 0 && (
                          <li className="text-xs text-slate-400">아직 답변이 없습니다.</li>
                        )}
                      </ul>
                    )}

                    <div className="flex gap-2">
                      <input
                        className={`${inputClass} flex-1`}
                        placeholder="추가로 남길 말"
                        value={replyBody}
                        onChange={(e) => setReplyBody(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleReply(item.id);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleReply(item.id)}
                        disabled={replying || !replyBody.trim()}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {replying ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
