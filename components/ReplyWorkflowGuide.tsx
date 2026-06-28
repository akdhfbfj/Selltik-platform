"use client";

type ActiveStep = 1 | 2 | 3 | 4;

interface Props {
  activeStep: ActiveStep;
  queueCount: number;
  selectedCount: number;
}

const STEPS: {
  step: ActiveStep;
  title: string;
  description: string;
}[] = [
  {
    step: 1,
    title: "답장 분석",
    description: "문자·캡처 붙여넣기 → 분석하기",
  },
  {
    step: 2,
    title: "양식 기입·저장",
    description: "정식 제품명·우편번호·주소 변환 → 목록에 저장",
  },
  {
    step: 3,
    title: "목록 누적",
    description: "저장한 발주 건이 아래에 쌓임",
  },
  {
    step: 4,
    title: "발주서 작성",
    description: "전체 또는 선택 건만 발주 탭으로",
  },
];

export default function ReplyWorkflowGuide({
  activeStep,
  queueCount,
  selectedCount,
}: Props) {
  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">
        작업 순서
      </p>
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(({ step, title, description }) => {
          const isActive = activeStep === step;
          const isDone =
            (step === 1 && activeStep > 1) ||
            (step === 2 && activeStep > 2) ||
            (step === 3 && queueCount > 0 && activeStep >= 3);

          return (
            <li
              key={step}
              className={`rounded-xl border px-3 py-2.5 transition-colors ${
                isActive
                  ? "border-emerald-300 bg-emerald-50"
                  : isDone
                    ? "border-slate-200 bg-slate-50"
                    : "border-slate-100 bg-white"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isActive
                      ? "bg-emerald-600 text-white"
                      : isDone
                        ? "bg-slate-300 text-white"
                        : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {step}
                </span>
                <span
                  className={`text-sm font-semibold ${
                    isActive ? "text-emerald-900" : "text-slate-800"
                  }`}
                >
                  {title}
                </span>
              </div>
              <p className="mt-1 pl-8 text-xs leading-relaxed text-slate-500">
                {description}
              </p>
              {step === 3 && queueCount > 0 && (
                <p className="mt-1 pl-8 text-xs font-medium text-emerald-700">
                  {queueCount}건 저장됨
                </p>
              )}
              {step === 4 && queueCount > 0 && (
                <p className="mt-1 pl-8 text-xs font-medium text-emerald-700">
                  선택 {selectedCount}건 → 발주 탭
                </p>
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
        「목록에 저장」은 발주 DB 저장이 아닙니다. 발주 탭에서 최종 확인 후
        저장하세요.
      </p>
    </div>
  );
}

export function getReplyActiveStep(input: {
  hasDraft: boolean;
  isRefined: boolean;
  queueCount: number;
}): ActiveStep {
  if (input.queueCount > 0 && !input.hasDraft) return 4;
  if (input.hasDraft) return 2;
  return 1;
}
