"use client";

import { useCallback, useEffect, useState } from "react";
import type { Contact, ContactStatus } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/types";
import ContactForm from "@/components/ContactForm";
import ContactCard from "@/components/ContactCard";
import FilterBar from "@/components/FilterBar";
import StatsBar from "@/components/StatsBar";
import AdminNav from "@/components/AdminNav";
import AdminOrderStatsPanel from "@/components/AdminOrderStatsPanel";
import type { AdminOrderStats } from "@/lib/admin-order-stats";
import { currentMonthRange } from "@/lib/date-range";
import { Building2, Plus, X } from "lucide-react";

export default function HomePage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ContactStatus | "all">("all");
  const [tagFilter, setTagFilter] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [stats, setStats] = useState<{ total: number; byStatus: Record<string, number> }>({
    total: 0,
    byStatus: {},
  });
  const [orderStats, setOrderStats] = useState<AdminOrderStats | null>(null);
  const [orderStatsLoading, setOrderStatsLoading] = useState(true);

  const fetchContacts = useCallback(async () => {
    const res = await fetch("/api/contacts");
    const data = await res.json();
    setContacts(data.contacts);
    setStats(data.stats);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  useEffect(() => {
    const { from, to } = currentMonthRange();
    fetch(`/api/admin/orders/stats?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setOrderStats(data))
      .finally(() => setOrderStatsLoading(false));
  }, []);

  const allTags = Array.from(
    new Set(
      contacts.flatMap((c) =>
        c.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      )
    )
  ).sort();

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      c.companyName.toLowerCase().includes(q) ||
      c.contactPerson.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      c.notes.toLowerCase().includes(q) ||
      c.tags.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    const matchesTag =
      !tagFilter ||
      c.tags
        .split(",")
        .map((t) => t.trim())
        .includes(tagFilter);
    return matchesSearch && matchesStatus && matchesTag;
  });

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingContact(null);
    fetchContacts();
  };

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 업체 정보를 삭제할까요?")) return;
    await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    fetchContacts();
  };

  const handleStatusChange = async (id: string, status: ContactStatus) => {
    await fetch(`/api/contacts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchContacts();
  };

  const exportCsv = () => {
    const headers = [
      "업체명",
      "담당자",
      "전화",
      "이메일",
      "웹사이트",
      "메모",
      "상태",
      "태그",
      "등록일",
    ];
    const rows = filtered.map((c) => [
      c.companyName,
      c.contactPerson,
      c.phone,
      c.email,
      c.website,
      c.notes,
      STATUS_LABELS[c.status],
      c.tags,
      new Date(c.createdAt).toLocaleDateString("ko-KR"),
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `업체연락처_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
      <AdminNav />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <AdminOrderStatsPanel
            stats={orderStats}
            loading={orderStatsLoading}
            compact
          />
        </section>

        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">업체 컨택</h2>
            <p className="text-sm text-slate-500">업체 연락처 등록 및 진행 관리</p>
          </div>
          <button
            onClick={() => {
              setEditingContact(null);
              setShowForm(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            업체 등록
          </button>
        </div>
        <StatsBar stats={stats} onStatusClick={setStatusFilter} activeStatus={statusFilter} />

        <FilterBar
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          tagFilter={tagFilter}
          onTagChange={setTagFilter}
          tags={allTags}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onExport={exportCsv}
          resultCount={filtered.length}
          totalCount={contacts.length}
        />

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/50 py-20 text-center">
            <Building2 className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-4 text-lg font-medium text-slate-600">
              {contacts.length === 0 ? "아직 등록된 업체가 없습니다" : "검색 결과가 없습니다"}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              업체 정보를 등록하거나 캡처 이미지를 업로드해보세요
            </p>
            {contacts.length === 0 && (
              <button
                onClick={() => setShowForm(true)}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
              >
                <Plus className="h-4 w-4" />
                첫 업체 등록하기
              </button>
            )}
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((contact) => (
              <ContactCard
                key={contact.id}
                contact={contact}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onStatusChange={handleStatusChange}
                onRefresh={fetchContacts}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((contact) => (
              <ContactCard
                key={contact.id}
                contact={contact}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onStatusChange={handleStatusChange}
                onRefresh={fetchContacts}
                variant="list"
              />
            ))}
          </div>
        )}
      </main>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900">
                {editingContact ? "업체 정보 수정" : "새 업체 등록"}
              </h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingContact(null);
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ContactForm
              contact={editingContact}
              onSuccess={handleFormSuccess}
              onCancel={() => {
                setShowForm(false);
                setEditingContact(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
