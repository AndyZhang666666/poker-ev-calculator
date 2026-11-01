import {cardLabel, DECK, SUIT_LABELS, type Card} from '@/lib/poker/cards';
import styles from '@/styles/PokerLab.module.css';

export function CardFace({card, large = false}: {card: Card; large?: boolean}) {
  return <span className={[styles.card, large ? styles.largeCard : '', /[hd]$/.test(card) ? styles.redCard : ''].join(' ')} aria-label={cardLabel(card)}>
    <span>{card[0] === 'T' ? '10' : card[0]}</span><small aria-hidden="true">{SUIT_LABELS[card[1]]}</small>
  </span>;
}
export function CardSelect({card, label, used, onChange}: {card: Card; label: string; used: Card[]; onChange: (card: Card) => void}) {
  return <label className={styles.cardSelect}><CardFace card={card}/><span className={styles.srOnly}>{label}</span>
    <select aria-label={label} value={card} onChange={event => onChange(event.target.value)}>
      {DECK.map(value => <option key={value} value={value} disabled={value !== card && used.includes(value)}>{cardLabel(value)}</option>)}
    </select></label>;
}
