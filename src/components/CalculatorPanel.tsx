"use client";

// Tab 1：EV 计算器。左 35% 参数，右 65% 结果。
// 所有计算都是 calculateEV 一个纯函数，这里只负责把 state 映射成控件、把 result 映射成文案。

import styles from "@/styles/Calculator.module.css";
import type { Card, EVParams, EVResult, OpponentAction, OpponentType } from "@/lib/types";
import { actionLabel } from "@/lib/ev";
import { handKey, handStrengthOf, strengthTier } from "@/lib/handStrength";
import HandSelector from "./HandSelector";
import ParamSlider from "./ParamSlider";
import EVChart from "./EVChart";

export interface CalcState {
  hand: [Card, Card];
  board: Card[];
  /** null = 跟随起手牌表；数字 = 用户手动覆盖 */
  strengthOverride: number | null;
  pot: number;
  opponentBet: number;
  myStack: number;
  opponentStack: number;
  opponentType: OpponentType;
  opponentAction: OpponentAction;
}

export function effectiveStrength(s: CalcState): number {
  if (s.strengthOverride !== null) return s.strengthOverride;
  return handStrengthOf(s.hand[0], s.hand[1]) ?? 50;
}

export function toParams(s: CalcState): EVParams {
  return {
    handStrength: effectiveStrength(s),
    pot: s.pot,
    opponentBet: s.opponentAction === "check" ? 0 : s.opponentBet,
    myStack: s.myStack,
    opponentStack: s.opponentStack,
    opponentType: s.opponentType,
    opponentAction: s.opponentAction,
  };
}

const OPP_TYPES: { id: OpponentType; label: string; hint: string }[] = [
  { id: "loose", label: "松", hint: "范围宽、爱跟注" },
  { id: "balanced", label: "平衡", hint: "标准打法" },
  { id: "tight", label: "紧", hint: "范围窄、有牌才动" },
];
const OPP_ACTIONS: { id: OpponentAction; label: string }[] = [
  { id: "bet", label: "下注" },
  { id: "raise", label: "加注" },
  { id: "check", label: "过牌" },
];

