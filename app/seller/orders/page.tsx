"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import KakaoPostcodePicker, {
  KAKAO_POSTCODE_SCRIPT,
  type PostcodePickResult,
} from "@/components/KakaoPostcodePicker";
import OrderDateCalendar from "@/components/OrderDateCalendar";
import OrderEditForm, {
  type OrderEditState,
} from "@/components/OrderEditForm";
import Script from "next/script";
import ProductSearchInput from "@/components/ProductSearchInput";
import { extractTextFromImage } from "@/lib/extract-image-text";
import { sumCelticDeposit } from "@/lib/export-order-xlsx";
import { findDuplicateOrders } from "@/lib/order-duplicates";
import { matchesOrderSearch } from "@/lib/order-search";
import {
  calcOrderPricing,
  recalcDraftPricing,
} from "@/lib/order-pricing";
import { formatKrw } from "@/lib/parse-supply-csv";
import { REMOTE_SHIPPING_SURCHARGE } from "@/lib/remote-area";
import { SELLER_INPUT_CLASS } from "@/lib/seller-ui";
import type {
  Order,
  OrderDraftPreview,
  OrderListTab,
  SellerProductView,
} from "@/lib/types";
import { ORDER_LIST_TABS, ORDER_STATUS_LABELS } from "@/lib/types";
import {
  AlertTriangle,
  Banknote,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
  Download,
  ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatOrderDateLabel(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${y}년 ${Number(m)}월 ${Number(d)}일`;
}

const STATUS_BADGE: Record<Order["status"], string> = {
  draft: "bg-amber-100 text-amber-800",
  paid: "bg-emerald-100 text-emerald-800",
  exported: "bg-slate-100 text-slate-600",
  confirmed: "bg-blue-100 text-blue-800",
};

export default function SellerOrdersPage() {
  const [smsText, setSmsText] = useState("");
  const [draft, setDraft] = useState<OrderDraftPreview | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<SellerProductView[]>([]);
  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [shopName, setShopName] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(
    new Set()
  );
  const [exporting, setExporting] = useState(false);
  const [statusTab, setStatusTab] = useState<OrderListTab>("all");
  const [dateFilter, setDateFilter] = useState("");
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [updatingOrder, setUpdatingOrder] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const editFormRef = useRef<HTMLDivElement>(null);

  const draftPricing = useMemo(() => {
    if (!draft) return null;
    const product = draft.productId
      ? products.find((p) => p.id === draft.productId)
      : null;
    return calcOrderPricing(
      product,
      draft.quantity,
      draft.postalCode,
      draft.address,
      draft.isRemoteArea
    );
  }, [draft, products]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [ordersRes, productsRes, meRes] = await Promise.all([
      fetch("/api/seller/orders"),
      fetch("/api/seller/products"),
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
    if (meRes.ok) {
      const data = await meRes.json();
      setShopName(data.shop?.name ?? "");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setSelectedOrderIds(
      new Set(orders.filter((o) => o.status === "paid").map((o) => o.id))
    );
  }, [orders]);

  const statusCountsByDate = useMemo(() => {
    const map: Record<
      string,
      { draft: number; paid: number; exported: number }
    > = {};
    for (const o of orders) {
      if (
        o.status !== "draft" &&
        o.status !== "paid" &&
        o.status !== "exported"
      ) {
        continue;
      }
      const entry = map[o.orderDate] ?? { draft: 0, paid: 0, exported: 0 };
      entry[o.status]++;
      map[o.orderDate] = entry;
    }
    return map;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    let list = orders;
    if (statusTab !== "all") {
      list = list.filter((o) => o.status === statusTab);
    }
    if (dateFilter) {
      list = list.filter((o) => o.orderDate === dateFilter);
    }
    if (searchQuery.trim()) {
      list = list.filter((o) => matchesOrderSearch(o, searchQuery));
    }
    return list;
  }, [orders, statusTab, dateFilter, searchQuery]);

  const groupedByDate = useMemo(() => {
    const map = new Map<string, Order[]>();
    for (const o of filteredOrders) {
      const arr = map.get(o.orderDate) ?? [];
      arr.push(o);
      map.set(o.orderDate, arr);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredOrders]);

  const tabCounts = useMemo(() => {
    const counts: Record<OrderListTab, number> = {
      draft: 0,
      paid: 0,
      exported: 0,
      all: orders.length,
    };
    for (const o of orders) {
      if (o.status === "draft") counts.draft++;
      if (o.status === "paid") counts.paid++;
      if (o.status === "exported") counts.exported++;
    }
    return counts;
  }, [orders]);

  const draftDuplicates = useMemo(() => {
    if (!draft) return [];
    return findDuplicateOrders(orders, {
      orderDate: draft.orderDate ?? todayIso(),
      ordererName: draft.ordererName,
      recipientName: draft.recipientName,
      contactPhone: draft.contactPhone,
    });
  }, [draft, orders]);

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

  const handleParse = async () => {
    if (!smsText.trim()) return;
    setParsing(true);
    setError("");
    setSuccess("");
    const res = await fetch("/api/seller/orders/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: smsText }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "분석에 실패했습니다.");
    } else {
      setEditingOrder(null);
      setDraft(data.draft);
    }
    setParsing(false);
  };

  const applyPostcodePick = (result: PostcodePickResult) => {
    if (!draft) return;
    const product = draft.productId
      ? products.find((p) => p.id === draft.productId)
      : null;
    const { postalCode, address } = result;
    setDraft({
      ...draft,
      postalCode,
      address,
      ...recalcDraftPricing(
        { ...draft, postalCode, address },
        product,
        draft.isRemoteArea
      ),
    });
  };

  const handleRemoteToggle = (checked: boolean) => {
    if (!draft) return;
    const product = draft.productId
      ? products.find((p) => p.id === draft.productId)
      : null;
    updateDraft(recalcDraftPricing(draft, product, checked));
  };

  const updateDraft = (patch: Partial<OrderDraftPreview>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  };

  const handleProductSelect = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product || !draft) return;
    setDraft({
      ...draft,
      productId: product.id,
      productName: product.officialName,
      ...recalcDraftPricing(draft, product, draft.isRemoteArea),
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
    if (!confirm("이 발주를 삭제할까요?")) return;
    const res = await fetch(`/api/seller/orders/${id}`, { method: "DELETE" });
    if (res.ok) {
      if (editingOrder?.id === id) setEditingOrder(null);
      loadData();
    }
  };

  const openOrderEdit = (order: Order) => {
    setEditingOrder(order);
    setDraft(null);
    requestAnimationFrame(() => {
      editFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handleUpdateOrder = async (payload: OrderEditState) => {
    if (!editingOrder) return;
    setUpdatingOrder(true);
    setError("");
    setSuccess("");

    const res = await fetch(`/api/seller/orders/${editingOrder.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "수정에 실패했습니다.");
    } else {
      setSuccess("발주가 수정되었습니다.");
      setEditingOrder(null);
      loadData();
    }
    setUpdatingOrder(false);
  };

  const selectedOrders = useMemo(
    () => orders.filter((o) => selectedOrderIds.has(o.id)),
    [orders, selectedOrderIds]
  );

  const exportableSelected = useMemo(
    () => selectedOrders.filter((o) => o.status !== "draft"),
    [selectedOrders]
  );

  const exportCelticTotal = useMemo(
    () => sumCelticDeposit(exportableSelected),
    [exportableSelected]
  );

  const toggleOrderSelect = (id: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllOrders = () => {
    const ids = filteredOrders.map((o) => o.id);
    const allSelected = ids.every((id) => selectedOrderIds.has(id));
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleDateGroup = (date: string) => {
    setCollapsedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const selectDateGroup = (dateOrders: Order[]) => {
    const ids = dateOrders.map((o) => o.id);
    const allSelected = ids.every((id) => selectedOrderIds.has(id));
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const handleMarkPaid = async (id: string) => {
    setMarkingPaidId(id);
    setError("");
    const res = await fetch(`/api/seller/orders/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paid" }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "입금확인 처리에 실패했습니다.");
    } else {
      setSuccess("입금확인 처리되었습니다. 발주 준비 탭에서 xlsx를 출력하세요.");
      loadData();
    }
    setMarkingPaidId(null);
  };

  const orderHasDuplicate = (o: Order) =>
    findDuplicateOrders(orders, o, o.id).length > 0;

  const handleExportXlsx = async () => {
    if (selectedOrderIds.size === 0) return;
    setExporting(true);
    setError("");
    setSuccess("");

    const res = await fetch("/api/seller/orders/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderIds: [...selectedOrderIds] }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "발주서 다운로드에 실패했습니다.");
    } else {
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename\*=UTF-8''(.+)/);
      const filename = match
        ? decodeURIComponent(match[1])
        : `[발주] 발주서(${shopName || "셀러"}).xlsx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setSuccess(
        `${selectedOrderIds.size}건 발주서를 내려받았습니다. 상태가「다운로드 완료」로 바뀝니다.`
      );
      loadData();
    }
    setExporting(false);
  };

  return (
    <>
      <Script src={KAKAO_POSTCODE_SCRIPT} strategy="afterInteractive" />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900">② 답장 · 발주</h2>
          <p className="mt-1 text-sm text-slate-500">
            고객 답장 분석 → 저장 → 입금확인 → xlsx 출력
          </p>
        </div>

        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50/30 p-6 shadow-sm">
          <h3 className="mb-1 flex items-center gap-2 font-semibold text-slate-900">
            <ClipboardPaste className="h-5 w-5 text-emerald-600" />
            고객 답장 붙여넣기
          </h3>
          <p className="mb-3 text-xs text-slate-500">
            문자 내용을 붙여넣거나, 스크린샷 이미지를 붙여넣기(Ctrl+V)·업로드하면
            글자를 추출합니다.
          </p>
          <textarea
            className={`${SELLER_INPUT_CLASS} min-h-[140px] resize-y bg-white`}
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

            {draftDuplicates.length > 0 && (
              <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  같은 발주일·주문자·수령인·연락처 발주가{" "}
                  <span className="font-semibold">{draftDuplicates.length}건</span>{" "}
                  이미 있습니다. 중복 저장이 아닌지 확인해 주세요.
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  주문일
                </label>
                <input
                  type="date"
                  className={SELLER_INPUT_CLASS}
                  value={draft.customerOrderDate ?? todayIso()}
                  onChange={(e) =>
                    updateDraft({ customerOrderDate: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  발주일
                </label>
                <input
                  type="date"
                  className={SELLER_INPUT_CLASS}
                  value={draft.orderDate ?? todayIso()}
                  onChange={(e) => updateDraft({ orderDate: e.target.value })}
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  xlsx 묶음·목록 그룹 기준
                </p>
              </div>
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
                  className={SELLER_INPUT_CLASS}
                  value={draft.quantity}
                  onChange={(e) => {
                    const quantity = Math.max(1, parseInt(e.target.value, 10) || 1);
                    if (!draft) return;
                    const product = draft.productId
                      ? products.find((p) => p.id === draft.productId)
                      : null;
                    updateDraft({
                      quantity,
                      ...recalcDraftPricing(
                        { ...draft, quantity },
                        product,
                        draft.isRemoteArea
                      ),
                    });
                  }}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  주문자
                </label>
                <input
                  className={SELLER_INPUT_CLASS}
                  value={draft.ordererName}
                  onChange={(e) => updateDraft({ ordererName: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  수령인
                </label>
                <input
                  className={SELLER_INPUT_CLASS}
                  value={draft.recipientName}
                  onChange={(e) => updateDraft({ recipientName: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  연락처1
                </label>
                <input
                  className={SELLER_INPUT_CLASS}
                  value={draft.contactPhone}
                  onChange={(e) => updateDraft({ contactPhone: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  연락처2
                </label>
                <input
                  className={SELLER_INPUT_CLASS}
                  value={draft.contactPhone2}
                  onChange={(e) => updateDraft({ contactPhone2: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  우편번호
                </label>
                <input
                  className={SELLER_INPUT_CLASS}
                  value={draft.postalCode}
                  onChange={(e) => updateDraft({ postalCode: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  주소
                </label>
                <KakaoPostcodePicker
                  rawAddress={draft.address}
                  onPick={applyPostcodePick}
                  onStatus={(msg) => {
                    setError("");
                    setSuccess(msg);
                  }}
                  inputSlot={
                    <input
                      className={`${SELLER_INPUT_CLASS} min-w-0 flex-1`}
                      value={draft.address}
                      onChange={(e) => updateDraft({ address: e.target.value })}
                    />
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  배송메모
                </label>
                <input
                  className={SELLER_INPUT_CLASS}
                  value={draft.shippingMemo}
                  onChange={(e) => updateDraft({ shippingMemo: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    checked={draft.isRemoteArea}
                    onChange={(e) => handleRemoteToggle(e.target.checked)}
                  />
                  <span>
                    <span className="block text-sm font-medium text-slate-800">
                      제주·도서산간 (+{formatKrw(REMOTE_SHIPPING_SURCHARGE)}/품목)
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      문자를 보고 직접 체크하세요. 품목당{" "}
                      {formatKrw(REMOTE_SHIPPING_SURCHARGE)} 추가
                    </span>
                  </span>
                </label>
              </div>
            </div>

            {draftPricing && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 text-sm">
                <h4 className="mb-3 font-semibold text-slate-900">
                  금액 확인 (저장 전)
                </h4>
                <div className="space-y-2 rounded-lg bg-white p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-slate-600">고객 입금액</span>
                      <p className="text-xs text-slate-400">판매가 기준</p>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-slate-900">
                        {formatKrw(draftPricing.customerDepositAmount)}
                      </span>
                      {draft.quantity > 1 &&
                        draft.productMatch.consumerPrice > 0 && (
                          <p className="text-xs text-slate-400">
                            {formatKrw(draft.productMatch.consumerPrice)} ×{" "}
                            {draft.quantity}
                          </p>
                        )}
                    </div>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-slate-600">셀틱 입금액</span>
                      <p className="text-xs text-slate-400">공급가표 계(E열)</p>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-emerald-700">
                        {formatKrw(draftPricing.celticDepositAmount)}
                      </span>
                      {draftPricing.unitSupplyTotal > 0 && (
                        <p className="text-xs text-slate-400">
                          {formatKrw(draftPricing.unitSupplyTotal)} ×{" "}
                          {draft.quantity}
                          {draftPricing.remoteSurcharge > 0 &&
                            ` + 도서산간 ${formatKrw(draftPricing.remoteSurcharge)}`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start justify-between gap-4 border-t border-slate-100 pt-2">
                    <div>
                      <span className="font-semibold text-slate-800">차액</span>
                      <p className="text-xs text-slate-400">고객 입금 − 셀틱 입금</p>
                    </div>
                    <span
                      className={`font-bold ${
                        draftPricing.marginAmount >= 0
                          ? "text-blue-700"
                          : "text-red-600"
                      }`}
                    >
                      {formatKrw(draftPricing.marginAmount)}
                    </span>
                  </div>
                </div>
              </div>
            )}

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

        <div
          id="export"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-900">저장된 발주</h3>
              <p className="mt-1 text-xs text-slate-500">
                입금확인 후 선택하여 셀틱 발주서(xlsx)를 내려받습니다.
              </p>
            </div>
            {orders.length > 0 && (
              <button
                type="button"
                onClick={handleExportXlsx}
                disabled={
                  exporting ||
                  exportableSelected.length === 0 ||
                  selectedOrders.some((o) => o.status === "draft")
                }
                className="flex shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {exporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                xlsx 다운로드 ({exportableSelected.length}건)
              </button>
            )}
          </div>

          {editingOrder && (
            <div ref={editFormRef}>
              <OrderEditForm
                key={editingOrder.id}
                order={editingOrder}
                products={products}
                saving={updatingOrder}
                onSave={handleUpdateOrder}
                onCancel={() => setEditingOrder(null)}
              />
            </div>
          )}

          <div className="mb-4">
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <Search className="h-3.5 w-3.5" />
              검색
            </label>
            <input
              type="search"
              className={`${SELLER_INPUT_CLASS} bg-white`}
              placeholder="상품명, 주문자, 수령인, 전화번호, 주소…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {ORDER_LIST_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusTab(tab.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  statusTab === tab.id
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {tab.label} ({tabCounts[tab.id]})
              </button>
            ))}
          </div>

          {orders.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-medium text-slate-500">
                발주일 달력 (빨강·초록·파랑 = 입금대기·발주준비·다운로드완료)
              </p>
              <OrderDateCalendar
                countsByDate={statusCountsByDate}
                selectedDate={dateFilter}
                onSelectDate={setDateFilter}
              />
            </div>
          )}

          {exportableSelected.length > 0 && (
            <p className="mb-4 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
              선택 {exportableSelected.length}건 · 셀틱 입금액 합계:{" "}
              <span className="font-semibold">{formatKrw(exportCelticTotal)}</span>
            </p>
          )}
          {selectedOrders.some((o) => o.status === "draft") && (
            <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              입금 대기 건은 xlsx에 포함할 수 없습니다. 먼저 입금확인을 해 주세요.
            </p>
          )}

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              {orders.length === 0
                ? "아직 저장된 발주가 없습니다."
                : "해당 조건의 발주가 없습니다."}
            </p>
          ) : (
            <div className="space-y-4">
              <label className="flex cursor-pointer items-center gap-2 px-1 text-xs text-slate-500">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={
                    filteredOrders.length > 0 &&
                    filteredOrders.every((o) => selectedOrderIds.has(o.id))
                  }
                  onChange={toggleAllOrders}
                />
                현재 목록 전체 선택 ({filteredOrders.length}건)
              </label>

              {groupedByDate.map(([date, dateOrders]) => {
                const collapsed = collapsedDates.has(date);
                const dateTotal = dateOrders.reduce(
                  (sum, o) => sum + (o.celticDepositAmount ?? o.supplyTotal),
                  0
                );
                const dateAllSelected = dateOrders.every((o) =>
                  selectedOrderIds.has(o.id)
                );

                return (
                  <div
                    key={date}
                    className="overflow-hidden rounded-xl border border-slate-200"
                  >
                    <div className="flex flex-wrap items-center gap-2 bg-slate-50 px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleDateGroup(date)}
                        className="flex items-center gap-1 text-sm font-semibold text-slate-800"
                      >
                        {collapsed ? (
                          <ChevronRight className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                        {formatOrderDateLabel(date)}
                      </button>
                      <span className="text-xs text-slate-500">
                        {dateOrders.length}건 · {formatKrw(dateTotal)}
                      </span>
                      <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-xs text-slate-500">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 rounded border-slate-300"
                          checked={dateAllSelected}
                          onChange={() => selectDateGroup(dateOrders)}
                        />
                        이 날짜 전체
                      </label>
                    </div>

                    {!collapsed && (
                      <div className="space-y-2 p-3">
                        {dateOrders.map((o) => (
                          <div
                            key={o.id}
                            className={`rounded-xl border p-4 text-sm ${
                              selectedOrderIds.has(o.id)
                                ? "border-blue-200 bg-blue-50/30"
                                : "border-slate-200 bg-white"
                            }`}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="flex min-w-0 flex-1 items-start gap-3">
                                <input
                                  type="checkbox"
                                  className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300"
                                  checked={selectedOrderIds.has(o.id)}
                                  onChange={() => toggleOrderSelect(o.id)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <button
                                  type="button"
                                  onClick={() => openOrderEdit(o)}
                                  className={`min-w-0 flex-1 rounded-lg text-left transition-colors hover:bg-slate-50/80 ${
                                    editingOrder?.id === o.id
                                      ? "ring-2 ring-blue-300 ring-offset-1"
                                      : ""
                                  }`}
                                >
                                  <p className="font-medium text-slate-900">
                                    {o.productName}
                                  </p>
                                  <p className="mt-1 text-slate-500">
                                    {o.ordererName} → {o.recipientName} ·{" "}
                                    {o.contactPhone} · 수량 {o.quantity}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-400">
                                    주문{" "}
                                    {o.customerOrderDate.slice(5).replace("-", "/")}
                                    {o.customerOrderDate !== o.orderDate &&
                                      ` · 발주 ${o.orderDate.slice(5).replace("-", "/")}`}
                                  </p>
                                  <p className="mt-0.5 text-xs text-slate-400 line-clamp-1">
                                    {o.address}
                                  </p>
                                  {orderHasDuplicate(o) && (
                                    <p className="mt-1 flex items-center gap-1 text-xs text-amber-700">
                                      <AlertTriangle className="h-3 w-3" />
                                      같은 날·동일 수신인 중복 가능
                                    </p>
                                  )}
                                  <p className="mt-1 flex items-center gap-1 text-xs text-blue-600">
                                    <Pencil className="h-3 w-3" />
                                    클릭하여 수정
                                  </p>
                                </button>
                              </div>
                              <div className="text-right">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[o.status]}`}
                                >
                                  {ORDER_STATUS_LABELS[o.status]}
                                </span>
                                <p className="mt-1 font-semibold text-emerald-700">
                                  {formatKrw(o.supplyTotal)}
                                </p>
                              </div>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {o.status === "draft" && (
                                <button
                                  type="button"
                                  onClick={() => handleMarkPaid(o.id)}
                                  disabled={markingPaidId === o.id}
                                  className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                                >
                                  {markingPaidId === o.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Banknote className="h-3 w-3" />
                                  )}
                                  입금확인
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(o.id)}
                                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="h-3 w-3" />
                                삭제
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
