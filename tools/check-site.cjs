/* 站点自检：静态结构 + 真实浏览器回归（无第三方依赖）
 *
 * 用法：
 *   node tools/check-site.cjs            静态 + 浏览器
 *   node tools/check-site.cjs --static   只跑静态检查（CI/没装浏览器时）
 *   node tools/check-site.cjs --browser  只跑浏览器回归
 *
 * 静态：站内链接与深链、重复 id、description/OG、标题唯一性、nav.js 与实际页面及小节标题一致、
 *       首页分组卡与 nav 组名对齐、发布入口与元文件（根跳转页 / 404 / robots / .nojekyll / favicon / Pages 工作流）
 * 浏览器：headless Edge/Chrome + CDP，验证 skip link、aria-current、抽屉 Esc 与焦点回收、
 *        搜索播报、页内 Tab 键盘、页面级方向键不抢键、reduced-motion、390/1200 横向溢出、
 *        阅读偏好（字号/宽度/换行/目录精简）、学习闭环（练习快照/读完时间/复习/导出导入）
 *
 * 退出码：0 全过；1 有失败；2 工具本身出错（例如找不到浏览器）
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const vm = require("vm");
const http = require("http");
const { spawn } = require("child_process");
const { pathToFileURL } = require("url");

const ROOT = path.resolve(__dirname, "..");
const SITE = path.join(ROOT, "agentscope-java-learn");
const ASSETS = path.join(SITE, "assets");
const NAV = path.join(ASSETS, "nav.js");
const INDEX = path.join(ASSETS, "search-index.js");

const args = process.argv.slice(2);
const staticOnly = args.includes("--static");
const browserOnly = args.includes("--browser");

const results = { static: [], browser: [] };
function check(scope, name, ok, detail) {
  results[scope].push({ name, ok: !!ok, detail });
  console.log((ok ? "PASS " : "FAIL ") + name + (detail === undefined ? "" : "  :: " + detail));
}
function warn(msg) {
  console.log("WARN " + msg);
}

/* ---------- 文件遍历 ---------- */

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith(".html")) out.push(p);
  }
  return out;
}

const pages = walk(SITE)
  // 404 是发布用的兜底页（自包含、不参与导航与搜索索引），单独在检查 7 里验证
  .filter((p) => path.basename(p) !== "404.html")
  .sort();
const rel = (p) => path.relative(SITE, p).replace(/\\/g, "/");

const ENTITY_MAP = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&hellip;": "…",
  "&rarr;": "→",
};
function plain(html) {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z#0-9]+;/gi, (m) => (m in ENTITY_MAP ? ENTITY_MAP[m] : m))
    .replace(/\s+/g, " ")
    .trim();
}

/* ---------- 静态检查 ---------- */

function loadNav() {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(NAV, "utf8"), sandbox);
  return sandbox.window.AS_SITE;
}

