import {assertCards, DECK, handClass, seededRandom, type Card} from './cards.ts';
import {formatRange, parseRange} from './ranges.ts';

export const REFERENCE_VERSION = 'teaching-rfi-6max-100bb-v1';
export const POSITIONS = ['UTG', 'HJ', 'CO', 'BTN', 'SB'] as const;
export type Position = typeof POSITIONS[number];
export type Action = 'raise' | 'fold';
export type ChartSet = Record<Position, string>;
export const POSITION_NAMES: Record<Position, string> = {UTG: '枪口位', HJ: '劫位', CO: '关煞位', BTN: '按钮位', SB: '小盲位'};

// Deliberately authored teaching references, not copied solver output or a GTO claim.
// Scope: 6-max cash, 100bb, no ante; everyone before Hero folded; raise-or-fold only.
export const DEFAULT_CHARTS: ChartSet = {
  UTG: '66+, ATs+, KJs+, QJs, JTs, T9s, AQo+',
  HJ: '55+, A8s+, KTs+, QTs+, JTs, T9s, 98s, AJo+, KQo',
  CO: '22+, A2s+, K9s+, Q9s+, J9s+, T8s+, 98s, 87s, ATo+, KJo+, QJo',
  BTN: '22+, A2s+, K2s+, Q5s+, J7s+, T7s+, 97s+, 86s+, 76s, 65s, 54s, A2o+, K8o+, Q9o+, J9o+, T9o',
  SB: '22+, A2s+, K5s+, Q8s+, J8s+, T8s+, 98s, 87s, 76s, 65s, A7o+, KTo+, QTo+, JTo',
};
export interface PracticeSpot {
  id: string;
  position: Position;
  cards: [Card, Card];
  hand: string;
  reference: string;
  rangeText: string;
  openFrequency: number;
  explanation: string;
}

export function referenceId(rangeText: string): string {
  let hash = 2166136261;
  for (const character of formatRange(parseRange(rangeText))) {hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619);}
  return `${REFERENCE_VERSION}-${(hash >>> 0).toString(16)}`;
}

export function makeSpot(position: Position, cards: [Card, Card], charts: ChartSet, id: string, explanation = ''): PracticeSpot {
  const rangeText = formatRange(parseRange(charts[position]));
  const hand = handClass(cards);
  return {id, position, cards: [...cards], hand, reference: referenceId(rangeText), rangeText,
    openFrequency: parseRange(rangeText)[hand] ?? 0, explanation};
}

export function randomSpot(charts: ChartSet, positions: Position[], seed: number, index: number): PracticeSpot {
  if (!positions.length || !positions.every(p => POSITIONS.includes(p))) throw new Error('至少选择一个可训练的位置。');
  const random = seededRandom((seed + Math.imul(index + 1, 2654435761)) >>> 0);
  const first = Math.floor(random() * 52), offset = Math.floor(random() * 51);
  const second = offset >= first ? offset + 1 : offset;
  const position = positions[Math.floor(random() * positions.length)];
  return makeSpot(position, [DECK[first], DECK[second]], charts, `random-${seed}-${index}`);
}

export function gradeSpot(spot: PracticeSpot, action: Action): {compatible: boolean; mixed: boolean; expected: string} {
  if (!['raise', 'fold'].includes(action)) throw new Error('请选择加注或弃牌。');
  const mixed = spot.openFrequency > 0 && spot.openFrequency < 1;
  return {
    compatible: action === 'raise' ? spot.openFrequency > 0 : spot.openFrequency < 1,
    mixed,
    expected: mixed ? `加注 ${Number((spot.openFrequency * 100).toPrecision(6))}% / 弃牌 ${Number(((1 - spot.openFrequency) * 100).toPrecision(6))}%`
      : spot.openFrequency === 1 ? '加注' : '弃牌',
  };
}

export function validSpot(value: unknown): value is PracticeSpot {
  if (!value || typeof value !== 'object') return false;
  const spot = value as PracticeSpot;
  try {
    assertCards(spot.cards, 2);
    return POSITIONS.includes(spot.position) && typeof spot.id === 'string' && spot.id.length < 160
      && typeof spot.explanation === 'string' && spot.explanation.length <= 1000
      && handClass(spot.cards) === spot.hand && typeof spot.rangeText === 'string'
      && referenceId(spot.rangeText) === spot.reference
      && (parseRange(spot.rangeText)[spot.hand] ?? 0) === spot.openFrequency;
  } catch {return false;}
}

const LESSONS: [Position, string, string][] = [
  ['UTG', 'AsQh', '前位面对的后续玩家较多，先从高张组合读范围。'],
  ['UTG', '6c6d', '小对子是否开池，以这一版参考范围的边界为准。'],
  ['UTG', 'Ac5c', '同花 A 的可玩性不代表它在所有位置都进入同一范围。'],
  ['UTG', 'KsJh', '留意同花与非同花是两个不同的手牌类别。'],
  ['UTG', 'Ts9s', '同花连张在此参考中有位置，仍需看具体筹码与桌况。'],
  ['UTG', '7d2c', '没有进入当前开池范围的手牌，在本训练中选择弃牌。'],
  ['HJ', '5c5s', '与前位相比，观察这一位置的小对子边界。'],
  ['HJ', 'As8s', '同花 A 的边界随位置变化。'],
  ['HJ', 'AhTh', '先判断同花标记，再查所选位置的参考。'],
  ['HJ', 'AcTd', '相同点数的非同花组合可能落在范围之外。'],
  ['HJ', 'KcQd', '高张非同花手牌也需要按位置查范围。'],
  ['HJ', '8h7h', '可玩性与是否进入当前参考范围是两件不同的事。'],
  ['CO', '2c2h', '后位参考开始纳入更多对子。'],
  ['CO', 'Ad2d', '先看位置，再看 A2s 是否已纳入范围。'],
  ['CO', 'Kh9h', '边缘同花高张是检查范围记忆的好位置。'],
  ['CO', 'As9c', '比较 ATo 与 A9o 的边界。'],
  ['CO', '8s7s', '同花连张与非同花连张不能混为一类。'],
  ['CO', 'KdTh', '注意 KJo 与 KTo 的边界。'],
  ['BTN', 'Ac2h', '按钮位参考通常比前位宽；这里练的是给定参考。'],
  ['BTN', 'Ks2s', '同花结构是这类边缘手牌的关键区别。'],
  ['BTN', 'Qh5h', '检查按钮位同花 Q 的下界。'],
  ['BTN', '5d4d', '低同花连张已纳入本版本参考。'],
  ['BTN', 'Kh7c', 'K8o 与 K7o 是相邻但不同的手牌类别。'],
  ['BTN', '8c3d', '后位范围更宽，也仍然保留明确的弃牌部分。'],
  ['SB', 'Ac7h', '小盲采用简化的加注/弃牌参考，不包含平跟策略。'],
  ['SB', 'Ah6c', '比较 A7o 与 A6o 的边界。'],
  ['SB', 'Ks5s', '同花 K 的下界随位置不同。'],
  ['SB', 'Qh7h', '用边界手牌检查当前版本，而不是只凭“同花就打”。'],
  ['SB', '6d5d', '此处只训练前面均弃牌后的第一个行动。'],
  ['SB', 'JcTd', '两张高张是否进入范围，依然以所选参考为准。'],
];
export function lessonSpots(charts: ChartSet = DEFAULT_CHARTS): PracticeSpot[] {
  return LESSONS.map(([position, cards, explanation], index) =>
    makeSpot(position, [cards.slice(0, 2), cards.slice(2)], charts, `lesson-${index + 1}`, explanation));
}
