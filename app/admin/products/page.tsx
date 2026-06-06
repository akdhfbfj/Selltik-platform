"use client";

import { useCallback, useEffect, useState } from "react";
import AdminNav from "@/components/AdminNav";
import { formatKrw } from "@/lib/parse-supply-csv";
import type { MasterProduct, MasterProductInput } from "@/lib/types";
import { Loader2, Package, Pencil, Plus, Trash2, Upload, X } from "lucide-react";

const emptyForm: MasterProductInput = {
  officialName: "",
  description: "",
  purchasePrice: 0,
  baseShipping: 0,
  consumerPrice: 0,
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<MasterProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MasterProductInput>({ ...emptyForm });

  const loadProducts = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/products");
    const data = await res.json();
    if (res.ok) {
      setProducts(data.products);
    } else {
      setError(data.error || "목록을 불러오지 못했습니다.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");
    setSuccess("");

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/admin/products/import", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "업로드에 실패했습니다.");
    } else {
      setSuccess(data.message);
      loadProducts();
    }
    setUploading(false);
    e.target.value = "";
  };

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setShowForm(true);
    setError("");
  };

  const openEdit = (p: MasterProduct) => {
    setEditingId(p.id);
    setForm({
      officialName: p.officialName,
      description: p.description,
      purchasePrice: p.purchasePrice,
      baseShipping: p.baseShipping,
      consumerPrice: p.consumerPrice,
      profitAmount: p.profitAmount,
      profitRate: p.profitRate,
    });
    setShowForm(true);
    setError("");
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    const url = editingId
      ? `/api/admin/products/${editingId}`
      : "/api/admin/products";
    const method = editingId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "저장에 실패했습니다.");
    } else {
      setSuccess(editingId ? "상품이 수정되었습니다." : "상품이 추가되었습니다.");
      closeForm();
      loadProducts();
    }
    setSaving(false);
  };

  const handleDelete = async (p: MasterProduct) => {
    if (!confirm(`「${p.officialName}」을(를) 삭제할까요?`)) return;

    const res = await fetch(`/api/admin/products/${p.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "삭제에 실패했습니다.");
    } else {
      setSuccess("상품이 삭제되었습니다.");
      loadProducts();
    }
  };

  const filtered = products.filter((p) =>
    p.officialName.toLowerCase().includes(query.toLowerCase())
  );

  const inputClass =
    "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Package className="h-7 w-7 text-brand-600" />
            공급가·상품 관리
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            CSV로 처음 일괄 등록하고, 이후 변경·추가는 여기서 직접 수정하세요.
          </p>
        </div>

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-3 font-semibold text-slate-900">CSV 일괄 업로드</h3>
          <p className="mb-4 text-sm text-slate-500">
            CSV는 기존 상품 가격·정보 <strong>갱신</strong>용입니다. 신규 상품은
            아래 「상품 추가」로 등록하세요. 변경 시 셀러에게 확인 요청이
            가며, 셀러의 문자용 상품명은 바뀌지 않습니다.
          </p>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700">
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            CSV 파일 선택
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              disabled={uploading}
              onChange={handleUpload}
            />
          </label>
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        {success && (
          <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            {success}
          </p>
        )}

        {showForm && (
          <form
            onSubmit={handleSave}
            className="mb-6 rounded-2xl border border-brand-200 bg-brand-50/30 p-6 shadow-sm"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">
                {editingId ? "상품 수정" : "상품 추가"}
              </h3>
              <button type="button" onClick={closeForm} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  상품명 *
                </label>
                <input
                  className={inputClass}
                  value={form.officialName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, officialName: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  설명
                </label>
                <input
                  className={inputClass}
                  value={form.description ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  판매가 (원) *
                </label>
                <input
                  type="number"
                  className={inputClass}
                  value={form.consumerPrice || ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      consumerPrice: parseInt(e.target.value, 10) || 0,
                    }))
                  }
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  매입가 (원)
                </label>
                <input
                  type="number"
                  className={inputClass}
                  value={form.purchasePrice || ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      purchasePrice: parseInt(e.target.value, 10) || 0,
                    }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  택배비 (원)
                </label>
                <input
                  type="number"
                  className={inputClass}
                  value={form.baseShipping || ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      baseShipping: parseInt(e.target.value, 10) || 0,
                    }))
                  }
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="mt-4 flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? "수정 저장" : "상품 추가"}
            </button>
          </form>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold text-slate-900">
              등록된 상품 ({products.length}개)
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <input
                className={`${inputClass} w-48`}
                placeholder="상품명 검색"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button
                onClick={openAdd}
                className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
              >
                <Plus className="h-4 w-4" />
                상품 추가
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              {products.length === 0
                ? "CSV를 업로드하거나 상품을 직접 추가해주세요."
                : "검색 결과가 없습니다."}
            </p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-white text-xs text-slate-500">
                  <tr className="border-b border-slate-100">
                    <th className="pb-2 pr-4 font-medium">상품명</th>
                    <th className="pb-2 pr-4 font-medium">판매가</th>
                    <th className="pb-2 pr-4 font-medium">매입가</th>
                    <th className="pb-2 pr-4 font-medium">택배비</th>
                    <th className="pb-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2.5 pr-4 font-medium text-slate-800">
                        {p.officialName}
                      </td>
                      <td className="py-2.5 pr-4 text-slate-600">
                        {formatKrw(p.consumerPrice)}
                      </td>
                      <td className="py-2.5 pr-4 text-slate-500">
                        {formatKrw(p.purchasePrice)}
                      </td>
                      <td className="py-2.5 pr-4 text-slate-500">
                        {formatKrw(p.baseShipping)}
                      </td>
                      <td className="py-2.5">
                        <div className="flex gap-1">
                          <button
                            onClick={() => openEdit(p)}
                            className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
                            title="수정"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(p)}
                            className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            title="삭제"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
