'use client';
import {useRef, useState, type ChangeEvent, type Dispatch, type SetStateAction} from 'react';
import {decodeNotebook, mergeNotebooks, recordAttempt, MAX_NOTEBOOK_BYTES, type Mistake, type Notebook} from '@/lib/poker/notebook';
import {type Action} from '@/lib/poker/training';
import {downloadJson} from '@/lib/poker/download';
import PracticeQuestion from './PracticeQuestion';
import styles from '@/styles/PokerLab.module.css';

export default function ReviewPanel({book, update, onPractice}: {
  book: Notebook; update: Dispatch<SetStateAction<Notebook>>; onPractice: () => void;
}) {
  const [filter, setFilter] = useState<'due' | 'mastered' | 'archived'>('due');
  const [selected, setSelected] = useState<Mistake | null>(null), [answer, setAnswer] = useState<Action | null>(null);
  const [notice, setNotice] = useState(''), [importCharts, setImportCharts] = useState(false);
  const answerLock = useRef(false);
  const items = book.mistakes.filter(item => filter === 'archived' ? item.archived : !item.archived && (filter === 'due' ? item.reviewStreak < 2 : item.reviewStreak === 2));
  const review = (item: Mistake) => {setSelected(item); setAnswer(null); answerLock.current = false;};
  const respond = (action: Action) => {
    if (!selected || answerLock.current) return;
    answerLock.current = true; setAnswer(action);
    const attempt = {id: crypto.randomUUID(), at: new Date().toISOString(), spot: selected.spot, action, mode: 'review' as const};
    update(current => recordAttempt(current, attempt));
  };
  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    try {
      if (file.size > MAX_NOTEBOOK_BYTES) throw new Error('备份文件超过 8 MB，请选择本工具导出的备份。');
      const incoming = decodeNotebook(await file.text());
      if (!incoming) throw new Error('这个文件不是有效的训练备份，当前记录没有改变。');
      update(current => ({...mergeNotebooks(current, incoming), charts: importCharts ? incoming.charts : current.charts}));
      setNotice('备份已合并，相同作答不会重复计数。' + (importCharts ? '已载入备份中的参考范围。' : '当前参考范围保持不变。'));
    } catch (reason) {setNotice((reason as Error).message);}
  };
  const latest = selected ? book.mistakes.find(item => item.key === selected.key) : null;
  return <div className={styles.layout}>
    <section className={styles.panel} aria-labelledby="review-list-title">
      <div className={styles.sectionRow}><h2 id="review-list-title">把同一类决策再练一次</h2><button type="button" onClick={onPractice}>继续范围训练</button></div>
      <p className={styles.muted}>每道题保留当时的手牌、位置与参考。连续两次重练符合参考后，移到“已巩固”；以后再偏离会重新进入待重练。</p>
      <div className={styles.filterRow}>{([['due', '待重练'], ['mastered', '已巩固'], ['archived', '已归档']] as const).map(([value, label]) =>
        <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}<span className={styles.muted}>{items.length} 题</span></div>
      {!items.length ? <p className={styles.empty}>{book.mistakes.length ? '这一栏暂时没有题目。' : '错题本还是空的。到范围训练完成作答，偏离参考的题目会自动保留。'}</p>
        : <div className={styles.mistakeList}>{items.map(item => <article className={styles.mistakeItem} key={item.key}>
          <div><strong>{item.spot.position} · {item.spot.hand}</strong><p>偏离 {item.errors} 次 · 连续通过 {item.reviewStreak} / 2 次</p>
            <span className={styles.mistakeMeta}>最近作答 {new Date(item.lastAt).toLocaleDateString('zh-CN')}</span></div>
          <div className={styles.inlineRow}><button type="button" onClick={() => review(item)}>重练这题</button>
            <button type="button" onClick={() => update(current => ({...current, mistakes: current.mistakes.map(old => old.key === item.key ? {...old, archived: !old.archived} : old)}))}>{item.archived ? '移回错题本' : '归档'}</button></div>
        </article>)}</div>}
      <details className={styles.methods} style={{marginTop: 20}}><summary>备份与导入</summary>
        <p>备份包含参考范围、最近 500 次作答和最多 200 个错题。记录只在本机；导出文件可自己保管或在另一台设备导入。</p>
        <button type="button" onClick={() => {downloadJson(book, 'poker-lab-notebook-v1.json'); setNotice('已导出训练备份。');}}>导出训练与错题</button>
        <p><label><input type="checkbox" checked={importCharts} onChange={event => setImportCharts(event.target.checked)}/> 同时载入备份中的参考范围</label></p>
        <label className={styles.fieldLabel} htmlFor="notebook-import">导入并合并记录</label>
        <input className={styles.fileInput} id="notebook-import" type="file" accept=".json,application/json" onChange={importFile}/>
      </details>
      {notice && <p className={styles.notice} role="status">{notice}</p>}
    </section>
    <section className={styles.panel} aria-labelledby="review-question-title">
      <h2 id="review-question-title">{selected ? '重练时，仍使用当时的参考' : '先选择一道题'}</h2>
      {selected ? <>
        <PracticeQuestion key={selected.key} spot={selected.spot} answer={answer} onAnswer={respond}/>
        {answer && <p className={styles.notice} aria-live="polite">{latest?.reviewStreak === 2 ? '本题已巩固。你仍可继续重练，或换一道题。' : '当前连续符合参考 ' + (latest?.reviewStreak ?? 0) + ' / 2 次。'}</p>}
        <button type="button" style={{marginTop: 18}} onClick={() => {setAnswer(null); answerLock.current = false;}}>再练这道题</button>
      </> : <p className={styles.empty}>从左侧点“重练这题”。作答前不会显示参考答案。</p>}
    </section>
  </div>;
}
