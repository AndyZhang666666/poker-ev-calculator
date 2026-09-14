// 全项目共用的类型。lib/ 里的函数是纯函数，UI 和 scripts/ 都只 import 这里和 ev.ts。

export type Rank = "A" | "K" | "Q" | "J" | "T" | "9" | "8" | "7" | "6" | "5" | "4" | "3" | "2";
export type Suit = "s" | "h" | "d" | "c";

export interface Card {
  rank: Rank;
  suit: Suit;
}

export type OpponentType = "loose" | "tight" | "balanced";
export type OpponentAction = "bet" | "raise" | "check";
export type Action = "fold" | "call" | "raise";

export interface EVParams {
  /** 手牌强度 0-100，可由起手牌自动查表，也可手动覆盖 */
  handStrength: number;
  /** 对手行动前的底池 */
  pot: number;
  /** 对手本轮下注/加注的金额；对手过牌时为 0 */
  opponentBet: number;
  myStack: number;
  opponentStack: number;
  opponentType: OpponentType;
  opponentAction: OpponentAction;
}

export interface EVResult {
  fold: number;
  call: number;
  raise: number;
  bestAction: Action;
  /** 跟注所需胜率 = 跟注额 / (底池 + 对手下注 + 跟注额) */
  potOdds: number;
  winRate: number;
  /** 我方加注的实际金额（受双方筹码限制） */
  raiseAmount: number;
  /** 筹码不足以加注（加注额 ≤ 跟注额）时为 false，此时加注 EV 记为跟注 EV */
  raiseAvailable: boolean;
  opponentFoldRate: number;
  /** 对手跟注我方加注后，我们对其继续范围的胜率 */
  calledWinRate: number;
  /** 使跟注 EV = 0 的手牌强度（在当前对手类型/行动下），无解时为 null */
  breakEvenStrength: number | null;
}

export interface SensitivityPoint {
  handStrength: number;
  fold: number;
  call: number;
  raise: number;
  winRate: number;
}

export interface CaseDef {
  id: string;
  title: string;
  street: "preflop" | "flop" | "turn" | "river";
  hand: [Card, Card];
  board: Card[];
  /** 案例给定的手牌强度（听牌/成牌场景与起手牌表无关，直接给值） */
  handStrength: number;
  pot: number;
  opponentBet: number;
  myStack: number;
  opponentStack: number;
  opponentType: OpponentType;
  opponentAction: OpponentAction;
  /** 任务书写的预期最优决策，校验脚本会断言 */
  expectedBest: Action;
  why: string;
}
