// Independent, deliberately slow reference: rank every 5-card subset of a 5–7-card hand.
// No production evaluator, lookup table or production card encoding is used here.
const ranks = '23456789TJQKA';
function rankFive(cards) {
  const values = cards.map(c => ranks.indexOf(c[0]) + 2).sort((a, b) => b - a);
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  const groups = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const flush = cards.every(card => card[1] === cards[0][1]);
  const unique = [...new Set(values)];
  let straight = 0;
  if (unique.length === 5) {
    if (unique[0] - unique[4] === 4) straight = unique[0];
    else if (unique.join(',') === '14,5,4,3,2') straight = 5;
  }
  let parts;
  if (straight && flush) parts = [8, straight];
  else if (groups[0][1] === 4) parts = [7, groups[0][0], groups[1][0]];
  else if (groups[0][1] === 3 && groups[1][1] === 2) parts = [6, groups[0][0], groups[1][0]];
  else if (flush) parts = [5, ...values];
  else if (straight) parts = [4, straight];
  else if (groups[0][1] === 3) parts = [3, ...groups.map(g => g[0])];
  else if (groups[0][1] === 2 && groups[1][1] === 2) parts = [2, ...groups.map(g => g[0])];
  else if (groups[0][1] === 2) parts = [1, ...groups.map(g => g[0])];
  else parts = [0, ...values];
  while (parts.length < 6) parts.push(0);
  return parts.reduce((score, part) => score * 15 + part, 0);
}
export function referenceRank(cards) {
  let best = -1;
  for (let a = 0; a < cards.length - 4; a++) for (let b = a + 1; b < cards.length - 3; b++)
    for (let c = b + 1; c < cards.length - 2; c++) for (let d = c + 1; d < cards.length - 1; d++)
      for (let e = d + 1; e < cards.length; e++) best = Math.max(best, rankFive([cards[a], cards[b], cards[c], cards[d], cards[e]]));
  return best;
}
