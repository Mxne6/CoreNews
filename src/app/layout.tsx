import type { Metadata } from "next";
import { Noto_Sans_SC } from "next/font/google";
import { TopNav } from "@/components/top-nav";
import "./globals.css";

const notoSansSc = Noto_Sans_SC({
  variable: "--font-core-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "CoreNews 情报终端",
  description: "多领域每日热点情报看板。",
  icons: {
    icon: [
      {
        url: "/brand/corenews-mark-a-dark.svg",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/brand/corenews-mark-a-light.svg",
        media: "(prefers-color-scheme: light)",
      },
    ],
    shortcut: "/brand/corenews-mark-a-dark.svg",
    apple: "/brand/corenews-mark-a-light.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${notoSansSc.variable} antialiased`}>
        <TopNav />
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.14),transparent_40%),radial-gradient(circle_at_80%_10%,rgba(139,92,246,0.14),transparent_35%),linear-gradient(180deg,#0b1220_0%,#0a0f1f_48%,#090e1a_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] opacity-30" />
        </div>
        <div className="relative z-10 pt-24 sm:pt-28">{children}</div>
      </body>
    </html>
  );
}