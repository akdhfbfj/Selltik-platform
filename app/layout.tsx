import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR } from "next/font/google";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import "./globals.css";

const notoSans = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "셀틱 발주 관리",
  description: "셀틱 셀러 발주·안내 문자·공급가 관리",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "셀틱",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "셀틱 발주 관리",
    description: "셀틱 셀러 발주·안내 문자·공급가 관리",
    siteName: "셀틱",
  },
};

export const viewport: Viewport = {
  themeColor: "#006fc5",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className={`${notoSans.className} antialiased`}>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
