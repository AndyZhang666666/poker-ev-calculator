'use client';
import {useEffect, useId, useMemo, useState} from 'react';
import {formatRange, parseRange, rangeSize} from '@/lib/poker/ranges';
import RangeMatrix from './RangeMatrix';
import styles from '@/styles/PokerLab.module.css';

interface Props {value: string; onChange: (value: string) => void; label: string; highlight?: string}
export default function RangeEditor({value, onChange, label, highlight}: Props) {
  const id = useId();
  const [draft, setDraft] = useState(value), [weight, setWeight] = useState(1), [error, setError] = useState('');
  useEffect(() => {setDraft(value); setError('');}, [value]);
  const weights = useMemo(() => parseRange(value), [value]);
  const dirty = draft !== value;
  const apply = () => {
    try {const parsed = parseRange(draft); onChange(formatRange(parsed)); setDraft(formatRange(parsed)); setError('');}
    catch (reason) {setError((reason as Error).message);}
  };
  return <div className={styles.rangeEditor}>
    <div className={styles.inlineRow}><label htmlFor={`${id}-brush`}>点选频率</label>
      <select id={`${id}-brush`} value={weight} onChange={event => setWeight(Number(event.target.value))}>
        {[1, .75, .5, .25].map(w => <option key={w} value={w}>{w * 100}%</option>)}
      </select><span className={styles.muted}>{rangeSize(weights).toFixed(1)} / 1,326 组合 · {(rangeSize(weights) / 1326 * 100).toFixed(1)}%</span></div>
    <RangeMatrix label={label} weights={weights} highlight={highlight} disabled={dirty} onPick={name => {
      const next = {...weights}; if (next[name] === weight) delete next[name]; else next[name] = weight;
      onChange(formatRange(next));
    }}/>
    <p className={styles.micro}>上三角同花 s，下三角非同花 o，对角线为对子。蓝色表示纳入；格内百分比表示混合频率。窄屏可横向滑动，键盘可用方向键。</p>
    <label htmlFor={`${id}-range`} className={styles.fieldLabel}>{label}文字</label>
    <textarea id={`${id}-range`} value={draft} onChange={event => {setDraft(event.target.value); setError('');}} rows={3}
      spellCheck={false} aria-invalid={!!error} aria-describedby={`${id}-help ${id}-error`}/>
    <p id={`${id}-help`} className={styles.micro}>例如 TT+, A5s-A2s, AKo:50%。百分比为组合权重；重复项以后写的为准。</p>
    {dirty && <p className={styles.micro}>文字尚未应用；应用或撤销后可继续点选矩阵。</p>}
    <div className={styles.inlineRow}><button type="button" onClick={apply} disabled={!dirty}>应用文字</button>
      {dirty && <button type="button" onClick={() => {setDraft(value); setError('');}}>撤销文字修改</button>}
      <button type="button" onClick={() => {onChange(''); setDraft(''); setError('');}}>清空范围</button></div>
    <p id={`${id}-error`} role={error ? 'alert' : undefined} className={styles.error}>{error}</p>
  </div>;
}
