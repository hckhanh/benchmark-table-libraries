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
  fps: number;
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

async function measureFps(page: Page): Promise<number> {
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll<HTMLButtonElement>("button")].find((b) =>
      /Measure scroll FPS/.test(b.textContent ?? ""),
    );
    if (btn && !btn.disabled) btn.click();
  });
  await sleep(3400);
  const mv = await page.$$eval(".metric-value", (nodes) => nodes.map((n) => n.textContent ?? ""));
  const fps = mv.find((x) => /^\d+$/.test(x.trim()));
  return fps ? Number.parseInt(fps, 10) : 0;
}

function fmt(n: number): string {
  return `${Math.round(n)} ms`;
}

function renderTable(rows: BenchRow[]): string {
  const header = "| Library | Mount | First paint | Scroll FPS | Notes |";
  const align = "| --- | ---: | ---: | ---: | --- |";
  const body = rows
    .map((r) => `| ${r.label} | ${fmt(r.mountMs)} | ${fmt(r.paintMs)} | ${r.fps} | ${r.note} |`)
    .join("\n");
  return [header, align, body].join("\n");
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
    renderTable(rows),
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

    console.log("[bench] Launching headless Chrome");
    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: true,
      args: ["--no-sandbox"],
      defaultViewport: { width: 1920, height: 1080 },
    });
    const page = await browser.newPage();
    await page.goto(PREVIEW_URL, { waitUntil: "load" });

    await pickRowCount(page, ROW_LABEL);

    const rows: BenchRow[] = [];
    let datasetGenMs = 0;
    for (const lib of LIBRARIES) {
      process.stdout.write(`[bench] ${lib.label}: mount+paint… `);
      await pickTab(page, lib.tabMatch);
      const cold = await runOnce(page);
      if (!datasetGenMs && cold.gen > 100) datasetGenMs = cold.gen;
      // Warm second run for FPS
      await sleep(200);
      await runOnce(page);
      const fps = await measureFps(page);
      rows.push({
        label: lib.label,
        mountMs: cold.mount,
        paintMs: cold.paint,
        fps,
        note: lib.note,
        gen: cold.gen,
      });
      console.log(`mount=${cold.mount}ms paint=${cold.paint}ms fps=${fps}`);
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
