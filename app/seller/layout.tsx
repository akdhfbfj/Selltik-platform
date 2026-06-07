import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SellerNav from "@/components/SellerNav";
import { getSellerSession } from "@/lib/supabase/server-auth";
import { getShopByAuthUserId } from "@/lib/shops";

export const metadata: Metadata = {
  title: "셀틱 발주 관리",
  description: "셀틱 셀러 발주·안내 문자·공급가 관리",
  openGraph: {
    title: "셀틱 발주 관리",
    description: "셀틱 셀러 발주·안내 문자·공급가 관리",
  },
};

export default async function SellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSellerSession();
  if (!user) {
    return <>{children}</>;
  }

  const shop = await getShopByAuthUserId(user.id);
  if (!shop) {
    redirect("/seller/login");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <SellerNav shopName={shop.name} />
      {children}
    </div>
  );
}
