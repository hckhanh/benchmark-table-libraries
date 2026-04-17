# React Table Libraries Benchmark

Head-to-head benchmark of the most popular React table/grid libraries, stress-tested up to **1,000,000 rows** of data in the browser.

Built with **Vite + React 19 + TypeScript + Bun**. Linted and formatted with **oxlint + oxfmt**.

## Libraries compared

| Library                                                                                      | Version | Rendering strategy                                                    |
| -------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------- |
| [TanStack Table](https://tanstack.com/table) + [React Virtual](https://tanstack.com/virtual) | 8 / 3   | Headless, DOM-based row virtualization                                |
| [AG Grid Community](https://www.ag-grid.com/)                                                | 35      | Enterprise-grade, row + column virtualization                         |
| [MUI X DataGrid](https://mui.com/x/react-data-grid/) (Community)                             | 9       | Built-in row virtualization                                           |
| [Material React Table](https://www.material-react-table.com/)                                | 3       | TanStack Table + MUI, row + column virtualization                     |
| [React Data Grid](https://github.com/adazzle/react-data-grid) (Adazzle)                      | 7       | Excel-like, purpose-built virtualization                              |
| [Glide Data Grid](https://grid.glideapps.com/)                                               | 6       | Canvas-based, designed for millions of rows (themed to match the app) |

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
6/8 source files; safe, correct bailouts on two:

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
    ├── MaterialReactTableBench.tsx
    ├── ReactDataGridBench.tsx
    └── GlideDataGridBench.tsx
```

Each library component is lazy-loaded (`React.lazy`) so switching tabs only ships that library's bundle.

## Sample results

Numbers vary by machine — these are from an Apple Silicon laptop, Chrome, dev build, **1,000,000 rows** cold mount.

| Library                        | Data gen | Mount | First paint |    JS heap |
| ------------------------------ | -------: | ----: | ----------: | ---------: |
| TanStack Table + React Virtual |  ~420 ms |  6 ms |       14 ms |     234 MB |
| AG Grid Community              |  ~420 ms |  8 ms |       22 ms |     850 MB |
| MUI X DataGrid                 |  ~420 ms | 12 ms |       30 ms |     680 MB |
| Material React Table           |  ~420 ms | 15 ms |       38 ms |     720 MB |
| React Data Grid                |  ~420 ms |  7 ms |       18 ms |     410 MB |
| Glide Data Grid                |  ~420 ms |  5 ms |       13 ms | **~60 MB** |

Data-gen time is identical across libraries (same generator). Glide's canvas renderer dominates on memory. TanStack Table + React Virtual is the lightest DOM-based option.

Run it yourself for numbers on your hardware — results move significantly between dev / preview / prod builds and CPU throttling settings.

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
