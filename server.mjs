/* GeoLab · 静态服务 + AI 助教模型代理
   仅使用 Node 内置模块（node:http / fs / path / vm），零 npm 依赖。
   两种模式由 GEO_MODEL_MODE 切换：offline（默认）/ openai。
   契约见 SPEC §8：GET /api/health、POST /api/chat（SSE 流式）。 */

import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number.parseInt(process.env.PORT || "8787", 10) || 8787;

const MODES = ["offline", "openai", "teleagent"];
const RAW_MODE = String(process.env.GEO_MODEL_MODE || "offline").trim().toLowerCase();
const MODE = MODES.indexOf(RAW_MODE) === -1 ? "offline" : RAW_MODE;

const OPENAI_BASE_URL = String(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const OPENAI_MODEL = String(process.env.OPENAI_MODEL || "gpt-4o-mini");

const TELEAGENT_BASE = String(process.env.TELEAGENT_BASE_URL || "http://127.0.0.1:4397").replace(/\/+$/, "");
const TELEAGENT_MODEL = String(process.env.TELEAGENT_MODEL || "NewApi/chat-pro");

const MODEL_NAME =
  MODE === "openai" ? OPENAI_MODEL :
  MODE === "teleagent" ? "TeleAgent 本机模型" :
  "GeoLab 离线知识库";

const UPSTREAM_TIMEOUT_MS = 120000;

/* 助教人设：三模式统一注入 */
const PERSONA =
  "你是 GeoLab 的高中地理助教，面向中国高中生，使用人教版教材口径。先给结论，再给推理链；" +
  "判读类用「以温定带、以水定型」等方法；不超纲；不确定时说「教材口径下通常这样表述」；" +
  "出题必须给答案与解析；拒绝与地理学习无关的任务并引导回学习；" +
  "涉及中国版图表述用「中国台湾」「中国香港」「中国澳门」。";

/* ================= 通用工具 ================= */

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".map": "application/json; charset=utf-8"
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function sendJson(res, status, payload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": body.length,
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function sendText(res, status, text) {
  const body = Buffer.from(String(text), "utf8");
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": body.length
  });
  res.end(body);
}

function sseWrite(res, payload) {
  if (res.destroyed || res.writableEnded) {
    return false;
  }
  res.write("data: " + JSON.stringify(payload) + "\n\n");
  return true;
}

function sseDone(res) {
  if (!res.destroyed && !res.writableEnded) {
    res.write("data: [DONE]\n\n");
    res.end();
  }
}

function openSse(res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });
  res.write(": geolab sse\n\n");
}

/* 逐字流式输出（离线模式 / 本机模型文本转发） */
async function streamChars(res, text, signal) {
  let index = 0;
  while (index < text.length) {
    if (res.destroyed || res.writableEnded || (signal && signal.aborted)) {
      return false;
    }
    const step = 1 + Math.floor(Math.random() * 3);
    const piece = text.slice(index, index + step);
    index += step;
    if (!sseWrite(res, { delta: piece })) {
      return false;
    }
    await sleep(10 + Math.floor(Math.random() * 11));
  }
  return true;
}

