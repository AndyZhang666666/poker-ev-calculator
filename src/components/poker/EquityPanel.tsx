'use client';
import {useCallback, useEffect, useRef, useState} from 'react';
import {DECK, type Card} from '@/lib/poker/cards';
import {prepareEquity, type EquityInput, type EquityResult} from '@/lib/poker/equity';
import {downloadJson} from '@/lib/poker/download';
import {CardFace, CardSelect} from './Cards';
import RangeEditor from './RangeEditor';
import styles from '@/styles/PokerLab.module.css';

const DRAFT_KEY = 'poker-lab-equity-input-v1';
const INITIAL: EquityInput = {hero: ['As', 'Kh'], board: ['Qh', 'Jh', '2c'],
  opponent: {type: 'range', text: 'QQ+, AQs+, KQs, AQo+'}, samples: 30000, seed: 20261101, method: 'auto'};
const EXAMPLES: {name: string; input: EquityInput}[] = [
  {name: '翻牌 · 高张面对范围', input: INITIAL},
  {name: '转牌 · AA 对 KK', input: {...INITIAL, hero: ['As', 'Ah'], board: ['2c', '3d', '7h', '9s'], opponent: {type: 'hand', cards: ['Kc', 'Kd']}}},
  {name: '河牌 · 公共牌同花顺', input: {...INITIAL, hero: ['2c', '3d'], board: ['As', 'Ks', 'Qs', 'Js', 'Ts'], opponent: {type: 'hand', cards: ['4c', '5d']}}},
  {name: '河牌 · 加权范围', input: {...INITIAL, hero: ['Ts', 'Th'], board: ['2c', '3d', '7h', '9s', 'Jc'], opponent: {type: 'range', text: 'AA:25%, 88:75%'}}},
  {name: '翻牌前 · AK 对 QQ', input: {...INITIAL, hero: ['As', 'Kh'], board: [], opponent: {type: 'hand', cards: ['Qc', 'Qd']}}},
];
const percent = (value: number) => (value * 100).toFixed(2) + '%';

