"use client";

// Tab 3：案例库。8 张卡片，点一张 → 填参数并跳回计算器。
// 卡片上显示的 EV 直接来自 calculateEV，和 results/cases.json 是同一份代码算出来的。

import styles from "@/styles/Calculator.module.css";
import type { CaseDef } from "@/lib/types";
import { CASES } from "@/lib/cases";
import { calculateEV, actionLabel } from "@/lib/ev";
import { CardFace } from "./HandSelector";

const STREET: Record<CaseDef["street"], string> = { preflop: "翻牌前", flop: "翻牌", turn: "转牌", river: "河牌" };
const OPP: Record<CaseDef["opponentType"], string> = { loose: "松", tight: "紧", balanced: "平衡" };
const ACT: Record<CaseDef["opponentAction"], string> = { bet: "下注", raise: "加注", check: "过牌" };
const fmt = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x).toFixed(1)}`;

export default function CasePanel({ activeId, onPick }: { activeId: string | null; onPick: (c: CaseDef) => void }) {
  return (
    <div>
      <div className={styles.panel}>
        <h2>8 个经典场景 <small>点一张卡片，一键填进计算器</small></h2>
        <p className={styles.small} style={{ margin: "0 0 14px" }}>
          覆盖弃牌、跟注与加注的假设比较，以及翻牌前、转牌、河牌场景。案例数字来自同一套简化模型，
          用于检查交互和计算一致性，不代表经真实牌局验证的策略。
        </p>
        <div className={styles.caseGrid}>
          {CASES.map((c, i) => {
            const r = calculateEV(c);
            return (
              <button key={c.id} type="button" className={`${styles.caseCard} ${activeId === c.id ? styles.active : ""}`} onClick={() => onPick(c)}>
                <div className={styles.caseHead}>
                  <span className={styles.idx}>案例 {i + 1}</span>
                  <span className={styles.street}>{STREET[c.street]}</span>
                </div>
                <h3>{c.title}</h3>
                <div className={styles.caseCards}>
                  <CardFace card={c.hand[0]} />
                  <CardFace card={c.hand[1]} />
                  {c.board.length > 0 && (
                    <>
                      <span className={styles.vs}>牌面</span>
                      {c.board.map((b, j) => <CardFace key={j} card={b} />)}
                    </>
                  )}
                </div>
                <div className={styles.caseMeta}>
                  强度 {c.handStrength} · 底池 {c.pot} · 对手{OPP[c.opponentType]} · {ACT[c.opponentAction]}
                  {c.opponentBet > 0 ? ` ${c.opponentBet}` : ""} · 筹码 {c.myStack}
                </div>
                <div className={styles.caseBest}>
                  <span>假设下较优：<b>{actionLabel(r.bestAction, c.opponentAction)}</b></span>
                  <span className={styles.caseEvs}>
                    {actionLabel("call", c.opponentAction)} {fmt(r.call)} · {actionLabel("raise", c.opponentAction)} {r.raiseAvailable ? fmt(r.raise) : "—"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