function staticChecks() {
  const ids = new Map();
  for (const f of pages) {
    const html = fs.readFileSync(f, "utf8");
    const set = new Set();
    for (const m of html.matchAll(/\sid="([^"]+)"/g)) set.add(m[1]);
    ids.set(f, set);
  }

  // 1 站内链接与深链
  let links = 0;
  const broken = [];
  for (const f of pages) {
    const html = fs.readFileSync(f, "utf8");
    for (const m of html.matchAll(/(?<![-\w])(?:href|src)="([^"]+)"/g)) {
      const u = m[1];
      if (/^(https?:|mailto:|data:|javascript:)/.test(u)) continue;
      if (u.startsWith("#")) {
        links++;
        if (u !== "#" && !ids.get(f).has(u.slice(1))) broken.push(rel(f) + " -> " + u);
        continue;
      }
      const [filePart, hash] = u.split("#");
      if (!filePart) continue;
      links++;
      const target = path.resolve(path.dirname(f), filePart);
      if (!fs.existsSync(target)) {
        broken.push(rel(f) + " -> " + u);
        continue;
      }
      if (hash && ids.has(target) && !ids.get(target).has(hash)) broken.push(rel(f) + " -> " + u);
    }
  }
  check("static", "站内链接与深链", broken.length === 0, links + " 个，失效 " + broken.length);
  broken.slice(0, 20).forEach((b) => console.log("      " + b));

  // 2 重复 id
  const dups = [];
  for (const [f, set] of ids) {
    const html = fs.readFileSync(f, "utf8");
    const seen = {};
    for (const m of html.matchAll(/\sid="([^"]+)"/g)) seen[m[1]] = (seen[m[1]] || 0) + 1;
    for (const k in seen) if (seen[k] > 1) dups.push(rel(f) + " #" + k + " x" + seen[k]);
  }
  check("static", "页面内 id 唯一", dups.length === 0, dups.length ? dups.slice(0, 10).join("; ") : pages.length + " 页无重复");

  // 3 description / OG / 标题
  const descSeen = new Map();
  const titleSeen = new Map();
  const metaBad = [];
  for (const f of pages) {
    const html = fs.readFileSync(f, "utf8");
    const d = html.match(/<meta\s+name="description"\s+content="([^"]*)"/s);
    const og = (html.match(/property="og:/g) || []).length;
    const t = html.match(/<title>([\s\S]*?)<\/title>/);
    if (!d || d[1].length < 40 || d[1].length > 200 || !/。[」）]?$/.test(d[1])) {
      metaBad.push(rel(f) + " description");
    }
    if (og !== 5) metaBad.push(rel(f) + " og=" + og);
    if (!t) metaBad.push(rel(f) + " title");
    if (d) {
      if (descSeen.has(d[1])) metaBad.push(rel(f) + " description 与 " + descSeen.get(d[1]) + " 重复");
      else descSeen.set(d[1], rel(f));
    }
    if (t) {
      if (titleSeen.has(t[1])) metaBad.push(rel(f) + " title 与 " + titleSeen.get(t[1]) + " 重复");
      else titleSeen.set(t[1], rel(f));
    }
  }
  check("static", "description / OG / 标题", metaBad.length === 0, metaBad.length ? metaBad.slice(0, 10).join("; ") : pages.length + " 页齐全且互不重复");

  // 4 表格必须包在 .table-wrap 里：窄屏靠它横向滚动，漏包会把整页撑宽（18 章踩过）
  const bare = [];
  for (const f of pages) {
    const html = fs.readFileSync(f, "utf8");
    for (const m of html.matchAll(/<table\b/g)) {
      const before = html.slice(Math.max(0, m.index - 240), m.index);
      if (!/class="table-wrap"[^>]*>\s*$/.test(before)) {
        bare.push(rel(f) + ":" + html.slice(0, m.index).split("\n").length);
      }
    }
  }
  check("static", "表格都包在 table-wrap 里", bare.length === 0, bare.length ? bare.slice(0, 10).join("; ") : "全部可横向滚动");

  // 5 nav.js 与实际页面一致
  const AS = loadNav();
  const flat = [];
  AS.groups.forEach((g) => g.items.forEach((it) => flat.push(Object.assign({ group: g.title }, it))));
  const navBad = [];
  const known = new Set();
  for (const it of flat) {
    if (it.status === "later") continue;
    known.add(it.href);
    if (!fs.existsSync(path.join(SITE, it.href))) navBad.push("nav 指向缺失页面 " + it.href);
  }
  for (const f of pages) {
    const r = rel(f);
    if (r !== "index.html" && !known.has(r)) navBad.push("页面未进 nav.js " + r);
  }
  const ready = flat.filter((x) => x.status === "ready").length;
  check("static", "nav.js 与实际页面一致", navBad.length === 0, flat.length + " 条目录，" + ready + " 条 ready");
  navBad.slice(0, 10).forEach((b) => console.log("      " + b));

  // 5a nav 里的 sections 是搜索索引与页内 TOC 的唯一来源；标题改名却漏改 nav 时，
  // 页面能打开，但 TOC 与搜索会继续显示旧标题。这里逐条比对 id 与纯文本标题。
  const sectionBad = [];
  for (const it of flat) {
    if (it.status !== "ready" || !Array.isArray(it.sections) || !it.sections.length) continue;
    const html = fs.readFileSync(path.join(SITE, it.href), "utf8");
    const found = new Map();
    for (const m of html.matchAll(/<h2\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/g)) {
      found.set(m[1], plain(m[2]));
    }
    for (const s of it.sections) {
      const id = Array.isArray(s) ? s[0] : s.id;
      const title = Array.isArray(s) ? s[1] : s.title;
      if (!found.has(id)) {
        sectionBad.push(it.href + ": nav 小节 #" + id + " 在页面上不存在");
      } else if (plain(title) !== found.get(id)) {
        sectionBad.push(it.href + ": #" + id + " nav=「" + title + "」 page=「" + found.get(id) + "」");
      }
    }
    for (const id of found.keys()) {
      if (!it.sections.some((s) => (Array.isArray(s) ? s[0] : s.id) === id)) {
        sectionBad.push(it.href + ": 页面小节 #" + id + " 未进 nav");
      }
    }
  }
  check(
    "static",
    "nav 小节标题与页面 h2 一致",
    sectionBad.length === 0,
    sectionBad.length ? sectionBad.length + " 条不一致" : flat.length + " 条目录逐项对齐"
  );
  sectionBad.slice(0, 10).forEach((b) => console.log("      " + b));

  // 5b 首页卡片位与 nav 组名对齐：组名重复会让同名组被渲染两次，
  // 卡片位的 data-cards 写错则整组静默消失（site.js 找不到组就渲染空）。
  const groupBad = [];
  const titles = AS.groups.map((g) => g.title);
  titles.forEach((t, i) => {
    if (titles.indexOf(t) !== i) groupBad.push("nav 组名重复：" + t);
  });
  const indexHtml = fs.readFileSync(path.join(SITE, "index.html"), "utf8");
  for (const m of indexHtml.matchAll(/data-cards="([^"]+)"/g)) {
    if (m[1] !== "all" && titles.indexOf(m[1]) === -1) groupBad.push("首页 data-cards 指向不存在的组：" + m[1]);
  }
  AS.groups.forEach((g) => {
    if (!indexHtml.includes('data-cards="' + g.title + '"')) groupBad.push("nav 组没有首页卡片位：" + g.title);
  });
  check(
    "static",
    "首页分组卡与 nav 组名对齐",
    groupBad.length === 0,
    groupBad.length ? groupBad.join("; ") : titles.length + " 组全部有卡片位"
  );
  groupBad.slice(0, 10).forEach((b) => console.log("      " + b));

  // 6 搜索索引新鲜度（只警告，不算失败）
  const newestHtml = pages.reduce((a, f) => Math.max(a, fs.statSync(f).mtimeMs), 0);
  const idxMtime = fs.existsSync(INDEX) ? fs.statSync(INDEX).mtimeMs : 0;
  if (!idxMtime) warn("缺少 assets/search-index.js，请运行 node tools/build-search-index.cjs");
  else if (idxMtime < newestHtml) warn("搜索索引比页面旧，请运行 node tools/build-search-index.cjs");

  // 7 发布入口与元文件：根跳转页、404、robots、.nojekyll、favicon、Pages 工作流
  const pubMiss = [];
  const rootIndex = path.join(ROOT, "index.html");
  const notFound = path.join(SITE, "404.html");
  if (!fs.existsSync(rootIndex)) pubMiss.push("缺仓库根 index.html");
  else if (!/agentscope-java-learn\/index\.html/.test(fs.readFileSync(rootIndex, "utf8")))
    pubMiss.push("根 index.html 没有指向站点");
  if (!fs.existsSync(notFound)) pubMiss.push("缺 404.html");
  else {
    const h = fs.readFileSync(notFound, "utf8");
    if (!/<meta name="robots" content="noindex"/.test(h)) pubMiss.push("404 缺 noindex");
    ["index.html", "chapters/00-study-map.html", "appendix/errors.html"].forEach((u) => {
      if (!h.includes('data-rel="' + u + '"')) pubMiss.push("404 缺入口 " + u);
      if (!fs.existsSync(path.join(SITE, u))) pubMiss.push("404 入口指向缺失文件 " + u);
    });
  }
  if (!fs.existsSync(path.join(SITE, "robots.txt"))) pubMiss.push("缺 robots.txt");
  if (!fs.existsSync(path.join(SITE, ".nojekyll"))) pubMiss.push("缺 .nojekyll");
  if (!fs.existsSync(path.join(ASSETS, "favicon.svg"))) pubMiss.push("缺 favicon.svg");
  const noIcon = pages.filter((f) => !/rel="icon"/.test(fs.readFileSync(f, "utf8")));
  if (noIcon.length) pubMiss.push(noIcon.length + " 页缺 favicon 引用");
  const wf = path.join(ROOT, ".github", "workflows", "deploy-pages.yml");
  if (!fs.existsSync(wf)) pubMiss.push("缺 Pages 工作流");
  else if (!/path:\s*agentscope-java-learn/.test(fs.readFileSync(wf, "utf8")))
    pubMiss.push("工作流未发布 agentscope-java-learn");
  check(
    "static",
    "发布入口与元文件齐全",
    pubMiss.length === 0,
    pubMiss.length ? pubMiss.join("; ") : "根入口 / 404 / robots / .nojekyll / favicon / 工作流"
  );
}

