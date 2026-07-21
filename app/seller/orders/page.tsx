"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import OrderSpreadsheetTable from "@/components/OrderSpreadsheetTable";
import SegmentedDateInput from "@/components/SegmentedDateInput";
import OrderEditForm, {
  orderToEditState,
  type OrderEditState,
} from "@/components/OrderEditForm";
import { sumCelticDeposit } from "@/lib/export-order-xlsx";
import { findDuplicateOrders } from "@/lib/order-duplicates";
import { matchesOrderSearch } from "@/lib/order-search";
import type { CompletedGroup } from "@/lib/order-spreadsheet-display";
import { formatKrw } from "@/lib/parse-supply-csv";
import {
  fetchSellerApi,
  peekSellerApiData,
  SELLER_API,
} from "@/lib/seller-api-cache";
import { SELLER_INPUT_CLASS } from "@/lib/seller-ui";
import type { Order, OrderListTab, SellerProductView } from "@/lib/types";
import { ORDER_LIST_TABS } from "@/lib/types";
import {
  AlertTriangle,
  Banknote,
  Download,
  Loader2,
  Search,
  Trash2,
  Undo2,
} from "lucide-react";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

type OrdersPayload = { orders: Order[]; total?: number };
type ProductsPayload = { products: SellerProductView[] };
type MePayload = { shop?: { name?: string } | null };

