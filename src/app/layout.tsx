import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Poker Lab · 真实算牌、范围训练与错题重练",
  description: "按真实手牌、公共牌与对手范围计算摊牌权益；编辑位置范围、练习开池并保留错题。原 EV 沙盘继续可用，计算与记录留在浏览器本地。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
