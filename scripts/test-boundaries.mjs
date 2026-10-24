import test from 'node:test';import assert from 'node:assert/strict';
import {calculateEV,breakEvenStrength,sensitivityAnalysis} from '../src/lib/ev.ts';
import {robustness,decisionSnapshot} from '../src/lib/decision.ts';
import {decodeDraft,DEFAULT_STATE} from '../src/lib/session.ts';
const base={handStrength:50,pot:100,opponentBet:50,myStack:500,opponentStack:500,opponentType:'balanced',opponentAction:'bet'};
test('short stack uses the same effective contested pot for odds and EV',()=>{
  const r=calculateEV({...base,handStrength:20,opponentType:'tight',opponentAction:'raise',opponentBet:1000,myStack:10,opponentStack:0});
  assert.ok(Math.abs(r.potOdds-10/120)<1e-12);assert.ok(r.winRate<r.potOdds);assert.ok(r.call<0);assert.equal(r.contestedOpponentBet,10);
});
test('call EV sign and the odds comparison agree across short/full stacks and all priors',()=>{
  for(const type of ['loose','balanced','tight'])for(const action of ['bet','raise'])for(const pot of [0,5,100,2000])for(const bet of [5,100,1000])for(const stack of [1,10,500,2000])for(const strength of [0,20,50,100]){
    const r=calculateEV({...base,opponentType:type,opponentAction:action,pot,opponentBet:bet,myStack:stack,handStrength:strength});
    assert.ok(Math.abs(r.call-(r.winRate-r.potOdds)*(pot+2*r.callAmount))<1e-8);
    assert.ok(r.raiseAmount<=stack);assert.ok(r.raiseAmount<=bet+base.opponentStack);
  }
});
test('check normalizes a stale betting control and zero stack gives no action recommendation',()=>{
  const a=calculateEV({...base,opponentAction:'check',opponentBet:1000});const b=calculateEV({...base,opponentAction:'check',opponentBet:0});assert.deepEqual(a,b);
  const r=calculateEV({...base,myStack:0});assert.equal(r.decisionAvailable,false);assert.equal(r.call,0);assert.throws(()=>decisionSnapshot({...base,myStack:0}));
});
test('invalid model inputs, inherited enum names and nonfinite amounts are rejected',()=>{
  for(const patch of [{pot:-1},{myStack:NaN},{opponentBet:Infinity},{opponentType:'constructor'},{opponentAction:'__proto__'},{handStrength:101}])assert.throws(()=>calculateEV({...base,...patch}));
});
test('reported internal call boundary really crosses zero',()=>{
  for(const type of ['loose','balanced','tight'])for(const bet of [1,50,500])for(const stack of [10,2000]){
    const p={...base,opponentType:type,opponentBet:bet,myStack:stack},s=breakEvenStrength(p);if(s===null)continue;
    assert.ok(Math.abs(calculateEV({...p,handStrength:s}).call)<1e-8);
    assert.ok(calculateEV({...p,handStrength:Math.max(0,s-.01)}).call<0);
    assert.ok(calculateEV({...p,handStrength:Math.min(100,s+.01)}).call>0);
  }
});
test('unsafe sensitivity steps reject and any valid step still includes 100',()=>{
  for(const step of [0,-1,Infinity,2.5])assert.throws(()=>sensitivityAnalysis(base,step));assert.equal(sensitivityAnalysis(base,30).at(-1).handStrength,100);
});
test('counterfactual reports discrete assumptions rather than an invented probability',()=>{
  const r=robustness({...base,handStrength:30},10);assert.equal(r.points.length,21);assert.equal(r.from,20);assert.equal(r.to,40);
  assert.equal(r.stable,new Set(r.points.map(p=>p.action)).size===1);assert.equal(robustness({...base,handStrength:0},30).from,0);
  const snapshot=decisionSnapshot(base);assert.equal(snapshot.model,'effective-pot-v2-2026-10-24');assert.match(snapshot.limits.join(' '),/不是置信区间/);
});
test('only validated versioned drafts restore, including exact cards and uncertainty',()=>{
  const raw=JSON.stringify({version:1,state:DEFAULT_STATE,uncertainty:10});assert.deepEqual(decodeDraft(raw),{state:DEFAULT_STATE,uncertainty:10});
  for(const value of ['{',JSON.stringify({version:2,state:DEFAULT_STATE,uncertainty:10}),JSON.stringify({version:1,state:{...DEFAULT_STATE,pot:-1},uncertainty:10}),JSON.stringify({version:1,state:{...DEFAULT_STATE,hand:[DEFAULT_STATE.hand[0],DEFAULT_STATE.hand[0]]},uncertainty:10})])assert.equal(decodeDraft(value),null);
});
