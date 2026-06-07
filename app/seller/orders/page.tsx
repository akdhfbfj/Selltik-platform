"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildOutboundSmsBody,
  composeOutboundSms,
} from "@/lib/build-outbound-sms";
import { formatKrw } from "@/lib/parse-supply-csv";
import type { Order, OrderDraftPreview, SellerProductView } from "@/lib/types";
import { ORDER_STATUS_LABELS } from "@/lib/types";
import {
  AlertTriangle,
  Check,
  ClipboardPaste,
  Copy,
  Loader2,
  MapPin,
  MessageSquare,
  Plus,
  Trash2,
} from "lucide-react";

export default function SellerOrdersPage() {
  const [smsText, setSmsText] = useState("");
  const [draft, setDraft] = useState<OrderDraftPreview | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<SellerProductView[]>([]);
  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [addressResults, setAddressResults] = useState<
    { postalCode: string; address: string }[]
  >([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [smsHeader, setSmsHeader] = useState("");
  const [smsFooter, setSmsFooter] = useState("");
  const [outboundProductId, setOutboundProductId] = useState("");
  const [outboundQty, setOutboundQty] = useState(1);
  const [savingSettings, setSavingSettings] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [ordersRes, productsRes, settingsRes] = await Promise.all([
      fetch("/api/seller/orders"),
      fetch("/api/seller/products"),
      fetch("/api/seller/settings"),
    ]);
    if (ordersRes.ok) {
      const data = await ordersRes.json();
      setOrders(data.orders);
    }
    if (productsRes.ok) {
      const data = await productsRes.json();
      setProducts(data.products);
    }
    if (settingsRes.ok) {
      const data = await settingsRes.json();
      setSmsHeader(data.smsHeader ?? "");
      setSmsFooter(data.smsFooter ?? "");
    }
    setLoading(false);
  }, []);

  const outboundProduct = products.find((p) => p.id === outboundProductId);

  const outboundPreview = useMemo(() => {
    if (!outboundProduct) return composeOutboundSms(smsHeader, "", smsFooter);
    const body = buildOutboundSmsBody(outboundProduct, outboundQty);
    return composeOutboundSms(smsHeader, body, smsFooter);
  }, [smsHeader, smsFooter, outboundProduct, outboundQty]);

  const handleSaveSmsSettings = async () => {
    setSavingSettings(true);
    setError("");
    const res = await fetch("/api/seller/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ smsHeader, smsFooter }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "문구 저장에 실패했습니다.");
    } else {
      setSuccess("상·하단 문구가 저장되었습니다.");
    }
    setSavingSettings(false);
  };

  const handleCopyOutbound = async () => {
    try {
      await navigator.clipboard.writeText(outboundPreview);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("복사에 실패했습니다.");
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleParse = async () => {
    if (!smsText.trim()) return;
    setParsing(true);
    setError("");
    setSuccess("");
    setAddressResults([]);

    const res = await fetch("/api/seller/orders/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: smsText }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "분석에 실패했습니다.");
    } else {
      setDraft(data.draft);
    }
    setParsing(false);
  };

  const handleResolveAddress = async () => {
    if (!draft?.address.trim()) return;
    setResolving(true);
    setError("");

    const res = await fetch("/api/seller/orders/resolve-address", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: draft.address }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "주소 검색에 실패했습니다.");
    } else {
      setAddressResults(data.results ?? []);
    }
    setResolving(false);
  };

  const applyAddress = (postalCode: string, address: string) => {
    if (!draft) return;
    const product = draft.productId
      ? products.find((p) => p.id === draft.productId)
      : null;
    const baseShipping = product?.baseShipping ?? 0;
    const remote =
      postalCode.startsWith("63") ||
      /제주|울릉|독도|거문도/.test(address.replace(/\s/g, ""));
    const shippingFee = baseShipping + (remote ? 4000 : 0);
    const supplyTotal = draft.purchasePrice + shippingFee;
    setDraft({
      ...draft,
      postalCode,
      address,
      isRemoteArea: remote,
      shippingFee,
      supplyTotal,
      celticDepositAmount: supplyTotal,
    });
    setAddressResults([]);
  };

  const updateDraft = (patch: Partial<OrderDraftPreview>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  };

  const handleProductSelect = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product || !draft) return;
    const purchasePrice = product.purchasePrice * draft.quantity;
    const remote =
      draft.postalCode.startsWith("63") ||
      /제주|울릉|독도|거문도/.test(draft.address.replace(/\s/g, ""));
    const shippingFee =
      product.baseShipping + (remote ? 4000 : 0);
    const supplyTotal = purchasePrice + shippingFee;
    setDraft({
      ...draft,
      productId: product.id,
      productName: product.officialName,
      purchasePrice,
      shippingFee,
      supplyTotal,
      isRemoteArea: remote,
      celticDepositAmount: supplyTotal,
      productMatch: {
        productId: product.id,
        officialName: product.officialName,
        matchedBy: "official_name",
        consumerPrice: product.consumerPrice,
      },
    });
  };

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    setError("");
    setSuccess("");

    const res = await fetch("/api/seller/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "저장에 실패했습니다.");
    } else {
      setSuccess("발주 초안이 저장되었습니다.");
      setDraft(null);
      setSmsText("");
      loadData();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 발주 초안을 삭제할까요?")) return;
    const res = await fetch(`/api/seller/orders/${id}`, { method: "DELETE" });
    if (res.ok) loadData();
  };

  const inputClass =
    "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">문자 → 발주</h2>
        <p className="mt-1 text-sm text-slate-500">
          ① 안내 문자 작성·복사 → ② 고객 답장 붙여넣기 → ③ 발주 저장
        </p>
      </div>

      <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50/40 p-6 shadow-sm">
        <h3 className="mb-1 flex items-center gap-2 font-semibold text-slate-900">
          <MessageSquare className="h-5 w-5 text-blue-600" />
          ① 고객에게 보낼 안내 문자
        </h3>
        <p className="mb-4 text-xs text-slate-500">
          상·하단은 한 번 저장하면 계속 쓰입니다. 본문은 상품 선택 시 금액이
          자동 계산됩니다.
        </p>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                상단 문구 (인사말 등)
              </label>
              <textarea
                className={`${inputClass} min-h-[72px] resize-y bg-white`}
                placeholder="안녕하세요, 띵동이네입니다 :)"
                value={smsHeader}
                onChange={(e) => setSmsHeader(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                하단 문구 (계좌번호·안내 등)
              </label>
              <textarea
                className={`${inputClass} min-h-[96px] resize-y bg-white`}
                placeholder={`입금 계좌: OO은행 1234-5678-90 예금주\n입금 후 성함·연락처·주소를 문자로 보내주세요.`}
                value={smsFooter}
                onChange={(e) => setSmsFooter(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={handleSaveSmsSettings}
              disabled={savingSettings}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {savingSettings && <Loader2 className="h-4 w-4 animate-spin" />}
              상·하단 문구 저장
            </button>
          </div>

          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  상품 (본문)
                </label>
                <select
                  className={`${inputClass} bg-white`}
                  value={outboundProductId}
                  onChange={(e) => setOutboundProductId(e.target.value)}
                >
                  <option value="">상품을 선택하세요</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.smsName ? `[${p.smsName}] ` : ""}
                      {p.officialName} · {formatKrw(p.consumerPrice)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  수량
                </label>
                <input
                  type="number"
                  min={1}
                  className={`${inputClass} bg-white`}
                  value={outboundQty}
                  onChange={(e) =>
                    setOutboundQty(Math.max(1, parseInt(e.target.value, 10) || 1))
                  }
                />
              </div>
              {outboundProduct && (
                <div className="flex items-end text-sm text-slate-600">
                  <p>
                    개당 {formatKrw(outboundProduct.consumerPrice)} → 합계{" "}
                    <span className="font-semibold text-blue-700">
                      {formatKrw(outboundProduct.consumerPrice * outboundQty)}
                    </span>
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                미리보기 (복사해서 문자 앱에 붙여넣기)
              </label>
              <pre className="min-h-[160px] whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-800">
                {outboundPreview || "상품을 선택하면 본문이 채워집니다."}
              </pre>
            </div>
            <button
              type="button"
              onClick={handleCopyOutbound}
              disabled={!outboundProductId}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  복사됨
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  문자 복사
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50/30 p-6 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
          <ClipboardPaste className="h-5 w-5 text-emerald-600" />
          ② 고객 답장 붙여넣기
        </h3>
        <textarea
          className={`${inputClass} min-h-[140px] resize-y bg-white`}
          placeholder={`예시)\n쉬젤 올뉴엘레강스 IH에그롤팬 x1\n받는분: 홍길동\n연락처: 010-1234-5678\n주소: (06234) 서울 강남구 ...\n배송메모: 문앞에 놔주세요`}
          value={smsText}
          onChange={(e) => setSmsText(e.target.value)}
        />
        <button
          onClick={handleParse}
          disabled={parsing || !smsText.trim()}
          className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {parsing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          분석하기
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
      {success && (
        <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          {success}
        </p>
      )}

      {draft && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h3 className="mb-4 font-semibold text-slate-900">발주 초안</h3>

          {draft.productMatch.matchedBy === "none" ? (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                상품을 찾지 못했습니다. 아래에서 직접 선택하거나{" "}
                <a href="/seller/products" className="font-medium underline">
                  문자용 상품명
                </a>
                을 먼저 등록해 주세요.
              </div>
            </div>
          ) : (
            <p className="mb-4 text-sm text-emerald-700">
              ✓ 상품 매칭됨 (
              {draft.productMatch.matchedBy === "sms_alias"
                ? "문자용 상품명"
                : "공식 상품명"}
              )
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600">
                상품 선택
              </label>
              <select
                className={inputClass}
                value={draft.productId ?? ""}
                onChange={(e) => handleProductSelect(e.target.value)}
              >
                <option value="">— 직접 선택 —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.smsName ? `[${p.smsName}] ` : ""}
                    {p.officialName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                수량
              </label>
              <input
                type="number"
                min={1}
                className={inputClass}
                value={draft.quantity}
                onChange={(e) => {
                  const quantity = Math.max(1, parseInt(e.target.value, 10) || 1);
                  if (!draft) return;
                  const product = draft.productId
                    ? products.find((p) => p.id === draft.productId)
                    : null;
                  const purchasePrice = (product?.purchasePrice ?? 0) * quantity;
                  const supplyTotal = purchasePrice + draft.shippingFee;
                  updateDraft({
                    quantity,
                    purchasePrice,
                    supplyTotal,
                    celticDepositAmount: supplyTotal,
                  });
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                주문자
              </label>
              <input
                className={inputClass}
                value={draft.ordererName}
                onChange={(e) => updateDraft({ ordererName: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                수령인
              </label>
              <input
                className={inputClass}
                value={draft.recipientName}
                onChange={(e) => updateDraft({ recipientName: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                연락처1
              </label>
              <input
                className={inputClass}
                value={draft.contactPhone}
                onChange={(e) => updateDraft({ contactPhone: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                연락처2
              </label>
              <input
                className={inputClass}
                value={draft.contactPhone2}
                onChange={(e) => updateDraft({ contactPhone2: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                우편번호
              </label>
              <input
                className={inputClass}
                value={draft.postalCode}
                onChange={(e) => updateDraft({ postalCode: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600">
                주소
              </label>
              <div className="flex gap-2">
                <input
                  className={inputClass}
                  value={draft.address}
                  onChange={(e) => updateDraft({ address: e.target.value })}
                />
                <button
                  type="button"
                  onClick={handleResolveAddress}
                  disabled={resolving || !draft.address.trim()}
                  className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  title="카카오 주소 검색 (KAKAO_REST_API_KEY 필요)"
                >
                  {resolving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MapPin className="h-4 w-4" />
                  )}
                  검색
                </button>
              </div>
              {addressResults.length > 0 && (
                <ul className="mt-2 space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm">
                  {addressResults.map((r, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => applyAddress(r.postalCode, r.address)}
                        className="w-full rounded px-2 py-1.5 text-left hover:bg-white"
                      >
                        [{r.postalCode}] {r.address}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600">
                배송메모
              </label>
              <input
                className={inputClass}
                value={draft.shippingMemo}
                onChange={(e) => updateDraft({ shippingMemo: e.target.value })}
              />
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">매입가 (수량 반영)</span>
              <span>{formatKrw(draft.purchasePrice)}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-slate-600">
                택배비
                {draft.isRemoteArea && (
                  <span className="ml-1 text-amber-600">(제주·도서 +4,000)</span>
                )}
              </span>
              <span>{formatKrw(draft.shippingFee)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 font-semibold text-slate-900">
              <span>셀틱 입금액 (계)</span>
              <span className="text-emerald-700">
                {formatKrw(draft.celticDepositAmount)}
              </span>
            </div>
            {draft.productMatch.consumerPrice > 0 && (
              <p className="mt-2 text-xs text-slate-500">
                고객 판매가 안내: {formatKrw(draft.productMatch.consumerPrice)}
                {draft.quantity > 1 &&
                  ` × ${draft.quantity} = ${formatKrw(draft.productMatch.consumerPrice * draft.quantity)}`}
              </p>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              발주 저장
            </button>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              취소
            </button>
          </div>
        </form>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-semibold text-slate-900">
          저장된 발주 ({orders.length}건)
        </h3>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : orders.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            아직 저장된 발주가 없습니다.
          </p>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <div
                key={o.id}
                className="rounded-xl border border-slate-200 p-4 text-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900">{o.productName}</p>
                    <p className="mt-1 text-slate-500">
                      {o.recipientName} · {o.contactPhone} · 수량 {o.quantity}
                    </p>
                    <p className="mt-1 text-xs text-slate-400 line-clamp-1">
                      {o.address}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {ORDER_STATUS_LABELS[o.status]}
                    </span>
                    <p className="mt-1 font-semibold text-emerald-700">
                      {formatKrw(o.supplyTotal)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(o.id)}
                  className="mt-2 flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-3 w-3" />
                  삭제
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
