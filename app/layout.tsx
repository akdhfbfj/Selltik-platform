import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const notoSans = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "셀틱 발주 관리",
  description: "셀틱 셀러 발주·안내 문자·공급가 관리",
  openGraph: {
    title: "셀틱 발주 관리",
    description: "셀틱 셀러 발주·안내 문자·공급가 관리",
    siteName: "셀틱",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className={`${notoSans.className} antialiased`}>{children}</body>
    </html>
  );
}
