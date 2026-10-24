'use client';
import {useMemo} from 'react';
import {robustness} from '@/lib/decision';
import {actionLabel} from '@/lib/ev';
import type {EVParams} from '@/lib/types';
import styles from '@/styles/Calculator.module.css';

export default function CounterfactualPanel({params,width,onWidth}:{params:EVParams;width:number;onWidth:(v:number)=>void}){
  const report=useMemo(()=>robustness(params,width),[params,width]);
  const samples=[report.points[0],report.points[Math.floor((report.points.length-1)/2)],report.points.at(-1)!];
  return <section className={styles.panel} aria-label="强度假设的反事实检查">
    <h2>结论经得起估错吗？</h2>
    <label className={styles.uncertaintyControl}>允许手牌强度估错 ±{width} 点
      <input type="range" min="0" max="30" step="1" value={width} onChange={e=>onWidth(Number(e.target.value))} aria-label="手牌强度误差范围" />
    </label>
    <p className={styles.counterfactualState} role="status">{report.stable?'这一段假设范围内，较优行动保持一致。':'这段范围内，较优行动会切换；不要只看中心值。'}</p>
    <div className={styles.scenarios}>{samples.map((p,i)=><div key={i}><span>{['偏低','中间','偏高'][i]} · 强度 {p.strength}</span><strong>{actionLabel(p.action,params.opponentAction)}</strong><span>EV {p.ev>=0?'+':''}{p.ev.toFixed(1)}</span></div>)}</div>
    <p className={styles.note}>检查范围 {report.from}–{report.to}，按每点 1 个强度逐项计算。这里只改变强度，其他人为假设不变；不是置信区间，也不表示真实牌局的成功率。</p>
  </section>;
}
