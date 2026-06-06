"use client";

import { useCallback, useEffect, useState } from "react";
import AdminNav from "@/components/AdminNav";
import { formatKrw } from "@/lib/parse-supply-csv";
import type { MasterProduct } from "@/lib/types";
import { Loader2, Package, Upload } from "lucide-react";

export default function AdminProductsPage() {
  const [products, setProducts] = useState<MasterProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadProducts = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/products");
    if (res.ok) {
      const data = await res.json();
      setProducts(data.products);
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
            셀틱 공급가 CSV를 업로드하면 모든 셀러에게 동일 상품이 반영됩니다.
          </p>
        </div>

        <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-3 font-semibold text-slate-900">CSV 업로드</h3>
          <p className="mb-4 text-sm text-slate-500">
            「셀틱 공급가(셀러 공유용)」 CSV 파일을 선택하세요. 기존 상품은
            이름 기준으로 갱신됩니다.
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
          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
          {success && (
            <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
              {success}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-semibold text-slate-900">
            등록된 상품 ({products.length}개)
          </h3>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : products.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              CSV를 업로드해주세요.
            </p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-white text-xs text-slate-500">
                  <tr className="border-b border-slate-100">
                    <th className="pb-2 pr-4 font-medium">상품명</th>
                    <th className="pb-2 pr-4 font-medium">판매가</th>
                    <th className="pb-2 pr-4 font-medium">매입가</th>
                    <th className="pb-2 font-medium">택배비</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {products.map((p) => (
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
                      <td className="py-2.5 text-slate-500">
                        {formatKrw(p.baseShipping)}
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
