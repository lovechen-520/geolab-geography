/* GeoLab · 练习、判分、错题本与学习报告
   由 js/app.js 的 #/practice、#/report 视图调用：
     window.GeoLabQuiz.renderPractice(root)
     window.GeoLabQuiz.renderReport(root)
     window.GeoLabQuiz.destroy()
   数据：window.GEO_DATA（知识点）+ window.GEO_QUIZ（题库）
   存储：localStorage geolab.wrong.v1 / geolab.sessions.v1
   所有动态文本插入前均经 escapeHtml 转义。 */

(function () {
  "use strict";

  var DATA = window.GEO_DATA;
  var BANK = Array.isArray(window.GEO_QUIZ) ? window.GEO_QUIZ : [];

  var KEY_WRONG = "geolab.wrong.v1";
  var KEY_SESSIONS = "geolab.sessions.v1";
  var MAX_SESSIONS = 200;

  var TYPE_LABEL = { single: "单选", multiple: "多选", judge: "判断", short: "简答" };
  var DIFF_LABEL = { 1: "基础", 2: "进阶", 3: "挑战" };

  var MODULES = [];
  var POINT_MAP = {};
  var QUESTION_MAP = {};

  (function buildIndexes() {
    if (!DATA || !Array.isArray(DATA.modules)) {
      return;
    }
    DATA.modules.forEach(function (mod) {
      MODULES.push(mod);
      mod.points.forEach(function (point) {
        POINT_MAP[point.id] = { point: point, module: mod };
      });
    });
    BANK.forEach(function (q) {
      QUESTION_MAP[q.id] = q;
    });
  })();

  var rootEl = null;
  var state = null;
  var timerId = null;

  /* ================= 工具 ================= */

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function storageGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (err) {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (err) {
      /* 隐私模式下写入失败：本次会话仍可正常答题 */
    }
  }

  function readJson(key, fallback) {
    var raw = storageGet(key);
    if (!raw) {
      return fallback;
    }
    try {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch (err) {
      /* 数据损坏时回退为空 */
    }
    return fallback;
  }

  function shuffle(list) {
    var arr = list.slice();
    for (var i = arr.length - 1; i > 0; i -= 1) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function formatDuration(seconds) {
    var sec = Math.max(0, Math.round(seconds));
    var min = Math.floor(sec / 60);
    var rest = sec % 60;
    if (min <= 0) {
      return sec + " 秒";
    }
    return min + " 分 " + pad2(rest) + " 秒";
  }

  function formatClock(seconds) {
    var sec = Math.max(0, Math.round(seconds));
    return pad2(Math.floor(sec / 60)) + ":" + pad2(sec % 60);
  }

  function formatDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) {
      return "时间未知";
    }
    return (d.getMonth() + 1) + " 月 " + d.getDate() + " 日 " + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }

  function dateKey(d) {
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function pointTitle(pointId) {
    return POINT_MAP[pointId] ? POINT_MAP[pointId].point.title : "未标注知识点";
  }

  function moduleTitle(moduleId) {
    for (var i = 0; i < MODULES.length; i += 1) {
      if (MODULES[i].id === moduleId) {
        return MODULES[i].title;
      }
    }
    return "综合";
  }

  function truncate(text, max) {
    var str = String(text);
    return str.length > max ? str.slice(0, max) + "…" : str;
  }

  function stopTimer() {
    if (timerId !== null) {
      window.clearInterval(timerId);
      timerId = null;
    }
  }

  /* ================= 设置页 ================= */

  function getSettingsPoints() {
    var mods = state.settings.modules;
    var list = [];
    MODULES.forEach(function (mod) {
      if (mods.length > 0 && mods.indexOf(mod.id) === -1) {
        return;
      }
      mod.points.forEach(function (point) {
        list.push({ point: point, module: mod });
      });
    });
    return list;
  }

  function getPool() {
    var s = state.settings;
    return BANK.filter(function (q) {
      if (s.modules.length > 0 && s.modules.indexOf(q.moduleId) === -1) {
        return false;
      }
      if (s.points.length > 0 && s.points.indexOf(q.pointId) === -1) {
        return false;
      }
      if (s.difficulty > 0 && q.difficulty !== s.difficulty) {
        return false;
      }
      return true;
    });
  }

  function shell(active, bodyHtml) {
    var wrongCount = Object.keys(readWrong()).length;
    return (
      '<div class="qz-page">' +
        '<header class="card qz-head">' +
          '<div>' +
            '<p class="card-eyebrow">练习与诊断</p>' +
            '<h1 class="qz-title">练一组，找出真正的薄弱点</h1>' +
            '<p class="qz-sub">按模块、知识点与难度组卷，客观题即时判分、简答题按关键词给分；错题自动进入错题本，成绩计入学习报告。</p>' +
          "</div>" +
          '<span class="badge qz-bank-badge">题库共 ' + BANK.length + " 题</span>" +
        "</header>" +
        '<nav class="qz-tabs" aria-label="练习与错题本">' +
          '<button type="button" class="qz-tab' + (active === "practice" ? " is-active" : "") +
            '" data-qz-tab="practice">练习</button>' +
          '<button type="button" class="qz-tab' + (active === "wrong" ? " is-active" : "") +
            '" data-qz-tab="wrong">错题本（' + wrongCount + "）</button>" +
        "</nav>" +
        '<div class="qz-body">' + bodyHtml + "</div>" +
      "</div>"
    );
  }

  function moduleChipHtml(mod) {
    var on = state.settings.modules.indexOf(mod.id) !== -1;
    return (
      '<label class="qz-chip' + (on ? " is-on" : "") + '">' +
        '<input type="checkbox" data-qz-module="' + escapeHtml(mod.id) + '"' + (on ? " checked" : "") + ">" +
        "<span>" + escapeHtml(mod.title.split(" · ")[0]) + "</span>" +
      "</label>"
    );
  }

  function pointChipHtml(item) {
    var on = state.settings.points.indexOf(item.point.id) !== -1;
    return (
      '<label class="qz-chip qz-chip-point' + (on ? " is-on" : "") + '">' +
        '<input type="checkbox" data-qz-point="' + escapeHtml(item.point.id) + '"' + (on ? " checked" : "") + ">" +
        "<span>" + escapeHtml(item.point.title) + "</span>" +
      "</label>"
    );
  }

  function renderSettings() {
    var pool = getPool();
    var points = getSettingsPoints();
    var s = state.settings;

    var moduleHtml = MODULES.map(moduleChipHtml).join("");
    var pointHtml = points.map(pointChipHtml).join("");

    var diffHtml = [
      { v: 0, label: "全部" },
      { v: 1, label: "基础" },
      { v: 2, label: "进阶" },
      { v: 3, label: "挑战" }
    ].map(function (item) {
      return (
        '<label class="qz-chip' + (s.difficulty === item.v ? " is-on" : "") + '">' +
          '<input type="radio" name="qzDiff" value="' + item.v + '"' +
            (s.difficulty === item.v ? " checked" : "") + ">" +
          "<span>" + item.label + "</span>" +
        "</label>"
      );
    }).join("");

    var countHtml = [5, 10, 15].map(function (n) {
      return (
        '<label class="qz-chip' + (s.count === n ? " is-on" : "") + '">' +
          '<input type="radio" name="qzCount" value="' + n + '"' + (s.count === n ? " checked" : "") + ">" +
          "<span>" + n + " 题</span>" +
        "</label>"
      );
    }).join("");

    var notice = "";
    if (pool.length === 0) {
      notice = '<p class="qz-notice is-warn" role="status">当前筛选条件下没有可用题目，请放宽模块、知识点或难度条件。</p>';
    } else if (pool.length < s.count) {
      notice = '<p class="qz-notice is-warn" role="status">当前条件下可用 ' + pool.length +
        " 题，不足 " + s.count + " 题，将自动调整为 " + pool.length + " 题。</p>";
    }

    var body =
      '<section class="card qz-setup" aria-labelledby="qz-setup-title">' +
        '<h2 class="qz-step-title" id="qz-setup-title"><span class="qz-step-num">1</span>选择范围</h2>' +
        '<div class="qz-field">' +
          '<p class="qz-label">模块<button type="button" class="qz-link-btn" data-qz-action="modules-all">全选全部模块</button></p>' +
          '<div class="qz-chip-row">' + moduleHtml + "</div>" +
        "</div>" +
        '<div class="qz-field">' +
          '<p class="qz-label">知识点<button type="button" class="qz-link-btn" data-qz-action="points-all">不筛选（全部知识点）</button></p>' +
          '<div class="qz-chip-row qz-chip-row-points">' + pointHtml + "</div>" +
        "</div>" +
        '<h2 class="qz-step-title"><span class="qz-step-num">2</span>难度与题量</h2>' +
        '<div class="qz-field qz-field-inline">' +
          '<p class="qz-label">难度</p>' +
          '<div class="qz-chip-row">' + diffHtml + "</div>" +
        "</div>" +
        '<div class="qz-field qz-field-inline">' +
          '<p class="qz-label">题量</p>' +
          '<div class="qz-chip-row">' + countHtml + "</div>" +
        "</div>" +
        notice +
        '<div class="qz-setup-step qz-setup-final">' +
          '<h2 class="qz-step-title"><span class="qz-step-num">3</span>生成并开始</h2>' +
          '<div class="qz-availability">' +
            '<span>当前筛选可用 <strong>' + pool.length + "</strong> 题</span>" +
            '<span class="qz-hint">组卷后按题目随机排序，不重复抽题</span>' +
          "</div>" +
          '<div class="qz-actions">' +
            '<button type="button" class="btn btn-primary" data-qz-action="start"' +
              (pool.length === 0 ? " disabled" : "") + ">随机组卷并开始</button>" +
            '<button type="button" class="btn btn-ghost" data-qz-action="reset">重置筛选</button>' +
            '<button type="button" class="btn btn-secondary" data-qz-action="wrong-open">查看错题本</button>' +
          "</div>" +
        "</div>" +
      "</section>";

    rootEl.innerHTML = shell("practice", body);
    bindTabs();
    bindSettings();
  }

  function bindSettings() {
    Array.prototype.slice.call(rootEl.querySelectorAll("[data-qz-module]")).forEach(function (input) {
      input.addEventListener("change", function () {
        var id = input.getAttribute("data-qz-module");
        var idx = state.settings.modules.indexOf(id);
        if (input.checked && idx === -1) {
          state.settings.modules.push(id);
        } else if (!input.checked && idx !== -1) {
          state.settings.modules.splice(idx, 1);
        }
        /* 移除已不属于所选模块的知识点 */
        var valid = getSettingsPoints().map(function (item) { return item.point.id; });
        state.settings.points = state.settings.points.filter(function (pid) {
          return valid.indexOf(pid) !== -1;
        });
        renderSettings();
      });
    });

    Array.prototype.slice.call(rootEl.querySelectorAll("[data-qz-point]")).forEach(function (input) {
      input.addEventListener("change", function () {
        var id = input.getAttribute("data-qz-point");
        var idx = state.settings.points.indexOf(id);
        if (input.checked && idx === -1) {
          state.settings.points.push(id);
        } else if (!input.checked && idx !== -1) {
          state.settings.points.splice(idx, 1);
        }
        renderSettings();
      });
    });

    Array.prototype.slice.call(rootEl.querySelectorAll('input[name="qzDiff"]')).forEach(function (input) {
      input.addEventListener("change", function () {
        state.settings.difficulty = Number(input.value) || 0;
        renderSettings();
      });
    });

    Array.prototype.slice.call(rootEl.querySelectorAll('input[name="qzCount"]')).forEach(function (input) {
      input.addEventListener("change", function () {
        state.settings.count = Number(input.value) || 10;
        renderSettings();
      });
    });

    var actions = {
      "modules-all": function () {
        state.settings.modules = [];
        state.settings.points = [];
        renderSettings();
      },
      "points-all": function () {
        state.settings.points = [];
        renderSettings();
      },
      start: startQuiz,
      reset: function () {
        state.settings.modules = [];
        state.settings.points = [];
        state.settings.difficulty = 0;
        state.settings.count = 10;
        renderSettings();
      },
      "wrong-open": function () {
        state.mode = "wrong";
        renderWrong();
      }
    };
    bindActions(actions);
  }

  function bindActions(actions) {
    Array.prototype.slice.call(rootEl.querySelectorAll("[data-qz-action]")).forEach(function (button) {
      button.addEventListener("click", function () {
        var key = button.getAttribute("data-qz-action");
        if (actions[key]) {
          actions[key](button);
        }
      });
    });
  }

  function bindTabs() {
    Array.prototype.slice.call(rootEl.querySelectorAll("[data-qz-tab]")).forEach(function (button) {
      button.addEventListener("click", function () {
        var tab = button.getAttribute("data-qz-tab");
        if (tab === "wrong") {
          if (state.mode === "quiz" && !window.confirm("练习尚未完成，切换到错题本将结束本次练习，确定继续？")) {
            return;
          }
          stopTimer();
          state.mode = "wrong";
          renderWrong();
        } else {
          if (state.mode === "quiz" && !window.confirm("练习尚未完成，返回设置将结束本次练习，确定继续？")) {
            return;
          }
          stopTimer();
          state.mode = "settings";
          renderSettings();
        }
      });
    });
  }

  /* ================= 组卷与答题 ================= */

  function startQuiz() {
    var pool = getPool();
    if (pool.length === 0) {
      renderSettings();
      return;
    }
    var wanted = state.settings.count;
    var actual = Math.min(wanted, pool.length);
    var questions = shuffle(pool).slice(0, actual);
    state.quiz = {
      questions: questions,
      index: 0,
      picks: [],
      submitted: [],
      startAt: Date.now(),
      elapsed: 0,
      reviewWrong: false,
      settings: {
        modules: state.settings.modules.slice(),
        points: state.settings.points.slice(),
        difficulty: state.settings.difficulty,
        count: state.settings.count
      },
      degradeNote: actual < wanted ? "可用题数不足，本次已调整为 " + actual + " 题。" : ""
    };
    state.mode = "quiz";
    stopTimer();
    timerId = window.setInterval(updateTimer, 500);
    renderQuiz();
  }

  function startWrongQuiz(ids) {
    var questions = ids.map(function (id) { return QUESTION_MAP[id]; }).filter(Boolean);
    if (questions.length === 0) {
      return;
    }
    state.quiz = {
      questions: shuffle(questions),
      index: 0,
      picks: [],
      submitted: [],
      startAt: Date.now(),
      elapsed: 0,
      reviewWrong: true,
      settings: {
        modules: [],
        points: [],
        difficulty: 0,
        count: questions.length
      },
      degradeNote: ""
    };
    state.mode = "quiz";
    stopTimer();
    timerId = window.setInterval(updateTimer, 500);
    renderQuiz();
  }

  function updateTimer() {
    if (!state.quiz || state.mode !== "quiz") {
      return;
    }
    var el = document.getElementById("qzTimer");
    if (el) {
      el.textContent = formatClock((Date.now() - state.quiz.startAt) / 1000);
    }
  }

  function selectedAnswer(q) {
    if (q.type === "short") {
      var area = document.getElementById("qzShort");
      return area && area.value.trim() ? area.value.trim() : null;
    }
    var inputs = rootEl.querySelectorAll('input[name="qzOpt"]:checked');
    var values = Array.prototype.slice.call(inputs).map(function (input) {
      return Number(input.value);
    });
    if (q.type === "multiple") {
      values.sort(function (a, b) { return a - b; });
      return values.length > 0 ? values : null;
    }
    return values.length > 0 ? values[0] : null;
  }

  function normalizeKeyword(text) {
    return String(text)
      .toLowerCase()
      .replace(/[\s、，。；：,.;:!?！？（）()「」“”"'\-\/]/g, "");
  }

  function shortHit(q, text) {
    var input = normalizeKeyword(text);
    var hit = 0;
    q.answer.forEach(function (keyword) {
      var key = normalizeKeyword(keyword);
      if (key && (input.indexOf(key) !== -1 || input.indexOf(key.replace(/的/g, "")) !== -1)) {
        hit += 1;
      }
    });
    return { hit: hit, total: q.answer.length, pass: hit / q.answer.length >= 0.6 };
  }

  function judgeAnswer(q, picked) {
    if (q.type === "short") {
      var res = shortHit(q, picked);
      return { correct: res.pass, hit: res.hit, total: res.total };
    }
    if (q.type === "multiple") {
      var expected = q.answer.slice().sort(function (a, b) { return a - b; });
      var actual = picked.slice().sort(function (a, b) { return a - b; });
      return {
        correct: expected.length === actual.length && expected.every(function (v, i) { return v === actual[i]; }),
        hit: 0,
        total: 0
      };
    }
    return { correct: picked === q.answer, hit: 0, total: 0 };
  }

  function answerText(q, answer) {
    if (q.type === "short") {
      return q.answer.join("、");
    }
    if (q.type === "multiple") {
      return answer.map(function (i) { return q.options[i]; }).join("、");
    }
    return q.options[answer];
  }

  function renderQuiz() {
    var quiz = state.quiz;
    var q = quiz.questions[quiz.index];
    var total = quiz.questions.length;
    var submitted = quiz.submitted[quiz.index];
    var picked = quiz.picks[quiz.index];

    var progress = Math.round(((quiz.index + (submitted ? 1 : 0)) / total) * 100);

    var optionsHtml = "";
    if (q.type === "short") {
      optionsHtml =
        '<label class="qz-short-label" for="qzShort">你的答案（可写要点，系统按关键词命中率判分）</label>' +
        '<textarea class="qz-textarea" id="qzShort" rows="5" placeholder="用自己的话分点作答…"' +
          (submitted ? " disabled" : "") + ">" + (submitted && picked ? escapeHtml(picked) : "") + "</textarea>";
    } else {
      var inputType = q.type === "multiple" ? "checkbox" : "radio";
      var pickedList = picked === null || picked === undefined
        ? []
        : (Array.isArray(picked) ? picked : [picked]);
      optionsHtml = '<div class="qz-options" role="group" aria-label="选项">' +
        q.options.map(function (option, index) {
          var checked = pickedList.indexOf(index) !== -1;
          var cls = "qz-option";
          if (submitted) {
            cls += " is-locked";
            var isRight = q.type === "multiple"
              ? q.answer.indexOf(index) !== -1
              : q.answer === index;
            if (isRight) {
              cls += " is-correct";
            } else if (checked) {
              cls += " is-wrong";
            }
          } else if (checked) {
            cls += " is-checked";
          }
          return (
            '<label class="' + cls + '">' +
              '<input type="' + inputType + '" name="qzOpt" value="' + index + '"' +
                (checked ? " checked" : "") + (submitted ? " disabled" : "") + ">" +
              '<span class="qz-option-key">' + String.fromCharCode(65 + index) + "</span>" +
              '<span class="qz-option-text">' + escapeHtml(option) + "</span>" +
            "</label>"
          );
        }).join("") + "</div>";
      if (q.type === "multiple" && !submitted) {
        optionsHtml += '<p class="qz-hint">多选题需选出全部正确选项，少选或多选均不得分。</p>';
      }
    }

    var feedback = "";
    if (submitted) {
      var markText = submitted.correct ? "回答正确" : "回答错误";
      var extra = "";
      if (q.type === "short") {
        extra = "关键词命中 " + submitted.hit + " / " + submitted.total + "（命中率 ≥ 60% 判为正确）";
      }
      feedback =
        '<div class="qz-feedback ' + (submitted.correct ? "is-right" : "is-wrong") + '" role="status">' +
          '<p class="qz-feedback-mark">' + markText + (extra ? '<span class="qz-feedback-extra">' + extra + "</span>" : "") + "</p>" +
          '<p class="qz-answer-line"><strong>正确答案：</strong>' + escapeHtml(answerText(q, q.answer)) + "</p>" +
          (q.type === "short" && picked
            ? '<p class="qz-answer-line"><strong>你的作答：</strong>' + escapeHtml(picked) + "</p>"
            : "") +
          '<p class="qz-analysis"><strong>解析：</strong>' + escapeHtml(q.analysis) + "</p>" +
          '<p class="qz-point-tag">知识点：' + escapeHtml(pointTitle(q.pointId)) + "</p>" +
        "</div>";
    }

    var timerText = formatClock(quiz.elapsed);
    if (quiz.startAt) {
      timerText = formatClock((Date.now() - quiz.startAt) / 1000);
    }

    var body =
      '<section class="card qz-quiz" aria-labelledby="qz-question-title">' +
        '<div class="qz-quiz-top">' +
          '<span class="qz-progress-text">第 <strong>' + (quiz.index + 1) + "</strong> / " + total + " 题</span>" +
          '<span class="qz-quiz-meta">' +
            '<span class="qz-type qz-type-' + q.type + '">' + TYPE_LABEL[q.type] + "</span>" +
            '<span class="qz-diff qz-diff-' + q.difficulty + '">' + DIFF_LABEL[q.difficulty] + "</span>" +
          "</span>" +
          '<span class="qz-timer" aria-label="已用时"><span id="qzTimer">' + timerText + "</span></span>" +
          '<button type="button" class="qz-link-btn" data-qz-action="exit">退出</button>' +
        "</div>" +
        '<div class="qz-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + progress + '">' +
          '<span style="width:' + progress + '%"></span>' +
        "</div>" +
        (quiz.degradeNote ? '<p class="qz-notice" role="status">' + escapeHtml(quiz.degradeNote) + "</p>" : "") +
        '<p class="qz-question-point">' + escapeHtml(moduleTitle(q.moduleId)) + " · " + escapeHtml(pointTitle(q.pointId)) + "</p>" +
        '<h2 class="qz-question" id="qz-question-title">' + escapeHtml(q.question) + "</h2>" +
        optionsHtml +
        '<p class="qz-inline-notice" id="qzInlineNotice" role="status"></p>' +
        feedback +
        '<div class="qz-actions">' +
          (submitted
            ? '<button type="button" class="btn btn-primary" data-qz-action="next">' +
                (quiz.index === total - 1 ? "查看结果" : "下一题") + "</button>"
            : '<button type="button" class="btn btn-primary" data-qz-action="submit">提交本题</button>') +
          '<button type="button" class="btn btn-ghost" data-qz-action="exit">退出练习</button>' +
        "</div>" +
      "</section>";

    rootEl.innerHTML = shell("practice", body);

    bindTabs();
    bindActions({
      submit: submitQuestion,
      next: nextQuestion,
      exit: exitQuiz
    });
  }

  function exitQuiz() {
    if (!window.confirm("退出本次练习？已答题目不会计入学习报告。")) {
      return;
    }
    stopTimer();
    state.quiz = null;
    state.mode = "settings";
    renderSettings();
  }

  function submitQuestion() {
    var quiz = state.quiz;
    if (!quiz || quiz.submitted[quiz.index]) {
      return;
    }
    var q = quiz.questions[quiz.index];
    var picked = selectedAnswer(q);
    if (picked === null || picked === undefined || (Array.isArray(picked) && picked.length === 0)) {
      var notice = document.getElementById("qzInlineNotice");
      if (notice) {
        notice.textContent = "请先作答，再提交本题。";
        notice.classList.add("is-visible");
      }
      return;
    }
    var result = judgeAnswer(q, picked);
    quiz.picks[quiz.index] = picked;
    quiz.submitted[quiz.index] = {
      correct: result.correct,
      hit: result.hit,
      total: result.total
    };

    if (!result.correct) {
      addWrong(q, picked);
    } else {
      removeWrong(q.id);
    }
    renderQuiz();
  }

  function nextQuestion() {
    var quiz = state.quiz;
    if (!quiz) {
      return;
    }
    if (quiz.index >= quiz.questions.length - 1) {
      finishQuiz();
      return;
    }
    quiz.index += 1;
    renderQuiz();
  }

  /* ================= 错题本存储 ================= */

  function readWrong() {
    var map = readJson(KEY_WRONG, {});
    return map && typeof map === "object" ? map : {};
  }

  function writeWrong(map) {
    storageSet(KEY_WRONG, JSON.stringify(map));
  }

  function addWrong(q, picked) {
    var map = readWrong();
    var prev = map[q.id];
    map[q.id] = {
      id: q.id,
      count: prev && prev.count ? prev.count + 1 : 1,
      last: new Date().toISOString(),
      answer: Array.isArray(picked) ? picked.slice() : picked
    };
    writeWrong(map);
  }

  function removeWrong(id) {
    var map = readWrong();
    if (map[id]) {
      delete map[id];
      writeWrong(map);
    }
  }

  /* ================= 结果页 ================= */

  function finishQuiz() {
    var quiz = state.quiz;
    if (!quiz) {
      return;
    }
    stopTimer();
    quiz.elapsed = Math.round((Date.now() - quiz.startAt) / 1000);

    var correct = 0;
    var wrongByPoint = {};
    quiz.questions.forEach(function (q, i) {
      var sub = quiz.submitted[i];
      if (sub && sub.correct) {
        correct += 1;
      } else if (sub) {
        wrongByPoint[q.pointId] = (wrongByPoint[q.pointId] || 0) + 1;
      }
    });

    var session = {
      time: new Date().toISOString(),
      total: quiz.questions.length,
      correct: correct,
      duration: quiz.elapsed,
      wrongByPoint: wrongByPoint,
      modules: quiz.settings.modules.slice()
    };
    var sessions = readJson(KEY_SESSIONS, []);
    if (!Array.isArray(sessions)) {
      sessions = [];
    }
    sessions.push(session);
    if (sessions.length > MAX_SESSIONS) {
      sessions = sessions.slice(sessions.length - MAX_SESSIONS);
    }
    storageSet(KEY_SESSIONS, JSON.stringify(sessions));

    state.result = {
      correct: correct,
      total: quiz.questions.length,
      duration: quiz.elapsed,
      questions: quiz.questions.slice(),
      picks: quiz.picks.slice(),
      submitted: quiz.submitted.slice(),
      reviewWrong: quiz.reviewWrong
    };
    state.mode = "result";
    renderResult();
  }

  function renderResult() {
    var r = state.result;
    var rate = r.total > 0 ? Math.round((r.correct / r.total) * 100) : 0;
    var grade = rate >= 90 ? "优秀" : rate >= 75 ? "良好" : rate >= 60 ? "合格" : "需加强";

    var listHtml = r.questions.map(function (q, i) {
      var sub = r.submitted[i];
      var ok = sub && sub.correct;
      var picked = r.picks[i];
      var mine = "";
      if (picked !== null && picked !== undefined) {
        if (q.type === "short") {
          mine = escapeHtml(picked);
        } else if (q.type === "multiple") {
          mine = picked.map(function (idx) { return q.options[idx]; }).join("、");
        } else {
          mine = q.options[picked];
        }
      } else {
        mine = "未作答";
      }
      return (
        '<details class="qz-result-item ' + (ok ? "is-right" : "is-wrong") + '">' +
          "<summary>" +
            '<span class="qz-result-index">' + (i + 1) + "</span>" +
            '<span class="qz-result-stem">' + escapeHtml(truncate(q.question, 42)) + "</span>" +
            '<span class="qz-result-badge">' + (ok ? "✓ 正确" : "✗ 错误") + "</span>" +
          "</summary>" +
          '<div class="qz-result-body">' +
            '<p class="qz-result-line"><strong>题干：</strong>' + escapeHtml(q.question) + "</p>" +
            '<p class="qz-result-line"><strong>你的答案：</strong>' + escapeHtml(mine) + "</p>" +
            '<p class="qz-result-line"><strong>正确答案：</strong>' + escapeHtml(answerText(q, q.answer)) + "</p>" +
            '<p class="qz-result-line"><strong>解析：</strong>' + escapeHtml(q.analysis) + "</p>" +
            '<p class="qz-result-line qz-result-point">' + escapeHtml(pointTitle(q.pointId)) + "</p>" +
          "</div>" +
        "</details>"
      );
    }).join("");

    var body =
      '<section class="card qz-result" aria-labelledby="qz-result-title">' +
        '<div class="qz-score-wrap">' +
          '<p class="qz-score" aria-label="得分 ' + rate + ' 分">' + rate + '<span class="qz-score-unit">分</span></p>' +
          '<div class="qz-score-info">' +
            '<h2 id="qz-result-title">本组练习完成</h2>' +
            '<p class="qz-score-sub">' + grade + " · 正确 " + r.correct + " / " + r.total + " 题 · 用时 " + formatDuration(r.duration) + "</p>" +
            '<div class="qz-stat-row">' +
              '<span class="qz-stat"><span class="qz-stat-k">正确率</span><strong>' + rate + "%</strong></span>" +
              '<span class="qz-stat"><span class="qz-stat-k">用时</span><strong>' + formatDuration(r.duration) + "</strong></span>" +
              '<span class="qz-stat"><span class="qz-stat-k">题数</span><strong>' + r.total + " 题</strong></span>" +
            "</div>" +
          "</div>" +
        "</div>" +
        '<div class="qz-actions">' +
          '<button type="button" class="btn btn-primary" data-qz-action="again">再来一组</button>' +
          '<button type="button" class="btn btn-secondary" data-qz-action="wrong-open">查看错题本</button>' +
          '<button type="button" class="btn btn-ghost" data-qz-action="settings">返回设置</button>' +
        "</div>" +
      "</section>" +
      '<section class="qz-result-list" aria-label="逐题对错清单">' +
        '<h2 class="qz-step-title">逐题清单<span class="qz-hint-inline">点击题目展开解析</span></h2>' +
        listHtml +
      "</section>";

    rootEl.innerHTML = shell("practice", body);
    bindTabs();
    bindActions({
      again: function () {
        startQuiz();
      },
      "wrong-open": function () {
        state.mode = "wrong";
        renderWrong();
      },
      settings: function () {
        state.mode = "settings";
        renderSettings();
      }
    });
  }

  /* ================= 错题本视图 ================= */

  function renderWrong() {
    var map = readWrong();
    var noticeText = state.wrongNotice || "";
    state.wrongNotice = "";
    var entries = Object.keys(map).map(function (id) {
      return map[id];
    }).filter(function (entry) {
      return QUESTION_MAP[entry.id];
    }).sort(function (a, b) {
      return new Date(b.last) - new Date(a.last);
    });

    var head = '<section class="card qz-wrong-head">' +
      "<div>" +
        '<p class="card-eyebrow">错题本</p>' +
        '<h2 class="qz-step-title qz-wrong-title">共 ' + entries.length + " 道错题</h2>" +
        '<p class="qz-sub">错过一次就记录一次；在错题本中答对后会自动移除，方便看到真正被消灭的错题。</p>' +
      "</div>" +
      '<div class="qz-wrong-tools">' +
        '<button type="button" class="btn btn-primary" data-qz-action="redo-all"' +
          (entries.length === 0 ? " disabled" : "") + ">重练全部错题</button>" +
        '<button type="button" class="btn btn-ghost" data-qz-action="clear-all"' +
          (entries.length === 0 ? " disabled" : "") + ">清空错题本</button>" +
      "</div>" +
    "</section>";

    var list = "";
    if (entries.length === 0) {
      list =
        '<section class="card qz-empty">' +
          "<h2>错题本还是空的</h2>" +
          "<p>先做一组练习，答错的题会自动收集到这里；也可以按知识点专项练习，集中消灭薄弱点。</p>" +
          '<button type="button" class="btn btn-primary" data-qz-action="go-practice">去练习</button>' +
        "</section>";
    } else {
      list = '<div class="qz-wrong-list">' + entries.map(function (entry) {
        var q = QUESTION_MAP[entry.id];
        var active = state.wrongActive === entry.id;
        var feedback = "";
        if (active) {
          var fb = state.wrongFeedback;
          if (fb && fb.id === entry.id) {
            feedback =
              '<div class="qz-feedback ' + (fb.correct ? "is-right" : "is-wrong") + '" role="status">' +
                '<p class="qz-feedback-mark">' + (fb.correct ? "回答正确，已从错题本移除" : "仍然答错，再回看解析") + "</p>" +
                '<p class="qz-answer-line"><strong>正确答案：</strong>' + escapeHtml(answerText(q, q.answer)) + "</p>" +
                '<p class="qz-analysis"><strong>解析：</strong>' + escapeHtml(q.analysis) + "</p>" +
              "</div>";
          }
        }
        var inline = "";
        if (active) {
          inline =
            '<div class="qz-wrong-inline">' +
              (q.type === "short"
                ? '<label class="qz-short-label" for="qzWrongShort">你的答案</label>' +
                  '<textarea class="qz-textarea" id="qzWrongShort" rows="4" placeholder="分点写出关键词…"></textarea>'
                : '<div class="qz-options" role="group" aria-label="选项">' +
                  q.options.map(function (option, index) {
                    return (
                      '<label class="qz-option">' +
                        '<input type="' + (q.type === "multiple" ? "checkbox" : "radio") +
                          '" name="qzWrongOpt" value="' + index + '">' +
                        '<span class="qz-option-key">' + String.fromCharCode(65 + index) + "</span>" +
                        '<span class="qz-option-text">' + escapeHtml(option) + "</span>" +
                      "</label>"
                    );
                  }).join("") + "</div>") +
              '<div class="qz-actions qz-actions-sm">' +
                '<button type="button" class="btn btn-primary" data-qz-action="wrong-submit" data-qz-id="' +
                  escapeHtml(entry.id) + '">提交</button>' +
                '<button type="button" class="btn btn-ghost" data-qz-action="wrong-cancel">收起</button>' +
              "</div>" +
              feedback +
            "</div>";
        }
        var lastAnswer = "";
        if (entry.answer !== undefined && entry.answer !== null) {
          if (Array.isArray(entry.answer)) {
            lastAnswer = entry.answer.map(function (idx) { return q.options[idx]; }).join("、");
          } else if (q.type === "short") {
            lastAnswer = entry.answer;
          } else {
            lastAnswer = q.options[entry.answer];
          }
        }
        return (
          '<article class="card qz-wrong-item' + (active ? " is-open" : "") + '">' +
            '<div class="qz-wrong-item-head">' +
              '<div class="qz-wrong-item-main">' +
                '<p class="qz-wrong-meta">' +
                   '<span class="qz-type qz-type-' + q.type + '">' + TYPE_LABEL[q.type] + "</span>" +
                  '<span class="qz-wrong-count">错 ' + entry.count + " 次</span>" +
                  "<span>最近：" + escapeHtml(formatDate(entry.last)) + "</span>" +
                "</p>" +
                '<h3 class="qz-wrong-stem">' + escapeHtml(q.question) + "</h3>" +
                '<p class="qz-wrong-tags">' + escapeHtml(moduleTitle(q.moduleId)) + " · " + escapeHtml(pointTitle(q.pointId)) + "</p>" +
                (lastAnswer ? '<p class="qz-wrong-last">上次作答：' + escapeHtml(lastAnswer) + "</p>" : "") +
              "</div>" +
              '<div class="qz-wrong-actions">' +
                '<button type="button" class="btn btn-secondary qz-btn-sm" data-qz-action="wrong-retry" data-qz-id="' +
                  escapeHtml(entry.id) + '">' + (active ? "收起重练" : "就地重练") + "</button>" +
                '<button type="button" class="btn btn-ghost qz-btn-sm" data-qz-action="wrong-remove" data-qz-id="' +
                  escapeHtml(entry.id) + '">移除</button>' +
              "</div>" +
            "</div>" +
            inline +
          "</article>"
        );
      }).join("") + "</div>";
    }

    rootEl.innerHTML = shell("wrong", head + (noticeText ? '<p class="qz-notice" role="status">' + escapeHtml(noticeText) + "</p>" : "") + list);
    bindTabs();
    bindActions({
      "go-practice": function () {
        state.mode = "settings";
        renderSettings();
      },
      "redo-all": function () {
        var ids = entries.map(function (entry) { return entry.id; });
        startWrongQuiz(ids);
      },
      "clear-all": function () {
        if (entries.length === 0) {
          return;
        }
        if (!window.confirm("确定清空全部 " + entries.length + " 道错题？")) {
          return;
        }
        if (!window.confirm("清空后无法恢复，再次确认清空？")) {
          return;
        }
        writeWrong({});
        state.wrongActive = null;
        state.wrongFeedback = null;
        renderWrong();
      },
      "wrong-retry": function (button) {
        var id = button.getAttribute("data-qz-id");
        state.wrongActive = state.wrongActive === id ? null : id;
        state.wrongFeedback = null;
        renderWrong();
      },
      "wrong-cancel": function () {
        state.wrongActive = null;
        state.wrongFeedback = null;
        renderWrong();
      },
      "wrong-remove": function (button) {
        var id = button.getAttribute("data-qz-id");
        if (!window.confirm("从错题本移除这道题？")) {
          return;
        }
        removeWrong(id);
        state.wrongActive = null;
        state.wrongFeedback = null;
        renderWrong();
      },
      "wrong-submit": function (button) {
        submitWrongInline(button.getAttribute("data-qz-id"));
      }
    });
  }

  function submitWrongInline(id) {
    var q = QUESTION_MAP[id];
    if (!q) {
      return;
    }
    var picked = null;
    if (q.type === "short") {
      var area = document.getElementById("qzWrongShort");
      picked = area && area.value.trim() ? area.value.trim() : null;
    } else {
      var inputs = rootEl.querySelectorAll('input[name="qzWrongOpt"]:checked');
      var values = Array.prototype.slice.call(inputs).map(function (input) {
        return Number(input.value);
      });
      if (q.type === "multiple") {
        values.sort(function (a, b) { return a - b; });
        picked = values.length > 0 ? values : null;
      } else {
        picked = values.length > 0 ? values[0] : null;
      }
    }
    if (picked === null) {
      window.alert("请先作答，再提交。");
      return;
    }
    var result = judgeAnswer(q, picked);
    state.wrongFeedback = { id: id, correct: result.correct };
    if (result.correct) {
      removeWrong(id);
      state.wrongActive = null;
      state.wrongNotice = "已掌握，该题已从错题本移除。";
    } else {
      addWrong(q, picked);
    }
    renderWrong();
  }

  /* ================= 学习报告 ================= */

  function readSessions() {
    var list = readJson(KEY_SESSIONS, []);
    return Array.isArray(list) ? list : [];
  }

  function calcStreak(sessions) {
    if (sessions.length === 0) {
      return 0;
    }
    var dateSet = {};
    sessions.forEach(function (s) {
      var d = new Date(s.time);
      if (!isNaN(d.getTime())) {
        dateSet[dateKey(d)] = true;
      }
    });
    var today = new Date();
    var cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (!dateSet[dateKey(cursor)]) {
      cursor.setDate(cursor.getDate() - 1);
      if (!dateSet[dateKey(cursor)]) {
        return 0;
      }
    }
    var streak = 0;
    while (dateSet[dateKey(cursor)]) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function aggregateWeak(sessions) {
    var map = {};
    sessions.forEach(function (s) {
      var wrong = s.wrongByPoint && typeof s.wrongByPoint === "object" ? s.wrongByPoint : {};
      Object.keys(wrong).forEach(function (pid) {
        map[pid] = (map[pid] || 0) + (Number(wrong[pid]) || 0);
      });
    });
    return Object.keys(map).map(function (pid) {
      var info = POINT_MAP[pid];
      return {
        pointId: pid,
        count: map[pid],
        title: info ? info.point.title : "未标注知识点",
        moduleId: info ? info.module.id : "",
        moduleTitle: info ? info.module.title : "综合"
      };
    }).filter(function (item) {
      return item.count > 0;
    }).sort(function (a, b) {
      return b.count - a.count;
    }).slice(0, 5);
  }

  function buildSuggestions(sessions, weak, accuracy) {
    var list = [];
    if (weak.length > 0) {
      var top = weak[0];
      list.push(
        "先补「" + top.title + "」：累计错 " + top.count + " 次，建议回看对应知识卡，重点看常见误区。" +
        '<a class="qz-suggest-link" href="#/learn/' + encodeURIComponent(top.moduleId) + "/" +
          encodeURIComponent(top.pointId) + '">打开知识卡</a>'
      );
    }
    if (weak.length > 1) {
      list.push(
        "把「" + weak[1].title + "」和已掌握的同类知识做对比记忆，再进错题本就地重练一遍。"
      );
    }
    if (accuracy > 0 && accuracy < 60) {
      list.push("整体正确率偏低，建议先把难度切到「基础」、题量选 5 题，连续做 3 组稳定后再挑战进阶题。");
    } else if (accuracy >= 80) {
      list.push("正确率已达到 " + accuracy + "%，可以把难度调到「挑战」，重点练多选与简答的完整表述。");
    } else if (accuracy > 0) {
      list.push("正确率处于中等水平，建议每组练习后立刻重练错题，避免同类错误重复出现。");
    }
    if (list.length === 0) {
      list.push("先从 5 题的小组练习开始，熟悉单选、多选、判断与简答的判分方式。");
    }
    if (list.length < 2) {
      list.push("保持节奏：每周完成 2 组以上练习，练后立即回看解析，并把错题在本周内重练一遍。");
    }
    return list.slice(0, 3);
  }

  function renderReport(root) {
    stopTimer();
    rootEl = root;
    state = {
      mode: "report",
      settings: { modules: [], points: [], difficulty: 0, count: 10 },
      quiz: null,
      result: null,
      wrongActive: null,
      wrongFeedback: null
    };

    var sessions = readSessions();
    if (sessions.length === 0) {
      rootEl.innerHTML =
        '<div class="qz-page">' +
          '<header class="card qz-head">' +
            '<div>' +
              '<p class="card-eyebrow">学习报告</p>' +
              '<h1 class="qz-title">学习报告与薄弱点分析</h1>' +
              '<p class="qz-sub">报告只统计本机浏览器中的练习记录，不联网、不上传。</p>' +
            "</div>" +
          "</header>" +
          '<section class="card qz-empty">' +
            "<h2>还没有练习记录</h2>" +
            "<p>完成任意一组练习后，这里会自动汇总练习次数、正确率、薄弱知识点和最近 10 次的正确率趋势。</p>" +
            '<div class="qz-actions">' +
              '<a class="btn btn-primary" href="#/practice">去做第一组练习</a>' +
              '<a class="btn btn-ghost" href="#/learn">先看知识卡</a>' +
            "</div>" +
          "</section>" +
        "</div>";
      return;
    }

    var totalQuestions = 0;
    var totalCorrect = 0;
    sessions.forEach(function (s) {
      totalQuestions += Number(s.total) || 0;
      totalCorrect += Number(s.correct) || 0;
    });
    var accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
    var streak = calcStreak(sessions);
    var weak = aggregateWeak(sessions);
    var recent = sessions.slice(-10);
    var suggestions = buildSuggestions(sessions, weak, accuracy);

    var maxWeak = weak.length > 0 ? weak[0].count : 1;

    var weakHtml = weak.length === 0
      ? '<p class="qz-empty-inline">目前没有错题记录，继续保持。</p>'
      : '<ol class="qz-weak-list">' + weak.map(function (item, index) {
          var pct = Math.max(8, Math.round((item.count / maxWeak) * 100));
          return (
            '<li class="qz-weak-item">' +
              '<span class="qz-weak-rank">' + (index + 1) + "</span>" +
              '<div class="qz-weak-main">' +
                '<p class="qz-weak-title">' + escapeHtml(item.title) + "</p>" +
                '<p class="qz-weak-meta">' + escapeHtml(item.moduleTitle) + " · 错误 " + item.count + " 次</p>" +
                '<div class="qz-weak-bar" aria-hidden="true"><span style="width:' + pct + '%"></span></div>' +
              "</div>" +
            "</li>"
          );
        }).join("") + "</ol>";

    var trendHtml = '<div class="qz-trend" role="img" aria-label="最近 ' + recent.length + ' 次练习的正确率条形图">' +
      recent.map(function (s, index) {
        var rate = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
        var height = Math.max(4, rate);
        return (
          '<div class="qz-trend-col">' +
            '<span class="qz-trend-value">' + rate + "%</span>" +
            '<span class="qz-trend-track"><span class="qz-trend-bar" style="height:' + height + '%" title="第 ' + (index + 1) + " 次：" + rate + '%"></span></span>' +
            '<span class="qz-trend-label">' + (index + 1) + "</span>" +
          "</div>"
        );
      }).join("") + "</div>";

    var suggestionsHtml = '<ul class="qz-suggest-list">' + suggestions.map(function (text) {
      return "<li><p>" + text + "</p></li>";
    }).join("") + "</ul>";

    rootEl.innerHTML =
      '<div class="qz-page">' +
        '<header class="card qz-head">' +
          "<div>" +
            '<p class="card-eyebrow">学习报告</p>' +
            '<h1 class="qz-title">你的本机学习画像</h1>' +
            '<p class="qz-sub">统计最近 ' + sessions.length + " 次练习记录，数据仅保存在本机浏览器。</p>" +
          "</div>" +
          '<div class="qz-head-actions">' +
            '<a class="btn btn-primary" href="#/practice">再练一组</a>' +
            '<a class="btn btn-ghost" href="#/practice">去练习页</a>' +
          "</div>" +
        "</header>" +
        '<section class="qz-overview" aria-label="总览">' +
          '<div class="card qz-stat-card"><p class="qz-stat-label">练习次数</p><p class="qz-stat-value">' + sessions.length + '<span>次</span></p></div>' +
          '<div class="card qz-stat-card"><p class="qz-stat-label">累计题数</p><p class="qz-stat-value">' + totalQuestions + '<span>题</span></p></div>' +
          '<div class="card qz-stat-card"><p class="qz-stat-label">总正确率</p><p class="qz-stat-value">' + accuracy + '<span>%</span></p></div>' +
          '<div class="card qz-stat-card"><p class="qz-stat-label">连续练习</p><p class="qz-stat-value">' + streak + '<span>天</span></p></div>' +
        "</section>" +
        '<div class="qz-report-grid">' +
          '<section class="card qz-report-card" aria-labelledby="qz-weak-title">' +
            '<h2 class="qz-step-title" id="qz-weak-title">薄弱知识点 Top 5</h2>' +
            weakHtml +
          "</section>" +
          '<section class="card qz-report-card" aria-labelledby="qz-trend-title">' +
            '<h2 class="qz-step-title" id="qz-trend-title">最近 ' + recent.length + " 次正确率</h2>" +
            trendHtml +
            '<p class="qz-hint">柱高表示该次练习的正确率，鼠标悬停可查看数值。</p>' +
          "</section>" +
        "</div>" +
        '<section class="card qz-report-card" aria-labelledby="qz-suggest-title">' +
          '<h2 class="qz-step-title" id="qz-suggest-title">学习建议</h2>' +
          suggestionsHtml +
        "</section>" +
      "</div>";
  }

  /* ================= 对外接口 ================= */

  function renderPractice(root) {
    stopTimer();
    rootEl = root;
    state = {
      mode: "settings",
      settings: { modules: [], points: [], difficulty: 0, count: 10 },
      quiz: null,
      result: null,
      wrongActive: null,
      wrongFeedback: null
    };
    renderSettings();
  }

  function destroy() {
    stopTimer();
    rootEl = null;
    state = null;
  }

  window.GeoLabQuiz = {
    renderPractice: renderPractice,
    renderReport: renderReport,
    destroy: destroy
  };
})();