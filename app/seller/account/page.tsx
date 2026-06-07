"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { SELLER_INPUT_CLASS } from "@/lib/seller-ui";
import { Check, Loader2, Lock, User } from "lucide-react";

export default function SellerAccountPage() {
  const [email, setEmail] = useState("");
  const [shopName, setShopName] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetch("/api/seller/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setEmail(data.email ?? "");
          setShopName(data.shop?.name ?? "");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword.length < 6) {
      setError("새 비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("새 비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setSaving(true);
    const supabase = createBrowserSupabaseClient();

    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: currentPassword,
      });

      if (verifyError) {
        setError("현재 비밀번호가 올바르지 않습니다.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError("비밀번호 변경에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }

      setSuccess("비밀번호가 변경되었습니다.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError("비밀번호 변경 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:px-6">
      <h2 className="text-2xl font-bold text-slate-900">내 계정</h2>
      <p className="mt-1 text-sm text-slate-500">
        로그인 정보 확인 및 비밀번호 변경
      </p>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
          <User className="h-5 w-5 text-emerald-600" />
          개인정보
        </h3>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs font-medium text-slate-500">쇼핑몰 이름</dt>
            <dd className="mt-0.5 font-medium text-slate-900">{shopName}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">로그인 이메일</dt>
            <dd className="mt-0.5 font-medium text-slate-900">{email}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-slate-400">
          쇼핑몰 이름·이메일 변경은 셀틱 관리자에게 문의해 주세요.
        </p>
      </div>

      <form
        onSubmit={handlePasswordChange}
        className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
          <Lock className="h-5 w-5 text-emerald-600" />
          비밀번호 변경
        </h3>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              현재 비밀번호
            </label>
            <input
              type="password"
              className={SELLER_INPUT_CLASS}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              새 비밀번호
            </label>
            <input
              type="password"
              className={SELLER_INPUT_CLASS}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={6}
              required
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              새 비밀번호 확인
            </label>
            <input
              type="password"
              className={SELLER_INPUT_CLASS}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          비밀번호 변경
        </button>

        <p className="mt-4 text-xs text-slate-400">
          비밀번호를 잊으셨다면 셀틱 관리자에게 임시 비밀번호를 요청하세요.
        </p>
      </form>
    </div>
  );
}
