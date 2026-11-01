import phe from 'phe';
import {assertCards, choose, DECK, seededRandom, type Card} from './cards.ts';
import {parseRange, rangeCombos} from './ranges.ts';

export const EQUITY_VERSION = 'heads-up-equity-v1-2026-11-01';
export const EXACT_LIMIT = 200000;
export interface EquityInput {
  hero: Card[];
  board: Card[];
  opponent: {type: 'hand'; cards: Card[]} | {type: 'range'; text: string};
  samples: number;
  seed: number;
  method: 'auto' | 'monte-carlo';
}
export interface EquityResult {
  version: string;
  input: EquityInput;
  method: 'exact' | 'monte-carlo';
  equity: number;
  win: number;
  tie: number;
  loss: number;
  interval95: [number, number] | null;
  evaluations: number;
  possibleScenarios: number;
  opponentCombos: number;
  blockedCombos: number;
  weightedCombos: number;
  elapsedMs: number;
}
const CODE = new Map(DECK.map(card => [card, phe.cardCodes([card])[0]]));

export function prepareEquity(input: EquityInput) {
  if (!input || typeof input !== 'object') throw new Error('缺少计算输入。');
  assertCards(input.hero, 2);
  assertCards(input.board);
  if (![0, 3, 4, 5].includes(input.board.length)) throw new Error('公共牌须为 0、3、4 或 5 张。');
  assertCards([...input.hero, ...input.board]);
  if (!Number.isInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error('种子须为 0–4294967295 的整数。');
  if (!Number.isInteger(input.samples) || input.samples < 100 || input.samples > 200000) throw new Error('抽样次数须为 100–200000 的整数。');
  if (!['auto', 'monte-carlo'].includes(input.method)) throw new Error('请选择支持的计算方式。');
  const known = [...input.hero, ...input.board];
  let all: {cards: [Card, Card]; weight: number}[], combos: typeof all;
  if (input.opponent?.type === 'hand') {
    assertCards(input.opponent.cards, 2);
    assertCards([...known, ...input.opponent.cards]);
    all = combos = [{cards: [...input.opponent.cards] as [Card, Card], weight: 1}];
  } else if (input.opponent?.type === 'range') {
    const weights = parseRange(input.opponent.text);
    all = rangeCombos(weights);
    combos = rangeCombos(weights, known);
  } else throw new Error('请选择对手手牌或范围。');
  if (!combos.length) throw new Error('排除已知牌后，对手范围没有可用组合。请调整范围或牌面。');
  const runouts = choose(48 - input.board.length, 5 - input.board.length);
  return {combos, blockedCombos: all.length - combos.length, possibleScenarios: combos.length * runouts};
}

/** Heads-up showdown equity. No betting strategy, rake, side pots or future action model. */
export function runEquity(input: EquityInput, onProgress?: (done: number, total: number) => void): EquityResult {
  const started = Date.now();
  const prepared = prepareEquity(input);
  const known = new Set([...input.hero, ...input.board]);
  const deck = DECK.filter(card => !known.has(card));
  let mass = 0;
  const combos = prepared.combos.map(combo => {
    mass += combo.weight;
    return {...combo, cumulative: mass, codes: combo.cards.map(card => CODE.get(card)!),
      remaining: deck.filter(card => !combo.cards.includes(card)).map(card => CODE.get(card)!)};
  });
  const exact = input.method === 'auto' && prepared.possibleScenarios <= EXACT_LIMIT;
  const target = exact ? prepared.possibleScenarios : input.samples;
  const hero = input.hero.map(card => CODE.get(card)!);
  const board = input.board.map(card => CODE.get(card)!);
  const needed = 5 - board.length;
  const a = [...hero, ...board, ...Array(needed).fill(0)] as number[];
  const b = [0, 0, ...board, ...Array(needed).fill(0)] as number[];
  let wins = 0, ties = 0, losses = 0, done = 0;
  function score(weight: number) {
    const mine = phe.evaluateCardCodes(a), theirs = phe.evaluateCardCodes(b);
    if (mine < theirs) wins += weight;
    else if (mine === theirs) ties += weight;
    else losses += weight;
    done++;
    if ((done & 2047) === 0) onProgress?.(done, target);
  }
  function setRunout(cards: number[]) {
    for (let i = 0; i < needed; i++) a[2 + board.length + i] = b[2 + board.length + i] = cards[i];
  }
  if (exact) {
    for (const combo of combos) {
      [b[0], b[1]] = combo.codes;
      const picked: number[] = [];
      function enumerate(from: number, left: number) {
        if (!left) {setRunout(picked); score(combo.weight); return;}
        for (let i = from; i <= combo.remaining.length - left; i++) {
          picked.push(combo.remaining[i]); enumerate(i + 1, left - 1); picked.pop();
        }
      }
      enumerate(0, needed);
    }
  } else {
    const rng = seededRandom(input.seed);
    for (let iteration = 0; iteration < input.samples; iteration++) {
      const draw = rng() * mass;
      let lo = 0, hi = combos.length - 1;
      while (lo < hi) {const middle = (lo + hi) >>> 1; if (draw < combos[middle].cumulative) hi = middle; else lo = middle + 1;}
      const combo = combos[lo];
      [b[0], b[1]] = combo.codes;
      // Partial Fisher-Yates. Reusing the permutation does not change the next uniform draw.
      for (let i = 0; i < needed; i++) {
        const j = i + Math.floor(rng() * (combo.remaining.length - i));
        [combo.remaining[i], combo.remaining[j]] = [combo.remaining[j], combo.remaining[i]];
      }
      setRunout(combo.remaining); score(1);
    }
  }
  onProgress?.(done, target);
  const total = wins + ties + losses;
  const equity = (wins + ties / 2) / total;
  // Hoeffding's bounded-payoff interval also stays nonzero when this sample has only wins.
  // It covers sampling error under the sampling model, never uncertainty about the chosen range.
  const errorBound = exact ? 0 : Math.sqrt(Math.log(40) / (2 * total));
  return {
    version: EQUITY_VERSION, input: JSON.parse(JSON.stringify(input)), method: exact ? 'exact' : 'monte-carlo',
    equity, win: wins / total, tie: ties / total, loss: losses / total,
    interval95: exact ? null : [Math.max(0, equity - errorBound), Math.min(1, equity + errorBound)],
    evaluations: done, possibleScenarios: prepared.possibleScenarios, opponentCombos: combos.length,
    blockedCombos: prepared.blockedCombos, weightedCombos: mass, elapsedMs: Date.now() - started,
  };
}
