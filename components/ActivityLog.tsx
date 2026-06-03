"use client";

import { useCallback, useEffect, useState } from "react";
import type { ContactActivity } from "@/lib/types";
import { Loader2, MessageSquare, Trash2 } from "lucide-react";

interface Props {
  contactId: string;
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ActivityLog({ contactId }: Props) {
  const [activities, setActivities] = useState<ContactActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [author, setAuthor] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const fetchActivities = useCallback(async () => {
    const res = await fetch(`/api/contacts/${contactId}/activities`);
    if (res.ok) {
      setActivities(await res.json());
    }
    setLoading(false);
  }, [contactId]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setSaving(true);
    const res = await fetch(`/api/contacts/${contactId}/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.trim(), author: author.trim() }),
    });
    if (res.ok) {
      setContent("");
      await fetchActivities();
    }
    setSaving(false);
  };

  const handleDelete = async (activityId: string) => {
    if (!confirm("이 기록을 삭제할까요?")) return;
    await fetch(`/api/contacts/${contactId}/activities/${activityId}`, {
      method: "DELETE",
    });
    fetchActivities();
  };

  const visible = showAll ? activities : activities.slice(0, 3);

  return (
    <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/80 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
        <MessageSquare className="h-3.5 w-3.5" />
        활동 기록
        {activities.length > 0 && (
          <span className="font-normal text-slate-400">({activities.length})</span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        </div>
      ) : visible.length > 0 ? (
        <ul className="mb-3 space-y-2">
          {visible.map((a) => (
            <li
              key={a.id}
              className="group flex items-start justify-between gap-2 rounded-md bg-white px-2.5 py-2 text-xs"
            >
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-wrap text-slate-700">{a.content}</p>
                <p className="mt-1 text-[10px] text-slate-400">
                  {formatWhen(a.createdAt)}
                  {a.author && ` · ${a.author}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(a.id)}
                className="shrink-0 rounded p-1 text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-3 text-xs text-slate-400">아직 기록이 없습니다</p>
      )}

      {activities.length > 3 && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="mb-2 text-xs text-brand-600 hover:text-brand-700"
        >
          {showAll ? "접기" : `이전 기록 ${activities.length - 3}개 더보기`}
        </button>
      )}

      <form onSubmit={handleAdd} className="space-y-2">
        <input
          className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-brand-400"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="예: 3/15 전화함, 샘플 요청"
        />
        <div className="flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-brand-400"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="작성자 (선택)"
          />
          <button
            type="submit"
            disabled={saving || !content.trim()}
            className="shrink-0 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? "..." : "기록"}
          </button>
        </div>
      </form>
    </div>
  );
}
