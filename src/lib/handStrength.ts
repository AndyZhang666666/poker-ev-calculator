// 起手牌 → 强度表 key 的映射，以及牌面相关的小工具。
// 表本身在 handStrengthTable.ts（生成产物，别手改）。

import { HAND_STRENGTH } from "./handStrengthTable.ts";
import type { Card, Rank, Suit } from "./types.ts";

export { HAND_STRENGTH } from "./handStrengthTable.ts";

export const RANKS: readonly Rank[] = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
export const SUITS: readonly Suit[] = ["s", "h", "d", "c"];

export const SUIT_SYMBOL: Record<Suit, string> = { s: "♠", h: "♥", d: "♦", c: "♣" };
export const SUIT_NAME: Record<Suit, string> = { s: "黑桃", h: "红心", d: "方块", c: "梅花" };
export const RANK_LABEL: Record<Rank, string> = {
  A: "A", K: "K", Q: "Q", J: "J", T: "10", "9": "9", "8": "8", "7": "7", "6": "6", "5": "5", "4": "4", "3": "3", "2": "2",
};

export function rankValue(r: Rank): number {
  return 14 - RANKS.indexOf(r);
}

/** 两张牌 → 表 key，如 A♠K♥ → "AKo"，K♠Q♠ → "KQs"，9♠9♥ → "99" */
export function handKey(a: Card, b: Card): string {
  const [hi, lo] = rankValue(a.rank) >= rankValue(b.rank) ? [a, b] : [b, a];
  if (hi.rank === lo.rank) return `${hi.rank}${lo.rank}`;
  return `${hi.rank}${lo.rank}${hi.suit === lo.suit ? "s" : "o"}`;
}

/** 起手牌强度；两张同一张牌（非法）时返回 null */
export function handStrengthOf(a: Card, b: Card): number | null {
  if (a.rank === b.rank && a.suit === b.suit) return null;
  return HAND_STRENGTH[handKey(a, b)] ?? null;
}

export function cardLabel(c: Card): string {
  return `${RANK_LABEL[c.rank]}${SUIT_SYMBOL[c.suit]}`;
}

export function sameCard(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}

/** 按强度分档，UI 上给个定性标签 */
export function strengthTier(s: number): { label: string; tone: "strong" | "good" | "mid" | "weak" } {
  if (s >= 80) return { label: "顶级", tone: "strong" };
  if (s >= 60) return { label: "强牌", tone: "good" };
  if (s >= 35) return { label: "中等", tone: "mid" };
  return { label: "弱牌", tone: "weak" };
}
