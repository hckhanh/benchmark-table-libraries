import { useEffect, useRef, useState, type PropsWithChildren } from "react";

export type BenchResult = {
  datasetGenMs: number;
  mountMs: number;
  firstPaintMs: number;
  scrollFps?: number;
  memoryMB?: number;
};

export type ScrollFpsFn = (onFrame: () => void) => Promise<number>;

type Props = PropsWithChildren<{
  library: string;
  rowCount: number;
  onGenerate: (count: number) => void;
  dataReady: boolean;
  scrollContainerSelector?: string;
  customScrollFps?: ScrollFpsFn;
}>;

declare global {
  interface Performance {
    memory?: { usedJSHeapSize: number };
  }
}

export default function BenchmarkHarness({
  library,
  rowCount,
  onGenerate,
  dataReady,
  scrollContainerSelector,
  customScrollFps,
  children,
}: Props) {
  const [result, setResult] = useState<BenchResult | null>(null);
  const [phase, setPhase] = useState<"idle" | "generating" | "mounting" | "ready">("idle");
  const genStartRef = useRef(0);
  const mountStartRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const runBenchmark = () => {
    setResult(null);
    setPhase("generating");
    genStartRef.current = performance.now();
    queueMicrotask(() => {
      onGenerate(rowCount);
    });
  };

  useEffect(() => {
    if (phase === "generating" && dataReady) {
      const datasetGenMs = performance.now() - genStartRef.current;
      mountStartRef.current = performance.now();
      setPhase("mounting");
      requestAnimationFrame(() => {
        const mountMs = performance.now() - mountStartRef.current;
        requestAnimationFrame(() => {
          const firstPaintMs = performance.now() - mountStartRef.current;
          const memoryMB = performance.memory
            ? Math.round(performance.memory.usedJSHeapSize / 1048576)
            : undefined;
          setResult({ datasetGenMs, mountMs, firstPaintMs, memoryMB });
          setPhase("ready");
        });
      });
    }
  }, [phase, dataReady]);

  const measureScrollFps = async () => {
    if (customScrollFps) {
      const fps = await customScrollFps(() => {});
      setResult((r) => (r ? { ...r, scrollFps: fps } : r));
      return;
    }
    const container = scrollContainerSelector
      ? (document.querySelector(scrollContainerSelector) as HTMLElement | null)
      : null;
    if (!container) {
      setResult((r) => (r ? { ...r, scrollFps: 0 } : r));
      console.warn("[benchmark] scroll container not found for", scrollContainerSelector);
      return;
    }
    container.scrollTop = 0;
    await new Promise((r) => setTimeout(r, 100));

    const duration = 3000;
    const start = performance.now();
    let frames = 0;
    let lastTs = start;
    const maxScroll = container.scrollHeight - container.clientHeight;

    return new Promise<void>((resolve) => {
      const tick = (ts: number) => {
        frames++;
        const elapsed = ts - start;
        const progress = Math.min(elapsed / duration, 1);
        container.scrollTop = progress * maxScroll;
        lastTs = ts;
        if (elapsed < duration) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          const fps = Math.round((frames / (lastTs - start)) * 1000);
          setResult((r) => (r ? { ...r, scrollFps: fps } : r));
          resolve();
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    });
  };

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  return (
    <div className="harness">
      <div className="harness-bar">
        <div className="harness-title">
          <h2>{library}</h2>
          <span className="pill">Rows: {rowCount.toLocaleString()}</span>
        </div>
        <div className="harness-actions">
          <button className="btn primary" onClick={runBenchmark}>
            {phase === "idle" ? "Run benchmark" : "Re-run"}
          </button>
          <button
            className="btn"
            onClick={measureScrollFps}
            disabled={phase !== "ready"}
            title="Animates scroll over 3s and reports fps"
          >
            Measure scroll FPS
          </button>
        </div>
        <div className="harness-metrics">
          {result ? (
            <>
              <Metric label="Data gen" value={`${result.datasetGenMs.toFixed(0)} ms`} />
              <Metric label="Mount" value={`${result.mountMs.toFixed(0)} ms`} />
              <Metric label="First paint" value={`${result.firstPaintMs.toFixed(0)} ms`} />
              {result.scrollFps != null && (
                <Metric label="Scroll FPS" value={`${result.scrollFps}`} />
              )}
              {result.memoryMB != null && (
                <Metric label="JS heap" value={`${result.memoryMB} MB`} />
              )}
            </>
          ) : phase === "generating" ? (
            <span className="status">Generating {rowCount.toLocaleString()} rows…</span>
          ) : phase === "mounting" ? (
            <span className="status">Mounting…</span>
          ) : (
            <span className="status muted">Idle — click Run benchmark</span>
          )}
        </div>
      </div>
      <div className="harness-body">{phase !== "idle" ? children : null}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}</span>
    </div>
  );
}
