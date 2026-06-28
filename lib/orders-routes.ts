/** 발주 입력 기본 탭 */
export const ORDERS_DEFAULT_TAB = "paste" as const;

export type OrdersInputTab = "paste" | "import";

export const ORDERS_TAB_HREF: Record<OrdersInputTab, string> = {
  paste: "/seller/reply",
  import: "/seller/reply/import",
};

export const ORDERS_TABS: {
  id: OrdersInputTab;
  label: string;
  description: string;
}[] = [
  {
    id: "paste",
    label: "붙여넣기",
    description: "문자·스크린샷으로 1건 분석",
  },
  {
    id: "import",
    label: "XML 가져오기",
    description: "기능 개발 중",
  },
];

/** XML 가져오기 위저드 단계 (순서 고정) */
export const SMS_IMPORT_STEPS = [
  {
    id: "upload",
    label: "업로드",
    title: "XML 파일 선택",
    summary: "SMS Backup & Restore에서 백업한 sms-*.xml 파일을 올립니다.",
  },
  {
    id: "filter",
    label: "필터",
    title: "가져올 문자 골라내기",
    summary: "수신 문자·기간·주문 형태만 남깁니다. 광고·입금 알림 등은 제외합니다.",
  },
  {
    id: "preview",
    label: "미리보기",
    title: "목록 확인·선택",
    summary: "본문 앞부분과 날짜를 보고 가져올 건만 체크합니다.",
  },
  {
    id: "parse",
    label: "파싱",
    title: "일괄 분석",
    summary: "선택한 문자를 발주 형식으로 자동 분석합니다. (학습 규칙 반영)",
  },
  {
    id: "review",
    label: "확인·저장",
    title: "초안 검토 후 저장",
    summary:
      "상품·수량·주소를 확인하고 저장합니다. 이후 발주 목록에서 입금·xlsx 처리합니다.",
  },
] as const;

export type SmsImportStepId = (typeof SMS_IMPORT_STEPS)[number]["id"];

export function ordersTabFromPath(pathname: string): OrdersInputTab {
  if (pathname.startsWith("/seller/reply/import")) return "import";
  return "paste";
}

export function isOrdersPath(pathname: string): boolean {
  return (
    pathname === "/seller/orders" ||
    pathname.startsWith("/seller/orders/") ||
    pathname === "/seller/reply" ||
    pathname.startsWith("/seller/reply/")
  );
}
