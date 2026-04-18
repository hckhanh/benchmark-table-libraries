# React Table Libraries Benchmark

Head-to-head benchmark of the most popular React table/grid libraries, stress-tested up to **1,000,000 rows** of data in the browser.

Built with **Vite + React 19 + TypeScript + Bun**. Linted and formatted with **oxlint + oxfmt**.

## Libraries compared

| Library                                                                                      | Version | Rendering strategy                                                    |
| -------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------- |
| [TanStack Table](https://tanstack.com/table) + [React Virtual](https://tanstack.com/virtual) | 8 / 3   | Headless, DOM-based row virtualization                                |
| [AG Grid Community](https://www.ag-grid.com/)                                                | 35      | Enterprise-grade, row + column virtualization                         |
| [MUI X DataGrid](https://mui.com/x/react-data-grid/) (Community)                             | 9       | Built-in row virtualization (100 rows/page cap in MIT tier)           |
| [React Data Grid](https://github.com/adazzle/react-data-grid) (Adazzle)                      | 7       | Excel-like, purpose-built virtualization                              |
| [Glide Data Grid](https://grid.glideapps.com/)                                               | 6       | Canvas-based, designed for millions of rows (themed to match the app) |

> **Material React Table was removed** — its dev/preview bundle hangs the whole page while trying to mount a 1M-row dataset (cell rendering is fully React, no virtualization shortcuts). If you want MRT in the comparison, cap `rowCount` to 50K.

## Metrics captured

For every run the harness records:

- **Data gen** — ms to generate the dataset (seeded `mulberry32` PRNG, 15 columns)
- **Mount** — ms from React mount to the first `requestAnimationFrame`
- **First paint** — ms from mount to the second rAF (paint committed)
- **Scroll FPS** — average frames/sec while scrolling the full table over 3s
- **JS heap** — used heap in MB (Chrome only, via `performance.memory`)

## Quick start

Requires [Bun](https://bun.sh/) ≥ 1.0.

```bash
bun install
bun run dev          # React Compiler OFF (default — baseline benchmark)
bun run dev:rc       # React Compiler ON
```

Open [http://localhost:5173](http://localhost:5173).

1. Pick a library tab.
2. Pick a row count (10K / 100K / 500K / **1M**).
3. Click **Run benchmark** — metrics show in the bar above the grid.
4. After the grid renders, click **Measure scroll FPS**.

Switching library or row count always resets state so each mount is measured cold.

### Production build

```bash
bun run build        # RC off
bun run build:rc     # RC on
bun run preview
```

### React Compiler (opt-in)

The [React Compiler](https://react.dev/learn/react-compiler) (GA `babel-plugin-react-compiler@1.0.0`) is wired behind a
`VITE_RC=1` env gate so you can A/B it against the vanilla React 19 runtime.

- Default `dev` / `build` → **compiler OFF** (baseline)
- `dev:rc` / `build:rc` → **compiler ON** (auto-memoization)

Most wrappers here are thin passthroughs to pre-compiled library code, so the
compiler's effective memoization surface is small. It compiles successfully on
5/7 source files; safe, correct bailouts on two:

- `App.tsx` — shell reads `ref.current` in a scroll callback closure
- `TanStackTableBench.tsx` — `useReactTable` returns methods compiler refuses to
  memoize (known TanStack Table incompatibility)

### Quality checks

```bash
bun run format        # oxfmt write
bun run format:check  # oxfmt check-only
bun run lint          # oxlint
bun run check         # format:check + lint + tsc --noEmit
```

## Repo layout

```
src/
├── App.tsx                       # dashboard shell + tabs + row presets
├── App.css                       # dark-theme UI
├── benchmark/
│   ├── data.ts                   # seeded 1M-row generator (mulberry32)
│   ├── columns.ts                # shared 15-column spec
│   └── BenchmarkHarness.tsx      # timing / FPS / heap harness
└── libraries/
    ├── TanStackTableBench.tsx
    ├── AGGridBench.tsx
    ├── MUIDataGridBench.tsx
    ├── ReactDataGridBench.tsx
    └── GlideDataGridBench.tsx
```

Each library component is lazy-loaded (`React.lazy`) so switching tabs only ships that library's bundle.

## Sample results

**1,000,000 rows**, production build (`bun run build && bun run preview`), React Compiler OFF.
Each library was mounted twice in sequence; the first run measures cold mount + first paint, the second warm run measures scroll FPS once the grid is fully painted.

### Benchmark host

|         |                                                     |
| ------- | --------------------------------------------------- |
| Machine | Mac mini 2023 (Mac14,12)                            |
| SoC     | Apple M2 Pro                                        |
| CPU     | 10 cores — 6 performance + 4 efficiency             |
| GPU     | 16-core Apple M2 Pro (Metal 4)                      |
| Memory  | 32 GB unified LPDDR5                                |
| Storage | APFS on internal SSD                                |
| OS      | macOS 26.4.1 (build 25E253)                         |
| Browser | Chrome 147 (Chromium) — JS heap via Performance API |
| Runtime | Bun 1.3.12 · Vite 8 · React 19.2 · TypeScript 6     |
| Display | 2764 × 1430 viewport @ DPR 2, 120 Hz refresh        |

### Numbers (1M rows, production build, RC off)

Production build with per-library vendor splitting and modern-only output
(`target: esnext`, `modulePreload.polyfill: false`). Cold library mount +
first paint captured on the first click of **Run benchmark**. Scroll FPS is
the warm-run measurement after the grid is fully painted.

| Library                        | Mount | First paint | Scroll FPS | Notes                                                      |
| ------------------------------ | ----: | ----------: | ---------: | ---------------------------------------------------------- |
| TanStack Table + React Virtual |  0 ms |        8 ms |         69 | Fully virtualized DOM, smallest wrapper                    |
| AG Grid Community              |  8 ms |       16 ms |         17 | Heavy scroll repaint — filters/menus are measured on mount |
| MUI X DataGrid (Community)     | 11 ms |       19 ms |        120 | Paginated at 100 rows/page (MIT tier cap)                  |
| React Data Grid (Adazzle)      |  6 ms |       15 ms |         95 | Excel-like grid, fully virtualized                         |
| Glide Data Grid                | 12 ms |       17 ms |        117 | Canvas renderer, hits display refresh cap                  |

Data generation (seeded `mulberry32`, 15 columns × 1M rows) takes ~**440 ms** once and is then cached across runs, so it's not per-library.

FPS is capped by the display refresh rate (120 Hz on the test machine), so the 120-FPS ceiling for MUI X and Glide means _"never dropped a frame."_ AG Grid's 18 FPS tells you every scroll tick costs a real DOM pass.

JS heap is omitted from the table — in this benchmark it reports the _cumulative_ Chrome tab size, not the per-library cost (switching libraries reuses the cached dataset and the previous library's chunks stay loaded). To inspect it, open DevTools → Performance Monitor and switch libraries cold.

Run it yourself for numbers on your hardware — results move between dev / preview / prod builds, first vs. warm cache, and CPU throttling. The harness clamps each library to the same 15-column dataset and the same mount/first-paint/scroll protocol so you can compare apples-to-apples.

## Notes

- **Strict Mode off** in `main.tsx` — double-rendering would skew first-mount timings.
- Dataset is cached across runs of the same row count, so a **Re-run** measures library mount only. Switch row count to re-generate.
- `performance.memory` is a Chromium-only API. In Firefox/Safari the heap metric is hidden.
- **MUI X DataGrid Community** caps row virtualization at 100 rows per the MIT license, so the 1M dataset is rendered via pagination (100 rows/page). Pro/Premium tiers unlock infinite virtualization.
- **Glide Data Grid** uses `DataEditorRef.scrollTo` for the FPS measurement because it paints to a canvas, not a scroll container.
- The `active` boolean column is rendered as a real checkbox in TanStack Table (and natively in MUI DataGrid and Glide) — plain text elsewhere.
- All columns are plain text/numbers/booleans. Libraries with heavy cell renderers (editable cells, grouping) will look different under that load.
- Sort, filter, group and edit features were intentionally kept off to isolate raw render and scroll cost.
- Dependency updates are automated via [Renovate](https://docs.renovatebot.com/) — see [`renovate.json`](renovate.json).

## Tech stack

- [Vite 8](https://vite.dev) · [React 19](https://react.dev) · [TypeScript 6](https://www.typescriptlang.org/)
- [Bun](https://bun.sh) for install and scripts
- [React Compiler](https://react.dev/learn/react-compiler) 1.0 (opt-in via `VITE_RC=1`) wired through [`vite-plugin-babel`](https://github.com/owlsdepartment/vite-plugin-babel)
- [oxlint](https://oxc.rs/docs/guide/usage/linter) / [oxfmt](https://oxc.rs/docs/guide/usage/formatter) for Rust-speed lint/format
- [Renovate](https://docs.renovatebot.com/) for weekly dependency PRs, grouped by stack

## License

MIT