function readBody(req, limitBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(new Error("请求体过大"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/* ================= 知识库（node:vm 沙箱加载） ================= */

let KB_CACHE = null;

/* 离线高频补充条目：知识卡未单列、但学生常问的教材级问题 */
const EXTRA_TOPICS = [
  {
    id: "extra-climate",
    title: "地中海气候的成因与特点",
    summary: "地中海气候分布在南北纬 30°—40° 的大陆西岸，夏季受副热带高压控制炎热干燥，冬季受西风带控制温和多雨，因此「冬雨夏干」。",
    keyPoints: [
      "成因核心是气压带、风带的季节移动：夏季副热带高压控制，气流下沉，炎热干燥；冬季西风带控制，西风从海洋带来湿润气流，温和多雨。",
      "分布规律：南北纬 30°—40° 大陆西岸，以地中海沿岸最典型。",
      "气候特征：夏季炎热干燥、冬季温和多雨，最冷月均温在 0℃ 以上，属于亚热带气候。",
      "判读方法：以温定带——最冷月均温 0℃—15℃ 判为亚热带；以水定型——降水集中在冬季，判为冬雨型，即地中海气候。"
    ],
    pitfalls: [
      "误区：地中海气候夏季多雨。实际夏季受副热带高压控制，下沉气流为主，炎热干燥。",
      "误区：只要位于大陆西岸就是地中海气候。还需满足纬度 30°—40° 与「冬雨夏干」的降水特征。"
    ],
    example: "意大利罗马夏季晴朗干燥、冬季温和多雨；我国没有地中海气候分布，但新疆伊犁谷地等局部地区降水季节分配有相似之处。",
    quizTags: ["地中海气候", "副热带高压", "西风带", "冬雨夏干"],
    moduleTitle: "拓展 · 高频问题"
  },
  {
    id: "extra-timezone",
    title: "时区与区时计算",
    summary: "全球按经度每 15° 划分为一个时区，共 24 个时区；区时计算遵循「东加西减」，跨越日界线要变更日期。",
    keyPoints: [
      "时区划分：以本初子午线为中心，向东、向西各 7.5° 为中时区（零时区），其余每 15° 一个时区。",
      "中央经线度数 = 时区号 × 15°；区时采用该时区中央经线的地方时。",
      "计算方法：先求两地时区差（同侧相减、异侧相加），再按「东加西减」推算，注意跨日与日期变更。",
      "日界线：大致沿 180° 经线，自西向东越过日界线日期减一天，自东向西越过日期加一天。"
    ],
    pitfalls: [
      "误区：地方时与区时是一回事。地方时因经度不同而不同，区时是时区中央经线的地方时，同一时区内统一使用。",
      "误区：跨越日界线时刻也要加减。跨越日界线只变更日期，钟点不变。"
    ],
    example: "北京时间采用东八区区时（120°E 地方时），纽约位于西五区，两地相差 13 个时区，北京 12:00 时纽约为前一日 23:00。",
    quizTags: ["时区", "区时", "日界线", "北京时间"],
    moduleTitle: "拓展 · 高频问题"
  }
];

function loadKnowledge() {
  if (KB_CACHE) {
    return KB_CACHE;
  }
  const file = path.join(ROOT, "data", "knowledge.js");
  const code = fs.readFileSync(file, "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: "data/knowledge.js", timeout: 5000 });
  const data = sandbox.window && sandbox.window.GEO_DATA;
  const points = [];
  if (data && Array.isArray(data.modules)) {
    data.modules.forEach((mod) => {
      (mod.points || []).forEach((point) => {
        points.push(Object.assign({}, point, { moduleTitle: mod.title, moduleId: mod.id }));
      });
    });
  }
  EXTRA_TOPICS.forEach((topic) => points.push(Object.assign({}, topic)));
  KB_CACHE = { points: points };
  return KB_CACHE;
}

/* ================= 关键词匹配 ================= */

function stripPunct(text) {
  return String(text || "").replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, "");
}

function bigrams(text) {
  const clean = stripPunct(text);
  const set = new Set();
  for (let i = 0; i < clean.length - 1; i += 1) {
    set.add(clean.slice(i, i + 2));
  }
  return set;
}

function overlapCount(setA, setB) {
  let count = 0;
  setA.forEach((item) => {
    if (setB.has(item)) {
      count += 1;
    }
  });
  return count;
}

function titleSegments(title) {
  return String(title || "")
    .split(/[及与和的地之、，,：:（）()\s—–-]+/)
    .filter((item) => item.length >= 2);
}

function scorePoint(point, question, questionSet) {
  const qText = stripPunct(question);
  let score = 0;
  const title = point.title || "";
  if (qText.indexOf(stripPunct(title)) !== -1 && stripPunct(title).length >= 3) {
    score += 60;
  }
  /* 标题按短语拆分后命中（如「洋流」「气旋」），避免长标题稀释权重 */
  titleSegments(title).forEach((segment) => {
    const clean = stripPunct(segment);
    if (clean.length >= 2 && qText.indexOf(clean) !== -1) {
      score += 20;
    }
  });
  score += overlapCount(bigrams(title), questionSet) * 6;
  (point.quizTags || []).forEach((tag) => {
    if (qText.indexOf(stripPunct(tag)) !== -1 && stripPunct(tag).length >= 2) {
      score += 18;
    } else {
      score += overlapCount(bigrams(tag), questionSet) * 3;
    }
  });
  const bodySet = bigrams(
    [point.summary || ""].concat(point.keyPoints || [], point.pitfalls || []).join("")
  );
  score += Math.min(overlapCount(bodySet, questionSet), 18);
  return score;
}

function matchPoint(question) {
  const kb = loadKnowledge();
  if (!kb.points.length) {
    return null;
  }
  const questionSet = bigrams(question);
  let best = null;
  let bestScore = 0;
  kb.points.forEach((point) => {
    const score = scorePoint(point, question, questionSet);
    if (score > bestScore) {
      bestScore = score;
      best = point;
    }
  });
  if (!best || bestScore < 12) {
    return null;
  }
  return { point: best, score: bestScore };
}

/* ================= 离线回答生成 ================= */

function trimPitfall(text) {
  return String(text).replace(/^误区[：:]\s*/, "").replace(/^实际/, "实际");
}

function answerExplain(point) {
  const lines = [];
  lines.push("### 结论");
  lines.push(point.summary);
  lines.push("");
  lines.push("### 推理链（关键要点）");
  (point.keyPoints || []).slice(0, 5).forEach((item, index) => {
    lines.push((index + 1) + ". " + item);
  });
  lines.push("");
  lines.push("### 常见误区");
  (point.pitfalls || []).slice(0, 2).forEach((item) => {
    lines.push("- " + trimPitfall(item));
  });
  if (point.example) {
    lines.push("");
    lines.push("### 案例 / 场景");
    lines.push(point.example);
  }
  lines.push("");
  lines.push("> 知识卡位置：" + (point.moduleTitle || "本地知识库") + " · " + point.title);
  lines.push("> 当前为离线演示模式：答案由本地知识库按关键词匹配生成，不联网；配置模型后可自由追问。");
  return lines.join("\n");
}

function firstClause(text) {
  const parts = String(text).split(/[，,。；;]/);
  return parts[0] || String(text);
}

function answerQuiz(point) {
  const questions = [];
  questions.push({
    q: "请用一句话概括「" + point.title + "」的核心含义。",
    a: point.summary
  });
  (point.keyPoints || []).slice(0, 2).forEach((keyPoint, index) => {
    const colon = keyPoint.indexOf("：");
    if (colon > 4) {
      questions.push({
        q: "简述「" + keyPoint.slice(0, colon) + "」的具体内容，并说明其地理意义。",
        a: keyPoint
      });
    } else {
      questions.push({
        q: "如何理解「" + firstClause(keyPoint) + "」？请结合「" + point.title + "」作答。",
        a: keyPoint
      });
    }
  });

  const lines = [];
  lines.push("### 自测题 · " + point.title + "（共 " + questions.length + " 题）");
  lines.push("");
  questions.forEach((item, index) => {
    lines.push("**第 " + (index + 1) + " 题（简答）** " + item.q);
    lines.push("");
    lines.push("**参考答案要点**");
    lines.push("- " + item.a);
    lines.push("");
  });
  if ((point.pitfalls || []).length) {
    lines.push("### 易错提醒");
    (point.pitfalls || []).slice(0, 2).forEach((item) => {
      lines.push("- " + trimPitfall(item));
    });
    lines.push("");
  }
  lines.push("> 离线演示模式出题：题目由本地知识卡生成；配置模型后可指定难度与题量。");
  return lines.join("\n");
}

function answerChecklist(point) {
  const tags = (point.quizTags || []).join("、") || point.title;
  const lines = [];
  lines.push("### 检查清单 · " + point.title + " 类题目");
  lines.push("");
  lines.push("1. **审题**：先划出题干里的关键词——「" + tags + "」，判断它在问成因、过程、影响还是措施。");
  lines.push("2. **搭框架**：按「结论 → 推理链 → 结论回扣」组织，成因题分自然与人为两方面，影响题分有利与不利。");
  lines.push("3. **补要点**：对照知识卡逐条核对——");
  (point.keyPoints || []).slice(0, 4).forEach((item) => {
    lines.push("   - " + item);
  });
  lines.push("4. **防失分**：");
  (point.pitfalls || []).slice(0, 2).forEach((item) => {
    lines.push("   - " + trimPitfall(item));
  });
  lines.push("");
  lines.push("> 建议：把答案按上面 4 步自查一遍再提交；离线演示模式只能给检查清单，不能逐句批改。");
  return lines.join("\n");
}

function answerFallback(question) {
  return [
    "### 结论",
    "我暂未在本地知识库中匹配到与「" + String(question).slice(0, 30) + "」直接对应的知识点，这里先给通用学习建议。",
    "",
    "### 建议这样学",
    "1. **定位章节**：先判断问题属于自然地理（大气、水、地貌、地球运动）还是人文地理（人口、城镇、产业、区域）。",
    "2. **抓因果链**：地理题大多在问「为什么这样分布」「这样会带来什么影响」，用「位置 → 要素 → 过程 → 结果」串起来。",
    "3. **对照知识卡**：在「学习」页按模块浏览知识卡，重点看常见误区，那里往往是失分点。",
    "4. **动手验证**：到「实验室」用互动组件调节参数，观察变化，比死记结论更有效。",
    "",
    "> 离线演示模式：仅能基于本地知识卡做关键词匹配，换个更具体的问法（如「冷锋过境后天气怎么变」）命中率更高。"
  ].join("\n");
}

function buildOfflineAnswer(question) {
  const matched = matchPoint(question);
  const q = String(question || "").trim();
  if (!q) {
    return answerFallback("这个知识点");
  }
  if (!matched) {
    return answerFallback(q);
  }
  const point = matched.point;
  if (/批改|帮我改|打分|评分|错在哪|检查一下|我这样答|看看我写/.test(q)) {
    return answerChecklist(point);
  }
  if (/出题|出.{0,4}道|出道|练习题|考考我|测验|做题|题目|几道|简答题|自测/.test(q)) {
    return answerQuiz(point);
  }
  return answerExplain(point);
}

function lastUserMessage(messages) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const item = messages[i];
    if (item && item.role === "user" && typeof item.content === "string") {
      return item.content;
    }
  }
  return "";
}

/* ================= OpenAI 兼容模式 ================= */

function sanitizeMessages(messages) {
  return messages
    .filter((item) => item && (item.role === "user" || item.role === "assistant"))
    .map((item) => ({ role: item.role, content: String(item.content || "").slice(0, 8000) }))
    .filter((item) => item.content.trim().length > 0)
    .slice(-16);
}

async function streamOpenAI(res, messages, signal) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    sseWrite(res, { error: "openai 模式未配置 OPENAI_API_KEY，请设置环境变量后重启 server.mjs。" });
    sseDone(res);
    return;
  }
  const payload = {
    model: OPENAI_MODEL,
    stream: true,
    temperature: 0.4,
    messages: [{ role: "system", content: PERSONA }].concat(sanitizeMessages(messages))
  };

  let upstream;
  try {
    upstream = await fetch(OPENAI_BASE_URL + "/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey
      },
      body: JSON.stringify(payload),
      signal
    });
  } catch (err) {
    sseWrite(res, { error: describeError(err, "无法连接模型服务") });
    sseDone(res);
    return;
  }

  if (!upstream.ok || !upstream.body) {
    let detail = "";
    try {
      detail = (await upstream.text()).slice(0, 300);
    } catch (err) {
      detail = "";
    }
    sseWrite(res, {
      error: "模型服务返回 " + upstream.status + (detail ? "：" + detail.replace(/\s+/g, " ") : "")
    });
    sseDone(res);
    return;
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let finished = false;
  try {
    while (!finished) {
      const chunk = await reader.read();
      if (chunk.done) {
        break;
      }
      if (res.destroyed || signal.aborted) {
        break;
      }
      buffer += decoder.decode(chunk.value, { stream: true });
      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        newlineIndex = buffer.indexOf("\n");
        if (!line || line.charAt(0) === ":") {
          continue;
        }
        if (line.indexOf("data:") !== 0) {
          continue;
        }
        const data = line.slice(5).trim();
        if (data === "[DONE]") {
          finished = true;
          break;
        }
        try {
          const parsed = JSON.parse(data);
          const delta = parsed && parsed.choices && parsed.choices[0] && parsed.choices[0].delta;
          const text = delta && typeof delta.content === "string" ? delta.content : "";
          if (text && !sseWrite(res, { delta: text })) {
            finished = true;
            break;
          }
        } catch (err) {
          /* 忽略无法解析的心跳行 */
        }
      }
    }
  } catch (err) {
    if (!signal.aborted) {
      sseWrite(res, { error: describeError(err, "读取模型响应失败") });
    }
  } finally {
    try {
      reader.cancel();
    } catch (err) {
      /* 忽略取消异常 */
    }
  }
  sseDone(res);
}

