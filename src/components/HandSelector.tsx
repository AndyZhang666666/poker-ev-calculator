"use client";

// 手牌选择器：两个「点数 + 花色」下拉 + 一排公共牌。
// 任务书说可以简化成下拉，不做拖拽。牌面用 emoji 花色符号，不依赖图片资源。

import { useState } from "react";
import styles from "@/styles/Calculator.module.css";
import type { Card, Rank, Suit } from "@/lib/types";
import { RANKS, SUITS, SUIT_SYMBOL, RANK_LABEL, sameCard } from "@/lib/handStrength";

export function CardFace({ card, className }: { card: Card; className?: string }) {
  const red = card.suit === "h" || card.suit === "d";
  return (
    <span className={`${styles.cardFace} ${red ? styles.red : styles.black} ${className ?? ""}`}>
      {RANK_LABEL[card.rank]}
      <small>{SUIT_SYMBOL[card.suit]}</small>
    </span>
  );
}

function CardPicker({ card, onChange, taken }: { card: Card; onChange: (c: Card) => void; taken: Card[] }) {
  const isTaken = (c: Card) => taken.some((t) => sameCard(t, c) && !sameCard(t, card));
  return (
    <div className={styles.cardPick}>
      <select
        value={card.rank}
        onChange={(e) => onChange({ ...card, rank: e.target.value as Rank })}
        aria-label="点数"
      >
        {RANKS.map((r) => (
          <option key={r} value={r} disabled={isTaken({ rank: r, suit: card.suit })}>
            {RANK_LABEL[r]}
          </option>
        ))}
      </select>
      <select
        value={card.suit}
        onChange={(e) => onChange({ ...card, suit: e.target.value as Suit })}
        aria-label="花色"
      >
        {SUITS.map((s) => (
          <option key={s} value={s} disabled={isTaken({ rank: card.rank, suit: s })}>
            {SUIT_SYMBOL[s]}
          </option>
        ))}
      </select>
    </div>
  );
}

interface Props {
  hand: [Card, Card];
  board: Card[];
  onHandChange: (h: [Card, Card]) => void;
  onBoardChange: (b: Card[]) => void;
}

export default function HandSelector({ hand, board, onHandChange, onBoardChange }: Props) {
  const [pending, setPending] = useState<Card>({ rank: "K", suit: "d" });
  const all = [...hand, ...board];
  const pendingTaken = all.some((c) => sameCard(c, pending));

  return (
    <>
      <div className={styles.field}>
        <div className={styles.fieldHead}>
          <label>我的手牌</label>
        </div>
        <div className={styles.cardRow}>
          <CardFace card={hand[0]} />
          <CardPicker card={hand[0]} taken={all} onChange={(c) => onHandChange([c, hand[1]])} />
          <CardFace card={hand[1]} />
          <CardPicker card={hand[1]} taken={all} onChange={(c) => onHandChange([hand[0], c])} />
        </div>
      </div>

      <div className={styles.field}>
        <div className={styles.fieldHead}>
          <label>公共牌 <span className={styles.small}>（可选，0-5 张）</span></label>
          {board.length > 0 && (
            <button type="button" className={styles.linkBtn} onClick={() => onBoardChange([])}>
              清空
            </button>
          )}
        </div>
        <div className={styles.boardRow}>
          {board.length === 0 && <span className={styles.empty}>翻牌前 —— 还没有公共牌</span>}
          {board.map((c, i) => (
            <button key={i} type="button" className={styles.removeCard} aria-label={`移除公共牌 ${RANK_LABEL[c.rank]}${SUIT_SYMBOL[c.suit]}`} onClick={() => onBoardChange(board.filter((_, j) => j !== i))}>
              <CardFace card={c} />
            </button>
          ))}
        </div>
        {board.length < 5 && (
          <div className={styles.boardAdd}>
            <select value={pending.rank} onChange={(e) => setPending({ ...pending, rank: e.target.value as Rank })} aria-label="公共牌点数">
              {RANKS.map((r) => <option key={r} value={r}>{RANK_LABEL[r]}</option>)}
            </select>
            <select value={pending.suit} onChange={(e) => setPending({ ...pending, suit: e.target.value as Suit })} aria-label="公共牌花色">
              {SUITS.map((s) => <option key={s} value={s}>{SUIT_SYMBOL[s]}</option>)}
            </select>
            <button type="button" disabled={pendingTaken} onClick={() => onBoardChange([...board, pending])}>
              + 加一张{pendingTaken ? "（已用）" : ""}
            </button>
          </div>
        )}
        <div className={styles.note} style={{ marginTop: 8 }}>
          公共牌只用于记录场景。简化模型不会根据牌面自动重算强度 —— 翻牌后请按成牌 / 听牌情况手动调「手牌强度」滑条（案例库里有参考值）。
        </div>
      </div>
    </>
  );
}
