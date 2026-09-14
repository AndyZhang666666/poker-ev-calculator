// 跑 8 个经典案例，把 EV 结果写到 results/cases.json。README 里引用的每个数字都来自这个文件。
//
// 直接 import src/lib/*.ts —— Node 22 原生剥离类型注解，脚本和页面跑的是同一份代码。
// 输出是确定性的：重跑必须字节一致（只有 generatedAt 的日期会变）。

import { writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { calculateEV, actionLabel } from "../src/lib/ev.ts";
import { CASES } from "../src/lib/cases.ts";
import { cardLabel, handKey, HAND_STRENGTH } from "../src/lib/handStrength.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const r2 = (x) => Math.round(x * 100) / 100;
const pct = (x) => Math.round(x * 1000) / 10;

const STREET = { preflop: "翻牌前", flop: "翻牌", turn: "转牌", river: "河牌" };
const OPP_TYPE = { loose: "松", tight: "紧", balanced: "平衡" };
const OPP_ACTION = { bet: "下注", raise: "加注", check: "过牌" };

const cases = CASES.map((c, i) => {
  const r = calculateEV(c);
  const key = handKey(c.hand[0], c.hand[1]);
  return {
    index: i + 1,
    id: c.id,
    title: c.title,
    street: STREET[c.street],
    hand: c.hand.map(cardLabel).join(" "),
    handKey: key,
    /** 起手牌表里的强度，和案例给的强度可能不同（听牌/成牌场景是牌面强度） */
    preflopStrength: HAND_STRENGTH[key],
    board: c.board.map(cardLabel).join(" ") || "—",
    input: {
      handStrength: c.handStrength,
      pot: c.pot,
      opponentBet: c.opponentBet,
      myStack: c.myStack,
      opponentStack: c.opponentStack,
      opponentType: c.opponentType,
      opponentTypeLabel: OPP_TYPE[c.opponentType],
      opponentAction: c.opponentAction,
      opponentActionLabel: c.opponentBet > 0 ? `${OPP_ACTION[c.opponentAction]} ${c.opponentBet}` : OPP_ACTION[c.opponentAction],
    },
    output: {
      winRatePct: pct(r.winRate),
      potOddsPct: pct(r.potOdds),
      opponentFoldRatePct: pct(r.opponentFoldRate),
      calledWinRatePct: pct(r.calledWinRate),
      raiseAmount: r.raiseAmount,
      raiseAvailable: r.raiseAvailable,
      breakEvenStrength: r.breakEvenStrength === null ? null : r2(r.breakEvenStrength),
      ev: { fold: r2(r.fold), call: r2(r.call), raise: r2(r.raise) },
      bestAction: r.bestAction,
      bestActionLabel: actionLabel(r.bestAction, c.opponentAction),
      callLabel: actionLabel("call", c.opponentAction),
      raiseLabel: actionLabel("raise", c.opponentAction),
    },
    expectedBest: c.expectedBest,
    matchesExpectation: r.bestAction === c.expectedBest,
    why: c.why,
  };
});

const summary = {
  total: cases.length,
  matched: cases.filter((c) => c.matchesExpectation).length,
  bestActionCounts: cases.reduce((acc, c) => ((acc[c.output.bestAction] = (acc[c.output.bestAction] ?? 0) + 1), acc), {}),
};

const out = {
  generatedAt: new Date().toISOString().slice(0, 10),
  source: "src/lib/ev.ts + src/lib/cases.ts",
  model: {
    winRate: "clamp(handStrength/100 + typeAdjust + actionAdjust, 0.05, 0.95)",
    callEV: "winRate × (pot + callAmount) − (1 − winRate) × callAmount",
    raiseEV: "foldRate × (pot + opponentBet) + (1 − foldRate) × [calledWinRate × (pot + raiseAmount) − (1 − calledWinRate) × raiseAmount]",
    calledWinRate: "clamp(winRate − typePenalty − actionPenalty, 0.05, 0.95)",
  },
  summary,
  cases,
};

mkdirSync(resolve(root, "results"), { recursive: true });
writeFileSync(resolve(root, "results", "cases.json"), JSON.stringify(out, null, 2) + "\n");

console.log(`✓ results/cases.json — ${summary.matched}/${summary.total} 案例与任务书预期一致`);
for (const c of cases) {
  const flag = c.matchesExpectation ? "✓" : "✗";
  console.log(
    `  ${flag} #${c.index} ${c.title.padEnd(14)} 胜率 ${String(c.output.winRatePct).padStart(4)}%  赔率 ${String(c.output.potOddsPct).padStart(4)}%  ` +
      `${c.output.callLabel} ${String(c.output.ev.call).padStart(7)}  ${c.output.raiseLabel} ${String(c.output.ev.raise).padStart(7)}  → ${c.output.bestActionLabel}`,
  );
}
