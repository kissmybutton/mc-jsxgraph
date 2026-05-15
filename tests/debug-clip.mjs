/**
 * Debug a specific clip — loads it via replay, seeks to specific moments,
 * and inspects DOM + visProp state to diagnose why incidents didn't play.
 *
 * Usage: node tests/debug-clip.mjs path/to/clip.json [--headless]
 */

import { chromium } from "playwright";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const jsonPath = args.find((a) => !a.startsWith("--"));
const headless = args.includes("--headless");

if (!jsonPath) {
  console.error("Usage: node tests/debug-clip.mjs <clip.json> [--headless]");
  process.exit(1);
}

const clipDef = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
const geom = clipDef.geomClip;
if (!geom) {
  console.error("No geomClip in JSON");
  process.exit(1);
}

// ── HTML: same as replay.mjs but adds inspection helpers ────────────────────

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
</style>
</head>
<body>
<div id="clip"></div>
<script type="module">
import { loadPlugin } from "/node_modules/@donkeyclip/motorcortex/dist/motorcortex.esm.min.js";
import McGeomDef from "/dist/bundle.esm.js";

const McGeom = loadPlugin(McGeomDef);
const CLIP_DEF = ${JSON.stringify(geom)};

const clip = new McGeom.Clip(
  { board: CLIP_DEF.attrs.board, shapes: CLIP_DEF.attrs.shapes || [] },
  { host: document.getElementById("clip"), containerParams: { width: "100%", height: "100%" } },
);

// Add dynamic entities
const entities = CLIP_DEF.dynamicEntities || [];
for (const ent of entities) {
  try {
    clip.addCustomEntity(ent.definition, ent.id, ent.classes, ent.birthtime, ent.hidden);
  } catch (e) {
    console.warn("Entity " + ent.id + " failed:", e.message);
  }
}

// Add incidents — log rejections
const incidents = CLIP_DEF.incidents || {};
const sorted = Object.values(incidents).sort((a, b) => a.position - b.position);
let added = 0, failed = 0;
const rejected = [];

for (const inc of sorted) {
  const leaf = inc.leaf;
  const IncClass = McGeom[leaf.ClassName];
  if (!IncClass) { failed++; continue; }
  try {
    const incident = new IncClass(leaf.attrs, leaf.props);
    clip.addIncident(incident, inc.position);
    added++;
  } catch (e) {
    console.warn("Incident " + inc.id + " rejected:", e.message);
    rejected.push({ id: inc.id, position: inc.position, selector: leaf.props?.selector, error: e.message });
    failed++;
  }
}
console.log("Added: " + added + ", Failed: " + failed);

// Deterministic seek
window.__seekTo = (ms) => {
  const d = clip.duration || 1;
  const frac = Math.min(Math.max(ms / d, 0), 1);
  clip.playableProgress(frac, ms);
};

// Inspect an entity's visProp + SVG state
window.__inspect = (id) => {
  const gc = globalThis.__activeGeomClip;
  if (!gc) return { error: "no geomClip" };
  const el = gc._entityMap?.[id];
  if (!el) return { error: "entity not found", knownIds: Object.keys(gc._entityMap) };

  const vp = el.visProp || {};
  const result = {
    id,
    elType: el.elType,
    visProp: {
      strokecolor: vp.strokecolor,
      fillcolor: vp.fillcolor,
      strokeopacity: vp.strokeopacity,
      fillopacity: vp.fillopacity,
      strokewidth: vp.strokewidth,
      visible: vp.visible,
    },
  };

  // SVG node state
  if (el.rendNode) {
    const rn = el.rendNode;
    result.svg = {
      stroke: rn.getAttribute?.("stroke"),
      fill: rn.getAttribute?.("fill"),
      strokeOpacity: rn.getAttribute?.("stroke-opacity"),
      fillOpacity: rn.getAttribute?.("fill-opacity"),
      display: rn.style?.display,
      visibility: rn.style?.visibility,
    };
  }

  return result;
};

