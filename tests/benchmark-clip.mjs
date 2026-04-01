/**
 * Benchmark clip — exercises every mc-jsxgraph incident type, the dynamic
 * add/hide flow, and verifies shapes don't appear before their scheduled time.
 *
 * Usage: node tests/benchmark-clip.mjs [--headless] [--screenshot out.png]
 *
 * Timeline:
 *   0–600      Attr: fade polygon fillOpacity 0→0.3
 *   700        Attr: show title text (strokeOpacity 0→1)
 *   800        Attr: show arcs (strokeOpacity 0→1, fillOpacity 0→0.35)
 *   900–1700   DrawOn: draw median segment
 *   1800       Attr: hide median
 *   2000–2700  Blink: 2× color flash on polygon via Attr sequence
 *   3000–5000  Morph: reshape triangle
 *   5200–7200  Rotate: rotate polygon 45°
 *   7400–9400  Translate: move polygon (2, 1)
 *   9600–11600 Transform: composite translate+rotate back
 *   11800      Dynamic addShape: point at (11,2) with opacity 0
 *   11810      Attr: reveal dynamic point
 *   12500      Attr: hide dynamic point
 *   12700–13500 Attr: recolor polygon stroke to orange
 */

import { chromium } from "playwright";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const headless = args.includes("--headless");
const ssIdx = args.indexOf("--screenshot");
const ssPath = ssIdx >= 0 ? args[ssIdx + 1] : path.join(__dirname, "_benchmark-result.png");

// ── HTML template ───────────────────────────────────────────────────────────

