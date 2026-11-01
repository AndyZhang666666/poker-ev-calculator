import test from 'node:test';
import assert from 'node:assert/strict';
import phe from 'phe';
import {DECK, handClass, seededRandom} from '../src/lib/poker/cards.ts';
import {HAND_CLASSES, classCombos, getComboCount, parseRange, formatRange, rangeCombos, rangeSize} from '../src/lib/poker/ranges.ts';
import {prepareEquity, runEquity} from '../src/lib/poker/equity.ts';
import {DEFAULT_CHARTS, POSITIONS, gradeSpot, lessonSpots, makeSpot, randomSpot, validSpot} from '../src/lib/poker/training.ts';
import {decodeNotebook, emptyNotebook, mergeNotebooks, notebookStats, recordAttempt} from '../src/lib/poker/notebook.ts';
import {referenceRank} from './reference-poker.mjs';

const base = {hero: ['As', 'Ah'], board: ['2c', '3d', '7h', '9s'], opponent: {type: 'hand', cards: ['Kc', 'Kd']}, samples: 30000, seed: 20261101, method: 'auto'};
test('169 classes expand to every physical two-card holding exactly once', () => {
  assert.equal(HAND_CLASSES.length, 169);
  const combos = HAND_CLASSES.flatMap(name => {const c = classCombos(name); assert.equal(c.length, getComboCount(name)); return c;});
  assert.equal(combos.length, 1326);
  assert.equal(new Set(combos.map(cards => [...cards].sort().join(''))).size, 1326);
  for (const cards of combos) assert.ok(HAND_CLASSES.includes(handClass(cards)));
  assert.equal(rangeSize(Object.fromEntries(HAND_CLASSES.map(h => [h, 1]))), 1326);
});
test('range notation handles pairs, same-high and diagonal intervals, both suits and frequencies', () => {
  assert.deepEqual(Object.keys(parseRange('TT+')), ['TT', 'JJ', 'QQ', 'KK', 'AA']);
  assert.equal(Object.keys(parseRange('A2s+')).length, 12);
  assert.equal(Object.keys(parseRange('AK')).length, 2);
  assert.equal(Object.keys(parseRange('T9s-54s')).length, 6);
  const weights = parseRange('AA:50%, AKs:0.25, A5s-A2s, AA:0');
  assert.equal(weights.AA, undefined); assert.equal(weights.AKs, .25); assert.equal(weights.A2s, 1);
  assert.deepEqual(parseRange(formatRange(weights)), weights);
  assert.equal(rangeSize(parseRange('AA:50%, AKs:25%')), 4);
  const precise = parseRange('AA:0.123456, AKs:0.0000001');
  assert.deepEqual(parseRange(formatRange(precise)), precise);
  for (const value of ['hello', 'AAo', 'AKs:101%', 'AA:-1', 'AA:NaN', 'AA:', 'AA:2', 'AKs-AQo', 'A5s-KTs', 'A0s']) assert.throws(() => parseRange(value), value);
});
test('known-card removal counts actual remaining combinations before normalizing weights', () => {
  assert.equal(rangeCombos(parseRange('AA'), ['As']).length, 3);
  assert.equal(rangeCombos(parseRange('AKs'), ['As']).length, 3);
  const p = prepareEquity({...base, opponent: {type: 'range', text: 'AA, KK'}});
  assert.equal(p.combos.length, 7); assert.equal(p.blockedCombos, 5);
});
test('river certainties reach 0 and 1; the board can force a split pot', () => {
  const win = runEquity({...base, board: [...base.board, 'Jc']});
  assert.equal(win.equity, 1); assert.equal(win.method, 'exact'); assert.equal(win.interval95, null);
  assert.equal(runEquity({...base, hero: ['Kc', 'Kd'], board: [...base.board, 'Jc'], opponent: {type: 'hand', cards: ['As', 'Ah']}}).equity, 0);
  const tie = runEquity({...base, hero: ['2c', '3d'], board: ['As', 'Ks', 'Qs', 'Js', 'Ts'], opponent: {type: 'hand', cards: ['4c', '5d']}});
  assert.equal(tie.tie, 1); assert.equal(tie.equity, .5); assert.equal(tie.win + tie.loss, 0);
});
test('a turn fixture has exactly two losing rivers among 44 legal runouts', () => {
  const result = runEquity(base);
  assert.equal(result.evaluations, 44); assert.equal(result.possibleScenarios, 44);
  assert.equal(result.equity, 42 / 44);
  assert.ok(Math.abs(result.win + result.tie + result.loss - 1) < 1e-12);
});
test('weighted river ranges are normalized by physical combos and their weights', () => {
  const result = runEquity({...base, hero: ['Ts', 'Th'], board: [...base.board, 'Jc'], opponent: {type: 'range', text: 'AA:25%, 88:75%'}});
  assert.equal(result.equity, .75); assert.equal(result.opponentCombos, 12); assert.equal(result.weightedCombos, 6);
});
test('invalid states cannot reach the evaluator, including empty blocked ranges', () => {
  for (const patch of [{hero: ['As', 'As']}, {board: ['As', '2c', '3d']}, {board: ['2c']}, {board: ['2c', '3d']}, {samples: 0}, {seed: NaN}, {seed: -1}, {method: '__proto__'}, {opponent: {type: 'range', text: ''}}, {opponent: {type: 'hand', cards: ['As', 'Kc']}}]) assert.throws(() => runEquity({...base, ...patch}));
  assert.throws(() => runEquity({...base, board: ['Ac', 'Ad', '2c'], opponent: {type: 'range', text: 'AA'}}));
});
test('Monte Carlo is seeded, preserves inputs and agrees with an independently enumerable case', () => {
  const input = {...base, board: ['2c', '3d', '7h'], method: 'monte-carlo'};
  const original = JSON.stringify(input), a = runEquity(input), b = runEquity(input);
  const exact = runEquity({...input, method: 'auto'});
  for (const key of ['equity', 'win', 'tie', 'loss', 'interval95', 'evaluations']) assert.deepEqual(a[key], b[key]);
  assert.equal(JSON.stringify(input), original);
  assert.ok(Math.abs(a.equity - exact.equity) < .015);
  assert.ok(a.interval95[0] <= exact.equity && a.interval95[1] >= exact.equity);
  const certain = runEquity({...base, board: [...base.board, 'Jc'], method: 'monte-carlo'});
  assert.ok(certain.interval95[0] < 1); // Observing only wins must not imply an exact answer.
});
test('preflop large trees choose sampling and progress finishes at the reported count', () => {
  let progress;
  const result = runEquity({...base, board: [], samples: 1000}, (done, total) => {progress = [done, total];});
  assert.equal(result.method, 'monte-carlo'); assert.deepEqual(progress, [1000, 1000]);
});
test('lookup evaluator agrees with a separate 5-card-subset evaluator on fixed and random matchups', () => {
  const random = seededRandom(83901);
  const fixed = [
    ['As','2d','3c','4h','5s','Kc','Kd'], ['Ah','2h','3h','4h','5h','Ks','Qd'],
    ['Ac','Ad','Ah','Kc','Kd','Kh','2s'], ['As','Ah','Ks','Kh','Qs','Qh','2c'],
    ['Ac','Ad','Ah','As','Kc','Qd','2s'], ['As','Ks','Qs','Js','Ts','2c','3d'],
  ];
  for (let i = 0; i < 1500; i++) {
    const deck = [...DECK];
    for (let j = 0; j < 14; j++) {const k = j + Math.floor(random() * (52 - j)); [deck[j], deck[k]] = [deck[k], deck[j]];}
    const count = 5 + i % 3;
    const a = i < fixed.length ? fixed[i] : deck.slice(0, count), b = deck.slice(7, 7 + count);
    assert.equal(Math.sign(phe.evaluateCards(b) - phe.evaluateCards(a)), Math.sign(referenceRank(a) - referenceRank(b)), `${a} vs ${b}`);
  }
});
test('all thirty teaching spots validate and random practice samples physical distinct cards', () => {
  assert.equal(lessonSpots().length, 30); assert.ok(lessonSpots().every(validSpot));
  for (let i = 0; i < 500; i++) assert.ok(validSpot(randomSpot(DEFAULT_CHARTS, [...POSITIONS], 42, i)));
});
test('mixed-frequency references accept both supported actions without claiming frequency calibration', () => {
  const spot = makeSpot('BTN', ['As', 'Kh'], {...DEFAULT_CHARTS, BTN: 'AKo:50%'}, 'mixed');
  assert.equal(gradeSpot(spot, 'raise').compatible, true); assert.equal(gradeSpot(spot, 'fold').compatible, true);
  assert.equal(gradeSpot(spot, 'fold').mixed, true);
});
const attempt = (spot, action, mode, index) => ({id: `attempt-${index}`, at: new Date(1793491200000 + index * 1000).toISOString(), spot, action, mode});
test('mistakes survive, require two review successes and reopen on a new deviation', () => {
  const spot = lessonSpots()[0];
  let book = recordAttempt(emptyNotebook(), attempt(spot, 'fold', 'practice', 0));
  assert.equal(notebookStats(book).due, 1);
  book = recordAttempt(book, attempt(spot, 'raise', 'review', 1)); assert.equal(notebookStats(book).due, 1);
  book = recordAttempt(book, attempt(spot, 'raise', 'review', 2)); assert.equal(notebookStats(book).mastered, 1);
  book = recordAttempt(book, attempt(spot, 'fold', 'practice', 3)); assert.equal(notebookStats(book).due, 1);
  assert.equal(book.mistakes[0].errors, 2);
  assert.deepEqual(recordAttempt(book, book.attempts.at(-1)), book);
  assert.deepEqual(decodeNotebook(JSON.stringify(book)), book);
});
test('changing a chart does not rewrite the reference attached to old mistakes', () => {
  const spot = lessonSpots()[0], book = recordAttempt(emptyNotebook(), attempt(spot, 'fold', 'practice', 0));
  book.charts.UTG = 'AA';
  assert.equal(book.mistakes[0].spot.openFrequency, 1);
  const next = makeSpot('UTG', spot.cards, book.charts, 'new');
  assert.equal(next.openFrequency, 0); assert.notEqual(next.reference, spot.reference);
});
test('import validates evidence rather than accepting corrupt grades, cards or counters', () => {
  const spot = lessonSpots()[0], book = recordAttempt(emptyNotebook(), attempt(spot, 'fold', 'practice', 0));
  for (const patch of [{version: 2}, {attempts: [{...book.attempts[0], action: 'call'}]}, {mistakes: [{...book.mistakes[0], reviewStreak: 99}]}, {attempts: [{...book.attempts[0], spot: {...spot, openFrequency: .2}}]}]) assert.equal(decodeNotebook(JSON.stringify({...book, ...patch})), null);
  assert.equal(decodeNotebook('{'), null);
  const merged = mergeNotebooks(book, book); assert.equal(merged.attempts.length, 1); assert.equal(merged.mistakes.length, 1);
  assert.equal(merged.charts, book.charts);
});
test('a full 500-attempt backup with precise custom ranges can import its own export', () => {
  const text = formatRange(Object.fromEntries(HAND_CLASSES.map(name => [name, .1234567890123456])));
  const charts = Object.fromEntries(POSITIONS.map(position => [position, text]));
  const spot = makeSpot('UTG', ['As', 'Qh'], charts, 'large-backup');
  const book = {...emptyNotebook(), charts, attempts: Array.from({length: 500}, (_, i) => attempt(spot, 'raise', 'practice', i))};
  const exported = JSON.stringify(book);
  assert.ok(new TextEncoder().encode(exported).byteLength > 2000000);
  assert.deepEqual(decodeNotebook(exported), book);
});
