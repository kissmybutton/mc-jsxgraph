/**
 * Test: addFigure-like flow — points with labels + segments.
 * Usage: node tests/segments-test.mjs  (geom-tutor must be on localhost:3000)
 */
import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  page.on("console", msg => console.log(`[browser] ${msg.text()}`));
  page.on("pageerror", err => console.error(`[PAGE ERROR] ${err.message}`));

  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__activeGeomClip?._entityMap, { timeout: 15000 });

  const result = await page.evaluate(() => {
    const log = [];
    const gc = window.__activeGeomClip;

    // Test 1: point WITH label (same as addFigure produces)
    log.push("=== Test 1: Point with label ===");
    try {
      const pt = gc.board.create("point", [3, 5], {
        id: "lbl_pA", withLabel: true, name: "A",
      });
      log.push("Point with label: " + !!pt + " elType=" + pt?.elType);
      gc._entityMap["lbl_pA"] = pt;
    } catch (e) {
      log.push("CRASH creating labeled point: " + e.message);
    }

    // Test 2: point WITH label + label config object (the broken version)
    log.push("\n=== Test 2: Point with label config object ===");
    try {
      const pt2 = gc.board.create("point", [5, 5], {
        id: "lbl_pB", withLabel: true, name: "B",
        label: { fontSize: 14, strokeColor: "#333" },
      });
      log.push("Point with label config: " + !!pt2 + " elType=" + pt2?.elType);
      gc._entityMap["lbl_pB"] = pt2;
    } catch (e) {
      log.push("CRASH creating labeled point with config: " + e.message);
    }

    // Test 3: segment referencing labeled points
    log.push("\n=== Test 3: Segment from labeled points ===");
    try {
      const pA = gc._entityMap["lbl_pA"];
      const pB = gc._entityMap["lbl_pB"];
      log.push("pA in entityMap: " + !!pA + " pB: " + !!pB);
      if (pA && pB) {
        const seg = gc.board.create("segment", [pA, pB], {
          id: "lbl_seg", strokeColor: "#e74c3c", strokeWidth: 3, withLabel: false,
        });
        log.push("Segment created: " + !!seg + " visible=" + seg?.visProp?.visible);
      }
    } catch (e) {
      log.push("CRASH creating segment: " + e.message);
    }

    // Test 4: Full addCustomEntity flow (hidden=true like addShape does)
    log.push("\n=== Test 4: renderCustomEntity + hideElement flow ===");
    try {
      const pt3el = gc.renderCustomEntity({
        type: "point", id: "rce_p1", args: [3, 2], attributes: { withLabel: true, name: "X" },
      });
      log.push("renderCustomEntity point X: " + !!pt3el);

      const pt4el = gc.renderCustomEntity({
        type: "point", id: "rce_p2", args: [9, 2], attributes: { withLabel: true, name: "Y" },
      });
      log.push("renderCustomEntity point Y: " + !!pt4el);

      // Now hide them (simulating addCustomEntity hidden=true)
      if (pt3el) gc._hideElement(pt3el);
      if (pt4el) gc._hideElement(pt4el);
      log.push("Points hidden");

      // Create segment
      const segel = gc.renderCustomEntity({
        type: "segment", id: "rce_seg", args: ["rce_p1", "rce_p2"],
        attributes: { withLabel: false, strokeColor: "#9b59b6", strokeWidth: 3 },
      });
      log.push("renderCustomEntity segment: " + !!segel);

      if (segel) {
        gc._hideElement(segel);
        log.push("Segment hidden");

        // Now show everything (simulating VisibilityChannel showElement)
        gc._showElement(pt3el);
        gc._showElement(pt4el);
        gc._showElement(segel);
        log.push("All shown");
        log.push("Segment visProp.visible=" + segel.visProp?.visible + " display=" + segel.rendNode?.style?.display);
      }
    } catch (e) {
      log.push("CRASH in test 4: " + e.message);
      log.push(e.stack?.split("\n").slice(0, 3).join("\n"));
    }

    gc.board.update();
    return { log };
  });

  console.log("\n=== TEST RESULTS ===");
  console.log(result.log.join("\n"));

  const ssPath = path.join(__dirname, "_test-result.png");
  await page.screenshot({ path: ssPath, fullPage: true });
  console.log(`\nScreenshot: ${ssPath}`);

  await new Promise(r => setTimeout(r, 3000));
  await browser.close();
})();
