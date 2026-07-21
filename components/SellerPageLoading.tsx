export default function SellerPageLoading() {
  return (
    <div className="flex justify-center py-24">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600"
        role="status"
        aria-label="로딩 중"
      />
    </div>
  );
}
