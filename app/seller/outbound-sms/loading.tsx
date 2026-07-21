/** 안내 문자 페이지 골격 — 데이터 대기 중에도 레이아웃이 바로 보이게 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-6 shadow-sm">
        <div className="mb-4 h-5 w-36 animate-pulse rounded bg-slate-200" />
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 h-4 w-28 animate-pulse rounded bg-slate-100" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="h-[72px] animate-pulse rounded-xl bg-slate-100" />
            <div className="h-[72px] animate-pulse rounded-xl bg-slate-100" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="h-10 animate-pulse rounded-xl bg-white/80" />
            <div className="h-40 animate-pulse rounded-xl border-2 border-slate-200 bg-white" />
          </div>
          <div className="h-60 animate-pulse rounded-xl bg-white/80" />
        </div>
      </div>
    </div>
  );
}
