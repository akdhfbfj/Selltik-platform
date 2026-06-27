"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function SellerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h2 className="text-xl font-bold text-slate-900">페이지를 불러오지 못했습니다</h2>
      <p className="mt-2 text-sm text-slate-600">
        Supabase 연결 또는 DB 마이그레이션 문제일 수 있습니다.
      </p>
      <ul className="mt-4 space-y-1 text-left text-xs text-slate-500">
        <li>· 터미널에서 dev 서버를 하나만 실행하세요 (포트 3000)</li>
        <li>· `.next` 폴더 삭제 후 `npm run dev` 재시작</li>
        <li>· Supabase SQL Editor에서 012, 013 마이그레이션 실행</li>
      </ul>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          다시 시도
        </button>
        <Link
          href="/seller/login"
          className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          로그인으로
        </Link>
      </div>
    </div>
  );
}
