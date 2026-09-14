import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Poker EV Calculator · 德州扑克期望值计算器",
  description: "输入牌面、底池、对手行动，实时看跟注 / 加注 / 弃牌的期望收益对比。全部计算在浏览器本地完成。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