// Get the inner HTML of the MC container
window.__getContainer = () => {
  const container = document.querySelector("[data-motorcortex-container]");
  return container ? container.innerHTML.slice(0, 5000) : "no container found";
};

window.__clip = clip;
window.__rejected = rejected;
window.__ready = true;
</script>
</body></html>`;

// ── Server ──────────────────────────────────────────────────────────────────

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

// ── Helpers ─────────────────────────────────────────────────────────────────

async function seekAndWait(page, ms) {
  await page.evaluate((ms) => window.__seekTo(ms), ms);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await new Promise((r) => setTimeout(r, 150));
}

async function inspect(page, id, label) {
  const state = await page.evaluate((id) => window.__inspect(id), id);
  console.log(`  [${label}] ${id}:`, JSON.stringify(state, null, 2));
  return state;
}

// ── Main ────────────────────────────────────────────────────────────────────

(async () => {
  const srv = await startServer();
  const port = srv.address().port;
  console.log(`Debug server: http://127.0.0.1:${port}`);

  const browser = await chromium.launch({ headless });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });

  page.on("console", (msg) => {
    const text = msg.text();
    if (text.includes("rejected") || text.includes("failed") || text.includes("FAIL"))
      console.log(`  [browser] ${text}`);
  });
  page.on("pageerror", (err) => console.error(`  [PAGE ERROR] ${err.message}`));

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load" });

  try {
    await page.waitForFunction(() => window.__ready === true, { timeout: 15000 });
  } catch {
    console.error("Clip failed to load.");
    await browser.close();
    srv.close();
    process.exit(1);
  }

  // Check for rejected incidents
  const rejected = await page.evaluate(() => window.__rejected);
  if (rejected.length > 0) {
    console.log(`\n=== ${rejected.length} REJECTED INCIDENTS ===`);
    for (const r of rejected) {
      console.log(`  pos=${r.position} sel=${r.selector} err=${r.error}`);
    }
  }

  // ── Investigate incident 1: A_sq1 strokeColor at 34783 ────────────────
  console.log("\n=== INVESTIGATING: A_sq1 strokeColor at 34783ms ===");

  await seekAndWait(page, 34000);
  await inspect(page, "A_sq1", "t=34000 BEFORE");

  await seekAndWait(page, 34783);
  await inspect(page, "A_sq1", "t=34783 START");

  await seekAndWait(page, 35283);
  await inspect(page, "A_sq1", "t=35283 MIDWAY");

  await seekAndWait(page, 35800);
  await inspect(page, "A_sq1", "t=35800 AFTER");

  // ── Investigate incident 2: A_angles_obtuse strokeColor at 52055 ──────
  console.log("\n=== INVESTIGATING: A_angles_obtuse strokeColor at 52055ms ===");

  // First check if entity exists at all
  const exists = await page.evaluate(() => {
    const gc = globalThis.__activeGeomClip;
    return {
      hasEntity: !!gc?._entityMap?.["A_angles_obtuse"],
      allIds: Object.keys(gc?._entityMap || {}).filter(k => k.includes("angle") || k.includes("obtuse")),
    };
  });
  console.log("  Entity lookup:", JSON.stringify(exists));

  if (exists.hasEntity) {
    await seekAndWait(page, 51500);
    await inspect(page, "A_angles_obtuse", "t=51500 BEFORE");

    await seekAndWait(page, 52055);
    await inspect(page, "A_angles_obtuse", "t=52055 START");

    await seekAndWait(page, 53100);
    await inspect(page, "A_angles_obtuse", "t=53100 AFTER");
  }

  // ── Screenshot ────────────────────────────────────────────────────────
  await seekAndWait(page, 35000);
  const ssPath = path.join(__dirname, "_debug-result.png");
  await page.screenshot({ path: ssPath, fullPage: true });
  console.log(`\nScreenshot: ${ssPath}`);

  if (headless) {
    await browser.close();
    srv.close();
  } else {
    console.log("Browser open. Ctrl+C to exit.");
    process.on("SIGINT", async () => {
      await browser.close();
      srv.close();
      process.exit(0);
    });
  }
})();
