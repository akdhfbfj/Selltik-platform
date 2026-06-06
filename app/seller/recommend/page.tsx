import { redirect } from "next/navigation";
import RecommendForm from "@/components/RecommendForm";
import SellerRecommendList from "@/components/SellerRecommendList";
import { getShopByAuthUserId } from "@/lib/shops";
import { getSellerSession } from "@/lib/supabase/server-auth";

export default async function SellerRecommendPage() {
  const user = await getSellerSession();
  if (!user) {
    redirect("/seller/login?from=/seller/recommend");
  }

  const shop = await getShopByAuthUserId(user.id);
  if (!shop) {
    redirect("/seller/login");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-8 border-b border-slate-200 pb-6">
        <h2 className="text-2xl font-bold text-slate-900">신상품 추천</h2>
        <p className="mt-1 text-sm text-slate-500">
          로그인된 쇼핑몰({shop.name})으로 추천이 등록됩니다.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
        <RecommendForm variant="seller" shopName={shop.name} />
      </div>

      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
        <h3 className="mb-4 font-semibold text-slate-900">내 추천 내역</h3>
        <SellerRecommendList />
      </div>
    </div>
  );
}
