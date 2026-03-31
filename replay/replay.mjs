/**
 * Clip Replay — recreates a full mc-jsxgraph clip from an exported JSON definition.
 *
 * Usage:
 *   node replay/replay.mjs path/to/clip-export.json [--headless] [--seek 42000] [--screenshot out.png]
 *
 * Requires geom-tutor dev server NOT running (uses its own server).
 * Uses Playwright to render the clip in a real browser.
 */

import { chromium } from "playwright";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ── CLI args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const jsonPath = args.find(a => !a.startsWith("--"));
const headless = args.includes("--headless");
const seekIdx = args.indexOf("--seek");
const seekMs = seekIdx >= 0 ? parseInt(args[seekIdx + 1], 10) : null;
const ssIdx = args.indexOf("--screenshot");
const ssPath = ssIdx >= 0 ? args[ssIdx + 1] : null;

if (!jsonPath) {
  console.error("Usage: node replay/replay.mjs <clip-export.json> [--headless] [--seek ms] [--screenshot path.png]");
  process.exit(1);
}

const clipDef = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
const geom = clipDef.geomClip;
if (!geom) { console.error("No geomClip in JSON"); process.exit(1); }

// ── HTML template ───────────────────────────────────────────────────────────

const HTML = `<!DOCTYPE html>
<html><head>
<link rel="stylesheet" href="/node_modules/jsxgraph/distrib/jsxgraph.css">
<style>
  body { margin: 0; background: #f8f9fa; }
  #clip { width: 100vw; height: 100vh; }
  #controls { position: fixed; bottom: 8px; left: 8px; z-index: 100; display: flex; gap: 6px; }
  #controls button { padding: 4px 12px; font-size: 12px; cursor: pointer; }
  #info { position: fixed; top: 8px; left: 8px; font: 12px monospace; color: #666; z-index: 100; }
</style>
</head>
<body>
<div id="clip"></div>
<div id="info">Loading...</div>
<div id="controls">
  <button id="btnPlay">Play</button>
  <button id="btnPause">Pause</button>
  <button id="btnSeek">Seek 0</button>
</div>
<script type="module">
import { loadPlugin, TimeCapsule } from "/node_modules/@donkeyclip/motorcortex/dist/motorcortex.esm.min.js";
import McGeomDef from "/dist/bundle.esm.js";

const McGeom = loadPlugin(McGeomDef);
const CLIP_DEF = ${JSON.stringify(geom)};
const info = document.getElementById("info");

// 1. Create clip from board config
const clip = new McGeom.Clip(
  { board: CLIP_DEF.attrs.board, shapes: CLIP_DEF.attrs.shapes || [] },
  { host: document.getElementById("clip"), containerParams: { width: "100%", height: "100%" } },
);

info.textContent = "Clip created. Adding entities...";

// 2. Add dynamic entities (shapes created via addCustomEntity at runtime)
const entities = CLIP_DEF.dynamicEntities || [];
for (const ent of entities) {
  try {
    clip.addCustomEntity(ent.definition, ent.id, ent.classes, ent.birthtime, ent.hidden);
  } catch (e) {
    console.warn("Entity " + ent.id + " failed:", e.message);
  }
}
info.textContent = entities.length + " entities added. Adding incidents...";

// 3. Add incidents
const incidents = CLIP_DEF.incidents || {};
const sorted = Object.values(incidents).sort((a, b) => a.position - b.position);
let added = 0, failed = 0;

for (const inc of sorted) {
  const leaf = inc.leaf;
  const IncClass = McGeom[leaf.ClassName];
  if (!IncClass) {
    console.warn("Unknown incident class: " + leaf.ClassName);
    failed++;
    continue;
  }
  try {
    const incident = new IncClass(leaf.attrs, leaf.props);
    clip.addIncident(incident, inc.position);
    added++;
  } catch (e) {
    console.warn("Incident " + inc.id + " (" + leaf.ClassName + ") failed:", e.message);
    failed++;
  }
}

info.textContent = added + " incidents added, " + failed + " failed. Duration: " + (clip.duration / 1000).toFixed(1) + "s";

// 4. Controls
const tc = new TimeCapsule();
document.getElementById("btnPlay").onclick = () => clip.play();
document.getElementById("btnPause").onclick = () => clip.pause();
document.getElementById("btnSeek").onclick = () => {
  const ms = parseInt(prompt("Seek to (ms):", "0"), 10);
  if (!isNaN(ms)) tc.startJourney(clip).destination(ms);
};

// rAF info update
function tick() {
  const ms = clip.runTimeInfo?.currentMillisecond ?? 0;
  info.textContent = (ms / 1000).toFixed(2) + "s / " + (clip.duration / 1000).toFixed(1) + "s | " + added + " incidents";
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// Expose for Playwright
window.__clip = clip;
window.__tc = tc;
window.__seekTo = (ms) => tc.startJourney(clip).destination(ms);
window.__ready = true;
</script>
</body></html>`;

// ── Static server ───────────────────────────────────────────────────────────

function startServer() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let fp;
      if (req.url === "/") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(HTML);
        return;
      }
      fp = path.join(ROOT, req.url);
      if (!fs.existsSync(fp)) { res.writeHead(404); res.end("Not found"); return; }
      const ext = path.extname(fp);
      const ct = { ".html": "text/html", ".js": "application/javascript", ".mjs": "application/javascript", ".css": "text/css", ".json": "application/json" }[ext] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": ct });
      fs.createReadStream(fp).pipe(res);
    });
    srv.listen(0, "127.0.0.1", () => resolve(srv));
  });
}

// ── Main ────────────────────────────────────────────────────────────────────

(async () => {
  const srv = await startServer();
  const port = srv.address().port;
  console.log(`Replay server: http://127.0.0.1:${port}`);
  console.log(`Clip: ${geom.incidents ? Object.keys(geom.incidents).length : 0} incidents, ${(geom.dynamicEntities || []).length} entities`);

  const browser = await chromium.launch({ headless });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });

  page.on("console", msg => console.log(`[browser] ${msg.text()}`));
  page.on("pageerror", err => console.error(`[PAGE ERROR] ${err.message}`));

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load" });

  try {
    await page.waitForFunction(() => window.__ready === true, { timeout: 15000 });
    console.log("Clip loaded successfully.");
  } catch {
    console.error("Clip failed to load within timeout.");
  }

  if (seekMs !== null) {
    console.log(`Seeking to ${seekMs}ms...`);
    await page.evaluate(ms => window.__seekTo(ms), seekMs);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await new Promise(r => setTimeout(r, 200));
  }

  if (ssPath) {
    await page.screenshot({ path: ssPath, fullPage: true });
    console.log(`Screenshot saved: ${ssPath}`);
  }

  if (headless) {
    await browser.close();
    srv.close();
  } else {
    console.log("Browser open — close manually or Ctrl+C to exit.");
    process.on("SIGINT", async () => {
      await browser.close();
      srv.close();
      process.exit(0);
    });
  }
})();
