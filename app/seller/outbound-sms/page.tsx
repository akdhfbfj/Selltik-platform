"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ProductSearchInput from "@/components/ProductSearchInput";
import {
  buildOutboundSmsBodyFromCart,
  calcOutboundRemoteSurcharge,
  composeOutboundSms,
} from "@/lib/build-outbound-sms";
import { formatKrw } from "@/lib/parse-supply-csv";
import { REMOTE_SHIPPING_SURCHARGE } from "@/lib/remote-area";
import {
  fetchSellerApi,
  peekSellerApiData,
  SELLER_API,
  writeSellerApiCache,
} from "@/lib/seller-api-cache";
import { SELLER_INPUT_CLASS } from "@/lib/seller-ui";
import {
  getDefaultSmsFooter,
  getDefaultSmsHeader,
} from "@/lib/sms-templates";
import type { SellerProductView } from "@/lib/types";
import {
  Check,
  Copy,
  Loader2,
  MessageSquare,
  Plus,
  Save,
  ShoppingCart,
  Trash2,
} from "lucide-react";

interface CartLine {
  productId: string;
  quantity: number;
}

type ProductsPayload = {
  products: SellerProductView[];
  total?: number;
  pendingReviewCount?: number;
};
type SettingsPayload = { smsHeader?: string; smsFooter?: string };
type MePayload = { shop?: { name?: string } | null };

