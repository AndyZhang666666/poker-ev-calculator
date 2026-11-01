import {RANKS, SUITS, type Card} from './cards.ts';

export type RangeWeights = Record<string, number>;
const DESC = [...RANKS].reverse();
export const HAND_CLASSES = DESC.flatMap((row, i) => DESC.map((column, j) =>
  i === j ? row + column : i < j ? row + column + 's' : column + row + 'o'));

// Adapted from n1kFord/preflop-range-trainer, src/utils/data/index.ts (MIT).
// Copyright (c) 2025 n1kFord. Full notice: third-party/preflop-range-trainer.LICENSE.
export function getComboCount(value: string): number {
  if (/^([2-9TJQKA])\1$/.test(value)) return 6;
  if (value.endsWith('s')) return 4;
  if (value.endsWith('o')) return 12;
  return 0;
}

function atom(text: string): {hi: number; lo: number; suit: string} {
  const match = /^([2-9TJQKA])([2-9TJQKA])([so])?$/.exec(text);
  if (!match) throw new Error(`无法识别范围“${text}”。例如 TT+、A5s-A2s、AKo。`);
  const a = RANKS.indexOf(match[1]), b = RANKS.indexOf(match[2]);
  if (a === b && match[3]) throw new Error('对子后面不需要 s 或 o。');
  return {hi: Math.max(a, b), lo: Math.min(a, b), suit: match[3] ?? ''};
}

function names(hi: number, lo: number, suit: string): string[] {
  if (hi === lo) return [RANKS[hi] + RANKS[lo]];
  return (suit ? [suit] : ['s', 'o']).map(s => RANKS[hi] + RANKS[lo] + s);
}

function expand(term: string): string[] {
  if (term.endsWith('+')) {
    const a = atom(term.slice(0, -1));
    if (a.hi === a.lo) return Array.from({length: 13 - a.hi}, (_, i) => names(a.hi + i, a.lo + i, '')).flat();
    return Array.from({length: a.hi - a.lo}, (_, i) => names(a.hi, a.lo + i, a.suit)).flat();
  }
  const parts = term.split('-');
  if (parts.length === 1) {const a = atom(term); return names(a.hi, a.lo, a.suit);}
  if (parts.length !== 2) throw new Error(`范围区间“${term}”格式不正确。`);
  const a = atom(parts[0]), b = atom(parts[1]);
  if (a.suit !== b.suit) throw new Error('区间两端须使用相同的同花/非同花标记。');
  if (a.hi === a.lo && b.hi === b.lo) {
    return Array.from({length: Math.abs(a.hi - b.hi) + 1}, (_, i) => names(Math.min(a.hi, b.hi) + i, Math.min(a.hi, b.hi) + i, '')).flat();
  }
  if (a.hi === b.hi && a.hi !== a.lo && b.hi !== b.lo) {
    return Array.from({length: Math.abs(a.lo - b.lo) + 1}, (_, i) => names(a.hi, Math.min(a.lo, b.lo) + i, a.suit)).flat();
  }
  if (a.hi - a.lo === b.hi - b.lo && a.hi !== a.lo) {
    const start = a.hi < b.hi ? a : b;
    return Array.from({length: Math.abs(a.hi - b.hi) + 1}, (_, i) => names(start.hi + i, start.lo + i, a.suit)).flat();
  }
  throw new Error(`不支持区间“${term}”。请用同一高张或同一间隔的连张。`);
}

/** Class frequency, not a hand-strength score. Later terms override earlier terms. */
export function parseRange(text: string): RangeWeights {
  if (typeof text !== 'string' || text.length > 12000) throw new Error('范围文字须少于 12,000 字符。');
  const result: RangeWeights = {};
  if (!text.trim()) return result;
  for (const raw of text.trim().split(/[\s,，;；]+/)) {
    const pieces = raw.split(':');
    if (pieces.length > 2) throw new Error(`权重“${raw}”格式不正确。`);
    const term = pieces[0].replace(/10/g, 'T').replace(/[akqjt]/g, c => c.toUpperCase());
    let weight = 1;
    if (pieces.length === 2) {
      if (!/^(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?%?$/i.test(pieces[1])) throw new Error(`权重“${pieces[1]}”无效。`);
      weight = Number(pieces[1].replace('%', '')) / (pieces[1].endsWith('%') ? 100 : 1);
      if (!Number.isFinite(weight) || weight < 0 || weight > 1) throw new Error('权重用 0–1，或 0%–100%。');
    }
    for (const name of expand(term)) {
      if (weight === 0) delete result[name]; else result[name] = weight;
    }
  }
  return result;
}

export function formatRange(weights: RangeWeights): string {
  return HAND_CLASSES.filter(name => weights[name] > 0).map(name =>
    weights[name] === 1 ? name : `${name}:${weights[name]}`).join(', ');
}

export function classCombos(name: string): [Card, Card][] {
  const {hi, lo, suit} = atom(name);
  const combos: [Card, Card][] = [];
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
    if (hi === lo && a >= b) continue;
    if (hi !== lo && ((suit === 's' && a !== b) || (suit === 'o' && a === b))) continue;
    combos.push([RANKS[hi] + SUITS[a], RANKS[lo] + SUITS[b]]);
  }
  return combos;
}

export function rangeCombos(weights: RangeWeights, blocked: Card[] = []): {cards: [Card, Card]; weight: number}[] {
  const used = new Set(blocked);
  return HAND_CLASSES.filter(name => weights[name] > 0).flatMap(name => classCombos(name)
    .filter(cards => cards.every(card => !used.has(card))).map(cards => ({cards, weight: weights[name]})));
}

export function rangeSize(weights: RangeWeights): number {
  return HAND_CLASSES.reduce((total, name) => total + getComboCount(name) * (weights[name] ?? 0), 0);
}
