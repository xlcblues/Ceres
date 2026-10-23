const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");

const EDGE =
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const DEBUG_PORT = 8316;
const BASE_URL = process.argv[2] || "http://localhost:1420/?demo=1";
const OUT_DIR = path.join(process.cwd(), ".ui-snapshots");
const PROFILE_DIR = path.join(process.cwd(), ".ui-edge-profile");

function getJson(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      })
      .on("error", reject);
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForEndpoint() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const targets = await getJson(
        `http://127.0.0.1:${DEBUG_PORT}/json/list`,
      );
      const page = targets.find((target) => target.type === "page");
      if (page) return page;
    } catch {
      // not up yet
    }
    await sleep(250);
  }
  throw new Error("Edge CDP endpoint did not come up");
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = spawn(
    EDGE,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${PROFILE_DIR}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  const report = { generatedAt: new Date().toISOString(), shots: [] };

  try {
    const page = await waitForEndpoint();
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    const pending = new Map();
    let msgId = 0;

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    };

    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    const send = (method, params = {}) =>
      new Promise((resolve) => {
        const id = ++msgId;
        pending.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });

    const evaluate = async (expression) => {
      const result = await send("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (result.result?.exceptionDetails) {
        throw new Error(
          result.result.exceptionDetails.text ||
            "Runtime.evaluate failed",
        );
      }
      return result.result?.result?.value;
    };

    await send("Page.enable");
    await send("Runtime.enable");
    await send("Page.navigate", { url: BASE_URL });

    for (let i = 0; i < 40; i += 1) {
      const ready = await evaluate(
        "document.readyState === 'complete' && !!document.querySelector('.app-shell')",
      );
      if (ready) break;
      await sleep(250);
    }
    await sleep(900);

    const viewports = [
      { name: "desktop", width: 1180, height: 760 },
      { name: "narrow", width: 960, height: 640 },
      { name: "compact", width: 700, height: 720 },
    ];
    const views = ["今日", "趋势", "记录", "设置"];

    for (const viewport of viewports) {
      await send("Emulation.setDeviceMetricsOverride", {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await sleep(220);

      for (const theme of ["light", "dark"]) {
        await evaluate(
          `localStorage.setItem('ceres.theme', '${theme}'); location.reload();`,
        );
        await sleep(1200);

        for (const view of views) {
          const clicked = await evaluate(
            `(() => {
              const buttons = [...document.querySelectorAll('.nav-list button')];
              const target = buttons.find((b) => b.textContent.trim() === ${JSON.stringify(view)});
              if (!target) return false;
              target.click();
              return true;
            })()`,
          );
          if (!clicked) {
            console.error(`nav not found: ${view}`);
            continue;
          }
          await sleep(500);

          const shot = await send("Page.captureScreenshot", {
            format: "png",
          });
          const file = path.join(
            OUT_DIR,
            `${viewport.name}-${theme}-${view}.png`,
          );
          fs.writeFileSync(
            file,
            Buffer.from(shot.result.data, "base64"),
          );

          const audit = await evaluate(`(() => {
            const issues = [];
            const doc = document.documentElement;
            if (doc.scrollWidth > doc.clientWidth + 1) {
              issues.push({ type: "horizontal-overflow", detail: doc.scrollWidth + " > " + doc.clientWidth });
            }
            const vw = innerWidth;
            const overflow = [];
            document.querySelectorAll("body *").forEach((el) => {
              const r = el.getBoundingClientRect();
              if (r.width < 2 || r.height < 2) return;
              if (r.right > vw + 1 || r.left < -1) {
                overflow.push({ tag: el.tagName, cls: String(el.className).slice(0, 60), left: Math.round(r.left), right: Math.round(r.right) });
              }
            });
            if (overflow.length) issues.push({ type: "viewport-overflow", items: overflow.slice(0, 8) });
            const textOver = [];
            document.querySelectorAll(".panel, .stat-card, .nav-list button, .record-row, button, .page-head, .reminder-banner, .sidebar-foot, .brand, .goal-meta, .milestone-head, .chart-panel, .export-panel, .record-date").forEach((el) => {
              if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
                textOver.push({ tag: el.tagName, cls: String(el.className).slice(0, 50), sw: el.scrollWidth, cw: el.clientWidth });
              }
            });
            if (textOver.length) issues.push({ type: "text-overflow", items: textOver.slice(0, 10) });
            const visible = [...document.querySelectorAll("body *")].filter((el) => {
              const r = el.getBoundingClientRect();
              return r.width > 24 && r.height > 14 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
            });
            const keySelectors = "button, .stat-card-value, .status-chip, .record-date, .record-weight, .record-note, .milestone-head span, .goal-ring-label, .panel-head h2, .chart-legend span, .about-list strong, .page-head h1, .form-hint";
            const keyed = visible.filter((el) => el.matches(keySelectors));
            const overlaps = [];
            for (let i = 0; i < keyed.length; i += 1) {
              const a = keyed[i];
              const ar = a.getBoundingClientRect();
              const aa = ar.width * ar.height;
              for (let j = i + 1; j < keyed.length; j += 1) {
                const b = keyed[j];
                if (a.contains(b) || b.contains(a)) continue;
                const br = b.getBoundingClientRect();
                const ba = br.width * br.height;
                const ix = Math.max(0, Math.min(ar.right, br.right) - Math.max(ar.left, br.left));
                const iy = Math.max(0, Math.min(ar.bottom, br.bottom) - Math.max(ar.top, br.top));
                const ia = ix * iy;
                const minArea = Math.min(aa, ba);
                if (minArea > 200 && ia > 0.45 * minArea) {
                  overlaps.push({ a: a.tagName + "." + String(a.className).slice(0, 30), b: b.tagName + "." + String(b.className).slice(0, 30) });
                }
              }
            }
            if (overlaps.length) issues.push({ type: "element-overlap", items: overlaps.slice(0, 10) });
            const panels = [...document.querySelectorAll(".panel")].map((p) => ({
              cls: String(p.className).slice(0, 40),
              h: Math.round(p.getBoundingClientRect().height),
            }));
            const pageHeadPosition = getComputedStyle(document.querySelector(".page-head")).position;
            return { issues, panels, pageHeadPosition };
          })()`);

          report.shots.push({
            viewport: viewport.name,
            theme,
            view,
            file: path.relative(process.cwd(), file),
            issues: audit.issues,
          });

          if (viewport.name === "compact") {
            const rail = await evaluate(`(() => {
              const label = document.querySelector('.nav-list button span');
              const themeButtons = [...document.querySelectorAll('.theme-switch button')];
              return {
                navLabelDisplay: label ? getComputedStyle(label).display : 'missing',
                themeCount: themeButtons.length,
                themeDir: getComputedStyle(document.querySelector('.theme-switch')).flexDirection,
                sidebarWidth: Math.round(document.querySelector('.sidebar').getBoundingClientRect().width),
              };
            })()`);
            report.shots[report.shots.length - 1].rail = rail;
          }

          if (view === "记录") {
            const scroll = await evaluate(`(async () => {
              const content = document.querySelector('.content');
              content.scrollTop = 400;
              await new Promise((resolve) => setTimeout(resolve, 160));
              const pageHead = document.querySelector('.page-head');
              const recordHead = document.querySelector('.record-head');
              return {
                scrolledClass: content.classList.contains('scrolled'),
                pageHeadTop: Math.round(pageHead.getBoundingClientRect().top),
                pageHeadBorder: getComputedStyle(pageHead).borderBottomWidth,
                recordHeadSticky: recordHead ? getComputedStyle(recordHead).position : 'missing',
                contentScrollTop: Math.round(content.scrollTop),
              };
            })()`);
            report.shots[report.shots.length - 1].scroll = scroll;
          }
        }
      }
    }

    fs.writeFileSync(
      path.join(OUT_DIR, "audit.json"),
      JSON.stringify(report, null, 2),
    );

    const issueCount = report.shots.reduce(
      (sum, shot) => sum + shot.issues.length,
      0,
    );
    console.log(
      `UI verify complete: ${report.shots.length} screenshots, ${issueCount} issues`,
    );
    for (const shot of report.shots) {
      if (shot.issues.length) {
        console.log(shot.file, JSON.stringify(shot.issues));
      }
    }
    const compact = report.shots.find((shot) => shot.viewport === "compact");
    if (compact) {
      console.log("compact rail sample:", JSON.stringify(compact.rail));
    }
    const records = report.shots.find(
      (shot) => shot.view === "记录" && shot.viewport === "desktop",
    );
    if (records) {
      console.log("records scroll sample:", JSON.stringify(records.scroll));
    }
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    browser.kill();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
