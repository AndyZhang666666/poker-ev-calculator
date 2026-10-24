// EV 计算核心。纯函数，无副作用，UI 与 scripts/ 共用同一份代码 —— 两边数字不会打架。
//
// 模型刻意简化（详见 docs/ASSUMPTIONS.md）：
//   胜率 = 手牌强度/100 ± 对手类型修正 ± 对手行动修正，夹在 [5%, 95%]
//   弃牌 EV = 0
//   跟注 EV = 胜率 × (底池 + 有效对手下注) − (1 − 胜率) × 跟注额
//   加注 EV = 弃牌率 × (底池 + 对手下注)
//           + (1 − 弃牌率) × [被跟注后胜率 × (底池 + 加注额) − (1 − 被跟注后胜率) × 加注额]
//   被跟注后胜率 = 胜率 − 范围收窄惩罚（按对手类型 + 对手行动查表）
//
// 「范围收窄惩罚」是任务书公式之外唯一的加项：对手弃掉的是弱牌、跟下来的是强牌，
// 紧对手跟注我们的加注时范围尤其强。不加这一项，紧对手场景的加注 EV 会系统性偏高，
// 任务书案例 3/6（紧对手 → 应跟注不加注）会翻成加注。取舍记录在 docs/DECISIONS.md。

import type { Action, EVParams, EVResult, OpponentAction, OpponentType, SensitivityPoint } from "./types.ts";

export const WIN_RATE_FLOOR = 0.05;
export const WIN_RATE_CEIL = 0.95;

/** 对手类型对我方胜率的修正：松的对手范围宽，我们的相对胜率高 */
export const OPPONENT_TYPE_ADJUST: Record<OpponentType, number> = {
  loose: 0.05,
  tight: -0.05,
  balanced: 0,
};

/** 对手行动对我方胜率的修正：下注/加注是有牌的信号，过牌是示弱 */
export const OPPONENT_ACTION_ADJUST: Record<OpponentAction, number> = {
  bet: -0.05,
  raise: -0.1,
  check: 0.05,
};

/** 对手面对我方加注的基础弃牌率 */
export const BASE_FOLD_RATE: Record<OpponentType, number> = {
  loose: 0.2,
  tight: 0.5,
  balanced: 0.35,
};

/** 对手刚做的动作越强，越不容易被我们加注逼走 */
export const FOLD_RATE_ACTION_ADJUST: Record<OpponentAction, number> = {
  bet: -0.05,
  raise: -0.15,
  check: 0.1,
};

/** 对手跟注我方加注后范围收窄，我们的胜率下调多少（按对手类型） */
export const CALLED_PENALTY_TYPE: Record<OpponentType, number> = {
  loose: 0.05,
  balanced: 0.1,
  tight: 0.25,
};

/** 对手先前的动作越强，跟注我方加注后的范围越强 */
export const CALLED_PENALTY_ACTION: Record<OpponentAction, number> = {
  check: 0,
  bet: 0.04,
  raise: 0.08,
};

export const FOLD_RATE_FLOOR = 0.1;
export const FOLD_RATE_CEIL = 0.7;

/** 我方加注到对手下注的倍数；对手过牌时改为下注 2/3 底池 */
export const RAISE_MULTIPLIER = 3;
export const BET_POT_FRACTION = 2 / 3;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

function validateParams(p: EVParams): void {
  if (!p || !Object.hasOwn(OPPONENT_TYPE_ADJUST, p.opponentType) || !Object.hasOwn(OPPONENT_ACTION_ADJUST, p.opponentAction)) throw Error("请选择支持的对手类型与行动。");
  if (!Number.isFinite(p.handStrength) || p.handStrength < 0 || p.handStrength > 100) throw Error("手牌强度须为 0–100 的有限数值。");
  for (const k of ['pot','opponentBet','myStack','opponentStack'] as const) {
    if (!Number.isFinite(p[k]) || p[k] < 0 || p[k] > 1e9) throw Error("底池与筹码须为 0–10 亿的有限数值。");
  }
}

export function estimateWinRate(
  handStrength: number,
  opponentType: OpponentType,
  opponentAction: OpponentAction,
): number {
  const raw = handStrength / 100 + OPPONENT_TYPE_ADJUST[opponentType] + OPPONENT_ACTION_ADJUST[opponentAction];
  return clamp(raw, WIN_RATE_FLOOR, WIN_RATE_CEIL);
}

export function getOpponentFoldRate(
  opponentType: OpponentType,
  opponentAction: OpponentAction,
  handStrength: number,
): number {
  // 手牌越强 → 我们的加注越「可信」→ 对手越容易弃牌。这是任务书给定的简化，
  // 严格说对手看不见我们的牌；这里把它理解为「强牌打法更一致、更有威胁」的代理变量。
  const strengthAdjust = (handStrength - 50) / 200;
  const raw = BASE_FOLD_RATE[opponentType] + strengthAdjust + FOLD_RATE_ACTION_ADJUST[opponentAction];
  return clamp(raw, FOLD_RATE_FLOOR, FOLD_RATE_CEIL);
}

/** 对手跟注我方加注后，我们对其「继续范围」的胜率 */
export function winRateWhenCalled(
  winRate: number,
  opponentType: OpponentType,
  opponentAction: OpponentAction,
): number {
  return clamp(winRate - CALLED_PENALTY_TYPE[opponentType] - CALLED_PENALTY_ACTION[opponentAction], WIN_RATE_FLOOR, WIN_RATE_CEIL);
}

