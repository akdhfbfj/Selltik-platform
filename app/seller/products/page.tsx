import { redirect } from "next/navigation";
import SellerProductsClient from "@/components/SellerProductsClient";
import {
  countPendingProductReviews,
  getSellerProductViews,
} from "@/lib/products";
import { requireSellerShop } from "@/lib/seller";

export default async function SellerProductsPage() {
  const shop = await requireSellerShop();
  if (!shop) {
    redirect("/seller/login");
  }

  const [products, pendingReviewCount] = await Promise.all([
    getSellerProductViews(shop.id),
    countPendingProductReviews(shop.id),
  ]);

  return (
    <SellerProductsClient
      initialProducts={products}
      initialPendingCount={pendingReviewCount}
    />
  );
}
