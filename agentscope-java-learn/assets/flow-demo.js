/* 00A 信息流实验室：三档场景 + 分步播放（零依赖） */
(function () {
  "use strict";

  var root = document.getElementById("fd");
  if (!root) return;

  var SCENARIOS = {
    minimal: {
      label: "MINIMAL REACT",
      level: "L1",
      blurb: "最小 ReAct：一条 Msg 进来，模型决定说话或调工具，工具结果回填后再收尾。",
      nodes: [
        {
          name: "用户输入",
          title: "输入：一条 Msg",
          input: "字符串、多模态内容或平台事件",
          output: "Msg(role=user, content=[TextBlock])",
          next: "ReActAgent.call(msg)",
          link: "02-first-agent.html",
          linkText: "02 第一个 Agent",
        },
        {
          name: "ReActAgent",
          title: "Agent 收到消息",
          input: "Msg + RuntimeContext",
          output: "本轮上下文：历史 + system prompt",
          next: "Middleware / Hook 前处理",
          link: "10-react-vs-harness.html",
          linkText: "10 ReAct 与 Harness",
        },
        {
          name: "Middleware",
          title: "中间件与 Hook",
          input: "上下文 + 工具 schema",
          output: "可改写的 system prompt / 工具面",
          next: "Formatter",
          link: "09-middleware-hook.html",
          linkText: "09 Middleware 与 Hook",
        },
        {
          name: "Formatter",
          title: "Formatter 翻译成厂商 JSON",
          input: "Msg 列表 + 工具定义",
          output: "HTTP 请求体",
          next: "Model",
          link: "05-model.html",
          linkText: "05 模型层",
        },
        {
          name: "Model",
          title: "模型第一次推理",
          input: "厂商 JSON",
          output: "文本 + ToolUseBlock",
          next: "PermissionEngine",
          link: "05-model.html",
          linkText: "05 模型层",
        },
        {
          name: "Permission",
          title: "权限判定",
          input: "ToolUseBlock",
          output: "allow / ask / deny",
          next: "ToolExecutor 或 HITL",
          link: "08-permission-hitl.html",
          linkText: "08 权限与 HITL",
        },
        {
          name: "Tool",
          title: "工具执行",
          input: "工具名 + 参数",
          output: "ToolResultBlock",
          next: "回填成下一轮消息",
          link: "06-tool.html",
          linkText: "06 工具系统",
        },
        {
          name: "Model 2",
          title: "模型第二轮",
          input: "ToolResultBlock",
          output: "最终 assistant Msg",
          next: "State / Event",
          link: "04-message-and-event.html",
          linkText: "04 消息与事件",
        },
        {
          name: "State",
          title: "状态与事件",
          input: "最终 Msg",
          output: "AgentState 保存 + AgentEvent 流",
          next: "调用方拿到 Msg",
          link: "07-memory-context.html",
          linkText: "07 记忆与上下文",
        },
      ],
    },

    harness: {
      label: "HARNESS PIPELINE",
      level: "L2",
      blurb: "工程化 Harness：ReAct 循环不变，外面加工作区、中间件链、沙箱、子 Agent 与状态落盘。",
      nodes: [
        {
          name: "RuntimeContext",
          title: "请求级上下文",
          input: "外部调用 + userId / sessionId",
          output: "RuntimeContext + sessionId",
          next: "Workspace 投影",
          link: "07-memory-context.html",
          linkText: "07 记忆与上下文",
        },
        {
          name: "Workspace",
          title: "工作区投影",
          input: "AGENTS.md / SKILL.md / 文件说明",
          output: "system prompt 片段 + 工具面线索",
          next: "Middleware 链",
          link: "12-workspace-filesystem.html",
          linkText: "12 工作区与文件系统",
        },
        {
          name: "Middleware",
          title: "中间件链",
          input: "上下文 + 工具面",
          output: "压缩 / 技能 / 计划 / 权限处理后的请求",
          next: "Formatter",
          link: "09-middleware-hook.html",
          linkText: "09 Middleware 与 Hook",
        },
        {
          name: "Formatter",
          title: "翻译成厂商 JSON",
          input: "Msg + 工具 schema",
          output: "厂商请求体",
          next: "Model",
          link: "05-model.html",
          linkText: "05 模型层",
        },
        {
          name: "Model",
          title: "模型推理",
          input: "厂商 JSON",
          output: "文本 / ToolUseBlock",
          next: "Toolkit",
          link: "05-model.html",
          linkText: "05 模型层",
        },
        {
          name: "Toolkit",
          title: "工具面与权限",
          input: "ToolUseBlock",
          output: "allow / ask / deny + 工具选择",
          next: "Sandbox / ToolExecutor",
          link: "06-tool.html",
          linkText: "06 工具系统",
        },
        {
          name: "Sandbox",
          title: "隔离执行",
          input: "文件 / 命令工具",
          output: "隔离环境中的结果",
          next: "ToolResultBlock",
          link: "13-sandbox.html",
          linkText: "13 沙箱",
        },
        {
          name: "Subagent",
          title: "子 Agent 委派",
          input: "需要拆分的任务",
          output: "子 Agent 结果 / 后台任务句柄",
          next: "下一轮 Model",
          link: "14-subagent-team.html",
          linkText: "14 子 Agent 与团队",
        },
        {
          name: "State",
          title: "状态与记忆",
          input: "最终消息 + 工具结果",
          output: "AgentState / 压缩后的上下文",
          next: "事件流",
          link: "15-compaction-memory.html",
          linkText: "15 压缩与记忆",
        },
        {
          name: "Event",
          title: "Hook 与事件流",
          input: "生命周期事件",
          output: "AgentEvent + 推送 / 日志",
          next: "调用方 / Gateway",
          link: "18-gateway-channel-bus.html",
          linkText: "18 网关与消息总线",
        },
      ],
    },

    full: {
      label: "FULL STACK",
      level: "L3",
      blurb: "全依赖：入站、网关、注册 / 配置、工具网关、状态、观测与训练都接上；旁路设施不改变 ReAct 的主循环。",
      nodes: [
        {
          name: "Scheduler",
          title: "定时触发",
          input: "CRON / 固定速率 / XXL-Job 控制台",
          output: "触发一次 Agent 任务",
          next: "Inbound",
          link: "36a-3-scheduler.html",
          linkText: "36A-3 Scheduler",
        },
        {
          name: "Inbound",
          title: "入站入口",
          input: "平台事件 / OpenAI 请求 / HTTP job",
          output: "Msg + 请求身份",
          next: "Gateway",
          link: "34-channels.html",
          linkText: "34 渠道",
        },
        {
          name: "Gateway",
          title: "网关与路由",
          input: "Msg + routing key",
          output: "选定 Agent + sessionId + 排队",
          next: "RuntimeContext",
          link: "18-gateway-channel-bus.html",
          linkText: "18 网关与消息总线",
        },
        {
          name: "RuntimeContext",
          title: "请求级上下文",
          input: "身份 + 会话",
          output: "RuntimeContext",
          next: "Nacos",
          link: "07-memory-context.html",
          linkText: "07 记忆与上下文",
        },
        {
          name: "Nacos",
          title: "配置与注册",
          input: "promptKey / skill 名单",
          output: "Prompt 模板 / Skill / AgentCard",
          next: "Middleware",
          link: "36a-1-nacos-a2a.html",
          linkText: "36A-1 Nacos A2A",
        },
        {
          name: "Middleware",
          title: "中间件与工作区",
          input: "上下文 + 配置",
          output: "system prompt + 工具面",
          next: "Model",
          link: "09-middleware-hook.html",
          linkText: "09 Middleware 与 Hook",
        },
        {
          name: "Model",
          title: "模型 provider",
          input: "厂商 JSON",
          output: "文本 / ToolUseBlock",
          next: "Permission",
          link: "28-model-providers.html",
          linkText: "28 模型接入",
        },
        {
          name: "Permission",
          title: "权限判定",
          input: "ToolUseBlock",
          output: "allow / ask / deny",
          next: "Higress / Toolkit",
          link: "08-permission-hitl.html",
          linkText: "08 权限与 HITL",
        },
        {
          name: "Higress",
          title: "MCP 工具网关",
          input: "工具名 + 参数",
          output: "MCP 工具结果",
          next: "State",
          link: "36a-2-higress.html",
          linkText: "36A-2 Higress",
        },
        {
          name: "State",
          title: "状态与记忆",
          input: "最终消息 + 工具结果",
          output: "AgentState + 压缩上下文",
          next: "Studio",
          link: "31-agent-state-store.html",
          linkText: "31 Agent 状态存储",
        },
        {
          name: "Studio",
          title: "观测与 HITL",
          input: "PostCall 最终消息 + trace",
          output: "可视化 / 人工输入",
          next: "Training",
          link: "36a-4-studio.html",
          linkText: "36A-4 Studio",
        },
        {
          name: "Training",
          title: "影子训练",
          input: "命中采样的调用",
          output: "影子 Agent + feedback / commit",
          next: "Outbound",
          link: "36a-5-training.html",
          linkText: "36A-5 Training",
        },
        {
          name: "Outbound",
          title: "返回调用方",
          input: "最终 Msg / 事件流",
          output: "SSE / HTTP / 渠道回复",
          next: "调用方",
          link: "20-endpoints-sse.html",
          linkText: "20 Endpoint 与 SSE",
        },
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
  var prevBtn = document.getElementById("fd-prev");
  var nextBtn = document.getElementById("fd-next");
  var playBtn = document.getElementById("fd-play");
  var resetBtn = document.getElementById("fd-reset");
  var current = "minimal";
  var index = 0;
  var timer = null;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function nodes() {
    return SCENARIOS[current].nodes;
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
      if (i) {
        var arrow = document.createElement("span");
        arrow.className = "fd-arrow";
        arrow.setAttribute("aria-hidden", "true");
        arrow.textContent = "→";
        rail.appendChild(arrow);
      }
      var b = document.createElement("button");
      b.type = "button";
      b.className = "fd-node";
      b.dataset.i = String(i);
      b.innerHTML =
        '<span class="fd-idx">' +
        String(i + 1).padStart(2, "0") +
        '</span><span class="fd-name">' +
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

  function pad2(n) {
    return String(n).padStart(2, "0");
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
    blurb.textContent = SCENARIOS[key].blurb;
    labelEl.textContent = SCENARIOS[key].label;
    levelEl.textContent = SCENARIOS[key].level;
    eventsEl.innerHTML = "";
    jsonEl.textContent = "";
    paintRail();
    select(0);
  }

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

  renderScenario("minimal");
})();
