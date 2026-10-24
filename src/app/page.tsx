"use client";

// 主页面：四个 tab 共享一份状态。
// 数据流是一条直线：state → toParams → calculateEV → 各面板。没有 store、没有 reducer。

import { useEffect, useMemo, useState } from "react";
import dynamic from 'next/dynamic';
import styles from "@/styles/Calculator.module.css";
import CalculatorPanel, { toParams, effectiveStrength, type CalcState } from "@/components/CalculatorPanel";
const SensitivityPanel=dynamic(()=>import('@/components/SensitivityPanel'),{loading:()=> <p role="status">正在加载敏感性曲线…</p>});
import CasePanel from "@/components/CasePanel";
import AboutPanel from "@/components/AboutPanel";
import { calculateEV } from "@/lib/ev";
import type { CaseDef } from "@/lib/types";
import {DEFAULT_STATE,STORE,decodeDraft} from '@/lib/session';
import {decisionSnapshot} from '@/lib/decision';

const TABS = [
  { id: "calc", label: "EV 计算器", sub: "输入参数，看三个决策" },
  { id: "sensitivity", label: "敏感性分析", sub: "牌要多强才该跟" },
  { id: "cases", label: "案例库", sub: "8 个经典场景" },
  { id: "about", label: "关于", sub: "算法 + 强度表" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function Home() {
  const [tab, setTab] = useState<TabId>("calc");
  const [state, setState] = useState<CalcState>(DEFAULT_STATE);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [uncertainty,setUncertainty]=useState(10);
  const [restored,setRestored]=useState(false);
  const [notice,setNotice]=useState('参数仅保存在当前浏览器，不上传。');
  useEffect(()=>{try{const raw=localStorage.getItem(STORE),saved=decodeDraft(raw);if(saved){setState(saved.state);setUncertainty(saved.uncertainty);setNotice('已恢复此浏览器的参数草稿。');}else if(raw){localStorage.removeItem(STORE);setNotice('旧草稿无法恢复，已载入默认参数。');}}catch{setNotice('本地存储不可用；计算仍可使用，但刷新不会恢复。');}setRestored(true);},[]);
  useEffect(()=>{if(!restored)return;try{localStorage.setItem(STORE,JSON.stringify({version:1,state,uncertainty}));}catch{setNotice('草稿保存失败；当前计算不受影响，可先导出留存。');}},[state,uncertainty,restored]);

  const params = useMemo(() => toParams(state), [state]);
  const result = useMemo(() => calculateEV(params), [params]);
  const exportDecision=()=>{try{const text=JSON.stringify(decisionSnapshot(params,uncertainty),null,2),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='poker-ev-decision.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('已导出参数、模型版本、比较和反事实范围；不是实际下注建议。');}catch(e){setNotice((e as Error).message);}};

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
        <a className={styles.back} href="https://andyzhang666666.github.io/#projects">← Andy 的作品</a>
        <h1>Poker EV · 决策沙盘</h1>
        <p className={styles.sub}>
          不只看哪个行动 EV 高，也看<b>估错一点，结论会不会变。</b>输入假设，比较单轮筹码收益。
        </p>
        <div className={styles.meta}>
          单对手 · 无抽水 · 无后续下注 · 本地计算。强度表不是实际胜率，公共牌不参与自动计算；不是 GTO 求解器。
        </div>
      </header>

      <nav className={styles.tabbar} aria-label="页面切换">
        {TABS.map((t) => (
          <button key={t.id} type="button" aria-pressed={tab===t.id} className={tab === t.id ? styles.active : ""} onClick={() => go(t.id)}>
            {t.label}
            <small>{t.sub}</small>
          </button>
        ))}
      </nav>
      <div className={styles.utilitybar}><p role="status">{notice}</p><button type="button" onClick={()=>{setState(DEFAULT_STATE);setUncertainty(10);setCaseId(null);setNotice('已恢复默认参数。');}}>恢复默认</button><button type="button" onClick={exportDecision} disabled={!result.decisionAvailable}>导出这次比较</button></div>

      {tab === "calc" && <CalculatorPanel state={state} result={result} onChange={patch} uncertainty={uncertainty} onUncertainty={setUncertainty}/>}
      {tab === "sensitivity" && <SensitivityPanel params={params} currentStrength={effectiveStrength(state)} />}
      {tab === "cases" && <CasePanel activeId={caseId} onPick={applyCase} />}
      {tab === "about" && <AboutPanel />}

      <footer className={styles.footer}>
        Poker EV Calculator · MIT ·{" "}
        <a href="https://github.com/AndyZhang666666/poker-ev-calculator" target="_blank" rel="noreferrer">GitHub</a>
        {" "}· 这是可检查假设的学习沙盘，不应用作真实下注建议。对手范围、弃牌率和未来行动没有经过校准。
      </footer>
    </div>
  );
}
