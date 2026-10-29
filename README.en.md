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
