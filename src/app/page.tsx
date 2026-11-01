"use client";

// 新工作区与原 EV 沙盘分开管理状态；旧 hash 仍指向原来的面板。

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
import {useNotebook} from '@/lib/poker/useNotebook';
import {notebookStats} from '@/lib/poker/notebook';
import labStyles from '@/styles/PokerLab.module.css';
const EquityPanel=dynamic(()=>import('@/components/poker/EquityPanel'),{loading:()=> <p role="status">正在加载算牌工作区…</p>});
const PracticePanel=dynamic(()=>import('@/components/poker/PracticePanel'),{loading:()=> <p role="status">正在加载范围训练…</p>});
const ReviewPanel=dynamic(()=>import('@/components/poker/ReviewPanel'),{loading:()=> <p role="status">正在加载错题本…</p>});

const TABS = [
  { id: "calc", label: "EV 计算器", sub: "输入参数，看三个决策" },
  { id: "sensitivity", label: "敏感性分析", sub: "牌要多强才该跟" },
  { id: "cases", label: "案例库", sub: "8 个经典场景" },
  { id: "about", label: "关于", sub: "算法 + 强度表" },
] as const;
type TabId = (typeof TABS)[number]["id"] | 'equity' | 'practice' | 'review';
const WORKSPACES = [
  {id:'equity',label:'真实算牌',sub:'手牌、公共牌与对手范围'},
  {id:'practice',label:'范围训练',sub:'按位置作答与编辑参考'},
  {id:'review',label:'错题重练',sub:'保留当时的判断依据'},
  {id:'calc',label:'决策沙盘',sub:'保留原有 EV 与敏感性分析'},
] as const;

export default function Home() {
  const [tab, setTab] = useState<TabId>("equity");
  const notebook = useNotebook();
  const isLegacy = TABS.some(t=>t.id===tab);
  const practiceStats = notebookStats(notebook.book);
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
    const readHash=()=>{
      const h = window.location.hash.replace("#", "") as TabId;
      if ([...TABS,...WORKSPACES].some((t) => t.id === h)) setTab(h);
    };
    readHash();window.addEventListener('hashchange',readHash);
    return ()=>window.removeEventListener('hashchange',readHash);
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
        <h1>Poker Lab · 手牌与训练</h1>
        <p className={styles.sub}>
          把一手牌算清楚，再把同一类决策练熟。
        </p>
        <div className={styles.meta}>
          算牌：单对手摊牌权益 · 训练：六人桌 100bb 开池参考 · 计算与记录留在本机
        </div>
      </header>

      <nav className={styles.tabbar} aria-label="选择工作区">
        {WORKSPACES.map(t=><button key={t.id} type="button" aria-pressed={t.id==='calc'?isLegacy:tab===t.id}
          className={(t.id==='calc'?isLegacy:tab===t.id)?styles.active:''} onClick={()=>go(t.id)}>
          {t.label}{t.id==='review' && practiceStats.due>0?' · '+practiceStats.due:''}<small>{t.sub}</small>
        </button>)}
      </nav>
      {!isLegacy && <div className={styles.utilitybar}><p role="status">{notebook.notice}</p>
        {!notebook.saving && <button type="button" onClick={notebook.enableSaving}>启用新记录保存</button>}</div>}
      {tab==='equity' && <EquityPanel/>}
      {tab==='practice' && <PracticePanel book={notebook.book} update={notebook.update} ready={notebook.ready} onReview={()=>go('review')}/>}
      {tab==='review' && <ReviewPanel book={notebook.book} update={notebook.update} onPractice={()=>go('practice')}/>}
      {isLegacy && <><p className={labStyles.notice}>原 EV 教学沙盘：下方使用手动强度、弃牌率等假设，公共牌仅记录场景。要按牌面和范围计算摊牌权益，请使用“真实算牌”。</p>
      <nav className={styles.tabbar} aria-label="原决策沙盘页面切换">
        {TABS.map((t) => (
          <button key={t.id} type="button" aria-pressed={tab===t.id} className={tab === t.id ? styles.active : ""} onClick={() => go(t.id)}>
            {t.label}
            <small>{t.sub}</small>
          </button>
        ))}
      </nav></>}
      {isLegacy && <>
      <div className={styles.utilitybar}><p role="status">{notice}</p><button type="button" onClick={()=>{setState(DEFAULT_STATE);setUncertainty(10);setCaseId(null);setNotice('已恢复默认参数。');}}>恢复默认</button><button type="button" onClick={exportDecision} disabled={!result.decisionAvailable}>导出这次比较</button></div>

      {tab === "calc" && <CalculatorPanel state={state} result={result} onChange={patch} uncertainty={uncertainty} onUncertainty={setUncertainty}/>}
      {tab === "sensitivity" && <SensitivityPanel params={params} currentStrength={effectiveStrength(state)} />}
      {tab === "cases" && <CasePanel activeId={caseId} onPick={applyCase} />}
      {tab === "about" && <AboutPanel />}
      </>}

      <footer className={styles.footer}>
        <details className={labStyles.methods}><summary>计算方法、训练依据与开源来源</summary>
          <p>真实算牌按给定对手手牌或范围，排除已知牌后计算摊牌权益。小规模精确枚举，其余固定种子抽样；平局各分一半。抽样区间仅覆盖抽样误差。</p>
          <p>内置 30 手基础题与五个位置范围是可修改的教学参考，不是完整 GTO 策略。旧错题保留原参考，长期混合频率不由单次作答判定。</p>
          <p>牌型评估使用 <a href="https://github.com/thlorenz/phe" target="_blank" rel="noreferrer">phe 0.6.0</a>；范围矩阵的键盘移动与组合计数改编自 <a href="https://github.com/n1kFord/preflop-range-trainer" target="_blank" rel="noreferrer">Preflop Range Trainer</a>。范围加权、计算调度、版本化训练与错题流程在本项目接入和扩展。</p>
          <p>训练与错题存在当前浏览器，清理网站数据会丢失；可在错题本导出备份。无账号与云同步。</p>
        </details>
        <p>Poker Lab · MIT ·{" "}
        <a href="https://github.com/AndyZhang666666/poker-ev-calculator" target="_blank" rel="noreferrer">GitHub</a>
        {" "}· 牌面计算、参考范围与每次作答均可检查。</p>
      </footer>
    </div>
  );
}
