// 模型自洽性校验。算错了不会报错、只会数字悄悄不对，所以先写几条人脑能算的用例。
// 任何一条失败就 exit 1，CI 在 build 之前跑这个。

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  calculateEV,
  estimateWinRate,
  getOpponentFoldRate,
  breakEvenStrength,
  sensitivityAnalysis,
  potOddsOf,
} from "../src/lib/ev.ts";
import { CASES } from "../src/lib/cases.ts";
import { HAND_STRENGTH, handKey, handStrengthOf } from "../src/lib/handStrength.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
const check = (name, cond, detail = "") => {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failed++;
    console.log(`  ✗ ${name}${detail ? " — " + detail : ""}`);
  }
};
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

const base = { pot: 100, opponentBet: 50, myStack: 500, opponentStack: 500, opponentType: "balanced", opponentAction: "bet" };

console.log("\n[1] 手牌强度表");
const keys = Object.keys(HAND_STRENGTH);
check("恰好 169 种起手牌", keys.length === 169, `实际 ${keys.length}`);
check("13 个口袋对", keys.filter((k) => k.length === 2).length === 13);
check("78 个同花 + 78 个非同花", keys.filter((k) => k.endsWith("s")).length === 78 && keys.filter((k) => k.endsWith("o")).length === 78);
check("所有值在 [0, 100]", keys.every((k) => HAND_STRENGTH[k] >= 0 && HAND_STRENGTH[k] <= 100));
const anchors = {
  AA: 95, KK: 92, QQ: 88, JJ: 84, TT: 80, "99": 76, "88": 72, "77": 68, "66": 64, "55": 60,
  AKs: 78, AQs: 74, AJs: 70, ATs: 66, AKo: 72, AQo: 68, AJo: 64, ATo: 60,
  KQs: 68, KJs: 64, KTs: 60, KQo: 62, KJo: 58, KTo: 54, "72o": 5, "73o": 6, "82o": 7,
};
const badAnchors = Object.entries(anchors).filter(([k, v]) => HAND_STRENGTH[k] !== v);
check("任务书给定的 27 个锚点全部一致", badAnchors.length === 0, badAnchors.map(([k, v]) => `${k}: 期望 ${v} 实际 ${HAND_STRENGTH[k]}`).join(", "));
check("AA 是全表最强", Math.max(...Object.values(HAND_STRENGTH)) === HAND_STRENGTH.AA);
check("72o 是全表最弱", Math.min(...Object.values(HAND_STRENGTH)) === HAND_STRENGTH["72o"]);
check("同花永远 ≥ 同点数非同花", keys.filter((k) => k.endsWith("s")).every((k) => HAND_STRENGTH[k] >= HAND_STRENGTH[k.slice(0, 2) + "o"]));
check("handKey 顺序无关：A♠K♥ 与 K♥A♠ 同 key", handKey({ rank: "A", suit: "s" }, { rank: "K", suit: "h" }) === "AKo" && handKey({ rank: "K", suit: "h" }, { rank: "A", suit: "s" }) === "AKo");
check("handStrengthOf 拒绝同一张牌", handStrengthOf({ rank: "A", suit: "s" }, { rank: "A", suit: "s" }) === null);

console.log("\n[2] 胜率估算");
check("平衡对手 + 下注，强度 50 → 胜率 45%", near(estimateWinRate(50, "balanced", "bet"), 0.45));
check("松对手 + 过牌，强度 50 → 胜率 60%", near(estimateWinRate(50, "loose", "check"), 0.6));
check("紧对手 + 加注，强度 50 → 胜率 35%", near(estimateWinRate(50, "tight", "raise"), 0.35));
check("下限 5%：强度 0 紧对手加注", near(estimateWinRate(0, "tight", "raise"), 0.05));
check("上限 95%：强度 100 松对手过牌", near(estimateWinRate(100, "loose", "check"), 0.95));
check("胜率对强度单调不减", Array.from({ length: 100 }, (_, i) => i).every((s) => estimateWinRate(s + 1, "balanced", "bet") >= estimateWinRate(s, "balanced", "bet")));

console.log("\n[3] 对手弃牌率");
check("平衡 + 下注 + 强度 50 → 30%", near(getOpponentFoldRate("balanced", "bet", 50), 0.3));
check("紧 > 平衡 > 松（同条件）", getOpponentFoldRate("tight", "bet", 50) > getOpponentFoldRate("balanced", "bet", 50) && getOpponentFoldRate("balanced", "bet", 50) > getOpponentFoldRate("loose", "bet", 50));
check("过牌 > 下注 > 加注（同条件）", getOpponentFoldRate("balanced", "check", 50) > getOpponentFoldRate("balanced", "bet", 50) && getOpponentFoldRate("balanced", "bet", 50) > getOpponentFoldRate("balanced", "raise", 50));
check("夹在 [10%, 70%]", [0, 50, 100].every((s) => ["loose", "tight", "balanced"].every((t) => ["bet", "raise", "check"].every((a) => { const f = getOpponentFoldRate(t, a, s); return f >= 0.1 && f <= 0.7; }))));

