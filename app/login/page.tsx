"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Loader2 } from "lucide-react";

function LoginForm() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/inbox";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });

    if (res.ok) {
      router.push(from);
      router.refresh();
    } else {
      setError("비밀번호가 틀렸습니다.");
    }
    setLoading(false);
  };

  return (
    <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/25">
          <Lock className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">셀틱 로그인</h1>
        <p className="mt-1 text-sm text-slate-500">
          관리 페이지는 비밀번호가 필요합니다
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            비밀번호
          </label>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-lg tracking-widest outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            placeholder="••••"
            autoFocus
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !pin}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          들어가기
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-slate-400">
        셀러분은{" "}
        <a href="/recommend" className="text-brand-600 underline">
          추천 페이지
        </a>
        를 이용해주세요
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 p-4">
      <Suspense
        fallback={
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
