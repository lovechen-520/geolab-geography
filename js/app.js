/* GeoLab · 高中地理互动课堂 — 前端应用逻辑
   T1 范围：hash 路由、导航高亮、首页与学习页渲染、助教/练习/报告简版说明页、
   学习进度 localStorage 持久化。
    T2a 增量：#/lab 互动实验室视图（组件容器由 js/interactive.js 挂载）、
    学习页互动演示入口卡（跳 #/lab?focus=… 定位对应组件）。
    T4 增量：#/practice 与 #/report 交给 js/quiz.js 渲染题目、判分、错题本与学习报告。
   数据来源：window.GEO_DATA（data/knowledge.js，需先于本文件引入）。
   所有动态内容均经 escapeHtml 转义后再插入，避免 XSS。 */

(function () {
  "use strict";

  var DATA = window.GEO_DATA;
  var DATA_OK = Boolean(
    DATA &&
    DATA.modules &&
    typeof DATA.modules.length === "number" &&
    DATA.modules.length > 0
  );

  var ROUTE_LIST = ["home", "learn", "lab", "tutor", "practice", "report"];
  var KEY_MASTERY = "geoLab.mastered";           // { pointId: true }
  var KEY_TUTOR_PREFILL = "geoLab.tutorPrefill"; // 问助教预填问题
  var liveMode = "";                              // 服务端模型模式：""（离线）/ openai

  var CHIP_CLASS = {
    teal: "chip-teal",
    orange: "chip-orange",
    blue: "chip-blue",
    green: "chip-green",
    violet: "chip-violet",
  };

  /* 互动实验室的 4 个组件（SPEC §6）：时区换算器、气候类型判读、
     等高线地形判读、地球运动与昼夜长短均已接入，卡片内直接挂载对应组件。 */
  var LAB_COMPONENTS = [
    {
      id: "timezone",
      name: "时区换算器",
      desc: "选择基准城市并输入当地时间，实时换算北京、东京、新德里、伦敦、纽约、洛杉矶、悉尼、开罗 8 地时间，直观体会「东加西减」与跨日变化。"
    },
    {
      id: "climate",
      name: "气候类型判读",
      desc: "读气温曲线与降水柱状图判断气候类型，练习「以温定带、以水定型」的判读方法。"
    },
    {
      id: "contour",
      name: "等高线地形判读",
      desc: "在等高线示意图上识别山峰、山脊、山谷、鞍部与陡崖，选择后即时判分并给出判读要点。"
    },
    {
      id: "earthmotion",
      name: "地球运动与昼夜长短",
      desc: "切换二分二至，观察太阳直射点位置与昼夜长短的变化，并配口算题检验理解。"
    }
  ];

  /* 接入说明兑底机制：当前 4 个组件均已接入；若后续新增组件，接入前在此登记说明 */
  var LAB_PLANS = {};

  var viewEl = document.getElementById("view");
  var navLinks = Array.prototype.slice.call(
    document.querySelectorAll(".site-nav a[data-route]")
  );
  var skipLink = document.querySelector(".skip-link");

  /* ================= 工具函数 ================= */

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
      /* 隐私模式下写入失败，学习进度本次会话不保存 */
    }
  }

  function readMastery() {
    var map = {};
    var raw = storageGet(window.localStorage, KEY_MASTERY);
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          map = parsed;
        }
      } catch (err) {
        map = {};
      }
    }
    return map;
  }

  function writeMastery(map) {
    storageSet(window.localStorage, KEY_MASTERY, JSON.stringify(map));
  }

  function masteredCount(mod, map) {
    var count = 0;
    mod.points.forEach(function (point) {
      if (map[point.id]) {
        count += 1;
      }
    });
    return count;
  }

  function masteredPercent(mod, map) {
    var total = mod.points.length || 1;
    return Math.round((masteredCount(mod, map) / total) * 100);
  }

  function findModule(id) {
    for (var i = 0; i < DATA.modules.length; i += 1) {
      if (DATA.modules[i].id === id) {
        return DATA.modules[i];
      }
    }
    return null;
  }

  function findPoint(mod, id) {
    if (!mod) {
      return null;
    }
    for (var i = 0; i < mod.points.length; i += 1) {
      if (mod.points[i].id === id) {
        return mod.points[i];
      }
    }
    return null;
  }

  function chipClass(color) {
    return CHIP_CLASS[color] || "chip-teal";
  }

  /* ================= 路由 ================= */

  function parseHash() {
    var hash = window.location.hash || "";
    var body = hash.charAt(0) === "#" ? hash.slice(1) : hash;
    if (body.length === 0) {
      body = "/home";
    }
    var queryIndex = body.indexOf("?");
    var path = queryIndex === -1 ? body : body.slice(0, queryIndex);
    var queryString = queryIndex === -1 ? "" : body.slice(queryIndex + 1);
    var segments = path.split("/").filter(function (part) {
      return part.length > 0;
    });
    var query = {};
    if (queryString) {
      new URLSearchParams(queryString).forEach(function (value, key) {
        query[key] = value;
      });
    }
    return { segments: segments, query: query };
  }

  function setActiveNav(head) {
    navLinks.forEach(function (link) {
      var active = link.getAttribute("data-route") === head;
      link.classList.toggle("active", active);
      if (active) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function renderRoute() {
    /* 离开当前视图前清理上一视图的定时器与流式请求，避免残留 */
    if (window.GeoLabTutor && typeof window.GeoLabTutor.destroy === "function") {
      try {
        window.GeoLabTutor.destroy();
      } catch (err) {
        /* 忽略清理异常，不影响路由切换 */
      }
    }
    if (window.GeoLabQuiz && typeof window.GeoLabQuiz.destroy === "function") {
      try {
        window.GeoLabQuiz.destroy();
      } catch (err) {
        /* 忽略清理异常，不影响路由切换 */
      }
    }
    var parsed = parseHash();
    var head = parsed.segments[0] || "home";
    if (ROUTE_LIST.indexOf(head) === -1) {
      window.location.replace("#/home");
      return;
    }
    setActiveNav(head);
    if (head === "home") {
      renderHome();
    } else if (head === "learn") {
      renderLearn(parsed.segments);
    } else if (head === "lab") {
      renderLab(parsed.query);
    } else if (head === "tutor") {
      renderTutor(parsed.query);
    } else if (head === "practice") {
      renderPractice();
    } else {
      renderReport();
    }
    window.scrollTo(0, 0);
  }

  /* ================= 首页 ================= */

  var TONE_CLASS = {
    teal: "tone-teal",
    orange: "tone-amber",
    blue: "tone-blue",
    green: "tone-green",
    violet: "tone-violet",
  };

  /* 各模块的迷你地理图形（内联 SVG，描边继承模块色，低饱和） */
  var MODULE_ICONS = {
    teal:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="8.6"></circle>' +
      '<ellipse cx="12" cy="12" rx="3.9" ry="8.6"></ellipse>' +
      '<path d="M3.4 12h17.2"></path>' +
      '<path d="M5.2 7.4h13.6M5.2 16.6h13.6" opacity=".55"></path>' +
      "</svg>",
    orange:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M3.6 6.6 9 4.2l6 2.6 5.4-2.4v13.2L15 20l-6-2.6-5.4 2.4Z"></path>' +
      '<path d="M9 4.2v13.2M15 6.8V20" opacity=".55"></path>' +
      "</svg>",
    blue:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M2.8 18.2 8.4 9.8l3.5 4.6 2.8-3.6 6.5 7.4Z"></path>' +
      '<path d="M2.8 20.8h18.4" opacity=".55"></path>' +
      '<path d="M8.4 9.8 6.6 14" opacity=".45"></path>' +
      "</svg>",
    green:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M12 3.4 19.6 8v8L12 20.6 4.4 16V8Z"></path>' +
      '<path d="M12 7.6 16.2 10v4L12 16.4 7.8 14v-4Z" opacity=".5"></path>' +
      "</svg>",
    violet:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">' +
      '<path d="M12 3.2c3.5 4.2 5.8 6.9 5.8 9.7a5.8 5.8 0 0 1-11.6 0c0-2.8 2.3-5.5 5.8-9.7Z"></path>' +
      '<path d="M9.2 13.6a2.9 2.9 0 0 0 2.8 2.7" opacity=".55"></path>' +
      "</svg>",
  };

  /* Hero 右侧地理视觉：地球 + 经纬网 + 外围等高线环 + 刻度（纯内联 SVG） */
  var HERO_VISUAL =
    '<svg class="geo-globe" viewBox="0 0 480 480" fill="none" aria-hidden="true" focusable="false">' +
      "<defs>" +
        '<radialGradient id="geoGlow" cx="50%" cy="44%" r="52%">' +
          '<stop offset="0%" stop-color="#167D70" stop-opacity="0.13"></stop>' +
          '<stop offset="62%" stop-color="#3478F6" stop-opacity="0.05"></stop>' +
          '<stop offset="100%" stop-color="#3478F6" stop-opacity="0"></stop>' +
        "</radialGradient>" +
        '<linearGradient id="geoStroke" x1="112" y1="96" x2="384" y2="396" gradientUnits="userSpaceOnUse">' +
          '<stop stop-color="#167D70" stop-opacity="0.62"></stop>' +
          '<stop offset="1" stop-color="#3478F6" stop-opacity="0.30"></stop>' +
        "</linearGradient>" +
      "</defs>" +
      '<circle cx="240" cy="240" r="216" fill="url(#geoGlow)"></circle>' +
      '<circle cx="240" cy="240" r="182" stroke="#94A3B8" stroke-opacity="0.34" stroke-width="1" stroke-dasharray="1 11"></circle>' +
      '<path d="M240 58c76 0 142 46 160 118 18 72-10 154-78 196-68 42-156 32-214-20-58-52-70-146-26-208 44-62 96-86 158-86Z" stroke="#167D70" stroke-opacity="0.16" stroke-width="1.2"></path>' +
      '<path d="M240 92c64 0 118 36 132 96 14 60-10 126-66 160-56 34-128 26-174-16-46-42-56-118-22-168 34-50 80-72 130-72Z" stroke="#167D70" stroke-opacity="0.13" stroke-width="1.2"></path>' +
      '<path d="M240 124c52 0 94 28 106 76 12 48-8 100-52 128-44 28-102 22-138-12-36-34-44-94-16-134 28-40 64-58 100-58Z" stroke="#3478F6" stroke-opacity="0.12" stroke-width="1.2"></path>' +
      '<circle cx="240" cy="240" r="132" fill="none" stroke="url(#geoStroke)" stroke-width="1.6"></circle>' +
      '<ellipse cx="240" cy="240" rx="132" ry="42" stroke="#167D70" stroke-opacity="0.30" stroke-width="1.1"></ellipse>' +
      '<ellipse cx="240" cy="240" rx="132" ry="88" stroke="#167D70" stroke-opacity="0.22" stroke-width="1.1"></ellipse>' +
      '<ellipse cx="240" cy="240" rx="48" ry="132" stroke="#3478F6" stroke-opacity="0.26" stroke-width="1.1"></ellipse>' +
      '<ellipse cx="240" cy="240" rx="94" ry="132" stroke="#3478F6" stroke-opacity="0.18" stroke-width="1.1"></ellipse>' +
      '<path d="M108 240h264" stroke="#64748B" stroke-opacity="0.32" stroke-width="1.1"></path>' +
      '<path d="M240 108v264" stroke="#64748B" stroke-opacity="0.20" stroke-width="1.1"></path>' +
      '<circle cx="240" cy="108" r="4" fill="#167D70" fill-opacity="0.55"></circle>' +
      '<circle cx="240" cy="372" r="4" fill="#3478F6" fill-opacity="0.45"></circle>' +
      '<text x="378" y="196" fill="#94A3B8" font-size="11" font-family="inherit">30°N</text>' +
      '<text x="86" y="392" fill="#94A3B8" font-size="11" font-family="inherit">120°E</text>' +
    "</svg>";

  function renderHome() {
    var mastery = readMastery();
    var cards = DATA.modules.map(function (mod, index) {
      var count = masteredCount(mod, mastery);
      var pct = masteredPercent(mod, mastery);
      var tone = TONE_CLASS[mod.color] || "tone-teal";
      var icon = MODULE_ICONS[mod.color] || MODULE_ICONS.teal;
      var order = ("0" + (index + 1)).slice(-2);
      return (
        '<a class="card module-card ' + tone + '" href="#/learn/' + encodeURIComponent(mod.id) + '">' +
          '<span class="module-card-top">' +
            '<span class="module-icon" aria-hidden="true">' + icon + "</span>" +
            '<span class="module-index" aria-hidden="true">' + order + "</span>" +
          "</span>" +
          '<h3 class="module-title">' + escapeHtml(mod.title) + "</h3>" +
          '<p class="module-desc">' + escapeHtml(mod.desc) + "</p>" +
          '<p class="module-stats">' +
            "<span>知识点 <strong>" + mod.points.length + "</strong></span>" +
            "<span>已掌握 <strong>" + count + "</strong></span>" +
          "</p>" +
          '<div class="module-progress-row">' +
            '<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' +
              pct + '" aria-label="' + escapeHtml(mod.title) + '掌握进度">' +
              '<span style="width:' + pct + '%"></span>' +
            "</div>" +
            '<span class="module-pct">' + pct + "%</span>" +
          "</div>" +
          '<span class="module-cta">进入课程 <span class="arrow" aria-hidden="true">→</span></span>' +
        "</a>"
      );
    }).join("");

    viewEl.innerHTML =
      '<section class="hero">' +
        '<div class="hero-copy">' +
          '<p class="hero-mode">' +
            '<span class="hero-tag"' + (liveMode ? ' data-live="true"' : "") + ">" +
              '<span class="dot" aria-hidden="true"></span>' +
              "当前模式：" + (liveMode ? "已接入模型" : "离线") +
            "</span>" +
            '<span class="hero-mode-note">' + (liveMode
              ? "AI 助教已接入模型，可自由对话、出题与批改；其余功能仍可离线使用。"
              : "未接入模型时全站功能均可离线使用，学习进度保存在本机浏览器。") + "</span>" +
          "</p>" +
          '<h1 class="hero-title">探索地理世界，<br>构建空间思维。</h1>' +
          '<p class="hero-sub">融合知识学习、互动实验与 AI 智能辅导的高中地理学习平台。</p>' +
          '<div class="hero-actions">' +
            '<a class="btn btn-primary" href="#/learn">开始学习</a>' +
            '<a class="btn btn-secondary" href="#/tutor">问 AI 助教</a>' +
          "</div>" +
          '<p class="hero-foot">人教版口径 · 打开即用 · 离线可用</p>' +
        "</div>" +
        '<div class="hero-visual">' + HERO_VISUAL + "</div>" +
      "</section>" +
      '<section class="home-section" aria-labelledby="home-modules-title">' +
        '<h2 class="section-title" id="home-modules-title">选择一个模块开始学习</h2>' +
        '<div class="module-grid">' + cards + "</div>" +
      "</section>" +
      '<section class="daily-banner card" aria-labelledby="daily-title">' +
        "<div>" +
          '<h2 id="daily-title">今日一练</h2>' +
          "<p>进入练习页随机组卷，即时判分并查看解析，帮你定位薄弱知识点。</p>" +
        "</div>" +
        '<a class="btn btn-accent" href="#/practice">进入练习</a>' +
      "</section>" +
      '<section class="home-section" aria-labelledby="howto-title">' +
        '<h2 class="section-title" id="howto-title">如何使用 GeoLab</h2>' +
        '<ol class="steps">' +
          "<li><p><strong>浏览知识卡</strong>：按「模块 → 知识点」阅读一句话定义、关键要点与常见误区，勾选「已掌握」记录学习进度。</p></li>" +
          "<li><p><strong>动手做练习</strong>：进入练习页选题组卷，客观题即时判分，错题进入错题本，方便针对性重练。</p></li>" +
          "<li><p><strong>随时问助教</strong>：在知识卡上点击「问助教」，带着预填好的问题向 AI 助教追问思路。</p></li>" +
        "</ol>" +
      "</section>";
  }

  /* ================= 学习页 ================= */

  function buildSelects(mod, point) {
    var moduleOptions = DATA.modules.map(function (m) {
      return (
        '<option value="' + escapeHtml(m.id) + '"' + (m.id === mod.id ? " selected" : "") + ">" +
        escapeHtml(m.title) + "</option>"
      );
    }).join("");
    var pointOptions = mod.points.map(function (p) {
      return (
        '<option value="' + escapeHtml(p.id) + '"' + (p.id === point.id ? " selected" : "") + ">" +
        escapeHtml(p.title) + "</option>"
      );
    }).join("");
    return (
      '<div class="learn-selects">' +
        "<div>" +
          '<label class="select-label" for="moduleSelect">选择模块</label>' +
          '<select class="select" id="moduleSelect">' + moduleOptions + "</select>" +
        "</div>" +
        "<div>" +
          '<label class="select-label" for="pointSelect">选择知识点</label>' +
          '<select class="select" id="pointSelect">' + pointOptions + "</select>" +
        "</div>" +
      "</div>"
    );
  }

  function buildSidebar(mod, point, mastery) {
    var groups = DATA.modules.map(function (m) {
      var isCurrentModule = m.id === mod.id;
      var html =
        '<div class="sidebar-group">' +
        '<a class="sidebar-module' + (isCurrentModule ? " current" : "") +
        '" href="#/learn/' + encodeURIComponent(m.id) + '">' + escapeHtml(m.title) + "</a>";
      if (isCurrentModule) {
        html += '<ul class="point-list">' + m.points.map(function (p, index) {
          var cls = "point-item";
          if (p.id === point.id) {
            cls += " current";
          }
          if (mastery[p.id]) {
            cls += " is-mastered";
          }
          return (
            "<li>" +
            '<a class="' + cls + '" href="#/learn/' + encodeURIComponent(m.id) + "/" +
              encodeURIComponent(p.id) + '" data-point-id="' + escapeHtml(p.id) + '">' +
              '<span class="point-index" aria-hidden="true">' + (index + 1) + "</span>" +
              '<span class="point-name">' + escapeHtml(p.title) + "</span>" +
              '<span class="point-check" aria-hidden="true" title="已掌握">✓</span>' +
            "</a>" +
            "</li>"
          );
        }).join("") + "</ul>";
      }
      return html + "</div>";
    }).join("");
    return (
      '<nav class="learn-sidebar-nav sidebar-nav" aria-label="模块与知识点导航">' +
      groups +
      "</nav>"
    );
  }

  function buildPager(mod, index) {
    var prev = index > 0 ? mod.points[index - 1] : null;
    var next = index < mod.points.length - 1 ? mod.points[index + 1] : null;
    function link(target, dir) {
      var arrow = dir === "prev" ? "‹ 上一个：" : "下一个：";
      return (
        '<a class="btn btn-ghost pager-btn" href="#/learn/' + encodeURIComponent(mod.id) + "/" +
          encodeURIComponent(target.id) + '">' +
          "<span>" + arrow + "</span>" +
          '<span class="pager-label">' + escapeHtml(target.title) + "</span>" +
        "</a>"
      );
    }
    return (
      '<nav class="point-pager" aria-label="上一个或下一个知识点">' +
      (prev ? link(prev, "prev") : '<span class="pager-spacer" aria-hidden="true"></span>') +
      (next ? link(next, "next") : '<span class="pager-spacer" aria-hidden="true"></span>') +
      "</nav>"
    );
  }

  function buildDemoSection() {
    var items = LAB_COMPONENTS.map(function (comp) {
      return (
        '<li class="demo-entry">' +
          '<div class="demo-entry-info">' +
            '<h3>' + escapeHtml(comp.name) +
              '<span class="badge demo-entry-badge">已接入 · 可操作</span></h3>' +
            "<p>" + escapeHtml(comp.desc) + "</p>" +
          "</div>" +
          '<button class="btn btn-secondary demo-entry-btn" type="button" data-lab-target="' +
            escapeHtml(comp.id) + '">去实验室</button>' +
        "</li>"
      );
    }).join("");
    return (
      '<section class="demo-section" aria-label="互动演示入口">' +
        '<h2 class="demo-title">动手做互动演示</h2>' +
        '<p class="demo-note">4 个互动组件均已接入「互动实验室」页面（只渲染一份）；点击下方按钮直达对应组件。</p>' +
        '<ul class="demo-entry-list">' + items + "</ul>" +
      "</section>"
    );
  }

  function buildKnowledgeCard(mod, point, mastery) {
    var count = masteredCount(mod, mastery);
    var pct = masteredPercent(mod, mastery);
    var pointIndex = mod.points.indexOf(point);
    var tutorQuestion =
      "请讲解「" + point.title + "」：先给结论，再讲推理过程，并指出这个知识点常见的解题误区。";
    var keyList = point.keyPoints.map(function (item) {
      return "<li><p>" + escapeHtml(item) + "</p></li>";
    }).join("");
    var pitfallList = point.pitfalls.map(function (item) {
      return "<li><p>" + escapeHtml(item) + "</p></li>";
    }).join("");

    return (
      '<article class="card knowledge-card">' +
        '<p class="card-eyebrow">' + escapeHtml(mod.title) +
          " · 第 " + (pointIndex + 1) + " / " + mod.points.length + " 个知识点</p>" +
        '<h1 class="knowledge-title">' + escapeHtml(point.title) + "</h1>" +
        '<p class="knowledge-summary">' + escapeHtml(point.summary) + "</p>" +
        '<p class="knowledge-progress">本模块已掌握 <strong id="masterCount">' + count +
          "</strong> / " + mod.points.length + " 个知识点（<span id=\"masterPct\">" + pct + "</span>%）</p>" +
        '<section aria-label="关键要点">' +
          "<h3>关键要点</h3>" +
          '<ul class="key-list">' + keyList + "</ul>" +
        "</section>" +
        '<section class="pitfall-box" aria-label="常见误区">' +
          "<h3>常见误区</h3>" +
          '<ul class="pitfall-list">' + pitfallList + "</ul>" +
        "</section>" +
        '<section class="example-box" aria-label="典型案例或生活场景">' +
          "<h3>典型案例 / 生活场景</h3>" +
          "<p>" + escapeHtml(point.example) + "</p>" +
        "</section>" +
        '<div class="card-actions">' +
          '<label class="master-toggle">' +
            '<input type="checkbox" id="masterToggle"' + (mastery[point.id] ? " checked" : "") + ">" +
            "<span>已掌握这个知识点</span>" +
          "</label>" +
          '<a class="btn btn-secondary" href="#/tutor?q=' + encodeURIComponent(tutorQuestion) +
            '" data-prefill="' + encodeURIComponent(tutorQuestion) + '">问助教</a>' +
        "</div>" +
      "</article>" +
        buildPager(mod, pointIndex) +
        buildDemoSection()
    );
  }

  function bindLearnEvents(mod, point) {
    var moduleSelect = document.getElementById("moduleSelect");
    var pointSelect = document.getElementById("pointSelect");
    if (moduleSelect) {
      moduleSelect.addEventListener("change", function () {
        window.location.hash = "#/learn/" + encodeURIComponent(moduleSelect.value);
      });
    }
    if (pointSelect) {
      pointSelect.addEventListener("change", function () {
        window.location.hash =
          "#/learn/" + encodeURIComponent(mod.id) + "/" + encodeURIComponent(pointSelect.value);
      });
    }

    var toggle = document.getElementById("masterToggle");
    if (toggle) {
      toggle.addEventListener("change", function () {
        var map = readMastery();
        if (toggle.checked) {
          map[point.id] = true;
        } else {
          delete map[point.id];
        }
        writeMastery(map);

        var safeId = (window.CSS && CSS.escape) ? CSS.escape(point.id) : point.id;
        var item = viewEl.querySelector('.point-item[data-point-id="' + safeId + '"]');
        if (item) {
          item.classList.toggle("is-mastered", toggle.checked);
        }
        var countEl = document.getElementById("masterCount");
        if (countEl) {
          countEl.textContent = String(masteredCount(mod, map));
        }
        var pctEl = document.getElementById("masterPct");
        if (pctEl) {
          pctEl.textContent = String(masteredPercent(mod, map));
        }
      });
    }

    var askButton = viewEl.querySelector("[data-prefill]");
    if (askButton) {
      askButton.addEventListener("click", function () {
        var encoded = askButton.getAttribute("data-prefill") || "";
        var question = "";
        try {
          question = decodeURIComponent(encoded);
        } catch (err) {
          question = "";
        }
        storageSet(window.sessionStorage, KEY_TUTOR_PREFILL, question);
      });
    }

    /* 互动演示入口卡：跳转实验室并定位对应组件 */
    var labButtons = viewEl.querySelectorAll("[data-lab-target]");
    Array.prototype.slice.call(labButtons).forEach(function (button) {
      button.addEventListener("click", function () {
        var target = button.getAttribute("data-lab-target") || "";
        window.location.hash = "#/lab?focus=" + encodeURIComponent(target);
      });
    });
  }

  function renderLearn(segments) {
    var mod =
      (segments.length > 1 && findModule(segments[1])) ||
      DATA.modules[0];
    var point =
      (segments.length > 2 && findPoint(mod, segments[2])) ||
      mod.points[0];
    var mastery = readMastery();

    viewEl.innerHTML =
      '<div class="learn-layout">' +
        buildSelects(mod, point) +
        buildSidebar(mod, point, mastery) +
        '<div class="learn-content">' + buildKnowledgeCard(mod, point, mastery) + "</div>" +
      "</div>";

    bindLearnEvents(mod, point);
  }

  /* ================= 互动实验室 ================= */

  function scrollToLabTarget(id) {
    if (!id) {
      return;
    }
    var target = document.getElementById("lab-" + id);
    if (target && typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ block: "start" });
    }
  }

  /* 已接入的互动组件：实验室卡片内直接挂载（#/lab 中 data-demo-id 与组件 id 对应） */
  var LAB_DEMO_MOUNTS = {
    timezone: '<div class="demo-mount" data-demo-id="timezone"></div>',
    climate: '<div class="demo-mount" data-demo-id="climate"></div>',
    contour: '<div class="demo-mount" data-demo-id="contour"></div>',
    earthmotion: '<div class="demo-mount" data-demo-id="earth"></div>'
  };

  function buildLabCard(comp) {
    var mountHtml = LAB_DEMO_MOUNTS[comp.id] || "";
    var isLive = mountHtml !== "";
    var badge = isLive
      ? '<span class="badge">已接入 · 可操作</span>'
      : '<span class="badge badge-accent">后续轮次接入</span>';
    var body = isLive
      ? mountHtml
      : '<p class="lab-plan">' +
          escapeHtml(LAB_PLANS[comp.id] || "该互动组件将在后续轮次接入，敬请期待。") +
        "</p>";
    return (
      '<section class="card lab-card" id="lab-' + escapeHtml(comp.id) +
        '" aria-labelledby="lab-' + escapeHtml(comp.id) + '-title">' +
        '<header class="lab-card-head">' +
          '<h2 class="lab-card-title" id="lab-' + escapeHtml(comp.id) + '-title">' +
            escapeHtml(comp.name) + "</h2>" +
          badge +
        "</header>" +
        '<p class="lab-lede">' + escapeHtml(comp.desc) + "</p>" +
        body +
      "</section>"
    );
  }

  function renderLab(query) {
    var focusId = "";
    if (query && typeof query.focus === "string") {
      for (var i = 0; i < LAB_COMPONENTS.length; i += 1) {
        if (LAB_COMPONENTS[i].id === query.focus) {
          focusId = query.focus;
          break;
        }
      }
    }

    var anchorButtons = LAB_COMPONENTS.map(function (comp) {
      return (
        '<button type="button" data-lab-target="' + escapeHtml(comp.id) + '">' +
          escapeHtml(comp.name) + "</button>"
      );
    }).join("");

    viewEl.innerHTML =
      '<header class="lab-hero page-head">' +
        '<h1 class="lab-title">互动实验室</h1>' +
        '<p class="lab-sub">4 个互动演示组件集中在本页，均已接入、可操作、不联网，每个组件即时反馈。点击下方锚点可直达对应卡片。</p>' +
      "</header>" +
      '<nav class="lab-anchor-nav" aria-label="实验室组件锚点导航">' + anchorButtons + "</nav>" +
      LAB_COMPONENTS.map(buildLabCard).join("");

    if (window.GeoLabInteractive && typeof window.GeoLabInteractive.mountAll === "function") {
      try {
        window.GeoLabInteractive.mountAll(viewEl);
      } catch (err) {
        /* 组件挂载失败时保留卡片说明文字，不影响页面其余部分 */
      }
    }

    var buttons = viewEl.querySelectorAll(".lab-anchor-nav button");
    Array.prototype.slice.call(buttons).forEach(function (button) {
      button.addEventListener("click", function () {
        scrollToLabTarget(button.getAttribute("data-lab-target") || "");
      });
    });

    if (focusId) {
      /* 等路由的「回到顶部」执行后再定位目标卡片 */
      window.setTimeout(function () {
        scrollToLabTarget(focusId);
      }, 0);
    }
  }

  /* ================= 助教（js/tutor.js 提供完整聊天视图） ================= */

  function renderTutor(query) {
    if (window.GeoLabTutor && typeof window.GeoLabTutor.mount === "function") {
      window.GeoLabTutor.mount(viewEl, { query: query || {} });
      return;
    }

    /* 兜底：tutor.js 未加载时给出可读说明，不抛异常 */
    var question = "";
    if (query && typeof query.q === "string" && query.q.length > 0) {
      question = query.q;
    } else {
      var stored = storageGet(window.sessionStorage, KEY_TUTOR_PREFILL);
      if (stored) {
        question = stored;
      }
    }
    var prefillHtml = "";
    if (question) {
      prefillHtml =
        '<div class="prefill-box" role="status">已带入预填问题：「' + escapeHtml(question) +
        "」。请确认 js/tutor.js 已正确加载后刷新页面。</div>";
    }

    viewEl.innerHTML =
      '<section class="card feature-page">' +
        '<p class="card-eyebrow">AI 助教</p>' +
        '<h1 class="feature-title">向 AI 助教提问</h1>' +
        '<p class="feature-lede">AI 助教按高中地理教师的人设回答问题：先给结论，再给推理链；使用人教版教材口径，不超纲、不编造数据。</p>' +
        '<ul class="feature-list">' +
          "<li>答疑：讲清概念与原理，例如「为什么地中海气候夏季干燥、冬季多雨」。</li>" +
          "<li>出题：按知识点与难度出题，附答案与解析。</li>" +
          "<li>批改：对照参考答案，指出简答题的失分点。</li>" +
          "<li>讲思路：拆解判读类题目，如「以温定带、以水定型」。</li>" +
        "</ul>" +
        prefillHtml +
        '<p class="feature-note">聊天界面未能加载，请检查 index.html 中是否引入了 js/tutor.js。</p>' +
        '<div class="feature-actions">' +
          '<a class="btn btn-secondary" href="#/home">返回首页</a>' +
          '<a class="btn btn-ghost" href="#/learn">继续学习</a>' +
        "</div>" +
      "</section>";
  }

  /* ================= 练习（js/quiz.js 提供完整视图） ================= */

  function renderPractice() {
    if (window.GeoLabQuiz && typeof window.GeoLabQuiz.renderPractice === "function") {
      window.GeoLabQuiz.renderPractice(viewEl);
      return;
    }

    /* 兜底：quiz.js 未加载时给出可读说明，不抛异常 */
    viewEl.innerHTML =
      '<section class="card feature-page">' +
        '<p class="card-eyebrow">练习与诊断</p>' +
        '<h1 class="feature-title">章节练习与错题本</h1>' +
        '<p class="feature-lede">练习页用于检验学习效果：按模块、知识点标签、难度与题量组卷，也可以一键随机组卷；答题后即时判分并给出解析。</p>' +
        '<p class="feature-note">练习模块未能加载，请检查 index.html 中是否引入了 data/quiz.js 与 js/quiz.js。</p>' +
        '<div class="feature-actions">' +
          '<a class="btn btn-secondary" href="#/home">返回首页</a>' +
          '<a class="btn btn-ghost" href="#/learn">先去学习</a>' +
        "</div>" +
      "</section>";
  }

  /* ================= 报告（js/quiz.js 提供完整视图） ================= */

  function renderReport() {
    if (window.GeoLabQuiz && typeof window.GeoLabQuiz.renderReport === "function") {
      window.GeoLabQuiz.renderReport(viewEl);
      return;
    }

    viewEl.innerHTML =
      '<section class="card feature-page">' +
        '<p class="card-eyebrow">学习报告</p>' +
        '<h1 class="feature-title">学习报告与薄弱点分析</h1>' +
        '<p class="feature-lede">报告页汇总本机的练习记录，帮你判断复习重点；它完全基于本机数据生成，不联网、不上传。</p>' +
        '<p class="feature-note">报告模块未能加载，请检查 index.html 中是否引入了 data/quiz.js 与 js/quiz.js。</p>' +
        '<div class="feature-actions">' +
          '<a class="btn btn-secondary" href="#/home">返回首页</a>' +
          '<a class="btn btn-ghost" href="#/practice">先做一组练习</a>' +
        "</div>" +
      "</section>";
  }

  /* ================= 启动 ================= */

  /* 顶栏与首页的「当前模式」徽标：启动时探测 /api/health（file:// 或未启动服务时保持离线） */
  function syncModeBadge() {
    /* file:// 直接打开时不发起任何网络探测，避免控制台出现 ERR_FILE_NOT_FOUND */
    if (window.location.protocol !== "http:" && window.location.protocol !== "https:") {
      return;
    }
    var badge = document.getElementById("modeBadge");
    try {
      fetch("/api/health", { cache: "no-store" })
        .then(function (res) {
          return res.ok ? res.json() : null;
        })
        .then(function (info) {
          if (!info || !info.ok || !info.mode || info.mode === "offline") {
            return;
          }
          liveMode = info.mode;
          if (badge) {
            badge.setAttribute("data-live", "true");
            badge.title = "AI 助教已接入模型" + (info.model ? "：" + info.model : "");
            var label = badge.querySelector(".mode-label");
            var note = badge.querySelector(".mode-note");
            if (label) {
              label.textContent = "AI 已连接";
            } else {
              badge.textContent = "AI 已连接";
            }
            if (note) {
              note.textContent = "模型已就绪";
            }
          }
          if ((window.location.hash || "").replace(/^#\//, "").split("?")[0] === "home") {
            renderRoute();
          }
        })
        .catch(function () {
          /* file:// 或服务未启动：保持离线徽标 */
        });
    } catch (err) {
      /* 忽略：保持离线徽标 */
    }
  }

  function init() {
    if (!DATA_OK) {
      viewEl.innerHTML =
        '<section class="empty-state">' +
          "<h2>知识数据未加载</h2>" +
          "<p>未找到 window.GEO_DATA，请确认 data/knowledge.js 在 js/app.js 之前引入。</p>" +
          '<a class="btn btn-secondary" href="#/home">返回首页</a>' +
        "</section>";
      return;
    }
    /* 跳转链接：JS 启用时改为程序化聚焦主内容，避免 #view 污染 hash 被误判为未知路由 */
    if (skipLink) {
      skipLink.addEventListener("click", function (event) {
        event.preventDefault();
        viewEl.focus();
      });
    }
    /* 视图切换后把焦点移到主内容区，方便屏幕阅读器播报新视图；初始加载不抢首屏焦点 */
    window.addEventListener("hashchange", function () {
      renderRoute();
      viewEl.focus({ preventScroll: true });
    });
    if (!window.location.hash) {
      window.location.replace("#/home");
    }
    renderRoute();
    syncModeBadge();
  }

  init();
})();
