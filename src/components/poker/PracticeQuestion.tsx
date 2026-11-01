'use client';
import {gradeSpot, POSITION_NAMES, type Action, type PracticeSpot} from '@/lib/poker/training';
import {parseRange} from '@/lib/poker/ranges';
import {CardFace} from './Cards';
import RangeMatrix from './RangeMatrix';
import styles from '@/styles/PokerLab.module.css';

export default function PracticeQuestion({spot, answer, onAnswer}: {
  spot: PracticeSpot; answer: Action | null; onAnswer: (action: Action) => void;
}) {
  const grade = answer ? gradeSpot(spot, answer) : null;
  return <>
    <div className={styles.trainerCard}>
      <p className={styles.positionText}>{spot.position} · {POSITION_NAMES[spot.position]} · 六人桌 · 100bb</p>
      <h2>前面均已弃牌，你会怎样开池？</h2>
      <div className={styles.cardRow}>{spot.cards.map(card => <CardFace key={card} card={card} large/>)}</div>
      <p className={styles.micro}>{spot.hand} · 简化的加注 / 弃牌参考，不包含平跟</p>
      <div className={styles.answerRow}>
        <button type="button" disabled={!!answer} aria-pressed={answer === 'fold'} onClick={() => onAnswer('fold')}>弃牌</button>
        <button type="button" className={styles.primary} disabled={!!answer} aria-pressed={answer === 'raise'} onClick={() => onAnswer('raise')}>加注开池</button>
      </div>
    </div>
    {grade && <div className={styles.feedback} aria-live="polite">
      <h3 className={grade.compatible ? styles.correct : styles.wrong}>{grade.compatible ? '符合本题参考' : '偏离本题参考'}</h3>
      <p>你选择了{answer === 'raise' ? '加注' : '弃牌'}；本题参考为 <strong>{grade.expected}</strong>。</p>
      {spot.explanation && <p className={styles.muted}>{spot.explanation}</p>}
      {grade.mixed && <p className={styles.notice}>本题允许两种动作。单次作答只检查动作是否被参考纳入，不据此评价你是否达到了长期混合频率。</p>}
      {!grade.compatible && <p className={styles.micro}>已保留本题当时的范围、手牌和位置；可以到错题本重练。</p>}
      <details className={styles.methods}><summary>查看本题参考范围与版本</summary>
        <RangeMatrix weights={parseRange(spot.rangeText)} highlight={spot.hand} label="本题当时的完整参考范围"/>
        <p className={styles.savedReference}>{spot.reference}</p>
        <p>这是当前选定的教学参考，并非完整 GTO 策略。适用条件为前面均弃牌、六人现金桌、100bb、无前注；实际桌况、抽水与后续策略会改变判断。</p>
      </details>
    </div>}
  </>;
}
