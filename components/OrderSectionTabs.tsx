"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ORDERS_TAB_HREF,
  ORDERS_TABS,
  ordersTabFromPath,
} from "@/lib/orders-routes";

export default function OrderSectionTabs() {
  const pathname = usePathname();
  const active = ordersTabFromPath(pathname);

  return (
    <nav
      className="mb-6 flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
      aria-label="발주 입력 방식"
    >
      {ORDERS_TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <Link
            key={tab.id}
            href={ORDERS_TAB_HREF[tab.id]}
            className={`flex-1 rounded-lg px-4 py-3 text-center transition ${
              isActive
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span className="block text-sm font-semibold">{tab.label}</span>
            <span
              className={`mt-0.5 block text-xs ${
                isActive ? "text-emerald-100" : "text-slate-400"
              }`}
            >
              {tab.description}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