export default function SellerOutboundSmsPage() {
  const [products, setProducts] = useState<SellerProductView[]>(
    () =>
      peekSellerApiData<ProductsPayload>(SELLER_API.products)?.products ?? []
  );
  const [loading, setLoading] = useState(
    () =>
      !peekSellerApiData(SELLER_API.products) ||
      !peekSellerApiData(SELLER_API.settings)
  );
  const [error, setError] = useState("");
  const [smsSaveSuccess, setSmsSaveSuccess] = useState("");
  const [smsHeader, setSmsHeader] = useState(
    () => peekSellerApiData<SettingsPayload>(SELLER_API.settings)?.smsHeader ?? ""
  );
  const [smsFooter, setSmsFooter] = useState(
    () => peekSellerApiData<SettingsPayload>(SELLER_API.settings)?.smsFooter ?? ""
  );
  const [cart, setCart] = useState<CartLine[]>([]);
  const [outboundRemoteArea, setOutboundRemoteArea] = useState(false);
  const [addProductId, setAddProductId] = useState("");
  const [addQty, setAddQty] = useState(1);
  const [pickerReset, setPickerReset] = useState(0);
  const [savingSettings, setSavingSettings] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shopName, setShopName] = useState(
    () => peekSellerApiData<MePayload>(SELLER_API.me)?.shop?.name ?? ""
  );

  const loadData = useCallback(async (opts?: { force?: boolean }) => {
    const force = opts?.force ?? false;
    const hasSnapshot =
      !!peekSellerApiData(SELLER_API.products) &&
      !!peekSellerApiData(SELLER_API.settings);
    if (!hasSnapshot) setLoading(true);

    const [productsRes, settingsRes, meRes] = await Promise.all([
      fetchSellerApi<ProductsPayload>(SELLER_API.products, { force }),
      fetchSellerApi<SettingsPayload>(SELLER_API.settings, { force }),
      fetchSellerApi<MePayload>(SELLER_API.me, { force }),
    ]);
    if (productsRes.ok && productsRes.data?.products) {
      setProducts(productsRes.data.products);
    }
    if (settingsRes.ok && settingsRes.data) {
      setSmsHeader(settingsRes.data.smsHeader ?? "");
      setSmsFooter(settingsRes.data.smsFooter ?? "");
    }
    if (meRes.ok && meRes.data) {
      setShopName(meRes.data.shop?.name ?? "");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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

  const cartRemoteSurcharge = useMemo(
    () => calcOutboundRemoteSurcharge(cartItems.length, outboundRemoteArea),
    [cartItems.length, outboundRemoteArea]
  );

  const cartGrandTotal = cartSubtotal + cartRemoteSurcharge;

  const outboundPreview = useMemo(() => {
    const body = buildOutboundSmsBodyFromCart(cartItems, {
      isRemoteArea: outboundRemoteArea,
    });
    return composeOutboundSms(smsHeader, body, smsFooter);
  }, [smsHeader, smsFooter, cartItems, outboundRemoteArea]);

  const [previewText, setPreviewText] = useState("");

  useEffect(() => {
    setPreviewText(outboundPreview);
  }, [outboundPreview]);

  const bumpOutboundUsage = useCallback(async (productIds: string[]) => {
    if (productIds.length === 0) return;
    const now = new Date().toISOString();
    const idSet = new Set(productIds);
    setProducts((prev) => {
      const next = prev.map((p) =>
        idSet.has(p.id) ? { ...p, lastOutboundAt: now } : p
      );
      const cached = peekSellerApiData<ProductsPayload>(SELLER_API.products);
      writeSellerApiCache(SELLER_API.products, {
        products: next,
        total: next.length,
        pendingReviewCount: cached?.pendingReviewCount,
      });
      return next;
    });
    await fetch("/api/seller/products/outbound-usage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productIds }),
    });
  }, []);

  const addToCart = () => {
    if (!addProductId) return;
    void bumpOutboundUsage([addProductId]);
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

  const clearCart = () => {
    setCart([]);
    setOutboundRemoteArea(false);
  };

  const handleSaveSmsSettings = async () => {
    setSavingSettings(true);
    setError("");
    setSmsSaveSuccess("");
    const res = await fetch("/api/seller/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ smsHeader, smsFooter }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "문구 저장에 실패했습니다.");
    } else {
      writeSellerApiCache(SELLER_API.settings, { smsHeader, smsFooter });
      setSmsSaveSuccess("상·하단 문구가 저장되었습니다.");
    }
    setSavingSettings(false);
  };

  const handleCopyOutbound = async () => {
    const text = previewText.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      void bumpOutboundUsage(cart.map((line) => line.productId));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("복사에 실패했습니다.");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">① 고객 안내 문자</h2>
        <p className="mt-1 text-sm text-slate-500">
          상품을 담고 문자를 복사해 고객에게 보냅니다.
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-6 shadow-sm">
        <h3 className="mb-1 flex items-center gap-2 font-semibold text-slate-900">
          <MessageSquare className="h-5 w-5 text-blue-600" />
          안내 문자 작성
        </h3>
        <p className="mb-4 text-xs text-slate-500">
          상품을 담으면 본문에 한 줄씩 누적되고, 우측 미리보기에 바로
          반영됩니다.
        </p>

        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-800">
                상·하단 문구
              </h4>
              <p className="text-xs text-slate-500">
                한 번 저장하면 다음에도 그대로 씁니다
              </p>
            </div>
            <button
              type="button"
              onClick={handleSaveSmsSettings}
              disabled={savingSettings}
              className="flex shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
            >
              {savingSettings ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              상·하단 저장
            </button>
          </div>
          {smsSaveSuccess && (
            <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
              {smsSaveSuccess}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-slate-600">
                  상단 (인사말 등)
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
                className={`${SELLER_INPUT_CLASS} min-h-[72px] resize-y bg-white`}
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
                  하단 (계좌번호·안내 등)
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
                className={`${SELLER_INPUT_CLASS} min-h-[72px] resize-y bg-white`}
                placeholder={getDefaultSmsFooter()}
                value={smsFooter}
                onChange={(e) => setSmsFooter(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[200px] flex-1">
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  상품 검색 (본문) — ★ 인기 · 최근 안내 우선
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
                  className={`${SELLER_INPUT_CLASS} bg-white`}
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
              <div className="mb-2 flex items-center justify-between gap-2">
                <h4 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                  <ShoppingCart className="h-4 w-4" />
                  장바구니
                </h4>
                <div className="flex items-center gap-2">
                  {cart.length > 0 && (
                    <>
                      <span className="text-sm font-semibold text-blue-700">
                        {outboundRemoteArea
                          ? `총 ${formatKrw(cartGrandTotal)}`
                          : `합계 ${formatKrw(cartSubtotal)}`}
                      </span>
                      <button
                        type="button"
                        onClick={clearCart}
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        초기화
                      </button>
                    </>
                  )}
                </div>
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

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                checked={outboundRemoteArea}
                onChange={(e) => setOutboundRemoteArea(e.target.checked)}
              />
              <span>
                <span className="block text-sm font-medium text-slate-800">
                  제주·도서산간 (+{formatKrw(REMOTE_SHIPPING_SURCHARGE)}/품목)
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  체크 시 미리보기·복사 문자에 품목당{" "}
                  {formatKrw(REMOTE_SHIPPING_SURCHARGE)}이 추가됩니다.
                </span>
              </span>
            </label>
          </div>

          <div className="space-y-3 md:sticky md:top-4 md:self-start">
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-slate-600">
                  미리보기 (직접 수정 가능 · 복사해서 문자 앱에 붙여넣기)
                </label>
                {previewText !== outboundPreview && (
                  <button
                    type="button"
                    onClick={() => setPreviewText(outboundPreview)}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800"
                  >
                    자동 생성으로 되돌리기
                  </button>
                )}
              </div>
              <textarea
                className={`${SELLER_INPUT_CLASS} min-h-[240px] resize-y bg-white font-sans text-sm leading-relaxed text-slate-800`}
                value={previewText}
                onChange={(e) => setPreviewText(e.target.value)}
                placeholder="상·하단 문구를 저장하거나 상품을 담으면 미리보기가 표시됩니다."
              />
            </div>
            <button
              type="button"
              onClick={handleCopyOutbound}
              disabled={!previewText.trim()}
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
    </div>
  );
}
