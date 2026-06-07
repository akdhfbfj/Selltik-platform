import type { ParsedOrderSms } from "./parse-order-sms";

export type ContactStatus =
  | "new"
  | "contacting"
  | "in_progress"
  | "done"
  | "rejected";

/** DB에 남아 있는 예전 상태값 호환 */
export function normalizeContactStatus(status: string): ContactStatus {
  if (status === "pending" || status === "contacted") return "contacting";
  if (
    status === "new" ||
    status === "contacting" ||
    status === "in_progress" ||
    status === "done" ||
    status === "rejected"
  ) {
    return status;
  }
  return "new";
}

export type RecommendationStatus = "new" | "reviewing" | "adopted" | "rejected";

export interface Contact {
  id: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  productInfo: string;
  notes: string;
  status: ContactStatus;
  tags: string;
  uploadedBy: string;
  recommendationId: string;
  images: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ContactInput {
  companyName: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  productInfo?: string;
  notes?: string;
  status?: ContactStatus;
  tags?: string;
  uploadedBy?: string;
  recommendationId?: string;
}

export interface Recommendation {
  id: string;
  productName: string;
  brand: string;
  reason: string;
  referenceUrl: string;
  desiredPrice: string;
  sellerName: string;
  shopId: string;
  status: RecommendationStatus;
  images: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RecommendationInput {
  productName: string;
  brand?: string;
  reason?: string;
  referenceUrl?: string;
  desiredPrice?: string;
  sellerName: string;
  shopId?: string;
}

export const RECOMMENDATION_STATUS_LABELS: Record<RecommendationStatus, string> = {
  new: "신규",
  reviewing: "검토중",
  adopted: "업체컨택중",
  rejected: "보류",
};

export const RECOMMENDATION_STATUS_COLORS: Record<RecommendationStatus, string> = {
  new: "bg-emerald-100 text-emerald-800",
  reviewing: "bg-amber-100 text-amber-800",
  adopted: "bg-blue-100 text-blue-800",
  rejected: "bg-slate-100 text-slate-600",
};

export const STATUS_LABELS: Record<ContactStatus, string> = {
  new: "신규",
  contacting: "연락중",
  in_progress: "진행 중",
  done: "완료",
  rejected: "보류",
};

export const STATUS_COLORS: Record<ContactStatus, string> = {
  new: "bg-slate-100 text-slate-700",
  contacting: "bg-blue-100 text-blue-800",
  in_progress: "bg-purple-100 text-purple-800",
  done: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

export const STATUS_DESCRIPTIONS: Record<ContactStatus, string> = {
  new: "등록됨, 연락 전",
  contacting: "업체에 연락함",
  in_progress: "협의·샘플 중",
  done: "입점·거래 확정",
  rejected: "패스·재검토",
};

export const STATUS_OPTIONS: { value: ContactStatus; label: string }[] = [
  { value: "new", label: "신규" },
  { value: "contacting", label: "연락중" },
  { value: "in_progress", label: "진행 중" },
  { value: "done", label: "완료" },
  { value: "rejected", label: "보류" },
];

export const STATUS_ORDER: ContactStatus[] = [
  "new",
  "contacting",
  "in_progress",
  "done",
  "rejected",
];

export interface ContactActivity {
  id: string;
  contactId: string;
  content: string;
  author: string;
  createdAt: string;
}

export interface ContactActivityInput {
  content: string;
  author?: string;
}

/** 추후 발주 모듈·셀러 구독용 (shops 테이블) */
export type ShopPlan = "free" | "pro";

export interface Shop {
  id: string;
  name: string;
  plan: ShopPlan;
  contactEmail: string;
  authUserId: string;
  smsHeader: string;
  smsFooter: string;
  createdAt: string;
}

export interface ShopSmsSettings {
  smsHeader: string;
  smsFooter: string;
}

export interface ShopInput {
  name: string;
  contactEmail: string;
  password: string;
  plan?: ShopPlan;
}

export interface MasterProduct {
  id: string;
  officialName: string;
  description: string;
  purchasePrice: number;
  baseShipping: number;
  supplyTotal: number;
  consumerPrice: number;
  profitAmount: number;
  profitRate: string;
  sortOrder: number;
  updatedAt: string;
}

export interface SellerProductView extends MasterProduct {
  smsName: string;
  /** 공급가·판매가 등 마스터 정보 변경 시 셀러 확인 필요 */
  needsReview: boolean;
}

export interface MasterProductInput {
  officialName: string;
  description?: string;
  purchasePrice: number;
  baseShipping: number;
  consumerPrice: number;
  profitAmount?: number;
  profitRate?: string;
}

export type OrderStatus = "draft" | "confirmed" | "exported" | "paid";

export interface Order {
  id: string;
  shopId: string;
  productId: string | null;
  /** 고객 주문일 */
  customerOrderDate: string;
  /** 셀틱 발주·xlsx 묶음 기준일 */
  orderDate: string;
  productName: string;
  quantity: number;
  ordererName: string;
  recipientName: string;
  contactPhone: string;
  contactPhone2: string;
  postalCode: string;
  address: string;
  shippingMemo: string;
  purchasePrice: number;
  shippingFee: number;
  supplyTotal: number;
  celticDepositAmount: number | null;
  isRemoteArea: boolean;
  rawSmsText: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface OrderInput {
  productId?: string | null;
  /** 주문일 (yyyy-mm-dd) */
  customerOrderDate?: string;
  /** 발주일 (yyyy-mm-dd) */
  orderDate?: string;
  celticDepositAmount?: number;
  productName: string;
  quantity: number;
  ordererName: string;
  recipientName: string;
  contactPhone: string;
  contactPhone2?: string;
  postalCode: string;
  address: string;
  shippingMemo?: string;
  purchasePrice: number;
  shippingFee: number;
  supplyTotal: number;
  isRemoteArea: boolean;
  rawSmsText?: string;
  status?: OrderStatus;
}

export interface OrderDraftLineItem {
  id: string;
  productId: string | null;
  productName: string;
  quantity: number;
  purchasePrice: number;
  shippingFee: number;
  supplyTotal: number;
  celticDepositAmount: number;
  productMatch: {
    productId: string | null;
    officialName: string | null;
    matchedBy: "sms_alias" | "official_name" | "none";
    consumerPrice: number;
  };
}

/** 공통 배송정보 + 복수 상품 라인 */
export interface OrderDraftBundle {
  customerOrderDate: string;
  orderDate: string;
  ordererName: string;
  recipientName: string;
  contactPhone: string;
  contactPhone2: string;
  postalCode: string;
  address: string;
  shippingMemo: string;
  isRemoteArea: boolean;
  rawSmsText: string;
  status: "draft";
  autoParsed?: ParsedOrderSms;
  lines: OrderDraftLineItem[];
}

export interface OrderDraftPreview extends OrderInput {
  productMatch: {
    productId: string | null;
    officialName: string | null;
    matchedBy: "sms_alias" | "official_name" | "none";
    consumerPrice: number;
  };
  celticDepositAmount: number;
  /** 분석 직후 자동 파싱 결과 (셀러 수정 학습용) */
  autoParsed?: ParsedOrderSms;
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: "입금 대기",
  confirmed: "확정",
  exported: "다운로드 완료",
  paid: "입금확인",
};

export type OrderListTab = "draft" | "paid" | "exported" | "all";

export const ORDER_LIST_TABS: { id: OrderListTab; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "draft", label: "입금 대기" },
  { id: "paid", label: "발주 준비" },
  { id: "exported", label: "다운로드 완료" },
];

export type OrderDateStatusCounts = {
  draft: number;
  paid: number;
  exported: number;
};
