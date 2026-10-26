const http = require("http");
const fs = require("fs");
const path = require("path");

const DEBUG_PORT = process.argv[2] || "8315";
const WANT_SHOT = process.argv[3] === "shot";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

async function main() {
  let target;
  for (let i = 0; i < 60; i += 1) {
    try {
      const targets = await getJson(
        `http://127.0.0.1:${DEBUG_PORT}/json/list`,
      );
      target = targets.find((item) => item.type === "page");
      if (target) break;
    } catch {
      // not up yet
    }
    await sleep(250);
  }
  if (!target) throw new Error("CDP page target not found");

  const ws = new WebSocket(target.webSocketDebuggerUrl);
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
        result.result.exceptionDetails.text || "Runtime.evaluate failed",
      );
    }
    return result.result?.result?.value;
  };

  await send("Runtime.enable");
  for (let i = 0; i < 40; i += 1) {
    if (await evaluate("!!document.querySelector('.app-shell')")) break;
    await sleep(250);
  }

  await evaluate(`(() => {
    const button = [...document.querySelectorAll('.nav-list button')]
      .find((el) => el.textContent.replace(/\\s+/g, ' ').trim() === 'AI 助手');
    if (button) button.click();
    return !!button;
  })()`);

  for (let i = 0; i < 40; i += 1) {
    if (await evaluate("!!document.querySelector('.ai-messages')")) break;
    await sleep(250);
  }
  await sleep(500);

  const audit = await evaluate(`(async () => {
    const content = document.querySelector('.content-ai');
    const page = document.querySelector('.content-ai .page');
    const panel = document.querySelector('.ai-chat-panel');
    const messages = document.querySelector('.ai-messages');
    const composer = document.querySelector('.ai-composer');
    const grid = document.querySelector('.ai-grid');
    const side = document.querySelector('.ai-side');
    if (!content || !page || !panel || !messages || !composer) {
      return {
        ready: false,
        missing: {
          content: !!content,
          page: !!page,
          panel: !!panel,
          messages: !!messages,
          composer: !!composer,
        },
      };
    }

    const before = {
      panelWidth: Math.round(panel.getBoundingClientRect().width),
      sideWidth: side ? Math.round(side.getBoundingClientRect().width) : null,
      gridWidth: grid ? Math.round(grid.getBoundingClientRect().width) : null,
      contentWidth: Math.round(content.getBoundingClientRect().width),
    };
    const long = 'A'.repeat(2400) + '\\n\\n长消息'.repeat(400);
    const userMessage = document.createElement('div');
    userMessage.className = 'ai-message user';
    userMessage.innerHTML =
      '<div class="ai-body"><p class="ai-content">' + long + '</p></div>';
    messages.appendChild(userMessage);
    const message = document.createElement('div');
    message.className = 'ai-message';
    message.innerHTML =
      '<span class="ai-avatar">AI</span>' +
      '<div class="ai-body"><p class="ai-content">' + long + '</p></div>';
    messages.appendChild(message);
    await new Promise((resolve) => setTimeout(resolve, 120));
    const after = {
      panelWidth: Math.round(panel.getBoundingClientRect().width),
      sideWidth: side ? Math.round(side.getBoundingClientRect().width) : null,
      gridWidth: grid ? Math.round(grid.getBoundingClientRect().width) : null,
      contentWidth: Math.round(content.getBoundingClientRect().width),
    };

    const messagesStyle = getComputedStyle(messages);
    const composerRect = composer.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();
    const messagesRect = messages.getBoundingClientRect();
    const overflow = document.documentElement.scrollHeight >
      document.documentElement.clientHeight + 1;
    const result = {
      ready: true,
      messagesOverflowY: messagesStyle.overflowY,
      messagesFlex: messagesStyle.flex,
      messagesMinHeight: messagesStyle.minHeight,
      messagesScrolls: messages.scrollHeight > messages.clientHeight + 1,
      composerInside: composerRect.bottom <= contentRect.bottom + 1 &&
        composerRect.top >= messagesRect.bottom - 1,
      pageOverflow: overflow,
      widthShrink: after.panelWidth < before.panelWidth - 1,
      before,
      after,
      hasBubble: !!document.querySelector('.ai-bubble'),
      aiBodyCount: document.querySelectorAll('.ai-body').length,
      contentWidth: Math.round(
        document.querySelector('.ai-content').getBoundingClientRect().width,
      ),
    };
    return result;
  })()`);

  if (WANT_SHOT) {
    fs.mkdirSync(path.join(process.cwd(), ".ui-snapshots"), { recursive: true });
    const shot = await send("Page.captureScreenshot", { format: "png" });
    const file = path.join(
      process.cwd(),
      ".ui-snapshots",
      "ai-verify.png",
    );
    fs.writeFileSync(file, Buffer.from(shot.result.data, "base64"));
    console.log("shot:", file);
  }
  await evaluate(`(() => {
    [...document.querySelectorAll('.ai-message')].forEach((el) => el.remove());
    return true;
  })()`);

  console.log("CDP verify:", JSON.stringify(audit, null, 2));
  const ok =
    audit.ready &&
    audit.messagesOverflowY === "auto" &&
    audit.messagesScrolls &&
    audit.composerInside &&
    !audit.pageOverflow &&
    !audit.hasBubble;
  if (!ok) process.exitCode = 1;
  ws.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
