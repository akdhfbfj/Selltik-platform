"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ProductSearchInput from "@/components/ProductSearchInput";
import {
  buildOutboundSmsBodyFromCart,
  composeOutboundSms,
} from "@/lib/build-outbound-sms";
import { extractTextFromImage } from "@/lib/extract-image-text";
import { formatKrw } from "@/lib/parse-supply-csv";
import {
  getDefaultSmsFooter,
  getDefaultSmsHeader,
} from "@/lib/sms-templates";
import type { Order, OrderDraftPreview, SellerProductView } from "@/lib/types";
import { ORDER_STATUS_LABELS } from "@/lib/types";
import {
  AlertTriangle,
  Check,
  ClipboardPaste,
  Copy,
  ImageIcon,
  Loader2,
  MapPin,
  MessageSquare,
  Plus,
  ShoppingCart,
  Trash2,
} from "lucide-react";

interface CartLine {
  productId: string;
  quantity: number;
}

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
  const [cart, setCart] = useState<CartLine[]>([]);
  const [addProductId, setAddProductId] = useState("");
  const [addQty, setAddQty] = useState(1);
  const [pickerReset, setPickerReset] = useState(0);
  const [savingSettings, setSavingSettings] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shopName, setShopName] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [ordersRes, productsRes, settingsRes, meRes] = await Promise.all([
      fetch("/api/seller/orders"),
      fetch("/api/seller/products"),
      fetch("/api/seller/settings"),
      fetch("/api/seller/me"),
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
    if (meRes.ok) {
      const data = await meRes.json();
      setShopName(data.shop?.name ?? "");
    }
    setLoading(false);
  }, []);

  const appendSmsText = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSmsText((prev) => (prev.trim() ? `${prev.trim()}\n\n${trimmed}` : trimmed));
  };

  const runOcrOnImage = async (file: Blob) => {
    setOcrLoading(true);
    setError("");
    try {
      const text = await extractTextFromImage(file);
      if (!text) {
        setError("이미지에서 글자를 찾지 못했습니다. 텍스트를 직접 붙여넣어 주세요.");
      } else {
        appendSmsText(text);
        setSuccess("이미지에서 글자를 추출했습니다. 내용을 확인한 뒤 분석하기를 눌러주세요.");
      }
    } catch {
      setError("이미지 분석에 실패했습니다. 스크린샷에서 텍스트를 복사해 붙여넣어 주세요.");
    }
    setOcrLoading(false);
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

  const cartItems = useMemo(
    () =>
      cart
        .map((line) => {
          const product = products.find((p) => p.id === line.productId);
          if (!product) return null;
          return { product, quantity: line.quantity };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
    [cart, products]
  );

  const cartSubtotal = useMemo(
    () =>
      cartItems.reduce(
        (sum, { product, quantity }) => sum + product.consumerPrice * quantity,
        0
      ),
    [cartItems]
  );

  const outboundPreview = useMemo(() => {
    const body = buildOutboundSmsBodyFromCart(cartItems);
    return composeOutboundSms(smsHeader, body, smsFooter);
  }, [smsHeader, smsFooter, cartItems]);

  const addToCart = () => {
    if (!addProductId) return;
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.productId === addProductId);
      if (idx >= 0) {
        return prev.map((l, i) =>
          i === idx ? { ...l, quantity: l.quantity + addQty } : l
        );
      }
      return [...prev, { productId: addProductId, quantity: addQty }];
    });
    setAddProductId("");
    setAddQty(1);
    setPickerReset((n) => n + 1);
  };

  const updateCartQty = (productId: string, quantity: number) => {
    const q = Math.max(1, quantity);
    setCart((prev) =>
      prev.map((l) => (l.productId === productId ? { ...l, quantity: q } : l))
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((l) => l.productId !== productId));
  };

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
          상·하단은 한 번 저장하면 계속 씁니다. 상품을 검색해 장바구니에 담으면
          본문에 한 줄씩 누적됩니다.
        </p>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-slate-600">
                  상단 문구 (인사말 등)
                </label>
                <button
                  type="button"
                  onClick={() => setSmsHeader(getDefaultSmsHeader(shopName))}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800"
                >
                  예시 문구 넣기
                </button>
              </div>
              <textarea
                className={`${inputClass} min-h-[72px] resize-y bg-white`}
                placeholder={
                  shopName
                    ? getDefaultSmsHeader(shopName)
                    : "안녕하세요, 쇼핑몰입니다 :)"
                }
                value={smsHeader}
                onChange={(e) => setSmsHeader(e.target.value)}
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-slate-600">
                  하단 문구 (계좌번호·안내 등)
                </label>
                <button
                  type="button"
                  onClick={() => setSmsFooter(getDefaultSmsFooter())}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800"
                >
                  예시 문구 넣기
                </button>
              </div>
              <textarea
                className={`${inputClass} min-h-[96px] resize-y bg-white`}
                placeholder={getDefaultSmsFooter()}
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
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[200px] flex-1">
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  상품 검색 (본문)
                </label>
                <ProductSearchInput
                  products={products}
                  value={addProductId}
                  onChange={setAddProductId}
                  resetToken={pickerReset}
                />
              </div>
              <div className="w-20">
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  수량
                </label>
                <input
                  type="number"
                  min={1}
                  className={`${inputClass} bg-white`}
                  value={addQty}
                  onChange={(e) =>
                    setAddQty(Math.max(1, parseInt(e.target.value, 10) || 1))
                  }
                />
              </div>
              <button
                type="button"
                onClick={addToCart}
                disabled={!addProductId}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                담기
              </button>
            </div>

            <div className="rounded-xl border-2 border-slate-800 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                  <ShoppingCart className="h-4 w-4" />
                  장바구니
                </h4>
                {cart.length > 0 && (
                  <span className="text-sm font-semibold text-blue-700">
                    합계 {formatKrw(cartSubtotal)}
                  </span>
                )}
              </div>
              {cart.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">
                  상품을 검색해 담기를 눌러주세요
                </p>
              ) : (
                <ul className="space-y-2">
                  {cartItems.map(({ product, quantity }) => (
                    <li
                      key={product.id}
                      className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 flex-1 font-medium text-slate-900">
                        {product.smsName || product.officialName}
                      </span>
                      <input
                        type="number"
                        min={1}
                        className="w-14 rounded border border-slate-200 px-2 py-1 text-center text-sm"
                        value={quantity}
                        onChange={(e) =>
                          updateCartQty(
                            product.id,
                            parseInt(e.target.value, 10) || 1
                          )
                        }
                      />
                      <span className="w-24 text-right font-medium text-slate-700">
                        {formatKrw(product.consumerPrice * quantity)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFromCart(product.id)}
                        className="text-slate-400 hover:text-red-500"
                        aria-label="삭제"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                미리보기 (복사해서 문자 앱에 붙여넣기)
              </label>
              <pre className="min-h-[160px] whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-800">
                {cart.length > 0
                  ? outboundPreview
                  : "장바구니에 상품을 담으면 미리보기가 표시됩니다."}
              </pre>
            </div>
            <button
              type="button"
              onClick={handleCopyOutbound}
              disabled={cart.length === 0}
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
        <h3 className="mb-1 flex items-center gap-2 font-semibold text-slate-900">
          <ClipboardPaste className="h-5 w-5 text-emerald-600" />
          ② 고객 답장 붙여넣기
        </h3>
        <p className="mb-3 text-xs text-slate-500">
          문자 내용을 붙여넣거나, 스크린샷 이미지를 붙여넣기(Ctrl+V)·업로드하면
          글자를 추출합니다. 모바일은 이미지에서 「텍스트 복사」 후 붙여넣기도
          가능합니다.
        </p>
        <textarea
          className={`${inputClass} min-h-[140px] resize-y bg-white`}
          placeholder={`예시)\n쉬젤 올뉴엘레강스 IH에그롤팬 x1\n받는분: 홍길동\n연락처: 010-1234-5678\n주소: (06234) 서울 강남구 ...\n배송메모: 문앞에 놔주세요`}
          value={smsText}
          onChange={(e) => setSmsText(e.target.value)}
          onPaste={handleReplyPaste}
        />
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
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={ocrLoading}
            className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-2.5 text-sm font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-60"
          >
            {ocrLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImageIcon className="h-4 w-4" />
            )}
            이미지에서 글자 추출
          </button>
          <button
            onClick={handleParse}
            disabled={parsing || ocrLoading || !smsText.trim()}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {parsing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            분석하기
          </button>
        </div>
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
              <ProductSearchInput
                products={products}
                value={draft.productId ?? ""}
                onChange={handleProductSelect}
              />
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