const fmtEV = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x).toFixed(1)}`;
const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
const evClass = (x: number) => (x > 0.005 ? styles.pos : x < -0.005 ? styles.neg : styles.zero);

interface Props {
  state: CalcState;
  result: EVResult;
  onChange: (patch: Partial<CalcState>) => void;
}

export default function CalculatorPanel({ state, result, onChange }: Props) {
  const params = toParams(state);
  const strength = params.handStrength;
  const tableStrength = handStrengthOf(state.hand[0], state.hand[1]);
  const tier = strengthTier(strength);
  const oa = state.opponentAction;
  const callName = actionLabel("call", oa);
  const raiseName = actionLabel("raise", oa);
  const bestName = actionLabel(result.bestAction, oa);
  const checkMode = oa === "check";
  const callAmount = Math.min(params.opponentBet, params.myStack);

  return (
    <div className={styles.grid}>
      {/* ---------- 参数区 ---------- */}
      <div>
        <div className={styles.panel}>
          <h2>牌面</h2>
          <HandSelector
            hand={state.hand}
            board={state.board}
            onHandChange={(hand) => onChange({ hand, strengthOverride: null })}
            onBoardChange={(board) => onChange({ board })}
          />
          <ParamSlider
            label="手牌强度"
            value={strength}
            min={0}
            max={100}
            dirty={state.strengthOverride !== null && state.strengthOverride !== tableStrength}
            onChange={(v) => onChange({ strengthOverride: v })}
            minLabel="0 · 72o"
            maxLabel="100"
            hint={tableStrength !== null ? `${handKey(state.hand[0], state.hand[1])} 表值 ${tableStrength}` : undefined}
          />
          <div className={styles.handMeta}>
            <span className={`${styles.tier} ${styles[tier.tone]}`}>{tier.label}</span>
            {state.strengthOverride !== null && state.strengthOverride !== tableStrength && (
              <button type="button" className={styles.linkBtn} onClick={() => onChange({ strengthOverride: null })}>
                恢复表值 {tableStrength}
              </button>
            )}
          </div>
        </div>

        <div className={styles.panel}>
          <h2>底池与筹码</h2>
          <ParamSlider label="当前底池" value={state.pot} min={0} max={2000} step={5} onChange={(v) => onChange({ pot: v })} />
          <ParamSlider
            label={checkMode ? "对手下注（过牌时不适用）" : "对手下注"}
            value={checkMode ? 0 : state.opponentBet}
            min={0}
            max={1000}
            step={5}
            onChange={(v) => onChange({ opponentBet: v })}
          />
          <ParamSlider label="我的剩余筹码" value={state.myStack} min={0} max={2000} step={10} onChange={(v) => onChange({ myStack: v })} />
          <ParamSlider label="对手剩余筹码" value={state.opponentStack} min={0} max={2000} step={10} onChange={(v) => onChange({ opponentStack: v })} />
        </div>

        <div className={styles.panel}>
          <h2>对手</h2>
          <div className={styles.field}>
            <div className={styles.fieldHead}><label>对手类型</label></div>
            <div className={styles.segment} role="radiogroup" aria-label="对手类型">
              {OPP_TYPES.map((t) => (
                <button key={t.id} type="button" className={state.opponentType === t.id ? styles.on : ""} onClick={() => onChange({ opponentType: t.id })} title={t.hint}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className={styles.fieldFoot}><span>{OPP_TYPES.find((t) => t.id === state.opponentType)?.hint}</span></div>
          </div>
          <div className={styles.field}>
            <div className={styles.fieldHead}><label>对手行动</label></div>
            <div className={styles.segment} role="radiogroup" aria-label="对手行动">
              {OPP_ACTIONS.map((a) => (
                <button key={a.id} type="button" className={oa === a.id ? styles.on : ""} onClick={() => onChange({ opponentAction: a.id })}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ---------- 结果区 ---------- */}
      <div>
        <div className={styles.panel}>
          <h2>EV 对比 <small>三个决策的期望收益，单位 = 筹码</small></h2>
          <EVChart result={result} opponentAction={oa} />
          <div className={styles.evRow}>
            {(["fold", "call", "raise"] as const).map((a) => {
              const isBest = result.bestAction === a;
              const disabled = a === "raise" && !result.raiseAvailable;
              return (
                <div key={a} className={`${styles.evCell} ${isBest ? styles.best : ""}`} style={disabled ? { opacity: 0.45 } : undefined}>
                  {isBest && <span className={styles.badge}>✓ 最优</span>}
                  <div className={styles.name}>
                    <span className={styles.dot} style={{ background: a === "fold" ? "var(--c-fold)" : a === "call" ? "var(--c-call)" : "var(--c-raise)" }} />
                    {actionLabel(a, oa)}
                  </div>
                  <div className={`${styles.ev} ${evClass(result[a])}`}>{disabled ? "—" : fmtEV(result[a])}</div>
                  <div className={styles.detail}>
                    {a === "fold" && "放弃已投入，永远 = 0"}
                    {a === "call" && (checkMode ? "免费看下一张" : `投入 ${callAmount}`)}
                    {a === "raise" && (disabled ? "筹码不足以加注" : `${raiseName}到 ${result.raiseAmount}`)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.panel}>
          <h2>关键指标</h2>
          <div className={styles.kpis}>
            <div className={styles.kpi}>
              <div className={styles.label}>胜率（估）</div>
              <div className={styles.big}>{pct(result.winRate)}</div>
              <div className={styles.hint}>强度 {strength} → {pct(strength / 100)}，对手修正后</div>
            </div>
            <div className={styles.kpi}>
              <div className={styles.label}>底池赔率（跟注所需胜率）</div>
              <div className={styles.big}>{checkMode ? "—" : pct(result.potOdds)}</div>
              <div className={styles.hint}>
                {checkMode ? "对手过牌，跟注不花钱" : `${callAmount} / (${params.pot} + ${params.opponentBet} + ${callAmount})`}
              </div>
            </div>
            <div className={`${styles.kpi} ${styles.best}`}>
              <div className={styles.label}>最优决策</div>
              <div className={styles.big}>{bestName}</div>
              <div className={styles.hint}>
                {result.breakEvenStrength !== null ? `跟注临界强度 ${result.breakEvenStrength.toFixed(0)}` : "无跟注临界点"}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.panel}>
          <h2>决策说明</h2>
          <div className={styles.explain}>
            {checkMode ? (
              <p>
                对手过牌，{callName}不花钱，EV = 胜率 × 底池 = <span className={evClass(result.call)}>{fmtEV(result.call)}</span>。
              </p>
            ) : (
              <p>
                你的胜率 <b>{pct(result.winRate)}</b> {result.winRate > result.potOdds ? ">" : result.winRate < result.potOdds ? "<" : "="} 底池赔率 <b>{pct(result.potOdds)}</b>，
                {result.call > 0 ? "跟注有利" : result.call < 0 ? "跟注亏钱" : "跟注刚好打平"}：
                {callName} EV = {pct(result.winRate)} × {params.pot + callAmount} − {pct(1 - result.winRate)} × {callAmount} ={" "}
                <span className={evClass(result.call)}>{fmtEV(result.call)}</span>。
              </p>
            )}
            {result.raiseAvailable ? (
              <p>
                {raiseName}到 {result.raiseAmount}：对手弃牌率 <b>{pct(result.opponentFoldRate)}</b>
                {result.opponentFoldRate >= 0.45 ? "（较高，逼走对手的价值大）" : result.opponentFoldRate <= 0.2 ? "（很低，基本要打到底）" : ""}，
                被跟注后我方胜率降到 <b>{pct(result.calledWinRate)}</b>（对手跟注范围更强）。
                {raiseName} EV = <span className={evClass(result.raise)}>{fmtEV(result.raise)}</span>
                {result.raise > result.call
                  ? `，比${callName}多 ${(result.raise - result.call).toFixed(1)}。`
                  : `，比${callName}少 ${(result.call - result.raise).toFixed(1)}${result.opponentFoldRate < 0.35 ? "，因为对手弃牌率不够" : "，因为被跟注后胜率不够"}。`}
              </p>
            ) : (
              <p>对手已经全押或你的筹码不足，没有加注空间，只在弃牌和{callName}之间选。</p>
            )}
            <p>
              结论：<b>{bestName}</b>
              {result.breakEvenStrength !== null && !checkMode && (
                <> · 在当前对手条件下，手牌强度低于 <b>{result.breakEvenStrength.toFixed(0)}</b> 时跟注开始亏钱（敏感性 tab 有完整曲线）。</>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
