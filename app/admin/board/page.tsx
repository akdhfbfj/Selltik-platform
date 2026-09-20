"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ADMIN_API,
  fetchAdminApi,
  peekAdminApiData,
} from "@/lib/admin-api-cache";
import AdminNav from "@/components/AdminNav";
import { ADMIN_MEMBERS } from "@/lib/admin-team";
import type { WorkItem, WorkItemReply, WorkItemStatus, WorkItemType } from "@/lib/types";
import {
  CheckCircle2,
  Clock,
  Loader2,
  MessageCircle,
  MessagesSquare,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";

type TypeFilter = "all" | WorkItemType;
type StatusFilter = "all" | WorkItemStatus;
type WorkItemsPayload = { items: WorkItem[] };
type MePayload = { name: string };

const STATUS_LABEL: Record<WorkItemStatus, string> = {
  open: "대기",
  answered: "답변완료",
  done: "처리완료",
};

const STATUS_CLASS: Record<WorkItemStatus, string> = {
  open: "bg-amber-50 text-amber-700 border-amber-200",
  answered: "bg-blue-50 text-blue-700 border-blue-200",
  done: "bg-green-50 text-green-700 border-green-200",
};

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function itemKindLabel(item: WorkItem): string {
  return item.type === "task" ? "업무 지시" : `셀러 문의 · ${item.shopName}`;
}

export default function AdminBoardPage() {
  const [items, setItems] = useState<WorkItem[]>(
    () => peekAdminApiData<WorkItemsPayload>(ADMIN_API.workItems)?.items ?? []
  );
  const [loading, setLoading] = useState(
    () => !peekAdminApiData<WorkItemsPayload>(ADMIN_API.workItems)
  );
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  const [myName, setMyName] = useState(
    () => peekAdminApiData<MePayload>(ADMIN_API.me)?.name ?? ""
  );
  const [namePrompt, setNamePrompt] = useState<string>(ADMIN_MEMBERS[0]);
  const [settingName, setSettingName] = useState(false);

  const [composing, setComposing] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", assignee: "" });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replies, setReplies] = useState<WorkItemReply[]>([]);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [replying, setReplying] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: "", body: "", assignee: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadMe = useCallback(async (force = false) => {
    const res = await fetchAdminApi<MePayload>(ADMIN_API.me, { force });
    if (res.ok && res.data) {
      setMyName(res.data.name ?? "");
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const loadItems = useCallback(
    async (force = false) => {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const url = `/api/admin/work-items?${params}`;
      if (!peekAdminApiData(url)) setLoading(true);
      const res = await fetchAdminApi<WorkItemsPayload>(url, { force });
      if (res.ok && res.data) {
        setItems(res.data.items);
      }
      setLoading(false);
    },
    [typeFilter, statusFilter]
  );

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleSetName = async () => {
    setSettingName(true);
    const res = await fetch("/api/admin/me", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: namePrompt }),
    });
    if (res.ok) await loadMe(true);
    setSettingName(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) return;
    setCreating(true);
    setError("");

    const res = await fetch("/api/admin/work-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "등록에 실패했습니다.");
    } else {
      setForm({ title: "", body: "", assignee: "" });
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
    const res = await fetch(`/api/admin/work-items/${id}`);
    if (res.ok) {
      const data = await res.json();
      setReplies(data.replies);
    }
    setRepliesLoading(false);
  };

  const handleStatusChange = async (id: string, status: WorkItemStatus) => {
    const res = await fetch(`/api/admin/work-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) await loadItems(true);
  };

  const handleReply = async (id: string) => {
    if (!replyBody.trim()) return;
    setReplying(true);
    const res = await fetch(`/api/admin/work-items/${id}/replies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: replyBody }),
    });
    if (res.ok) {
      setReplyBody("");
      const detail = await fetch(`/api/admin/work-items/${id}`);
      if (detail.ok) {
        const data = await detail.json();
        setReplies(data.replies);
      }
      await loadItems(true);
    }
    setReplying(false);
  };

  const startEdit = (item: WorkItem) => {
    setEditingId(item.id);
    setEditForm({ title: item.title, body: item.body, assignee: item.assignee });
  };

  const handleSaveEdit = async (id: string) => {
    if (!editForm.title.trim() || !editForm.body.trim()) return;
    setSavingEdit(true);
    const res = await fetch(`/api/admin/work-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    if (res.ok) {
      setEditingId(null);
      await loadItems(true);
    }
    setSavingEdit(false);
  };

  const handleDelete = async (item: WorkItem) => {
    if (!confirm(`「${item.title}」을(를) 삭제할까요? 답변도 함께 삭제됩니다.`)) {
      return;
    }
    setDeletingId(item.id);
    const res = await fetch(`/api/admin/work-items/${item.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      if (expandedId === item.id) setExpandedId(null);
      await loadItems(true);
    }
    setDeletingId(null);
  };

  const inputClass =
    "w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

  const visibleItems = items.filter((item) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      item.title.toLowerCase().includes(q) ||
      item.body.toLowerCase().includes(q) ||
      item.authorName.toLowerCase().includes(q) ||
      item.assignee.toLowerCase().includes(q) ||
      item.shopName.toLowerCase().includes(q)
    );
  });

  const filterBtn = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-xs font-medium transition ${
      active
        ? "bg-brand-600 text-white"
        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
    }`;

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <MessagesSquare className="h-7 w-7 text-brand-600" />
            업무·문의 게시판
          </h2>
          {myName && (
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
              나: {myName}
            </span>
          )}
        </div>
        <p className="mb-4 text-sm text-slate-500">
          운영진 업무 지시와 셀러 문의를 한 화면에서 확인·답변합니다.
        </p>

        {myName === "" && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="mb-2 text-sm font-medium text-amber-900">
              닉네임을 아직 등록하지 않은 세션이에요. 이번 한 번만 선택해주세요.
            </p>
            <div className="flex flex-wrap gap-2">
              <select
                className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm"
                value={namePrompt}
                onChange={(e) => setNamePrompt(e.target.value)}
              >
                {ADMIN_MEMBERS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleSetName}
                disabled={settingName}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {settingName ? "저장 중…" : "확인"}
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setComposing((c) => !c)}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
        >
          {composing ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {composing ? "닫기" : "새 업무 지시"}
        </button>

        {composing && (
          <form
            onSubmit={handleCreate}
            className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Plus className="h-4 w-4" />
              새 업무 지시
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
              <div className="flex flex-wrap gap-3">
                <input
                  className={`${inputClass} w-auto flex-1 min-w-[10rem]`}
                  placeholder="담당자 (선택)"
                  value={form.assignee}
                  onChange={(e) => setForm((f) => ({ ...f, assignee: e.target.value }))}
                />
                <button
                  type="submit"
                  disabled={creating || !myName}
                  className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                  등록
                </button>
              </div>
            </div>
            {error && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}
          </form>
        )}

        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className={`${inputClass} pl-9`}
            placeholder="제목, 내용, 작성자로 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100"
              aria-label="검색어 지우기"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500">종류</span>
          {(["all", "task", "inquiry"] as TypeFilter[]).map((t) => (
            <button
              key={t}
              type="button"
              className={filterBtn(typeFilter === t)}
              onClick={() => setTypeFilter(t)}
            >
              {t === "all" ? "전체" : t === "task" ? "업무 지시" : "셀러 문의"}
            </button>
          ))}
          <span className="ml-3 text-xs font-medium text-slate-500">상태</span>
          {(["all", "open", "answered", "done"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              type="button"
              className={filterBtn(statusFilter === s)}
              onClick={() => setStatusFilter(s)}
            >
              {s === "all" ? "전체" : STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-400">
            {search ? "검색 결과가 없습니다." : "해당 조건의 항목이 없습니다."}
          </div>
        ) : (
          <ul className="space-y-3">
            {visibleItems.map((item) => {
              const stale = item.status !== "done" && daysSince(item.createdAt) >= 3;
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
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                            item.type === "task"
                              ? "border-slate-200 bg-slate-50 text-slate-600"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {itemKindLabel(item)}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASS[item.status]}`}
                        >
                          {STATUS_LABEL[item.status]}
                        </span>
                        {stale && (
                          <span className="flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">
                            <Clock className="h-3 w-3" />
                            {daysSince(item.createdAt)}일째 방치
                          </span>
                        )}
                      </div>
                      <p className="truncate font-medium text-slate-900">{item.title}</p>
                      <p className="mt-0.5 line-clamp-1 text-sm text-slate-500">{item.body}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {item.authorName} · {formatWhen(item.createdAt)}
                        {item.assignee && ` · 담당: ${item.assignee}`}
                        {item.replyCount > 0 && ` · 답변 ${item.replyCount}`}
                      </p>
                    </div>
                  </button>

                  {expanded && (
                    <div className="border-t border-slate-100 bg-slate-50/60 p-4">
                      {editingId === item.id ? (
                        <div className="mb-3 space-y-2">
                          <input
                            className={inputClass}
                            value={editForm.title}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, title: e.target.value }))
                            }
                            placeholder="제목"
                          />
                          <textarea
                            className={`${inputClass} min-h-[72px] resize-y`}
                            value={editForm.body}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, body: e.target.value }))
                            }
                            placeholder="내용"
                          />
                          <input
                            className={inputClass}
                            value={editForm.assignee}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, assignee: e.target.value }))
                            }
                            placeholder="담당자 (선택)"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(item.id)}
                              disabled={savingEdit}
                              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                            >
                              {savingEdit && <Loader2 className="h-3 w-3 animate-spin" />}
                              저장
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600"
                            >
                              취소
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="mb-3 whitespace-pre-wrap text-sm text-slate-700">
                          {item.body}
                        </p>
                      )}

                      <div className="mb-3 flex flex-wrap items-center gap-1.5">
                        {(["open", "answered", "done"] as WorkItemStatus[]).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => handleStatusChange(item.id, s)}
                            className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium ${
                              item.status === s
                                ? STATUS_CLASS[s]
                                : "border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
                            }`}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            {STATUS_LABEL[s]}
                          </button>
                        ))}
                        <span className="mx-0.5 h-4 w-px bg-slate-200" />
                        {item.authorType === "admin" && item.authorName === myName && (
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                          >
                            <Pencil className="h-3 w-3" />
                            수정
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          disabled={deletingId === item.id}
                          className="flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          {deletingId === item.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                          삭제
                        </button>
                      </div>

                      {repliesLoading ? (
                        <div className="flex justify-center py-3">
                          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                        </div>
                      ) : (
                        <ul className="mb-3 space-y-2">
                          {replies.map((r) => (
                            <li
                              key={r.id}
                              className="rounded-lg bg-white px-3 py-2 text-sm shadow-sm"
                            >
                              <p className="whitespace-pre-wrap text-slate-700">{r.body}</p>
                              <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
                                <MessageCircle className="h-3 w-3" />
                                {r.authorName} · {formatWhen(r.createdAt)}
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
                          placeholder="답변 입력"
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
                          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
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
    </div>
  );
}
