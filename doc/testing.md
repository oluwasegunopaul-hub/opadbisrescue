# Testing

[← Documentation index](../README.md#documentation)

## Current state

There is no automated test suite. Quality is currently gated by lint, a successful production build, and the manual regression pass in [workflow.md](./workflow.md#testing-workflow).

## Recommended stack

| Layer | Tool | Target |
| --- | --- | --- |
| Unit | Vitest | Pure logic in `src/lib` |
| Component | Vitest + Testing Library | Panels, filters, tables |
| End-to-end | Playwright | Study-area selection, quality filtering, export |

## Priority order

1. **Scoring** — fixture facilities with known tag sets asserting exact scores, bands and issue keys. Highest value: this is the output researchers cite.
2. **Duplicate detection** — synthetic pairs at controlled distances and name similarities asserting the confidence grade.
3. **Connectivity** — facilities placed at known distances from a synthetic road.
4. **Aggregation** — counts, averages and `topIssues` ordering.
5. **Exports** — CSV header stability and GeoJSON validity; export schema is a public contract.
6. **Boundary fallback** — the Nominatim miss path reaching the Overpass relation stage.

## Principles

- Test pure functions directly; do not test them through the UI.
- Mock upstream OSM services — never hit public mirrors from tests.
- Treat export schemas and scoring outputs as regression-locked; a deliberate change must update tests and the changelog together.
- Add a regression test with every bug fix in pure logic.

## Running

```sh
bunx vitest run
```
