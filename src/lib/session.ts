import type {CalcState} from './types.ts';
export const STORE='poker-ev:draft:v1';
export const DEFAULT_STATE: CalcState={hand:[{rank:'A',suit:'s'},{rank:'K',suit:'h'}],board:[],strengthOverride:null,pot:100,opponentBet:50,myStack:500,opponentStack:500,opponentType:'balanced',opponentAction:'bet'};
const within=(v:unknown,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
export function decodeDraft(raw:string|null):{state:CalcState;uncertainty:number}|null {
  try{
    if(!raw||raw.length>8000)return null;const p=JSON.parse(raw),s=p.state;
    if(p.version!==1||!s||!Array.isArray(s.hand)||s.hand.length!==2||!Array.isArray(s.board)||s.board.length>5)return null;
    const cards=[...s.hand,...s.board];
    if(!cards.every(c=>c&&['A','K','Q','J','T','9','8','7','6','5','4','3','2'].includes(c.rank)&&['s','h','d','c'].includes(c.suit))||new Set(cards.map(c=>c.rank+c.suit)).size!==cards.length)return null;
    if(!within(s.pot,0,2000)||!within(s.opponentBet,0,1000)||!within(s.myStack,0,2000)||!within(s.opponentStack,0,2000)||!(s.strengthOverride===null||within(s.strengthOverride,0,100)))return null;
    if(!['loose','tight','balanced'].includes(s.opponentType)||!['bet','raise','check'].includes(s.opponentAction)||!Number.isInteger(p.uncertainty)||!within(p.uncertainty,0,30))return null;
    // Whitelist fields rather than copying arbitrary storage properties into live state.
    return {state:{hand:s.hand,board:s.board,strengthOverride:s.strengthOverride,pot:s.pot,opponentBet:s.opponentBet,myStack:s.myStack,opponentStack:s.opponentStack,opponentType:s.opponentType,opponentAction:s.opponentAction},uncertainty:p.uncertainty};
  }catch{return null;}
}
