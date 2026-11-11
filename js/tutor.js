/* GeoLab · AI 地理助教聊天视图（T3）
   - #/tutor 完整聊天界面：模式徽标、消息列表、输入区、快捷提问、清空、导出 Markdown
   - 优先走 /api/chat（SSE 流式）；未启动 server.mjs（file:// 或接口不可用）时客户端降级：
     用 window.GEO_DATA 关键词匹配生成讲解/出题回答
   - 会话持久化 localStorage（最近 20 轮），流式结束后才落盘
   所有用户输入按纯文本转义；助手内容先整体转义再做轻量 Markdown 渲染。 */

(function () {
  "use strict";

  var STORE_KEY = "geolab.tutor.v1";
  var PREFILL_KEY = "geoLab.tutorPrefill";
  var MAX_MESSAGES = 40; /* 20 轮（用户 + 助教） */

  var CHIPS = [
    "冷锋和暖锋有什么区别？",
    "为什么北印度洋洋流夏顺冬逆？",
    "水土流失的治理措施有哪些？",
    "帮我出 3 道洋流相关的简答题"
  ];

  var activeInstance = null;

  /* ================= 通用工具 ================= */

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function storageGet(storage, key) {
    try {
      return storage.getItem(key);
    } catch (err) {
      return null;
    }
  }

  function storageSet(storage, key, value) {
    try {
      storage.setItem(key, value);
    } catch (err) {
      /* 隐私模式写入失败时不影响本次会话 */
    }
  }

  function storageRemove(storage, key) {
    try {
      storage.removeItem(key);
    } catch (err) {
      /* 忽略 */
    }
  }

  function makeSessionId() {
    return "s-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  /* ================= 轻量 Markdown ================= */

  function inlineFormat(text) {
    return text
      .replace(/`([^`]+)`/g, '<code class="md-code-inline">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  }

  function renderMarkdown(source) {
    var escaped = escapeHtml(String(source || ""));
    var lines = escaped.split(/\r?\n/);
    var out = [];
    var paragraph = [];
    var listType = "";
    var inCode = false;
    var codeLines = [];

    function closeList() {
      if (listType) {
        out.push("</" + listType + ">");
        listType = "";
      }
    }

    function flushParagraph() {
      if (paragraph.length) {
        out.push('<p class="md-p">' + inlineFormat(paragraph.join("<br>")) + "</p>");
        paragraph = [];
      }
    }

    for (var i = 0; i < lines.length; i += 1) {
      var raw = lines[i];
      var line = raw.trim();

      if (line.indexOf("```") === 0) {
        if (inCode) {
          out.push('<pre class="md-code"><code>' + codeLines.join("\n") + "</code></pre>");
          codeLines = [];
          inCode = false;
        } else {
          flushParagraph();
          closeList();
          inCode = true;
        }
        continue;
      }
      if (inCode) {
        codeLines.push(raw);
        continue;
      }
      if (!line) {
        flushParagraph();
        closeList();
        continue;
      }

      var heading = line.match(/^(#{1,4})\s+(.*)$/);
      if (heading) {
        flushParagraph();
        closeList();
        var level = Math.min(heading[1].length + 2, 5);
        out.push(
          '<h' + level + ' class="md-h">' + inlineFormat(heading[2]) + "</h" + level + ">"
        );
        continue;
      }

      var unordered = line.match(/^[-*]\s+(.*)$/);
      if (unordered) {
        flushParagraph();
        if (listType !== "ul") {
          closeList();
          out.push('<ul class="md-list">');
          listType = "ul";
        }
        out.push("<li>" + inlineFormat(unordered[1]) + "</li>");
        continue;
      }

      var ordered = line.match(/^\d+[.)]\s+(.*)$/);
      if (ordered) {
        flushParagraph();
        if (listType !== "ol") {
          closeList();
          out.push('<ol class="md-list">');
          listType = "ol";
        }
        out.push("<li>" + inlineFormat(ordered[1]) + "</li>");
        continue;
      }

      var quote = line.match(/^&gt;\s?(.*)$/);
      if (quote) {
        flushParagraph();
        closeList();
        out.push('<blockquote class="md-quote">' + inlineFormat(quote[1]) + "</blockquote>");
        continue;
      }

      closeList();
      paragraph.push(line);
    }

    if (inCode && codeLines.length) {
      out.push('<pre class="md-code"><code>' + codeLines.join("\n") + "</code></pre>");
    }
    flushParagraph();
    closeList();
    return out.join("");
  }

  /* ================= 客户端离线匹配（window.GEO_DATA） ================= */

  function stripPunct(text) {
    return String(text || "").replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, "");
  }

  function bigrams(text) {
    var clean = stripPunct(text);
    var set = {};
    for (var i = 0; i < clean.length - 1; i += 1) {
      set[clean.slice(i, i + 2)] = true;
    }
    return set;
  }

  function overlapCount(setA, setB) {
    var count = 0;
    Object.keys(setA).forEach(function (key) {
      if (setB[key]) {
        count += 1;
      }
    });
    return count;
  }

  function flattenKnowledge() {
    var data = window.GEO_DATA;
    var list = [];
    if (!data || !data.modules) {
      return list;
    }
    data.modules.forEach(function (mod) {
      (mod.points || []).forEach(function (point) {
        list.push({ point: point, moduleTitle: mod.title });
      });
    });
    return list;
  }

  function titleSegments(title) {
    return String(title || "")
      .split(/[及与和的地之、，,：:（）()\s—–-]+/)
      .filter(function (item) {
        return item.length >= 2;
      });
  }

  function matchLocal(question) {
    var list = flattenKnowledge();
    if (!list.length) {
      return null;
    }
    var questionSet = bigrams(question);
    var qText = stripPunct(question);
    var best = null;
    var bestScore = 0;
    list.forEach(function (entry) {
      var point = entry.point;
      var score = 0;
      var title = stripPunct(point.title || "");
      if (title.length >= 3 && qText.indexOf(title) !== -1) {
        score += 60;
      }
      titleSegments(point.title).forEach(function (segment) {
        var clean = stripPunct(segment);
        if (clean.length >= 2 && qText.indexOf(clean) !== -1) {
          score += 20;
        }
      });
      score += overlapCount(bigrams(point.title), questionSet) * 6;
      (point.quizTags || []).forEach(function (tag) {
        var cleanTag = stripPunct(tag);
        if (cleanTag.length >= 2 && qText.indexOf(cleanTag) !== -1) {
          score += 18;
        } else {
          score += overlapCount(bigrams(tag), questionSet) * 3;
        }
      });
      var bodySet = bigrams(
        [point.summary || ""].concat(point.keyPoints || [], point.pitfalls || []).join("")
      );
      score += Math.min(overlapCount(bodySet, questionSet), 18);
      if (score > bestScore) {
        bestScore = score;
        best = entry;
      }
    });
    if (!best || bestScore < 12) {
      return null;
    }
    return best;
  }

  function localExplain(entry) {
    var point = entry.point;
    var lines = ["### 结论", point.summary, "", "### 推理链（关键要点）"];
    (point.keyPoints || []).slice(0, 5).forEach(function (item, index) {
      lines.push(index + 1 + ". " + item);
    });
    lines.push("", "### 常见误区");
    (point.pitfalls || []).slice(0, 2).forEach(function (item) {
      lines.push("- " + String(item).replace(/^误区[：:]\s*/, ""));
    });
    if (point.example) {
      lines.push("", "### 案例 / 场景", point.example);
    }
    lines.push(
      "",
      "> 知识卡位置：" + entry.moduleTitle + " · " + point.title,
      "> 离线演示模式（未启动 server.mjs，配置模型后可自由对话）：回答由浏览器本地知识库匹配生成。"
    );
    return lines.join("\n");
  }

  function localQuiz(entry) {
    var point = entry.point;
    var lines = ["### 自测题 · " + point.title, ""];
    lines.push("**第 1 题（简答）** 请用一句话概括「" + point.title + "」的核心含义。");
    lines.push("", "**参考答案要点**", "- " + point.summary, "");
    (point.keyPoints || []).slice(0, 2).forEach(function (keyPoint, index) {
      var colon = keyPoint.indexOf("：");
      var question =
        colon > 4
          ? "简述「" + keyPoint.slice(0, colon) + "」的具体内容，并说明其地理意义。"
          : "如何理解「" + String(keyPoint).split(/[，,。；;]/)[0] + "」？请结合「" + point.title + "」作答。";
      lines.push("**第 " + (index + 2) + " 题（简答）** " + question);
      lines.push("", "**参考答案要点**", "- " + keyPoint, "");
    });
    lines.push("> 离线演示模式出题：题目由本地知识卡生成；配置模型后可指定难度与题量。");
    return lines.join("\n");
  }

  function localChecklist(entry) {
    var point = entry.point;
    var tags = (point.quizTags || []).join("、") || point.title;
    var lines = ["### 检查清单 · " + point.title + " 类题目", ""];
    lines.push("1. **审题**：先划关键词——「" + tags + "」，判断题目在问成因、过程、影响还是措施。");
    lines.push("2. **搭框架**：按「结论 → 推理链 → 结论回扣」组织；成因分自然与人为，影响分有利与不利。");
    lines.push("3. **补要点**：对照知识卡逐条核对——");
    (point.keyPoints || []).slice(0, 4).forEach(function (item) {
      lines.push("   - " + item);
    });
    lines.push("4. **防失分**：");
    (point.pitfalls || []).slice(0, 2).forEach(function (item) {
      lines.push("   - " + String(item).replace(/^误区[：:]\s*/, ""));
    });
    lines.push("", "> 离线演示模式只能给检查清单，配置模型后可逐句批改。");
    return lines.join("\n");
  }

  function localAnswer(question) {
    var entry = matchLocal(question);
    if (!entry) {
      return [
        "### 结论",
        "我暂未在本地知识库里匹配到与「" + String(question).slice(0, 30) + "」直接对应的知识点，这里给通用学习建议。",
        "",
        "### 建议这样学",
        "1. **定位章节**：先判断属于自然地理（大气、水、地貌、地球运动）还是人文地理（人口、城镇、产业、区域）。",
        "2. **抓因果链**：用「位置 → 要素 → 过程 → 结果」串起答案，地理题多在问「为什么这样分布」「带来什么影响」。",
        "3. **对照知识卡**：在「学习」页按模块浏览，重点看常见误区，那里往往是失分点。",
        "4. **动手验证**：到「实验室」调参数观察变化，比死记结论更有效。",
        "",
        "> 离线演示模式（未启动 server.mjs，配置模型后可自由对话）：换个更具体的问法命中率更高。"
      ].join("\n");
    }
    if (/批改|帮我改|打分|评分|错在哪|检查一下|我这样答|看看我写/.test(question)) {
      return localChecklist(entry);
    }
    if (/出题|出.{0,4}道|出道|练习题|考考我|测验|做题|题目|几道|简答题|自测/.test(question)) {
      return localQuiz(entry);
    }
    return localExplain(entry);
  }

  /* ================= 聊天视图 ================= */

  function createInstance(container, query) {
    var destroyed = false;
    var state = {
      messages: [],
      sessionId: makeSessionId(),
      mode: "",
      model: "",
      online: false,
      streaming: false,
      controller: null,
      typingTimer: null,
      renderTimer: null
    };

    var els = {};
    var messageNodes = [];

    var instance = {
      start: start,
      destroy: destroy
    };

    /* ---------- 构建骨架 ---------- */

    function buildShell() {
      var chips = CHIPS.map(function (text) {
        return (
          '<button type="button" class="tutor-chip" data-chip="' +
          escapeHtml(text) + '">' + escapeHtml(text) + "</button>"
        );
      }).join("");

      container.innerHTML =
        '<section class="tutor-page" aria-labelledby="tutorTitle">' +
          '<header class="card tutor-head">' +
            '<div class="tutor-head-main">' +
              '<p class="card-eyebrow">AI 助教</p>' +
              '<h1 class="tutor-title" id="tutorTitle">向地理助教提问</h1>' +
              '<p class="tutor-sub">人教版教材口径：先给结论再讲推理，判读题用「以温定带、以水定型」，出题必给答案与解析。</p>' +
            "</div>" +
            '<div class="tutor-head-actions">' +
              '<span class="badge tutor-mode" id="tutorModeBadge">连接中…</span>' +
              '<span class="tutor-model" id="tutorModel">模型：检测中</span>' +
              '<button type="button" class="btn btn-ghost tutor-tool" data-tutor="export">导出 Markdown</button>' +
              '<button type="button" class="btn btn-ghost tutor-tool" data-tutor="clear">清空</button>' +
            "</div>" +
          "</header>" +
          '<div class="card tutor-chat">' +
            '<div class="tutor-messages" id="tutorMessages" role="log" aria-live="polite" aria-label="对话记录"></div>' +
            '<div class="tutor-chips" id="tutorChips" aria-label="快捷提问">' + chips + "</div>" +
            '<form class="tutor-composer" id="tutorForm" novalidate>' +
              '<label class="tutor-input-label" for="tutorInput">输入你的地理问题</label>' +
              '<textarea class="tutor-input" id="tutorInput" rows="3" ' +
                'placeholder="例如：冷锋和暖锋有什么区别？（Enter 发送，Shift+Enter 换行）" ' +
                'maxlength="2000" aria-describedby="tutorStatus"></textarea>' +
              '<div class="tutor-composer-actions">' +
                '<span class="tutor-status" id="tutorStatus" role="status" aria-live="polite"></span>' +
                '<button type="submit" class="btn btn-primary tutor-send" id="tutorSend">发送</button>' +
              "</div>" +
            "</form>" +
          "</div>" +
        "</section>";
    }

    function cacheEls() {
      els.messages = container.querySelector("#tutorMessages");
      els.form = container.querySelector("#tutorForm");
      els.input = container.querySelector("#tutorInput");
      els.send = container.querySelector("#tutorSend");
      els.status = container.querySelector("#tutorStatus");
      els.badge = container.querySelector("#tutorModeBadge");
      els.model = container.querySelector("#tutorModel");
      els.exportBtn = container.querySelector('[data-tutor="export"]');
      els.clearBtn = container.querySelector('[data-tutor="clear"]');
      els.chips = Array.prototype.slice.call(container.querySelectorAll("[data-chip]"));
    }

    /* ---------- 消息渲染 ---------- */

    function isNearBottom() {
      if (!els.messages) {
        return true;
      }
      return els.messages.scrollHeight - els.messages.scrollTop - els.messages.clientHeight < 120;
    }

    function scrollToBottom() {
      if (els.messages) {
        els.messages.scrollTop = els.messages.scrollHeight;
      }
    }

    function createMessageNode(message) {
      var wrap = document.createElement("div");
      wrap.className = "msg msg-" + message.role;
      var avatar = document.createElement("span");
      avatar.className = "msg-avatar";
      avatar.setAttribute("aria-hidden", "true");
      avatar.textContent = message.role === "user" ? "我" : "师";
      var bubble = document.createElement("div");
      bubble.className = "msg-bubble";
      if (message.role === "user") {
        bubble.textContent = message.content;
      } else {
        bubble.innerHTML = renderMarkdown(message.content);
      }
      wrap.appendChild(avatar);
      wrap.appendChild(bubble);
      els.messages.appendChild(wrap);
      messageNodes.push({ node: wrap, bubble: bubble, message: message });
      return wrap;
    }

    function updateAssistantNode(entry, streaming) {
      entry.bubble.innerHTML = renderMarkdown(entry.message.content);
      entry.node.classList.toggle("is-streaming", Boolean(streaming));
    }

    function removeMessageNode(entry) {
      if (entry && entry.node && entry.node.parentNode) {
        entry.node.parentNode.removeChild(entry.node);
      }
      var index = messageNodes.indexOf(entry);
      if (index !== -1) {
        messageNodes.splice(index, 1);
      }
    }

    function appendNotice(text, retry) {
      var wrap = document.createElement("div");
      wrap.className = "msg msg-notice";
      var bubble = document.createElement("div");
      bubble.className = "msg-bubble msg-notice-bubble";
      var p = document.createElement("p");
      p.className = "msg-notice-text";
      p.textContent = text;
      bubble.appendChild(p);
      if (retry) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn-ghost msg-retry";
        btn.textContent = "重试";
        btn.addEventListener("click", function () {
          wrap.parentNode && wrap.parentNode.removeChild(wrap);
          var lastUser = lastUserQuestion();
          if (lastUser) {
            requestAnswer(lastUser, { fromRetry: true });
          }
        });
        bubble.appendChild(btn);
      }
      wrap.appendChild(bubble);
      els.messages.appendChild(wrap);
      scrollToBottom();
    }

    function renderWelcome() {
      els.messages.innerHTML = "";
      messageNodes = [];
      var welcome = document.createElement("div");
      welcome.className = "tutor-welcome";
      welcome.innerHTML =
        '<h2 class="tutor-welcome-title">你好，我是 GeoLab 地理助教</h2>' +
        '<p class="tutor-welcome-text">按人教版教材口径答疑，可以帮你做这些事：</p>' +
        '<ul class="tutor-welcome-list">' +
          "<li><strong>答疑</strong>：讲清概念与原理，先给结论再讲推理链。</li>" +
          "<li><strong>出题</strong>：按知识点出简答题，附答案要点与易错提醒。</li>" +
          "<li><strong>批改</strong>：给出检查清单，帮你找出失分点。</li>" +
          "<li><strong>讲思路</strong>：拆解判读类题目，如「以温定带、以水定型」。</li>" +
        "</ul>" +
        '<p class="tutor-welcome-note">对话记录只保存在本机浏览器，可随时清空或导出。</p>';
      els.messages.appendChild(welcome);
    }

    function ensureWelcome() {
      if (state.messages.length === 0) {
        renderWelcome();
      }
    }

    function dropWelcome() {
      var welcome = els.messages.querySelector(".tutor-welcome");
      if (welcome) {
        welcome.parentNode.removeChild(welcome);
      }
    }

    /* ---------- 持久化 ---------- */

    function saveSession() {
      var data = {
        v: 1,
        sessionId: state.sessionId,
        messages: state.messages.slice(-MAX_MESSAGES)
      };
      storageSet(window.localStorage, STORE_KEY, JSON.stringify(data));
    }

    function loadSession() {
      var raw = storageGet(window.localStorage, STORE_KEY);
      if (!raw) {
        return;
      }
      var parsed = null;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        parsed = null;
      }
      if (!parsed || !Array.isArray(parsed.messages)) {
        return;
      }
      state.messages = parsed.messages
        .filter(function (item) {
          return item && (item.role === "user" || item.role === "assistant") &&
            typeof item.content === "string" && item.content.trim().length > 0;
        })
        .slice(-MAX_MESSAGES);
      if (typeof parsed.sessionId === "string" && parsed.sessionId) {
        state.sessionId = parsed.sessionId;
      }
      if (state.messages.length) {
        dropWelcome();
        state.messages.forEach(function (message) {
          createMessageNode(message);
        });
        scrollToBottom();
      }
    }

    /* ---------- 顶部状态 ---------- */

    function setBadge(mode, model) {
      state.mode = mode;
      state.model = model || "";
      if (!els.badge) {
        return;
      }
      if (mode === "openai") {
        els.badge.textContent = "已接入模型 · OpenAI 兼容";
        els.badge.className = "badge tutor-mode";
      } else if (mode === "local") {
        els.badge.textContent = "离线演示模式（本地）";
        els.badge.className = "badge badge-accent tutor-mode";
      } else {
        els.badge.textContent = "离线演示模式";
        els.badge.className = "badge badge-accent tutor-mode";
      }
      if (els.model) {
        els.model.textContent = "模型：" + (model || "本机模型");
      }
    }

    function probeHealth() {
      if (typeof window.fetch !== "function" || window.location.protocol === "file:") {
        setBadge("local", "浏览器本地知识库");
        appendNotice("离线演示模式（未启动 server.mjs，配置模型后可自由对话）：回答由浏览器本地知识库匹配生成。");
        return Promise.resolve();
      }
      return window
        .fetch("/api/health", { cache: "no-store" })
        .then(function (response) {
          if (!response.ok) {
            throw new Error("health " + response.status);
          }
          return response.json();
        })
        .then(function (data) {
          if (destroyed) {
            return;
          }
          if (!data || data.ok !== true) {
            throw new Error("health payload");
          }
          state.online = true;
          setBadge(data.mode || "offline", data.model || "");
          if (data.mode === "offline") {
            appendNotice("离线演示模式：服务端未接入模型，回答由本地知识库按关键词匹配生成；配置模型后可自由对话。");
          }
        })
        .catch(function () {
          if (destroyed) {
            return;
          }
          state.online = false;
          setBadge("local", "浏览器本地知识库");
          appendNotice("离线演示模式（未启动 server.mjs，配置模型后可自由对话）：回答由浏览器本地知识库匹配生成。");
        });
    }

    /* ---------- 输入状态 ---------- */

    function setStreaming(flag) {
      state.streaming = flag;
      if (els.send) {
        els.send.disabled = flag;
        els.send.textContent = flag ? "思考中…" : "发送";
      }
      if (els.status) {
        els.status.textContent = flag ? "思考中…" : "";
      }
      if (els.input) {
        els.input.setAttribute("aria-busy", flag ? "true" : "false");
      }
    }

    function lastUserQuestion() {
      for (var i = state.messages.length - 1; i >= 0; i -= 1) {
        if (state.messages[i].role === "user") {
          return state.messages[i].content;
        }
      }
      return "";
    }

    /* ---------- 发送 ---------- */

    function sendMessage(rawText) {
      var text = String(rawText || "").trim();
      if (!text || state.streaming || destroyed) {
        return;
      }
      dropWelcome();
      var userMessage = { role: "user", content: text };
      state.messages.push(userMessage);
      createMessageNode(userMessage);
      saveSession();
      scrollToBottom();
      requestAnswer(text);
    }

    function requestAnswer(question, options) {
      if (state.streaming || destroyed) {
        return;
      }
      var fromRetry = Boolean(options && options.fromRetry);

      /* 重试时移除上一条空的助手消息，避免堆叠空气泡 */
      if (fromRetry) {
        var last = state.messages[state.messages.length - 1];
        if (last && last.role === "assistant" && !last.content.trim()) {
          state.messages.pop();
          removeMessageNode(messageNodes[messageNodes.length - 1]);
        }
      }

      var assistantMessage = { role: "assistant", content: "" };
      state.messages.push(assistantMessage);
      createMessageNode(assistantMessage);
      var entry = messageNodes[messageNodes.length - 1];

      setStreaming(true);
      scrollToBottom();

      var finish = function (errorText) {
        if (destroyed) {
          return;
        }
        setStreaming(false);
        if (!assistantMessage.content.trim()) {
          var index = state.messages.indexOf(assistantMessage);
          if (index !== -1) {
            state.messages.splice(index, 1);
          }
          removeMessageNode(entry);
        } else {
          updateAssistantNode(entry, false);
          saveSession();
        }
        if (errorText) {
          appendNotice(errorText, true);
        }
        scrollToBottom();
      };

      if (!state.online) {
        typewriter(localAnswer(question), assistantMessage, entry, finish);
        return;
      }

      state.controller = typeof AbortController === "function" ? new AbortController() : null;
      var payload = {
        messages: state.messages
          .filter(function (item) {
            return item !== assistantMessage && (item.role === "user" || item.role === "assistant");
          })
          .slice(-16)
          .map(function (item) {
            return { role: item.role, content: item.content };
          }),
        sessionId: state.sessionId
      };

      window
        .fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: state.controller ? state.controller.signal : undefined
        })
        .then(function (response) {
          if (!response.ok) {
            throw new Error("服务端返回 " + response.status + "，请检查 server.mjs 是否正常运行。");
          }
          if (!response.body || typeof response.body.getReader !== "function") {
            throw new Error("当前浏览器不支持流式响应，请更换新版 Chrome / Edge / Firefox。");
          }
          return readSse(response.body, assistantMessage, entry);
        })
        .then(function (streamError) {
          finish(streamError || "");
        })
        .catch(function (err) {
          if (destroyed) {
            return;
          }
          if (err && err.name === "AbortError") {
            finish("");
            return;
          }
          var message = err && err.message ? err.message : "网络异常，请稍后重试。";
          finish(message);
        })
        .then(function () {
          state.controller = null;
        });
    }

    function readSse(body, assistantMessage, entry) {
      var reader = body.getReader();
      var decoder = new TextDecoder("utf-8");
      var buffer = "";
      var finished = false;
      var streamError = "";
      var scrollQueued = false;

      function scheduleRender() {
        if (scrollQueued) {
          return;
        }
        scrollQueued = true;
        state.renderTimer = window.setTimeout(function () {
          scrollQueued = false;
          if (destroyed) {
            return;
          }
          updateAssistantNode(entry, true);
          if (isNearBottom()) {
            scrollToBottom();
          }
        }, 60);
      }

      function handleBlock(block) {
        var lines = block.split("\n");
        for (var i = 0; i < lines.length; i += 1) {
          var line = lines[i].trim();
          if (line.indexOf("data:") !== 0) {
            continue;
          }
          var data = line.slice(5).trim();
          if (!data) {
            continue;
          }
          if (data === "[DONE]") {
            finished = true;
            return;
          }
          var parsed = null;
          try {
            parsed = JSON.parse(data);
          } catch (err) {
            continue;
          }
          if (parsed && typeof parsed.error === "string" && parsed.error) {
            streamError = "助教请求失败：" + parsed.error;
            finished = true;
            return;
          }
          if (parsed && typeof parsed.delta === "string" && parsed.delta) {
            assistantMessage.content += parsed.delta;
            scheduleRender();
          }
        }
      }

      function pump() {
        return reader.read().then(function (chunk) {
          if (chunk.done || finished || destroyed) {
            if (buffer.trim()) {
              handleBlock(buffer);
              buffer = "";
            }
            if (state.renderTimer) {
              window.clearTimeout(state.renderTimer);
              state.renderTimer = null;
            }
            if (!destroyed) {
              updateAssistantNode(entry, false);
            }
            return streamError;
          }
          buffer += decoder.decode(chunk.value, { stream: true });
          var index = buffer.indexOf("\n\n");
          while (index !== -1) {
            var block = buffer.slice(0, index);
            buffer = buffer.slice(index + 2);
            handleBlock(block);
            if (finished) {
              break;
            }
            index = buffer.indexOf("\n\n");
          }
          if (finished) {
            if (!destroyed) {
              updateAssistantNode(entry, false);
            }
            return streamError;
          }
          return pump();
        });
      }

      return pump();
    }

    function typewriter(text, assistantMessage, entry, finish) {
      var index = 0;
      if (state.typingTimer) {
        window.clearInterval(state.typingTimer);
      }
      state.typingTimer = window.setInterval(function () {
        if (destroyed) {
          window.clearInterval(state.typingTimer);
          state.typingTimer = null;
          return;
        }
        if (index >= text.length) {
          window.clearInterval(state.typingTimer);
          state.typingTimer = null;
          assistantMessage.content = text;
          updateAssistantNode(entry, false);
          finish("");
          return;
        }
        index += 2;
        assistantMessage.content = text.slice(0, index);
        updateAssistantNode(entry, true);
        if (isNearBottom()) {
          scrollToBottom();
        }
      }, 18);
    }

    /* ---------- 工具动作 ---------- */

    function exportMarkdown() {
      var lines = ["# GeoLab 助教对话", ""];
      lines.push("- 导出时间：" + new Date().toLocaleString("zh-CN"));
      lines.push("- 模式：" + (state.mode || "未知"));
      lines.push("- 模型：" + (state.model || "本机模型"));
      lines.push("", "---", "");
      if (!state.messages.length) {
        lines.push("（本次会话暂无对话记录）");
      }
      state.messages.forEach(function (message) {
        if (message.role === "user") {
          lines.push("**我**：", "", message.content, "");
        } else {
          lines.push("**助教**：", "", message.content, "");
        }
      });
      var stamp = new Date();
      var pad = function (value) {
        return value < 10 ? "0" + value : String(value);
      };
      var name =
        "GeoLab-助教对话-" + stamp.getFullYear() + pad(stamp.getMonth() + 1) + pad(stamp.getDate()) +
        "-" + pad(stamp.getHours()) + pad(stamp.getMinutes()) + ".md";
      var blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 1000);
    }

    function clearSession() {
      if (state.streaming) {
        appendNotice("正在回复中，请等待本条回答结束后再清空。");
        return;
      }
      var confirmed = false;
      try {
        confirmed = window.confirm("确定清空本次对话记录吗？清空后无法恢复。");
      } catch (err) {
        confirmed = false;
      }
      if (!confirmed) {
        return;
      }
      state.messages = [];
      state.sessionId = makeSessionId();
      storageRemove(window.localStorage, STORE_KEY);
      renderWelcome();
      if (els.status) {
        els.status.textContent = "已清空对话";
        window.setTimeout(function () {
          if (!destroyed && els.status) {
            els.status.textContent = "";
          }
        }, 1800);
      }
    }

    /* ---------- 事件绑定 ---------- */

    function bindEvents() {
      els.form.addEventListener("submit", function (event) {
        event.preventDefault();
        var text = els.input.value;
        if (state.streaming) {
          return;
        }
        els.input.value = "";
        els.input.style.height = "";
        sendMessage(text);
      });

      els.input.addEventListener("keydown", function (event) {
        if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
          event.preventDefault();
          if (state.streaming) {
            return;
          }
          var text = els.input.value;
          els.input.value = "";
          els.input.style.height = "";
          sendMessage(text);
        }
      });

      els.input.addEventListener("input", function () {
        els.input.style.height = "auto";
        var next = Math.min(els.input.scrollHeight, 180);
        els.input.style.height = next + "px";
      });

      els.chips.forEach(function (chip) {
        chip.addEventListener("click", function () {
          if (state.streaming) {
            return;
          }
          sendMessage(chip.getAttribute("data-chip") || "");
        });
      });

      if (els.exportBtn) {
        els.exportBtn.addEventListener("click", exportMarkdown);
      }
      if (els.clearBtn) {
        els.clearBtn.addEventListener("click", clearSession);
      }
    }

    /* ---------- 预填 ---------- */

    function readPrefill() {
      var question = "";
      if (query && typeof query.q === "string") {
        question = query.q;
      }
      if (!question) {
        var stored = storageGet(window.sessionStorage, PREFILL_KEY);
        if (stored) {
          question = stored;
        }
      }
      if (question) {
        storageRemove(window.sessionStorage, PREFILL_KEY);
      }
      return String(question || "").trim();
    }

    function shouldAutoSend(question) {
      if (!question) {
        return false;
      }
      var lastUser = lastUserQuestion();
      if (lastUser && lastUser === question) {
        return false;
      }
      return true;
    }

    /* ---------- 生命周期 ---------- */

    function start() {
      buildShell();
      cacheEls();
      bindEvents();
      loadSession();
      ensureWelcome();
      setStreaming(false);

      var prefill = readPrefill();
      var autoSend = Boolean(prefill) && shouldAutoSend(prefill);

      if (prefill && !autoSend && els.input) {
        els.input.value = prefill;
        if (els.status) {
          els.status.textContent = "已带入问题，按 Enter 发送";
        }
      }

      probeHealth().then(function () {
        if (destroyed) {
          return;
        }
        if (autoSend) {
          sendMessage(prefill);
        } else if (prefill && els.input) {
          els.input.focus();
          els.input.setSelectionRange(prefill.length, prefill.length);
        }
      });
    }

    function destroy() {
      destroyed = true;
      if (state.typingTimer) {
        window.clearInterval(state.typingTimer);
        state.typingTimer = null;
      }
      if (state.renderTimer) {
        window.clearTimeout(state.renderTimer);
        state.renderTimer = null;
      }
      if (state.controller) {
        try {
          state.controller.abort();
        } catch (err) {
          /* 忽略中止异常 */
        }
        state.controller = null;
      }
      state.streaming = false;
      messageNodes = [];
      els = {};
    }

    return instance;
  }

  /* ================= 对外接口 ================= */

  function mount(container, options) {
    destroy();
    if (!container) {
      return null;
    }
    var instance = createInstance(container, (options && options.query) || {});
    activeInstance = instance;
    instance.start();
    return instance;
  }

  function destroy() {
    if (activeInstance) {
      activeInstance.destroy();
      activeInstance = null;
    }
  }

  window.GeoLabTutor = {
    mount: mount,
    destroy: destroy,
    renderMarkdown: renderMarkdown
  };
})();