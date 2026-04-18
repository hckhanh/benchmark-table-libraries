#!/usr/bin/env bun
/**
 * Drive the benchmark dashboard in headless Chrome, collect per-library
 * mount / first-paint / scroll FPS numbers at 1,000,000 rows, then rewrite
 * the README "Numbers" table between the bench markers.
 *
 * Usage: `bun run bench`
 * Requires Google Chrome installed; override path with CHROME_PATH env var.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import path from "node:path";
import puppeteer, { type Browser, type Page } from "puppeteer-core";

const PREVIEW_PORT = 4173;
const PREVIEW_URL = `http://localhost:${PREVIEW_PORT}/`;
const ROW_LABEL = "1M";
const MARKER_START = "<!-- bench:numbers:start -->";
const MARKER_END = "<!-- bench:numbers:end -->";
const README_PATH = path.resolve(__dirname, "..", "README.md");

type BenchRow = {
  label: string;
  mountMs: number;
  paintMs: number;
  rafFps: number;
  heapMB: number;
  note: string;
  gen?: number;
};

const LIBRARIES: Array<{ tabMatch: string; label: string; note: string }> = [
  {
    tabMatch: "TanStack",
    label: "TanStack Table + React Virtual",
    note: "Fully virtualized DOM, smallest wrapper",
  },
  {
    tabMatch: "AG Grid",
    label: "AG Grid Community",
    note: "Heavy scroll repaint — filters/menus are measured on mount",
  },
  {
    tabMatch: "MUI X",
    label: "MUI X DataGrid (Community)",
    note: "Paginated at 100 rows/page (MIT tier cap)",
  },
  {
    tabMatch: "React Data Grid",
    label: "React Data Grid (Adazzle)",
    note: "Excel-like grid, fully virtualized",
  },
  {
    tabMatch: "Glide",
    label: "Glide Data Grid",
    note: "Canvas renderer, hits display refresh cap",
  },
];

function resolveChrome(): string {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
  ];
  for (const p of candidates) if (existsSync(p)) return p;
  throw new Error(
    "Chrome not found. Install Google Chrome or set CHROME_PATH to a Chromium binary.",
  );
}

async function waitForServer(url: string, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url, { method: "GET" });
      if (r.ok) return;
    } catch {
      // not up yet
    }
    await sleep(200);
  }
  throw new Error(`Preview server did not start at ${url}`);
}

async function pickRowCount(page: Page, label: string) {
  await page.evaluate((l: string) => {
    const chip = [...document.querySelectorAll<HTMLButtonElement>(".chip")].find(
      (c) => c.textContent?.trim() === l,
    );
    if (chip && !chip.classList.contains("active")) chip.click();
  }, label);
  await sleep(250);
}

async function pickTab(page: Page, match: string) {
  await page.evaluate((n: string) => {
    const tab = [...document.querySelectorAll<HTMLButtonElement>(".tab")].find((t) =>
      t.textContent?.includes(n),
    );
    tab?.click();
  }, match);
  await sleep(700);
}

async function runOnce(page: Page): Promise<{ gen: number; mount: number; paint: number }> {
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll<HTMLButtonElement>("button")].find((b) =>
      /Run benchmark|Re-run/.test(b.textContent ?? ""),
    );
    btn?.click();
  });
  for (let i = 0; i < 100; i++) {
    await sleep(200);
    const mv = await page.$$eval(".metric-value", (nodes) => nodes.map((n) => n.textContent ?? ""));
    if (mv.length >= 3) {
      const p = (s: string) => Number.parseFloat(s.replace(/[^\d.]/g, ""));
      return { gen: p(mv[0]!), mount: p(mv[1]!), paint: p(mv[2]!) };
    }
  }
  throw new Error("Timed out waiting for metrics to appear");
}

async function measureFps(
  page: Page,
  cdp: import("puppeteer-core").CDPSession,
): Promise<{ rafFps: number; compositorFps: number }> {
  const frames0 = await getCompositorFrames(cdp);
  const t0 = Date.now();
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll<HTMLButtonElement>("button")].find((b) =>
      /Measure scroll FPS/.test(b.textContent ?? ""),
    );
    if (btn && !btn.disabled) btn.click();
  });
  await sleep(3400);
  const frames1 = await getCompositorFrames(cdp);
  const elapsedSec = (Date.now() - t0) / 1000;
  const compositorFps = elapsedSec > 0 ? Math.round((frames1 - frames0) / elapsedSec) : 0;
  const mv = await page.$$eval(".metric-value", (nodes) => nodes.map((n) => n.textContent ?? ""));
  const fps = mv.find((x) => /^\d+$/.test(x.trim()));
  return { rafFps: fps ? Number.parseInt(fps, 10) : 0, compositorFps };
}

async function getCompositorFrames(cdp: import("puppeteer-core").CDPSession): Promise<number> {
  const { metrics } = await cdp.send("Performance.getMetrics");
  const frames = metrics.find((m: { name: string; value: number }) => m.name === "Frames");
  return frames?.value ?? 0;
}

async function readHeapMB(page: Page): Promise<number> {
  const bytes = await page.evaluate(
    // @ts-expect-error — non-standard Chrome-only API
    () => (performance.memory?.usedJSHeapSize as number | undefined) ?? 0,
  );
  return Math.round(bytes / 1_048_576);
}

function fmt(n: number): string {
  return `${Math.round(n)} ms`;
}

const MEDALS = ["🥇", "🥈", "🥉"] as const;
const ORDINALS = ["4th", "5th", "6th", "7th", "8th", "9th"];

function positionBadge(rank: number): string {
  return MEDALS[rank - 1] ?? ORDINALS[rank - 4] ?? `${rank}th`;
}

function rankRows(rows: BenchRow[]): Map<string, number> {
  // Per-metric rank (1 = best). Lower-is-better for ms + heap; higher for fps.
  const perMetricRank = (key: keyof BenchRow, higherBetter: boolean) => {
    const sorted = [...rows].sort((a, b) => {
      const av = Number(a[key] ?? 0);
      const bv = Number(b[key] ?? 0);
      return higherBetter ? bv - av : av - bv;
    });
    const ranks = new Map<string, number>();
    sorted.forEach((r, i) => ranks.set(r.label, i + 1));
    return ranks;
  };
  const byMount = perMetricRank("mountMs", false);
  const byPaint = perMetricRank("paintMs", false);
  const byFps = perMetricRank("rafFps", true);
  const byHeap = perMetricRank("heapMB", false);
  const combined = rows
    .map((r) => ({
      label: r.label,
      score:
        (byMount.get(r.label) ?? 0) +
        (byPaint.get(r.label) ?? 0) +
        (byFps.get(r.label) ?? 0) +
        (byHeap.get(r.label) ?? 0),
    }))
    .sort((a, b) => a.score - b.score);
  const finalRanks = new Map<string, number>();
  combined.forEach((entry, i) => finalRanks.set(entry.label, i + 1));
  return finalRanks;
}

function renderTable(rows: BenchRow[]): string {
  const ranks = rankRows(rows);
  const sorted = [...rows].sort((a, b) => (ranks.get(a.label) ?? 0) - (ranks.get(b.label) ?? 0));
  const header = "| Rank | Library | Mount | First paint | rAF FPS | JS heap | Notes |";
  const align = "| :---: | --- | ---: | ---: | ---: | ---: | --- |";
  const body = sorted
    .map((r) => {
      const rank = ranks.get(r.label) ?? 0;
      return `| ${positionBadge(rank)} | ${r.label} | ${fmt(r.mountMs)} | ${fmt(r.paintMs)} | ${r.rafFps} | ${r.heapMB} MB | ${r.note} |`;
    })
    .join("\n");
  return [header, align, body].join("\n");
}

function winnerLine(rows: BenchRow[]): string {
  const ranks = rankRows(rows);
  const winner = [...rows].sort((a, b) => (ranks.get(a.label) ?? 0) - (ranks.get(b.label) ?? 0))[0];
  return winner ? `🏆 **Winner:** ${winner.label}` : "";
}

function updateReadme(rows: BenchRow[], datasetGenMs: number) {
  const original = readFileSync(README_PATH, "utf8");
  const startIdx = original.indexOf(MARKER_START);
  const endIdx = original.indexOf(MARKER_END);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error(
      `README markers missing. Add ${MARKER_START} / ${MARKER_END} around the numbers table.`,
    );
  }
  const before = original.slice(0, startIdx + MARKER_START.length);
  const after = original.slice(endIdx);
  const generatedAt = new Date().toISOString().slice(0, 10);
  const block = [
    "",
    "",
    `_Last refreshed: ${generatedAt} (via \`bun run bench\`)._`,
    "",
    winnerLine(rows),
    "",
    renderTable(rows),
    "",
    `Rank is the sum of per-metric positions across Mount, First paint, rAF FPS (higher = better) and JS heap; lower total wins.`,
    "",
    `Data generation (seeded \`mulberry32\`, 15 columns × 1M rows) takes ~**${Math.round(datasetGenMs)} ms** once and is then cached across runs, so it's not per-library.`,
    "",
    "",
  ].join("\n");
  const next = `${before}${block}${after}`;
  writeFileSync(README_PATH, next, "utf8");
}

async function main() {
  const chromePath = resolveChrome();
  console.log(`[bench] Chrome: ${chromePath}`);

  // Preview server
  const preview = spawn("bun", ["run", "preview"], {
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });
  preview.stdout?.on("data", () => {});
  preview.stderr?.on("data", (d) => process.stderr.write(d));

  let browser: Browser | null = null;
  try {
    console.log(`[bench] Waiting for preview at ${PREVIEW_URL}`);
    await waitForServer(PREVIEW_URL);

    console.log("[bench] Launching headless Chrome (rAF + vsync unlocked)");
    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: true,
      args: [
        "--no-sandbox",
        // Remove display / compositor frame-rate cap so rAF measures raw work.
        "--disable-frame-rate-limit",
        "--disable-gpu-vsync",
        "--disable-features=PaintHolding",
        // Return un-bucketed performance.memory.usedJSHeapSize.
        "--enable-precise-memory-info",
      ],
      defaultViewport: { width: 1920, height: 1080 },
    });
    const rows: BenchRow[] = [];
    let datasetGenMs = 0;
    for (const lib of LIBRARIES) {
      process.stdout.write(`[bench] ${lib.label}: mount+paint… `);
      // Fresh tab per library → heap numbers are isolated, not cumulative.
      const page = await browser.newPage();
      const cdp = await page.createCDPSession();
      await cdp.send("Performance.enable");
      try {
        await page.goto(PREVIEW_URL, { waitUntil: "load" });
        await pickRowCount(page, ROW_LABEL);
        await pickTab(page, lib.tabMatch);
        const cold = await runOnce(page);
        if (!datasetGenMs && cold.gen > 100) datasetGenMs = cold.gen;
        // Warm second run for FPS
        await sleep(200);
        await runOnce(page);
        const { rafFps, compositorFps } = await measureFps(page, cdp);
        const heapMB = await readHeapMB(page);
        rows.push({
          label: lib.label,
          mountMs: cold.mount,
          paintMs: cold.paint,
          rafFps,
          heapMB,
          note: lib.note,
          gen: cold.gen,
        });
        console.log(
          `mount=${cold.mount}ms paint=${cold.paint}ms rafFps=${rafFps} heap=${heapMB}MB compositorFps=${compositorFps}`,
        );
      } finally {
        await page.close().catch(() => {});
      }
    }

    console.log("[bench] Updating README");
    updateReadme(rows, datasetGenMs);
    console.log(`[bench] Done. Wrote ${rows.length} rows to README.md`);
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (preview.exitCode === null) preview.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error("[bench] Failed:", err);
  process.exit(1);
});
