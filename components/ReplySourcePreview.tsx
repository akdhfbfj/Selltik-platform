"use client";

interface Props {
  imageUrl: string | null;
  loading?: boolean;
  /** 좌측 고정 패널용 컴팩트 높이 */
  compact?: boolean;
}

export default function ReplySourcePreview({
  imageUrl,
  loading,
  compact = false,
}: Props) {
  const shellClass = compact
    ? "min-h-0"
    : "min-h-[200px]";
  const imgMaxH = compact ? "max-h-[45vh]" : "max-h-[480px]";
  if (loading) {
    return (
      <div className={`flex h-full ${shellClass} flex-col rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-4`}>
        <p className="text-xs font-semibold text-slate-600">붙여넣은 스크린샷</p>
        <p className="mt-4 flex flex-1 items-center justify-center text-sm text-slate-400">
          이미지 분석 중…
        </p>
      </div>
    );
  }

  if (!imageUrl) {
    return (
      <div className={`flex h-full ${shellClass} flex-col rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4`}>
        <p className="text-xs font-semibold text-slate-600">붙여넣은 스크린샷</p>
        <p className="mt-4 flex flex-1 items-center justify-center text-center text-xs leading-relaxed text-slate-400">
          왼쪽에 스크린샷을
          <br />
          Ctrl+V로 붙여넣으면
          <br />
          여기에 그대로 표시됩니다
        </p>
      </div>
    );
  }

  return (
    <div className={`flex h-full ${shellClass} flex-col rounded-xl border border-slate-200 bg-slate-50/80 p-3`}>
      <p className="mb-2 text-xs font-semibold text-slate-600">붙여넣은 스크린샷</p>
      <div className="flex flex-1 items-start justify-center overflow-auto rounded-lg bg-white p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="답장 스크린샷"
          className={`${imgMaxH} w-full object-contain`}
        />
      </div>
    </div>
  );
}
