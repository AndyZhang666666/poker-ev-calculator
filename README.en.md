# Poker Lab · Equity & Practice

[Live app](https://andyzhang666666.github.io/poker-ev-calculator/) · [Range practice](https://andyzhang666666.github.io/poker-ev-calculator/#practice) · [Mistake review](https://andyzhang666666.github.io/poker-ev-calculator/#review) · [中文](README.md)

Calculate a hand, practise a positional range, then revisit the decisions that need work.

This release extends the original EV sandbox with real-card showdown equity, editable opening ranges and a local mistake notebook. It requires no account or API key. The original sandbox, sensitivity analysis and eight cases remain available.

## Workspaces

- **Equity:** Hero cards, a 0/3/4/5-card board, and a specific opponent hand or weighted range. Known cards are removed, ties split the pot, small trees are enumerated and larger trees use seeded Monte Carlo in a worker.
- **Practice:** Editable 13×13 charts, 30 authored teaching spots and ten-hand random groups. The scope is 6-max cash, 100bb, folded to Hero, raise-or-fold. Both supported actions are accepted for mixed frequencies.
- **Review:** Each mistake keeps its original cards, position and chart snapshot. Two consecutive compatible review answers mark it as consolidated; a later deviation reopens it. Records can be archived, exported and merged on import.
- **Legacy EV:** The existing single-street assumption sandbox, with its original effective-pot math and export.

The changes connect range assumptions, calculation, practice and saved evidence. New inputs cannot silently relabel an old result, and chart edits cannot silently change an old question's answer.

## Sources

Hand ranking uses [phe 0.6.0](https://github.com/thlorenz/phe), MIT. Matrix keyboard movement and combo counting adapt [Preflop Range Trainer](https://github.com/n1kFord/preflop-range-trainer), MIT. Full notices and exact reuse are documented in [THIRD-PARTY](docs/THIRD-PARTY.md).

Weighted range calculation, worker integration, teaching references, snapshot-based practice and review, backup validation and independent checks are implemented in this project. The built-in charts are teaching references, not commercial solver output or a GTO claim.

## Development

Node.js 22.18+.

```sh
npm ci
npm run check
npm run build
npm run preview
```

The preview is `http://127.0.0.1:8854/poker-ev-calculator/`. Keep the repository prefix. See [implementation and validation](docs/POKER-LAB-20261101.md), [methods](docs/POKER-METHODS.md) and [changelog](CHANGELOG.md).

No rake, side pots or future betting are modelled in showdown equity. Practice measures agreement with a selected reference, not profitability. Records stay in the current browser; export a backup before clearing site data.

<details>
<summary>Previous EV sandbox documentation</summary>

# Poker EV Calculator

[中文](README.md) · [Project index](https://github.com/AndyZhang666666/AndyZhang666666/blob/main/PROJECTS.en.md) · [Live demo](https://andyzhang666666.github.io/poker-ev-calculator/)

Does a small error in the strength assumption change the preferred action?

## Product decisions

- Use effective stakes consistently for pot odds and expected value.
- Inspect action changes across an explicit strength range.
- Export assumptions and model version; keep the single-street approximation visible.

## Walkthrough

1. Load a preset and inspect pot, stack and opponent assumptions.
2. Compare fold, call and raise, then set a strength-error range.
3. Inspect the sensitivity curve and export assumptions and limitations.

## Run mode and limits

A heads-up, single-street learning model. Board cards do not calculate equity automatically; strength and fold-rate assumptions are uncalibrated. It is not a GTO solver.

## Develop locally

```sh
npm ci
npm run dev
```

Open `http://localhost:3000/poker-ev-calculator/`. The repository base path is part of the URL.

## Lightweight checks

```sh
npm run check
npm run build
```

These commands are provided for reproduction; this documentation update did not run a new model benchmark.

## Documentation

- [Model assumptions](docs/ASSUMPTIONS.md)
- [Product scope](docs/PRD.md)
- [Validation records](docs/VALIDATION.md)
- [Implementation details and original records, Chinese](README.md)

Use the repository’s existing licence and notices. This update does not change usage rights.

</details>
