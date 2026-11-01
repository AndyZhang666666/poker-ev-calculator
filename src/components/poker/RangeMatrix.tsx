'use client';
import {useRef, useState, type KeyboardEvent} from 'react';
import {HAND_CLASSES, getComboCount, type RangeWeights} from '@/lib/poker/ranges';
import styles from '@/styles/PokerLab.module.css';

interface Props {weights: RangeWeights; onPick?: (name: string) => void; highlight?: string; label?: string; disabled?: boolean}
// Keyboard movement adapted from n1kFord/preflop-range-trainer Chart.tsx (MIT).
// Changes: roving tabindex, ARIA labels, frequency state, readonly mode and highlighted evidence.
export default function RangeMatrix({weights, onPick, highlight, label = '手牌范围', disabled}: Props) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [focus, setFocus] = useState(0);
  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === 'ArrowUp') next = Math.max(index % 13, index - 13);
    else if (event.key === 'ArrowDown') next = Math.min(156 + index % 13, index + 13);
    else if (event.key === 'ArrowLeft') next = index % 13 ? index - 1 : index;
    else if (event.key === 'ArrowRight') next = (index + 1) % 13 ? index + 1 : index;
    else if (event.key === 'Home') next = event.ctrlKey ? 0 : index - index % 13;
    else if (event.key === 'End') next = event.ctrlKey ? 168 : index - index % 13 + 12;
    else return;
    event.preventDefault(); setFocus(next); refs.current[next]?.focus();
  };
  return <div className={styles.matrixScroll}>
    <div className={styles.matrix} role="grid" aria-label={label} aria-readonly={!onPick}>
      {Array.from({length: 13}, (_, row) => <div key={row} role="row" className={styles.matrixRow}>
        {HAND_CLASSES.slice(row * 13, row * 13 + 13).map((name, column) => {
          const index = row * 13 + column, weight = weights[name] ?? 0;
          const className = [styles.matrixCell, weight === 1 ? styles.inRange : weight > 0 ? styles.mixedRange : '',
            name.length === 2 ? styles.pair : '', name === highlight ? styles.highlightHand : ''].join(' ');
          const description = `${name}，频率 ${Number((weight * 100).toPrecision(6))}%，${getComboCount(name)} 个原始组合`;
          const content = <><span>{name}</span>{weight > 0 && weight < 1 && <small>{weight < .01 ? '<1%' : Number((weight * 100).toFixed(0)) + '%'}</small>}</>;
          return onPick ? <button key={name} ref={element => {refs.current[index] = element;}} type="button" role="gridcell"
            aria-label={description} aria-selected={weight > 0} title={description} tabIndex={focus === index ? 0 : -1}
            className={className} disabled={disabled} onFocus={() => setFocus(index)} onKeyDown={event => move(event, index)}
            onClick={() => onPick(name)}>{content}</button>
            : <div key={name} role="gridcell" aria-label={description} aria-selected={weight > 0} title={description} className={className}>{content}</div>;
        })}
      </div>)}
    </div>
  </div>;
}
