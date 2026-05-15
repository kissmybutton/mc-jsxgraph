/**
 * Quick debug for clip 15 — investigate dem_fig1 highlight at ~52s
 */
import { chromium } from "playwright";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const clipDef = JSON.parse(fs.readFileSync("/Users/andreastrantidis/Desktop/15.json", "utf-8"));
const geom = clipDef.geomClip;

const HTML = `<!DOCTYPE html>
<html><head>
<link rel="stylesheet" href="/node_modules/jsxgraph/distrib/jsxgraph.css">
<script type="importmap">{ "imports": { "@donkeyclip/motorcortex": "/node_modules/@donkeyclip/motorcortex/dist/motorcortex.esm.min.js", "jsxgraph": "/node_modules/jsxgraph/src/index.js" } }</script>
<style>body{margin:0}#clip{width:100vw;height:100vh}</style>
</head><body><div id="clip"></div>
<script type="module">
import { loadPlugin } from "/node_modules/@donkeyclip/motorcortex/dist/motorcortex.esm.min.js";
import McGeomDef from "/dist/bundle.esm.js";
const McGeom = loadPlugin(McGeomDef);
const CLIP_DEF = ${JSON.stringify(geom)};
const clip = new McGeom.Clip(
  { board: CLIP_DEF.attrs.board, shapes: CLIP_DEF.attrs.shapes || [] },
  { host: document.getElementById("clip"), containerParams: { width: "100%", height: "100%" } },
);
const entities = CLIP_DEF.dynamicEntities || [];
for (const ent of entities) {
  try { clip.addCustomEntity(ent.definition, ent.id, ent.classes, ent.birthtime, ent.hidden); }
  catch(e) { console.warn("Entity "+ent.id+" failed:"+e.message); }
}
const sorted = Object.values(CLIP_DEF.incidents || {}).sort((a,b) => a.position - b.position);
let added=0, failed=0, rejections=[];
for (const inc of sorted) {
  const leaf = inc.leaf;
  const C = McGeom[leaf.ClassName];
  if (!C) { failed++; continue; }
  try { clip.addIncident(new C(leaf.attrs, leaf.props), inc.position); added++; }
  catch(e) {
    console.warn("REJECTED pos="+inc.position+" sel="+leaf.props?.selector+" err="+e.message);
    rejections.push({pos:inc.position, sel:leaf.props?.selector, cls:leaf.ClassName, err:e.message});
    failed++;
  }
}
console.log("Added:"+added+" Failed:"+failed);
window.__rejections = rejections;
window.__seekTo = (ms) => { const d=clip.duration||1; clip.playableProgress(Math.min(Math.max(ms/d,0),1), ms); };
window.__inspect = (id) => {
  const gc = globalThis.__activeGeomClip;
  const el = gc?._entityMap?.[id];
  if (!el) return {error:"not found"};
  const vp = el.visProp||{};
  const rn = el.rendNode;
  return {
    elType: el.elType,
    strokeopacity: vp.strokeopacity,
    fillopacity: vp.fillopacity,
    strokecolor: vp.strokecolor,
    visible: vp.visible,
    svgDisplay: rn?.style?.display,
    svgStrokeOpacity: rn?.getAttribute?.("stroke-opacity"),
    svgFillOpacity: rn?.getAttribute?.("fill-opacity"),
  };
};
window.__ready = true;
</script></body></html>`;

function startServer() {
  return new Promise(r => {
    const srv = http.createServer((req, res) => {
      if (req.url === "/") { res.writeHead(200,{"Content-Type":"text/html"}); res.end(HTML); return; }
      const fp = path.join(ROOT, req.url);
      if (!fs.existsSync(fp)) { res.writeHead(404); res.end("Not found"); return; }
      const ext = path.extname(fp);
      const ct = {".html":"text/html",".js":"application/javascript",".mjs":"application/javascript",".css":"text/css",".json":"application/json"}[ext]||"application/octet-stream";
      res.writeHead(200,{"Content-Type":ct}); fs.createReadStream(fp).pipe(res);
    });
    srv.listen(0,"127.0.0.1",()=>r(srv));
  });
}

async function seekAndRead(page, ms, id) {
  await page.evaluate(ms => window.__seekTo(ms), ms);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await new Promise(r => setTimeout(r, 100));
  return page.evaluate(id => window.__inspect(id), id);
}

(async () => {
  const srv = await startServer();
  const port = srv.address().port;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });

  page.on("console", msg => {
    const t = msg.text();
    if (t.includes("REJECTED") || t.includes("failed") || t.includes("Failed"))
      console.log("  [browser]", t);
  });

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__ready === true, { timeout: 15000 });

  // Check rejections
  const rejections = await page.evaluate(() => window.__rejections);
  if (rejections.length > 0) {
    console.log(`\n=== ${rejections.length} REJECTED INCIDENTS ===`);
    for (const r of rejections) console.log(`  pos=${r.pos} sel=${r.sel} cls=${r.cls} err=${r.err}`);
  } else {
    console.log("\n=== NO REJECTIONS ===");
  }

  // Investigate dem_fig1 around the highlight at 52055
  console.log("\n=== dem_fig1 AROUND HIGHLIGHT (52055ms) ===");

  let vis;
  vis = await seekAndRead(page, 51000, "dem_fig1");
  console.log("  t=51000 (before):", JSON.stringify(vis));

  vis = await seekAndRead(page, 52055, "dem_fig1");
  console.log("  t=52055 (blink OFF):", JSON.stringify(vis));

  vis = await seekAndRead(page, 52056, "dem_fig1");
  console.log("  t=52056 (after OFF):", JSON.stringify(vis));

  vis = await seekAndRead(page, 52230, "dem_fig1");
  console.log("  t=52230 (blink ON):", JSON.stringify(vis));

  vis = await seekAndRead(page, 52231, "dem_fig1");
  console.log("  t=52231 (after ON):", JSON.stringify(vis));

  vis = await seekAndRead(page, 52580, "dem_fig1");
  console.log("  t=52580 (final ON):", JSON.stringify(vis));

  vis = await seekAndRead(page, 53000, "dem_fig1");
  console.log("  t=53000 (after all):", JSON.stringify(vis));

  await browser.close();
  srv.close();
})();
