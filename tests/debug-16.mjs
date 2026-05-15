/**
 * Debug clip 16 — load, check rejections, seek to key moments, inspect state.
 */
import { chromium } from "playwright";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const clipDef = JSON.parse(fs.readFileSync("/Users/andreastrantidis/Desktop/16.json", "utf-8"));
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
  catch(e) { console.warn("ENTITY FAILED: "+ent.id+" err="+e.message); }
}
const sorted = Object.values(CLIP_DEF.incidents || {}).sort((a,b) => a.position - b.position);
let added=0, failed=0;
const rejections=[];
for (const inc of sorted) {
  const leaf = inc.leaf;
  const C = McGeom[leaf.ClassName];
  if (!C) { console.warn("UNKNOWN CLASS: "+leaf.ClassName); failed++; continue; }
  try { clip.addIncident(new C(leaf.attrs, leaf.props), inc.position); added++; }
  catch(e) {
    console.warn("REJECTED pos="+inc.position+" sel="+(leaf.props?.selector||"")+" err="+e.message);
    rejections.push({pos:inc.position, sel:leaf.props?.selector, cls:leaf.ClassName, attrs:Object.keys(leaf.attrs?.animatedAttrs||{}), err:e.message});
    failed++;
  }
}
console.log("SUMMARY: added="+added+" failed="+failed+" rejections="+rejections.length);
window.__rejections = rejections;
window.__seekTo = (ms) => { const d=clip.duration||1; clip.playableProgress(Math.min(Math.max(ms/d,0),1), ms); };
window.__inspect = (id) => {
  const gc = globalThis.__activeGeomClip;
  const el = gc?._entityMap?.[id];
  if (!el) return {error:"not found", knownIds: Object.keys(gc?._entityMap||{})};
  const vp = el.visProp||{};
  return {
    elType: el.elType, strokeopacity: vp.strokeopacity, fillopacity: vp.fillopacity,
    strokecolor: vp.strokecolor, visible: vp.visible,
    svgStrokeOpacity: el.rendNode?.getAttribute?.("stroke-opacity"),
    svgFillOpacity: el.rendNode?.getAttribute?.("fill-opacity"),
    svgDisplay: el.rendNode?.style?.display,
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

  const browserLogs = [];
  page.on("console", msg => {
    const t = msg.text();
    browserLogs.push(t);
    if (t.includes("REJECTED") || t.includes("FAILED") || t.includes("UNKNOWN") || t.includes("SUMMARY"))
      console.log("  [browser]", t);
  });

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__ready === true, { timeout: 15000 });

  const rejections = await page.evaluate(() => window.__rejections);
  console.log(`\n=== ${rejections.length} REJECTIONS ===`);
  for (const r of rejections) {
    console.log(`  pos=${r.pos} sel=${r.sel} cls=${r.cls} attrs=[${r.attrs}] err=${r.err}`);
  }

  // Test key moments
  console.log("\n=== VISIBILITY CHECKS ===");

  // Before anything
  let vis = await seekAndRead(page, 0, "demopnt1");
  console.log(`  t=0 demopnt1: strokeOp=${vis.strokeopacity} fillOp=${vis.fillopacity}`);

  // After first point fade-in (14164 + 300 = 14464)
  vis = await seekAndRead(page, 14500, "demopnt1");
  console.log(`  t=14500 demopnt1: strokeOp=${vis.strokeopacity} fillOp=${vis.fillopacity}`);

  // After triangle fade-in
  vis = await seekAndRead(page, 27300, "demotri1");
  console.log(`  t=27300 demotri1: strokeOp=${vis.strokeopacity} fillOp=${vis.fillopacity}`);

  // After highlight blink sequence
  vis = await seekAndRead(page, 28000, "demotri1");
  console.log(`  t=28000 demotri1 (post-highlight): strokeOp=${vis.strokeopacity} fillOp=${vis.fillopacity}`);

  // Screenshot
  await seekAndRead(page, 30000, "demotri1");
  const ssPath = path.join(__dirname, "_debug-16.png");
  await page.screenshot({ path: ssPath });
  console.log(`\nScreenshot: ${ssPath}`);

  await browser.close();
  srv.close();
})();
