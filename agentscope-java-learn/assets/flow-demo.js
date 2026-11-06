/* 00A 信息流实验室：L1 基础 → L2 叠加 → L3 全依赖（零依赖） */
(function () {
  "use strict";

  var root = document.getElementById("fd");
  if (!root) return;

  // 同一批节点对象被三档复用；addedAt 标记它是在哪一层新增的。
  var NODES = {
    input: {
      name: "用户输入",
      title: "输入：一条 Msg",
      input: "字符串、多模态内容或平台事件",
      output: "Msg(role=user, content=[TextBlock])",
      next: "ReActAgent.call(msg)",
      link: "02-first-agent.html",
      linkText: "02 第一个 Agent",
    },
    agent: {
      name: "ReActAgent",
      title: "Agent 收到消息",
      input: "Msg + RuntimeContext",
      output: "本轮上下文：历史 + system prompt",
      next: "Middleware / Hook 前处理",
      link: "10-react-vs-harness.html",
      linkText: "10 ReAct 与 Harness",
    },
    middleware: {
      name: "Middleware",
      title: "中间件与 Hook",
      input: "上下文 + 工具 schema",
      output: "可改写的 system prompt / 工具面",
      next: "Formatter",
      link: "09-middleware-hook.html",
      linkText: "09 Middleware 与 Hook",
    },
    formatter: {
      name: "Formatter",
      title: "Formatter 翻译成厂商 JSON",
      input: "Msg 列表 + 工具定义",
      output: "HTTP 请求体",
      next: "Model",
      link: "05-model.html",
      linkText: "05 模型层",
    },
    model: {
      name: "Model",
      title: "模型第一次推理",
      input: "厂商 JSON",
      output: "文本 + ToolUseBlock",
      next: "PermissionEngine",
      link: "05-model.html",
      linkText: "05 模型层",
    },
    permission: {
      name: "Permission",
      title: "权限判定",
      input: "ToolUseBlock",
      output: "allow / ask / deny",
      next: "ToolExecutor 或 HITL",
      link: "08-permission-hitl.html",
      linkText: "08 权限与 HITL",
    },
    tool: {
      name: "Tool",
      title: "工具执行",
      input: "工具名 + 参数",
      output: "ToolResultBlock",
      next: "回填成下一轮消息",
      link: "06-tool.html",
      linkText: "06 工具系统",
    },
    model2: {
      name: "Model 2",
      title: "模型第二轮",
      input: "ToolResultBlock",
      output: "最终 assistant Msg",
      next: "State / Event",
      link: "04-message-and-event.html",
      linkText: "04 消息与事件",
    },
    state: {
      name: "State",
      title: "状态与事件",
      input: "最终 Msg",
      output: "AgentState 保存 + AgentEvent 流",
      next: "调用方拿到 Msg",
      link: "07-memory-context.html",
      linkText: "07 记忆与上下文",
    },

    runtime: {
      addedAt: 2,
      name: "RuntimeContext",
      title: "请求级上下文",
      input: "外部调用 + userId / sessionId",
      output: "RuntimeContext + sessionId",
      next: "Workspace 投影",
      link: "07-memory-context.html",
      linkText: "07 记忆与上下文",
    },
    workspace: {
      addedAt: 2,
      name: "Workspace",
      title: "工作区投影",
      input: "AGENTS.md / SKILL.md / 文件说明",
      output: "system prompt 片段 + 工具面线索",
      next: "Middleware 链",
      link: "12-workspace-filesystem.html",
      linkText: "12 工作区与文件系统",
    },
    sandbox: {
      addedAt: 2,
      name: "Sandbox",
      title: "隔离执行",
      input: "文件 / 命令工具",
      output: "隔离环境中的结果",
      next: "ToolResultBlock",
      link: "13-sandbox.html",
      linkText: "13 沙箱",
    },
    subagent: {
      addedAt: 2,
      name: "Subagent",
      title: "子 Agent 委派",
      input: "需要拆分的任务",
      output: "子 Agent 结果 / 后台任务句柄",
      next: "下一轮 Model",
      link: "14-subagent-team.html",
      linkText: "14 子 Agent 与团队",
    },
    event: {
      addedAt: 2,
      name: "Event",
      title: "Hook 与事件流",
      input: "生命周期事件",
      output: "AgentEvent + 推送 / 日志",
      next: "调用方 / Gateway",
      link: "18-gateway-channel-bus.html",
      linkText: "18 网关与消息总线",
    },

    scheduler: {
      addedAt: 3,
      name: "Scheduler",
      title: "定时触发",
      input: "CRON / 固定速率 / XXL-Job 控制台",
      output: "触发一次 Agent 任务",
      next: "Inbound",
      link: "36a-3-scheduler.html",
      linkText: "36A-3 Scheduler",
    },
    inbound: {
      addedAt: 3,
      name: "Inbound",
      title: "入站入口",
      input: "平台事件 / OpenAI 请求 / HTTP job",
      output: "Msg + 请求身份",
      next: "Gateway",
      link: "34-channels.html",
      linkText: "34 渠道",
    },
    gateway: {
      addedAt: 3,
      name: "Gateway",
      title: "网关与路由",
      input: "Msg + routing key",
      output: "选定 Agent + sessionId + 排队",
      next: "RuntimeContext",
      link: "18-gateway-channel-bus.html",
      linkText: "18 网关与消息总线",
    },
    nacos: {
      addedAt: 3,
      name: "Nacos",
      title: "配置与注册",
      input: "promptKey / skill 名单",
      output: "Prompt 模板 / Skill / AgentCard",
      next: "Workspace",
      link: "36a-1-nacos-a2a.html",
      linkText: "36A-1 Nacos A2A",
    },
    higress: {
      addedAt: 3,
      name: "Higress",
      title: "MCP 工具网关",
      input: "工具名 + 参数",
      output: "MCP 工具结果",
      next: "State",
      link: "36a-2-higress.html",
      linkText: "36A-2 Higress",
    },
    studio: {
      addedAt: 3,
      name: "Studio",
      title: "观测与 HITL",
      input: "PostCall 最终消息 + trace",
      output: "可视化 / 人工输入",
      next: "Training",
      link: "36a-4-studio.html",
      linkText: "36A-4 Studio",
    },
    training: {
      addedAt: 3,
      name: "Training",
      title: "影子训练",
      input: "命中采样的调用",
      output: "影子 Agent + feedback / commit",
      next: "Outbound",
      link: "36a-5-training.html",
      linkText: "36A-5 Training",
    },
    outbound: {
      addedAt: 3,
      name: "Outbound",
      title: "返回调用方",
      input: "最终 Msg / 事件流",
      output: "SSE / HTTP / 渠道回复",
      next: "调用方",
      link: "20-endpoints-sse.html",
      linkText: "20 Endpoint 与 SSE",
    },
  };

  var LEVELS = {
    minimal: {
      label: "MINIMAL REACT",
      level: "L1",
      blurb: "L1 基础：9 个节点，只有 ReAct 循环本身；没有 Workspace、沙箱、子 Agent 或网关。",
      ids: [
        "input",
        "agent",
        "middleware",
        "formatter",
        "model",
        "permission",
        "tool",
        "model2",
        "state",
      ],
    },
    harness: {
      label: "HARNESS PIPELINE",
      level: "L2",
      blurb: "L2 在 L1 的 9 个节点上新增 5 个（+L2）：RuntimeContext、Workspace、Sandbox、Subagent、Event。",
      ids: [
        "input",
        "runtime",
        "workspace",
        "agent",
        "middleware",
        "formatter",
        "model",
        "permission",
        "sandbox",
        "tool",
        "subagent",
        "model2",
        "state",
        "event",
      ],
    },
    full: {
      label: "FULL STACK",
      level: "L3",
      blurb: "L3 在 L2 的 14 个节点上新增 8 个（+L3）：Scheduler、Inbound、Gateway、Nacos、Higress、Studio、Training、Outbound。",
      ids: [
        "scheduler",
        "inbound",
        "gateway",
        "input",
        "runtime",
        "nacos",
        "workspace",
        "agent",
        "middleware",
        "formatter",
        "model",
        "permission",
        "higress",
        "sandbox",
        "tool",
        "subagent",
        "model2",
        "state",
        "event",
        "studio",
        "training",
        "outbound",
      ],
    },
  };

  var modeButtons = root.querySelectorAll(".fd-mode");
  var rail = document.getElementById("fd-rail");
  var blurb = document.getElementById("fd-blurb");
  var stepEl = document.getElementById("fd-step");
  var titleEl = document.getElementById("fd-title");
  var inputEl = document.getElementById("fd-input");
  var outputEl = document.getElementById("fd-output");
  var nextEl = document.getElementById("fd-next-node");
  var linkEl = document.getElementById("fd-link");
  var counterEl = document.getElementById("fd-counter");
  var labelEl = document.getElementById("fd-scenario-label");
  var levelEl = document.getElementById("fd-level");
  var jsonEl = document.getElementById("fd-json");
  var eventsEl = document.getElementById("fd-events");
  var packetEl = document.getElementById("fd-packet");
  var barEl = document.getElementById("fd-bar");
  var railWrap = root.querySelector(".fd-rail-wrap");
  var current = "minimal";
  var index = 0;
  var timer = null;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function nodes() {
    return LEVELS[current].ids.map(function (id) {
      return NODES[id];
    });
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function stopPlay() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    playBtn.setAttribute("aria-pressed", "false");
    playBtn.textContent = "▶ 播放";
  }

  function paintRail() {
    rail.innerHTML = "";
    nodes().forEach(function (n, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "fd-node";
      b.dataset.i = String(i);
      var badge = n.addedAt ? '<span class="fd-badge l' + n.addedAt + '">+L' + n.addedAt + "</span>" : "";
      b.innerHTML =
        '<span class="fd-idx">' +
        pad2(i + 1) +
        "</span>" +
        badge +
        '<span class="fd-name">' +
        n.name +
        '</span><span class="fd-out">' +
        n.output +
        "</span>";
      b.addEventListener("click", function () {
        stopPlay();
        select(i);
      });
      rail.appendChild(b);
    });
  }

  function positionPacket() {
    var active = rail.querySelector(".fd-node.active");
    if (!active || !railWrap) {
      packetEl.classList.remove("on");
      return;
    }
    var wr = railWrap.getBoundingClientRect();
    var ar = active.getBoundingClientRect();
    packetEl.style.left = ar.left - wr.left + ar.width / 2 - 4 + "px";
    packetEl.classList.add("on");
  }

  function paintEvents() {
    if (!eventsEl) return;
    eventsEl.innerHTML = "";
    var from = Math.max(0, index - 6);
    nodes()
      .slice(from, index + 1)
      .forEach(function (n) {
        var chip = document.createElement("span");
        chip.className = "fd-event";
        chip.textContent = n.name;
        eventsEl.appendChild(chip);
      });
  }

  function select(i) {
    index = Math.max(0, Math.min(nodes().length - 1, i));
    var list = rail.querySelectorAll(".fd-node");
    for (var k = 0; k < list.length; k++) {
      list[k].classList.toggle("active", k === index);
      list[k].classList.toggle("done", k < index);
      if (k === index) list[k].setAttribute("aria-current", "step");
      else list[k].removeAttribute("aria-current");
    }
    var n = nodes()[index];
    var len = nodes().length;
    stepEl.textContent = "第 " + (index + 1) + " / " + len + " 步";
    counterEl.textContent = pad2(index + 1) + " / " + pad2(len);
    barEl.style.width = ((index + 1) / len) * 100 + "%";
    titleEl.textContent = n.title;
    inputEl.textContent = n.input;
    outputEl.textContent = n.output;
    nextEl.textContent = n.next;
    jsonEl.textContent = JSON.stringify(
      {
        step: index + 1,
        node: n.name,
        addedAt: n.addedAt || 1,
        input: n.input,
        output: n.output,
        next: n.next,
      },
      null,
      2
    );
    paintEvents();
    linkEl.innerHTML = '对应章节：<a href="' + n.link + '">' + n.linkText + "</a>";
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === len - 1;
    var active = list[index];
    if (active) {
      var left = active.offsetLeft - (rail.clientWidth - active.offsetWidth) / 2;
      if (rail.scrollWidth > rail.clientWidth + 4) {
        rail.scrollTo({ left: Math.max(0, left), behavior: reduce ? "auto" : "smooth" });
      }
    }
    requestAnimationFrame(positionPacket);
  }

  function renderScenario(key) {
    stopPlay();
    current = key;
    index = 0;
    modeButtons.forEach(function (b) {
      b.setAttribute("aria-pressed", b.dataset.scenario === key ? "true" : "false");
    });
    blurb.textContent = LEVELS[key].blurb;
    labelEl.textContent = LEVELS[key].label;
    levelEl.textContent = LEVELS[key].level;
    eventsEl.innerHTML = "";
    jsonEl.textContent = "";
    paintRail();
    select(0);
  }

  var prevBtn = document.getElementById("fd-prev");
  var nextBtn = document.getElementById("fd-next");
  var playBtn = document.getElementById("fd-play");
  var resetBtn = document.getElementById("fd-reset");

  prevBtn.addEventListener("click", function () {
    stopPlay();
    select(index - 1);
  });
  nextBtn.addEventListener("click", function () {
    stopPlay();
    select(index + 1);
  });
  resetBtn.addEventListener("click", function () {
    stopPlay();
    select(0);
  });
  playBtn.addEventListener("click", function () {
    if (timer) {
      stopPlay();
      return;
    }
    if (index >= nodes().length - 1) select(0);
    playBtn.setAttribute("aria-pressed", "true");
    playBtn.textContent = "❚❚ 暂停";
    timer = setInterval(function () {
      if (index >= nodes().length - 1) {
        stopPlay();
        return;
      }
      select(index + 1);
    }, 1400);
  });

  modeButtons.forEach(function (b) {
    b.addEventListener("click", function () {
      renderScenario(b.dataset.scenario);
    });
  });

  document.addEventListener("keydown", function (e) {
    if (!root.contains(document.activeElement)) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      stopPlay();
      select(index + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      stopPlay();
      select(index - 1);
    }
  });

  rail.addEventListener("scroll", positionPacket, { passive: true });
  window.addEventListener("resize", positionPacket);

  var requested = new URLSearchParams(location.search).get("scenario");
  renderScenario(LEVELS[requested] ? requested : "minimal");
})();
