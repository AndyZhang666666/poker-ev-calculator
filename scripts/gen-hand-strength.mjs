// 一次性生成 169 起手牌强度表（生成结果作为字面量写入 src/lib/handStrengthTable.ts）
// 生成后这个脚本不参与构建/校验，表以字面量形式被 verify 脚本断言。
import { writeFileSync } from "fs";

const CH = { 14: "A", 13: "K", 12: "Q", 11: "J", 10: "T", 9: "9", 8: "8", 7: "7", 6: "6", 5: "5", 4: "4", 3: "3", 2: "2" };

// 口袋对：60 + 4*(rank-5)，55=60 … KK=92；AA 单列 95
function pair(r) {
  if (r === 14) return 95;
  return 60 + 4 * (r - 5);
}

// 非同花：以「高牌张的基准分」减去「两张牌之间的间隔惩罚」
const OFF_BASE = { 14: 72, 13: 62, 12: 52, 11: 45, 10: 38, 9: 32, 8: 26, 7: 21, 6: 17, 5: 14, 4: 11, 3: 8 };
function gapPenalty(hi, gap) {
  if (hi >= 11) return gap <= 4 ? 4 * gap : 16 + 2.5 * (gap - 4);
  if (hi >= 9) return gap <= 3 ? 4 * gap : 12 + 2.5 * (gap - 3);
  return gap <= 2 ? 3.5 * gap : 7 + 2.4 * gap;
}
function offsuit(hi, lo) {
  const gap = hi - lo - 1;
  let v = (OFF_BASE[hi] ?? 6) - gapPenalty(hi, gap);
  if (hi === 14 && lo <= 5) v += 1; // 轮子顺潜力
  return Math.max(6, Math.round(v)); // 72o=5 是唯一低于 6 的（override）
}
const SUITED_BONUS = 6;

const overrides = {
  "72o": 5, "73o": 6, "82o": 7,
};

const rows = [];
for (let hi = 14; hi >= 2; hi--) {
  for (let lo = hi - 1; lo >= 2; lo--) {
    const hiC = CH[hi], loC = CH[lo];
    rows.push([`${hiC}${loC}s`, overrides[`${hiC}${loC}s`] ?? Math.min(94, offsuit(hi, lo) + SUITED_BONUS)]);
    rows.push([`${hiC}${loC}o`, overrides[`${hiC}${loC}o`] ?? offsuit(hi, lo)]);
  }
}
for (let r = 14; r >= 2; r--) rows.push([`${CH[r]}${CH[r]}`, pair(r)]);

rows.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

const maxKey = Math.max(...rows.map((r) => r[0].length));
const body = rows.map(([k, v]) => `  "${k}": ${String(v).padStart(2)}`).join(",\n");

const out = `// 169 种起手牌强度表（0-100）。\n//
// 口径：这是「可玩性」打分，不是对随机手牌的胜率。数值由
// scripts/gen-hand-strength.mjs 生成（口袋对 60+4·(rank-5)、非同花按高牌基准减间隔惩罚、
// 同花 = 非同花 + 6），生成后以字面量固化，改动需同时改生成脚本并重跑 scripts/verify-cases.mjs。
//
// 任务书给定的锚点全部原样保留：AA 95 / KK 92 / QQ 88 / JJ 84 / TT 80 / 99 76 / 88 72 /
// 77 68 / 66 64 / 55 60 / AKs 78 / AQs 74 / AJs 70 / ATs 66 / AKo 72 / AQo 68 / AJo 64 /
// ATo 60 / KQs 68 / KJs 64 / KTs 60 / KQo 62 / KJo 58 / KTo 54 / 72o 5 / 73o 6 / 82o 7。
//
// 刻意不做的：不按 169 手牌的真实 hot-and-cold 胜率排序。真实排序里同花连张（76s）比
// 小口袋对（22）更值钱，本表因为要满足任务书锚点（55 = 60 高于 AKs 以下一片），
// 尺度天然偏向口袋对 —— 这是规格带来的取舍，写在 docs/DECISIONS.md。

export const HAND_STRENGTH: Readonly<Record<string, number>> = {
${body},
};

export const HAND_STRENGTH_ENTRIES = Object.entries(HAND_STRENGTH);
`;

writeFileSync(process.argv[2], out);
console.log("wrote", rows.length, "entries");