function describeError(err, fallback) {
  const message = err && err.message ? String(err.message) : "";
  if (err && (err.name === "AbortError" || err.name === "TimeoutError")) {
    return "模型响应超时（120 秒），请重试或换用更短的提问。";
  }
  if (/fetch failed|ECONNREFUSED|ENOTFOUND|network/i.test(message)) {
    return fallback + "：网络不可达或本地服务未启动。";
  }
  return fallback + (message ? "：" + message : "");
}

/* ================= TeleAgent 本机模式 ================= */

const TA_SESSIONS = new Map();
const TA_INITIALIZED = new Set();

function readTeleagentKey() {
  const direct = process.env.TELEAGENT_SESSION_KEY;
  if (direct && direct.trim()) {
    return direct.trim();
  }
  const file = process.env.TELEAGENT_KEY_FILE;
  if (file && file.trim()) {
    try {
      return fs.readFileSync(file.trim(), "utf8").trim();
    } catch (err) {
      return "";
    }
  }
  return "";
}

function signTaHeaders(method, pathname, key) {
  const timestamp = String(Date.now());
  const nonce = crypto.randomBytes(12).toString("hex");
  const payload = ["local-v1", method.toUpperCase(), pathname, timestamp, nonce].join("\n");
  const signature = crypto.createHmac("sha256", key).update(payload).digest("base64url");
  return {
    "X-SA-Sign-Version": "local-v1",
    "X-SA-Timestamp": timestamp,
    "X-SA-Nonce": nonce,
    "X-SA-Signature": signature
  };
}

