"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { bundleLineToOrderPayload } from "@/lib/order-draft-helpers";
import { saveOrderPayloadsInChunks } from "@/lib/save-order-bundles";
import {
  SMS_IMPORT_STEPS,
  type SmsImportStepId,
} from "@/lib/orders-routes";
import type { SmsImportParseResult } from "@/lib/sms-import-batch";
import {
  filterSmsBackupMessages,
  formatSmsPreview,
  parseSmsBackupFile,
  type SmsBackupMessage,
} from "@/lib/sms-backup-xml";
import { SELLER_INPUT_CLASS } from "@/lib/seller-ui";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardCheck,
  FileUp,
  Filter,
  ListChecks,
  Loader2,
  Sparkles,
} from "lucide-react";

const STEP_ICONS: Record<SmsImportStepId, typeof FileUp> = {
  upload: FileUp,
  filter: Filter,
  preview: ListChecks,
  parse: Sparkles,
  review: ClipboardCheck,
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthAgoIso(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}

export default function SmsImportWizard() {
  const [stepIndex, setStepIndex] = useState(0);
  const [fileName, setFileName] = useState("");
  const [allMessages, setAllMessages] = useState<SmsBackupMessage[]>([]);
  const [parseStats, setParseStats] = useState({ sms: 0, mms: 0 });
  const [fileLoading, setFileLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [parseError, setParseError] = useState("");
  const [receivedOnly, setReceivedOnly] = useState(true);
  const [orderLikeOnly, setOrderLikeOnly] = useState(true);
  const [dateFrom, setDateFrom] = useState(monthAgoIso());
  const [dateTo, setDateTo] = useState(todayIso());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [parseResults, setParseResults] = useState<SmsImportParseResult[]>([]);
  const [parseSummary, setParseSummary] = useState<{
    okCount: number;
    failCount: number;
    dupCount: number;
  } | null>(null);
  const [batchParsing, setBatchParsing] = useState(false);
  const [includedIds, setIncludedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const filteredMessages = useMemo(
    () =>
      filterSmsBackupMessages(allMessages, {
        receivedOnly,
        orderLikeOnly,
        dateFrom,
        dateTo,
      }),
    [allMessages, receivedOnly, orderLikeOnly, dateFrom, dateTo]
  );

  const selectedMessages = useMemo(
    () => filteredMessages.filter((m) => selectedIds.has(m.id)),
    [filteredMessages, selectedIds]
  );

  const messageById = useMemo(() => {
    const map = new Map<string, SmsBackupMessage>();
    for (const m of allMessages) map.set(m.id, m);
    return map;
  }, [allMessages]);

  const step = SMS_IMPORT_STEPS[stepIndex];
  const StepIcon = STEP_ICONS[step.id];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === SMS_IMPORT_STEPS.length - 1;

  const resetParseState = useCallback(() => {
    setParseResults([]);
    setParseSummary(null);
    setIncludedIds(new Set());
    setSaveMessage("");
  }, []);

  const runBatchParse = useCallback(async () => {
    if (selectedMessages.length === 0) return;
    setBatchParsing(true);
    setParseError("");
    resetParseState();

    const res = await fetch("/api/seller/orders/parse-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: selectedMessages.map((m) => ({
          id: m.id,
          body: m.body,
          dateIso: m.dateIso,
        })),
      }),
    });
    const data = await res.json();
    setBatchParsing(false);

    if (!res.ok) {
      setParseError(data.error || "일괄 분석에 실패했습니다.");
      return;
    }

    const results = data.results as SmsImportParseResult[];
    setParseResults(results);
    setParseSummary(data.summary);

    const defaultIncluded = new Set(
      results
        .filter((r) => r.ok && r.duplicateOrderIds.length === 0)
        .map((r) => r.sourceId)
    );
    setIncludedIds(defaultIncluded);
  }, [selectedMessages, resetParseState]);

  useEffect(() => {
    if (step.id === "parse" && parseResults.length === 0 && !batchParsing) {
      void runBatchParse();
    }
  }, [step.id, parseResults.length, batchParsing, runBatchParse]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;

      setFileName(file.name);
      setParseError("");
      setFileLoading(true);
      setLoadProgress(0);
      setAllMessages([]);
      setSelectedIds(new Set());
      resetParseState();

      try {
        const result = await parseSmsBackupFile(file, setLoadProgress);

        if (result.messages.length === 0) {
          setParseError(
            "문자를 찾지 못했습니다. SMS Backup & Restore의 sms-*.xml 파일인지 확인해 주세요."
          );
        } else {
          setAllMessages(result.messages);
          setParseStats({ sms: result.smsCount, mms: result.mmsCount });
        }
      } catch {
        setParseError(
          "XML 파일을 읽는 중 오류가 났습니다. 파일이 너무 크면 백업 시 SMS만 선택해 주세요."
        );
      } finally {
        setFileLoading(false);
        setLoadProgress(0);
      }
    },
    [resetParseState]
  );

  const goNext = () => {
    if (step.id === "filter") {
      setSelectedIds(new Set(filteredMessages.map((m) => m.id)));
    }
    if (step.id === "preview") {
      resetParseState();
    }
    setStepIndex((i) => Math.min(SMS_IMPORT_STEPS.length - 1, i + 1));
  };

  const goPrev = () => {
    if (step.id === "parse") resetParseState();
    setStepIndex((i) => Math.max(0, i - 1));
  };

  const canGoNext =
    (step.id === "upload" && allMessages.length > 0 && !fileLoading) ||
    (step.id === "filter" && filteredMessages.length > 0) ||
    (step.id === "preview" && selectedIds.size > 0) ||
    (step.id === "parse" &&
      !batchParsing &&
      parseResults.length > 0 &&
      parseResults.some((r) => r.ok));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredMessages.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredMessages.map((m) => m.id)));
    }
  };

  const toggleInclude = (id: string) => {
    setIncludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const payloadsToSave = useMemo(() => {
    return parseResults
      .filter((r) => r.ok && r.draftBundle && includedIds.has(r.sourceId))
      .flatMap((r) =>
        r.draftBundle!.lines
          .filter((line) => line.productName.trim())
          .map((line) => bundleLineToOrderPayload(r.draftBundle!, line))
      );
  }, [parseResults, includedIds]);

  const handleBulkSave = async () => {
    if (payloadsToSave.length === 0) {
      setSaveMessage("저장할 발주를 선택해 주세요.");
      return;
    }

    setSaving(true);
    setSaveMessage("");

    const result = await saveOrderPayloadsInChunks(payloadsToSave);
    setSaving(false);

    if (result.created === 0 && result.failed > 0) {
      setSaveMessage(result.message || "저장에 실패했습니다.");
      return;
    }

    setSaveMessage(result.message);
  };

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-2">
        {SMS_IMPORT_STEPS.map((s, i) => {
          const done = i < stepIndex;
          const current = i === stepIndex;
          return (
            <li
              key={s.id}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                current
                  ? "bg-emerald-600 text-white"
                  : done
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-100 text-slate-500"
              }`}
            >
              {done ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <span className="tabular-nums">{i + 1}</span>
              )}
              {s.label}
            </li>
          );
        })}
      </ol>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
            <StepIcon className="h-5 w-5 text-emerald-700" />
          </div>
          <div>
            <p className="text-xs font-medium text-emerald-700">
              {stepIndex + 1}단계 · {step.label}
            </p>
            <h3 className="text-lg font-semibold text-slate-900">{step.title}</h3>
            <p className="mt-1 text-sm text-slate-500">{step.summary}</p>
          </div>
        </div>

        {parseError && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {parseError}
          </div>
        )}

        {saveMessage && (
          <div
            className={`mb-4 rounded-lg px-4 py-3 text-sm ${
              saveMessage.includes("실패")
                ? "border border-amber-200 bg-amber-50 text-amber-900"
                : "border border-emerald-200 bg-emerald-50 text-emerald-900"
            }`}
          >
            {saveMessage}
            {saveMessage.includes("저장되었습니다") && (
              <Link
                href="/seller/orders"
                className="ml-2 font-medium underline"
              >
                발주 목록 보기
              </Link>
            )}
          </div>
        )}

        {step.id === "upload" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50/40 p-6 text-center">
              <input
                type="file"
                accept=".xml,text/xml,application/xml"
                className="hidden"
                id="sms-xml-file"
                onChange={handleFileChange}
                disabled={fileLoading}
              />
              <label
                htmlFor="sms-xml-file"
                className={`inline-flex cursor-pointer items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 ${fileLoading ? "pointer-events-none opacity-60" : ""}`}
              >
                {fileLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileUp className="h-4 w-4" />
                )}
                {fileLoading
                  ? loadProgress > 0
                    ? `읽는 중… ${loadProgress.toLocaleString()}건`
                    : "읽는 중…"
                  : "XML 파일 선택"}
              </label>
              {fileLoading && (
                <p className="mt-2 text-xs text-slate-500">
                  큰 파일은 MMS 이미지를 건너뛰고 SMS만 읽습니다.
                </p>
              )}
              {fileName && !fileLoading && (
                <p className="mt-3 text-sm font-medium text-slate-700">
                  선택됨: {fileName}
                </p>
              )}
              {!fileName && !fileLoading && (
                <p className="mt-3 text-xs text-slate-500">
                  SMS Backup & Restore → 백업 → sms-날짜.xml
                </p>
              )}
            </div>

            {allMessages.length > 0 && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                <p className="font-medium">총 {allMessages.length}건 파싱 완료</p>
                <p className="mt-0.5 text-xs text-emerald-700">
                  SMS {parseStats.sms}건
                  {parseStats.mms > 0 ? ` · MMS(텍스트) ${parseStats.mms}건` : ""}
                </p>
              </div>
            )}
          </div>
        )}

        {step.id === "filter" && (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 px-4 py-2 text-sm text-slate-600">
              전체 {allMessages.length}건 중{" "}
              <span className="font-semibold text-emerald-700">
                {filteredMessages.length}건
              </span>{" "}
              해당
            </div>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-4 py-3">
              <input
                type="checkbox"
                checked={receivedOnly}
                onChange={(e) => setReceivedOnly(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600"
              />
              <div>
                <p className="text-sm font-medium text-slate-800">수신 문자만</p>
                <p className="text-xs text-slate-500">고객 답장만 포함</p>
              </div>
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-4 py-3">
              <input
                type="checkbox"
                checked={orderLikeOnly}
                onChange={(e) => setOrderLikeOnly(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600"
              />
              <div>
                <p className="text-sm font-medium text-slate-800">
                  주문 형태만 (전화·주소 포함)
                </p>
              </div>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600">시작일</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className={SELLER_INPUT_CLASS}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600">종료일</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className={SELLER_INPUT_CLASS}
                />
              </label>
            </div>
          </div>
        )}

        {step.id === "preview" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-600">
                {selectedIds.size}건 선택 / {filteredMessages.length}건
              </p>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-xs font-medium text-emerald-700 hover:underline"
              >
                {selectedIds.size === filteredMessages.length
                  ? "전체 해제"
                  : "전체 선택"}
              </button>
            </div>
            <div className="max-h-80 space-y-2 overflow-y-auto rounded-xl border border-slate-200">
              {filteredMessages.map((msg) => (
                <label
                  key={msg.id}
                  className={`flex cursor-pointer gap-3 border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-slate-50 ${
                    selectedIds.has(msg.id) ? "bg-emerald-50/50" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(msg.id)}
                    onChange={() => toggleSelect(msg.id)}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-emerald-600"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-medium text-slate-700">
                        {msg.dateIso}
                      </span>
                      {msg.address && <span>{msg.address}</span>}
                    </div>
                    <p className="mt-0.5 text-sm text-slate-800">
                      {formatSmsPreview(msg.body)}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {step.id === "parse" && (
          <div className="space-y-4">
            {batchParsing ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-emerald-500" />
                <p>{selectedIds.size}건 분석 중…</p>
              </div>
            ) : parseSummary ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
                  <p className="text-2xl font-bold text-emerald-800">
                    {parseSummary.okCount}
                  </p>
                  <p className="text-xs text-emerald-700">분석 성공</p>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-center">
                  <p className="text-2xl font-bold text-red-800">
                    {parseSummary.failCount}
                  </p>
                  <p className="text-xs text-red-700">실패</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-center">
                  <p className="text-2xl font-bold text-amber-800">
                    {parseSummary.dupCount}
                  </p>
                  <p className="text-xs text-amber-700">중복 경고</p>
                </div>
              </div>
            ) : null}
            {!batchParsing && parseResults.some((r) => !r.ok) && (
              <ul className="max-h-32 overflow-y-auto rounded-lg border border-red-100 bg-red-50/50 px-3 py-2 text-xs text-red-800">
                {parseResults
                  .filter((r) => !r.ok)
                  .map((r) => (
                    <li key={r.sourceId}>
                      {messageById.get(r.sourceId)?.dateIso}: {r.error}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}

        {step.id === "review" && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              저장 대상 {includedIds.size}건 · 품목 {payloadsToSave.length}건
            </p>
            <div className="max-h-96 space-y-2 overflow-y-auto rounded-xl border border-slate-200">
              {parseResults
                .filter((r) => r.ok && r.draftBundle)
                .map((r) => {
                  const msg = messageById.get(r.sourceId);
                  const bundle = r.draftBundle!;
                  return (
                    <label
                      key={r.sourceId}
                      className={`block cursor-pointer border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-slate-50 ${
                        includedIds.has(r.sourceId) ? "bg-emerald-50/40" : ""
                      }`}
                    >
                      <div className="flex gap-3">
                        <input
                          type="checkbox"
                          checked={includedIds.has(r.sourceId)}
                          onChange={() => toggleInclude(r.sourceId)}
                          className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-emerald-600"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-slate-900">
                              {bundle.recipientName ||
                                bundle.ordererName ||
                                "(이름 없음)"}
                            </span>
                            <span className="text-xs text-slate-500">
                              {msg?.dateIso}
                            </span>
                            {r.warnings.map((w) => (
                              <span
                                key={w}
                                className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800"
                              >
                                {w}
                              </span>
                            ))}
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {bundle.lines
                              .map(
                                (l) =>
                                  `${l.productName || "(상품?)"} ×${l.quantity}`
                              )
                              .join(" · ")}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            {formatSmsPreview(bundle.rawSmsText, 60)}
                          </p>
                        </div>
                      </div>
                    </label>
                  );
                })}
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            disabled={isFirst}
            onClick={goPrev}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" />
            이전
          </button>
          {isLast ? (
            <button
              type="button"
              disabled={saving || payloadsToSave.length === 0}
              onClick={handleBulkSave}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ClipboardCheck className="h-4 w-4" />
              )}
              {saving
                ? "저장 중…"
                : `${payloadsToSave.length}건 저장`}
            </button>
          ) : (
            <button
              type="button"
              disabled={!canGoNext}
              onClick={goNext}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
            >
              다음
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
