"use client";

import { useCallback, useEffect, useState } from "react";
import AdminNav from "@/components/AdminNav";
import type { Shop } from "@/lib/types";
import { KeyRound, Loader2, Plus, Store, Users } from "lucide-react";

export default function AdminShopsPage() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    name: "",
    contactEmail: "",
    password: "",
  });
  const [resetShopId, setResetShopId] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  const loadShops = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/shops");
    if (res.ok) {
      const data = await res.json();
      setShops(data.shops);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadShops();
  }, [loadShops]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    const res = await fetch("/api/admin/shops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "등록에 실패했습니다.");
    } else {
      setSuccess(`${data.name} 셀러 계정이 생성되었습니다.`);
      setForm({ name: "", contactEmail: "", password: "" });
      loadShops();
    }
    setSaving(false);
  };

  const handleResetPassword = async () => {
    if (!resetShopId || !tempPassword) return;
    setResetting(true);
    setError("");
    setSuccess("");

    const res = await fetch(`/api/admin/shops/${resetShopId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: tempPassword }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "임시 비밀번호 발급에 실패했습니다.");
    } else {
      setSuccess(
        `${data.shopName} 셀러에게 전달할 임시 비밀번호가 설정되었습니다.`
      );
      setResetShopId(null);
      setTempPassword("");
    }
    setResetting(false);
  };

  const inputClass =
    "w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

  const resetTarget = shops.find((s) => s.id === resetShopId);

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav />
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Users className="h-7 w-7 text-brand-600" />
            셀러 계정 관리
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            셀러 로그인용 계정을 만들고, 비밀번호 분실 시 임시 비밀번호를 발급합니다.
          </p>
        </div>

        {resetShopId && resetTarget && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
            <h3 className="flex items-center gap-2 font-semibold text-slate-900">
              <KeyRound className="h-5 w-5 text-amber-600" />
              임시 비밀번호 발급 — {resetTarget.name}
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              {resetTarget.contactEmail} · 셀러에게 직접 전달하세요.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                type="text"
                className={`${inputClass} min-w-[12rem] flex-1`}
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                placeholder="임시 비밀번호 (6자 이상)"
                minLength={6}
              />
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={resetting || tempPassword.length < 6}
                className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
              >
                {resetting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "발급"
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setResetShopId(null);
                  setTempPassword("");
                }}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600 hover:bg-white"
              >
                취소
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
              <Plus className="h-5 w-5" />
              새 셀러 등록
            </h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  쇼핑몰 이름
                </label>
                <input
                  className={inputClass}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="예: 띵동이네"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  로그인 이메일
                </label>
                <input
                  type="email"
                  className={inputClass}
                  value={form.contactEmail}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, contactEmail: e.target.value }))
                  }
                  placeholder="seller@example.com"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  초기 비밀번호
                </label>
                <input
                  type="password"
                  className={inputClass}
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                  placeholder="6자 이상"
                  minLength={6}
                  required
                  autoComplete="new-password"
                />
              </div>
            </div>

            {error && (
              <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}
            {success && (
              <p className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                {success}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              셀러 계정 만들기
            </button>
          </form>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 font-semibold text-slate-900">등록된 셀러</h3>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : shops.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">
                아직 등록된 셀러가 없습니다.
              </p>
            ) : (
              <ul className="space-y-3">
                {shops.map((shop) => (
                  <li
                    key={shop.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <Store className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">{shop.name}</p>
                        <p className="text-sm text-slate-500">{shop.contactEmail}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setResetShopId(shop.id);
                        setTempPassword("");
                        setError("");
                        setSuccess("");
                      }}
                      className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
                    >
                      임시 PW
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-xs text-slate-400">
              셀러 로그인: /seller/login
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