/* ---------- 浏览器回归 ---------- */

function findBrowser() {
  const cands = [
    process.env.EDGE_PATH,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ].filter(Boolean);
  return cands.find((p) => fs.existsSync(p)) || null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getJSON(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let b = "";
        res.on("data", (c) => (b += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(b));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

async function browserChecks() {
  const edge = findBrowser();
  if (!edge) {
    check("browser", "找到 Edge/Chrome", false, "可用 EDGE_PATH 指定");
    return;
  }

  const port = 9420 + Math.floor(Math.random() * 200);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "as-check-"));
  const proc = spawn(
    edge,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--allow-file-access-from-files",
      "--remote-debugging-port=" + port,
      "--user-data-dir=" + profile,
      "--no-first-run",
      "--no-default-browser-check",
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  let ws;
  try {
    let version = null;
    for (let i = 0; i < 80; i++) {
      try {
        version = await getJSON("http://127.0.0.1:" + port + "/json/version");
        break;
      } catch (e) {
        await sleep(200);
      }
    }
    if (!version) throw new Error("DevTools 端口没有起来");

    ws = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = rej;
    });
    let seq = 0;
    const pending = new Map();
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? p.rej(new Error(JSON.stringify(msg.error))) : p.res(msg.result);
      }
    };
    const send = (method, params, sessionId) =>
      new Promise((res, rej) => {
        const id = ++seq;
        pending.set(id, { res, rej });
        ws.send(JSON.stringify({ id, method, params: params || {}, sessionId }));
      });

    const { targetId } = await send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    await send("Page.enable", {}, sessionId);
    await send("Runtime.enable", {}, sessionId);

    const ev = async (expr) => {
      const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }, sessionId);
      if (r.exceptionDetails) throw new Error("evaluate: " + JSON.stringify(r.exceptionDetails).slice(0, 300));
      return r.result.value;
    };
    const viewport = (width, height, mobile) =>
      send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile }, sessionId);
    const goto = async (file, width, height, mobile, settle = 700) => {
      await viewport(width, height, mobile);
      await send("Page.navigate", { url: pathToFileURL(file).href }, sessionId);
      for (let i = 0; i < 40; i++) {
        if ((await ev("document.readyState")) === "complete") break;
        await sleep(100);
      }
      await sleep(settle);
    };

    const p02 = path.join(SITE, "chapters", "02-first-agent.html");

    // A 桌面：skip link / aria-current / 搜索/ Tab / 方向键 / 主题 / reduced-motion
    await goto(p02, 1200, 900, false, 1200);
    const skip = await ev(
      `(function(){var a=document.querySelector('.skip-link');if(!a)return 'no-skip';
        var before=a.getBoundingClientRect().top;a.focus();
        return new Promise(function(res){setTimeout(function(){
          var after=a.getBoundingClientRect().top,m=document.getElementById('main');
          res([a.textContent,a.getAttribute('href'),Math.round(before),Math.round(after),m?m.getAttribute('tabindex'):''].join('|'));
        },300);});})()`
    );
    check(
      "browser",
      "skip link 聚焦可见且指向 main#main",
      /^跳到正文\|#main\|-\d+\|\d+\|-1$/.test(String(skip)),
      skip
    );
    const skipNav = await ev(
      `(function(){document.querySelector('.skip-link').click();var m=document.getElementById('main');
        return location.hash+'|'+(document.activeElement===m);})()`
    );
    check("browser", "skip link 回车落到正文", skipNav === "#main|true", skipNav);

    const cur = await ev(
      `(function(){var n=document.querySelectorAll('#sidebar a[aria-current="page"]');
        return n.length+'|'+(document.querySelector('#sidebar').getAttribute('aria-label')||'');})()`
    );
    check("browser", "侧栏当前章 aria-current=page", /^1\|.+$/.test(String(cur)), cur);
    const tocCur = await ev(
      `(function(){var n=document.querySelectorAll('#toc a[aria-current="location"]');
        return n.length+'|'+(document.querySelector('#toc').getAttribute('aria-label')||'');})()`
    );
    check("browser", "TOC 激活项 aria-current=location", /^[1-9]\d*\|.+$/.test(String(tocCur)), tocCur);

    const readTime = await ev(
      `(function(){var n=document.querySelector('.read-time');return n?n.textContent.replace(/\\s+/g,' ').trim():'none';})()`
    );
    check("browser", "章节显示预计阅读时间", /^预计阅读 \d+ 分钟$/.test(String(readTime)), readTime);

    const search = await ev(
      `(function(){var q=document.getElementById('q');q.focus();q.value='权限';
        q.dispatchEvent(new Event('input',{bubbles:true}));
        return new Promise(function(res){setTimeout(function(){
          var st=document.getElementById('search-status').textContent;
          var open=document.getElementById('search-results').classList.contains('open');
          q.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
          setTimeout(function(){res([st,open,q.getAttribute('aria-expanded'),document.getElementById('search-status').textContent].join('|'));},150);
        },800);});})()`
    );
    check(
      "browser",
      "搜索有结果并读屏播报，Esc 收起",
      /^找到 \d+ 条结果.*\|true\|false\|$/.test(String(search)),
      search
    );

    const tabs = await ev(
      `(function(){var tabs=[].slice.call(document.querySelectorAll('.article [role="tab"]'));if(tabs.length<2)return 'no-tabs';
        var idx=function(){return tabs.findIndex(function(x){return x.getAttribute('aria-selected')==='true';});};
        var before=idx();tabs[0].focus();var path=location.pathname;
        tabs[0].dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
        return new Promise(function(res){setTimeout(function(){
          var after=idx();res([before,after,document.activeElement===tabs[after],path===location.pathname].join('|'));
        },150);});})()`
    );
    check("browser", "页内 Tab 左右键切换且不跳章", /^0\|1\|true\|true$/.test(String(tabs)), tabs);

    const arrow = await ev(
      `(function(){var b=document.getElementById('theme-toggle');b.focus();var h=location.href;
        b.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
        return new Promise(function(res){setTimeout(function(){res((location.href===h)+'|'+b.getAttribute('aria-pressed'));},150);});})()`
    );
    check("browser", "按钮上方向键不触发章节跳转", /^true\|/.test(String(arrow)), arrow);
    const pressed = await ev(
      `(function(){var b=document.getElementById('theme-toggle');var a=b.getAttribute('aria-pressed');b.click();
        return a+'->'+b.getAttribute('aria-pressed');})()`
    );
    check("browser", "主题按钮 aria-pressed 跟随状态", /^(true->false|false->true)$/.test(String(pressed)), pressed);

    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] }, sessionId);
    const rm = await ev("getComputedStyle(document.documentElement).scrollBehavior");
    check("browser", "prefers-reduced-motion 下滚动为 auto", rm === "auto", rm);
    await send("Emulation.setEmulatedMedia", { features: [] }, sessionId);

    const ovD = await ev("document.documentElement.scrollWidth + '|' + document.documentElement.clientWidth");
    check(
      "browser",
      "1200px 无页面级横向溢出",
      Number(String(ovD).split("|")[0]) <= Number(String(ovD).split("|")[1]),
      ovD
    );

    // A2 阅读设置：字号/宽度/代码换行/目录精简，以及进度条
    const firstFocus = await ev(
      `(function(){var a=document.querySelector('.skip-link');
        var list=[].slice.call(document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]'));
        return (list.indexOf(a)===0)+'|'+(list[0]?(list[0].className||list[0].id):'none');})()`
    );
    check("browser", "skip link 排在所有可聚焦元素之前", /^true\|/.test(String(firstFocus)), firstFocus);

    const read = await ev(
      `(function(){var t=document.getElementById('read-toggle'),p=document.getElementById('read-panel');
        var hidden0=p.hidden;t.click();
        var opened=[hidden0===true,p.hidden===false,t.getAttribute('aria-expanded'),document.activeElement===p].join('|');
        var s0=parseFloat(getComputedStyle(document.body).fontSize);
        p.querySelector('[data-size="l"]').click();
        var s1=parseFloat(getComputedStyle(document.body).fontSize);
        var h=parseFloat(getComputedStyle(document.querySelector('.article h1')).fontSize);
        p.querySelector('[data-width="wide"]').click();
        var cb=document.getElementById('code-wrap');cb.checked=true;
        cb.dispatchEvent(new Event('change',{bubbles:true}));
        var wrap=getComputedStyle(document.querySelector('.article pre')).whiteSpace;
        var r=document.documentElement;
        var st=[r.getAttribute('data-read-size'),r.getAttribute('data-read-width'),r.getAttribute('data-code-wrap')].join('|');
        document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
        var closed=[p.hidden,document.activeElement===t].join('|');
        return [opened,Math.round(s0)+'<'+Math.round(s1),Math.round(h),st,wrap,closed].join(' / ');})()`
    );
    check(
      "browser",
      "阅读设置：字号/加宽/换行生效，Esc 关面板",
      /^true\|true\|true\|true \/ 16<17 \/ 3[56] \/ l\|wide\|on \/ pre-wrap \/ true\|true$/.test(String(read)),
      read
    );

    // 右侧目录只在 >1280 可见，换个宽屏才测得到「精简」的真实隐藏效果
    await viewport(1440, 900, false);
    await sleep(150);
    const compact = await ev(
      `(function(){var tc=document.getElementById('toc-compact');if(!tc)return 'no-compact';
        var li=document.querySelector('#toc li.toc-sub');
        var before=li?getComputedStyle(li).display:'no-sub';
        tc.click();
        var after=li?getComputedStyle(li).display:'no-sub';
        return [before,after,document.documentElement.getAttribute('data-toc'),tc.getAttribute('aria-pressed')].join('|');})()`
    );
    check("browser", "目录精简只留二级标题", /^(list-item|block)\|none\|compact\|true$/.test(String(compact)), compact);

    // 导航到无 h3 的章节：既验证侧栏自动定位，也确认不出现无效的「精简」开关
    await send(
      "Page.navigate",
      { url: pathToFileURL(path.join(SITE, "chapters", "36-infrastructure-ecosystem.html")).href },
      sessionId
    );
    await sleep(250);
    const sideCur = await ev(
      `(function(){var n=document.getElementById('sidebar');if(!n)return 'no-sidebar';
        var c=n.querySelector('a.current');if(!c)return 'no-current';
        var nr=n.getBoundingClientRect(),cr=c.getBoundingClientRect();
        return (cr.top>=nr.top&&cr.bottom<=nr.bottom)?'ok':[cr.top,cr.bottom,nr.top,nr.bottom].join('|');})()`
    );
    check("browser", "侧栏自动定位当前章", sideCur === "ok", sideCur);

    const noCompact = await ev(
      `document.getElementById('toc-compact')?'found':'none'`
    );
    check("browser", "无 h3 页面不显示精简按钮", noCompact === "none", noCompact);

    // XML 高亮：属性替换不能把刚插入的 <span class="tk-k"> 再当成属性改写
    await send(
      "Page.navigate",
      { url: pathToFileURL(path.join(SITE, "chapters", "01-setup.html")).href },
      sessionId
    );
    await sleep(250);
    const hl = await ev(
      `(function(){var p=document.querySelector('pre[data-lang="xml"]');if(!p)return 'no-xml';
        var h=p.innerHTML;
        if(h.indexOf('class=tk-k')>-1||h.indexOf('<span <span')>-1||h.indexOf('tk-a">class')>-1)return 'bad';
        return h.indexOf('tk-k')>-1?'ok':'no-highlight';})()`
    );
    check("browser", "代码高亮不破坏 XML 标签", hl === "ok", hl);

    await send(
      "Page.navigate",
      { url: pathToFileURL(path.join(SITE, "chapters", "00a-agent-flow.html")).href },
      sessionId
    );
    await sleep(250);
    const flow = await ev(
      `(function(){var step=document.getElementById('fd-step');if(!step)return 'no-demo';
        var before=step.textContent;
        document.querySelector('[data-scenario="harness"]').click();
        var l2=document.querySelectorAll('.fd-node').length;
        document.querySelector('[data-scenario="full"]').click();
        var after=step.textContent;
        var l3=document.querySelectorAll('.fd-node').length;
        document.getElementById('fd-next').click();
        return [before,l2,after,l3,step.textContent].join('|');})()`
    );
    check(
      "browser",
      "信息流实验室可切换场景与步进",
      /^第 1 \/ 9 步\|14\|第 1 \/ 22 步\|22\|第 2 \/ 22 步$/.test(String(flow)),
      flow
    );

    await send("Page.navigate", { url: pathToFileURL(p02).href }, sessionId);
    await sleep(250);

    await viewport(1200, 900, false);

    const prog = await ev(
      `(function(){var b=document.getElementById('read-progress');if(!b)return 'no-bar';
        document.documentElement.style.scrollBehavior='auto';
        window.scrollTo(0,document.documentElement.scrollHeight);
        return new Promise(function(res){setTimeout(function(){
          var out=[!b.hidden,b.getAttribute('aria-valuenow'),parseFloat(b.style.width)>=99].join('|');
          window.scrollTo(0,0);document.documentElement.style.scrollBehavior='';res(out);},250);});})()`
    );
    check("browser", "阅读进度条随滚动走到 100%", /^true\|100\|true$/.test(String(prog)), prog);

    const reset = await ev(
      `(function(){document.getElementById('read-reset').click();
        var r=document.documentElement;
        var p=JSON.parse(localStorage.getItem('as-learn-prefs')||'{}');
        return [r.hasAttribute('data-read-size'),r.hasAttribute('data-read-width'),
          r.hasAttribute('data-code-wrap'),r.hasAttribute('data-toc'),
          p.size+'/'+p.width+'/'+p.wrap+'/'+p.toc].join('|');})()`
    );
    check("browser", "恢复默认会清掉全部阅读偏好", reset === "false|false|false|false|m/normal/false/false", reset);

    // B 手机：抽屉与搜索层 Esc、焦点回收、390 溢出
    await viewport(390, 844, true);
    await send("Page.reload", {}, sessionId);
    await sleep(1200);
    const drawers = await ev(
      `(function(){var m=document.getElementById('menu-toggle');m.click();
        var a=document.body.classList.contains('nav-open')+'|'+m.getAttribute('aria-expanded');
        document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
        var b=document.body.classList.contains('nav-open')+'|'+(document.activeElement===m);
        var t=document.getElementById('toc-toggle');t.click();
        var c=document.body.classList.contains('toc-open');
        document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
        var d=document.body.classList.contains('toc-open')+'|'+(document.activeElement===t);
        return [a,b,c,d].join(' / ');})()`
    );
    check("browser", "手机侧栏/目录 Esc 关闭并还焦点", /^true\|true \/ false\|true \/ true \/ false\|true$/.test(String(drawers)), drawers);

    const searchM = await ev(
      `(function(){var t=document.getElementById('search-toggle');t.click();
        var a=document.body.classList.contains('search-open')+'|'+t.getAttribute('aria-expanded')+'|'+(document.activeElement===document.getElementById('q'));
        document.getElementById('q').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
        var b=document.body.classList.contains('search-open')+'|'+t.getAttribute('aria-expanded')+'|'+(document.activeElement===t);
        return a+' / '+b;})()`
    );
    check("browser", "手机搜索层展开/收起并还焦点", /^true\|true\|true \/ false\|false\|true$/.test(String(searchM)), searchM);

    const ovM = await ev("document.documentElement.scrollWidth + '|' + document.documentElement.clientWidth");
    check(
      "browser",
      "390px 无页面级横向溢出",
      Number(String(ovM).split("|")[0]) <= Number(String(ovM).split("|")[1]),
      ovM
    );

    // C 全站 390/1200 溢出与基础语义（全部页面）
    const spill = [];
    const semantic = [];
    for (const f of pages) {
      await goto(f, 390, 844, true, 450);
      const r = await ev(
        `(function(){var d=document.documentElement;
          return [d.scrollWidth,d.clientWidth,!!document.querySelector('.skip-link'),
            document.getElementById('main')?document.getElementById('main').getAttribute('tabindex'):'',
            document.querySelectorAll('#sidebar a[aria-current="page"]').length].join('|');})()`
      );
      const [sw, cw, skip2, tab, current] = String(r).split("|");
      if (Number(sw) > Number(cw)) spill.push(rel(f) + " 390:" + sw + ">" + cw);
      const isIndex = rel(f) === "index.html";
      if (skip2 !== "true" || tab !== "-1" || (!isIndex && current !== "1"))
        semantic.push(rel(f) + " " + r);

      // 不重新加载，直接换成桌面宽度再量一次
      await viewport(1200, 900, false);
      await sleep(120);
      const wide = await ev("document.documentElement.scrollWidth + '|' + document.documentElement.clientWidth");
      const [sw2, cw2] = String(wide).split("|");
      if (Number(sw2) > Number(cw2)) spill.push(rel(f) + " 1200:" + sw2 + ">" + cw2);
    }
    check("browser", pages.length + " 页在 390/1200 下无横向溢出", spill.length === 0, spill.length ? spill.slice(0, 10).join("; ") : "两种宽度各扫 " + pages.length + " 页");
    check("browser", pages.length + " 页 skip link / main / aria-current", semantic.length === 0, semantic.length ? semantic.slice(0, 10).join("; ") : pages.length + " 页通过");

    // D 阅读偏好的极端组合：大字号 + 加宽 + 换行 + 精简，窄屏也不该被撑宽
    await ev(
      `localStorage.setItem('as-learn-prefs', JSON.stringify({size:'l',width:'wide',wrap:true,toc:true}))`
    );
    await goto(p02, 390, 844, true, 900);
    const stress = await ev(
      `(function(){var d=document.documentElement;
        return [d.scrollWidth,d.clientWidth,d.getAttribute('data-read-size'),
          getComputedStyle(document.querySelector('.article pre')).whiteSpace].join('|');})()`
    );
    const [sw3, cw3, size3, wrap3] = String(stress).split("|");
    check(
      "browser",
      "390px 大字号+加宽+换行不撑宽",
      Number(sw3) <= Number(cw3) && size3 === "l" && wrap3 === "pre-wrap",
      stress
    );
    await ev("localStorage.removeItem('as-learn-prefs')");

    // E 学习闭环：练习快照 → 点亮标记 → 读完时间 → 复习提醒 → 首页待办 → 导出/导入/清空
    const LEARN_KEYS = [
      "as-learn-read",
      "as-learn-done",
      "as-learn-review",
      "as-learn-seen",
      "as-learn-ex",
      "as-learn-exmeta",
      "as-learn-last",
    ];
    // reload 过程中执行上下文会被销毁，readyState 探测必须容忍报错
    const waitReady = async () => {
      for (let i = 0; i < 40; i++) {
        try {
          if ((await ev("document.readyState")) === "complete") return true;
        } catch (e) {}
        await sleep(150);
      }
      return false;
    };
    await ev(
      `(function(){${JSON.stringify(LEARN_KEYS)}.forEach(function(k){localStorage.removeItem(k);});return 1;})()`
    );

    await goto(p02, 1200, 900, false, 1000);
    const exStep = await ev(
      `(function(){var cb=document.querySelectorAll('.ex-cb');if(!cb.length)return 'no-ex';
        cb[0].click();
        var m=JSON.parse(localStorage.getItem('as-learn-exmeta')||'{}')['02-first-agent']||{};
        var b=document.getElementById('mark-read');
        return [cb.length,m.total,m.done,b?b.textContent.trim():'no-btn',b?b.className:'-'].join('|');})()`
    );
    check("browser", "练习勾选写入跨页快照", /^4\|4\|1\|标记本章已读完\|icon-btn$/.test(String(exStep)), exStep);

    const exAll = await ev(
      `(function(){var cb=[].slice.call(document.querySelectorAll('.ex-cb'));
        cb.forEach(function(x){if(!x.checked)x.click();});
        var m=JSON.parse(localStorage.getItem('as-learn-exmeta')||'{}')['02-first-agent']||{};
        var b=document.getElementById('mark-read');
        return [m.total,m.done,b.textContent.trim(),b.className].join('|');})()`
    );
    check(
      "browser",
      "练完全部步骤点亮标记读完按钮",
      /^4\|4\|✓ 练习已完成 · 标记本章读完\|icon-btn ready-cta$/.test(String(exAll)),
      exAll
    );

    const marked = await ev(
      `(function(){document.getElementById('mark-read').click();
        var read=JSON.parse(localStorage.getItem('as-learn-read')||'{}');
        var done=JSON.parse(localStorage.getItem('as-learn-done')||'{}');
        var t=done['02-first-agent'];
        var b=document.getElementById('mark-read');
        return [!!read['02-first-agent'],typeof t,(Date.now()-t)<60000,b.textContent.trim()].join('|');})()`
    );
    check(
      "browser",
      "标记读完写入时间戳且按钮即时更新",
      /^true\|number\|true\|✓ 已读完（今天） · 点击撤销$/.test(String(marked)),
      marked
    );

    // 预置成 9 天前读完：应出现复习提示，点「标记已复习」后消失
    await ev(
      `(function(){var t=Date.now()-9*864e5;
        localStorage.setItem('as-learn-read',JSON.stringify({'02-first-agent':true}));
        localStorage.setItem('as-learn-done',JSON.stringify({'02-first-agent':t}));
        localStorage.removeItem('as-learn-review');return 1;})()`
    );
    await goto(p02, 1200, 900, false, 900);
    const hint = await ev(
      `(function(){var h=document.querySelector('.review-hint');var b=document.getElementById('mark-read');
        return [(h?h.textContent.replace(/\\s+/g,' ').trim():'none'),b?b.textContent.trim():'no-btn'].join('|');})()`
    );
    check(
      "browser",
      "读完超过 7 天出现复习提示",
      /^距上次完成已 9 天，建议回看陷阱与速查表标记已复习\|✓ 已读完（9 天前） · 点击撤销$/.test(
        String(hint)
      ),
      hint
    );

    const reviewed = await ev(
      `(function(){var b=document.getElementById('review-done');if(!b)return 'no-btn';b.click();
        var rv=JSON.parse(localStorage.getItem('as-learn-review')||'{}');
        var t=rv['02-first-agent'];
        return new Promise(function(res){setTimeout(function(){
          res([typeof t,(Date.now()-t)<60000,document.querySelectorAll('.review-hint').length,
            document.getElementById('sr-status').textContent].join('|'));},200);});})()`
    );
    check(
      "browser",
      "标记已复习后提示消失并读屏播报",
      /^number\|true\|0\|已标记复习：/.test(String(reviewed)),
      reviewed
    );

    // 首页：一篇练习差 2 步、一篇读完 8 天，待办应同时出现「练习」「复习」
    await ev(
      `(function(){var now=Date.now();
        localStorage.setItem('as-learn-read',JSON.stringify({'02-first-agent':true,'01-setup':true}));
        localStorage.setItem('as-learn-done',JSON.stringify({'02-first-agent':now,'01-setup':now-8*864e5}));
        localStorage.setItem('as-learn-exmeta',JSON.stringify({'02-first-agent':{total:4,done:2}}));
        localStorage.removeItem('as-learn-ex');
        localStorage.removeItem('as-learn-review');
        localStorage.removeItem('as-learn-seen');
        localStorage.removeItem('as-learn-last');return 1;})()`
    );
    await goto(path.join(SITE, "index.html"), 1200, 900, false, 1000);
    const card = await ev(
      `(function(){var box=document.getElementById('progress-card');if(!box)return 'no-card';
        var d=box.querySelector('.pc-data');if(d)d.open=true;
        var tags=[].slice.call(box.querySelectorAll('.pc-task b')).map(function(b){return b.textContent;});
        var texts=[].slice.call(box.querySelectorAll('.pc-task')).map(function(a){return a.textContent.replace(/\\s+/g,'');});
        return [tags.join(','),texts.join(' / '),!!box.querySelector('#pc-export'),
          box.querySelector('.pc-meta').textContent].join('|');})()`
    );
    check(
      "browser",
      "首页待办含练习与复习，进度数据面板可用",
      /^练习,复习\|练习02·还差2步 \/ 复习01·读完8天\|true\|已标记读完 2 篇/.test(String(card)),
      card
    );

    // 导出：headless 下拒绝落盘，只验证内联反馈与读屏播报
    try {
      await send("Browser.setDownloadBehavior", { behavior: "deny" });
    } catch (e) {}
    const exported = await ev(
      `(function(){document.getElementById('pc-export').click();
        var m=document.getElementById('pc-msg');
        return new Promise(function(res){setTimeout(function(){
          res([m.hidden,m.className,m.textContent.trim(),document.getElementById('sr-status').textContent].join('|'));},250);});})()`
    );
    check(
      "browser",
      "导出进度有内联反馈与读屏播报",
      /^false\|pc-confirm ok\|已导出，文件在浏览器的下载目录。\|进度已导出$/.test(String(exported)),
      exported
    );

    // 导入：真实走 input file + FileReader，确认后覆盖并重载
    const impFile = path.join(os.tmpdir(), "as-progress-import-" + process.pid + ".json");
    fs.writeFileSync(
      impFile,
      JSON.stringify({
        app: "agentscope-java-learn",
        v: 1,
        read: { "00-study-map": true },
        done: { "00-study-map": Date.now() },
        seen: {},
        ex: {},
        exMeta: {},
        last: null,
      })
    );
    await send("DOM.enable", {}, sessionId);
    const domDoc = await send("DOM.getDocument", {}, sessionId);
    const fileNode = await send(
      "DOM.querySelector",
      { nodeId: domDoc.root.nodeId, selector: "#pc-file" },
      sessionId
    );
    await send("DOM.setFileInputFiles", { files: [impFile], nodeId: fileNode.nodeId }, sessionId);
    await sleep(600);
    const askImp = await ev(
      `(function(){var m=document.getElementById('pc-msg');
        return [m.hidden,/导入会覆盖当前进度/.test(m.textContent),!!m.querySelector('#pc-yes'),
          document.activeElement===m.querySelector('#pc-yes')].join('|');})()`
    );
    check(
      "browser",
      "导入前先内联确认并说明覆盖范围",
      /^false\|true\|true\|true$/.test(String(askImp)),
      askImp
    );

    await ev(`(function(){document.getElementById('pc-yes').click();return 1;})()`);
    await sleep(900);
    await waitReady();
    const imported = await ev(
      `(function(){var r=JSON.parse(localStorage.getItem('as-learn-read')||'{}');
        var d=JSON.parse(localStorage.getItem('as-learn-done')||'{}');
        return [Object.keys(r).join(','),typeof d['00-study-map'],
          location.pathname.indexOf('index.html')>-1].join('|');})()`
    );
    check(
      "browser",
      "导入进度覆盖本机已读记录",
      /^00-study-map\|number\|true$/.test(String(imported)),
      imported
    );
    fs.rmSync(impFile, { force: true });

    // 清空：内联二次确认 → 重载后 7 个学习键全部消失
    const cleared = await ev(
      `(function(){var d=document.querySelector('.pc-data');if(d)d.open=true;
        document.getElementById('pc-clear').click();
        var m=document.getElementById('pc-msg');
        var has=!!m.querySelector('#pc-yes');
        var t=m.textContent.replace(/\\s+/g,' ').trim();
        m.querySelector('#pc-yes').click();
        return [has,/^确认清空？/.test(t)].join('|');})()`
    );
    await sleep(900);
    await waitReady();
    const afterClear = await ev(
      `(function(){var left=${JSON.stringify(LEARN_KEYS)}.filter(function(k){return localStorage.getItem(k)!==null;});
        return left.length?left.join(','):'empty';})()`
    );
    check(
      "browser",
      "确认清空会删掉全部学习记录",
      String(cleared) === "true|true" && String(afterClear) === "empty",
      cleared + " / " + afterClear
    );

    await send("Browser.close", {});
    try {
      proc.kill();
    } catch (e) {}
  } finally {
    await sleep(400);
    try {
      if (ws) ws.close();
    } catch (e) {}
    try {
      proc.kill();
    } catch (e) {}
    try {
      fs.rmSync(profile, { recursive: true, force: true });
    } catch (e) {
      // 浏览器偶尔还占着 profile，留到系统临时目录即可
    }
  }
}

/* ---------- 入口 ---------- */

(async () => {
  try {
    if (!browserOnly) {
      console.log("== 静态检查 ==");
      staticChecks();
    }
    if (!staticOnly) {
      console.log("\n== 浏览器回归 ==");
      await browserChecks();
    }
    const all = results.static.concat(results.browser);
    const failed = all.filter((r) => !r.ok).length;
    console.log("\n合计 " + all.length + " 项，失败 " + failed + " 项");
    process.exit(failed ? 1 : 0);
  } catch (e) {
    console.error("ERROR " + (e && e.stack ? e.stack : e));
    process.exit(2);
  }
})();
