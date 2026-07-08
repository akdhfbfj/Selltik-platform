"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import ReplyDraftFormEditor from "@/components/ReplyDraftFormEditor";
import { KAKAO_POSTCODE_SCRIPT } from "@/components/KakaoPostcodePicker";
import OrderSectionTabs from "@/components/OrderSectionTabs";
import ReplyDraftQueuePanel from "@/components/ReplyDraftQueuePanel";
import ReplyParsedSnapshot from "@/components/ReplyParsedSnapshot";
import ReplySourcePreview from "@/components/ReplySourcePreview";
import ReplyWorkflowGuide, {
  getReplyActiveStep,
} from "@/components/ReplyWorkflowGuide";
import { extractTextFromImage } from "@/lib/extract-image-text";
import type { ParsedOrderSms } from "@/lib/parse-order-sms";
import { saveOrderDraftBundles } from "@/lib/save-order-bundles";
import {
  loadReplyDraftQueue,
  saveReplyDraftQueue,
} from "@/lib/order-draft-storage";
import { isNoiseProductLineName } from "@/lib/order-draft-helpers";
import { buildReplyDraftLabel } from "@/lib/refine-order-draft";
import { canSaveLearnSample } from "@/lib/reply-learn-sample";
import { SELLER_INPUT_CLASS } from "@/lib/seller-ui";
import type { OrderDraftBundle, QueuedReplyDraft, SellerProductView } from "@/lib/types";
import Script from "next/script";
import {
  ArrowRight,
  ClipboardPaste,
  ImageIcon,
  Loader2,
  Save,
  Search,
} from "lucide-react";

