"use client";

// 主页面：四个 tab 共享一份状态。
// 数据流是一条直线：state → toParams → calculateEV → 各面板。没有 store、没有 reducer。

import { useEffect, useMemo, useState } from "react";
import styles from "@/styles/Calculator.module.css";
import CalculatorPanel, { toParams, effectiveStrength, type CalcState } from "@/components/CalculatorPanel";
import SensitivityPanel from "@/components/SensitivityPanel";
import CasePanel from "@/components/CasePanel";
import AboutPanel from "@/components/AboutPanel";
import { calculateEV } from "@/lib/ev";
import type { CaseDef } from "@/lib/types";

const TABS = [
  { id: "calc", label: "EV 计算器", sub: "输入参数，看三个决策" },
  { id: "sensitivity", label: "敏感性分析", sub: "牌要多强才该跟" },
  { id: "cases", label: "案例库", sub: "8 个经典场景" },
  { id: "about", label: "关于", sub: "算法 + 强度表" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const DEFAULT_STATE: CalcState = {
  hand: [{ rank: "A", suit: "s" }, { rank: "K", suit: "h" }],
  board: [],
  strengthOverride: null,
  pot: 100,
  opponentBet: 50,
  myStack: 500,
  opponentStack: 500,
  opponentType: "balanced",
  opponentAction: "bet",
};

export default function Home() {
  const [tab, setTab] = useState<TabId>("calc");
  const [state, setState] = useState<CalcState>(DEFAULT_STATE);
  const [caseId, setCaseId] = useState<string | null>(null);

  const params = useMemo(() => toParams(state), [state]);
  const result = useMemo(() => calculateEV(params), [params]);

  const patch = (p: Partial<CalcState>) => {
    setState((s) => ({ ...s, ...p }));
    setCaseId(null); // 手改参数就不再跟随案例
  };

  const applyCase = (c: CaseDef) => {
    setState({
      hand: c.hand,
      board: c.board,
      strengthOverride: c.handStrength,
      pot: c.pot,
      opponentBet: c.opponentBet,
      myStack: c.myStack,
      opponentStack: c.opponentStack,
      opponentType: c.opponentType,
      opponentAction: c.opponentAction,
    });
    setCaseId(c.id);
    go("calc");
  };

  // 用 URL hash 记住 tab，方便直接分享到某一页
  useEffect(() => {
    const h = window.location.hash.replace("#", "") as TabId;
    if (TABS.some((t) => t.id === h)) setTab(h);
  }, []);
  const go = (id: TabId) => {
    setTab(id);
    if (typeof window !== "undefined") window.history.replaceState(null, "", `#${id}`);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className={styles.wrap}>
      <header className={styles.top}>
        <h1>Poker EV Calculator</h1>
        <p className={styles.sub}>
          德州扑克期望值计算器 —— 回答一个问题：<b>我该不该跟这一注？</b>
          输入牌面、底池、筹码、对手类型和行动，实时看弃牌 / 跟注 / 加注的期望收益。
        </p>
        <div className={styles.meta}>
          全部计算在浏览器里完成 · 简化模型，公式见 <code>lib/ev.ts</code> · 校验产物在 <code>results/cases.json</code>
        </div>
      </header>

      <nav className={styles.tabbar} aria-label="页面切换">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={tab === t.id ? styles.active : ""} onClick={() => go(t.id)}>
            {t.label}
            <small>{t.sub}</small>
          </button>
        ))}
      </nav>

      {tab === "calc" && <CalculatorPanel state={state} result={result} onChange={patch} />}
      {tab === "sensitivity" && <SensitivityPanel params={params} currentStrength={effectiveStrength(state)} />}
      {tab === "cases" && <CasePanel activeId={caseId} onPick={applyCase} />}
      {tab === "about" && <AboutPanel />}

      <footer className={styles.footer}>
        Poker EV Calculator · MIT ·{" "}
        <a href="https://github.com/AndyZhang666666/poker-ev-calculator" target="_blank" rel="noreferrer">GitHub</a>
        {" "}· 同一套「决策树 + 概率权重」逻辑也用在{" "}
        <a href="https://github.com/AndyZhang666666/growth-experiment-lab" target="_blank" rel="noreferrer">growth-experiment-lab</a>
        {" "}的「要不要停实验」上。
      </footer>
    </div>
  );
}
