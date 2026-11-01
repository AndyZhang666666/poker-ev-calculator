'use client';
import {useRef, useState, type Dispatch, type SetStateAction} from 'react';
import {DEFAULT_CHARTS, POSITIONS, POSITION_NAMES, gradeSpot, lessonSpots, randomSpot, type Action, type Position, type PracticeSpot} from '@/lib/poker/training';
import {notebookStats, recordAttempt, type Notebook} from '@/lib/poker/notebook';
import RangeEditor from './RangeEditor';
import PracticeQuestion from './PracticeQuestion';
import styles from '@/styles/PokerLab.module.css';

export default function PracticePanel({book, update, ready, onReview}: {
  book: Notebook; update: Dispatch<SetStateAction<Notebook>>; ready: boolean; onReview: () => void;
}) {
  const [scope, setScope] = useState<Position | 'all'>('all');
  const [mode, setMode] = useState<'lessons' | 'random'>('lessons');
  const [editor, setEditor] = useState<Position>('BTN');
  const [session, setSession] = useState<PracticeSpot[]>([]), [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<Action | null>(null), [correct, setCorrect] = useState(0);
  const answerLock = useRef(false);
  const stats = notebookStats(book);
  const spot = session[index];
  const start = () => {
    const positions = scope === 'all' ? [...POSITIONS] : [scope];
    const seed = Date.now() >>> 0;
    const spots = mode === 'lessons' ? lessonSpots(book.charts).filter(item => positions.includes(item.position))
      : Array.from({length: 10}, (_, i) => randomSpot(book.charts, positions, seed, i));
    setSession(spots); setIndex(0); setAnswer(null); setCorrect(0); answerLock.current = false;
  };
  const respond = (action: Action) => {
    if (!spot || answerLock.current) return;
    answerLock.current = true; setAnswer(action);
    if (gradeSpot(spot, action).compatible) setCorrect(value => value + 1);
    const attempt = {id: crypto.randomUUID(), at: new Date().toISOString(), spot, action, mode: 'practice' as const};
    update(current => recordAttempt(current, attempt));
  };
  return <div className={styles.layout}>
    <section className={styles.panel} aria-labelledby="practice-title">
      <h2 id="practice-title">按位置练习开池</h2>
      <div className={styles.inlineRow}><label htmlFor="practice-scope">训练位置</label>
        <select id="practice-scope" value={scope} onChange={event => setScope(event.target.value as Position | 'all')}>
          <option value="all">全部五个位置</option>{POSITIONS.map(position => <option key={position} value={position}>{position} · {POSITION_NAMES[position]}</option>)}</select>
        <label htmlFor="practice-mode">题目</label><select id="practice-mode" value={mode} onChange={event => setMode(event.target.value as 'lessons' | 'random')}>
          <option value="lessons">基础 30 手</option><option value="random">随机 10 手</option></select>
      </div>
      <p className={styles.micro}>基础题覆盖五个位置的边界；随机题按真实两张牌组合抽样。参考范围修改后，从下一组生效。</p>
      <div className={styles.stats}><span>最近作答<strong>{stats.total}</strong></span><span>符合参考<strong>{stats.correct}</strong></span><span>待重练<strong>{stats.due}</strong></span></div>
      {!session.length ? <div className={styles.empty}><p>先练一组，再看哪些位置容易偏离参考。</p>
        <button type="button" className={styles.primary} disabled={!ready} onClick={start}>开始一组练习</button></div>
        : !spot ? <div className={styles.empty} aria-live="polite"><h3>这一组完成了</h3><p>{session.length} 手中，{correct} 手符合当时的参考范围。</p>
          <div className={styles.inlineRow}><button type="button" className={styles.primary} onClick={start}>再练一组</button><button type="button" onClick={onReview}>去错题本重练</button></div></div>
          : <>
            <p className={styles.micro}>本组 {index + 1} / {session.length} · 已符合参考 {correct} 手</p>
            <PracticeQuestion spot={spot} answer={answer} onAnswer={respond}/>
            {answer && <button type="button" className={styles.primary} style={{marginTop: 18}} onClick={() => {
              setIndex(value => value + 1); setAnswer(null); answerLock.current = false;
            }}>{index + 1 === session.length ? '查看本组结果' : '下一手'}</button>}
          </>}
      <p className={styles.micro}>最近保留 500 次作答和 200 个错题条目。这里统计遵循给定参考的情况，不是牌技评分或盈利预测。</p>
    </section>
    <section className={styles.panel} aria-labelledby="reference-editor-title">
      <div className={styles.sectionRow}><h2 id="reference-editor-title">编辑我的参考范围</h2>
        <select aria-label="编辑哪个位置的范围" value={editor} onChange={event => setEditor(event.target.value as Position)}>
          {POSITIONS.map(position => <option key={position} value={position}>{position} · {POSITION_NAMES[position]}</option>)}</select></div>
      <p className={styles.muted}>内置范围是可修改的教学起点。你也可以填入自己有权使用的范围，按它练习。</p>
      <RangeEditor key={editor} label={editor + ' 开池范围'} value={book.charts[editor]} onChange={text => update(current => ({...current, charts: {...current.charts, [editor]: text}}))}/>
      <button type="button" disabled={book.charts[editor] === DEFAULT_CHARTS[editor]} onClick={() => update(current => ({...current, charts: {...current.charts, [editor]: DEFAULT_CHARTS[editor]}}))}>恢复此位置教学参考</button>
      <p className={styles.micro}>已有错题继续使用答错时的范围快照，修改这里不会悄悄改写旧题答案。</p>
    </section>
  </div>;
}