/** 跟注所需的最低胜率；短筹码时只计可争夺的对手下注。 */
export function potOddsOf(pot: number, opponentBet: number, callAmount: number): number {
  if (![pot,opponentBet,callAmount].every(x=>Number.isFinite(x)&&x>=0&&x<=1e9) || callAmount > opponentBet) throw Error('无效的底池或跟注金额。');
  // Heads-up, no side pots: an unmatched excess bet is not money this caller can win.
  const contestedBet = Math.min(opponentBet, callAmount);
  const denom = pot + contestedBet + callAmount;
  return denom > 0 ? callAmount / denom : 0;
}

/**
 * 使跟注 EV = 0 的手牌强度。bet 为有效对手下注，w = call/(pot+bet+call) = 底池赔率，
 * 再把胜率修正项反减回去。若所需胜率超出 [5%, 95%] 可达范围则返回 null。
 */
export function breakEvenStrength(params: EVParams): number | null {
  validateParams(params);
  const bet = params.opponentAction === 'check' ? 0 : params.opponentBet;
  const callAmount = Math.min(bet, params.myStack);
  if (callAmount <= 0) return null; // 对手过牌，跟注（过牌）永远 ≥ 0
  const needed = potOddsOf(params.pot, bet, callAmount);
  // A clipped plateau or an unreachable root is not an internal negative-to-positive crossing.
  if (needed <= estimateWinRate(0,params.opponentType,params.opponentAction) || needed >= estimateWinRate(100,params.opponentType,params.opponentAction)) return null;
  const s = (needed - OPPONENT_TYPE_ADJUST[params.opponentType] - OPPONENT_ACTION_ADJUST[params.opponentAction]) * 100;
  return s >= 0 && s <= 100 ? s : null;
}

export function calculateEV(params: EVParams): EVResult {
  validateParams(params);
  const { handStrength, pot, myStack, opponentStack, opponentType, opponentAction } = params;
  const opponentBet = opponentAction === 'check' ? 0 : params.opponentBet;
  const decisionAvailable = myStack > 0;

  const winRate = estimateWinRate(handStrength, opponentType, opponentAction);

  // 跟注：最多只能跟到自己的筹码；对手多出来的部分会退回，赢到的也只有对应部分
  const callAmount = Math.min(opponentBet, myStack);
  const callWin = pot + callAmount;
  const fold = 0;
  const call = decisionAvailable ? winRate * callWin - (1 - winRate) * callAmount : 0;

  // 加注：加注到对手下注的 3 倍；对手过牌时改为下注 2/3 底池。
  // 上限：我的筹码；对手最多能跟到「他已下注 + 剩余筹码」，再多也赢不到。
  const target = opponentBet > 0 ? opponentBet * RAISE_MULTIPLIER : Math.round(pot * BET_POT_FRACTION);
  const raiseAmount = Math.min(target, myStack, opponentBet + opponentStack);
  const raiseAvailable = raiseAmount > callAmount;

  const opponentFoldRate = getOpponentFoldRate(opponentType, opponentAction, handStrength);
  const calledWinRate = winRateWhenCalled(winRate, opponentType, opponentAction);
  // 对手弃牌：赢下当前底池 + 他已下注的部分
  const evIfFold = pot + opponentBet;
  // 对手跟注：他补齐到 raiseAmount，我们赢 pot + raiseAmount、输 raiseAmount。
  // 注意不是 (pot + opponentBet + raiseAmount)：raiseAmount 已经覆盖了对手那笔下注，再加会重复计。
  const evIfCalled = calledWinRate * (pot + raiseAmount) - (1 - calledWinRate) * raiseAmount;
  const raise = raiseAvailable ? opponentFoldRate * evIfFold + (1 - opponentFoldRate) * evIfCalled : call;

  const candidates: [Action, number][] = raiseAvailable
    ? [["fold", fold], ["call", call], ["raise", raise]]
    : [["fold", fold], ["call", call]];
  // 平手时偏向更保守的动作（fold < call < raise）
  const bestAction = candidates.reduce((best, cur) => (cur[1] > best[1] + 1e-9 ? cur : best))[0];

  return {
    decisionAvailable,
    callAmount,
    contestedOpponentBet: callAmount,
    fold,
    call,
    raise,
    bestAction,
    potOdds: potOddsOf(pot, opponentBet, callAmount),
    winRate,
    raiseAmount,
    raiseAvailable,
    opponentFoldRate,
    calledWinRate,
    breakEvenStrength: breakEvenStrength(params),
  };
}

export function sensitivityAnalysis(baseParams: EVParams, step = 5): SensitivityPoint[] {
  if (!Number.isInteger(step) || step < 1 || step > 100) throw Error('敏感性步长须为 1–100 的整数。');
  const out: SensitivityPoint[] = [];
  for (let s = 0; s <= 100; s += step) {
    const r = calculateEV({ ...baseParams, handStrength: s });
    out.push({ handStrength: s, fold: r.fold, call: r.call, raise: r.raise, winRate: r.winRate });
  }
  if(out.at(-1)?.handStrength!==100){const r=calculateEV({...baseParams,handStrength:100});out.push({handStrength:100,fold:r.fold,call:r.call,raise:r.raise,winRate:r.winRate});}
  return out;
}

/** 对手过牌时「跟注」其实是过牌、「加注」其实是下注，UI 与文案都按这个改名 */
export function actionLabel(action: Action, opponentAction: OpponentAction): string {
  if (action === "fold") return "弃牌";
  if (action === "call") return opponentAction === "check" ? "过牌" : "跟注";
  return opponentAction === "check" ? "下注" : "加注";
}

export function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
