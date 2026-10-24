import {calculateEV,actionLabel} from './ev.ts';
import type {EVParams,Action} from './types.ts';
export const MODEL_VERSION='effective-pot-v2-2026-10-24';

export function robustness(params: EVParams, uncertainty=10) {
  if(!Number.isInteger(uncertainty)||uncertainty<0||uncertainty>30)throw Error('强度误差范围须为 0–30 的整数。');
  const from=Math.max(0,Math.floor(params.handStrength-uncertainty)),to=Math.min(100,Math.ceil(params.handStrength+uncertainty));
  const points=Array.from({length:to-from+1},(_,i)=>{const strength=from+i,result=calculateEV({...params,handStrength:strength});return {strength,action:result.bestAction,ev:result[result.bestAction],call:result.call,raise:result.raise};});
  const actions=[...new Set(points.map(p=>p.action))] as Action[];
  return {from,to,points,actions,stable:actions.length===1,available:calculateEV(params).decisionAvailable};
}

export function decisionSnapshot(params: EVParams, uncertainty=10) {
  const result=calculateEV(params);
  if(!result.decisionAvailable)throw Error('当前无可投入筹码，没有可导出的行动比较。');
  return {format:'poker-ev-decision-v2',model:MODEL_VERSION,exportedAt:new Date().toISOString(),params:{...params,opponentBet:params.opponentAction==='check'?0:params.opponentBet},
    result,comparisonLabel:actionLabel(result.bestAction,params.opponentAction),counterfactual:robustness(params,uncertainty),
    limits:['单对手、单轮投入、无抽水、无后续下注；不处理多人边池和完整合法加注历史。','手牌强度与对手修正是人为假设，不是实际 equity 或 GTO 求解。','强度误差区间是用户设定的情景范围，不是置信区间或真实行动成功率。','公共牌只记录场景，不自动计算胜率；不应用作真实下注建议。']};
}
