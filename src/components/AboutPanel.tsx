"use client";

// Tab 4：关于。算法说明 + 13×13 起手牌强度矩阵。
// 参数值全部从 lib/ev.ts 的常量读出来，文档不会和代码脱节。

import styles from "@/styles/Calculator.module.css";
import { RANKS, HAND_STRENGTH } from "@/lib/handStrength";
import {
  OPPONENT_TYPE_ADJUST, OPPONENT_ACTION_ADJUST, BASE_FOLD_RATE, FOLD_RATE_ACTION_ADJUST,
  CALLED_PENALTY_TYPE, CALLED_PENALTY_ACTION, RAISE_MULTIPLIER, BET_POT_FRACTION,
  WIN_RATE_FLOOR, WIN_RATE_CEIL, FOLD_RATE_FLOOR, FOLD_RATE_CEIL,
} from "@/lib/ev";

const pp = (x: number) => `${x > 0 ? "+" : ""}${Math.round(x * 100)}pp`;
const pct = (x: number) => `${Math.round(x * 100)}%`;

function cellColor(v: number) {
  // 0 → 浅红，50 → 米白，100 → 深绿
  if (v >= 50) {
    const t = (v - 50) / 50;
    return `rgba(46, 139, 87, ${0.12 + t * 0.7})`;
  }
  const t = (50 - v) / 50;
  return `rgba(184, 50, 42, ${0.06 + t * 0.4})`;
}

export default function AboutPanel() {
  return (
    <div className={styles.about}>
      <div className={styles.panel}>
        <h2>这个工具回答什么</h2>
        <p>
          德州扑克里每一个「跟不跟」都是期望值问题：<b>EV = Σ 概率 × 收益</b>。这个计算器把三个选项的 EV 摆在一起，
          并告诉你在当前对手条件下，牌要多强才值得跟、多强才值得加。它是决策辅助，不是胜率求解器。
        </p>
        <h3>公式</h3>
        <pre className={styles.formula}>{`弃牌 EV = 0
跟注 EV = 胜率 × (底池 + 跟注额) − (1 − 胜率) × 跟注额
加注 EV = 弃牌率 × (底池 + 对手下注)
        + (1 − 弃牌率) × [被跟注后胜率 × (底池 + 加注额) − (1 − 被跟注后胜率) × 加注额]

底池赔率 = 跟注额 / (底池 + 对手下注 + 跟注额)     ← 跟注所需的最低胜率
跟注临界强度 = (底池赔率 − 对手类型修正 − 对手行动修正) × 100`}</pre>

        <h3>胜率怎么估</h3>
        <p>
          基础胜率 = 手牌强度 / 100，再按对手类型和对手行动修正，夹在 {pct(WIN_RATE_FLOOR)}–{pct(WIN_RATE_CEIL)}。
        </p>
        <table style={{ maxWidth: 520 }}>
          <thead><tr><th>对手类型</th><th className="num">胜率修正</th><th className="num">基础弃牌率</th><th className="num">被跟注后胜率惩罚</th></tr></thead>
          <tbody>
            {(["loose", "balanced", "tight"] as const).map((t) => (
              <tr key={t}>
                <td>{t === "loose" ? "松" : t === "tight" ? "紧" : "平衡"}</td>
                <td className="num">{pp(OPPONENT_TYPE_ADJUST[t])}</td>
                <td className="num">{pct(BASE_FOLD_RATE[t])}</td>
                <td className="num">−{Math.round(CALLED_PENALTY_TYPE[t] * 100)}pp</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table style={{ maxWidth: 520, marginTop: 12 }}>
          <thead><tr><th>对手行动</th><th className="num">胜率修正</th><th className="num">弃牌率修正</th><th className="num">被跟注后胜率惩罚</th></tr></thead>
          <tbody>
            {(["check", "bet", "raise"] as const).map((a) => (
              <tr key={a}>
                <td>{a === "check" ? "过牌" : a === "bet" ? "下注" : "加注"}</td>
                <td className="num">{pp(OPPONENT_ACTION_ADJUST[a])}</td>
                <td className="num">{pp(FOLD_RATE_ACTION_ADJUST[a])}</td>
                <td className="num">−{Math.round(CALLED_PENALTY_ACTION[a] * 100)}pp</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>加注怎么算</h3>
        <ul>
          <li>加注额 = 对手下注 × {RAISE_MULTIPLIER}；对手过牌时改为下注 {Math.round(BET_POT_FRACTION * 100)}% 底池。受双方筹码限制，对手已全押时不能加注。</li>
          <li>对手弃牌率 = 基础弃牌率 + (手牌强度 − 50) / 200 + 行动修正，夹在 {pct(FOLD_RATE_FLOOR)}–{pct(FOLD_RATE_CEIL)}。手牌越强、加注越「可信」。</li>
          <li>
            <b>被跟注后胜率</b> = 胜率 − 类型惩罚 − 行动惩罚。对手弃掉的是弱牌、跟下来的是强牌，紧对手尤其如此。
            这是任务书原公式之外唯一的加项 —— 不加它，紧对手场景的加注 EV 会系统性偏高。
          </li>
        </ul>

        <h3>刻意不做的</h3>
        <ul>
          <li><b>不枚举公共牌算真实胜率。</b>翻牌后请按成牌 / 听牌情况手动调强度（两头顺 ≈ 60、同花听牌 ≈ 40 是案例库里用的参考值）。</li>
          <li><b>不建模对手的具体范围。</b>「松 / 紧 / 平衡」三档是对范围宽度的粗略代理。</li>
          <li><b>不考虑位置、多人底池、后续街的隐含赔率。</b>所有 EV 都是「这一手到此为止」的一次性估算。</li>
        </ul>
        <p className={styles.small}>
          完整假设清单见仓库 <code>docs/ASSUMPTIONS.md</code>，取舍记录见 <code>docs/DECISIONS.md</code>，校验脚本 <code>npm run check</code>。
        </p>
      </div>

      <div className={styles.panel}>
        <h2>169 起手牌强度表 <small>行 = 第一张，列 = 第二张；右上同花、左下非同花、对角口袋对</small></h2>
        <div className={styles.matrix}>
          <div className={styles.hd} />
          {RANKS.map((r) => <div key={r} className={styles.hd}>{r}</div>)}
          {RANKS.map((row, i) => (
            <RowCells key={row} row={row} i={i} />
          ))}
        </div>
        <div className={styles.note}>
          这是「可玩性」打分而非对随机手牌的真实胜率。任务书给定的 27 个锚点原样保留（AA 95、KK 92、AKs 78、AKo 72、KQs 68、72o 5 …），
          其余由 <code>scripts/gen-hand-strength.mjs</code> 按规则生成：口袋对 60 + 4 × (点数 − 5)，非同花按高牌基准减间隔惩罚，同花 = 非同花 + 6。
          尺度偏向口袋对是规格带来的取舍（55 = 60 高于 AKs 以下一片），真实排序里 76s 会比 22 更值钱。
        </div>
      </div>
    </div>
  );
}

function RowCells({ row, i }: { row: (typeof RANKS)[number]; i: number }) {
  return (
    <>
      <div className={styles.hd}>{row}</div>
      {RANKS.map((col, j) => {
        let key: string;
        if (i === j) key = `${row}${col}`;
        else if (j > i) key = `${row}${col}s`;
        else key = `${col}${row}o`;
        const v = HAND_STRENGTH[key];
        return (
          <div key={col} className={styles.cell} style={{ background: cellColor(v) }} title={`${key} = ${v}`}>
            <b>{key}</b>
            {v}
          </div>
        );
      })}
    </>
  );
}
