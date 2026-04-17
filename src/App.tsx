import { lazy, Suspense, useCallback, useMemo, useRef, useState } from "react";
import type { DataEditorRef } from "@glideapps/glide-data-grid";
import BenchmarkHarness, { type ScrollFpsFn } from "./benchmark/BenchmarkHarness";
import { getRows, type Row } from "./benchmark/data";
import "./App.css";

const TanStackTableBench = lazy(() => import("./libraries/TanStackTableBench"));
const AGGridBench = lazy(() => import("./libraries/AGGridBench"));
const MUIDataGridBench = lazy(() => import("./libraries/MUIDataGridBench"));
const ReactDataGridBench = lazy(() => import("./libraries/ReactDataGridBench"));
const GlideDataGridBench = lazy(() => import("./libraries/GlideDataGridBench"));

type LibKey = "tanstack" | "aggrid" | "mui" | "rdg" | "glide";

type LibCtx = {
  glideRef: React.RefObject<DataEditorRef | null>;
};

type Lib = {
  key: LibKey;
  name: string;
  version: string;
  notes: string;
  scrollSelector?: string;
  render: (data: Row[], ctx: LibCtx) => React.ReactNode;
  customScrollFps?: (ctx: LibCtx) => ScrollFpsFn | undefined;
};

const LIBRARIES: Lib[] = [
  {
    key: "tanstack",
    name: "TanStack Table + React Virtual",
    version: "@tanstack/react-table 8",
    notes: "Headless. Virtualization via @tanstack/react-virtual. Minimal DOM.",
    scrollSelector: "#tanstack-scroll",
    render: (data: Row[]) => <TanStackTableBench data={data} />,
  },
  {
    key: "aggrid",
    name: "AG Grid Community",
    version: "ag-grid-react 35",
    notes: "Enterprise-grade. Client-side row model. Row + column virtualization.",
    scrollSelector: ".ag-body-viewport",
    render: (data: Row[]) => <AGGridBench data={data} />,
  },
  {
    key: "mui",
    name: "MUI X DataGrid (Community)",
    version: "@mui/x-data-grid 9",
    notes:
      "Community (MIT) caps render at 100 rows/page — paginated. Pro/Premium tiers unlock infinite.",
    scrollSelector: ".MuiDataGrid-virtualScroller",
    render: (data: Row[]) => <MUIDataGridBench data={data} />,
  },
  {
    key: "rdg",
    name: "React Data Grid (Adazzle)",
    version: "react-data-grid 7",
    notes: "Purpose-built virtualized grid. Excel-like UX.",
    scrollSelector: ".rdg",
    render: (data: Row[]) => <ReactDataGridBench data={data} />,
  },
  {
    key: "glide",
    name: "Glide Data Grid",
    version: "@glideapps/glide-data-grid 6",
    notes: "Canvas-based. Designed for millions of rows. Uses DataEditorRef.scrollTo for FPS.",
    render: (data, ctx) => <GlideDataGridBench ref={ctx.glideRef} data={data} />,
    customScrollFps: (ctx) => async () => {
      const ref = ctx.glideRef.current;
      if (!ref) return 0;
      const duration = 3000;
      const start = performance.now();
      let frames = 0;
      let lastTs = start;
      return new Promise<number>((resolve) => {
        const tick = (ts: number) => {
          frames++;
          const elapsed = ts - start;
          const progress = Math.min(elapsed / duration, 1);
          const targetRow = Math.floor(progress * 999_999);
          ref.scrollTo(0, targetRow, "vertical");
          lastTs = ts;
          if (elapsed < duration) {
            requestAnimationFrame(tick);
          } else {
            resolve(Math.round((frames / (lastTs - start)) * 1000));
          }
        };
        requestAnimationFrame(tick);
      });
    },
  },
];

const ROW_PRESETS = [10_000, 100_000, 500_000, 1_000_000];

export default function App() {
  const [libKey, setLibKey] = useState<LibKey>("tanstack");
  const [rowCount, setRowCount] = useState(1_000_000);
  const [data, setData] = useState<Row[] | null>(null);
  const [runId, setRunId] = useState(0);
  const glideRef = useRef<DataEditorRef>(null);
  const ctx = useMemo<LibCtx>(() => ({ glideRef }), []);

  const lib = useMemo(() => LIBRARIES.find((l) => l.key === libKey)!, [libKey]);

  const handleGenerate = useCallback((count: number) => {
    setData(null);
    queueMicrotask(() => {
      const rows = getRows(count);
      setData(rows);
    });
  }, []);

  const switchLibrary = (k: LibKey) => {
    setLibKey(k);
    setData(null);
    setRunId((x) => x + 1);
  };

  const switchRowCount = (n: number) => {
    setRowCount(n);
    setData(null);
    setRunId((x) => x + 1);
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">≡</span>
          <div>
            <h1>React Table Libraries Benchmark</h1>
            <p className="subtitle">
              Compare render, scroll and memory across libraries — up to 1,000,000 rows
            </p>
          </div>
        </div>
        <div className="controls">
          <div className="control">
            <span>Rows</span>
            <div className="row-presets">
              {ROW_PRESETS.map((n) => (
                <button
                  key={n}
                  className={`chip ${rowCount === n ? "active" : ""}`}
                  onClick={() => switchRowCount(n)}
                >
                  {n >= 1_000_000 ? `${n / 1_000_000}M` : `${n / 1000}K`}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <nav className="tabs">
        {LIBRARIES.map((l) => (
          <button
            key={l.key}
            className={`tab ${libKey === l.key ? "active" : ""}`}
            onClick={() => switchLibrary(l.key)}
          >
            <span className="tab-name">{l.name}</span>
            <span className="tab-version">{l.version}</span>
          </button>
        ))}
      </nav>

      <section className="notes">
        <strong>{lib.name}</strong> — {lib.notes}
      </section>

      <main className="main">
        <BenchmarkHarness
          key={`${libKey}-${runId}`}
          library={lib.name}
          rowCount={rowCount}
          onGenerate={handleGenerate}
          dataReady={data !== null && data.length === rowCount}
          scrollContainerSelector={lib.scrollSelector}
          customScrollFps={lib.customScrollFps?.(ctx)}
        >
          <Suspense fallback={<div className="loading">Loading library…</div>}>
            {data && lib.render(data, ctx)}
          </Suspense>
        </BenchmarkHarness>
      </main>

      <footer className="footer">
        <span>
          Data is deterministic (seeded). JS heap shown when Chrome exposes{" "}
          <code>performance.memory</code>.
        </span>
      </footer>
    </div>
  );
}