async function taRequest(method, pathname, body, key, signal) {
  const headers = Object.assign(
    { "Content-Type": "application/json", Accept: "application/json" },
    signTaHeaders(method, pathname, key)
  );
  const response = await fetch(TELEAGENT_BASE + pathname, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (err) {
    data = { content: text };
  }
  if (!response.ok) {
    throw new Error(
      "TeleAgent 返回 " + response.status + (text ? "：" + text.slice(0, 160).replace(/\s+/g, " ") : "")
    );
  }
  return data;
}

function taExtractText(data, depth) {
  const d = typeof depth === "number" ? depth : 0;
  if (!data || d > 5) {
    return "";
  }
  if (typeof data === "string") {
    return data;
  }
  if (Array.isArray(data.parts)) {
    const texts = data.parts
      .filter((part) => part && part.type === "text" && typeof part.text === "string")
      .map((part) => part.text);
    if (texts.length) {
      return texts.join("\n");
    }
  }
  if (data.data) {
    const nested = taExtractText(data.data, d + 1);
    if (nested) {
      return nested;
    }
  }
  if (data.message) {
    const nested = taExtractText(data.message, d + 1);
    if (nested) {
      return nested;
    }
  }
  if (typeof data.content === "string" && data.content.trim()) {
    return data.content;
  }
  if (typeof data.text === "string" && data.text.trim()) {
    return data.text;
  }
  return "";
}

async function askTeleagent(question, sessionId, signal) {
  const key = readTeleagentKey();
  if (!key) {
    throw new Error("未配置 TELEAGENT_SESSION_KEY 或 TELEAGENT_KEY_FILE（请用 start-server.ps1 启动）");
  }
  const cacheKey = String(sessionId || "geolab-default").slice(0, 120);
  let taSessionId = TA_SESSIONS.get(cacheKey);
  if (!taSessionId) {
    const created = await taRequest("POST", "/session", { title: "GeoLab 地理助教" }, key, signal);
    taSessionId = (created && (created.id || (created.data && created.data.id))) || "";
    if (!taSessionId) {
      throw new Error("TeleAgent 会话创建失败（未返回会话 id）");
    }
    TA_SESSIONS.set(cacheKey, taSessionId);
  }

  let prompt = question;
  if (!TA_INITIALIZED.has(taSessionId)) {
    prompt = PERSONA + "\n\n【学生提问】" + question;
  }

  const slash = TELEAGENT_MODEL.indexOf("/");
  const model = slash > 0
    ? { providerID: TELEAGENT_MODEL.slice(0, slash), modelID: TELEAGENT_MODEL.slice(slash + 1) }
    : { providerID: "NewApi", modelID: TELEAGENT_MODEL };

  const reply = await taRequest(
    "POST",
    "/session/" + encodeURIComponent(taSessionId) + "/message",
    { model, parts: [{ type: "text", text: prompt }] },
    key,
    signal
  );
  TA_INITIALIZED.add(taSessionId);
  const text = taExtractText(reply);
  if (!text) {
    throw new Error("TeleAgent 未返回可用的回答文本");
  }
  return text;
}

/* ================= /api/chat ================= */

async function handleChat(req, res) {
  let raw;
  try {
    raw = await readBody(req, 512 * 1024);
  } catch (err) {
    sendJson(res, 413, { ok: false, error: "请求体过大或读取失败" });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(raw || "{}");
  } catch (err) {
    sendJson(res, 400, { ok: false, error: "请求体不是合法 JSON" });
    return;
  }

  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  const question = lastUserMessage(messages).trim();
  if (!question) {
    sendJson(res, 400, { ok: false, error: "messages 中缺少 role=user 的问题内容" });
    return;
  }

  openSse(res);

  const controller = new AbortController();
  let clientGone = false;
  res.on("close", () => {
    if (!res.writableEnded) {
      clientGone = true;
      controller.abort();
    }
  });

  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    if (MODE === "openai") {
      await streamOpenAI(res, messages, controller.signal);
    } else if (MODE === "teleagent") {
      try {
        const answer = await askTeleagent(question, payload.sessionId, controller.signal);
        await streamChars(res, answer, controller.signal);
      } catch (err) {
        if (!clientGone && !controller.signal.aborted) {
          sseWrite(res, { delta: "（TeleAgent 本机服务不可用，已降级为离线演示模式）\n\n" });
          const fallback = buildOfflineAnswer(question);
          await streamChars(res, fallback, controller.signal);
        }
      }
      sseDone(res);
    } else {
      const answer = buildOfflineAnswer(question);
      await streamChars(res, answer, controller.signal);
      sseDone(res);
    }
  } catch (err) {
    if (!clientGone && !res.writableEnded) {
      sseWrite(res, { error: describeError(err, "服务端处理失败") });
      sseDone(res);
    }
  } finally {
    clearTimeout(timeout);
    if (!res.writableEnded && !res.destroyed) {
      res.end();
    }
  }
}