console.log("\n[4] EV 手算用例");
{
  // 胜率 45%，底池 100，对手下注 50：跟注 EV = 0.45×150 − 0.55×50 = 67.5 − 27.5 = 40
  const r = calculateEV({ ...base, handStrength: 50 });
  check("跟注 EV = 0.45×150 − 0.55×50 = 40", near(r.call, 40), `实际 ${r.call}`);
  check("弃牌 EV 恒为 0", r.fold === 0);
  check("底池赔率 = 50/(100+50+50) = 25%", near(r.potOdds, 0.25));
  check("加注额 = 3 × 50 = 150", r.raiseAmount === 150);
}
{
  // 底池赔率 25%，平衡+下注修正 −5pp → 需要强度 30 才能让跟注 EV = 0
  const be = breakEvenStrength({ ...base, handStrength: 50 });
  check("临界强度 = (25% + 5%) × 100 = 30", near(be, 30), `实际 ${be}`);
  const atBE = calculateEV({ ...base, handStrength: be });
  check("临界强度处跟注 EV ≈ 0", Math.abs(atBE.call) < 1e-6, `实际 ${atBE.call}`);
  check("临界强度以下跟注 EV < 0，以上 > 0", calculateEV({ ...base, handStrength: be - 1 }).call < 0 && calculateEV({ ...base, handStrength: be + 1 }).call > 0);
}
{
  // 对手全押 500，我只有 200：跟注额受限于我的筹码
  const r = calculateEV({ ...base, handStrength: 50, opponentBet: 500, myStack: 200, opponentStack: 0 });
  check("跟注额受我方筹码限制：赢 100+200、输 200", near(r.call, 0.45 * 300 - 0.55 * 200));
  check("对手已全押 → 无法加注，raiseAvailable = false", r.raiseAvailable === false);
  check("无法加注时加注 EV 等于跟注 EV（不参与最优判定）", near(r.raise, r.call) && r.bestAction !== "raise");
}
{
  // 对手过牌：跟注（过牌）EV ≥ 0，加注变成下注 2/3 底池
  const r = calculateEV({ ...base, handStrength: 50, opponentBet: 0, opponentAction: "check" });
  check("对手过牌：过牌 EV = 胜率 × 底池 ≥ 0", r.call >= 0 && near(r.call, r.winRate * 100));
  check("对手过牌：下注额 = round(2/3 × 100) = 67", r.raiseAmount === 67, `实际 ${r.raiseAmount}`);
  check("对手过牌：底池赔率 0、无临界点", r.potOdds === 0 && r.breakEvenStrength === null);
}
{
  const r = calculateEV({ ...base, handStrength: 50, myStack: 0, opponentBet: 0, opponentAction: "check" });
  check("我方无筹码且对手过牌：过牌 EV = 胜率 × 底池，不能下注", r.raiseAvailable === false);
}
check("EV 对强度单调不减（跟注/加注）", (() => {
  const pts = sensitivityAnalysis({ ...base, handStrength: 0 }, 1);
  return pts.every((p, i) => i === 0 || (p.call >= pts[i - 1].call - 1e-9 && p.raise >= pts[i - 1].raise - 1e-9));
})());
check("敏感性分析 step=5 → 21 个点，覆盖 0..100", (() => {
  const pts = sensitivityAnalysis({ ...base, handStrength: 0 });
  return pts.length === 21 && pts[0].handStrength === 0 && pts[20].handStrength === 100;
})());
check("potOddsOf 边界：底池 0 下注 0 → 0", potOddsOf(0, 0, 0) === 0);

console.log("\n[5] 8 个经典案例");
const json = JSON.parse(readFileSync(resolve(root, "results", "cases.json"), "utf8"));
check("results/cases.json 有 8 个案例", json.cases.length === 8);
for (const c of CASES) {
  const r = calculateEV(c);
  const j = json.cases.find((x) => x.id === c.id);
  check(`${c.title}: 最优 = ${c.expectedBest}`, r.bestAction === c.expectedBest, `实际 ${r.bestAction}（call ${r.call.toFixed(1)} / raise ${r.raise.toFixed(1)}）`);
  check(`${c.title}: JSON 与实时计算一致`, j && near(j.output.ev.call, Math.round(r.call * 100) / 100) && near(j.output.ev.raise, Math.round(r.raise * 100) / 100) && j.output.bestAction === r.bestAction);
}
check("案例三种最优决策都出现过", ["fold", "call", "raise"].every((a) => json.cases.some((c) => c.output.bestAction === a)));
check("JSON summary.matched = 8", json.summary.matched === 8);

console.log(failed === 0 ? "\n全部通过" : `\n${failed} 项失败`);
process.exit(failed === 0 ? 0 : 1);