export default function EquityPanel() {
  const [input, setInput] = useState<EquityInput>(INITIAL);
  const [result, setResult] = useState<EquityResult | null>(null);
  const [busy, setBusy] = useState(false), [progress, setProgress] = useState<[number, number] | null>(null);
  const [error, setError] = useState(''), [storageNotice, setStorageNotice] = useState('');
  const workerRef = useRef<Worker | null>(null);
  const lastRange = useRef(INITIAL.opponent.type === 'range' ? INITIAL.opponent.text : '');
  const lastHand = useRef<Card[]>(['9s', '9d']);
  const stop = useCallback(() => {
    workerRef.current?.terminate(); workerRef.current = null; setBusy(false); setProgress(null);
  }, []);
  const run = useCallback((request: EquityInput) => {
    workerRef.current?.terminate(); workerRef.current = null;
    setError(''); setProgress(null);
    try {
      prepareEquity(request);
      const worker = new Worker(new URL('../../workers/equity.worker.ts', import.meta.url), {type: 'module'});
      workerRef.current = worker; setBusy(true);
      worker.onmessage = event => {
        if (workerRef.current !== worker) return;
        const message = event.data;
        if (message.type === 'progress') setProgress([message.done, message.total]);
        else {
          if (message.type === 'result') setResult(message.result);
          else setError(message.message || '本次计算未完成，请重新计算。');
          worker.terminate(); workerRef.current = null; setBusy(false); setProgress(null);
        }
      };
      worker.onerror = () => {
        if (workerRef.current !== worker) return;
        worker.terminate(); workerRef.current = null; setBusy(false); setProgress(null);
        setError('计算未能启动或意外停止。请重新计算；仍失败时可刷新页面后重试。');
      };
      worker.postMessage(request);
      try {localStorage.setItem(DRAFT_KEY, JSON.stringify({version: 1, input: request}));}
      catch {setStorageNotice('当前输入无法保存；计算不受影响，可导出已完成结果留存。');}
    } catch (reason) {setBusy(false); setError((reason as Error).message);}
  }, []);
  useEffect(() => {
    let initial = INITIAL;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.version !== 1) throw new Error();
        prepareEquity(saved.input); initial = saved.input;
        setStorageNotice('已恢复上次有效输入。');
      }
    } catch {setStorageNotice('未能恢复输入，已使用示例；计算仍可使用。');}
    if (initial.opponent.type === 'range') lastRange.current = initial.opponent.text;
    else lastHand.current = initial.opponent.cards;
    setInput(initial); run(initial);
    return () => {workerRef.current?.terminate(); workerRef.current = null;};
  }, [run]);
  const patch = (change: Partial<EquityInput>) => {setInput(current => ({...current, ...change})); setError('');};
  const used = [...input.hero, ...input.board, ...(input.opponent.type === 'hand' ? input.opponent.cards : [])];
  const stale = !!result && JSON.stringify(result.input) !== JSON.stringify(input);
  const changeStreet = (count: number) => {
    const board = input.board.slice(0, count);
    const occupied = new Set([...input.hero, ...board, ...(input.opponent.type === 'hand' ? input.opponent.cards : [])]);
    for (const card of ['Qh', 'Jh', '2c', '7d', '4s', ...DECK]) {
      if (board.length >= count) break;
      if (!occupied.has(card)) {board.push(card); occupied.add(card);}
    }
    patch({board});
  };
  return <div className={styles.layout}>
    <section className={styles.panel} aria-labelledby="equity-input-title">
      <h2 id="equity-input-title">牌面与对手</h2>
      <fieldset disabled={busy}>
        <label className={styles.fieldLabel} htmlFor="equity-example">载入场景</label>
        <select id="equity-example" value="" onChange={event => {
          const example = EXAMPLES[Number(event.target.value)];
          setInput(example.input);
          if (example.input.opponent.type === 'range') lastRange.current = example.input.opponent.text;
          else lastHand.current = example.input.opponent.cards;
          run(example.input);
        }}><option value="" disabled>选择一个可检查的例子</option>{EXAMPLES.map((example, index) => <option key={example.name} value={index}>{example.name}</option>)}</select>
        <h3>我的手牌</h3>
        <div className={styles.cardRow}>{input.hero.map((card, index) => <CardSelect key={index} card={card} used={used}
          label={'我的第' + (index + 1) + '张牌'} onChange={value => patch({hero: input.hero.map((old, i) => i === index ? value : old)})}/>)}</div>
        <div className={styles.streetRow}><label htmlFor="equity-street">公共牌阶段</label>
          <select id="equity-street" value={input.board.length} onChange={event => changeStreet(Number(event.target.value))}>
            <option value={0}>翻牌前 · 0 张</option><option value={3}>翻牌 · 3 张</option><option value={4}>转牌 · 4 张</option><option value={5}>河牌 · 5 张</option>
          </select></div>
        <div className={styles.board}><div className={styles.cardRow}>{input.board.length ? input.board.map((card, index) => <CardSelect key={index}
          card={card} used={used} label={'公共牌第' + (index + 1) + '张'} onChange={value => patch({board: input.board.map((old, i) => i === index ? value : old)})}/>)
          : <span className={styles.muted}>尚未发公共牌，抽样会补全五张牌。</span>}</div></div>
        <div className={styles.inlineRow}><span className={styles.fieldLabel}>对手使用</span>
          <button type="button" aria-pressed={input.opponent.type === 'range'} onClick={() => patch({opponent: {type: 'range', text: lastRange.current}})}>手牌范围</button>
          <button type="button" aria-pressed={input.opponent.type === 'hand'} onClick={() => patch({opponent: {type: 'hand', cards: lastHand.current}})}>确定手牌</button></div>
        {input.opponent.type === 'hand' ? <div className={styles.cardRow}>{input.opponent.cards.map((card, index) => <CardSelect key={index}
          card={card} used={used} label={'对手第' + (index + 1) + '张牌'} onChange={value => {
            const cards = lastHand.current.map((old, i) => i === index ? value : old); lastHand.current = cards; patch({opponent: {type: 'hand', cards}});
          }}/>)}</div> : <details className={styles.methods}>
          <summary>编辑对手范围 · {input.opponent.text || '尚未选择'}</summary>
          <RangeEditor label="对手范围" value={input.opponent.text} onChange={text => {lastRange.current = text; patch({opponent: {type: 'range', text}});}}/>
        </details>}
        <details className={styles.methods}><summary>抽样次数与复现种子</summary>
          <p>小规模自动精确枚举；其余使用固定种子抽样。改变范围的影响可能大于抽样误差。</p>
          <div className={styles.inlineRow}><label htmlFor="equity-samples">抽样次数</label>
            <select id="equity-samples" value={input.samples} onChange={event => patch({samples: Number(event.target.value)})}>
              {[10000, 30000, 100000, 200000].map(value => <option key={value} value={value}>{value.toLocaleString()}</option>)}</select>
            <label htmlFor="equity-seed">种子</label><input id="equity-seed" type="number" min={0} max={4294967295} step={1} value={input.seed}
              onChange={event => patch({seed: event.target.valueAsNumber})}/></div>
        </details>
      </fieldset>
      <div className={styles.inlineRow} style={{marginTop: 18}}>
        <button type="button" className={styles.primary} disabled={busy} onClick={() => run(input)}>{busy ? '正在计算…' : '重新计算权益'}</button>
        {busy && <button type="button" onClick={() => {stop(); setError('本次计算已停止，之前的完整结果仍保留。');}}>停止计算</button>}
      </div>
      {busy && <div role="status"><p className={styles.micro}>{progress ? progress[0].toLocaleString() + ' / ' + progress[1].toLocaleString() + ' 个局面' : '正在准备本次计算…'}</p>
        <progress className={styles.progress} value={progress?.[0]} max={progress?.[1] ?? 1} aria-label="算牌进度"/></div>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {storageNotice && <p className={styles.micro}>{storageNotice}</p>}
    </section>
    <div>
      <section className={styles.panel} aria-labelledby="equity-result-title" aria-live="polite">
        <div className={styles.sectionRow}><h2 id="equity-result-title">这手牌的摊牌权益</h2>
          <span className={styles.muted}>{busy ? '本次计算进行中' : result ? result.method === 'exact' ? '精确枚举' : '蒙特卡洛抽样' : '尚无结果'}</span></div>
        {result ? <>
          {stale && <p className={styles.notice}>输入已改变。下方属于上一次已完成计算，请重新计算后再导出。</p>}
          {busy && <p className={styles.micro}>新结果完成前，继续显示上一组完整结果。</p>}
          <div className={styles.resultNumber} data-testid="equity-value">{percent(result.equity)}</div>
          <p className={styles.resultLabel}>获胜概率 ＋ 平局概率 ÷ 2</p>
          <div className={styles.resultBreakdown}><div><span>获胜</span><strong>{percent(result.win)}</strong></div>
            <div><span>平局</span><strong>{percent(result.tie)}</strong></div><div><span>落败</span><strong>{percent(result.loss)}</strong></div></div>
          <div className={styles.snapshotCards} aria-label="这组结果的牌面">{result.input.hero.map(card => <CardFace key={card} card={card}/>)}
            <span className={styles.snapshotDivider}/>{result.input.board.map(card => <CardFace key={card} card={card}/>)}
            {!result.input.board.length && <span className={styles.micro}>翻牌前</span>}</div>
          <dl className={styles.facts}>
            <div><dt>对手可用组合</dt><dd>{result.opponentCombos.toLocaleString()}</dd></div>
            <div><dt>因已知牌排除</dt><dd>{result.blockedCombos.toLocaleString()} 个组合</dd></div>
            <div><dt>组合权重总和</dt><dd>{Number(result.weightedCombos.toPrecision(6))}</dd></div>
            <div><dt>本次评估局面</dt><dd>{result.evaluations.toLocaleString()}</dd></div>
            <div><dt>计算耗时</dt><dd>{result.elapsedMs.toLocaleString()} ms · 当前设备</dd></div>
            <div><dt>种子</dt><dd>{result.input.seed}</dd></div>
          </dl>
          <p className={styles.notice}>{result.interval95
            ? '保守 95% 抽样区间：' + percent(result.interval95[0]) + '–' + percent(result.interval95[1]) + '。只涵盖抽样误差，不涵盖对手范围是否合理。'
            : '已遍历当前手牌与范围下的全部合法局面，没有抽样误差。对手范围仍是你的假设。'}</p>
          <details className={styles.methods}><summary>查看本组对手输入与计算版本</summary>
            <p className={styles.savedReference}>{result.input.opponent.type === 'range' ? result.input.opponent.text : result.input.opponent.cards.join(' ')}</p>
            <p>{result.version}</p></details>
          <button type="button" disabled={busy || stale} onClick={() => downloadJson({...result,
            limits: ['单对手摊牌权益，无抽水、边池和未来下注。', '范围权重由用户给定，不是对手行为预测。', '抽样区间不包含范围假设错误。']}, 'poker-lab-equity.json')}>导出这组计算</button>
        </> : <p className={styles.empty}>计算完成后，在这里核对获胜、平局与落败。</p>}
      </section>
      <section className={styles.panel}>
        <h2>先看范围，再看数字</h2>
        <p className={styles.muted}>相同牌面，面对 AA 与面对一整段范围，答案会不同。逐张排除已知牌，再按你给定的权重计算。</p>
        <p className={styles.micro}>这里假设双方直接摊牌，后续公共牌正常发出。权益不包含未来下注、弃牌收益或抽水，也不直接决定应该采取的行动。</p>
      </section>
    </div>
  </div>;
}
