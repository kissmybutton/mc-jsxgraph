/**
 * Minimal audio playback test — does MC AudioClip + AudioPlayback actually play sound?
 * Opens a browser window (not headless) so you can hear it.
 */
import { chromium } from "playwright";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Find a TTS mp3 file to test with
const audioDir = "/Users/andreastrantidis/Projects/geom-tutor/public/audio";
const mp3Files = fs.readdirSync(audioDir).filter(f => f.endsWith(".mp3")).sort().reverse();
const testMp3 = mp3Files[0];
if (!testMp3) { console.error("No mp3 files found"); process.exit(1); }
console.log("Test audio:", testMp3);

const HTML = `<!DOCTYPE html>
<html><head>
<script type="importmap">{ "imports": {
  "@donkeyclip/motorcortex": "/node_modules/@donkeyclip/motorcortex/dist/motorcortex.esm.min.js"
} }</script>
<style>body{margin:20px;font-family:monospace}button{padding:10px 20px;font-size:16px;margin:5px}</style>
</head><body>
<h2>Audio Debug Test</h2>
<div id="status">Loading...</div>
<button id="btnPlay">Play Clip</button>
<button id="btnDirect">Play Direct (HTML Audio)</button>
<button id="btnCtx">Resume AudioContext</button>
<div id="log"></div>
<script type="module">
import * as MC from "@donkeyclip/motorcortex";

const status = document.getElementById("status");
const log = document.getElementById("log");
function addLog(msg) {
  console.log(msg);
  log.innerHTML += msg + "<br>";
}

addLog("MC loaded. AudioClip: " + typeof MC.AudioClip);
addLog("AudioPlayback: " + typeof MC.AudioPlayback);
addLog("HTMLClip: " + typeof MC.HTMLClip);

// Create a simple HTMLClip as host
const clip = new MC.HTMLClip({
  host: document.createElement("div"),
  html: "<div></div>",
  containerParams: { width: "1px", height: "1px" },
});
document.body.appendChild(clip.props.host);

// Create AudioClip with the test mp3
const audioClip = new MC.AudioClip(
  {},
  {
    audioSources: [{
      id: "test-audio",
      src: "/audio/${testMp3}",
      classes: [],
      base64: false,
    }],
    initParams: {},
  }
);

addLog("AudioClip created. Duration: " + audioClip.duration);

// Add AudioPlayback
const playback = new MC.AudioPlayback({
  selector: "~#test-audio",
  startFrom: 0,
  duration: 5000,
});
addLog("AudioPlayback created.");

audioClip.addIncident(playback, 0);
addLog("Playback added to audioClip. AudioClip duration: " + audioClip.duration);

clip.addIncident(audioClip, 0);
addLog("AudioClip added to HTMLClip. Clip duration: " + clip.duration);

status.textContent = "Ready. Clip duration: " + clip.duration + "ms";

// Play via MC
document.getElementById("btnPlay").onclick = () => {
  addLog("Playing MC clip...");
  try {
    clip.play();
    addLog("clip.play() called. Playing: " + clip.playing);
  } catch(e) {
    addLog("ERROR: " + e.message);
  }
};

// Play direct via HTML Audio element (bypass MC)
document.getElementById("btnDirect").onclick = () => {
  addLog("Playing direct HTML Audio...");
  const audio = new Audio("/audio/${testMp3}");
  audio.play().then(() => addLog("Direct audio playing!")).catch(e => addLog("Direct audio error: " + e.message));
};

// Resume AudioContext
document.getElementById("btnCtx").onclick = async () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    addLog("AudioContext state: " + ctx.state);
    if (ctx.state === "suspended") {
      await ctx.resume();
      addLog("AudioContext resumed: " + ctx.state);
    }
  } catch(e) {
    addLog("AudioContext error: " + e.message);
  }
};

window.__ready = true;
</script></body></html>`;

function startServer() {
  return new Promise(r => {
    const srv = http.createServer((req, res) => {
      if (req.url === "/") { res.writeHead(200,{"Content-Type":"text/html"}); res.end(HTML); return; }
      if (req.url.startsWith("/audio/")) {
        const fp = path.join(audioDir, path.basename(req.url));
        if (fs.existsSync(fp)) {
          res.writeHead(200,{"Content-Type":"audio/mpeg"});
          fs.createReadStream(fp).pipe(res);
          return;
        }
      }
      const fp = path.join(ROOT, req.url);
      if (!fs.existsSync(fp)) { res.writeHead(404); res.end("nf"); return; }
      const ext = path.extname(fp);
      const ct = {".html":"text/html",".js":"application/javascript",".css":"text/css",".json":"application/json"}[ext]||"application/octet-stream";
      res.writeHead(200,{"Content-Type":ct}); fs.createReadStream(fp).pipe(res);
    });
    srv.listen(0,"127.0.0.1",()=>r(srv));
  });
}

(async () => {
  const srv = await startServer();
  const port = srv.address().port;
  console.log(`Open: http://127.0.0.1:${port}`);

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });

  page.on("console", msg => console.log("  [browser]", msg.text()));
  page.on("pageerror", err => console.error("  [PAGE ERROR]", err.message));
  page.on("request", req => {
    if (req.url().includes("mp3")) console.log("  [NET REQ]", req.url().slice(-40));
  });
  page.on("response", res => {
    if (res.url().includes("mp3")) console.log("  [NET RES]", res.status(), res.url().slice(-40));
  });

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__ready, { timeout: 10000 });

  console.log("\n=== Page loaded. Click buttons in the browser to test audio. ===");
  console.log("1. Click 'Play Direct' first to verify audio works at all");
  console.log("2. Click 'Resume AudioContext' to ensure context is active");
  console.log("3. Click 'Play Clip' to test MC AudioClip playback");
  console.log("\nCtrl+C to exit.\n");

  process.on("SIGINT", async () => {
    await browser.close();
    srv.close();
    process.exit(0);
  });
})();
