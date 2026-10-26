const { spawn } = require("child_process");
const http = require("http");

const EDGE =
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const DEBUG_PORT = 8316;
const BASE_URL = process.argv[2] || "http://localhost:1420/?demo=1";
const PROFILE_DIR = `${process.cwd()}\\.ui-edge-resize-profile`;

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
        "document.readyState === 'complete' && !!document.querySelector('.content-today')",
      );
      if (ready) break;
      await sleep(250);
    }
    await sleep(900);

    const sizes = [
      { name: "maximized", width: 1920, height: 1040 },
      { name: "restored-large", width: 1180, height: 760 },
      { name: "restored-720", width: 1280, height: 720 },
      { name: "restored-640", width: 960, height: 640 },
      { name: "maximized-again", width: 1920, height: 1040 },
      { name: "restored-large-again", width: 1180, height: 760 },
    ];

    const report = [];
    for (const size of sizes) {
      await send("Emulation.setDeviceMetricsOverride", {
        width: size.width,
        height: size.height,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await sleep(180);
      const metrics = await evaluate(`(() => {
        const content = document.querySelector(".content-today");
        const page = content?.querySelector(".page");
        const entry = content?.querySelector(".entry-panel");
        const energy = content?.querySelector(".energy-panel");
        const goal = content?.querySelector(".goal-panel");
        const week = content?.querySelector(".week-panel");
        const trendBody = week?.querySelector(".trend-body");
        const sparkline = week?.querySelector(".sparkline");
        const stats = content?.querySelector(".stat-grid");
        const form = content?.querySelector(".entry-form");
        const entrySide = content?.querySelector(".entry-side");
        const stack = content?.querySelector(".dashboard-stack");
        const grid = content?.querySelector(".dashboard-grid");
        const cr = content?.getBoundingClientRect();
        const pr = page?.getBoundingClientRect();
        const er = entry?.getBoundingClientRect();
        const enr = energy?.getBoundingClientRect();
        const gr = goal?.getBoundingClientRect();
        const wr = week?.getBoundingClientRect();
        const str = stack?.getBoundingClientRect();
        const grd = grid?.getBoundingClientRect();
        const tr = trendBody?.getBoundingClientRect();
        const spr = sparkline?.getBoundingClientRect();
        const sr = stats?.getBoundingClientRect();
        const fr = form?.getBoundingClientRect();
        const esr = entrySide?.getBoundingClientRect();
        const fieldRects = entry
          ? [...entry.querySelectorAll(".field, .form-actions, .form-foot")]
              .map((el) => {
                const r = el.getBoundingClientRect();
                return [
                  String(el.className).slice(0, 26),
                  Math.round(r.top),
                  Math.round(r.bottom),
                  Math.round(r.height),
                ];
              })
          : [];
        const sideRects = energy
          ? [...energy.querySelectorAll(".entry-side-head, .entry-energy-grid, .entry-prediction")]
              .map((el) => {
                const r = el.getBoundingClientRect();
                return [
                  String(el.className).slice(0, 26),
                  Math.round(r.top),
                  Math.round(r.bottom),
                  Math.round(r.height),
                ];
              })
          : [];
        const weekStyle = week ? getComputedStyle(week) : null;
        return {
          inner: [window.innerWidth, window.innerHeight],
          contentScroll: [content.scrollHeight, content.clientHeight],
          contentRect: cr ? [cr.top, cr.bottom, cr.height] : null,
          pageRect: pr ? [pr.top, pr.bottom, pr.height] : null,
          entryRect: er ? [er.top, er.bottom, er.height] : null,
          entryWidth: er ? Math.round(er.width) : null,
          entryScroll: entry ? [entry.scrollHeight, entry.clientHeight] : null,
          energyRect: enr ? [enr.top, enr.bottom, enr.height] : null,
          energyWidth: enr ? Math.round(enr.width) : null,
          energyScroll: energy ? [energy.scrollHeight, energy.clientHeight] : null,
          formRect: fr ? [fr.top, fr.bottom, fr.height] : null,
          entrySideRect: esr ? [esr.top, esr.bottom, esr.height] : null,
          fieldRects,
          sideRects,
          goalRect: gr ? [gr.top, gr.bottom, gr.height] : null,
          goalWidth: gr ? Math.round(gr.width) : null,
          goalScroll: goal ? [goal.scrollHeight, goal.clientHeight] : null,
          weekRect: wr ? [wr.top, wr.bottom, wr.height] : null,
          weekWidth: wr ? Math.round(wr.width) : null,
          stackRect: str
            ? [Math.round(str.left), Math.round(str.right), Math.round(str.width), Math.round(str.top), Math.round(str.bottom), Math.round(str.height)]
            : null,
          gridRect: grd
            ? [Math.round(grd.left), Math.round(grd.right), Math.round(grd.width), Math.round(grd.top), Math.round(grd.bottom), Math.round(grd.height)]
            : null,
          weekScroll: week ? [week.scrollHeight, week.clientHeight] : null,
          trendBodyRect: tr ? [tr.top, tr.bottom, tr.height] : null,
          sparklineRect: spr ? [spr.top, spr.bottom, spr.height] : null,
          statsRect: sr ? [sr.top, sr.bottom, sr.height] : null,
          leftDeadSpace:
            fr && esr ? Math.round(esr.top - fr.bottom) : null,
          entryEnergyGap:
            er && enr ? Math.round(enr.top - er.bottom) : null,
          rightSplitGap:
            gr && wr ? Math.round(wr.top - gr.bottom) : null,
          topRowDelta:
            er && gr
              ? [Math.round(er.top - gr.top), Math.round(er.bottom - gr.bottom)]
              : null,
          bottomRowDelta:
            enr && wr
              ? [
                  Math.round(enr.top - wr.top),
                  Math.round(enr.bottom - wr.bottom),
                ]
              : null,
          topAligned:
            er && str ? Math.round(er.top - str.top) : null,
          bottomAligned:
            er && str ? Math.round(er.bottom - str.bottom) : null,
          overflowStyle: getComputedStyle(content).overflow,
          clipped:
            content.scrollHeight > content.clientHeight + 1 &&
            getComputedStyle(content).overflow === "hidden",
          curveClipped:
            week && spr && weekStyle
              ? spr.bottom > wr.bottom - parseFloat(weekStyle.paddingBottom)
              : null,
          entryClipped:
            entry
              ? entry.scrollHeight > entry.clientHeight + 1
              : null,
          energyClipped:
            energy
              ? energy.scrollHeight > energy.clientHeight + 1
              : null,
          goalClipped:
            goal ? goal.scrollHeight > goal.clientHeight + 1 : null,
        };
      })()`);
      report.push({ name: size.name, ...metrics });
    }

    console.log(JSON.stringify(report, null, 2));
  } finally {
    browser.kill();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