export default function SellerOrdersPage() {
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<Order[]>(
    () => peekSellerApiData<OrdersPayload>(SELLER_API.orders)?.orders ?? []
  );
  const [products, setProducts] = useState<SellerProductView[]>(
    () =>
      peekSellerApiData<ProductsPayload>(SELLER_API.products)?.products ?? []
  );
  const [loading, setLoading] = useState(
    () => !peekSellerApiData(SELLER_API.orders)
  );
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [shopName, setShopName] = useState(
    () => peekSellerApiData<MePayload>(SELLER_API.me)?.shop?.name ?? ""
  );
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(
    new Set()
  );
  const [exporting, setExporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportOrderDate, setExportOrderDate] = useState("");
  const [exportMode, setExportMode] = useState<"preview" | "final">("final");
  const [statusTab, setStatusTab] = useState<OrderListTab>("draft");
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [bulkActioning, setBulkActioning] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [updatingOrder, setUpdatingOrder] = useState(false);
  const [savingShippingId, setSavingShippingId] = useState<string | null>(null);
  const [downloadingGroupKey, setDownloadingGroupKey] = useState<string | null>(
    null
  );

  const loadData = useCallback(async (opts?: { force?: boolean }) => {
    const force = opts?.force ?? false;
    if (force || !peekSellerApiData(SELLER_API.orders)) {
      setLoading(true);
    }

    const [ordersRes, productsRes, meRes] = await Promise.all([
      fetchSellerApi<OrdersPayload>(SELLER_API.orders, { force }),
      fetchSellerApi<ProductsPayload>(SELLER_API.products, { force }),
      fetchSellerApi<MePayload>(SELLER_API.me, { force }),
    ]);
    if (ordersRes.ok && ordersRes.data?.orders) {
      setOrders(ordersRes.data.orders);
    }
    if (productsRes.ok && productsRes.data?.products) {
      setProducts(productsRes.data.products);
    }
    if (meRes.ok && meRes.data) {
      setShopName(meRes.data.shop?.name ?? "");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "draft" || tab === "paid" || tab === "exported" || tab === "all") {
      setStatusTab(tab);
    }
  }, [searchParams]);

  const filteredOrders = useMemo(() => {
    let list = orders;
    if (statusTab !== "all") {
      list = list.filter((o) => o.status === statusTab);
    }
    if (searchQuery.trim()) {
      list = list.filter((o) => matchesOrderSearch(o, searchQuery));
    }
    return [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [orders, statusTab, searchQuery]);

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

  const handleDelete = async (id: string) => {
    if (!confirm("이 발주를 삭제할까요?")) return;
    const res = await fetch(`/api/seller/orders/${id}`, { method: "DELETE" });
    if (res.ok) {
      if (editingOrder?.id === id) setEditingOrder(null);
      setSelectedOrderIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      void loadData({ force: true });
    }
  };

  const openOrderEdit = (order: Order) => {
    setEditingOrder(order);
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
      void loadData({ force: true });
    }
    setUpdatingOrder(false);
  };

  const selectedOrders = useMemo(
    () => orders.filter((o) => selectedOrderIds.has(o.id)),
    [orders, selectedOrderIds]
  );

  const exportableSelected = useMemo(
    () => selectedOrders.filter((o) => o.status === "paid"),
    [selectedOrders]
  );

  const previewSelected = useMemo(
    () => selectedOrders.filter((o) => o.status === "draft"),
    [selectedOrders]
  );

  const selectedDraftOrders = useMemo(
    () => selectedOrders.filter((o) => o.status === "draft"),
    [selectedOrders]
  );

  const selectedPaidOrders = useMemo(
    () => selectedOrders.filter((o) => o.status === "paid"),
    [selectedOrders]
  );

  const paidFilteredOrders = useMemo(
    () => filteredOrders.filter((o) => o.status === "paid"),
    [filteredOrders]
  );

  const exportCelticTotal = useMemo(
    () =>
      sumCelticDeposit(
        exportMode === "preview" ? previewSelected : exportableSelected
      ),
    [exportMode, previewSelected, exportableSelected]
  );

  const toggleOrderSelect = (id: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllOrders = (checked: boolean) => {
    const ids = filteredOrders.map((o) => o.id);
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        ids.forEach((id) => next.add(id));
      } else {
        ids.forEach((id) => next.delete(id));
      }
      return next;
    });
  };

  const handleMarkPaid = async (order: Order) => {
    if (order.status !== "draft") return;
    setMarkingPaidId(order.id);
    setError("");
    const res = await fetch(`/api/seller/orders/${order.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paid" }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "입금 확인 처리에 실패했습니다.");
    } else {
      setSuccess(
        "입금 완료 처리되었습니다. 「최종 발주서」 탭에서 xlsx를 출력하세요."
      );
      void loadData({ force: true });
    }
    setMarkingPaidId(null);
  };

  const handleBulkMarkPaid = async () => {
    if (selectedDraftOrders.length === 0) return;
    setBulkActioning(true);
    setError("");
    setSuccess("");

    const res = await fetch("/api/seller/orders/bulk-status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderIds: selectedDraftOrders.map((o) => o.id),
        status: "paid",
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "일괄 입금 확인에 실패했습니다.");
    } else {
      setSuccess(
        `${data.count ?? selectedDraftOrders.length}건 입금 완료. 최종 발주서 탭에서 출력하세요.`
      );
      void loadData({ force: true });
    }
    setBulkActioning(false);
  };

  const revertOrdersToDraft = async (targets: Order[]) => {
    if (targets.length === 0) return;
    const paidOnly = targets.filter((o) => o.status === "paid");
    if (paidOnly.length === 0) return;
    if (
      !confirm(
        `${paidOnly.length}건을 임시 발주서로 되돌릴까요? 입금 완료 상태가 해제됩니다.`
      )
    ) {
      return;
    }

    setBulkActioning(true);
    setError("");
    setSuccess("");

    const res = await fetch("/api/seller/orders/bulk-status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderIds: paidOnly.map((o) => o.id),
        status: "draft",
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "임시 발주서로 되돌리기에 실패했습니다.");
    } else {
      setSuccess(
        `${data.count ?? paidOnly.length}건을 임시 발주서로 옮겼습니다.`
      );
      setSelectedOrderIds(new Set());
      setStatusTab("draft");
      void loadData({ force: true });
    }
    setBulkActioning(false);
  };

  const handleBulkRevertToDraft = () => revertOrdersToDraft(selectedPaidOrders);

  const handleRevertAllToDraft = () => revertOrdersToDraft(paidFilteredOrders);

  const handleShippingFeeChange = async (order: Order, shippingFee: number) => {
    setSavingShippingId(order.id);
    setError("");

    const base = orderToEditState(order);
    const supplyTotal = base.purchasePrice + shippingFee;
    const payload: OrderEditState = {
      ...base,
      shippingFee,
      supplyTotal,
      celticDepositAmount: supplyTotal,
    };

    const res = await fetch(`/api/seller/orders/${order.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "택배비 수정에 실패했습니다.");
    } else {
      setSuccess("택배비가 수정되었습니다.");
      void loadData({ force: true });
    }
    setSavingShippingId(null);
  };

  const handleBulkDelete = async () => {
    if (selectedOrders.length === 0) return;
    if (!confirm(`선택한 ${selectedOrders.length}건 발주를 삭제할까요?`)) {
      return;
    }
    setBulkActioning(true);
    setError("");
    setSuccess("");

    let deleted = 0;
    for (const o of selectedOrders) {
      const res = await fetch(`/api/seller/orders/${o.id}`, {
        method: "DELETE",
      });
      if (res.ok) deleted++;
    }

    if (deleted < selectedOrders.length) {
      setError(`${selectedOrders.length - deleted}건 삭제에 실패했습니다.`);
    } else {
      setSuccess(`${deleted}건 발주가 삭제되었습니다.`);
      setSelectedOrderIds(new Set());
      if (editingOrder && selectedOrders.some((o) => o.id === editingOrder.id)) {
        setEditingOrder(null);
      }
      void loadData({ force: true });
    }
    setBulkActioning(false);
  };

  const orderHasDuplicate = (o: Order) =>
    findDuplicateOrders(orders, o, o.id).length > 0;

  const openExportModal = (mode: "preview" | "final") => {
    const targets = mode === "preview" ? previewSelected : exportableSelected;
    if (targets.length === 0) return;
    const dates = targets.map((o) => o.orderDate).sort();
    setExportMode(mode);
    setExportOrderDate(dates.at(-1) ?? todayIso());
    setShowExportModal(true);
  };

  const handleExportXlsx = async () => {
    const targets =
      exportMode === "preview" ? previewSelected : exportableSelected;
    if (targets.length === 0 || !exportOrderDate) return;
    setExporting(true);
    setError("");
    setSuccess("");

    const res = await fetch("/api/seller/orders/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderIds: targets.map((o) => o.id),
        exportOrderDate,
        mode: exportMode,
      }),
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
        : exportMode === "preview"
          ? `[임시발주] 발주서(${shopName || "셀러"}).xlsx`
          : `[발주] 발주서(${shopName || "셀러"}).xlsx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setSuccess(
        exportMode === "preview"
          ? `${targets.length}건 임시 발주서를 내려받았습니다. (상태 변경 없음 · 입금 확인 후 최종 발주서로 출력)`
          : `${targets.length}건 최종 발주서를 내려받았습니다. 발주 완료 처리되었습니다.`
      );
      setShowExportModal(false);
      if (exportMode === "final") {
        setSelectedOrderIds(new Set());
        void loadData({ force: true });
      }
    }
    setExporting(false);
  };

  const handleRedownloadGroup = async (group: CompletedGroup) => {
    if (group.orders.length === 0) return;
    const orderDate = group.orders[0].orderDate;
    setDownloadingGroupKey(group.key);
    setError("");
    setSuccess("");

    const res = await fetch("/api/seller/orders/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderIds: group.orders.map((o) => o.id),
        exportOrderDate: orderDate,
        mode: "redownload",
      }),
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
        : `${group.title}.xlsx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setSuccess(
        `${group.orders.length}건 발주서를 다시 내려받았습니다. (${group.title})`
      );
    }
    setDownloadingGroupKey(null);
  };

  const sheetKind =
    statusTab === "draft"
      ? "temp"
      : statusTab === "exported"
        ? "done"
        : statusTab === "all"
          ? "all"
          : "final";

  const tabDescription =
    statusTab === "draft"
      ? "답장 분석에서 저장한 건입니다. 입금 확인 전에는 셀틱 발주(xlsx)에 넣지 마세요. 미리보기만 가능합니다."
      : statusTab === "paid"
        ? "입금 완료 건만 모입니다. 여기서 xlsx를 내려받으면 셀틱 발주가 확정됩니다."
        : statusTab === "exported"
          ? "이미 최종 발주서로 내려받은 건입니다. 노란 그룹에서 발주서를 다시 받을 수 있습니다."
          : "전체 발주 목록입니다.";

  return (
    <div>
      {!orders.length && !loading && (
        <div className="mb-6 rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/40 p-5 text-center">
          <p className="text-sm text-slate-600">
            새 발주는{" "}
            <Link
              href="/seller/reply"
              className="font-semibold text-emerald-700 underline hover:text-emerald-900"
            >
              답장 분석
            </Link>
            에서 분석 → 목록 저장 → 「임시 발주서에 저장」 순으로 진행하세요.
          </p>
        </div>
      )}

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

      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">
              {exportMode === "preview"
                ? "임시 발주서 미리보기"
                : "최종 발주서 다운로드"}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              선택{" "}
              {exportMode === "preview"
                ? previewSelected.length
                : exportableSelected.length}
              건 · 셀틱 입금액{" "}
              <span className="font-semibold text-emerald-700">
                {formatKrw(exportCelticTotal)}
              </span>
            </p>
            {exportMode === "preview" ? (
              <p className="mt-1 text-xs text-amber-700">
                미리보기는 상태를 바꾸지 않습니다. 셀틱 발주는 입금 확인 후
                최종 발주서로 출력하세요.
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">
                다운로드 후 해당 건은 「발주 완료」로 이동합니다.
              </p>
            )}
            <div className="mt-4">
              <label className="mb-2 block text-xs font-medium text-slate-600">
                발주일
              </label>
              <SegmentedDateInput
                value={exportOrderDate}
                onChange={setExportOrderDate}
              />
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={handleExportXlsx}
                disabled={exporting || !exportOrderDate}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {exporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                다운로드
              </button>
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                disabled={exporting}
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-600 hover:bg-slate-50"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {editingOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !updatingOrder && setEditingOrder(null)}
        >
          <div
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <OrderEditForm
              key={editingOrder.id}
              order={editingOrder}
              products={products}
              saving={updatingOrder}
              inModal
              onSave={handleUpdateOrder}
              onCancel={() => setEditingOrder(null)}
            />
          </div>
        </div>
      )}

      <div
        id="export"
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-900">발주 목록</h3>
            <p className="mt-1 text-xs text-slate-500">{tabDescription}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {statusTab === "draft" && (
              <button
                type="button"
                onClick={() => openExportModal("preview")}
                disabled={exporting || previewSelected.length === 0}
                className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                임시 미리보기 ({previewSelected.length}건)
              </button>
            )}
            {statusTab === "paid" && (
              <>
                <button
                  type="button"
                  onClick={handleRevertAllToDraft}
                  disabled={bulkActioning || paidFilteredOrders.length === 0}
                  className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                >
                  <Undo2 className="h-4 w-4" />
                  전체 임시로 ({paidFilteredOrders.length}건)
                </button>
                <button
                  type="button"
                  onClick={() => openExportModal("final")}
                  disabled={exporting || exportableSelected.length === 0}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  최종 발주서 ({exportableSelected.length}건)
                </button>
              </>
            )}
          </div>
        </div>

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

        {selectedOrderIds.size > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <span className="text-sm font-medium text-slate-700">
              {selectedOrderIds.size}건 선택
            </span>
            {selectedPaidOrders.length > 0 && statusTab === "paid" && (
              <button
                type="button"
                onClick={handleBulkRevertToDraft}
                disabled={bulkActioning}
                className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60"
              >
                {bulkActioning ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Undo2 className="h-3.5 w-3.5" />
                )}
                임시로 ({selectedPaidOrders.length})
              </button>
            )}
            {selectedDraftOrders.length > 0 && (
              <button
                type="button"
                onClick={handleBulkMarkPaid}
                disabled={bulkActioning}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {bulkActioning ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Banknote className="h-3.5 w-3.5" />
                )}
                입금 확인 ({selectedDraftOrders.length})
              </button>
            )}
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={bulkActioning}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              <Trash2 className="h-3.5 w-3.5" />
              삭제
            </button>
            <button
              type="button"
              onClick={() => setSelectedOrderIds(new Set())}
              className="ml-auto text-xs text-slate-500 hover:text-slate-700"
            >
              선택 해제
            </button>
          </div>
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
          <OrderSpreadsheetTable
            shopName={shopName}
            orders={filteredOrders}
            products={products}
            sheetKind={sheetKind}
            selectedIds={selectedOrderIds}
            onToggleSelect={toggleOrderSelect}
            onToggleAll={toggleAllOrders}
            onRowClick={openOrderEdit}
            onMarkPaid={
              statusTab === "draft" || statusTab === "all"
                ? handleMarkPaid
                : undefined
            }
            markingPaidId={markingPaidId}
            savingShippingId={savingShippingId}
            onShippingFeeChange={
              statusTab === "paid" || statusTab === "draft"
                ? handleShippingFeeChange
                : undefined
            }
            renderRowActions={(o) => (
              <div className="flex flex-col items-center gap-1">
                {orderHasDuplicate(o) && (
                  <span title="같은 날·동일 수신인 중복 가능">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                  </span>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(o.id);
                  }}
                  className="text-[9px] text-red-500 hover:text-red-700"
                >
                  삭제
                </button>
              </div>
            )}
            onDownloadGroup={
              statusTab === "exported" ? handleRedownloadGroup : undefined
            }
            downloadingGroupKey={downloadingGroupKey}
          />
        )}
      </div>
    </div>
  );
}