const HTML = `<!DOCTYPE html>
<html><head>
<link rel="stylesheet" href="/node_modules/jsxgraph/distrib/jsxgraph.css">
<script type="importmap">
{
  "imports": {
    "@donkeyclip/motorcortex": "/node_modules/@donkeyclip/motorcortex/dist/motorcortex.esm.min.js",
    "jsxgraph": "/node_modules/jsxgraph/src/index.js"
  }
}
</script>
<style>
  body { margin: 0; background: #f8f9fa; }
  #clip { width: 100vw; height: 100vh; }
  #info { position: fixed; top: 8px; left: 8px; font: 12px monospace; color: #666; z-index: 100; }
</style>
</head>
<body>
<div id="clip"></div>
<div id="info">Loading...</div>
<script type="module">
import { loadPlugin } from "@donkeyclip/motorcortex";
import McGeomDef from "/dist/bundle.esm.js";

const McGeom = loadPlugin(McGeomDef);
const info = document.getElementById("info");

try {
  // ── Create clip ────────────────────────────────────────────────────────
  const clip = new McGeom.Clip(
    {
      board: {
        boundingbox: [-2, 10, 14, -2],
        axis: false, showCopyright: false, showNavigation: false,
      },
      shapes: [
        { type: "point", id: "pA", args: [2, 0], attributes: { visible: false } },
        { type: "point", id: "pB", args: [8, 0], attributes: { visible: false } },
        { type: "point", id: "pC", args: [5, 5], attributes: { visible: false } },

        // Polygon — starts fully transparent
        {
          type: "polygon", id: "tri", args: ["pA", "pB", "pC"],
          attributes: {
            fillColor: "#3498db", fillOpacity: 0, strokeOpacity: 0,
            withLabel: false,
            vertices: { visible: false },
            borders: { strokeColor: "#2980b9", strokeWidth: 3, strokeOpacity: 0 },
          },
        },

        // Arc — starts invisible
        {
          type: "angle", id: "arcA", vertex: "pA", from: "pB", to: "pC",
          attributes: {
            radius: 0.65, fillColor: "#e74c3c", fillOpacity: 0,
            strokeColor: "#c0392b", strokeOpacity: 0, strokeWidth: 2, withLabel: false,
          },
        },

        // Median segment — invisible
        {
          type: "segment", id: "median", args: [[5, 0], [5, 5]],
          attributes: { strokeColor: "#5dade2", strokeWidth: 1.5, dash: 2, strokeOpacity: 0, withLabel: false },
        },

        // Title text — invisible
        {
          type: "text", id: "title", args: [0.5, 9, "Benchmark"],
          attributes: { fontSize: 20, strokeColor: "#2c3e50", useHTML: false, strokeOpacity: 0 },
        },

        // Static circle (always visible)
        { type: "point", id: "cCenter", args: [11, 5], attributes: { visible: false } },
        {
          type: "circle", id: "circ", args: ["cCenter", 1.5],
          attributes: { strokeColor: "#8e44ad", fillColor: "#9b59b6", fillOpacity: 0.2, strokeWidth: 2, withLabel: false },
        },
      ],
    },
    {
      host: document.getElementById("clip"),
      containerParams: { width: "100%", height: "100%" },
    },
  );

  // ── Attr: fade polygon in ──────────────────────────────────────────────
  // Show polygon borders first
  clip.addIncident(
    new McGeom.Attr(
      { animatedAttrs: { strokeOpacity: 1 } },
      { selector: "!#tri", duration: 1 },
    ), 0);
  // Then animate fill
  clip.addIncident(
    new McGeom.Attr(
      { animatedAttrs: { fillOpacity: 0.3 } },
      { selector: "!#tri", duration: 600 },
    ), 10);

  // ── Attr: show title text ──────────────────────────────────────────────
  clip.addIncident(
    new McGeom.Attr(
      { animatedAttrs: { strokeOpacity: 1 } },
      { selector: "!#title", duration: 1 },
    ), 700);

  // ── Attr: show arc ─────────────────────────────────────────────────────
  clip.addIncident(
    new McGeom.Attr(
      { animatedAttrs: { strokeOpacity: 1, fillOpacity: 0.35 } },
      { selector: "!#arcA", duration: 1 },
    ), 800);

  // ── DrawOn: draw median ────────────────────────────────────────────────
  clip.addIncident(
    new McGeom.Attr(
      { animatedAttrs: { strokeOpacity: 1 } },
      { selector: "!#median", duration: 1 },
    ), 900);
  clip.addIncident(
    new McGeom.DrawOn(
      { animatedAttrs: { drawOn: 1 } },
      { selector: "!#median", duration: 800 },
    ), 900);

  // Hide median
  clip.addIncident(
    new McGeom.Attr(
      { animatedAttrs: { strokeOpacity: 0 } },
      { selector: "!#median", duration: 1 },
    ), 1800);

  // ── Blink: Attr-based color flash on polygon ──────────────────────────
  const blinkColor = "#e74c3c";
  const origColor = "#2980b9";
  // 2 blinks over 700ms
  clip.addIncident(new McGeom.Attr({ animatedAttrs: { strokeColor: blinkColor } }, { selector: "!#tri", duration: 1 }), 2000);
  clip.addIncident(new McGeom.Attr({ animatedAttrs: { strokeColor: origColor } }, { selector: "!#tri", duration: 1 }), 2175);
  clip.addIncident(new McGeom.Attr({ animatedAttrs: { strokeColor: blinkColor } }, { selector: "!#tri", duration: 1 }), 2350);
  clip.addIncident(new McGeom.Attr({ animatedAttrs: { strokeColor: origColor } }, { selector: "!#tri", duration: 1 }), 2525);

  // ── Morph ──────────────────────────────────────────────────────────────
  clip.addIncident(
    new McGeom.Morph(
      { animatedAttrs: { morph: [[2, 0], [8, 0], [2, 4]] } },
      { selector: "!#tri", duration: 2000 },
    ), 3000);

  // ── Rotate ─────────────────────────────────────────────────────────────
  clip.addIncident(
    new McGeom.Rotate(
      { animatedAttrs: { rotation: 45 } },
      { selector: "!#tri", duration: 2000 },
    ), 5200);

  // ── Translate ──────────────────────────────────────────────────────────
  clip.addIncident(
    new McGeom.Translate(
      { animatedAttrs: { translate: { x: 2, y: 1 } } },
      { selector: "!#tri", duration: 2000 },
    ), 7400);

  // ── Transform (composite) ─────────────────────────────────────────────
  clip.addIncident(
    new McGeom.Transform(
      { animatedAttrs: { transform: { translate: { x: -2, y: -1 }, rotation: -45 } } },
      { selector: "!#tri", duration: 2000 },
    ), 9600);

  // ── Dynamic addShape + 300ms Attr fade-in (mirrors clipController flow) ─
  const gc = globalThis.__activeGeomClip;
  if (gc) {
    // Step 1: create element on the board with opacity 0
    gc.addShape({
      type: "point", id: "dynPt", args: [11, 2], classes: ["shape"],
      attributes: { strokeColor: "#27ae60", fillColor: "#2ecc71", size: 5, strokeOpacity: 0, fillOpacity: 0 },
    });
    // Step 2: 300ms Attr to fade it in (same as clipController._doAddShape)
    const FADE_DUR = 300;
    const fadeStart = 11800;
    clip.addIncident(
      new McGeom.Attr(
        { animatedAttrs: { strokeOpacity: 1, fillOpacity: 1 } },
        { selector: "!#dynPt", duration: FADE_DUR },
      ), fadeStart);
    // Step 3: later, hide it
    clip.addIncident(
      new McGeom.Attr(
        { animatedAttrs: { strokeOpacity: 0, fillOpacity: 0 } },
        { selector: "!#dynPt", duration: 1 },
      ), 12500);
  }

  // ── Attr: recolor polygon stroke ───────────────────────────────────────
  clip.addIncident(
    new McGeom.Attr(
      { animatedAttrs: { strokeColor: "#e67e22" } },
      { selector: "!#tri", duration: 800 },
    ), 12700);

  info.textContent = "Clip ready. Duration: " + (clip.duration / 1000).toFixed(1) + "s";

  // ── Expose for Playwright ──────────────────────────────────────────────
  window.__clip = clip;
  window.__ready = true;

  // Deterministic seek via playableProgress (not TimeCapsule)
  window.__seekTo = (ms) => {
    const d = clip.duration || 1;
    const frac = Math.min(Math.max(ms / d, 0), 1);
    clip.playableProgress(frac, ms);
  };

  // Read visProp for an element
  window.__readVis = (id) => {
    const el = gc?._entityMap?.[id];
    if (!el) return null;
    return {
      strokeOpacity: el.visProp?.strokeopacity,
      fillOpacity: el.visProp?.fillopacity,
      strokeColor: el.visProp?.strokecolor,
    };
  };

} catch (e) {
  console.error("FATAL:", e);
  info.textContent = "FATAL: " + e.message;
  window.__ready = true;
  window.__fatalError = e.message;
}
</script>
</body></html>`;

