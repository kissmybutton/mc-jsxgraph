/**
 * preview.js — capture a contact-sheet of the running demo for AI review.
 *
 * Usage:  npm run preview
 *
 * Requires the webpack dev server to already be running (`npm start`).
 * Opens the demo in headless Chromium, seeks to evenly-spaced timestamps,
 * captures the JSXGraph canvas at each point, and composites them into a
 * single contact-sheet PNG saved to preview/contact-sheet.png.
 *
 * The number of columns/rows and the sampling interval can be tuned below.
 */

import { chromium } from "playwright";
import { createCanvas, loadImage } from "canvas";
import fs from "fs";
import path from "path";

// ── Config ────────────────────────────────────────────────────────────────────

const DEMO_URL = "http://localhost:8090";
const OUT_DIR = "preview";
const OUT_FILE = path.join(OUT_DIR, "contact-sheet.png");
const FRAMES_DIR = path.join(OUT_DIR, "frames");

// How many evenly-spaced snapshots to take (not counting t=0)
const NUM_FRAMES = 20;
// Extra samples at visually important moments (ms)
const KEY_TIMES = [
  300, 900, 1500, 5500, 7700, 8500, 12000, 14400, 15000, 18000,
];

// Contact-sheet layout
const COLS = 5;
const THUMB_W = 320;
const THUMB_H = 320;
const LABEL_H = 22;

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildTimestamps(duration) {
  const step = Math.floor(duration / NUM_FRAMES);
  const even = Array.from({ length: NUM_FRAMES + 1 }, (_, i) => i * step);
  const merged = [...new Set([...even, ...KEY_TIMES])].sort((a, b) => a - b);
  return merged.filter((t) => t <= duration);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  fs.mkdirSync(FRAMES_DIR, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Match the demo's square layout calculation (viewport width / 2 - padding)
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(DEMO_URL, { waitUntil: "networkidle" });

  // Wait until the clip and seek helper are ready
  await page.waitForFunction(() => window.__clip && window.__seekTo, {
    timeout: 15000,
  });

  const duration = await page.evaluate(() => window.__clip.duration);
  console.info(`Clip duration: ${duration}ms`);

  const timestamps = buildTimestamps(duration);
  console.info(`Capturing ${timestamps.length} frames…`);

  const framePaths = [];

  for (const ms of timestamps) {
    await page.evaluate((t) => window.__seekTo(t), ms);
    // Give JSXGraph one rAF to repaint
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
    await sleep(80);

    // Screenshot the left panel (JSXGraph board area)
    const framePath = path.join(
      FRAMES_DIR,
      `frame_${String(ms).padStart(6, "0")}.png`,
    );
    const clipEl = await page.$("#left-panel");
    await clipEl.screenshot({ path: framePath });
    framePaths.push({ path: framePath, ms });
    process.stdout.write(`  ${ms}ms ✓\n`);
  }

  await browser.close();

  // ── Composite contact sheet ─────────────────────────────────────────────────
  console.info("Building contact sheet…");

  const ROWS = Math.ceil(framePaths.length / COLS);
  const SHEET_W = COLS * THUMB_W;
  const SHEET_H = ROWS * (THUMB_H + LABEL_H);

  const sheet = createCanvas(SHEET_W, SHEET_H);
  const ctx = sheet.getContext("2d");

  ctx.fillStyle = "#0d1117";
  ctx.fillRect(0, 0, SHEET_W, SHEET_H);

  for (let i = 0; i < framePaths.length; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = col * THUMB_W;
    const y = row * (THUMB_H + LABEL_H);
    const { path: fp, ms } = framePaths[i];

    const img = await loadImage(fp);
    ctx.drawImage(img, x, y, THUMB_W, THUMB_H);

    // Timestamp label
    ctx.fillStyle = "#374151";
    ctx.fillRect(x, y + THUMB_H, THUMB_W, LABEL_H);
    ctx.fillStyle = "#9ca3af";
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.fillText(
      `${ms}ms  (${(ms / 1000).toFixed(2)}s)`,
      x + THUMB_W / 2,
      y + THUMB_H + 15,
    );
  }

  const out = fs.createWriteStream(OUT_FILE);
  sheet.createPNGStream().pipe(out);
  await new Promise((r, j) => {
    out.on("finish", r);
    out.on("error", j);
  });

  console.info(`\nContact sheet saved → ${OUT_FILE}`);
  console.info(`Individual frames   → ${FRAMES_DIR}/`);
})();