/* ================= 静态文件服务 ================= */

function resolveStatic(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch (err) {
    return null;
  }
  if (decoded.indexOf("\0") !== -1) {
    return null;
  }
  let rel = decoded.replace(/\\/g, "/");
  if (rel === "/" || rel === "") {
    rel = "/index.html";
  }
  const normalized = path.normalize(rel).replace(/^([/\\])+/, "");
  if (normalized.split(/[/\\]/).indexOf("..") !== -1) {
    return null;
  }
  const filePath = path.join(ROOT, normalized);
  if (filePath !== ROOT && filePath.indexOf(ROOT + path.sep) !== 0) {
    return null;
  }
  return filePath;
}

function serveStatic(req, res, pathname, search) {
  const filePath = resolveStatic(pathname);
  if (!filePath) {
    sendText(res, 403, "403 Forbidden");
    return;
  }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat) {
      sendText(res, 404, "404 Not Found");
      return;
    }
    if (stat.isDirectory()) {
      serveFile(req, res, path.join(filePath, "index.html"), search);
      return;
    }
    serveFile(req, res, filePath, search);
  });
}

function serveFile(req, res, filePath, search) {
  fs.stat(filePath, (statErr, stat) => {
    if (statErr || !stat.isFile()) {
      sendText(res, 404, "404 Not Found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    const headers = {
      "Content-Type": type,
      "Content-Length": stat.size,
      "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=60",
      "X-Content-Type-Options": "nosniff"
    };
    res.writeHead(200, headers);
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    const stream = fs.createReadStream(filePath);
    stream.on("error", () => {
      if (!res.headersSent) {
        sendText(res, 500, "500 Internal Server Error");
      } else {
        res.destroy();
      }
    });
    stream.pipe(res);
  });
}

/* ================= 服务器 ================= */

const server = http.createServer((req, res) => {
  let parsed;
  try {
    parsed = new URL(req.url || "/", "http://127.0.0.1");
  } catch (err) {
    sendText(res, 400, "400 Bad Request");
    return;
  }
  const pathname = parsed.pathname;

  if (pathname === "/api/health") {
    if (req.method !== "GET" && req.method !== "HEAD") {
      sendText(res, 405, "405 Method Not Allowed");
      return;
    }
    sendJson(res, 200, { ok: true, mode: MODE, model: MODEL_NAME });
    return;
  }

  if (pathname === "/api/chat") {
    if (req.method !== "POST") {
      sendText(res, 405, "405 Method Not Allowed");
      return;
    }
    handleChat(req, res);
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    sendText(res, 405, "405 Method Not Allowed");
    return;
  }

  serveStatic(req, res, pathname, parsed.search);
});

server.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    console.log("端口 " + PORT + " 已被占用，请设置 PORT 环境变量换一个端口后重试。");
  } else {
    console.log("服务启动失败：" + (err && err.message ? err.message : err));
  }
  process.exitCode = 1;
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("GeoLab 已启动: http://127.0.0.1:" + PORT);
  console.log("当前模式: " + MODE + " · 模型: " + MODEL_NAME);
  if (MODE === "openai" && !process.env.OPENAI_API_KEY) {
    console.log("提示: openai 模式缺少 OPENAI_API_KEY，/api/chat 会返回配置错误事件。");
  }
  if (MODE === "teleagent" && !readTeleagentKey()) {
    console.log("提示: teleagent 模式缺少会话密钥，/api/chat 会降级为离线演示；请用 start-server.ps1 启动。");
  }
});