export default function SellerReplyPage() {
  const router = useRouter();
  const [smsText, setSmsText] = useState("");
  const [parsedBundle, setParsedBundle] = useState<OrderDraftBundle | null>(null);
  const [draftBundle, setDraftBundle] = useState<OrderDraftBundle | null>(null);
  const [isRefined, setIsRefined] = useState(false);
  const [queue, setQueue] = useState<QueuedReplyDraft[]>([]);
  const [products, setProducts] = useState<SellerProductView[]>([]);
  const [parsing, setParsing] = useState(false);
  const [refining, setRefining] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [addressSearchTrigger, setAddressSearchTrigger] = useState(0);
  const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(null);
  const [textInputMode, setTextInputMode] = useState(false);
  const parseTextRef = useRef("");
  const [error, setError] = useState("");
  const [savingToOrders, setSavingToOrders] = useState(false);
  const [success, setSuccess] = useState("");
  const imageInputRef = useRef<HTMLInputElement>(null);

  const selectedQueueCount = queue.filter((q) => q.selected).length;
  const activeStep = getReplyActiveStep({
    hasDraft: !!draftBundle,
    isRefined,
    queueCount: queue.length,
  });

  useEffect(() => {
    setQueue(loadReplyDraftQueue());
  }, []);

  useEffect(() => {
    saveReplyDraftQueue(queue);
  }, [queue]);

  useEffect(() => {
    return () => {
      if (sourceImageUrl) URL.revokeObjectURL(sourceImageUrl);
    };
  }, [sourceImageUrl]);

  useEffect(() => {
    fetch("/api/seller/products")
      .then((r) => r.json())
      .then((data) => {
        if (data.products) setProducts(data.products);
      })
      .catch(() => {});
  }, []);

  const clearParseResults = useCallback(() => {
    setParsedBundle(null);
    setDraftBundle(null);
    setIsRefined(false);
    setAddressSearchTrigger(0);
  }, []);

  const revokeSourceImage = useCallback(() => {
    setSourceImageUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const resetReplyInput = useCallback(() => {
    clearParseResults();
    revokeSourceImage();
    setSmsText("");
    parseTextRef.current = "";
    setTextInputMode(false);
  }, [clearParseResults, revokeSourceImage]);

  const runParse = useCallback(async (text: string, options?: { showText?: boolean }) => {
    const trimmed = text.trim();
    if (!trimmed) return false;

    setParsing(true);
    setError("");
    setSuccess("");
    parseTextRef.current = trimmed;
    if (options?.showText !== false) {
      setSmsText(trimmed);
    }

    const res = await fetch("/api/seller/orders/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: trimmed }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "분석에 실패했습니다.");
      clearParseResults();
    } else {
      const raw =
        (data.rawDraftBundle as OrderDraftBundle | undefined) ??
        (data.draftBundle as OrderDraftBundle);
      const refined = data.draftBundle as OrderDraftBundle;
      const autoParsed = data.parsed as ParsedOrderSms;
      setParsedBundle(JSON.parse(JSON.stringify(raw)));
      setDraftBundle({
        ...refined,
        rawSmsText: trimmed,
        autoParsed,
      });
      setIsRefined(Boolean(data.autoRefined ?? true));

      const unmatched = refined.lines.filter(
        (l) => l.productMatch.matchedBy === "none"
      ).length;
      if (unmatched > 0) {
        setSuccess(
          `분석·양식 반영 완료. 매칭 안 된 상품 ${unmatched}건은 입력란에서 수정하세요.`
        );
      } else {
        setSuccess(
          "분석·양식 반영 완료. 공급가표 제품명·우편번호·주소가 채워졌습니다. 확인 후 목록에 저장하세요."
        );
      }
      if (refined.address.trim() && !refined.postalCode.trim()) {
        setAddressSearchTrigger((t) => t + 1);
      }
    }
    setParsing(false);
    return res.ok;
  }, [clearParseResults]);

  const runOcrOnImage = useCallback(
    async (file: Blob) => {
      setOcrLoading(true);
      setError("");
      setSuccess("");
      revokeSourceImage();
      const imageUrl = URL.createObjectURL(file);
      setSourceImageUrl(imageUrl);
      setTextInputMode(false);
      try {
        const text = await extractTextFromImage(file);
        if (!text) {
          setError(
            "이미지에서 글자를 찾지 못했습니다. 텍스트 직접 입력으로 전환해 주세요."
          );
          setTextInputMode(true);
        } else {
          setSuccess("스크린샷을 읽었습니다. 분석 중…");
          await runParse(text, { showText: false });
        }
      } catch {
        setError(
          "이미지 분석에 실패했습니다. 텍스트 직접 입력으로 전환해 주세요."
        );
        setTextInputMode(true);
      }
      setOcrLoading(false);
    },
    [runParse, revokeSourceImage]
  );

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (textInputMode) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) void runOcrOnImage(file);
          return;
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [runOcrOnImage, textInputMode]);

  const handleSmsTextChange = (value: string) => {
    setSmsText(value);
    if (parsedBundle || draftBundle) {
      clearParseResults();
    }
  };

  const handleReplyPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) runOcrOnImage(file);
        return;
      }
    }
  };

  const handleParse = () => {
    const text = smsText.trim() || parseTextRef.current.trim();
    void runParse(text, { showText: !sourceImageUrl });
  };

  const handleRefine = async () => {
    if (!draftBundle) return;
    setRefining(true);
    setError("");
    setSuccess("");

    const res = await fetch("/api/seller/orders/refine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bundle: draftBundle }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "반영에 실패했습니다.");
    } else {
      const refined = {
        ...(data.draftBundle as OrderDraftBundle),
        rawSmsText: parseTextRef.current.trim() || smsText.trim(),
      };
      setDraftBundle(refined);
      setIsRefined(true);

      const unmatched = refined.lines.filter(
        (l) => l.productMatch.matchedBy === "none"
      ).length;
      const addrMsg = refined.postalCode
        ? `우편번호 ${refined.postalCode}`
        : "우편번호 미확인";
      setSuccess(
        unmatched > 0
          ? `양식 반영 완료 (${addrMsg}). 매칭 안 된 상품 ${unmatched}건은 입력란에서 수정하세요.`
          : `양식 반영 완료. 공급가표 제품명·${addrMsg} · 금액이 채워졌습니다.`
      );
      if (refined.address.trim() && !refined.postalCode.trim()) {
        setAddressSearchTrigger((t) => t + 1);
      }
    }
    setRefining(false);
  };

  const handleSaveToQueue = () => {
    if (!draftBundle || !isRefined) return;
    const invalid = draftBundle.lines.filter((l) => !l.productName?.trim());
    if (invalid.length > 0) {
      setError("모든 상품명을 확인해 주세요.");
      return;
    }

    const bundle = {
      ...draftBundle,
      rawSmsText: parseTextRef.current.trim() || smsText.trim(),
    };
    const item: QueuedReplyDraft = {
      id: uuidv4(),
      bundle,
      selected: true,
      savedAt: new Date().toISOString(),
      label: buildReplyDraftLabel(bundle),
    };

    setQueue((prev) => [...prev, item]);
    resetReplyInput();
    setError("");

    if (canSaveLearnSample(bundle, draftBundle.autoParsed)) {
      void fetch("/api/seller/orders/learn-sample", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawSmsText: bundle.rawSmsText,
          autoParsed: draftBundle.autoParsed,
          sellerBundle: bundle,
        }),
      }).catch(() => {});
    }

    setSuccess(
      `목록에 저장했습니다. (${item.label}) 수정 내용은 다음 분석 정확도 향상에 반영됩니다.`
    );
  };

  const goToTempOrders = useCallback(async () => {
    const selected = queue.filter((q) => q.selected);
    if (selected.length === 0) {
      setError("임시 발주서에 넣을 건을 선택해 주세요.");
      return;
    }

    setSavingToOrders(true);
    setError("");
    setSuccess("");

    const result = await saveOrderDraftBundles(
      selected.map((q) => ({ id: q.id, bundle: q.bundle, label: q.label }))
    );

    if (!result.ok) {
      setError(result.error);
      setSavingToOrders(false);
      return;
    }

    const savedIds = new Set(result.savedQueueIds);
    const remaining = queue.filter((q) => !savedIds.has(q.id));
    setQueue(remaining);
    saveReplyDraftQueue(remaining);
    setSavingToOrders(false);

    if (result.failedLines > 0) {
      const detail =
        result.errors.length > 0
          ? ` (${result.errors
              .slice(0, 2)
              .map((e) => e.label)
              .join(", ")}${result.errors.length > 2 ? " …" : ""})`
          : "";
      setError(`${result.message}${detail}`);
      return;
    }

    setSuccess(result.message);
    router.push("/seller/orders?tab=draft");
  }, [queue, router]);

  return (
    <>
      <Script src={KAKAO_POSTCODE_SCRIPT} strategy="afterInteractive" />
      <OrderSectionTabs />

      <ReplyWorkflowGuide
        activeStep={activeStep}
        queueCount={queue.length}
        selectedCount={selectedQueueCount}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-1 flex items-center gap-2 font-semibold text-slate-900">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-500 text-xs font-bold text-white">
            1
          </span>
          <ClipboardPaste className="h-5 w-5 text-slate-500" />
          답장 분석
        </h3>
        <p className="mb-4 ml-8 text-xs text-slate-500">
          스크린샷을 <strong>Ctrl+V</strong>로 붙여넣으면 자동 분석됩니다.
          왼쪽에 캡처, 오른쪽에 분석 결과가 표시됩니다.
        </p>

        <div className="mx-auto mb-6 max-w-lg">
          {sourceImageUrl && !textInputMode ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-5 text-center">
              <p className="text-sm text-slate-600">
                스크린샷이 붙여넣어졌습니다.
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={ocrLoading || parsing}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  다른 이미지 선택
                </button>
                <button
                  type="button"
                  onClick={() => setTextInputMode(true)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  텍스트 직접 입력
                </button>
                <button
                  type="button"
                  onClick={resetReplyInput}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50"
                >
                  초기화
                </button>
              </div>
            </div>
          ) : (
            <div
              className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/80 p-4"
              onPaste={(e) => {
                const items = e.clipboardData?.items;
                if (!items) return;
                for (const item of items) {
                  if (item.type.startsWith("image/")) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    if (file) void runOcrOnImage(file);
                    return;
                  }
                }
              }}
            >
              <textarea
                className={`${SELLER_INPUT_CLASS} min-h-[100px] resize-y bg-white`}
                placeholder="Ctrl+V로 스크린샷 붙여넣기 또는 텍스트 입력"
                value={smsText}
                onChange={(e) => handleSmsTextChange(e.target.value)}
                onPaste={handleReplyPaste}
              />
            </div>
          )}

          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) runOcrOnImage(file);
              e.target.value = "";
            }}
          />
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={ocrLoading || parsing}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {ocrLoading || parsing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImageIcon className="h-4 w-4" />
              )}
              {ocrLoading || parsing ? "이미지 분석 중…" : "이미지 선택·분석"}
            </button>
            <button
              type="button"
              onClick={handleParse}
              disabled={
                parsing ||
                ocrLoading ||
                (!smsText.trim() &&
                  !parseTextRef.current.trim() &&
                  !sourceImageUrl)
              }
              className="flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-200 disabled:opacity-60"
            >
              {parsing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              분석하기
            </button>
          </div>
        </div>

        {!draftBundle && (
          <div className="grid gap-4 lg:grid-cols-2">
            <ReplySourcePreview
              imageUrl={sourceImageUrl}
              loading={parsing || ocrLoading}
            />
            <ReplyParsedSnapshot
              bundle={parsedBundle}
              loading={parsing || ocrLoading}
            />
          </div>
        )}
      </section>

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

      {parsedBundle && draftBundle && (
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(260px,38%)_minmax(0,1fr)]">
          <aside className="space-y-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
            <ReplySourcePreview
              imageUrl={sourceImageUrl}
              loading={parsing || ocrLoading}
              compact
            />
            <ReplyParsedSnapshot
              bundle={parsedBundle}
              loading={parsing || ocrLoading}
            />
          </aside>

          <section className="rounded-2xl border-2 border-emerald-300 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                  2
                </span>
                양식에 맞게 기입
              </h3>
              <p className="mt-1 ml-9 text-xs text-slate-500">
                원문에서 읽은 값이 자동으로 채워집니다. 주소는 「주소 추출
                시작」→ 검색 결과 클릭으로 우편번호·정제 주소를 넣으세요.
              </p>
            </div>
            {isRefined ? (
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
                반영 완료
              </span>
            ) : (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                반영 중
              </span>
            )}
          </div>

          <ReplyDraftFormEditor
            bundle={draftBundle}
            onChange={setDraftBundle}
            products={products}
            onAddressStatus={(msg) => {
              setError("");
              setSuccess(msg);
            }}
            rawAddressHint={parsedBundle.address}
            addressSearchTrigger={addressSearchTrigger}
            rawProductNames={parsedBundle.lines
              .filter((l) => !isNoiseProductLineName(l.productName))
              .map((l) => l.productName)}
          />

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleRefine}
              disabled={refining}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            >
              {refining ? "다시 반영 중…" : "다시 반영"}
            </button>
            <button
              type="button"
              onClick={handleSaveToQueue}
              disabled={!isRefined}
              className="flex items-center gap-2 rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-40"
            >
              <Save className="h-4 w-4" />
              목록에 저장
            </button>
          </div>
          </section>
        </div>
      )}

      <ReplyDraftQueuePanel
        queue={queue}
        products={products}
        onToggleSelect={(id, selected) =>
          setQueue((prev) =>
            prev.map((q) => (q.id === id ? { ...q, selected } : q))
          )
        }
        onToggleAll={(selected) =>
          setQueue((prev) => prev.map((q) => ({ ...q, selected })))
        }
        onRemove={(id) => setQueue((prev) => prev.filter((q) => q.id !== id))}
        onUpdate={(id, draft) =>
          setQueue((prev) =>
            prev.map((q) =>
              q.id === id
                ? { ...draft, label: buildReplyDraftLabel(draft.bundle) }
                : q
            )
          )
        }
      />

      {queue.length > 0 && (
        <section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
              4
            </span>
            발주서 저장
          </h3>
          <div className="ml-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void goToTempOrders()}
              disabled={selectedQueueCount === 0 || savingToOrders}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {savingToOrders ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  임시 발주서에 저장 ({selectedQueueCount}건)
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
            <p className="text-xs text-slate-600">
              선택한 건이 발주 탭 「임시 발주서」에 저장됩니다. 입금 확인 후
              최종 발주서로 출력하세요.
            </p>
          </div>
        </section>
      )}
    </>
  );
}