// ── Static server ───────────────────────────────────────────────────────────

function startServer() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      if (req.url === "/") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(HTML);
        return;
      }
      const fp = path.join(ROOT, req.url);
      if (!fs.existsSync(fp)) { res.writeHead(404); res.end("Not found"); return; }
      const ext = path.extname(fp);
      const ct = { ".html": "text/html", ".js": "application/javascript", ".mjs": "application/javascript", ".css": "text/css", ".json": "application/json" }[ext] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": ct });
      fs.createReadStream(fp).pipe(res);
    });
    srv.listen(0, "127.0.0.1", () => resolve(srv));
  });
}

// ── Test runner ─────────────────────────────────────────────────────────────

(async () => {
  const srv = await startServer();
  const port = srv.address().port;
  console.log(`Benchmark server: http://127.0.0.1:${port}`);

  const browser = await chromium.launch({ headless });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });

  page.on("console", (msg) => {
    const text = msg.text();
    if (text.includes("FAIL") || text.includes("ERROR")) console.error(`  ${text}`);
  });
  page.on("pageerror", (err) => console.error(`  [PAGE ERROR] ${err.message}`));

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load" });
  try {
    await page.waitForFunction(() => window.__ready === true, { timeout: 15000 });
  } catch {
    console.error("Clip failed to load within timeout.");
  }

  const fatal = await page.evaluate(() => window.__fatalError);
  if (fatal) {
    console.error(`FATAL: ${fatal}`);
    await browser.close();
    srv.close();
    process.exit(1);
  }

  // ── Visibility timing tests ─────────────────────────────────────────────
  // Seek to specific ms, wait for render, then read visProp.

  let passed = 0;
  let failed = 0;

  async function seekAndRead(ms, id) {
    await page.evaluate((ms) => window.__seekTo(ms), ms);
    // Two rAF + short wait for MC to propagate attribute changes
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await new Promise(r => setTimeout(r, 100));
    return page.evaluate((id) => window.__readVis(id), id);
  }

  function check(label, actual, field, expected) {
    const val = actual?.[field];
    // Allow small float tolerance
    const ok = typeof expected === "number"
      ? Math.abs((val ?? -999) - expected) < 0.01
      : val === expected;
    if (ok) {
      passed++;
    } else {
      failed++;
      console.error(`  FAIL: ${label} — expected ${field}=${expected}, got ${val}`);
    }
  }

  console.log("\n=== VISIBILITY TIMING TESTS ===\n");

  // ── Before anything: t=-1 (start) — polygon should be transparent ──────
  let vis = await seekAndRead(0, "tri");
  check("t=0: tri strokeOpacity should be 0 (before show)", vis, "strokeOpacity", 0);
  check("t=0: tri fillOpacity should be 0", vis, "fillOpacity", 0);

  vis = await seekAndRead(0, "arcA");
  check("t=0: arcA strokeOpacity should be 0 (not yet shown)", vis, "strokeOpacity", 0);
  check("t=0: arcA fillOpacity should be 0", vis, "fillOpacity", 0);

  vis = await seekAndRead(0, "title");
  check("t=0: title strokeOpacity should be 0 (not yet shown)", vis, "strokeOpacity", 0);

  vis = await seekAndRead(0, "median");
  check("t=0: median strokeOpacity should be 0", vis, "strokeOpacity", 0);

  // ── After polygon show: t=5 ────────────────────────────────────────────
  vis = await seekAndRead(5, "tri");
  check("t=5: tri strokeOpacity should be 1 (after show at t=0)", vis, "strokeOpacity", 1);

  // ── After fade starts but not finished: t=300 ─────────────────────────
  vis = await seekAndRead(300, "tri");
  check("t=300: tri fillOpacity should be between 0 and 0.3", vis, "fillOpacity",
    vis?.fillOpacity > 0 && vis?.fillOpacity <= 0.3 ? vis.fillOpacity : -1); // hack: pass if in range
  // Actually let's do a proper range check
  const triFillAt300 = vis?.fillOpacity ?? -1;
  if (triFillAt300 > 0 && triFillAt300 <= 0.3) { passed++; } else { failed++; console.error(`  FAIL: t=300: tri fillOpacity should be >0 and <=0.3, got ${triFillAt300}`); }

  // arcA should still be hidden at t=300
  vis = await seekAndRead(300, "arcA");
  check("t=300: arcA should still be hidden", vis, "strokeOpacity", 0);

  // ── After title shown: t=705 ──────────────────────────────────────────
  vis = await seekAndRead(705, "title");
  check("t=705: title strokeOpacity should be 1", vis, "strokeOpacity", 1);

  // ── After arc shown: t=805 ────────────────────────────────────────────
  vis = await seekAndRead(805, "arcA");
  check("t=805: arcA strokeOpacity should be 1", vis, "strokeOpacity", 1);
  check("t=805: arcA fillOpacity should be 0.35", vis, "fillOpacity", 0.35);

  // ── Median visible during draw: t=1200 ─────────────────────────────────
  vis = await seekAndRead(1200, "median");
  check("t=1200: median strokeOpacity should be 1 (being drawn)", vis, "strokeOpacity", 1);

  // ── Median hidden after hide: t=1805 ───────────────────────────────────
  vis = await seekAndRead(1805, "median");
  check("t=1805: median strokeOpacity should be 0 (hidden)", vis, "strokeOpacity", 0);

  // ── Blink: during flash ON: t=2005 ────────────────────────────────────
  vis = await seekAndRead(2005, "tri");
  check("t=2005: tri strokeColor should be blink color", vis, "strokeColor", "#e74c3c");

  // ── Blink: after flash OFF: t=2180 ────────────────────────────────────
  vis = await seekAndRead(2180, "tri");
  check("t=2180: tri strokeColor should be original color", vis, "strokeColor", "#2980b9");

  // ── Dynamic point before fade starts: t=11790 ──────────────────────────
  vis = await seekAndRead(11790, "dynPt");
  check("t=11790: dynPt should be hidden (before fade)", vis, "strokeOpacity", 0);
  check("t=11790: dynPt fillOpacity should be 0", vis, "fillOpacity", 0);

  // ── During 300ms fade: t=11950 (halfway through) ──────────────────────
  vis = await seekAndRead(11950, "dynPt");
  const midFade = vis?.strokeOpacity ?? -1;
  if (midFade > 0 && midFade < 1) { passed++; } else { failed++; console.error("  FAIL: t=11950: dynPt strokeOpacity should be mid-fade (0<x<1), got " + midFade); }

  // ── After 300ms fade complete: t=12105 ─────────────────────────────────
  vis = await seekAndRead(12105, "dynPt");
  check("t=12105: dynPt should be fully visible", vis, "strokeOpacity", 1);
  check("t=12105: dynPt fillOpacity should be 1", vis, "fillOpacity", 1);

  // ── Dynamic point after hide: t=12505 ──────────────────────────────────
  vis = await seekAndRead(12505, "dynPt");
  check("t=12505: dynPt should be hidden again", vis, "strokeOpacity", 0);
  check("t=12505: dynPt fillOpacity should be 0", vis, "fillOpacity", 0);

  // ── Seek backward: go back to t=0, verify everything resets ────────────
  vis = await seekAndRead(0, "tri");
  check("seek-back t=0: tri strokeOpacity should be 0", vis, "strokeOpacity", 0);
  check("seek-back t=0: tri fillOpacity should be 0", vis, "fillOpacity", 0);

  vis = await seekAndRead(0, "arcA");
  check("seek-back t=0: arcA should be hidden again", vis, "strokeOpacity", 0);

  vis = await seekAndRead(0, "title");
  check("seek-back t=0: title should be hidden", vis, "strokeOpacity", 0);

  vis = await seekAndRead(0, "dynPt");
  check("seek-back t=0: dynPt should be hidden", vis, "strokeOpacity", 0);

  // ── Final screenshot at a mid point ────────────────────────────────────
  await seekAndRead(5000, "tri"); // seek to after morph
  await new Promise(r => setTimeout(r, 100));
  await page.screenshot({ path: ssPath, fullPage: true });

  // ── Summary ────────────────────────────────────────────────────────────
  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) console.log("  Some shapes appeared before their scheduled time or failed to hide.");
  console.log(`Screenshot: ${ssPath}`);

  if (headless) {
    await browser.close();
    srv.close();
    process.exit(failed > 0 ? 1 : 0);
  } else {
    console.log("Browser open. Close manually or Ctrl+C to exit.");
    process.on("SIGINT", async () => {
      await browser.close();
      srv.close();
      process.exit(failed > 0 ? 1 : 0);
    });
  }
})();
