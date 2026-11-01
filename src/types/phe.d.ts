declare module 'phe' {
  export function cardCodes(cards: string[]): number[];
  export function evaluateCardCodes(cards: number[]): number;
  export function evaluateCards(cards: string[]): number;
}
