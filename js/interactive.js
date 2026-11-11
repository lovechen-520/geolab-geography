/* GeoLab · 互动实验室组件 — js/interactive.js
   4 个组件全部接入：时区换算器（timezone）、气候类型判读（climate）、
   等高线地形判读（contour）、地球运动与昼夜长短（earth）。
   组件全部为原生 JS + 内联 SVG/HTML，无第三方库、无外链请求。
   挂载约定：容器写 <div class="demo-mount" data-demo-id="timezone"></div>，
   在视图渲染完成后调用 mountAll(root)；WeakMap 防重复挂载，
   未注册的 demo-id 与构建异常均降级为友好提示，不抛未捕获异常。 */

(function () {
  "use strict";

  /* ================= 通用工具 ================= */

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function pad2(num) {
    return num < 10 ? "0" + num : String(num);
  }

  var WEEK_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

  /* ================= 挂载器 ================= */

  var BUILDERS = {};
  var mountedNodes = typeof WeakMap === "function" ? new WeakMap() : null;
  var instanceCount = 0;

  function fallbackHtml(id) {
    return (
      '<div class="demo-fallback" role="status">' +
        "<p><strong>「" + escapeHtml(id) + "」组件尚未接入。</strong></p>" +
        "<p>该互动组件将在后续轮次接入；届时回到互动实验室即可直接操作并获得即时反馈。</p>" +
      "</div>"
    );
  }

  function errorHtml() {
    return (
      '<div class="demo-fallback" role="alert">' +
        "<p><strong>组件加载出错。</strong></p>" +
        "<p>刷新页面即可重试；页面其余内容不受影响。</p>" +
      "</div>"
    );
  }

  function mountOne(el) {
    if (mountedNodes && mountedNodes.has(el)) {
      return;
    }
    if (mountedNodes) {
      mountedNodes.set(el, true);
    }
    var id = el.getAttribute("data-demo-id") || "";
    try {
      var builder = BUILDERS[id];
      if (typeof builder === "function") {
        builder(el);
      } else {
        el.innerHTML = fallbackHtml(id);
      }
    } catch (err) {
      el.innerHTML = errorHtml();
    }
  }

  function mountAll(root) {
    if (!root || typeof root.querySelectorAll !== "function") {
      return 0;
    }
    var nodes = root.querySelectorAll("[data-demo-id]");
    var count = 0;
    for (var i = 0; i < nodes.length; i += 1) {
      mountOne(nodes[i]);
      count += 1;
    }
    return count;
  }

  /* ================= 组件 1：时区换算器 ================= */

  var TZ_CITIES = [
    { id: "beijing", name: "北京", offset: 480, label: "UTC+8" },
    { id: "tokyo", name: "东京", offset: 540, label: "UTC+9" },
    { id: "newdelhi", name: "新德里", offset: 330, label: "UTC+5:30" },
    { id: "london", name: "伦敦", offset: 0, label: "UTC+0" },
    { id: "newyork", name: "纽约", offset: -300, label: "UTC−5" },
    { id: "losangeles", name: "洛杉矶", offset: -480, label: "UTC−8" },
    { id: "sydney", name: "悉尼", offset: 600, label: "UTC+10" },
    { id: "cairo", name: "开罗", offset: 120, label: "UTC+2" }
  ];

  /* 输入合法性：日期需为真实存在的日期（如 2 月 30 日判无效） */
  function parseDateValue(value) {
    if (!value) {
      return null;
    }
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
      return null;
    }
    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }
    var ms = Date.UTC(year, month - 1, day);
    var check = new Date(ms);
    if (
      check.getUTCFullYear() !== year ||
      check.getUTCMonth() !== month - 1 ||
      check.getUTCDate() !== day
    ) {
      return null;
    }
    return ms;
  }

  /* 时间输入形如 HH:MM（可带秒，秒不参与展示与换算） */
  function parseTimeValue(value) {
    if (!value) {
      return null;
    }
    var match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value);
    if (!match) {
      return null;
    }
    var hour = Number(match[1]);
    var minute = Number(match[2]);
    if (hour > 23 || minute > 59) {
      return null;
    }
    return hour * 60 + minute;
  }

  function buildTimezone(root) {
    instanceCount += 1;
    var uid = "tz" + instanceCount;
    var ids = {
      base: uid + "-base",
      date: uid + "-date",
      time: uid + "-time",
      fill: uid + "-fill",
      error: uid + "-error",
      list: uid + "-list"
    };

    var options = TZ_CITIES.map(function (city) {
      return (
        '<option value="' + city.id + '"' +
          (city.id === "beijing" ? " selected" : "") + ">" +
          escapeHtml(city.name) + "（" + city.label + "）</option>"
      );
    }).join("");

    root.innerHTML =
      '<div class="tz-widget">' +
        '<div class="tz-controls">' +
          '<div class="tz-field">' +
            '<label class="select-label" for="' + ids.base + '">基准城市</label>' +
            '<select class="select" id="' + ids.base + '">' + options + "</select>" +
          "</div>" +
          '<div class="tz-field">' +
            '<label class="select-label" for="' + ids.date + '">基准日期</label>' +
            '<input class="tz-input" type="date" id="' + ids.date + '">' +
          "</div>" +
          '<div class="tz-field">' +
            '<label class="select-label" for="' + ids.time + '">基准时间</label>' +
            '<input class="tz-input" type="time" id="' + ids.time + '">' +
          "</div>" +
          '<div class="tz-field">' +
            '<button type="button" class="btn btn-secondary" id="' + ids.fill +
              '" title="把本机系统当前的日期与时间填入上方输入框；若本机时区与基准城市不同，请自行换算后再输入">填入本机时间</button>' +
          "</div>" +
        "</div>" +
        '<p class="tz-error" id="' + ids.error + '" role="status" hidden></p>' +
        '<ul class="tz-list" id="' + ids.list + '" aria-label="八个城市的当地时间换算结果"></ul>' +
        '<p class="tz-note">' +
          '<svg class="tz-note-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">' +
            '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"></circle>' +
            '<path d="M12 7.2v4.8l3.4 2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path>' +
          "</svg>" +
          "<span>经度每相差 15° 相差 1 小时；东加西减；本工具不考虑夏令时。</span>" +
        "</p>" +
      "</div>";

    var baseSelect = root.querySelector("#" + ids.base);
    var dateInput = root.querySelector("#" + ids.date);
    var timeInput = root.querySelector("#" + ids.time);
    var fillButton = root.querySelector("#" + ids.fill);
    var errorEl = root.querySelector("#" + ids.error);
    var listEl = root.querySelector("#" + ids.list);

    var cityById = {};
    TZ_CITIES.forEach(function (city) {
      cityById[city.id] = city;
    });

    function showError(text) {
      errorEl.hidden = false;
      errorEl.textContent = text;
      listEl.innerHTML = "";
    }

    function update() {
      var dateMs = parseDateValue(dateInput.value);
      if (dateMs === null) {
        showError(
          dateInput.value
            ? "日期「" + dateInput.value + "」不是有效日期，请选择真实存在的日期。"
            : "请先选择基准日期，再查看换算结果。"
        );
        return;
      }
      var timeMin = parseTimeValue(timeInput.value);
      if (timeMin === null) {
        showError(
          timeInput.value
            ? "时间「" + timeInput.value + "」不是有效时间，请按「时:分」输入。"
            : "请先输入基准时间，再查看换算结果。"
        );
        return;
      }

      errorEl.hidden = true;
      errorEl.textContent = "";

      /* 换算统一走 UTC 分钟数：
         UTC 分钟 = 基准当地分钟 − 基准偏移；各地当地分钟 = UTC 分钟 + 各地偏移。
         分钟级运算天然覆盖跨日（负数取模）与 +5:30 半时区。 */
      var baseCity = cityById[baseSelect.value] || TZ_CITIES[0];
      var utcMinutes = dateMs / 60000 + timeMin - baseCity.offset;
      var baseDayIndex = Math.floor((utcMinutes + baseCity.offset) / 1440);

      listEl.innerHTML = TZ_CITIES.map(function (city) {
        var localMinutes = utcMinutes + city.offset;
        var localDate = new Date(localMinutes * 60000);
        var diff = Math.floor(localMinutes / 1440) - baseDayIndex;
        var isBase = city.id === baseCity.id;

        var badgeText = isBase
          ? "基准"
          : diff === 0 ? "今天"
          : diff === 1 ? "明天"
          : diff === -1 ? "昨天"
          : "";
        var badgeClass = isBase
          ? "tz-badge tz-badge-base"
          : diff === 0 ? "tz-badge tz-badge-today"
          : diff === 1 ? "tz-badge tz-badge-tomorrow"
          : diff === -1 ? "tz-badge tz-badge-yesterday"
          : "tz-badge tz-badge-none";

        var dateText =
          localDate.getUTCFullYear() + "-" + pad2(localDate.getUTCMonth() + 1) + "-" +
          pad2(localDate.getUTCDate()) + " " + WEEK_NAMES[localDate.getUTCDay()];
        var timeText =
          pad2(localDate.getUTCHours()) + ":" + pad2(localDate.getUTCMinutes());

        return (
          '<li class="tz-row' + (isBase ? " tz-row-base" : "") + '">' +
            '<span class="tz-city">' + escapeHtml(city.name) + "</span>" +
            '<span class="tz-utc">' + city.label + "</span>" +
            '<span class="tz-date">' + dateText + "</span>" +
            '<span class="tz-time">' + timeText + "</span>" +
            '<span class="' + badgeClass + '">' + badgeText + "</span>" +
          "</li>"
        );
      }).join("");
    }

    function fillLocalNow() {
      var now = new Date();
      dateInput.value =
        now.getFullYear() + "-" + pad2(now.getMonth() + 1) + "-" + pad2(now.getDate());
      timeInput.value = pad2(now.getHours()) + ":" + pad2(now.getMinutes());
      update();
    }

    baseSelect.addEventListener("change", update);
    dateInput.addEventListener("change", update);
    dateInput.addEventListener("input", update);
    timeInput.addEventListener("change", update);
    timeInput.addEventListener("input", update);
    fillButton.addEventListener("click", fillLocalNow);

    /* 初始展示：以本机当前日期时间作为默认输入 */
    fillLocalNow();
  }

  BUILDERS.timezone = buildTimezone;

  /* ================= 组件 2：气候类型判读 ================= */

  /* 6 种典型气候：12 个月气温（℃）与降水量（mm）。
     数值为教学示意数据，量级与教材常见统计一致，图注标注「示意数据」。 */
  var CLIMATE_TYPES = [
    {
      id: "rainforest",
      name: "热带雨林气候",
      temps: [26.5, 26.8, 27.2, 27.5, 27.6, 27.4, 27.1, 27.0, 27.1, 27.3, 27.2, 26.8],
      precip: [180, 170, 190, 185, 175, 165, 150, 145, 160, 175, 185, 190],
      water: "各月降水都在 140mm 以上，年降水量约 2000mm，全年多雨",
      cause: "终年受赤道低气压带控制，盛行上升气流，多对流雨。",
      distribution: "亚马孙平原、刚果盆地、马来群岛等赤道附近地区。"
    },
    {
      id: "savanna",
      name: "热带草原气候",
      temps: [26, 27, 29, 30, 29, 27, 25, 24, 26, 28, 27, 26],
      precip: [10, 12, 30, 70, 140, 165, 170, 155, 85, 35, 15, 8],
      water: "降水集中在湿季（6—8 月），干季月降水量不足 40mm，干湿季分明",
      cause: "受赤道低气压带与信风带交替控制：湿季赤道低气压带控制多雨，干季信风带控制少雨。",
      distribution: "非洲中南部、南美巴西高原、澳大利亚北部等热带草原地区。"
    },
    {
      id: "desert",
      name: "热带沙漠气候",
      temps: [15, 17, 20, 24, 27, 29, 29, 29, 27, 23, 18, 15],
      precip: [2, 1, 2, 1, 1, 1, 1, 2, 3, 4, 3, 2],
      water: "各月降水都很少，年降水量不足 30mm，全年干旱",
      cause: "常年受副热带高气压带或信风带控制，盛行下沉气流，难以成云致雨。",
      distribution: "撒哈拉沙漠、阿拉伯半岛、澳大利亚中西部等回归线附近的大陆内部与西岸。"
    },
    {
      id: "mediterranean",
      name: "地中海气候",
      temps: [9, 10, 12, 15, 19, 23, 25, 25, 22, 18, 13, 9],
      precip: [90, 75, 65, 45, 25, 12, 8, 10, 35, 70, 95, 100],
      water: "冬季月降水量 70—100mm，夏季仅 10—20mm，冬雨夏干",
      cause: "夏季受副热带高气压带控制，炎热干燥；冬季受西风带控制，温和多雨。",
      distribution: "地中海沿岸、美国加利福尼亚州、智利中部、澳大利亚西南部等 30°—40° 大陆西岸。"
    },
    {
      id: "oceanic",
      name: "温带海洋性气候",
      temps: [5.5, 6, 7, 9, 12, 15, 17, 17.5, 15, 11, 8, 6],
      precip: [52, 44, 42, 40, 44, 46, 48, 54, 58, 62, 65, 55],
      water: "各月降水 40—68mm，全年湿润均匀，无明显干湿季",
      cause: "终年受西风带控制，且海洋影响显著，全年温和湿润。",
      distribution: "西欧、北美西部沿海、新西兰等 40°—60° 大陆西岸。"
    },
    {
      id: "monsoon",
      name: "温带季风气候",
      temps: [-4, -1, 5, 13, 19, 24, 27, 26, 21, 14, 6, -2],
      precip: [3, 5, 10, 22, 40, 70, 165, 160, 50, 20, 10, 4],
      water: "7—8 月降水量在 160mm 以上，冬季降水很少，夏季集中多雨",
      cause: "海陆热力性质差异显著：夏季盛行来自海洋的偏南风，冬季盛行来自内陆的偏北风。",
      distribution: "中国华北与东北地区、朝鲜半岛、日本北部等温带大陆东岸。"
    }
  ];

  var CLIMATE_LETTERS = ["A", "B", "C", "D"];

  function trimNum(value) {
    return String(Math.round(value * 10) / 10);
  }

  function shuffleList(list) {
    var arr = list.slice();
    for (var i = arr.length - 1; i > 0; i -= 1) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  /* 由数据计算题干所需统计量，避免把答案写死 */
  function climateStats(data) {
    var coldest = data.temps[0];
    var hottest = data.temps[0];
    var coldestIdx = 0;
    var hottestIdx = 0;
    var sum = 0;
    for (var i = 0; i < data.temps.length; i += 1) {
      if (data.temps[i] < coldest) {
        coldest = data.temps[i];
        coldestIdx = i;
      }
      if (data.temps[i] > hottest) {
        hottest = data.temps[i];
        hottestIdx = i;
      }
    }
    for (var k = 0; k < data.precip.length; k += 1) {
      sum += data.precip[k];
    }
    return {
      coldest: coldest,
      hottest: hottest,
      coldestIdx: coldestIdx,
      hottestIdx: hottestIdx,
      range: Math.round((hottest - coldest) * 10) / 10,
      total: sum
    };
  }

  /* 降水季节分配的文字描述：按数据判断「均匀 / 集中 / 稀少」，不写死答案 */
  function describePrecip(precip) {
    var sum = 0;
    var max = precip[0];
    var min = precip[0];
    var i;
    for (i = 0; i < precip.length; i += 1) {
      sum += precip[i];
      if (precip[i] > max) {
        max = precip[i];
      }
      if (precip[i] < min) {
        min = precip[i];
      }
    }
    if (sum < 100) {
      return "全年降水很少（年降水量不足 100mm），极端干旱";
    }
    if (max / Math.max(min, 1) < 1.8) {
      return "全年降水分配较均匀，没有明显的干季与湿季";
    }

    /* 找出连续三个月降水量之和最大的时段，作为雨季描述 */
    var bestStart = 0;
    var bestSum = -1;
    for (i = 0; i < 12; i += 1) {
      var windowSum =
        precip[i] + precip[(i + 1) % 12] + precip[(i + 2) % 12];
      if (windowSum > bestSum) {
        bestSum = windowSum;
        bestStart = i;
      }
    }
    var startMonth = bestStart + 1;
    var endMonth = ((bestStart + 2) % 12) + 1;
    var centerMonth = ((bestStart + 1) % 12) + 1;
    var rangeText =
      startMonth <= endMonth
        ? startMonth + "—" + endMonth + " 月"
        : startMonth + " 月—次年 " + endMonth + " 月";
    var seasonText = "";
    if (centerMonth >= 6 && centerMonth <= 8) {
      seasonText = "，夏季多雨";
    } else if (centerMonth === 12 || centerMonth <= 2) {
      seasonText = "，冬季多雨";
    } else if (centerMonth >= 5 && centerMonth <= 10) {
      seasonText = "，夏半年多雨";
    }
    return "降水集中在 " + rangeText + seasonText + "，其余月份降水较少";
  }

  /* 双轴示意图：左轴气温（℃），右轴降水（mm），12 个月等距线性映射 */
  function buildClimateChart(data) {
    var W = 720;
    var H = 360;
    var padL = 54;
    var padR = 60;
    var padT = 32;
    var padB = 46;
    var iw = W - padL - padR;
    var ih = H - padT - padB;
    var step = iw / 12;
    var tMin = -10;
    var tMax = 35;
    var pMax = 200;

    function xOf(index) {
      return padL + step * (index + 0.5);
    }
    function yOfTemp(value) {
      return padT + ((tMax - value) / (tMax - tMin)) * ih;
    }
    function yOfPrecip(value) {
      return padT + (1 - value / pMax) * ih;
    }

    var svg = [];
    svg.push(
      '<svg class="climate-svg" viewBox="0 0 ' + W + " " + H +
        '" role="img" aria-label="某地气温曲线与降水柱状图，示意数据" preserveAspectRatio="xMidYMid meet">'
    );

    /* 气温刻度与横向网格 */
    var tempTicks = [-10, 0, 10, 20, 30];
    for (var i = 0; i < tempTicks.length; i += 1) {
      var ty = yOfTemp(tempTicks[i]);
      svg.push(
        '<line class="climate-grid-line" x1="' + padL + '" y1="' + ty +
          '" x2="' + (padL + iw) + '" y2="' + ty + '"></line>'
      );
      svg.push(
        '<text class="climate-axis-text" x="' + (padL - 8) + '" y="' + (ty + 4) +
          '" text-anchor="end">' + tempTicks[i] + "</text>"
      );
    }

    /* 降水刻度（右轴，仅画短刻度线，避免与气温网格混淆） */
    var precipTicks = [0, 50, 100, 150, 200];
    for (var j = 0; j < precipTicks.length; j += 1) {
      var py = yOfPrecip(precipTicks[j]);
      svg.push(
        '<line class="climate-tick-line" x1="' + (padL + iw) + '" y1="' + py +
          '" x2="' + (padL + iw + 6) + '" y2="' + py + '"></line>'
      );
      svg.push(
        '<text class="climate-axis-text" x="' + (padL + iw + 10) + '" y="' + (py + 4) +
          '" text-anchor="start">' + precipTicks[j] + "</text>"
      );
    }

    /* 0℃ 线加重，便于读「最冷月是否在 0℃ 以下」 */
    svg.push(
      '<line class="climate-zero-line" x1="' + padL + '" y1="' + yOfTemp(0) +
        '" x2="' + (padL + iw) + '" y2="' + yOfTemp(0) + '"></line>'
    );

    /* 降水柱 */
    var barW = step * 0.56;
    for (var m = 0; m < 12; m += 1) {
      var barTop = yOfPrecip(data.precip[m]);
      var barH = Math.max(0, padT + ih - barTop);
      svg.push(
        '<rect class="climate-bar" x="' + (xOf(m) - barW / 2) + '" y="' + barTop +
          '" width="' + barW + '" height="' + barH + '" rx="2"></rect>'
      );
    }

    /* 气温折线与圆点 */
    var points = [];
    for (var t = 0; t < 12; t += 1) {
      points.push(xOf(t) + "," + yOfTemp(data.temps[t]));
    }
    svg.push('<polyline class="climate-temp-line" points="' + points.join(" ") + '"></polyline>');
    for (var d = 0; d < 12; d += 1) {
      svg.push(
        '<circle class="climate-temp-dot" cx="' + xOf(d) + '" cy="' + yOfTemp(data.temps[d]) +
          '" r="3.2"></circle>'
      );
    }

    /* 月份标签与轴标题 */
    for (var n = 0; n < 12; n += 1) {
      svg.push(
        '<text class="climate-axis-text" x="' + xOf(n) + '" y="' + (H - 22) +
          '" text-anchor="middle">' + (n + 1) + "</text>"
      );
    }
    svg.push(
      '<text class="climate-axis-text" x="' + (padL + iw / 2) + '" y="' + (H - 4) +
        '" text-anchor="middle">月份</text>'
    );
    svg.push(
      '<text class="climate-axis-label" x="' + padL + '" y="16" text-anchor="start">气温（℃）</text>'
    );
    svg.push(
      '<text class="climate-axis-label" x="' + (padL + iw) + '" y="16" text-anchor="end">降水（mm）</text>'
    );
    svg.push("</svg>");
    return svg.join("");
  }

  function buildClimate(root) {
    instanceCount += 1;
    var uid = "cl" + instanceCount;
    var ids = {
      score: uid + "-score",
      chart: uid + "-chart",
      stem: uid + "-stem",
      options: uid + "-options",
      hint: uid + "-hint",
      feedback: uid + "-feedback",
      submit: uid + "-submit",
      next: uid + "-next"
    };

    var lastId = "";
    var askedCount = 0;
    var correctCount = 0;
    var answered = false;
    var current = null;
    var optionList = [];
    var correctIndex = 0;

    function pickType() {
      var pool = CLIMATE_TYPES.filter(function (item) {
        return item.id !== lastId;
      });
      var picked = pool[Math.floor(Math.random() * pool.length)];
      lastId = picked.id;
      return picked;
    }

    function updateScore() {
      var scoreEl = root.querySelector("#" + ids.score);
      if (scoreEl) {
        scoreEl.innerHTML =
          "得分 <strong>" + correctCount + "</strong> / <span>" + askedCount + "</span>";
      }
    }

    function buildOptions() {
      var correctName = current.name;
      var others = CLIMATE_TYPES.filter(function (item) {
        return item.id !== current.id;
      }).map(function (item) {
        return item.name;
      });
      var distractors = shuffleList(others).slice(0, 3);
      optionList = shuffleList(distractors.concat([correctName]));
      correctIndex = optionList.indexOf(correctName);

      return optionList.map(function (name, index) {
        var optId = ids.options + "-" + index;
        return (
          '<label class="climate-option" for="' + optId + '">' +
            '<input class="climate-radio" type="radio" name="' + ids.options +
              '" id="' + optId + '" value="' + index + '">' +
            '<span class="climate-option-mark" aria-hidden="true">' +
              CLIMATE_LETTERS[index] + "</span>" +
            '<span class="climate-option-text">' + escapeHtml(name) + "</span>" +
          "</label>"
        );
      }).join("");
    }

    function render() {
      current = pickType();
      answered = false;
      var stats = climateStats(current);
      var stem =
        "下图为某地气温曲线与降水柱状图。该地最冷月气温约 " + trimNum(stats.coldest) +
        "℃（出现在 " + (stats.coldestIdx + 1) + " 月），最热月气温约 " + trimNum(stats.hottest) +
        "℃（出现在 " + (stats.hottestIdx + 1) + " 月），气温年较差约 " + trimNum(stats.range) +
        "℃；年降水量约 " + stats.total + "mm；" + describePrecip(current.precip) +
        "。据此判断，该地最可能属于哪种气候类型？";

      root.innerHTML =
        '<div class="climate-widget">' +
          '<div class="climate-toolbar">' +
            '<p class="climate-score" id="' + ids.score + '">得分 <strong>0</strong> / <span>0</span></p>' +
            '<p class="climate-method">判读口诀：以温定带、以水定型</p>' +
          "</div>" +
          '<figure class="climate-figure">' +
            '<div class="climate-chart" id="' + ids.chart + '">' +
              buildClimateChart(current) +
            "</div>" +
            "<figcaption>气温曲线（左轴 ℃，折线与圆点）与降水柱状图（右轴 mm）· 示意数据，非真实气象站记录</figcaption>" +
          "</figure>" +
          '<p class="climate-stem" id="' + ids.stem + '">' + escapeHtml(stem) + "</p>" +
          '<fieldset class="climate-fieldset">' +
            '<legend class="climate-legend">选择气候类型（单选）</legend>' +
            '<div class="climate-options" id="' + ids.options + '">' + buildOptions() + "</div>" +
          "</fieldset>" +
          '<p class="climate-hint" id="' + ids.hint + '" role="status" aria-live="polite" hidden></p>' +
          '<div class="climate-actions">' +
            '<button type="button" class="btn btn-primary" id="' + ids.submit + '">提交答案</button>' +
            '<button type="button" class="btn btn-secondary" id="' + ids.next + '">下一题</button>' +
          "</div>" +
          '<div class="climate-feedback" id="' + ids.feedback + '" role="status" aria-live="polite" hidden></div>' +
        "</div>";

      updateScore();

      var submitBtn = root.querySelector("#" + ids.submit);
      var nextBtn = root.querySelector("#" + ids.next);
      var hintEl = root.querySelector("#" + ids.hint);
      var feedbackEl = root.querySelector("#" + ids.feedback);
      var inputs = root.querySelectorAll('input[name="' + ids.options + '"]');
      var labels = root.querySelectorAll(".climate-option");

      submitBtn.addEventListener("click", function () {
        if (answered) {
          return;
        }
        var chosen = -1;
        for (var i = 0; i < inputs.length; i += 1) {
          if (inputs[i].checked) {
            chosen = Number(inputs[i].value);
            break;
          }
        }
        if (chosen < 0) {
          hintEl.hidden = false;
          hintEl.textContent = "请先选择一个气候类型，再提交答案。";
          return;
        }
        hintEl.hidden = true;
        hintEl.textContent = "";
        answered = true;
        askedCount += 1;

        var isRight = chosen === correctIndex;
        if (isRight) {
          correctCount += 1;
        }

        for (var k = 0; k < labels.length; k += 1) {
          labels[k].classList.add("is-locked");
          if (k === correctIndex) {
            labels[k].classList.add("is-correct");
          } else if (k === chosen) {
            labels[k].classList.add("is-wrong");
          }
        }
        for (var m = 0; m < inputs.length; m += 1) {
          inputs[m].disabled = true;
        }
        submitBtn.disabled = true;

        var stats = climateStats(current);
        var band =
          stats.coldest >= 15
            ? "热带（最冷月 15℃ 以上）"
            : stats.coldest >= 0
              ? "亚热带或温带（最冷月 0—15℃）"
              : "温带（最冷月 0℃ 以下）";

        feedbackEl.hidden = false;
        feedbackEl.className =
          "climate-feedback " + (isRight ? "is-right" : "is-wrong");
        feedbackEl.innerHTML =
          '<p class="climate-verdict">' +
            (isRight
              ? "回答正确！该地属于「" + escapeHtml(current.name) + "」。"
              : "回答错误。正确答案是「" + escapeHtml(current.name) + "」。") +
          "</p>" +
          '<div class="climate-explain">' +
            "<p><strong>判读方法：以温定带、以水定型。</strong></p>" +
            "<p>① 以温定带：最冷月约 " + trimNum(stats.coldest) + "℃，最热月约 " +
              trimNum(stats.hottest) + "℃，年较差约 " + trimNum(stats.range) +
              "℃ → " + band + "。</p>" +
            "<p>② 以水定型：" + escapeHtml(current.water) + " → " +
              escapeHtml(current.name) + "。</p>" +
            "<p><strong>成因：</strong>" + escapeHtml(current.cause) + "</p>" +
            "<p><strong>分布：</strong>" + escapeHtml(current.distribution) + "</p>" +
          "</div>";

        updateScore();
      });

      nextBtn.addEventListener("click", render);
    }

    render();
  }

  BUILDERS.climate = buildClimate;

  /* ================= 组件 3：等高线地形判读 ================= */

  var CONTOUR_OPTIONS = ["山峰", "山脊", "山谷", "鞍部", "陡崖"];

  /* A—E 五个点位：坐标对应下方 buildContourSvg 中的固定几何，答案用于逐点判分 */
  var CONTOUR_POINTS = [
    {
      key: "A",
      x: 240,
      y: 180,
      answer: "山峰",
      why: "A 点位于最内侧的 400 米闭合等高线以内，是图中海拔最高的部位，四周等高线数值依次降低。",
      tip: "闭合等高线由外向内数值增大，最内圈内部就是山顶（山峰），山顶常标注高程或 ▲ 符号。"
    },
    {
      key: "B",
      x: 250,
      y: 264,
      answer: "山脊",
      why: "B 点位于南侧，等高线由高处向低处凸出（凸向海拔低的一侧），说明该处地势高于两侧，是山脊。",
      tip: "等高线凸向低处为山脊；山脊是分水线，两侧水流背离脊线分流，一般不会发育河流。"
    },
    {
      key: "C",
      x: 193,
      y: 190,
      answer: "山谷",
      why: "C 点位于西侧，等高线由低处向高处凸出（凸向海拔高的一侧），形成向内凹入的 V 形，是汇水的低洼通道。",
      tip: "等高线凸向高处为山谷；山谷是集水线，常发育河流，河流流向与等高线凸出方向相反。"
    },
    {
      key: "D",
      x: 352,
      y: 182,
      answer: "鞍部",
      why: "D 点位于两个 300 米闭合等高线之间的低处，两侧各有一个山顶、中间低洼，形状像马鞍。",
      tip: "两个相邻山顶之间的低地即鞍部；鞍部两侧等高线成对出现，常是穿越山地的通道。"
    },
    {
      key: "E",
      x: 566,
      y: 196,
      answer: "陡崖",
      why: "E 点引线指向的崖壁处，200 米与 300 米两条等高线几乎重叠，水平距离极短，100 米高差在很短距离内完成，坡度接近垂直。",
      tip: "多条等高线重叠或贴近处为陡崖（崖壁）；陡崖处坡度极陡，不宜攀爬，常见于攀岩场地。"
    }
  ];

  /* 极坐标近似：以椭圆为底，在指定方位叠加高斯型凹凸，得到不规则闭合等高线 */
  function contourScale(bumps, deg) {
    var scale = 1;
    for (var i = 0; i < bumps.length; i += 1) {
      var diff = ((deg - bumps[i].at + 540) % 360) - 180;
      scale += bumps[i].k * Math.exp(-(diff * diff) / (bumps[i].w * bumps[i].w));
    }
    return scale;
  }

  function contourRound(value) {
    return Math.round(value * 10) / 10;
  }

  function contourPath(cx, cy, rx, ry, bumps) {
    var N = 48;
    var pts = [];
    for (var i = 0; i < N; i += 1) {
      var deg = (i / N) * 360;
      var rad = (deg * Math.PI) / 180;
      var scale = contourScale(bumps, deg);
      pts.push([cx + rx * scale * Math.cos(rad), cy + ry * scale * Math.sin(rad)]);
    }
    var d = "M" + contourRound(pts[0][0]) + " " + contourRound(pts[0][1]);
    for (var j = 0; j < N; j += 1) {
      var p0 = pts[(j - 1 + N) % N];
      var p1 = pts[j];
      var p2 = pts[(j + 1) % N];
      var p3 = pts[(j + 2) % N];
      var c1x = p1[0] + (p2[0] - p0[0]) / 6;
      var c1y = p1[1] + (p2[1] - p0[1]) / 6;
      var c2x = p2[0] - (p3[0] - p1[0]) / 6;
      var c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d +=
        "C" + contourRound(c1x) + " " + contourRound(c1y) + " " +
        contourRound(c2x) + " " + contourRound(c2y) + " " +
        contourRound(p2[0]) + " " + contourRound(p2[1]);
    }
    return d + "Z";
  }

  /* 示意图几何（viewBox 720 × 380）：
     两座山顶并立 → 300 米等高线各自闭合，中间低处即鞍部；
     西侧等高线向内凹入 = 山谷，南侧向外凸出 = 山脊；
     东侧 200 米与 300 米等高线贴近并加陡崖符号 = 陡崖。 */
  function buildContourSvg() {
    var svg = [];
    svg.push(
      '<svg class="contour-svg" viewBox="0 0 720 380" role="img" ' +
        'aria-label="等高线地形示意图，等高距 100 米，标注 A 至 E 五个点位；示意图，非标准地图" ' +
        'preserveAspectRatio="xMidYMid meet">'
    );

    svg.push('<g class="contour-lines">');
    svg.push(
      '<path class="contour-line is-outer" d="' +
        contourPath(350, 188, 258, 138, [
          { at: 180, k: -0.14, w: 16 },
          { at: 108, k: 0.1, w: 20 }
        ]) + '"></path>'
    );
    svg.push(
      '<path class="contour-line" d="' +
        contourPath(350, 188, 200, 110, [
          { at: 180, k: -0.14, w: 14 },
          { at: 108, k: 0.16, w: 16 }
        ]) + '"></path>'
    );
    svg.push(
      '<path class="contour-line" d="' +
        contourPath(255, 170, 58, 54, [
          { at: 180, k: -0.2, w: 14 },
          { at: 108, k: 0.22, w: 15 }
        ]) + '"></path>'
    );
    svg.push(
      '<path class="contour-line" d="' +
        contourPath(455, 178, 68, 54, [{ at: 0, k: 0.1, w: 16 }]) + '"></path>'
    );
    svg.push(
      '<path class="contour-line" d="' + contourPath(250, 168, 32, 28, []) + '"></path>'
    );
    svg.push("</g>");

    /* 陡崖：两条等高线之间的短齿（陡崖符号） */
    svg.push('<g class="contour-hachures" aria-hidden="true">');
    var ticks = [
      [527, 176, 536, 176],
      [528, 184, 537, 184],
      [528, 192, 537, 192],
      [527, 200, 536, 200],
      [520, 208, 529, 208]
    ];
    for (var h = 0; h < ticks.length; h += 1) {
      svg.push(
        '<line class="contour-hachure" x1="' + ticks[h][0] + '" y1="' + ticks[h][1] +
          '" x2="' + ticks[h][2] + '" y2="' + ticks[h][3] + '"></line>'
      );
    }
    svg.push("</g>");

    /* 海拔注记：贴在线条上并用底色描边，避免压线看不清 */
    var labels = [
      { x: 447, y: 64, text: "100 米" },
      { x: 209, y: 114, text: "200 米" },
      { x: 255, y: 120, text: "300 米" },
      { x: 455, y: 128, text: "300 米" },
      { x: 250, y: 144, text: "400 米" }
    ];
    for (var k = 0; k < labels.length; k += 1) {
      svg.push(
        '<text class="contour-elev" x="' + labels[k].x + '" y="' + labels[k].y +
          '" text-anchor="middle">' + labels[k].text + "</text>"
      );
    }

    /* E 点用虚线引线指向陡崖处，避免圆点压住等高线 */
    svg.push('<line class="contour-leader" x1="550" y1="196" x2="553" y2="196"></line>');

    svg.push('<g class="contour-pins">');
    for (var p = 0; p < CONTOUR_POINTS.length; p += 1) {
      var point = CONTOUR_POINTS[p];
      svg.push(
        '<g class="contour-pin">' +
          '<circle class="contour-point" cx="' + point.x + '" cy="' + point.y + '" r="12"></circle>' +
          '<text class="contour-point-text" x="' + point.x + '" y="' + (point.y + 4.6) +
            '" text-anchor="middle">' + point.key + "</text>" +
        "</g>"
      );
    }
    svg.push("</g>");
    svg.push("</svg>");
    return svg.join("");
  }

  function buildContour(root) {
    instanceCount += 1;
    var uid = "ct" + instanceCount;
    var ids = {
      score: uid + "-score",
      rows: uid + "-rows",
      hint: uid + "-hint",
      feedback: uid + "-feedback",
      submit: uid + "-submit",
      reset: uid + "-reset"
    };
    var graded = false;

    function rowHtml(point) {
      var selectId = uid + "-sel-" + point.key;
      var options = CONTOUR_OPTIONS.map(function (name) {
        return '<option value="' + escapeHtml(name) + '">' + escapeHtml(name) + "</option>";
      }).join("");
      return (
        '<div class="contour-row" data-point="' + point.key + '">' +
          '<div class="contour-row-head">' +
            '<span class="contour-badge" aria-hidden="true">' + point.key + "</span>" +
            '<label class="contour-row-label" for="' + selectId + '">' + point.key + " 点</label>" +
            '<select class="contour-select" id="' + selectId + '" aria-label="' +
              point.key + ' 点的地形部位">' +
              '<option value="">请选择地形部位</option>' + options +
            "</select>" +
            '<span class="contour-mark" hidden></span>' +
          "</div>" +
          '<div class="contour-explain" hidden></div>' +
        "</div>"
      );
    }

    root.innerHTML =
      '<div class="contour-widget">' +
        '<div class="contour-toolbar">' +
          '<p class="contour-score" id="' + ids.score + '" role="status" aria-live="polite">答对 <strong>0</strong> / ' +
            CONTOUR_POINTS.length + "</p>" +
          '<p class="contour-method">看闭合定山顶 · 看凸向定脊谷 · 两顶之间是鞍部 · 等高线重叠是陡崖</p>' +
        "</div>" +
        '<figure class="contour-figure">' +
          '<div class="contour-chart">' + buildContourSvg() + "</div>" +
          "<figcaption>等高线地形示意图（等高距 100 米，数值单位：米）· 示意图，非标准地图</figcaption>" +
        "</figure>" +
        '<p class="contour-stem">读上图，判断 A—E 五个点位所在的地形部位。为每个点位选择一个答案后提交，系统会逐点判分并给出判读理由。</p>' +
        '<div class="contour-rows" id="' + ids.rows + '">' +
          CONTOUR_POINTS.map(rowHtml).join("") +
        "</div>" +
        '<p class="contour-hint" id="' + ids.hint + '" role="status" aria-live="polite" hidden></p>' +
        '<div class="contour-actions">' +
          '<button type="button" class="btn btn-primary" id="' + ids.submit + '">提交作答</button>' +
          '<button type="button" class="btn btn-secondary" id="' + ids.reset + '">重新作答</button>' +
        "</div>" +
        '<div class="contour-feedback" id="' + ids.feedback + '" role="status" aria-live="polite" hidden></div>' +
      "</div>";

    var scoreEl = root.querySelector("#" + ids.score);
    var hintEl = root.querySelector("#" + ids.hint);
    var feedbackEl = root.querySelector("#" + ids.feedback);
    var submitBtn = root.querySelector("#" + ids.submit);
    var resetBtn = root.querySelector("#" + ids.reset);
    var rows = root.querySelectorAll(".contour-row");

    function rowOf(key) {
      return root.querySelector('.contour-row[data-point="' + key + '"]');
    }

    function updateScore(correct) {
      scoreEl.innerHTML = "答对 <strong>" + correct + "</strong> / " + CONTOUR_POINTS.length;
    }

    function grade() {
      if (graded) {
        return;
      }
      var missing = [];
      for (var i = 0; i < CONTOUR_POINTS.length; i += 1) {
        var row = rowOf(CONTOUR_POINTS[i].key);
        var select = row.querySelector(".contour-select");
        if (!select.value) {
          missing.push(CONTOUR_POINTS[i].key);
          row.classList.add("is-missing");
        } else {
          row.classList.remove("is-missing");
        }
      }
      if (missing.length) {
        hintEl.hidden = false;
        hintEl.textContent =
          "还有 " + missing.join("、") + " 点没有选择，请为 A—E 每个点位都选好地形部位后再提交。";
        var firstMissing = rowOf(missing[0]).querySelector(".contour-select");
        if (firstMissing && typeof firstMissing.focus === "function") {
          firstMissing.focus();
        }
        return;
      }

      hintEl.hidden = true;
      hintEl.textContent = "";
      graded = true;

      var correct = 0;
      for (var j = 0; j < CONTOUR_POINTS.length; j += 1) {
        var point = CONTOUR_POINTS[j];
        var item = rowOf(point.key);
        var field = item.querySelector(".contour-select");
        var mark = item.querySelector(".contour-mark");
        var explain = item.querySelector(".contour-explain");
        var isRight = field.value === point.answer;
        if (isRight) {
          correct += 1;
        }

        item.classList.add("is-graded");
        mark.hidden = false;
        mark.className = "contour-mark " + (isRight ? "is-right" : "is-wrong");
        mark.textContent = isRight ? "正确" : "错误 · 应为" + point.answer;

        explain.hidden = false;
        explain.innerHTML =
          '<p><strong>为什么是「' + escapeHtml(point.answer) + "」：</strong>" +
            escapeHtml(point.why) + "</p>" +
          "<p><strong>判读要点：</strong>" + escapeHtml(point.tip) + "</p>";

        field.disabled = true;
      }

      updateScore(correct);
      feedbackEl.hidden = false;
      feedbackEl.className =
        "contour-feedback " + (correct === CONTOUR_POINTS.length ? "is-right" : "is-wrong");
      feedbackEl.innerHTML =
        '<p class="contour-verdict">' +
          (correct === CONTOUR_POINTS.length
            ? "全部答对：答对 " + correct + " / " + CONTOUR_POINTS.length + "，五类地形部位判读准确。"
            : "答对 " + correct + " / " + CONTOUR_POINTS.length +
              "。各点位下方已列出正确答案与判读理由，对照修正后可点「重新作答」再练一次。") +
        "</p>";
    }

    function reset() {
      graded = false;
      for (var i = 0; i < rows.length; i += 1) {
        var row = rows[i];
        var select = row.querySelector(".contour-select");
        select.value = "";
        select.disabled = false;
        row.classList.remove("is-graded", "is-missing");
        var mark = row.querySelector(".contour-mark");
        mark.hidden = true;
        mark.className = "contour-mark";
        mark.textContent = "";
        var explain = row.querySelector(".contour-explain");
        explain.hidden = true;
        explain.innerHTML = "";
      }
      hintEl.hidden = true;
      hintEl.textContent = "";
      feedbackEl.hidden = true;
      feedbackEl.className = "contour-feedback";
      feedbackEl.innerHTML = "";
      updateScore(0);
    }

    submitBtn.addEventListener("click", grade);
    resetBtn.addEventListener("click", reset);
  }

  BUILDERS.contour = buildContour;

  /* ================= 组件 4：地球运动与昼夜长短 ================= */

  /* 二分二至模式数据：tilt 为侧视图内地轴相对竖直方向的倾斜角（度，示意取 23.5），
     夏至北极倾向太阳（＋）、冬至背离（−）、春分/秋分竖直（0）。
     该表经 window.GeoLabInteractive.EARTH_MODES 对外暴露，供教学脚本与自检读取。 */
  var EARTH_MODES = {
    equinox: {
      key: "equinox",
      label: "春分 / 秋分",
      tilt: 0,
      subsolar: "0°（赤道）",
      subsolarLine: "赤道",
      dayNight: "昼夜等长，各地（极点附近除外）均 6 时日出、18 时日落",
      polar: "全球无极昼、极夜现象",
      note: "春分（3 月 21 日前后）与秋分（9 月 23 日前后）：太阳直射赤道，晨昏线与经线重合。"
    },
    summer: {
      key: "summer",
      label: "夏至",
      tilt: 23.5,
      subsolar: "23°26′N（北回归线）",
      subsolarLine: "北回归线",
      dayNight: "昼长夜短，且纬度越高白昼越长",
      polar: "北极圈及其以北出现极昼；南极圈及其以南出现极夜",
      note: "夏至（6 月 22 日前后）：太阳直射北回归线，北半球各地正午太阳高度全年最大、白昼最长。"
    },
    winter: {
      key: "winter",
      label: "冬至",
      tilt: -23.5,
      subsolar: "23°26′S（南回归线）",
      subsolarLine: "南回归线",
      dayNight: "昼短夜长，且纬度越高白昼越短",
      polar: "北极圈及其以北出现极夜；南极圈及其以南出现极昼",
      note: "冬至（12 月 22 日前后）：太阳直射南回归线，北半球各地正午太阳高度全年最小、白昼最短。"
    }
  };

  var EARTH_MODE_ORDER = ["equinox", "summer", "winter"];

  /* 配套口算题：判分规则内联（不接受外部输入做代码执行），解析与教材口径一致 */
  var EARTH_QUIZ = [
    {
      key: "sunangle",
      type: "number",
      stem:
        "夏至日，北京（约 40°N）的正午太阳高度约为多少度？（填写 72—75 范围内的度数均判正确）",
      placeholder: "如 73.5",
      explain:
        "正午太阳高度 H＝90°−|当地纬度−直射点纬度|。夏至日太阳直射 23°26′N，北京约 40°N：H＝90°−|40°−23°26′|＝90°−16°34′≈73°26′，约 73.5°，口算取 73° 左右即可，故 72—75 均判正确。"
    },
    {
      key: "daynight",
      type: "choice",
      stem: "冬至日，广州（约 23°N）的昼夜长短状况是？",
      options: ["昼长夜短", "昼短夜长", "昼夜等长", "出现极夜"],
      answer: 1,
      explain:
        "冬至日太阳直射南回归线（23°26′S），北半球各地昼短夜长、纬度越高白昼越短。广州约 23°N 位于北半球，故昼短夜长；其纬度远低于北极圈（66°34′N），不会出现极夜。"
    },
    {
      key: "polar",
      type: "choice",
      stem: "夏至日，北极圈及其以北地区出现的现象是？",
      options: ["极昼", "极夜", "昼夜等长", "无特殊现象"],
      answer: 0,
      explain:
        "夏至日太阳直射北回归线，晨昏线与北极圈相切，北极圈及其以北整日位于昼半球之内，出现极昼；同期南极圈及其以南出现极夜。"
    }
  ];

  /* 侧视示意图（viewBox 720 × 470）：太阳居左、平行光线向右；地球圆居右。
     地轴向太阳一侧的倾角随节气旋转：直射纬线的左端恒为光线与地球的切点（红点），
     晨昏线恒为垂直于光线的竖直直径，夜半球为其右侧半圆。 */
  function buildEarthSvg(mode, arrowId) {
    var C = { x: 520, y: 235 };
    var R = 165;
    var tiltRad = (mode.tilt * Math.PI) / 180;
    var u = { x: -Math.sin(tiltRad), y: -Math.cos(tiltRad) };
    var v = { x: Math.cos(tiltRad), y: -Math.sin(tiltRad) };

    function r1(n) {
      return Math.round(n * 10) / 10;
    }

    /* 纬度 phiDeg 的纬线在侧视图中的投影：垂直于地轴的弦，左端在光线切点侧 */
    function chord(phiDeg) {
      var phiRad = (phiDeg * Math.PI) / 180;
      var mx = C.x + R * Math.sin(phiRad) * u.x;
      var my = C.y + R * Math.sin(phiRad) * u.y;
      var half = R * Math.cos(phiRad);
      return {
        x1: r1(mx + half * v.x),
        y1: r1(my + half * v.y),
        x2: r1(mx - half * v.x),
        y2: r1(my - half * v.y),
        lx: r1(mx + half * 0.42 * v.x),
        ly: r1(my + half * 0.42 * v.y)
      };
    }

    var svg = [];
    svg.push(
      '<svg class="earth-svg" viewBox="0 0 720 470" role="img" aria-label="' +
        escapeHtml(mode.label) + "太阳光照侧视示意图：太阳直射点" + escapeHtml(mode.subsolar) +
        '" preserveAspectRatio="xMidYMid meet">'
    );
    svg.push(
      '<defs><marker id="' + arrowId +
        '" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
        '<path d="M0 0 L10 5 L0 10 z" class="earth-arrow-head"></path></marker></defs>'
    );

    /* 太阳与光芒 */
    svg.push('<circle class="earth-sun" cx="78" cy="235" r="30"></circle>');
    for (var s = 0; s < 8; s += 1) {
      var angle = (s / 8) * Math.PI * 2;
      svg.push(
        '<line class="earth-sun-ray" x1="' + r1(78 + Math.cos(angle) * 38) +
          '" y1="' + r1(235 + Math.sin(angle) * 38) +
          '" x2="' + r1(78 + Math.cos(angle) * 48) +
          '" y2="' + r1(235 + Math.sin(angle) * 48) + '"></line>'
      );
    }
    svg.push('<text class="earth-legend-text" x="78" y="300" text-anchor="middle">太阳</text>');

    /* 三条平行光线，居中一条为直射光线（正对红点） */
    var rayYs = [118, 235, 352];
    for (var r = 0; r < rayYs.length; r += 1) {
      svg.push(
        '<line class="earth-ray' + (r === 1 ? " is-direct" : "") + '" x1="132" y1="' +
          rayYs[r] + '" x2="340" y2="' + rayYs[r] +
          '" marker-end="url(#' + arrowId + ')"></line>'
      );
    }

    /* 地球圆（底色为昼半球） */
    svg.push(
      '<circle class="earth-globe" cx="' + C.x + '" cy="' + C.y + '" r="' + R + '"></circle>'
    );

    /* 赤道、南北回归线、南北极圈的投影弦；当前直射纬线加粗高亮 */
    var latLines = [
      { phi: 66.5, cls: "is-polar", label: "北极圈" },
      { phi: 23.5, cls: "", label: "北回归线" },
      { phi: 0, cls: "is-equator", label: "赤道" },
      { phi: -23.5, cls: "", label: "南回归线" },
      { phi: -66.5, cls: "is-polar", label: "南极圈" }
    ];
    for (var l = 0; l < latLines.length; l += 1) {
      var item = latLines[l];
      var ch = chord(item.phi);
      var isSubsolar = item.phi === mode.tilt;
      svg.push(
        '<line class="earth-latline ' + item.cls + (isSubsolar ? " is-subsolar" : "") +
          '" x1="' + ch.x1 + '" y1="' + ch.y1 + '" x2="' + ch.x2 + '" y2="' + ch.y2 + '"></line>'
      );
      svg.push(
        '<text class="earth-lat-label" x="' + ch.lx + '" y="' + r1(ch.ly + 4) +
          '" text-anchor="middle">' + item.label + "</text>"
      );
    }

    /* 夜半球半透明遮罩（右半圆）与晨昏线（竖直直径） */
    svg.push(
      '<path class="earth-night" d="M' + C.x + " " + (C.y - R) + " A" + R + " " + R +
        " 0 0 1 " + C.x + " " + (C.y + R) + ' Z"></path>'
    );
    svg.push(
      '<line class="earth-terminator" x1="' + C.x + '" y1="' + (C.y - R) +
        '" x2="' + C.x + '" y2="' + (C.y + R) + '"></line>'
    );

    /* 倾斜地轴与 N / S 标注 */
    svg.push(
      '<line class="earth-axis" x1="' + r1(C.x - 1.22 * R * u.x) + '" y1="' +
        r1(C.y - 1.22 * R * u.y) + '" x2="' + r1(C.x + 1.22 * R * u.x) + '" y2="' +
        r1(C.y + 1.22 * R * u.y) + '"></line>'
    );
    svg.push(
      '<text class="earth-axis-label" x="' + r1(C.x + 1.34 * R * u.x) + '" y="' +
        r1(C.y + 1.34 * R * u.y + 4) + '" text-anchor="middle">N（北极）</text>'
    );
    svg.push(
      '<text class="earth-axis-label" x="' + r1(C.x - 1.34 * R * u.x) + '" y="' +
        r1(C.y - 1.34 * R * u.y + 4) + '" text-anchor="middle">S（南极）</text>'
    );

    /* 直射点红点（光线与地球切点，恒在圆最左端）及其引注 */
    svg.push('<circle class="earth-subpoint" cx="' + (C.x - R) + '" cy="' + C.y + '" r="7"></circle>');
    svg.push('<text class="earth-sub-label" x="348" y="272" text-anchor="end">直射点</text>');

    /* 昼、夜半球标注（位置已避开三种模式的纬线投影弦） */
    svg.push('<text class="earth-zone-label" x="430" y="318" text-anchor="middle">昼半球</text>');
    svg.push('<text class="earth-zone-label" x="610" y="318" text-anchor="middle">夜半球</text>');

    svg.push("</svg>");
    return svg.join("");
  }

  function buildEarth(root) {
    instanceCount += 1;
    var uid = "ea" + instanceCount;
    var arrowId = uid + "-arrow";
    var ids = {
      figure: uid + "-figure",
      btnEquinox: uid + "-btn-eq",
      btnSummer: uid + "-btn-su",
      btnWinter: uid + "-btn-wi",
      subsolar: uid + "-subsolar",
      daynight: uid + "-daynight",
      polar: uid + "-polar",
      note: uid + "-note",
      score: uid + "-score",
      reset: uid + "-reset"
    };
    var correctCount = 0;
    var judged = {};

    function quizItemHtml(q, index) {
      var controlHtml = "";
      if (q.type === "number") {
        controlHtml =
          '<div class="earth-quiz-row">' +
            '<label class="earth-quiz-label" for="' + uid + "-in-" + q.key + '">正午太阳高度（度）</label>' +
            '<input class="earth-quiz-input" type="text" inputmode="decimal" id="' +
              uid + "-in-" + q.key + '" placeholder="' + escapeHtml(q.placeholder) +
              '" aria-describedby="' + uid + "-mark-" + q.key + '">' +
            '<button type="button" class="btn btn-secondary" id="' + uid + "-check-" + q.key + '">核对答案</button>' +
          "</div>";
      } else {
        var optionsHtml = q.options
          .map(function (opt, oi) {
            var optId = uid + "-opt-" + q.key + "-" + oi;
            return (
              '<label class="earth-option" for="' + optId + '">' +
                '<input type="radio" name="' + uid + "-rg-" + q.key + '" id="' + optId +
                  '" value="' + oi + '">' +
                "<span>" + escapeHtml(opt) + "</span>" +
              "</label>"
            );
          })
          .join("");
        controlHtml =
          '<fieldset class="earth-fieldset">' +
            '<legend class="earth-fieldset-legend">第 ' + (index + 1) + " 题选项</legend>" +
            '<div class="earth-options">' + optionsHtml + "</div>" +
          "</fieldset>";
      }
      return (
        '<div class="earth-quiz-item" data-qkey="' + q.key + '">' +
          '<p class="earth-quiz-stem">' + (index + 1) + ". " + escapeHtml(q.stem) + "</p>" +
          controlHtml +
          '<p class="earth-quiz-mark" id="' + uid + "-mark-" + q.key +
            '" role="status" aria-live="polite" hidden></p>' +
          '<div class="earth-quiz-explain" hidden><p>' + escapeHtml(q.explain) + "</p></div>" +
        "</div>"
      );
    }

    root.innerHTML =
      '<div class="earth-widget">' +
        '<div class="earth-modes" role="group" aria-label="二分二至模式切换">' +
          '<button type="button" class="earth-mode-btn" id="' + ids.btnEquinox +
            '" aria-pressed="false">春分 / 秋分</button>' +
          '<button type="button" class="earth-mode-btn" id="' + ids.btnSummer +
            '" aria-pressed="true">夏至</button>' +
          '<button type="button" class="earth-mode-btn" id="' + ids.btnWinter +
            '" aria-pressed="false">冬至</button>' +
        "</div>" +
        '<figure class="earth-figure">' +
          '<div class="earth-chart" id="' + ids.figure + '"></div>' +
          '<figcaption>侧视示意图：太阳光自左向右平行射来；红点为太阳直射点，虚线为晨昏线，深色区域为夜半球；地轴倾角与各纬线位置随节气变化。示意图，非标准地图。</figcaption>' +
        "</figure>" +
        '<dl class="earth-info">' +
          '<div class="earth-info-row"><dt>太阳直射点</dt><dd id="' + ids.subsolar + '"></dd></div>' +
          '<div class="earth-info-row"><dt>北半球昼夜长短</dt><dd id="' + ids.daynight + '"></dd></div>' +
          '<div class="earth-info-row"><dt>极昼极夜范围</dt><dd id="' + ids.polar + '"></dd></div>' +
        "</dl>" +
        '<p class="earth-note" id="' + ids.note + '"></p>' +
        '<section class="earth-quiz" aria-label="口算检验">' +
          '<div class="earth-quiz-head">' +
            '<h3 class="earth-quiz-title">口算检验</h3>' +
            '<p class="earth-quiz-score" id="' + ids.score +
              '" role="status" aria-live="polite">答对 <strong>0</strong> / ' + EARTH_QUIZ.length + "</p>" +
          "</div>" +
          EARTH_QUIZ.map(quizItemHtml).join("") +
          '<div class="earth-actions">' +
            '<button type="button" class="btn btn-secondary" id="' + ids.reset + '">清空重做</button>' +
          "</div>" +
        "</section>" +
      "</div>";

    var figureEl = root.querySelector("#" + ids.figure);
    var subsolarEl = root.querySelector("#" + ids.subsolar);
    var daynightEl = root.querySelector("#" + ids.daynight);
    var polarEl = root.querySelector("#" + ids.polar);
    var noteEl = root.querySelector("#" + ids.note);
    var scoreEl = root.querySelector("#" + ids.score);
    var resetBtn = root.querySelector("#" + ids.reset);

    var modeButtons = EARTH_MODE_ORDER.map(function (key, index) {
      var id = index === 0 ? ids.btnEquinox : index === 1 ? ids.btnSummer : ids.btnWinter;
      var el = root.querySelector("#" + id);
      el.addEventListener("click", function () {
        setMode(key);
      });
      return { key: key, el: el };
    });

    function setMode(key) {
      var mode = EARTH_MODES[key];
      figureEl.innerHTML = buildEarthSvg(mode, arrowId);
      subsolarEl.textContent = mode.subsolar;
      daynightEl.textContent = mode.dayNight;
      polarEl.textContent = mode.polar;
      noteEl.textContent = mode.note;
      for (var i = 0; i < modeButtons.length; i += 1) {
        var isActive = modeButtons[i].key === key;
        modeButtons[i].el.classList.toggle("is-active", isActive);
        modeButtons[i].el.setAttribute("aria-pressed", isActive ? "true" : "false");
      }
    }

    function updateScore() {
      scoreEl.innerHTML = "答对 <strong>" + correctCount + "</strong> / " + EARTH_QUIZ.length;
    }

    function reveal(q, ok) {
      judged[q.key] = true;
      if (ok) {
        correctCount += 1;
      }
      var mark = root.querySelector("#" + uid + "-mark-" + q.key);
      mark.hidden = false;
      mark.className = "earth-quiz-mark " + (ok ? "is-right" : "is-wrong");
      mark.textContent = ok ? "回答正确。" : "回答错误，请看下方解析。";
      var item = root.querySelector('.earth-quiz-item[data-qkey="' + q.key + '"]');
      item.querySelector(".earth-quiz-explain").hidden = false;
      updateScore();
    }

    function judgeNumber(q) {
      if (judged[q.key]) {
        return;
      }
      var input = root.querySelector("#" + uid + "-in-" + q.key);
      var mark = root.querySelector("#" + uid + "-mark-" + q.key);
      var raw = String(input.value || "").trim();
      var num = parseFloat(raw);
      if (!raw || !isFinite(num)) {
        mark.hidden = false;
        mark.className = "earth-quiz-mark";
        mark.textContent = "请先输入 0—90 之间的度数，再点「核对答案」。";
        return;
      }
      input.disabled = true;
      root.querySelector("#" + uid + "-check-" + q.key).disabled = true;
      reveal(q, num >= 72 && num <= 75);
    }

    function bindChoice(q) {
      var radios = Array.prototype.slice.call(
        root.querySelectorAll('input[name="' + uid + "-rg-" + q.key + '"]')
      );
      radios.forEach(function (radio) {
        radio.addEventListener("change", function (e) {
          if (judged[q.key]) {
            return;
          }
          var chosen = Number(e.target.value);
          var isRight = chosen === q.answer;
          radios.forEach(function (r) {
            r.disabled = true;
          });
          var item = root.querySelector('.earth-quiz-item[data-qkey="' + q.key + '"]');
          var labels = Array.prototype.slice.call(item.querySelectorAll(".earth-option"));
          labels.forEach(function (label, li) {
            label.classList.add("is-locked");
            if (li === q.answer) {
              label.classList.add("is-correct");
            } else if (li === chosen) {
              label.classList.add("is-wrong");
            }
          });
          reveal(q, isRight);
        });
      });
    }

    function resetQuiz() {
      correctCount = 0;
      judged = {};
      EARTH_QUIZ.forEach(function (q) {
        var mark = root.querySelector("#" + uid + "-mark-" + q.key);
        mark.hidden = true;
        mark.className = "earth-quiz-mark";
        mark.textContent = "";
        var item = root.querySelector('.earth-quiz-item[data-qkey="' + q.key + '"]');
        item.querySelector(".earth-quiz-explain").hidden = true;
        if (q.type === "number") {
          var input = root.querySelector("#" + uid + "-in-" + q.key);
          input.value = "";
          input.disabled = false;
          root.querySelector("#" + uid + "-check-" + q.key).disabled = false;
        } else {
          var radios = Array.prototype.slice.call(
            root.querySelectorAll('input[name="' + uid + "-rg-" + q.key + '"]')
          );
          radios.forEach(function (radio) {
            radio.checked = false;
            radio.disabled = false;
          });
          var labels = Array.prototype.slice.call(item.querySelectorAll(".earth-option"));
          labels.forEach(function (label) {
            label.classList.remove("is-locked", "is-correct", "is-wrong");
          });
        }
      });
      updateScore();
    }

    EARTH_QUIZ.forEach(function (q) {
      if (q.type === "number") {
        var input = root.querySelector("#" + uid + "-in-" + q.key);
        var checkBtn = root.querySelector("#" + uid + "-check-" + q.key);
        checkBtn.addEventListener("click", function () {
          judgeNumber(q);
        });
        input.addEventListener("keydown", function (e) {
          if (e && e.key === "Enter") {
            judgeNumber(q);
          }
        });
      } else {
        bindChoice(q);
      }
    });
    resetBtn.addEventListener("click", resetQuiz);

    /* 默认展示夏至（与口算题情境一致） */
    setMode("summer");
    updateScore();
  }

  BUILDERS.earth = buildEarth;

  /* ================= 对外接口与首次加载补偿 ================= */

  window.GeoLabInteractive = { mountAll: mountAll, EARTH_MODES: EARTH_MODES };

  /* 本文件在 js/app.js 之后引入：首次加载 #/lab 时，app.js 渲染视图时
     本对象尚未就绪；这里在文档就绪后补扫一次主视图，确保组件挂上。 */
  function autoMountOnLoad() {
    var viewRoot = document.getElementById("view");
    if (viewRoot) {
      mountAll(viewRoot);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoMountOnLoad);
  } else {
    autoMountOnLoad();
  }
})();
