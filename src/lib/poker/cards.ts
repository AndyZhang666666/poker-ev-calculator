export const RANKS = '23456789TJQKA';
export const SUITS = 'cdhs';
export type Card = string;
export const DECK: Card[] = [...RANKS].flatMap(rank => [...SUITS].map(suit => rank + suit));
export const SUIT_LABELS: Record<string, string> = {c: '♣', d: '♦', h: '♥', s: '♠'};

export function isCard(value: unknown): value is Card {
  return typeof value === 'string' && /^[2-9TJQKA][cdhs]$/.test(value);
}

export function assertCards(cards: unknown, count?: number): asserts cards is Card[] {
  if (!Array.isArray(cards) || (count !== undefined && cards.length !== count) || !cards.every(isCard)) {
    throw new Error('请选择有效的点数与花色。');
  }
  if (new Set(cards).size !== cards.length) throw new Error('同一张牌不能出现两次。');
}

export function handClass(cards: Card[]): string {
  assertCards(cards, 2);
  const [first, second] = [...cards].sort((a, b) => RANKS.indexOf(b[0]) - RANKS.indexOf(a[0]));
  return first[0] + second[0] + (first[0] === second[0] ? '' : first[1] === second[1] ? 's' : 'o');
}

export function cardLabel(card: Card): string {
  return (card[0] === 'T' ? '10' : card[0]) + SUIT_LABELS[card[1]];
}

/** mulberry32: reproducible study samples, never a dealing/security RNG. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let i = 1; i <= k; i++) result = result * (n - i + 1) / i;
  return Math.round(result);
}
