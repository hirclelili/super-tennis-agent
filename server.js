import http from "node:http";
import https from "node:https";
import { access, constants, mkdir, readFile, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 5173);
const profilePath = path.join(__dirname, "data", "venue-profile.json");
const aiSettingsPath = path.join(__dirname, "data", "ai-settings.local.json");
const topicLibraryPath = path.join(__dirname, "data", "topic-library.json");
const finishedContentPath = path.join(__dirname, "data", "finished-content.json");
const weeklyPlanPath = path.join(__dirname, "data", "weekly-plan.json");
const angleFrameworkPath = path.join(__dirname, "data", "junior-topic-angle-framework.json");

const providerDefaults = {
  openai: {
    label: "OpenAI / GPT",
    model: "gpt-4.1-mini",
    baseUrl: "https://api.openai.com/v1",
  },
  deepseek: {
    label: "DeepSeek",
    model: "deepseek-chat",
    baseUrl: "https://api.deepseek.com",
  },
  gemini: {
    label: "Gemini",
    model: "gemini-1.5-flash",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
  },
  doubao: {
    label: "豆包 / 火山方舟",
    model: "",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
  },
};

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const stageLabels = {
  pre_opening: "开业前预热",
  trial: "试营业",
  open: "正式运营",
  daily: "日常经营",
};

const goalLabels = {
  daily: "日常运营",
  opening: "开业预热",
  booking: "场地预约",
  junior: "青训招生",
  adult_beginner: "成人零基础体验",
  community: "社群约球",
  event: "活动报名",
  trust: "信任建立",
};

const operatingModeLabels = {
  daily: "日常运营",
  opening: "开业期",
  campaign: "活动期",
  seasonal: "阶段性招生/拉新",
};

const audienceLabels = {
  parents: "少儿家长",
  teens: "青少年学员",
  adults: "成人新手",
  players: "附近球友",
  corporate: "企业团建客户",
};

const channelLabels = {
  xhs: "小红书",
  douyin: "抖音",
  video: "视频号",
  moments: "朋友圈",
  group: "微信群",
  dm: "私聊回复",
};

const formatLabels = {
  video: "短视频",
  xhs_image: "小红书图文",
  moments_text: "朋友圈文字",
  moments_image: "朋友圈图文",
  community: "社群运营",
};

const pillarDefinitions = {
  awareness: {
    label: "认知与场地",
    role: "让附近用户知道这里是谁、在哪里、能提供什么。",
    ratio: "20%",
  },
  beginner: {
    label: "新手入门",
    role: "降低第一次接触网球的心理门槛。",
    ratio: "20%",
  },
  junior: {
    label: "少儿与家长",
    role: "回答家长关心的问题，建立克制可信的专业感。",
    ratio: "15%",
  },
  community: {
    label: "社群与约球",
    role: "把公域兴趣转成私域关系和约球意向。",
    ratio: "20%",
  },
  conversion: {
    label: "预约与活动",
    role: "说清楚如何预约、如何参加活动、下一步怎么做。",
    ratio: "15%",
  },
  trust: {
    label: "信任与答疑",
    role: "用流程、边界和真实细节减少顾虑。",
    ratio: "10%",
  },
};

const topicBank = [
  {
    id: "venue_first_look",
    title: "开业前先看看这个网球场长什么样",
    goal: "opening",
    audiences: ["parents", "adults", "players"],
    platforms: ["xhs", "douyin", "video", "moments"],
    formats: ["video", "xhs_image", "moments_image"],
    purpose: "建立球场主体认知，让附近用户先收藏和关注开放信息",
    materials: ["门头/入口", "场地全景", "球网和场地线", "地址文字卡"],
    structure: ["球场亮相", "位置说明", "场地细节", "服务范围", "关注/咨询入口"],
    cta: "关注后续开放信息，私信咨询预约安排",
    risk: "开业前不写已有学员、满场训练、家长反馈或活动成果",
  },
  {
    id: "beginner_first_time",
    title: "零基础第一次打网球，需要准备什么",
    goal: "adult_beginner",
    audiences: ["adults", "parents"],
    platforms: ["xhs", "douyin", "video", "moments", "group"],
    formats: ["video", "xhs_image", "moments_text", "community"],
    purpose: "降低新手心理门槛，把咨询从“我不会”推进到“我可以先试试”",
    materials: ["球拍", "网球", "运动鞋", "场地空镜", "教练手部示范"],
    structure: ["常见顾虑", "准备清单", "第一次怎么开始", "适合人群", "咨询入口"],
    cta: "私信发送“新手”了解体验安排",
    risk: "不承诺学会时间和训练效果，不制造装备焦虑",
  },
  {
    id: "kids_parent_faq",
    title: "孩子几岁开始接触网球比较合适",
    goal: "junior",
    audiences: ["parents"],
    platforms: ["xhs", "video", "moments", "group"],
    formats: ["video", "xhs_image", "moments_text", "community"],
    purpose: "回答家长高频疑问，建立专业但克制的信任感",
    materials: ["儿童尺寸球拍/网球", "场地空镜", "教练示范动作", "图文要点卡"],
    structure: ["家长疑问", "不要一刀切", "看兴趣和身体状态", "可以先体验", "咨询入口"],
    cta: "私信孩子年龄，获取更适合的体验建议",
    risk: "不说黄金期、赢在起跑线、升学优势或必然效果",
  },
  {
    id: "weekend_social_tennis",
    title: "周末想运动，又不想一个人练",
    goal: "community",
    audiences: ["players", "adults"],
    platforms: ["xhs", "douyin", "moments", "group"],
    formats: ["video", "xhs_image", "moments_text", "community"],
    purpose: "把附近球友导入社群，形成约球和活动氛围",
    materials: ["场地空镜", "球拍球筐", "群活动文字卡", "非正脸击球氛围"],
    structure: ["周末场景", "一个人打球的痛点", "社群约球方式", "适合谁", "入群入口"],
    cta: "私信“约球”加入球友群",
    risk: "没有真实活动前，不编造热闹现场和固定人数",
  },
  {
    id: "booking_how_to",
    title: "想订场打球，先看这几个信息",
    goal: "booking",
    audiences: ["players", "adults", "parents"],
    platforms: ["xhs", "video", "moments", "group", "dm"],
    formats: ["xhs_image", "moments_text", "community"],
    purpose: "减少预约咨询成本，让用户知道该问什么、怎么预约",
    materials: ["场地照片", "营业/预约信息文字卡", "路线或入口图"],
    structure: ["谁适合订场", "需要确认的信息", "预约方式", "到场提醒", "咨询入口"],
    cta: "私信想来的日期和人数，协助确认场地安排",
    risk: "没有确认的营业时间、价格和空档不能写死",
  },
  {
    id: "coach_trust",
    title: "第一次来体验，教练会怎么带",
    goal: "trust",
    audiences: ["parents", "adults"],
    platforms: ["xhs", "douyin", "video", "moments"],
    formats: ["video", "xhs_image", "moments_text"],
    purpose: "用流程降低陌生感，让用户知道体验不是上来就高强度训练",
    materials: ["教练示范", "热身动作", "球拍握法", "场地细节"],
    structure: ["用户顾虑", "体验流程", "教练如何观察", "注意事项", "咨询入口"],
    cta: "私信“体验”了解适合自己的安排",
    risk: "不编造教练资质、成功案例、效果承诺",
  },
  {
    id: "after_work_tennis",
    title: "下班后打一小时网球，算是很轻的放松",
    goal: "adult_beginner",
    audiences: ["adults"],
    platforms: ["xhs", "douyin", "moments"],
    formats: ["video", "xhs_image", "moments_text"],
    purpose: "把网球包装成轻运动生活方式，吸引成人新手和白领",
    materials: ["傍晚场地", "球拍和球", "换鞋/热身细节", "场地灯光"],
    structure: ["下班场景", "运动负担低", "新手也能开始", "预约提示"],
    cta: "私信“下班”了解晚间体验/订场安排",
    risk: "不编造交通便利、固定晚间活动或价格",
  },
  {
    id: "rainy_day_plan",
    title: "下雨天还能不能打网球？先说清楚",
    goal: "trust",
    audiences: ["parents", "players", "adults"],
    platforms: ["xhs", "moments", "group", "dm"],
    formats: ["xhs_image", "moments_text", "community"],
    purpose: "提前回答天气和预约变更问题，减少临场沟通成本",
    materials: ["场地环境", "天气文字卡", "预约提醒图"],
    structure: ["常见问题", "以实际场地条件为准", "如何确认", "变更沟通方式"],
    cta: "出发前先私信确认当天场地安排",
    risk: "不了解室内外和退改规则时，不写绝对结论",
  },
];

const cadenceDefaults = {
  video: 2,
  xhsImage: 2,
  moments: 3,
};

const publishingSlots = {
  xhsImage: [
    { day: "周一", platform: "小红书", format: "图文" },
    { day: "周四", platform: "小红书", format: "图文" },
    { day: "周日", platform: "小红书", format: "图文" },
  ],
  video: [
    { day: "周二", platform: "抖音/视频号", format: "短视频" },
    { day: "周六", platform: "抖音/视频号", format: "短视频" },
    { day: "周四", platform: "视频号", format: "短视频" },
  ],
  moments: [
    { day: "周三", platform: "朋友圈", format: "文字/图文" },
    { day: "周五", platform: "朋友圈", format: "文字/图文" },
    { day: "周日", platform: "朋友圈", format: "文字" },
    { day: "周二", platform: "朋友圈", format: "文字" },
    { day: "周六", platform: "朋友圈", format: "随手记录" },
  ],
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  res.end(JSON.stringify(data, null, 2));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function loadProfile() {
  const raw = await readFile(profilePath, "utf8");
  return JSON.parse(raw);
}

async function saveProfile(profile) {
  await writeFile(profilePath, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
}

let angleFrameworkCache = null;
async function loadAngleFramework() {
  if (angleFrameworkCache) return angleFrameworkCache;
  try {
    const raw = await readFile(angleFrameworkPath, "utf8");
    angleFrameworkCache = JSON.parse(raw);
  } catch {
    angleFrameworkCache = { chains: [], modeCoverage: {}, contentRules: {} };
  }
  return angleFrameworkCache;
}

const DEFAULT_STAGE_POLICY = {
  label: "开业前预热",
  allowedContentTypes: ["explainer", "venue_env", "faculty_course", "behind_scene"],
  showcaseShare: 0.2,
};

// Resolve which content types (观点 + 真实展示) are available for the venue's
// current stage, plus the target share of 真实展示 in a batch. Falls back to a
// conservative pre-opening policy that hides any student-requiring 真实展示.
function resolveStagePolicy(profile = {}, framework = {}) {
  const stagePolicy = framework.stagePolicy || {};
  const contentTypes = framework.contentTypes || [];
  const stage = profile.stage || "pre_opening";
  const raw = stagePolicy[stage] || stagePolicy.pre_opening || DEFAULT_STAGE_POLICY;

  const byId = new Map(contentTypes.map((ct) => [ct.id, ct]));
  const allowedIds = (raw.allowedContentTypes || DEFAULT_STAGE_POLICY.allowedContentTypes)
    .filter((id) => byId.has(id) || id === "explainer");

  // Hard guard: never allow student-requiring types unless the stage explicitly lists them.
  const allowedContentTypes = allowedIds.filter((id) => {
    const ct = byId.get(id);
    return ct ? !ct.requiresStudents || allowedIds.includes(id) : true;
  });

  const availableShowcase = allowedContentTypes
    .map((id) => byId.get(id))
    .filter((ct) => ct && ct.kind === "showcase");

  const showcaseShare = typeof raw.showcaseShare === "number" ? raw.showcaseShare : DEFAULT_STAGE_POLICY.showcaseShare;

  return {
    stage,
    label: raw.label || stageLabels[stage] || stage,
    allowedContentTypes,
    availableShowcase,
    showcaseShare: availableShowcase.length ? showcaseShare : 0,
    note: raw.note || "",
  };
}

// 选题库题材分类（drill-in 浏览）。以 contentType 为主轴：观点讲解细分 3 类、
// 真实展示 5 类、活动 1 类。顺序即概览卡展示顺序。
const TOPIC_CATEGORY_GROUPS = {
  explainer: "观点讲解",
  showcase: "真实展示",
  campaign: "活动",
};

const TOPIC_CATEGORIES = [
  { id: "cat_why", label: "为什么学网球", group: "explainer" },
  { id: "cat_growth", label: "成长价值", group: "explainer" },
  { id: "cat_trust", label: "专业与行动", group: "explainer" },
  { id: "class_record", label: "真实课堂", group: "showcase" },
  { id: "student_growth", label: "学员成长", group: "showcase" },
  { id: "venue_env", label: "场地环境", group: "showcase" },
  { id: "faculty_course", label: "师资课程", group: "showcase" },
  { id: "behind_scene", label: "运营幕后", group: "showcase" },
  { id: "cat_campaign", label: "活动选题", group: "campaign" },
];

const SHOWCASE_CATEGORY_IDS = new Set([
  "class_record",
  "student_growth",
  "venue_env",
  "faculty_course",
  "behind_scene",
]);

// 关键词启发式：从自由想法文本推断内容形态（科普讲解 explainer 或某个真实展示类）。
const CONTENT_TYPE_KEYWORDS = [
  { id: "class_record", words: ["课堂", "上课", "训练记录", "教学记录", "教学实录", "一节课", "课程实录"] },
  { id: "student_growth", words: ["学员", "成长", "进步", "蜕变", "学会", "从零", "变化"] },
  { id: "venue_env", words: ["场地", "环境", "设施", "球场", "参观", "硬件", "灯光", "场馆"] },
  { id: "faculty_course", words: ["师资", "教练", "老师", "课程体系", "团队", "资质", "教龄"] },
  { id: "behind_scene", words: ["幕后", "筹备", "花絮", "日常", "准备", "记录一下", "vlog"] },
];

function inferContentTypeFromText(text) {
  const value = String(text || "");
  if (!value.trim()) return "explainer";
  for (const { id, words } of CONTENT_TYPE_KEYWORDS) {
    if (words.some((word) => value.includes(word))) return id;
  }
  return "explainer";
}

const TOPIC_CATEGORY_LABELS = new Map(TOPIC_CATEGORIES.map((cat) => [cat.id, cat.label]));

// 把一条入库选题归到某个叶子分类。优先级：活动 → 真实展示(contentType) →
// 观点讲解 3 小类（按 chainId/contentGoal）→ 兜底 cat_why（兼容无 contentType 旧条目）。
function resolveTopicCategory(entry = {}) {
  const contentType = String(entry.contentType || "").trim();
  const chainId = String(entry.chainId || "").trim();
  const contentGoal = String(entry.contentGoal || "").trim();
  // goal/pillar 作为英文语义兜底（部分历史条目 contentGoal 存的是 trust/junior 等英文）。
  const goal = String(entry.goal || entry.pillar || "").trim();

  const make = (id) => ({ id, label: TOPIC_CATEGORY_LABELS.get(id) || id, group: (TOPIC_CATEGORIES.find((c) => c.id === id) || {}).group || "explainer" });

  // 题材分类以 contentType 为主轴：真实展示类优先按 contentType 归类，
  // 即使是为某次活动拍的真实课堂/场地，也应归入对应的真实展示分类。
  if (SHOWCASE_CATEGORY_IDS.has(contentType)) {
    return make(contentType);
  }
  // 「活动选题」只保留给真正走活动路径(campaign_focus)的选题；
  // 不要因为本周 focus 含「招生/暑期」等字样就把普通科普选题误判为活动。
  if (chainId === "campaign_focus") {
    return make("cat_campaign");
  }
  if (["why_tennis", "vs_other_sports"].includes(chainId) || ["认知", "比较"].includes(contentGoal)) {
    return make("cat_why");
  }
  if (chainId === "growth_value" || contentGoal === "价值" || ["junior", "growth", "community"].includes(goal)) {
    return make("cat_growth");
  }
  if (["trust_pro", "next_step"].includes(chainId) || ["信任", "行动"].includes(contentGoal) || ["trust", "booking", "opening", "next_step", "action"].includes(goal)) {
    return make("cat_trust");
  }
  return make("cat_why");
}

const audienceLabelToId = {
  少儿家长: "parents",
  家长: "parents",
  青少年学员: "teens",
  青少年: "teens",
  少儿: "teens",
  成人新手: "adults",
  成人: "adults",
  附近球友: "players",
  球友: "players",
  企业团建客户: "corporate",
  企业: "corporate",
};

function resolveProfileAudiences(profile = {}) {
  const ids = new Set();
  for (const item of profile.audiences || []) {
    if (audienceLabels[item]) {
      ids.add(item);
      continue;
    }
    const text = String(item || "");
    if (audienceLabelToId[text]) {
      ids.add(audienceLabelToId[text]);
      continue;
    }
    for (const [label, id] of Object.entries(audienceLabelToId)) {
      if (text.includes(label)) {
        ids.add(id);
        break;
      }
    }
  }
  return Array.from(ids);
}

function isJuniorProfile(profile = {}) {
  if (profile.businessFocus === "junior_training") return true;
  const audiences = resolveProfileAudiences(profile);
  const onlyJunior = audiences.length > 0 && audiences.every((id) => id === "parents" || id === "teens");
  const positioning = String(profile.positioning || "");
  const positioningJunior = /青少年|少儿|儿童|青训/.test(positioning);
  return onlyJunior || positioningJunior;
}

function allowedAudiencesForProfile(profile = {}) {
  const resolved = resolveProfileAudiences(profile);
  if (isJuniorProfile(profile)) {
    const junior = resolved.filter((id) => id === "parents" || id === "teens");
    return junior.length ? junior : ["parents", "teens"];
  }
  return resolved.length ? resolved : Object.keys(audienceLabels);
}

function resolveGenerationMode(task = {}, brief = null) {
  if (task.generationMode && ["balanced", "focused", "hybrid"].includes(task.generationMode)) {
    return task.generationMode;
  }
  const hasFocus = Boolean(String(task.focus || "").trim() || String(task.eventInfo || "").trim() || brief);
  return hasFocus ? "focused" : "balanced";
}

function normalizeTitleKey(title = "") {
  return String(title).trim().toLowerCase().replace(/\s+/g, "");
}

function normalizeTopicSource(source = "seed") {
  if (source === "plan") return "plan-derived";
  if (["ai", "seed", "manual", "plan-derived", "reference"].includes(source)) return source;
  return "seed";
}

function toStoredTopicEntry(raw, profile = {}, task = {}) {
  const normalized = normalizeTopicRaw(raw, profile, task);
  const pillar = raw.pillar || topicPillar(normalized);
  return {
    id: normalized.id,
    title: normalized.title,
    purpose: normalized.purpose,
    goal: normalized.goal,
    audiences: normalized.audiences,
    platforms: normalized.platforms,
    formats: normalized.formats,
    materials: normalized.materials,
    structure: normalized.structure,
    cta: normalized.cta,
    risk: normalized.risk,
    pillar,
    contentGoal: String(raw.contentGoal || "").trim(),
    contentType: String(raw.contentType || "").trim(),
    chainId: String(raw.chainId || "").trim(),
    parentQuestion: String(raw.parentQuestion || "").trim(),
    reason: String(raw.reason || "").trim(),
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    source: normalizeTopicSource(raw.source),
    status: raw.status === "archived" ? "archived" : "active",
    referenceId: raw.referenceId ? String(raw.referenceId) : "",
    produceCount: Number.isFinite(Number(raw.produceCount)) ? Number(raw.produceCount) : 0,
    lastProducedAt: raw.lastProducedAt || "",
    createdAt: raw.createdAt || new Date().toISOString(),
    note: String(raw.note || "").trim(),
    usedInPlanSlots: Array.isArray(raw.usedInPlanSlots)
      ? raw.usedInPlanSlots
      : (Array.isArray(raw.planSlots) ? raw.planSlots : []),
  };
}

function defaultTopicLibrary() {
  // 选题库默认空：不再用 topicBank 播种内置档案。topicBank 仅作内部兜底
  // （计划槽 / 内容生成回退），不进库。
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    entries: [],
  };
}

async function loadTopicLibrary() {
  try {
    await access(topicLibraryPath, constants.F_OK);
    const raw = JSON.parse(await readFile(topicLibraryPath, "utf8"));
    if (!raw || !Array.isArray(raw.entries)) return saveTopicLibrary(defaultTopicLibrary());
    const allEntries = raw.entries.map((entry) => toStoredTopicEntry(entry));
    // 清掉历史遗留的内置种子条目（source=seed）。
    const entries = allEntries.filter((entry) => entry.source !== "seed");
    if (entries.length !== allEntries.length) {
      return saveTopicLibrary({ version: raw.version || 1, entries });
    }
    return {
      version: raw.version || 1,
      updatedAt: raw.updatedAt || new Date().toISOString(),
      entries,
    };
  } catch {
    return saveTopicLibrary(defaultTopicLibrary());
  }
}

async function saveTopicLibrary(library) {
  await mkdir(path.dirname(topicLibraryPath), { recursive: true });
  const payload = {
    version: library.version || 1,
    updatedAt: new Date().toISOString(),
    entries: (library.entries || []).map((entry) => toStoredTopicEntry(entry)),
  };
  await writeFile(topicLibraryPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return payload;
}

function mergeTopicsIntoLibrary(existingEntries = [], incomingTopics = [], profile = {}, task = {}) {
  const byId = new Map(existingEntries.map((entry) => [entry.id, entry]));
  const byTitle = new Map(existingEntries.map((entry) => [normalizeTitleKey(entry.title), entry]));

  for (const raw of incomingTopics) {
    const next = toStoredTopicEntry(raw, profile, task);
    const titleKey = normalizeTitleKey(next.title);
    const existing = byId.get(next.id) || byTitle.get(titleKey);
    if (existing) {
      const merged = {
        ...existing,
        ...next,
        id: existing.id,
        createdAt: existing.createdAt || next.createdAt,
        source: next.source === "ai" ? "ai" : (existing.source || next.source),
        note: next.note || existing.note || "",
        status: next.status === "archived" ? "archived" : (existing.status || next.status),
        produceCount: Math.max(Number(existing.produceCount) || 0, Number(next.produceCount) || 0),
        lastProducedAt: existing.lastProducedAt || next.lastProducedAt || "",
        referenceId: next.referenceId || existing.referenceId || "",
        usedInPlanSlots: next.usedInPlanSlots?.length
          ? next.usedInPlanSlots
          : (existing.usedInPlanSlots || []),
        tags: [...new Set([...(existing.tags || []), ...(next.tags || [])])],
      };
      byId.set(merged.id, merged);
      byTitle.set(normalizeTitleKey(merged.title), merged);
      continue;
    }
    byId.set(next.id, next);
    byTitle.set(titleKey, next);
  }

  return Array.from(byId.values());
}

async function updateTopicEntry(id, patch = {}, profile = {}, task = {}) {
  const library = await loadTopicLibrary();
  const entries = library.entries || [];
  const index = entries.findIndex((entry) => entry.id === id);
  if (index === -1) return null;

  const allowed = {};
  for (const field of ["title", "purpose", "cta", "risk", "note", "status", "pillar"]) {
    if (patch[field] !== undefined) allowed[field] = patch[field];
  }
  for (const field of ["materials", "structure", "tags", "platforms", "formats", "audiences"]) {
    if (Array.isArray(patch[field])) allowed[field] = patch[field];
  }

  const next = toStoredTopicEntry({ ...entries[index], ...allowed }, profile, task);
  entries[index] = next;
  await saveTopicLibrary({ ...library, entries });
  return next;
}

async function deleteTopicEntry(id) {
  const library = await loadTopicLibrary();
  const entries = (library.entries || []).filter((entry) => entry.id !== id);
  await saveTopicLibrary({ ...library, entries });
  return true;
}

async function bumpTopicProduceCount(id) {
  if (!id) return;
  const library = await loadTopicLibrary();
  const entries = library.entries || [];
  const index = entries.findIndex((entry) => entry.id === id);
  if (index === -1) return;
  entries[index] = {
    ...entries[index],
    produceCount: (Number(entries[index].produceCount) || 0) + 1,
    lastProducedAt: new Date().toISOString(),
  };
  await saveTopicLibrary({ ...library, entries });
}

function makeFinishedId(raw = {}) {
  if (raw.id) return String(raw.id);
  if (raw.topicId && raw.format) return `${raw.topicId}-${raw.format}`;
  // 缺 topicId/format 时不要塌缩成公共 id，用唯一兜底避免互相覆盖。
  return `finished-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeFinishedItem(raw = {}) {
  const now = new Date().toISOString();
  return {
    id: makeFinishedId(raw),
    topicId: raw.topicId || "",
    topicTitle: raw.topicTitle || raw.title || "",
    format: raw.format || "",
    contentType: raw.contentType || "",
    category: raw.category || "",
    material: raw.material || null,
    brief: raw.brief || null,
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || now,
  };
}

async function loadFinishedContent() {
  try {
    await access(finishedContentPath, constants.F_OK);
    const raw = JSON.parse(await readFile(finishedContentPath, "utf8"));
    if (!raw || !Array.isArray(raw.items)) return { version: 1, updatedAt: new Date().toISOString(), items: [] };
    return {
      version: raw.version || 1,
      updatedAt: raw.updatedAt || new Date().toISOString(),
      items: raw.items.map((item) => normalizeFinishedItem(item)),
    };
  } catch {
    return { version: 1, updatedAt: new Date().toISOString(), items: [] };
  }
}

async function saveFinishedContent(store) {
  await mkdir(path.dirname(finishedContentPath), { recursive: true });
  const payload = {
    version: store.version || 1,
    updatedAt: new Date().toISOString(),
    items: (store.items || []).map((item) => normalizeFinishedItem(item)),
  };
  await writeFile(finishedContentPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return payload;
}

async function upsertFinishedItem(raw = {}) {
  const store = await loadFinishedContent();
  const next = normalizeFinishedItem(raw);
  const items = store.items || [];
  const index = items.findIndex((item) => item.id === next.id);
  if (index === -1) {
    items.push(next);
  } else {
    const prev = items[index];
    items[index] = {
      ...prev,
      ...next,
      // 部分更新（未带 material/brief）不要把已存内容清成 null。
      material: next.material ?? prev.material,
      brief: next.brief ?? prev.brief,
      createdAt: prev.createdAt || next.createdAt,
      updatedAt: new Date().toISOString(),
    };
  }
  return saveFinishedContent({ ...store, items });
}

async function deleteFinishedItem(id) {
  const store = await loadFinishedContent();
  const items = (store.items || []).filter((item) => item.id !== id);
  await saveFinishedContent({ ...store, items });
  return true;
}

async function loadWeeklyPlan() {
  try {
    await access(weeklyPlanPath, constants.F_OK);
    const raw = JSON.parse(await readFile(weeklyPlanPath, "utf8"));
    if (!raw || !raw.plan) return { updatedAt: null, plan: null };
    return { updatedAt: raw.updatedAt || null, plan: raw.plan };
  } catch {
    return { updatedAt: null, plan: null };
  }
}

async function saveWeeklyPlan(plan) {
  await mkdir(path.dirname(weeklyPlanPath), { recursive: true });
  const payload = { updatedAt: new Date().toISOString(), plan: plan || null };
  await writeFile(weeklyPlanPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return payload;
}

function syncUsedInPlanSlots(entries = [], plan) {
  if (!plan) return entries;
  const schedule = getPlanSchedule(plan);
  if (!schedule.length) return entries;

  const slotsByTopicId = new Map();
  for (const slot of schedule) {
    const id = slot.topicId || makeTopicId("plan", slot.topicTitle);
    const slotInfo = {
      day: slot.day,
      platform: slot.platform,
      format: slot.format,
      theme: slot.theme,
    };
    if (!slotsByTopicId.has(id)) slotsByTopicId.set(id, []);
    slotsByTopicId.get(id).push(slotInfo);
  }

  return entries.map((entry) => {
    const slots = slotsByTopicId.get(entry.id) || [];
    return slots.length ? { ...entry, usedInPlanSlots: slots } : entry;
  });
}

function buildTopicLibrarySummary(profile, task = {}, topics = []) {
  const goal = inferPrimaryGoal(task);
  const mode = inferOperatingMode(profile, { ...task, goal });
  const planLinkedCount = topics.filter((topic) => (
    Array.isArray(topic.usedInPlanSlots) && topic.usedInPlanSlots.length
  )).length;

  return {
    mode: operatingModeLabels[mode] || mode,
    goal: goalLabels[goal] || goal,
    audience: audienceLabels[task.audience] || "多类人群",
    stage: stageLabels[profile.stage] || profile.stage,
    count: topics.length,
    planLinkedCount,
    suggestion: topics.length
      ? `选题库共 ${topics.length} 条可复用选题${planLinkedCount ? `，其中 ${planLinkedCount} 条与本周排期有关联` : ""}。可搜索筛选，或点击「扩充选题库」结合档案与计划补充新角度。`
      : "选题库为空。点击「扩充选题库」会根据球场档案和运营输入生成首批选题。",
  };
}

async function buildTopicLibraryView(profile, task = {}, options = {}) {
  let library = await loadTopicLibrary();
  let entries = library.entries || [];

  if (options.mergeTopics?.length) {
    entries = mergeTopicsIntoLibrary(entries, options.mergeTopics, profile, task);
    library = await saveTopicLibrary({ ...library, entries });
  }

  if (task.plan) {
    entries = syncUsedInPlanSlots(entries, task.plan);
  }

  const goal = inferPrimaryGoal(task);
  const mode = inferOperatingMode(profile, { ...task, goal });
  const pillars = buildPillars(profile, { ...task, goal, mode });
  const normalizedTask = { ...task, goal, mode, pillars: pillars.map((pillar) => pillar.id) };

  const topics = entries.map((entry) => {
    const raw = normalizeTopicRaw(entry, profile, normalizedTask);
    const score = scoreTopic(raw, normalizedTask);
    const decorated = decorateTopic(
      {
        ...raw,
        usedInPlanSlots: entry.usedInPlanSlots || [],
        note: entry.note || "",
        status: entry.status || "active",
        referenceId: entry.referenceId || "",
        produceCount: Number(entry.produceCount) || 0,
        lastProducedAt: entry.lastProducedAt || "",
        createdAt: entry.createdAt || "",
      },
      profile,
      normalizedTask,
      {
        score,
        source: normalizeTopicSource(entry.source),
        planSlots: entry.usedInPlanSlots || [],
      },
    );
    // normalizeTopicRaw 不透传题材字段，这里直接从入库条目补回并算分类。
    const category = resolveTopicCategory(entry);
    return {
      ...decorated,
      contentType: String(entry.contentType || "").trim(),
      chainId: String(entry.chainId || "").trim(),
      contentGoal: String(entry.contentGoal || "").trim(),
      category: category.id,
      categoryLabel: category.label,
      categoryGroup: category.group,
    };
  }).sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "zh-CN"));

  const summary = buildTopicLibrarySummary(profile, task, entries);
  if (options.summaryOverride?.suggestion) {
    summary.suggestion = options.summaryOverride.suggestion;
  }

  return {
    version: library.version,
    updatedAt: library.updatedAt,
    summary,
    pillars,
    categories: TOPIC_CATEGORIES.map((cat) => ({ ...cat, groupLabel: TOPIC_CATEGORY_GROUPS[cat.group] || cat.group })),
    groups: groupTopicsByPillar(topics, pillars),
    topics,
    aiMeta: options.aiMeta || null,
  };
}

function defaultAiSettings() {
  return {
    activeProvider: "openai",
    providers: Object.fromEntries(Object.entries(providerDefaults).map(([id, item]) => [id, {
      enabled: false,
      apiKey: "",
      model: item.model,
      baseUrl: item.baseUrl,
    }])),
  };
}

function normalizeAiSettings(settings = {}) {
  const base = defaultAiSettings();
  const providers = {};

  for (const [id, defaults] of Object.entries(base.providers)) {
    providers[id] = {
      ...defaults,
      ...(settings.providers?.[id] || {}),
      enabled: Boolean(settings.providers?.[id]?.enabled),
      apiKey: String(settings.providers?.[id]?.apiKey || ""),
      model: String(settings.providers?.[id]?.model || defaults.model),
      baseUrl: String(settings.providers?.[id]?.baseUrl || defaults.baseUrl),
    };
  }

  const activeProvider = providers[settings.activeProvider] ? settings.activeProvider : base.activeProvider;
  return { activeProvider, providers };
}

function maskKey(apiKey = "") {
  if (!apiKey) return "";
  if (apiKey.length <= 8) return "********";
  return `${apiKey.slice(0, 4)}****${apiKey.slice(-4)}`;
}

function publicAiSettings(settings) {
  return {
    activeProvider: settings.activeProvider,
    providers: Object.fromEntries(Object.entries(settings.providers).map(([id, config]) => [id, {
      label: providerDefaults[id].label,
      enabled: config.enabled,
      hasKey: Boolean(config.apiKey),
      maskedKey: maskKey(config.apiKey),
      model: config.model,
      baseUrl: config.baseUrl,
    }])),
  };
}

function resolveAiProvider(settings) {
  const activeId = settings.activeProvider;
  const activeConfig = settings.providers[activeId];
  if (activeConfig?.apiKey) {
    return { provider: activeId, config: activeConfig };
  }

  for (const [id, config] of Object.entries(settings.providers)) {
    if (config.enabled && config.apiKey) {
      return { provider: id, config };
    }
  }

  return null;
}

function buildLocalAiMeta(settings) {
  const activeId = settings.activeProvider;
  const activeLabel = providerDefaults[activeId]?.label || activeId;
  const activeConfig = settings.providers[activeId];

  if (!activeConfig?.apiKey) {
    return {
      source: "local",
      reason: `默认服务商 ${activeLabel} 还没有保存 API Key`,
    };
  }

  return {
    source: "local",
    reason: "未找到可用的 AI 配置",
  };
}

async function loadAiSettings() {
  try {
    const raw = await readFile(aiSettingsPath, "utf8");
    return normalizeAiSettings(JSON.parse(raw));
  } catch (error) {
    if (error.code === "ENOENT") return defaultAiSettings();
    throw error;
  }
}

async function saveAiSettings(incoming = {}) {
  const current = await loadAiSettings();
  const mergedProviders = {};

  for (const [id, defaults] of Object.entries(defaultAiSettings().providers)) {
    const currentConfig = current.providers[id] || defaults;
    const nextConfig = incoming.providers?.[id] || {};
    mergedProviders[id] = {
      ...currentConfig,
      enabled: Boolean(nextConfig.enabled),
      model: String(nextConfig.model || currentConfig.model || defaults.model),
      baseUrl: String(nextConfig.baseUrl || currentConfig.baseUrl || defaults.baseUrl),
      apiKey: String(nextConfig.apiKey || currentConfig.apiKey || ""),
    };
  }

  const activeProvider = incoming.activeProvider || current.activeProvider;
  if (mergedProviders[activeProvider]?.apiKey) {
    mergedProviders[activeProvider].enabled = true;
  }

  const settings = normalizeAiSettings({
    activeProvider,
    providers: mergedProviders,
  });

  await mkdir(path.dirname(aiSettingsPath), { recursive: true });
  await writeFile(aiSettingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  return settings;
}

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function extractJson(text) {
  const raw = String(text || "").trim();
  if (!raw) throw new Error("AI 返回为空");
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/```json\s*([\s\S]*?)```/) || raw.match(/```\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/);
    if (!match) throw new Error("AI 未返回 JSON");
    return JSON.parse(match[1]);
  }
}

async function fetchJson(url, options = {}) {
  const certErrorCodes = new Set([
    "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
    "SELF_SIGNED_CERT_IN_CHAIN",
    "DEPTH_ZERO_SELF_SIGNED_CERT",
  ]);
  try {
    return await requestJsonWithNodeHttps(url, options, { rejectUnauthorized: true });
  } catch (error) {
    if (certErrorCodes.has(error.code)) {
      return requestJsonWithNodeHttps(url, options, { rejectUnauthorized: false });
    }
    throw error;
  }
}

function requestJsonWithNodeHttps(url, options = {}, tlsOptions = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const body = options.body || "";
    const request = https.request({
      method: options.method || "GET",
      hostname: target.hostname,
      port: target.port || 443,
      path: `${target.pathname}${target.search}`,
      headers: {
        ...(options.headers || {}),
        ...(body ? { "content-length": Buffer.byteLength(body) } : {}),
      },
      timeout: 30000,
      rejectUnauthorized: tlsOptions.rejectUnauthorized,
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        try {
          const raw = Buffer.concat(chunks).toString("utf8");
          const data = raw ? JSON.parse(raw) : {};
          if (response.statusCode < 200 || response.statusCode >= 300) {
            const message = data.error?.message || data.message || `AI 接口错误 ${response.statusCode}`;
            reject(new Error(message));
            return;
          }
          resolve(data);
        } catch (error) {
          reject(error);
        }
      });
    });

    request.on("timeout", () => {
      request.destroy(new Error("AI 请求超时"));
    });
    request.on("error", reject);
    if (body) request.write(body);
    request.end();
  });
}

async function callOpenAiResponses(config, messages) {
  const data = await fetchJson(`${trimTrailingSlash(config.baseUrl)}/responses`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      input: messages,
      temperature: 0.4,
    }),
  });
  if (data.output_text) return data.output_text;
  return (data.output || [])
    .flatMap((item) => item.content || [])
    .map((item) => item.text || "")
    .join("\n")
    .trim();
}

async function callOpenAiCompatible(config, messages) {
  const data = await fetchJson(`${trimTrailingSlash(config.baseUrl)}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.4,
    }),
  });
  return data.choices?.[0]?.message?.content || "";
}

async function callGemini(config, messages) {
  const prompt = messages.map((message) => `${message.role.toUpperCase()}:\n${message.content}`).join("\n\n");
  const url = `${trimTrailingSlash(config.baseUrl)}/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`;
  const data = await fetchJson(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4 },
    }),
  });
  return (data.candidates?.[0]?.content?.parts || []).map((part) => part.text || "").join("\n").trim();
}

async function callAiText(provider, config, messages) {
  if (!config?.apiKey) throw new Error("请先填写 API Key");
  if (!config?.model) throw new Error("请先填写模型名称");
  if (provider === "openai") return callOpenAiResponses(config, messages);
  if (provider === "deepseek" || provider === "doubao") return callOpenAiCompatible(config, messages);
  if (provider === "gemini") return callGemini(config, messages);
  throw new Error("不支持的 AI 服务商");
}

async function testAiConnection(provider, config) {
  const text = await callAiText(provider, config, [
    { role: "system", content: "你是连接测试助手。只返回 JSON，不要解释。" },
    { role: "user", content: "请只返回 {\"ok\":true}" },
  ]);
  const data = extractJson(text);
  if (data.ok !== true) throw new Error("测试响应格式不正确");
  return { ok: true, message: "连接成功" };
}

function listText(items) {
  return Array.isArray(items) && items.length ? items.join("、") : "待补充";
}

function firstAvailable(value, fallback) {
  return String(value || "").trim() || fallback;
}

function inferPrimaryGoal(task = {}) {
  return task.goal || "daily";
}

function inferOperatingMode(profile = {}, task = {}) {
  if (task.mode) return task.mode;
  if (task.goal === "opening" || profile.stage === "pre_opening") return "opening";
  if (task.goal === "event") return "campaign";
  if (["junior", "adult_beginner"].includes(task.goal)) return "seasonal";
  return "daily";
}

function topicPillar(topic) {
  const map = {
    opening: "awareness",
    booking: "conversion",
    junior: "junior",
    adult_beginner: "beginner",
    community: "community",
    event: "conversion",
    trust: "trust",
  };
  return map[topic.goal] || "awareness";
}

function modePillarMix(mode) {
  if (mode === "opening") {
    return [
      ["awareness", "30%"],
      ["beginner", "15%"],
      ["junior", "15%"],
      ["community", "15%"],
      ["conversion", "15%"],
      ["trust", "10%"],
    ];
  }
  if (mode === "campaign") {
    return [
      ["conversion", "30%"],
      ["awareness", "15%"],
      ["beginner", "15%"],
      ["junior", "10%"],
      ["community", "20%"],
      ["trust", "10%"],
    ];
  }
  if (mode === "seasonal") {
    return [
      ["junior", "25%"],
      ["beginner", "25%"],
      ["trust", "15%"],
      ["awareness", "10%"],
      ["community", "15%"],
      ["conversion", "10%"],
    ];
  }
  return Object.entries(pillarDefinitions).map(([key, value]) => [key, value.ratio]);
}

function buildPillars(profile = {}, task = {}) {
  const mode = inferOperatingMode(profile, task);
  const goal = inferPrimaryGoal(task);
  const focus = String(task.focus || "").trim();
  const eventInfo = String(task.eventInfo || "").trim();
  const mix = modePillarMix(mode);
  const relevanceBoost = {
    opening: { awareness: 3, trust: 2, conversion: 2 },
    booking: { conversion: 3, trust: 2 },
    junior: { junior: 4, trust: 2 },
    adult_beginner: { beginner: 4, trust: 2 },
    community: { community: 4 },
    event: { conversion: 3, community: 2 },
    trust: { trust: 4 },
    daily: {},
  };
  const boost = { ...(relevanceBoost[goal] || {}) };
  if (task.audience === "parents") boost.junior = (boost.junior || 0) + 2;
  if (task.audience === "adults") boost.beginner = (boost.beginner || 0) + 2;
  if (task.audience === "players") boost.community = (boost.community || 0) + 2;

  const contextualLabels = {
    awareness: profile.stage === "pre_opening"
      ? (focus.includes("位置") || focus.includes("场地") ? "开业前·位置与场地" : "开业前·球场亮相")
      : pillarDefinitions.awareness.label,
    beginner: goal === "adult_beginner" ? "成人零基础入门" : pillarDefinitions.beginner.label,
    junior: goal === "junior" ? "少儿与家长决策" : pillarDefinitions.junior.label,
    community: goal === "community" ? "社群约球与互动" : pillarDefinitions.community.label,
    conversion: ["booking", "event"].includes(goal) ? "预约与活动转化" : pillarDefinitions.conversion.label,
    trust: pillarDefinitions.trust.label,
  };

  const scored = mix.map(([key, ratio]) => {
    const def = pillarDefinitions[key];
    let role = def.role;
    if (focus) role = `结合本周重点「${focus.slice(0, 36)}${focus.length > 36 ? "…" : ""}」：${def.role}`;
    else if (eventInfo) role = `结合活动/约束「${eventInfo.slice(0, 36)}${eventInfo.length > 36 ? "…" : ""}」：${def.role}`;

    return {
      id: key,
      label: contextualLabels[key] || def.label,
      role,
      ratio,
      weight: parseInt(ratio, 10) + (boost[key] || 0),
    };
  });

  const keepCount = mode === "daily" ? 5 : 4;
  const selected = scored.sort((a, b) => b.weight - a.weight).slice(0, keepCount);
  const totalWeight = selected.reduce((sum, item) => sum + parseInt(item.ratio, 10), 0);
  return selected.map(({ id, label, role, ratio }) => ({
    id,
    label,
    role,
    ratio: totalWeight
      ? `${Math.round((parseInt(ratio, 10) / totalWeight) * 100)}%`
      : ratio,
  }));
}

function slugifyPillarId(label) {
  return String(label || "pillar")
    .trim()
    .slice(0, 32)
    .replace(/[^\w\u4e00-\u9fff]+/g, "_")
    .replace(/^_+|_+$/g, "") || "pillar";
}

function normalizeStrategyPillars(rawPillars = []) {
  return rawPillars
    .map((item, index) => {
      const label = String(item.label || "").trim();
      if (!label) return null;
      const id = String(item.id || slugifyPillarId(label)).trim() || `pillar_${index + 1}`;
      const focus = String(item.focus || item.role || "").trim();
      return {
        id,
        label,
        role: focus,
        ratio: String(item.ratio || "").trim() || "—",
      };
    })
    .filter(Boolean);
}

function finalizePillarsFromSchedule(strategyPillars, schedule = []) {
  const normalized = normalizeStrategyPillars(strategyPillars);
  if (!schedule.length) return normalized;

  const counts = new Map();
  const labelById = new Map();
  for (const slot of schedule) {
    const id = slot.pillar || slugifyPillarId(slot.pillarLabel) || "unassigned";
    counts.set(id, (counts.get(id) || 0) + 1);
    if (slot.pillarLabel) labelById.set(id, slot.pillarLabel);
  }
  const total = schedule.length;
  const byId = new Map(normalized.map((item) => [item.id, item]));
  const result = [];

  for (const item of normalized) {
    const count = counts.get(item.id) || 0;
    result.push({
      ...item,
      ratio: count ? `${Math.round((count / total) * 100)}%` : item.ratio,
      slotCount: count,
    });
  }

  for (const [id, count] of counts) {
    if (byId.has(id)) continue;
    result.push({
      id,
      label: labelById.get(id) || id,
      role: "本周排期中实际使用的内容方向",
      ratio: `${Math.round((count / total) * 100)}%`,
      slotCount: count,
    });
  }

  return result
    .filter((item) => item.slotCount > 0)
    .sort((a, b) => (b.slotCount || 0) - (a.slotCount || 0));
}

function scoreTopic(topic, task = {}) {
  let score = 0;
  if (task.goal !== "daily" && topic.goal === task.goal) score += 5;
  if (topic.audiences.includes(task.audience)) score += 3;
  if (task.pillars?.includes(topicPillar(topic))) score += 2;
  for (const channel of task.channels || []) {
    if (topic.platforms.includes(channel)) score += 1;
  }
  for (const format of task.formats || []) {
    if (topic.formats.includes(format)) score += 1;
  }
  return score;
}

function enrichTopic(topic, profile, task = {}) {
  const platformText = topic.platforms.map((item) => channelLabels[item] || item).join(" / ");
  const formatText = topic.formats.map((item) => formatLabels[item] || item).join(" / ");
  const audienceText = topic.audiences.map((item) => audienceLabels[item] || item).join(" / ");
  return {
    ...topic,
    pillar: topicPillar(topic),
    pillarLabel: pillarDefinitions[topicPillar(topic)].label,
    platformText,
    formatText,
    audienceText,
    venueFit: `${profile.shortName || profile.name}当前阶段：${stageLabels[profile.stage] || profile.stage}。这个选题适合用来${topic.purpose}。`,
    suggestedCta: task.goal === "opening" ? "先关注/收藏，开放和预约信息后续同步" : topic.cta,
  };
}

const topicSourceLabels = {
  "plan-derived": "排期关联",
  plan: "排期关联",
  seed: "内置备选",
  ai: "AI 生成",
  manual: "手动添加",
  reference: "参考改写",
};

const topicFieldOptions = {
  goals: Object.keys(goalLabels),
  audiences: Object.keys(audienceLabels),
  platforms: Object.keys(channelLabels),
  formats: Object.keys(formatLabels),
};

function getPlanSchedule(plan) {
  if (!plan) return [];
  return plan.publishingSchedule || plan.week || [];
}

function makeTopicId(prefix, title) {
  const slug = String(title || "topic")
    .trim()
    .slice(0, 24)
    .replace(/[^\w\u4e00-\u9fff]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${prefix}_${slug || "topic"}_${Date.now().toString(36).slice(-4)}`;
}

function normalizeTopicRaw(raw, profile, task = {}) {
  const goal = topicFieldOptions.goals.includes(raw.goal) ? raw.goal : inferPrimaryGoal(task);
  const audiences = (raw.audiences || []).filter((item) => topicFieldOptions.audiences.includes(item));
  const platforms = (raw.platforms || []).filter((item) => topicFieldOptions.platforms.includes(item));
  const formats = (raw.formats || []).filter((item) => (
    topicFieldOptions.formats.includes(item) || item === "moments_image"
  ));

  return {
    id: String(raw.id || makeTopicId("ai", raw.title)).trim(),
    title: String(raw.title || "").trim() || "未命名选题",
    goal,
    audiences: audiences.length ? audiences : ["parents", "adults"],
    platforms: platforms.length ? platforms : ["xhs", "moments"],
    formats: formats.length ? formats : ["xhs_image"],
    purpose: String(raw.purpose || "").trim() || "面向目标用户传递球场相关信息",
    materials: Array.isArray(raw.materials) && raw.materials.length ? raw.materials.map(String) : ["场地空镜"],
    structure: Array.isArray(raw.structure) && raw.structure.length ? raw.structure.map(String) : ["问题切入点", "说明要点", "咨询入口"],
    cta: String(raw.cta || raw.suggestedCta || "").trim() || "私信咨询了解安排",
    risk: String(raw.risk || "").trim() || "未确认的信息不要写死",
    source: raw.source || "seed",
    planSlots: Array.isArray(raw.planSlots) ? raw.planSlots : (raw.planSlot ? [raw.planSlot] : []),
  };
}

function decorateTopic(topic, profile, task, extras = {}) {
  const source = extras.source || topic.source || "seed";
  return {
    ...enrichTopic(topic, profile, task),
    score: extras.score ?? topic.score ?? 0,
    source,
    sourceLabel: topicSourceLabels[source] || topicSourceLabels.seed,
    planSlots: extras.planSlots || topic.planSlots || [],
  };
}

function inferPlatformsFromLabel(platformLabel = "") {
  const label = String(platformLabel);
  if (label.includes("小红书")) return ["xhs"];
  if (label.includes("朋友圈")) return ["moments"];
  if (label.includes("抖音") || label.includes("视频号")) return ["douyin", "video"];
  if (label.includes("微信") || label.includes("社群")) return ["group"];
  return ["xhs", "moments"];
}

function inferFormatsFromLabel(platformLabel = "", formatLabel = "") {
  const platform = String(platformLabel);
  const format = String(formatLabel);
  if (platform.includes("小红书") || format.includes("图文")) return ["xhs_image"];
  if (platform.includes("抖音") || platform.includes("视频号") || format.includes("短视频")) return ["video"];
  if (platform.includes("朋友圈")) return ["moments_text", "moments_image"];
  if (platform.includes("社群") || platform.includes("微信群")) return ["community"];
  return ["xhs_image"];
}

function topicFromScheduleSlot(slot, profile, task = {}) {
  const seed = slot.topicId ? topicBank.find((topic) => topic.id === slot.topicId) : null;
  const base = seed ? { ...seed } : {};
  return normalizeTopicRaw({
    ...base,
    id: slot.topicId || makeTopicId("plan", slot.topicTitle),
    title: slot.topicTitle || base.title || "排期选题",
    goal: slot.goal || base.goal || inferPrimaryGoal(task),
    purpose: slot.topicAngle || slot.reason || base.purpose || "完成本周排期内容",
    materials: slot.materialNeed || base.materials || ["场地空镜"],
    structure: slot.structure || base.structure || ["开场", "说明要点", "行动引导"],
    cta: slot.action || base.cta,
    risk: slot.risk || base.risk || "未确认的信息不要写死",
    platforms: inferPlatformsFromLabel(slot.platform),
    formats: inferFormatsFromLabel(slot.platform, slot.format),
    source: "plan",
  }, profile, task);
}

function extractPlanLinkedTopics(profile, task, plan) {
  const schedule = getPlanSchedule(plan);
  if (!schedule.length) return [];

  const byId = new Map();
  for (const slot of schedule) {
    const slotInfo = {
      day: slot.day,
      platform: slot.platform,
      format: slot.format,
      theme: slot.theme,
    };
    const raw = topicFromScheduleSlot(slot, profile, task);
    if (byId.has(raw.id)) {
      byId.get(raw.id).planSlots.push(slotInfo);
      continue;
    }
    byId.set(raw.id, { ...raw, planSlots: [slotInfo] });
  }

  return Array.from(byId.values()).map((topic) => decorateTopic(topic, profile, task, {
    score: 100,
    source: "plan",
    planSlots: topic.planSlots,
  }));
}

function groupTopicsByPillar(topics, pillars) {
  return pillars.map((pillar) => ({
    ...pillar,
    topics: topics.filter((topic) => topic.pillar === pillar.id),
  })).filter((group) => group.topics.length);
}

// Topic directions are generated by the junior decision-chain pipeline
// (buildTopicDirectionsWithAi) and no longer derive from the built-in topicBank.

function agentTopicBriefMessages(profile, message, framework, priorBrief = null) {
  return [
    {
      role: "system",
      content: [
        "你是少儿网球机构的运营助理，负责把运营者的一段话解析成结构化的选题生成意图（generationBrief），不要写选题标题。",
        "判断本次是日常养号（balanced）、活动/节点聚焦（focused）、还是活动+认知兼顾（hybrid）。",
        "如果信息缺失（如活动天数、人数、适龄），用 clarifyQuestions 列出最多 3 个要追问家长运营者的问题。",
        priorBrief ? "已有 priorBrief（上一轮解析结果），请在它的基础上合并用户的新补充，不要丢失之前已确认的信息。" : "",
        "输出必须是严格 JSON，不要 Markdown，不要解释。",
      ].filter(Boolean).join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify({
        taskType: "agent_topic_brief",
        venueProfile: profileForPrompt(profile),
        contentRules: framework.contentRules || {},
        priorBrief: priorBrief || null,
        userMessage: String(message || ""),
        requiredShape: {
          generationMode: "balanced|focused|hybrid",
          generationBrief: {
            theme: "string",
            primaryGoal: "awareness|trust|event|conversion|daily",
            mustCover: ["string"],
            mustAvoid: ["string"],
            preferredPlatforms: ["xhs|douyin|video|moments|group|dm"],
            toneOverride: "string或null",
          },
          clarifyQuestions: ["string"],
          reply: "string，对运营者的一句话确认",
        },
        constraints: [
          "preferredPlatforms 只用 xhs、douyin、video、moments、group、dm。",
          "mustAvoid 至少并入 contentRules.forbiddenFraming 中相关项。",
          "纯养号/无明确活动时 generationMode=balanced 且 theme 可为空。",
        ],
        outputNote: "只返回 JSON。",
      }),
    },
  ];
}

function buildAgentBriefFallback(message) {
  const text = String(message || "");
  const isEvent = /活动|营|开业|体验课|报名|招生|节|赛/.test(text);
  return {
    generationMode: isEvent ? "focused" : "balanced",
    generationBrief: isEvent
      ? { theme: text.slice(0, 20), primaryGoal: "event", mustCover: [], mustAvoid: [], preferredPlatforms: [], toneOverride: null }
      : null,
    clarifyQuestions: isEvent ? ["活动时间和持续几天？", "限多少人 / 师生比？", "主要面向几岁的孩子？"] : [],
    reply: isEvent ? "已理解为活动聚焦方向，可补充活动细节后再生成。" : "已理解为日常认知方向，可直接生成选题。",
  };
}

async function buildAgentTopicBrief(profile, message, priorBrief = null) {
  const framework = await loadAngleFramework();
  const normalizedPrior = normalizeBrief(priorBrief);
  const settings = await loadAiSettings();
  const resolved = resolveAiProvider(settings);
  let result = buildAgentBriefFallback(message);
  let aiMeta = buildLocalAiMeta(settings);

  if (resolved) {
    const { provider, config } = resolved;
    const providerLabel = providerDefaults[provider]?.label || provider;
    try {
      const text = await callAiText(provider, config, agentTopicBriefMessages(profile, message, framework, normalizedPrior));
      const data = extractJson(text);
      if (!data || typeof data !== "object") throw new Error("AI 返回结构不完整");
      result = {
        generationMode: ["balanced", "focused", "hybrid"].includes(data.generationMode) ? data.generationMode : result.generationMode,
        generationBrief: normalizeBrief(data.generationBrief) || normalizedPrior,
        clarifyQuestions: Array.isArray(data.clarifyQuestions) ? data.clarifyQuestions.map(String).slice(0, 3) : [],
        reply: String(data.reply || "").trim() || result.reply,
      };
      aiMeta = { source: "ai", provider: providerLabel, model: config.model };
    } catch (error) {
      aiMeta = {
        source: "fallback",
        provider: providerLabel,
        model: config?.model || "",
        error: error.message || "AI 解析失败，已回退本地规则",
      };
    }
  }

  return { ...result, aiMeta };
}

function directionRefineMessages(profile, framework, direction, instruction) {
  return [
    {
      role: "system",
      content: [
        "你是少儿网球内容的选题改写顾问。运营者会给你一条已有选题方向和一句修改指令，请在保持「面向家长决策」的前提下改写这一条。",
        "只改写这一条，保持同样的 JSON 结构；遵守 contentRules 与 profile.avoid，不承诺效果/升学、不编造案例、不贴阶层标签。",
        "输出必须是严格 JSON，不要 Markdown，不要解释。",
      ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify({
        taskType: "direction_refine",
        venueProfile: profileForPrompt(profile),
        contentRules: framework.contentRules || {},
        instruction: String(instruction || ""),
        direction: {
          title: direction.title,
          parentQuestion: direction.parentQuestion || "",
          contentGoal: direction.contentGoal || "",
          contentType: direction.contentType || "explainer",
          chainId: direction.chainId || "",
          purpose: direction.purpose || "",
          goal: direction.goal || "junior",
          audiences: direction.audiences || ["parents"],
          platforms: direction.platforms || ["xhs"],
          formats: direction.formats || ["xhs_image"],
          structure: direction.structure || [],
          materials: direction.materials || [],
          cta: direction.cta || "",
          risk: direction.risk || "",
        },
        requiredShape: {
          direction: {
            title: "string",
            parentQuestion: "string",
            contentGoal: "string",
            contentType: "string，保持与原选题一致（explainer 或真实展示类 id）",
            chainId: "string",
            reason: "string",
            purpose: "string",
            goal: "opening|booking|junior|adult_beginner|community|event|trust|daily",
            audiences: ["parents"],
            platforms: ["xhs"],
            formats: ["xhs_image"],
            structure: ["string"],
            materials: ["string"],
            cta: "string",
            risk: "string",
          },
        },
        constraints: [
          "audiences 只用 parents、teens；platforms 只用 xhs、douyin、video、moments、group、dm；formats 只用 video、xhs_image、moments_text、moments_image、community。",
          "按 instruction 调整语气/钩子/结构，但仍要可拍可执行。",
        ],
        outputNote: "只返回 JSON：{ direction: {...} }。",
      }),
    },
  ];
}

async function buildDirectionRefine(profile, direction, instruction) {
  const framework = await loadAngleFramework();
  const settings = await loadAiSettings();
  const resolved = resolveAiProvider(settings);
  const goal = inferPrimaryGoal({ goal: direction.goal });
  const operatingMode = inferOperatingMode(profile, { goal });
  const pillars = buildPillars(profile, { goal, mode: operatingMode });
  const normalizedTask = { goal, mode: operatingMode, pillars: pillars.map((p) => p.id) };

  if (!resolved) {
    return { direction, aiMeta: buildLocalAiMeta(settings) };
  }
  const { provider, config } = resolved;
  const providerLabel = providerDefaults[provider]?.label || provider;
  try {
    const text = await callAiText(provider, config, directionRefineMessages(profile, framework, direction, instruction));
    const data = extractJson(text);
    const raw = data?.direction;
    if (!raw || !raw.title) throw new Error("AI 返回结构不完整");
    const [decorated] = decorateDirectionList([{ ...raw, contentType: raw.contentType || direction.contentType, id: direction.id }], profile, normalizedTask);
    return { direction: decorated, aiMeta: { source: "ai", provider: providerLabel, model: config.model } };
  } catch (error) {
    return {
      direction,
      aiMeta: { source: "fallback", provider: providerLabel, model: config?.model || "", error: error.message || "改写失败" },
    };
  }
}

function ideaTopicMessages(profile, idea, framework) {
  return [
    {
      role: "system",
      content: [
        "你是少儿网球内容的选题顾问。运营者会给你一句较口语的「内容想法」，请把它整理成一条可直接拍/写的完整选题。",
        "保持「面向家长决策」；遵守 contentRules 与 profile.avoid，不承诺效果/升学、不编造价格/师生比/案例、不贴阶层标签。",
        "根据想法判断 contentType：偏认知讲解/观点用 explainer；偏真实记录（课堂、学员成长、场地环境、师资课程、幕后日常）用对应的真实展示类 id。",
        "输出必须是严格 JSON，不要 Markdown，不要解释。",
      ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify({
        taskType: "idea_to_topic",
        venueProfile: profileForPrompt(profile),
        contentRules: framework.contentRules || {},
        showcaseTypes: (framework.contentTypes || []).map((ct) => ({ id: ct.id, label: ct.label })),
        idea: String(idea || ""),
        requiredShape: {
          topic: {
            title: "string，凝练的选题标题",
            parentQuestion: "string，家长真实会问的问题（口语）",
            contentGoal: "string",
            contentType: "explainer 或某个真实展示类 id",
            reason: "string，为什么值得做",
            purpose: "string",
            goal: "opening|booking|junior|adult_beginner|community|event|trust|daily",
            audiences: ["parents"],
            platforms: ["xhs"],
            formats: ["xhs_image"],
            structure: ["string，3-5 个拍摄/讲解要点"],
            materials: ["string，可拍素材"],
            cta: "string",
            risk: "string",
          },
        },
        constraints: [
          "audiences 只用 parents、teens；platforms 只用 xhs、douyin、video、moments、group、dm；formats 只用 video、xhs_image、moments_text、moments_image、community。",
          "要点 structure 要具体可执行，紧扣 idea 本意，不要泛泛而谈。",
        ],
        outputNote: "只返回 JSON：{ topic: {...} }。",
      }),
    },
  ];
}

function buildIdeaTopicFallback(profile, idea) {
  const text = String(idea || "").trim();
  const title = text.length > 24 ? `${text.slice(0, 24)}…` : (text || "未命名想法");
  const contentType = inferContentTypeFromText(text);
  const isShowcase = SHOWCASE_CATEGORY_IDS.has(contentType);
  return {
    id: makeTopicId("ai", title),
    title,
    parentQuestion: isShowcase ? "" : text,
    contentGoal: "",
    contentType,
    chainId: "",
    purpose: `围绕「${text}」面向家长传递球场相关信息。`,
    goal: "junior",
    audiences: ["parents"],
    platforms: ["xhs", "moments"],
    formats: ["video", "xhs_image", "moments_text"],
    structure: isShowcase
      ? ["真实场景关键画面", "细节呈现", "引导了解/到店"]
      : ["问题切入点", "说明要点", "可信细节", "咨询入口"],
    materials: ["场地真实画面"],
    cta: "私信咨询了解安排",
    risk: "未确认的信息不要写死",
  };
}

async function buildIdeaTopicWithAi(profile, idea) {
  const framework = await loadAngleFramework();
  const settings = await loadAiSettings();
  const resolved = resolveAiProvider(settings);
  const goal = inferPrimaryGoal({});
  const operatingMode = inferOperatingMode(profile, { goal });
  const pillars = buildPillars(profile, { goal, mode: operatingMode });
  const normalizedTask = { goal, mode: operatingMode, pillars: pillars.map((p) => p.id) };

  if (!resolved) {
    const [decorated] = decorateDirectionList([buildIdeaTopicFallback(profile, idea)], profile, normalizedTask);
    return { topic: decorated, aiMeta: buildLocalAiMeta(settings) };
  }
  const { provider, config } = resolved;
  const providerLabel = providerDefaults[provider]?.label || provider;
  try {
    const text = await callAiText(provider, config, ideaTopicMessages(profile, idea, framework));
    const data = extractJson(text);
    const raw = data?.topic;
    if (!raw || !raw.title) throw new Error("AI 返回结构不完整");
    const [decorated] = decorateDirectionList([{ ...raw, contentType: raw.contentType || inferContentTypeFromText(idea) }], profile, normalizedTask);
    return { topic: decorated, aiMeta: { source: "ai", provider: providerLabel, model: config.model } };
  } catch (error) {
    const [decorated] = decorateDirectionList([buildIdeaTopicFallback(profile, idea)], profile, normalizedTask);
    return {
      topic: decorated,
      aiMeta: { source: "fallback", provider: providerLabel, model: config?.model || "", error: error.message || "整理失败，已回退本地规则" },
    };
  }
}

function agentRouteMessages(profile, message, framework, context = {}) {
  return [
    {
      role: "system",
      content: [
        "你是少儿网球机构的「全局运营助手」，要把运营者的一句话分流到正确的能力，并在需要时直接给经营建议。",
        "可用能力（intent）：",
        "- plan：想要一周内容计划 / 排期 / 发布节奏。",
        "- topic：想要选题方向 / 拍什么 / 内容角度。",
        "- content：想把某条选题做成具体的小红书图文或短视频脚本（注意：这一步只是入口，真正生产在内容模块里）。",
        "- chat：其他经营咨询或闲聊，不触发上面三个生成流程。",
        "判定 chat 时再细分 chatKind：",
        "- advice：与这家球场经营相关（招生、定价思路、活动点子、同城竞争、家长沟通、续费留存、运营节奏等）。这时你要以「懂这家球场的运营顾问」身份，结合 venueProfile 给具体、可落地的建议；如果建议天然能接回某个能力，就在 suggestedAction 里给出（如帮忙排一周计划或出几条选题）。",
        "- offtopic：与球场经营无关（写代码、查天气、通用闲聊等）。一句话礼貌收边，并把话题拉回经营，不要展开。",
        "硬约束：遵守 contentRules.forbiddenFraming 与 profile.avoid——不承诺提分/升学/效果，不贴阶层标签，不编造价格、开放时间、师生比、学员案例；涉及这些不确定信息时，说「这取决于你们实际安排」而不是替运营者编造。",
        "当 intent 是 plan 或 topic 时，顺便把这句话解析成 generationBrief 和 generationMode（balanced=日常养号 / focused=活动聚焦 / hybrid=活动+认知兼顾）；信息不足时用 clarify 列最多 3 个追问。",
        "reply 始终必填：chat 时是你的正式回答，其他 intent 时是一句过渡确认语。",
        "输出必须是严格 JSON，不要 Markdown，不要解释。",
      ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify({
        taskType: "agent_route",
        venueProfile: profileForPrompt(profile),
        contentRules: framework.contentRules || {},
        context: {
          currentResultType: context.currentResultType || null,
        },
        userMessage: String(message || ""),
        requiredShape: {
          intent: "plan|topic|content|chat",
          chatKind: "advice|offtopic（仅 intent=chat 时有效，否则留空）",
          generationMode: "balanced|focused|hybrid（plan/topic 时）",
          generationBrief: {
            theme: "string",
            primaryGoal: "awareness|trust|event|conversion|daily",
            mustCover: ["string"],
            mustAvoid: ["string"],
            preferredPlatforms: ["xhs|douyin|video|moments|group|dm"],
            toneOverride: "string或null",
          },
          clarify: ["string，最多3条"],
          reply: "string",
          suggestedAction: { type: "plan|topic|content", label: "string" },
        },
        constraints: [
          "preferredPlatforms 只用 xhs、douyin、video、moments、group、dm。",
          "纯养号/无明确活动时 generationMode=balanced 且 theme 可为空。",
          "intent=chat 时 generationBrief 用 null；intent!=chat 时 chatKind 留空、suggestedAction 用 null。",
          "advice 类回答要落到这家球场的实际定位与人群，不要泛泛而谈。",
        ],
        outputNote: "只返回 JSON。",
      }),
    },
  ];
}

function buildAgentRouteFallback(message) {
  const text = String(message || "");
  const planHit = /计划|排期|一周|周计划|发什么|怎么发|节奏|日程/.test(text);
  const topicHit = /选题|方向|题目|拍什么|内容角度|出几条|做几条/.test(text);
  const contentHit = /脚本|帖子|做成|生产内容|图文|短视频/.test(text) && /做成|生成|帮我写|脚本/.test(text);
  const isEvent = /活动|营|开业|体验课|报名|招生|节|赛/.test(text);
  if (planHit) {
    return {
      intent: "plan",
      chatKind: "",
      generationMode: isEvent ? "focused" : "balanced",
      generationBrief: isEvent ? { theme: text.slice(0, 20), primaryGoal: "event", mustCover: [], mustAvoid: [], preferredPlatforms: [], toneOverride: null } : null,
      clarify: [],
      reply: "好的，这就按这个思路帮你排一周计划。",
      suggestedAction: null,
    };
  }
  if (topicHit) {
    return {
      intent: "topic",
      chatKind: "",
      generationMode: isEvent ? "focused" : "balanced",
      generationBrief: isEvent ? { theme: text.slice(0, 20), primaryGoal: "event", mustCover: [], mustAvoid: [], preferredPlatforms: [], toneOverride: null } : null,
      clarify: [],
      reply: "好的，这就帮你生成选题方向。",
      suggestedAction: null,
    };
  }
  if (contentHit) {
    return {
      intent: "content",
      chatKind: "",
      generationMode: "balanced",
      generationBrief: null,
      clarify: [],
      reply: "可以，先选好要落地的选题，我带你进内容生产。",
      suggestedAction: null,
    };
  }
  return {
    intent: "chat",
    chatKind: "advice",
    generationMode: "balanced",
    generationBrief: null,
    clarify: [],
    reply: "我可以帮你排一周计划、生成选题方向，也能聊聊招生、活动、家长沟通这些经营问题。你想先从哪块开始？",
    suggestedAction: null,
  };
}

async function buildAgentRoute(profile, message, context = {}) {
  const framework = await loadAngleFramework();
  const settings = await loadAiSettings();
  const resolved = resolveAiProvider(settings);
  let result = buildAgentRouteFallback(message);
  let aiMeta = buildLocalAiMeta(settings);

  if (resolved) {
    const { provider, config } = resolved;
    const providerLabel = providerDefaults[provider]?.label || provider;
    try {
      const text = await callAiText(provider, config, agentRouteMessages(profile, message, framework, context));
      const data = extractJson(text);
      if (!data || typeof data !== "object") throw new Error("AI 返回结构不完整");
      const intent = ["plan", "topic", "content", "chat"].includes(data.intent) ? data.intent : result.intent;
      const isChat = intent === "chat";
      const suggested = data.suggestedAction && ["plan", "topic", "content"].includes(data.suggestedAction.type)
        ? { type: data.suggestedAction.type, label: String(data.suggestedAction.label || "").trim() || "去生成" }
        : null;
      result = {
        intent,
        chatKind: isChat ? (["advice", "offtopic"].includes(data.chatKind) ? data.chatKind : "advice") : "",
        generationMode: ["balanced", "focused", "hybrid"].includes(data.generationMode) ? data.generationMode : result.generationMode,
        generationBrief: isChat ? null : normalizeBrief(data.generationBrief),
        clarify: Array.isArray(data.clarify) ? data.clarify.map(String).slice(0, 3) : [],
        reply: String(data.reply || "").trim() || result.reply,
        suggestedAction: isChat ? suggested : null,
      };
      aiMeta = { source: "ai", provider: providerLabel, model: config.model };
    } catch (error) {
      aiMeta = {
        source: "fallback",
        provider: providerLabel,
        model: config?.model || "",
        error: error.message || "AI 路由失败，已回退本地规则",
      };
    }
  }

  return { ...result, aiMeta };
}

function planSlotRefineMessages(profile, framework, slot, instruction) {
  return [
    {
      role: "system",
      content: [
        "你是网球场内容排期顾问。运营者会给你一周计划里的某一条排期（slot）和一句修改指令，请只改写这一条。",
        "保持同样的 JSON 字段结构；可以调整 platform、format、theme、topicTitle、topicAngle、whyPlatform、materialNeed、action 等，但 day 不要改。",
        "遵守 contentRules 与 profile.avoid：不承诺效果/升学、不编造价格与案例。",
        "输出必须是严格 JSON，不要 Markdown，不要解释。",
      ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify({
        taskType: "plan_slot_refine",
        venueProfile: profileForPrompt(profile),
        contentRules: framework.contentRules || {},
        instruction: String(instruction || ""),
        slot,
        platformOptions: ["小红书", "抖音/视频号", "朋友圈", "微信社群"],
        formatOptions: ["video", "xhs_image", "moments_text", "moments_image", "community"],
        requiredShape: { slot: { ...slot } },
        outputNote: "只返回 JSON：{ slot: {...} }，字段与输入 slot 一致。",
      }),
    },
  ];
}

async function buildPlanSlotRefine(profile, plan, slotIndex, instruction) {
  const schedule = Array.isArray(plan?.publishingSchedule) ? plan.publishingSchedule : [];
  const index = Number(slotIndex);
  const slot = schedule[index];
  if (!slot) {
    return { slot: null, slotIndex: index, aiMeta: { source: "fallback", error: "找不到对应排期" } };
  }
  const framework = await loadAngleFramework();
  const settings = await loadAiSettings();
  const resolved = resolveAiProvider(settings);
  if (!resolved) {
    return { slot, slotIndex: index, aiMeta: buildLocalAiMeta(settings) };
  }
  const { provider, config } = resolved;
  const providerLabel = providerDefaults[provider]?.label || provider;
  try {
    const text = await callAiText(provider, config, planSlotRefineMessages(profile, framework, slot, instruction));
    const data = extractJson(text);
    const raw = data?.slot;
    if (!raw || typeof raw !== "object") throw new Error("AI 返回结构不完整");
    const normalized = normalizeScheduleItem({ ...slot, ...raw, day: slot.day }, profile, {});
    return { slot: normalized, slotIndex: index, aiMeta: { source: "ai", provider: providerLabel, model: config.model } };
  } catch (error) {
    return {
      slot,
      slotIndex: index,
      aiMeta: { source: "fallback", provider: providerLabel, model: config?.model || "", error: error.message || "改写失败" },
    };
  }
}

function normalizeBrief(brief) {
  if (!brief || typeof brief !== "object") return null;
  const arr = (value) => (Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : []);
  const theme = String(brief.theme || "").trim();
  const mustCover = arr(brief.mustCover);
  if (!theme && !mustCover.length && !String(brief.primaryGoal || "").trim()) return null;
  return {
    theme,
    primaryGoal: String(brief.primaryGoal || "").trim(),
    mustCover,
    mustAvoid: arr(brief.mustAvoid),
    preferredPlatforms: arr(brief.preferredPlatforms).filter((id) => topicFieldOptions.platforms.includes(id)),
    toneOverride: String(brief.toneOverride || "").trim() || null,
  };
}

function profileForPrompt(profile) {
  return {
    name: profile.name,
    shortName: profile.shortName,
    city: profile.city,
    location: profile.location,
    stage: stageLabels[profile.stage] || profile.stage,
    businessFocus: profile.businessFocus || "",
    childAgeRange: profile.childAgeRange || "",
    positioning: profile.positioning,
    services: profile.services,
    audiences: profile.audiences,
    tone: profile.tone,
    booking: profile.booking,
    wechat: profile.wechat,
    avoid: profile.avoid,
  };
}

function planSummaryForPrompt(plan) {
  if (!plan) return null;
  return {
    title: plan.overview?.title,
    focus: plan.overview?.focus,
    strategySummary: plan.overview?.strategySummary || plan.strategy?.strategySummary,
    pillars: (plan.pillars || []).map((item) => item.label),
  };
}

function showcaseLabelsFor(stagePolicy) {
  return (stagePolicy?.availableShowcase || []).map((ct) => ct.label);
}

function juniorInsightMessages(profile, task, framework, mode, brief, allowedAudienceIds, stagePolicy = DEFAULT_STAGE_POLICY) {
  const allowedLabels = allowedAudienceIds.map((id) => audienceLabels[id] || id);
  const showcaseLabels = showcaseLabelsFor(stagePolicy);
  return [
    {
      role: "system",
      content: [
        "你是少儿网球培训机构的内容策略顾问（Insight 角色）。",
        "使用者是孩子，但内容的决策者是家长（尤其妈妈）。你的任务是先想清楚「本次该影响哪些家长、解决他们的什么决策问题」，不要直接写选题标题。",
        "严格基于球场档案与运营输入推理，不要引用任何外部题库或通用模板。",
        "不得编造价格、开放时间、学员案例、爆满现场、升学或效果承诺。",
        "输出必须是严格 JSON，不要 Markdown，不要解释。",
      ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify({
        taskType: "junior_topic_insight",
        venueProfile: profileForPrompt(profile),
        weeklyInput: {
          mode: operatingModeLabels[task.mode] || task.mode || "日常运营",
          goal: goalLabels[task.goal] || task.goal || "日常运营",
          focus: task.focus || "",
          eventInfo: task.eventInfo || "",
        },
        generationMode: mode,
        generationBrief: brief,
        weeklyPlan: planSummaryForPrompt(task.plan),
        contentRules: framework.contentRules || {},
        allowedAudiences: allowedLabels,
        stageContext: {
          stage: stagePolicy?.label || stageLabels[profile.stage] || profile.stage,
          availableShowcase: showcaseLabels,
          showcaseShare: stagePolicy?.showcaseShare || 0,
          note: stagePolicy?.note || "",
        },
        requiredShape: {
          primaryDecisionMaker: "parents",
          childProfile: "string",
          topQuestions: ["string（家长口语，3-6 条）"],
          parentSegments: [{ label: "string", concern: "string" }],
          shootableAssets: ["string"],
          weeklyFocus: "string",
          generationMode: mode,
          campaignTheme: "string，focused/hybrid 时必填，balanced 留空",
          mustCover: ["string"],
          mustAvoid: ["string"],
        },
        constraints: [
          `本场服务对象与决策者：${allowedLabels.join("、")}。请紧扣 venueProfile 的 positioning 与 services，所有 topQuestions 都从「孩子学网球 + 家长决策」出发，不需要也不要去列举本场不服务的人群。`,
          mode === "balanced"
            ? "balanced 模式：topQuestions 覆盖认知、价值、信任、行动等多类决策问题，campaignTheme 留空。"
            : "focused/hybrid 模式：以 generationBrief / focus / eventInfo 为主线，campaignTheme 必填，mustCover 收敛到本次活动要回答的家长问题。",
          showcaseLabels.length
            ? `本阶段可做的「真实展示」素材：${showcaseLabels.join("、")}。shootableAssets 要贴合这些真实可拍的素材；开业前不要列还不存在的学员/课堂画面。`
            : "本阶段尚无学员，shootableAssets 只列 场地/器材/教练 等真实可拍素材，不要写学员或课堂画面。",
          "mustAvoid 只聚合「合规边界」：把 generationBrief.mustAvoid、profile.avoid、contentRules.forbiddenFraming 汇总进来，不要自己发明人群禁忌。",
        ],
        outputNote: "只返回 JSON。",
      }),
    },
  ];
}

function buildInsightFallback(profile, task, framework, mode, brief, allowedAudienceIds, stagePolicy = DEFAULT_STAGE_POLICY) {
  const allowedLabels = allowedAudienceIds.map((id) => audienceLabels[id] || id);
  const chains = framework.chains || [];
  const topQuestions = chains
    .filter((chain) => chain.id !== "campaign_focus")
    .map((chain) => chain.parentQuestion)
    .filter(Boolean);
  const forbidden = (framework.contentRules?.forbiddenFraming || []).slice(0, 6);
  const baseAssets = ["儿童尺寸球拍/网球", "教练示范动作", "场地空镜"];
  const showcaseIds = (stagePolicy?.availableShowcase || []).map((ct) => ct.id);
  const stageAssets = [
    ...baseAssets,
    ...(showcaseIds.includes("class_record") ? ["真实课堂训练片段（需授权）"] : []),
    ...(showcaseIds.includes("student_growth") ? ["学员真实变化记录（需授权）"] : []),
  ];
  return {
    primaryDecisionMaker: "parents",
    childProfile: profile.childAgeRange ? `${profile.childAgeRange}岁少儿为主` : "少儿启蒙为主",
    topQuestions: topQuestions.length ? topQuestions : ["为什么让孩子学网球", "几岁开始合适", "教练怎么带第一次体验"],
    parentSegments: [
      { label: "观望型", concern: "不确定孩子适不适合、值不值得投入" },
      { label: "比较型", concern: "在网球和其他运动之间犹豫" },
    ],
    shootableAssets: stageAssets,
    weeklyFocus: brief?.theme || task.focus || (mode === "balanced" ? "建立家长对少儿网球的认知与信任" : "本次重点方向"),
    generationMode: mode,
    campaignTheme: mode === "balanced" ? "" : (brief?.theme || task.focus || task.eventInfo || "本次活动"),
    mustCover: brief?.mustCover || [],
    mustAvoid: [...new Set([...(brief?.mustAvoid || []), ...forbidden, ...(profile.avoid || [])])],
    allowedAudiences: allowedLabels,
  };
}

function angleMessages(profile, task, insight, framework, mode, brief, excludeTitles, stagePolicy = DEFAULT_STAGE_POLICY) {
  const coverage = framework.modeCoverage?.[mode] || {};
  const chainBrief = (framework.chains || []).map((chain) => ({
    id: chain.id,
    label: chain.label,
    contentGoal: chain.contentGoal,
    parentQuestion: chain.parentQuestion,
    dimensions: chain.dimensions,
    dynamic: Boolean(chain.dynamic),
  }));
  const showcaseBrief = (stagePolicy?.availableShowcase || []).map((ct) => ({
    id: ct.id,
    label: ct.label,
    contentGoals: ct.primaryGoals,
    dimensions: ct.dimensions,
    structureTemplate: ct.structureTemplate,
    compliance: ct.compliance,
  }));
  return [
    {
      role: "system",
      content: [
        "你是少儿网球内容的角度策划（Angles 角色）。",
        "你会拿到家长洞察（insight）、观点决策链（chains）和本阶段可用的真实展示类（showcaseTypes）。请把洞察展开成具体的内容角度。",
        "每条角度都要标 contentType：observer 的 explainer（观点讲解，来自 chains）或某个真实展示类 id（拍真实画面）。",
        "chains[].dimensions / showcaseTypes[].dimensions 只是思考切面示例，禁止逐条照抄当标题；必须结合本场档案与 insight 做本地化。",
        "真实展示类的 structure 要写成「拍什么真实画面」（开场镜头→真实片段/细节→边界→入口），不要写成讲解稿；并遵守该类的 compliance。",
        "精英教育/名人/运动员升学等可作为「现象+可讨论」角度，但必须遵守 contentRules，不贴阶层标签、不承诺效果或升学。",
        "输出必须是严格 JSON，不要 Markdown，不要解释。",
      ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify({
        taskType: "junior_topic_angles",
        venueProfile: profileForPrompt(profile),
        insight,
        generationMode: mode,
        generationBrief: brief,
        chains: chainBrief,
        showcaseTypes: showcaseBrief,
        contentRules: framework.contentRules || {},
        excludeTitles: (excludeTitles || []).slice(0, 40),
        requiredShape: {
          angles: [{
            contentType: "explainer 或某个 showcaseTypes[].id",
            chainId: "explainer 时来自 chains[].id；真实展示时填该 showcaseType 的 id",
            contentGoal: "认知|比较|价值|信任|行动|活动",
            parentQuestion: "string家长口语",
            hookPattern: "string开头怎么钩家长",
            structure: ["string信息顺序，3-5 步"],
            proofType: "string靠什么建立可信，不编造",
            platforms: ["xhs"],
            formats: ["video"],
            risk: "string这条最容易写过头的边界",
          }],
        },
        constraints: [
          "输出 6-10 条 angles。",
          coverageConstraintText(mode, coverage),
          showcaseConstraintText(mode, stagePolicy),
          "platforms 只用 xhs、douyin、video、moments、group、dm；formats 只用 video、xhs_image、moments_text、moments_image、community。",
          "每条必须先有 parentQuestion 再有 structure，且不得与 excludeTitles 近义重复。",
          brief?.mustCover?.length ? `campaign_focus angles 必须覆盖：${brief.mustCover.join("、")}。` : "无活动 brief 时不要硬造 campaign_focus。",
        ].filter(Boolean),
        outputNote: "只返回 JSON。",
      }),
    },
  ];
}

function showcaseConstraintText(mode, stagePolicy) {
  const labels = (stagePolicy?.availableShowcase || []).map((ct) => `${ct.label}(${ct.id})`);
  if (!labels.length) {
    return "本阶段没有可用的真实展示素材（无学员/筹备期），所有 angles 用 contentType=explainer 的观点角度。";
  }
  if (mode === "balanced") {
    const pct = Math.round((stagePolicy.showcaseShare || 0) * 100);
    return `内容类型配比：约 ${pct}% 的 angles 用真实展示类（可选：${labels.join("、")}），其余用 explainer 观点类。只能用列出的真实展示类，其它（如本阶段未解锁的真实课堂/学员成长）禁止使用。`;
  }
  return `内容类型：以活动(campaign_focus, explainer)为主；若有现成真实素材可少量穿插真实展示类（${labels.join("、")}）。未列出的真实展示类禁止使用。`;
}

function coverageConstraintText(mode, coverage) {
  if (mode === "balanced") {
    return `balanced 模式：至少覆盖 ${coverage.minChains || 4} 个不同 chainId，必须包含 ${(coverage.required || ["trust_pro", "next_step"]).join("、")}，不要出现 campaign_focus。`;
  }
  if (mode === "hybrid") {
    return `hybrid 模式：campaign_focus 给 ${(coverage.campaignCount || [3, 4]).join("-")} 条，并且 ${(coverage.evergreenRequired || ["why_tennis", "growth_value"]).join("、")} 各至少 1 条，同时保留 trust_pro 与 next_step。`;
  }
  return `focused 模式：campaign_focus 占比 ${(coverage.campaignShareMin || 0.5) * 100}%-${(coverage.campaignShareMax || 0.7) * 100}%，其余链各 0-1 条，但必须保留 ${(coverage.required || ["trust_pro", "next_step"]).join("、")} 各 1 条。`;
}

function buildAnglesFallback(profile, task, insight, framework, mode, allowedAudienceIds, stagePolicy = DEFAULT_STAGE_POLICY) {
  const chains = framework.chains || [];
  const evergreen = chains.filter((chain) => chain.id !== "campaign_focus");
  const campaign = chains.find((chain) => chain.id === "campaign_focus");
  const platformByGoal = { xhs: ["xhs"], douyin: ["douyin", "video"] };
  const pickChains = [];

  if (mode === "balanced") {
    pickChains.push(...evergreen);
  } else {
    const campaignCount = mode === "hybrid" ? 3 : 4;
    if (campaign) for (let i = 0; i < campaignCount; i += 1) pickChains.push(campaign);
    pickChains.push(
      evergreen.find((chain) => chain.id === "trust_pro"),
      evergreen.find((chain) => chain.id === "next_step"),
    );
    if (mode === "hybrid") {
      pickChains.push(
        evergreen.find((chain) => chain.id === "why_tennis"),
        evergreen.find((chain) => chain.id === "growth_value"),
      );
    }
  }

  const mustCover = insight.mustCover || [];
  let campaignSeen = 0;
  const explainerAngles = pickChains.filter(Boolean).map((chain, index) => {
    const isCampaign = chain.id === "campaign_focus";
    const dimension = isCampaign
      ? (mustCover[campaignSeen] || insight.campaignTheme || chain.dimensions[0])
      : (chain.dimensions[index % chain.dimensions.length]);
    if (isCampaign) campaignSeen += 1;
    const platforms = index % 2 === 0 ? platformByGoal.xhs : platformByGoal.douyin;
    return {
      chainId: chain.id,
      contentType: "explainer",
      contentGoal: chain.contentGoal,
      parentQuestion: isCampaign ? `${insight.campaignTheme || "本次活动"}：家长想了解什么` : chain.parentQuestion,
      hookPattern: `从家长关心的「${dimension}」切入`,
      structure: ["家长常见担心", "网球训练里具体讲什么", "真实可拍的画面", "不夸大的边界", "体验/咨询入口"],
      proofType: "教练讲解+训练画面",
      platforms,
      formats: platforms.includes("xhs") ? ["xhs_image"] : ["video"],
      risk: "不承诺效果/升学，不编造案例",
      title: dimension,
    };
  });

  // Only the daily/balanced path mixes in 真实展示; the campaign path stays focused.
  const availableShowcase = mode === "balanced" ? (stagePolicy?.availableShowcase || []) : [];
  if (!availableShowcase.length) return explainerAngles;

  const showcaseCount = Math.min(
    availableShowcase.length,
    Math.max(1, Math.round(explainerAngles.length * (stagePolicy.showcaseShare || 0))),
  );
  const showcaseAngles = availableShowcase.slice(0, showcaseCount).map((ct, index) => {
    const platforms = index % 2 === 0 ? platformByGoal.douyin : platformByGoal.xhs;
    return {
      chainId: ct.id,
      contentType: ct.id,
      contentGoal: (ct.primaryGoals && ct.primaryGoals[0]) || "信任",
      parentQuestion: `家长想看看真实的${ct.label}`,
      hookPattern: `用真实画面展示「${ct.label}」`,
      structure: ct.structureTemplate || ["开场镜头", "真实片段/细节", "不夸大的边界", "体验/咨询入口"],
      proofType: "真实拍摄，不摆拍",
      platforms,
      formats: platforms.includes("xhs") ? ["xhs_image"] : ["video"],
      risk: ct.compliance || "真实记录，不承诺效果",
      title: (ct.dimensions && ct.dimensions[0]) || `真实的${ct.label}`,
    };
  });

  // Interleave so 真实展示 angles survive the downstream slice(0, 6).
  const mixed = [];
  const ratio = Math.max(1, Math.round(explainerAngles.length / Math.max(1, showcaseAngles.length)));
  let si = 0;
  let ei = 0;
  while (ei < explainerAngles.length || si < showcaseAngles.length) {
    for (let k = 0; k < ratio && ei < explainerAngles.length; k += 1) mixed.push(explainerAngles[ei++]);
    if (si < showcaseAngles.length) mixed.push(showcaseAngles[si++]);
  }
  return mixed;
}

function topicDirectionMessages(profile, task, insight, angles, framework, mode, stagePolicy = DEFAULT_STAGE_POLICY) {
  const showcaseLabels = showcaseLabelsFor(stagePolicy);
  return [
    {
      role: "system",
      content: [
        "你是少儿网球内容的选题成稿顾问（Topics 角色）。",
        "你会拿到已确认的家长洞察（insight）和角度列表（angles）。请基于 angles 写出可直接进入内容生产的选题方向，不要发明与 angles 无关的新主题，也不要使用任何内置题库。",
        "每条 direction 的 contentType 必须与对应 angle 一致。explainer 写成讲解/价值稿；真实展示类（class_record/student_growth/venue_env/faculty_course/behind_scene）的 structure/materials 要写成「拍什么真实画面」，不要写成讲解稿。",
        "标题面向家长，具体、不标题党、不夸张；遵守 contentRules 与 profile.avoid。",
        "输出必须是严格 JSON，不要 Markdown，不要解释。",
      ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify({
        taskType: "junior_topic_directions",
        venueProfile: profileForPrompt(profile),
        insight,
        angles,
        generationMode: mode,
        availableShowcase: showcaseLabels,
        contentRules: framework.contentRules || {},
        requiredShape: {
          directions: [{
            id: "string，ai_ 前缀",
            contentType: "string，与对应 angle 的 contentType 一致（explainer 或真实展示类 id）",
            chainId: "string，对应某条 angle",
            contentGoal: "认知|比较|价值|信任|行动|活动",
            parentQuestion: "string",
            reason: "string，为什么现在做（1 句）",
            title: "string",
            purpose: "string，家长在纠结什么 + 这条解决什么",
            goal: "opening|booking|junior|adult_beginner|community|event|trust|daily",
            audiences: ["parents"],
            platforms: ["xhs"],
            formats: ["xhs_image"],
            structure: ["string"],
            materials: ["string"],
            cta: "string",
            risk: "string",
          }],
        },
        constraints: [
          "directions 数量 4-8，每条对应 angles 里的一条（chainId 与 contentType 一致）。",
          "真实展示类的 structure 用拍摄式（开场镜头 → 真实片段/细节 → 不夸大的边界 → 体验入口），materials 写真实可拍画面；不要写成口播讲解。",
          "audiences 只用 parents、teens；禁止 adults/players/corporate。",
          "platforms 只用 xhs、douyin、video、moments、group、dm；formats 只用 video、xhs_image、moments_text、moments_image、community。",
          "goal 优先 junior；活动类可用 event；信任类可用 trust。",
          "structure 要具体可用于后续脚本（如「家长疑问 → 训练里练到什么 → 边界 → 体验入口」）。",
          "禁止照抄 angles 的 dimension 原文当标题，要本地化成更口语的家长标题。",
        ],
        outputNote: "只返回 JSON。",
      }),
    },
  ];
}

function directionCriticMessages(profile, framework, directions, stagePolicy = DEFAULT_STAGE_POLICY) {
  const showcaseLabels = showcaseLabelsFor(stagePolicy);
  const allowedTypes = (stagePolicy?.allowedContentTypes || ["explainer"]);
  return [
    {
      role: "system",
      content: [
        "你是少儿网球内容的选题质检（Critic 角色）。",
        "对每条选题按 checklist 评估，去掉或重写不合格的，返回保留下来的高质量选题。",
        "输出必须是严格 JSON，不要 Markdown，不要解释。",
      ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify({
        taskType: "junior_topic_critic",
        contentRules: framework.contentRules || {},
        avoid: profile.avoid || [],
        allowedContentTypes: allowedTypes,
        availableShowcase: showcaseLabels,
        targetShowcaseShare: stagePolicy?.showcaseShare || 0,
        directions,
        checklist: [
          "是否家长决策视角（不是球友/白领/成人自练）",
          "整批是否覆盖 ≥3 种 contentGoal",
          "contentType 是否都在 allowedContentTypes 内（出现未解锁的真实课堂/学员成长要删或改）",
          "真实展示占比是否大致达到 targetShowcaseShare（不足可把个别 explainer 改写为可用的真实展示类）",
          "真实展示类是否写成拍摄式而非讲解稿；学员成长是否真实、不承诺效果、注明需家长授权",
          "materials 是否都能在少儿网球场真实拍到",
          "是否触犯 contentRules.forbiddenFraming 或 profile.avoid（承诺效果/升学/夸张）",
          "标题/角度是否与同批其它条目重复",
        ],
        requiredShape: { directions: ["与输入同结构（含 contentType），仅保留合格项，可改写 title/purpose"] },
        constraints: [
          "至少保留 4 条；若多条雷同只留最好的一条。",
          "对触碰禁用表述的条目，改写为合规措辞而不是直接删光。",
          "保留每条的 contentType 字段。",
        ],
        outputNote: "只返回 JSON：{ directions: [...] }。",
      }),
    },
  ];
}

function decorateDirectionList(rawDirections, profile, normalizedTask) {
  return rawDirections.map((rawTopic, index) => {
    const raw = normalizeTopicRaw({ ...rawTopic, source: "ai" }, profile, normalizedTask);
    const decorated = decorateTopic(raw, profile, normalizedTask, {
      score: 90 - index,
      source: "ai",
    });
    return {
      ...decorated,
      sourceLabel: topicSourceLabels.ai,
      chainId: rawTopic.chainId || "",
      contentType: String(rawTopic.contentType || "").trim() || "explainer",
      contentGoal: rawTopic.contentGoal || "",
      parentQuestion: rawTopic.parentQuestion || "",
      reason: String(rawTopic.reason || "").trim(),
    };
  });
}

function directionsFromAngles(profile, normalizedTask, insight, angles) {
  const raw = angles.slice(0, 6).map((angle, index) => ({
    id: makeTopicId("ai", angle.title || angle.parentQuestion),
    chainId: angle.chainId,
    contentType: angle.contentType || "explainer",
    contentGoal: angle.contentGoal,
    parentQuestion: angle.parentQuestion,
    reason: insight.weeklyFocus ? `贴合本次重点：${insight.weeklyFocus}` : "覆盖家长关心的决策问题",
    title: angle.title || angle.parentQuestion,
    purpose: `面向家长解答「${angle.parentQuestion}」，建立认知与信任。`,
    goal: "junior",
    audiences: ["parents"],
    platforms: angle.platforms,
    formats: angle.formats,
    structure: angle.structure,
    materials: insight.shootableAssets || ["场地空镜", "教练示范"],
    cta: "私信孩子年龄，获取更适合的体验建议",
    risk: angle.risk || "不承诺效果/升学，不编造案例",
  }));
  return decorateDirectionList(raw, profile, normalizedTask);
}

async function buildTopicDirectionsWithAi(profile, task = {}) {
  const framework = await loadAngleFramework();
  const brief = normalizeBrief(task.generationBrief);
  const mode = resolveGenerationMode(task, brief);
  const stagePolicy = resolveStagePolicy(profile, framework);
  const allowedAudienceIds = allowedAudiencesForProfile(profile);
  const goal = inferPrimaryGoal(task);
  const operatingMode = inferOperatingMode(profile, { ...task, goal });
  const pillars = buildPillars(profile, { ...task, goal, mode: operatingMode });
  const normalizedTask = { ...task, goal, mode: operatingMode, pillars: pillars.map((pillar) => pillar.id) };

  const settings = await loadAiSettings();
  const resolved = resolveAiProvider(settings);
  const steps = [];
  let aiMeta = buildLocalAiMeta(settings);

  let insight = buildInsightFallback(profile, task, framework, mode, brief, allowedAudienceIds, stagePolicy);
  let angles = buildAnglesFallback(profile, task, insight, framework, mode, allowedAudienceIds, stagePolicy);
  let directions = [];

  if (resolved) {
    const { provider, config } = resolved;
    const providerLabel = providerDefaults[provider]?.label || provider;
    let stepFailed = null;
    try {
      const insightText = await callAiText(provider, config, juniorInsightMessages(profile, task, framework, mode, brief, allowedAudienceIds, stagePolicy));
      const insightData = extractJson(insightText);
      if (insightData && Array.isArray(insightData.topQuestions) && insightData.topQuestions.length) {
        insight = { ...insight, ...insightData, generationMode: mode };
        steps.push("insight");
      }

      const angleText = await callAiText(provider, config, angleMessages(profile, task, insight, framework, mode, brief, task.excludeTitles, stagePolicy));
      const angleData = extractJson(angleText);
      if (angleData && Array.isArray(angleData.angles) && angleData.angles.length) {
        angles = angleData.angles;
        steps.push("angles");
      }

      const topicText = await callAiText(provider, config, topicDirectionMessages(profile, task, insight, angles, framework, mode, stagePolicy));
      const topicData = extractJson(topicText);
      if (!topicData || !Array.isArray(topicData.directions) || !topicData.directions.length) {
        throw new Error("AI 返回选题结构不完整");
      }
      let rawDirections = topicData.directions;
      steps.push("topics");

      try {
        const criticText = await callAiText(provider, config, directionCriticMessages(profile, framework, rawDirections, stagePolicy));
        const criticData = extractJson(criticText);
        if (criticData && Array.isArray(criticData.directions) && criticData.directions.length >= 4) {
          rawDirections = criticData.directions;
          steps.push("critic");
        }
      } catch {
        // Critic is best-effort; keep pre-critic directions.
      }

      directions = decorateDirectionList(rawDirections, profile, normalizedTask);
      aiMeta = { source: "ai", provider: providerLabel, model: config.model, steps };
    } catch (error) {
      stepFailed = error;
      aiMeta = {
        source: "fallback",
        provider: providerLabel,
        model: config?.model || "",
        steps,
        error: error.message || "AI 生成失败，已回退本地规则",
      };
    }
    if (stepFailed) directions = [];
  }

  if (!directions.length) {
    directions = directionsFromAngles(profile, normalizedTask, insight, angles);
  }

  const summary = {
    mode: operatingModeLabels[operatingMode] || operatingMode,
    goal: goalLabels[goal] || goal,
    generationMode: mode,
    audience: allowedAudienceIds.map((id) => audienceLabels[id] || id).join(" / ") || "少儿家长",
    stage: stageLabels[profile.stage] || profile.stage,
    suggestion: insight.weeklyFocus
      ? `本次围绕「${insight.weeklyFocus}」展开家长决策选题，挑选后保存入库。`
      : "已基于家长决策链生成选题方向，挑选后保存入库。",
    count: directions.length,
  };

  return {
    sessionId: `dir_${Date.now().toString(36)}`,
    generatedAt: new Date().toISOString(),
    generationMode: mode,
    insight,
    angles,
    summary,
    pillars,
    directions,
    aiMeta,
  };
}

function referenceParseMessages(profile, task, reference, framework = {}, allowedAudienceIds = []) {
  const allowedLabels = allowedAudienceIds.map((id) => audienceLabels[id] || id);
  const isJunior = allowedAudienceIds.length > 0 && allowedAudienceIds.every((id) => id === "parents" || id === "teens");
  return [
    {
      role: "system",
      content: [
        "你是网球场内容运营的参考拆解与本地化顾问。",
        "用户会描述一条外部参考内容（抖音/小红书/视频号等），你要先拆解它的结构与节奏，再把结构本地化成适合本网球场的选题方向。",
        "只学习结构、信息顺序、开头钩子方式和转化方式，绝不复制原文台词、品牌名、价格或案例。",
        "必须遵守球场的 avoid 约束，不编造价格、开放时间、学员案例、爆满现场或效果承诺。",
        isJunior ? "本场是少儿网球培训，决策者是家长：本地化后的选题必须落到家长决策视角，遵守 contentRules，不贴阶层标签、不承诺效果或升学。" : "",
        "输出必须是严格 JSON，不要 Markdown，不要解释。",
      ].filter(Boolean).join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify({
        taskType: "reference_parse",
        venueProfile: {
          name: profile.name,
          shortName: profile.shortName,
          city: profile.city,
          location: profile.location,
          stage: stageLabels[profile.stage] || profile.stage,
          positioning: profile.positioning,
          services: profile.services,
          audiences: profile.audiences,
          tone: profile.tone,
          booking: profile.booking,
          wechat: profile.wechat,
          avoid: profile.avoid,
        },
        weeklyInput: {
          goal: goalLabels[task.goal] || task.goal || "日常运营",
          audience: audienceLabels[task.audience] || "多类人群",
          focus: task.focus || "",
        },
        reference: {
          platform: reference.platform || "",
          format: reference.format || "",
          description: reference.description || "",
        },
        contentRules: framework.contentRules || {},
        allowedAudiences: allowedLabels.length ? allowedLabels : undefined,
        requiredShape: {
          referenceMeta: {
            topicSummary: "string",
            hookPattern: "string",
            structure: ["string"],
            ctaType: "string",
            avoidCopying: ["string"],
          },
          directions: [{
            id: "string",
            title: "string",
            goal: "opening|booking|junior|adult_beginner|community|event|trust|daily",
            audiences: ["parents"],
            platforms: ["xhs"],
            formats: ["xhs_image"],
            purpose: "string",
            materials: ["string"],
            structure: ["string"],
            cta: "string",
            risk: "string",
          }],
        },
        constraints: [
          "directions 给 1-3 条，id 用 ref_ 前缀。",
          "structure 模仿参考的信息顺序，但内容必须替换成本网球场可真实拍到/说清的素材。",
          "platforms 只用 xhs、douyin、video、moments、group、dm；formats 只用 video、xhs_image、moments_text、moments_image、community。",
          isJunior ? "audiences 只用 parents、teens（少儿场禁止 adults/players/corporate）。" : "audiences 只用 parents、teens、adults、players、corporate。",
        ],
        outputNote: "只返回 JSON。",
      }),
    },
  ];
}

function buildReferenceFallback(profile, task, reference) {
  const goal = inferPrimaryGoal(task);
  const mode = inferOperatingMode(profile, { ...task, goal });
  const pillars = buildPillars(profile, { ...task, goal, mode });
  const normalizedTask = { ...task, goal, mode, pillars: pillars.map((pillar) => pillar.id) };
  const desc = String(reference.description || "").trim();
  const raw = normalizeTopicRaw({
    id: makeTopicId("ref", desc.slice(0, 12) || "参考改写"),
    title: desc ? `参考改写：${desc.slice(0, 18)}` : "参考改写选题",
    goal,
    purpose: desc ? `参考该内容的结构，本地化为${profile.shortName || profile.name}可用的角度。` : "把参考内容的结构本地化成球场可用角度。",
    structure: ["开头钩子（本地化）", "核心信息分点", "真实可拍画面", "咨询/预约入口"],
    materials: ["场地空镜", "教练或场景画面"],
    source: "reference",
  }, profile, normalizedTask);
  const direction = decorateTopic(raw, profile, normalizedTask, { score: 70, source: "reference" });
  return {
    pillars,
    referenceMeta: {
      topicSummary: desc || "未提供参考描述",
      hookPattern: "",
      structure: direction.structure,
      ctaType: direction.cta,
      avoidCopying: ["原文台词", "对方品牌名", "未经证实的数据"],
    },
    directions: [direction],
  };
}

async function buildReferenceDirectionsWithAi(profile, task = {}, reference = {}) {
  const fallback = buildReferenceFallback(profile, task, reference);
  const framework = await loadAngleFramework();
  const allowedAudienceIds = allowedAudiencesForProfile(profile);
  const settings = await loadAiSettings();
  const resolved = resolveAiProvider(settings);
  let directions = fallback.directions;
  let referenceMeta = fallback.referenceMeta;
  let pillars = fallback.pillars;
  let aiMeta = buildLocalAiMeta(settings);

  if (resolved) {
    const { provider, config } = resolved;
    const providerLabel = providerDefaults[provider]?.label || provider;
    try {
      const text = await callAiText(provider, config, referenceParseMessages(profile, task, reference, framework, allowedAudienceIds));
      const data = extractJson(text);
      if (!data || !Array.isArray(data.directions) || !data.directions.length) {
        throw new Error("AI 返回结构不完整");
      }
      const goal = inferPrimaryGoal(task);
      const mode = inferOperatingMode(profile, { ...task, goal });
      pillars = buildPillars(profile, { ...task, goal, mode });
      const normalizedTask = { ...task, goal, mode, pillars: pillars.map((pillar) => pillar.id) };
      directions = data.directions.map((rawTopic, index) => {
        const raw = normalizeTopicRaw({ ...rawTopic, source: "reference" }, profile, normalizedTask);
        const decorated = decorateTopic(raw, profile, normalizedTask, { score: 80 - index, source: "reference" });
        return {
          ...decorated,
          contentType: String(rawTopic.contentType || "").trim() || "explainer",
        };
      });
      referenceMeta = data.referenceMeta || fallback.referenceMeta;
      aiMeta = { source: "ai", provider: providerLabel, model: config.model };
    } catch (error) {
      aiMeta = {
        source: "fallback",
        provider: providerLabel,
        model: config?.model || "",
        error: error.message || "AI 解析失败，已回退本地规则",
      };
    }
  }

  return {
    sessionId: `ref_${Date.now().toString(36)}`,
    generatedAt: new Date().toISOString(),
    origin: "reference",
    referenceMeta,
    summary: {
      suggestion: "已根据参考内容拆解结构，并本地化为可用选题方向。保存到库后可进入内容生产。",
    },
    pillars,
    directions,
    aiMeta,
  };
}

function resolveCadence(task = {}) {
  return {
    video: Number.isFinite(Number(task.cadence?.video)) ? Number(task.cadence.video) : cadenceDefaults.video,
    xhsImage: Number.isFinite(Number(task.cadence?.xhsImage)) ? Number(task.cadence.xhsImage) : cadenceDefaults.xhsImage,
    moments: Number.isFinite(Number(task.cadence?.moments)) ? Number(task.cadence.moments) : cadenceDefaults.moments,
  };
}

function buildContextPack(profile, task = {}) {
  const goal = inferPrimaryGoal(task);
  const mode = inferOperatingMode(profile, { ...task, goal });
  return {
    venueProfile: {
      name: profile.name,
      shortName: profile.shortName,
      city: profile.city,
      location: profile.location,
      stage: stageLabels[profile.stage] || profile.stage,
      positioning: profile.positioning,
      services: profile.services,
      audiences: profile.audiences,
      tone: profile.tone,
      booking: profile.booking,
      wechat: profile.wechat,
      avoid: profile.avoid,
      facts: profile.facts,
    },
    weeklyInput: {
      mode: operatingModeLabels[mode] || mode,
      goal: goalLabels[goal] || goal,
      audience: audienceLabels[task.audience] || "多类人群",
      focus: task.focus || "",
      eventInfo: task.eventInfo || "",
      generationBrief: normalizeBrief(task.generationBrief) || null,
    },
    cadence: resolveCadence(task),
    pillarReference: Object.entries(pillarDefinitions).map(([id, item]) => ({
      exampleId: id,
      exampleLabel: item.label,
      exampleAngle: item.role,
    })),
    pillarReferenceNote: "以上只是常见分类示例，不是本周固定答案；请结合 weeklyInput 自定义 contentPillars。",
    topicPatterns: topicBank.map((topic) => ({
      title: topic.title,
      angle: topic.purpose,
      pillar: topicPillar(topic),
      typicalPlatforms: topic.platforms.map((item) => channelLabels[item] || item),
    })),
  };
}

function platformMatchesTopic(platformLabel, topic) {
  const platforms = inferPlatformsFromLabel(platformLabel);
  return platforms.some((item) => topic.platforms.includes(item));
}

function pickTopicForSlot(slot, rankedTopics, usedIds) {
  for (const { topic } of rankedTopics) {
    if (usedIds.has(topic.id)) continue;
    if (platformMatchesTopic(slot.platform, topic)) return topic;
  }
  for (const { topic } of rankedTopics) {
    if (!usedIds.has(topic.id)) return topic;
  }
  return rankedTopics[0]?.topic || topicBank[0];
}

function buildScheduleItem(slot, topic, profile, task, extras = {}) {
  const goal = inferPrimaryGoal(task);
  return {
    day: slot.day,
    platform: slot.platform,
    format: slot.format,
    theme: extras.theme || slot.theme || "本周内容",
    goal: topic.goal || goal,
    topicId: topic.id,
    topicTitle: topic.title,
    topicAngle: extras.topicAngle || topic.purpose,
    whyPlatform: extras.whyPlatform || `该选题适合在${slot.platform}用${slot.format}表达`,
    whyTiming: extras.whyTiming || `安排在${slot.day}发布`,
    pillar: topicPillar(topic),
    pillarLabel: pillarDefinitions[topicPillar(topic)]?.label || topicPillar(topic),
    targetAudience: topic.audiences.map((audience) => audienceLabels[audience] || audience).join(" / "),
    materialNeed: topic.materials.slice(0, 4),
    action: topic.suggestedCta || topic.cta || "发布后引导收藏、私信或进群",
    risk: topic.risk,
    reason: extras.reason || topic.purpose,
  };
}

function buildOperationPlan(profile, task = {}) {
  const goal = inferPrimaryGoal(task);
  const mode = inferOperatingMode(profile, { ...task, goal });
  const mainAudience = audienceLabels[task.audience] || "附近潜在用户";
  const focus = firstAvailable(task.focus, mode === "daily" ? "维持日常曝光、持续答疑、沉淀私域意向" : "阶段性重点传播");
  const eventInfo = firstAvailable(task.eventInfo, "没有特定活动，按日常运营节奏处理");
  const seedPillars = buildPillars(profile, { ...task, goal, mode, focus, eventInfo });
  const cadence = resolveCadence(task);
  const normalizedTask = { ...task, goal, mode, pillars: seedPillars.map((pillar) => pillar.id) };
  const ranked = topicBank
    .map((topic) => ({ topic, score: scoreTopic(topic, normalizedTask) }))
    .sort((a, b) => b.score - a.score || a.topic.title.localeCompare(b.topic.title, "zh-CN"));
  const usedIds = new Set();
  const makeItem = (slot) => {
    const topic = pickTopicForSlot(slot, ranked, usedIds);
    usedIds.add(topic.id);
    return buildScheduleItem(slot, enrichTopic(topic, profile, normalizedTask), profile, normalizedTask);
  };
  const selected = [
    ...publishingSlots.xhsImage.slice(0, Math.max(0, cadence.xhsImage)).map(makeItem),
    ...publishingSlots.video.slice(0, Math.max(0, cadence.video)).map(makeItem),
    ...publishingSlots.moments.slice(0, Math.max(0, cadence.moments)).map(makeItem),
  ].sort((a, b) => ["周一", "周二", "周三", "周四", "周五", "周六", "周日"].indexOf(a.day) - ["周一", "周二", "周三", "周四", "周五", "周六", "周日"].indexOf(b.day));
  const pillars = finalizePillarsFromSchedule(seedPillars, selected);

  return {
    overview: {
      title: `${profile.shortName || profile.name}一周运营计划`,
      stage: stageLabels[profile.stage] || profile.stage,
      mode: operatingModeLabels[mode] || mode,
      goal: goalLabels[goal] || goal,
      audience: mainAudience,
      focus,
      eventInfo,
      rhythm: `本周按 ${cadence.video} 条短视频、${cadence.xhsImage} 篇小红书图文、${cadence.moments} 条朋友圈排布。`,
      strategySummary: "本地兜底排期：按平台槽位匹配题库，并尽量避免重复选题。",
    },
    cadence,
    pillars,
    platformRhythm: [
      { platform: "小红书", role: "搜索沉淀和本地种草", cadence: `每周 ${cadence.xhsImage} 篇图文`, content: "按阶段选择认知、新手、家长问题等角度" },
      { platform: "抖音/视频号", role: "同城曝光和熟人传播", cadence: `每周 ${cadence.video} 条短视频`, content: "按阶段选择场地、演示、体验流程等角度" },
      { platform: "朋友圈", role: "真实进展与私域信任", cadence: `每周 ${cadence.moments} 条`, content: "按阶段决定私域轻重，不强行刷频" },
    ],
    publishingSchedule: selected,
    week: selected,
    preparationTasks: [
      "发布前确认是否涉及价格、开放时间、名额和预约规则。",
      "优先拍摄真实场地、路线和服务项目素材。",
    ],
    reminders: [
      "本地兜底计划能力有限，建议配置 AI 后重新生成以获得策略化排期。",
      "微信社群在「社群运营」里单独生成。",
      "未确认的信息不要写进内容。",
    ],
  };
}

function strategistMessages(profile, task) {
  const context = buildContextPack(profile, task);
  return [
    {
      role: "system",
      content: [
        "你是网球场内容运营策略顾问（Strategist 角色）。",
        "你的任务是根据球场档案和运营输入，推导本周平台策略与内容方向，而不是套用固定周历模板。",
        "必须结合 stage、goal、audience 推理公域/私域权重，并解释理由。",
        "不得编造价格、开放时间、学员案例、爆满现场或效果承诺。",
        "输出必须是严格 JSON，不要 Markdown，不要解释。",
        "topicPatterns 只是常见角度参考，不是必须选用的题库。",
      ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify({
        taskType: "weekly_content_strategy",
        ...context,
        requiredShape: {
          strategySummary: "string",
          platformMix: [{
            platform: "小红书|抖音/视频号|朋友圈|微信社群",
            weight: "高|中|低|不做",
            role: "string",
            reason: "string",
          }],
          privateDomainPolicy: {
            moments: "string",
            community: "string",
            reason: "string",
          },
          contentPillars: [{
            id: "string英文下划线slug",
            label: "string本周定制支柱名",
            ratio: "string",
            focus: "string本周在该支柱下的具体方向",
          }],
          schedulingPrinciples: ["string"],
          whatNotToDo: ["string"],
        },
        constraints: [
          "根据 stage 推理平台权重，例如开业前通常公域种草权重更高，但需写出理由，不要套用固定结论。",
          "私域（朋友圈/社群）是否进入本周主计划由你判断；社群默认不在 publishingSchedule 里出现。",
          "contentPillars 必须结合 weeklyInput.focus、eventInfo 与 venueProfile 定制，建议 4-6 个。",
          "禁止原样照搬 pillarReference 的 exampleLabel 和 exampleAngle；label 与 focus 都要体现本周差异。",
          "focus 至少 15 字，写清本周该支柱解决什么问题、适合什么人群、与 stage/goal 的关系。",
          "schedulingPrinciples 要写清「什么题适合什么平台、什么阶段不适合什么平台」。",
        ],
      }),
    },
  ];
}

function plannerMessages(profile, task, strategy, candidateTopics = []) {
  const context = buildContextPack(profile, task);
  const candidates = candidateTopics.slice(0, 30).map((topic) => ({
    topicId: topic.id,
    title: topic.title,
    goal: topic.goal,
    contentType: topic.contentType || "",
    platforms: topic.platforms,
    parentQuestion: topic.parentQuestion || "",
  }));
  return [
    {
      role: "system",
      content: [
        "你是网球场内容运营排期策划（Planner 角色），本轮只负责「排期」，不负责创作选题。",
        "选题已经由专门的选题流水线生成好，放在 candidateTopics 里。你必须从 candidateTopics 里挑选，逐条排进本周 publishingSchedule。",
        "严禁新造选题：每条排期的 topicId 和 topicTitle 必须来自 candidateTopics 中的某一条，原样引用，不要改写标题、不要发明新 id。",
        "你的工作是决定：哪条选题放哪天、发哪个平台、为什么这样排（whyPlatform/whyTiming），以及结合平台的简短 topicAngle 说明。",
        "不得编造事实；risk 必须体现 profile.avoid。",
        "输出必须是严格 JSON，不要 Markdown，不要解释。",
      ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify({
        taskType: "weekly_publishing_schedule",
        ...context,
        strategy,
        candidateTopics: candidates,
        requiredShape: {
          overview: {
            title: "string",
            focus: "string",
            rhythm: "string",
            strategySummary: "string",
          },
          publishingSchedule: [{
            day: "周一|周二|周三|周四|周五|周六|周日",
            platform: "小红书|抖音/视频号|朋友圈",
            format: "图文|短视频|文字/图文|文字",
            theme: "string",
            goal: "opening|booking|junior|adult_beginner|community|event|trust|daily",
            topicId: "string，必须等于所选 candidateTopics 项的 topicId",
            topicTitle: "string，必须等于该 candidateTopics 项的 title",
            topicAngle: "string，结合平台的角度说明（可基于该选题改写）",
            whyPlatform: "string",
            whyTiming: "string",
            pillar: "string，必须来自 strategy.contentPillars 的 id",
            pillarLabel: "string，必须与 strategy.contentPillars 对应项 label 一致",
            targetAudience: "string",
            materialNeed: ["string"],
            action: "string",
            risk: "string",
            reason: "string",
          }],
          preparationTasks: ["string"],
          reminders: ["string"],
        },
        constraints: [
          `publishingSchedule 总条数必须等于 ${context.cadence.xhsImage + context.cadence.video + context.cadence.moments} 条。`,
          `其中小红书 ${context.cadence.xhsImage} 条、短视频/视频号 ${context.cadence.video} 条、朋友圈 ${context.cadence.moments} 条。`,
          "topicId / topicTitle 必须严格取自 candidateTopics，不允许出现 candidateTopics 之外的选题。",
          "不要安排微信群/社群进 publishingSchedule。",
          "尽量每条用不同选题；候选不够时同一选题最多复用 2 次，且要在 topicAngle 写清跨平台改写方向。",
          "platform/format 必须与 platform 匹配，例如小红书用图文，短视频平台用短视频。",
          "whyPlatform 和 whyTiming 必填，且要具体，不要空话。",
          "每条排期的 pillar/pillarLabel 必须引用 strategy.contentPillars，不要自造未在策略中出现的支柱。",
        ],
      }),
    },
  ];
}

function isValidStrategy(data) {
  return Boolean(
    data &&
    typeof data.strategySummary === "string" &&
    Array.isArray(data.platformMix) &&
    data.platformMix.length &&
    Array.isArray(data.contentPillars) &&
    data.contentPillars.length >= 3 &&
    data.contentPillars.every((item) => (
      item &&
      String(item.label || "").trim().length >= 2 &&
      String(item.focus || item.role || "").trim().length >= 12
    )) &&
    data.privateDomainPolicy,
  );
}

function countSchedulePlatforms(schedule = []) {
  let xhsImage = 0;
  let video = 0;
  let moments = 0;
  for (const item of schedule) {
    const platform = String(item.platform || "");
    if (platform.includes("小红书")) xhsImage += 1;
    else if (platform.includes("朋友圈")) moments += 1;
    else if (platform.includes("抖音") || platform.includes("视频号")) video += 1;
  }
  return { xhsImage, video, moments };
}

function dedupeCandidateTopics(topics = []) {
  const byId = new Map();
  const seenTitles = new Set();
  for (const topic of topics) {
    if (!topic || !topic.id) continue;
    const titleKey = normalizeTitleKey(topic.title);
    if (byId.has(topic.id) || seenTitles.has(titleKey)) continue;
    byId.set(topic.id, topic);
    seenTitles.add(titleKey);
  }
  return Array.from(byId.values());
}

function platformKeyFromLabel(label = "") {
  const s = String(label);
  if (s.includes("小红书")) return "xhs";
  if (s.includes("朋友圈")) return "moments";
  if (s.includes("抖音") || s.includes("视频号")) return "video";
  return "other";
}

// 强制排期里的 topicId/title 来自候选池：能匹配的对齐，乱造的按平台轮转兜底替换。
function enforceCandidateTopics(plannerOutput, candidatePool = []) {
  if (!plannerOutput || !Array.isArray(plannerOutput.publishingSchedule) || !candidatePool.length) return;
  const byId = new Map(candidatePool.map((t) => [t.id, t]));
  const byTitle = new Map(candidatePool.map((t) => [normalizeTitleKey(t.title), t]));
  const usage = new Map();
  const used = (id) => usage.get(id) || 0;
  const bump = (id) => usage.set(id, used(id) + 1);

  const pickFor = (platformLabel) => {
    const pk = platformKeyFromLabel(platformLabel);
    const matches = (t) => {
      const ps = t.platforms || [];
      if (pk === "xhs") return ps.includes("xhs");
      if (pk === "moments") return ps.includes("moments");
      if (pk === "video") return ps.includes("douyin") || ps.includes("video");
      return true;
    };
    const order = [...candidatePool].sort((a, b) => used(a.id) - used(b.id));
    return order.find((t) => matches(t) && used(t.id) < 2)
      || order.find((t) => used(t.id) < 2)
      || order[0];
  };

  for (const slot of plannerOutput.publishingSchedule) {
    let chosen = byId.get(slot.topicId) || byTitle.get(normalizeTitleKey(slot.topicTitle));
    if (!chosen) chosen = pickFor(slot.platform);
    if (!chosen) continue;
    slot.topicId = chosen.id;
    slot.topicTitle = chosen.title;
    bump(chosen.id);
  }
}

function isValidPlannerPlan(data, cadence) {
  if (!data || !data.overview || !Array.isArray(data.publishingSchedule) || !data.publishingSchedule.length) {
    return false;
  }
  const counts = countSchedulePlatforms(data.publishingSchedule);
  return counts.xhsImage === cadence.xhsImage
    && counts.video === cadence.video
    && counts.moments === cadence.moments;
}

function normalizeScheduleItem(raw, profile, task, candidateById = new Map()) {
  const topic = topicFromScheduleSlot(raw, profile, task);
  const pillarId = pillarDefinitions[raw.pillar] ? raw.pillar : topicPillar(topic);
  // 按 topicId 回查候选/库选题，让槽位带上真实题材（contentType/category）。
  const candidate = candidateById.get(raw.topicId) || null;
  const category = resolveTopicCategory(candidate || { goal: raw.goal || topic.goal });
  return {
    day: raw.day,
    platform: raw.platform,
    format: raw.format,
    theme: raw.theme || "本周内容",
    goal: raw.goal || topic.goal,
    topicId: raw.topicId || topic.id,
    topicTitle: raw.topicTitle || topic.title,
    topicAngle: raw.topicAngle || raw.reason || topic.purpose,
    whyPlatform: raw.whyPlatform || `适合在${raw.platform}发布`,
    whyTiming: raw.whyTiming || `安排在${raw.day}`,
    pillar: pillarId,
    pillarLabel: raw.pillarLabel || pillarDefinitions[pillarId]?.label || pillarId,
    contentType: candidate?.contentType || "",
    category: category.id,
    categoryLabel: category.label,
    parentQuestion: candidate?.parentQuestion || "",
    targetAudience: raw.targetAudience || topic.audiences.map((item) => audienceLabels[item] || item).join(" / "),
    materialNeed: Array.isArray(raw.materialNeed) && raw.materialNeed.length ? raw.materialNeed : topic.materials.slice(0, 4),
    action: raw.action || topic.cta,
    risk: raw.risk || topic.risk,
    reason: raw.reason || raw.topicAngle || topic.purpose,
  };
}

function assembleAiPlan(profile, task, strategy, plannerOutput, candidatePool = []) {
  const goal = inferPrimaryGoal(task);
  const mode = inferOperatingMode(profile, { ...task, goal });
  const cadence = resolveCadence(task);
  const mainAudience = audienceLabels[task.audience] || "附近潜在用户";
  const candidateById = new Map(candidatePool.map((topic) => [topic.id, topic]));
  const schedule = plannerOutput.publishingSchedule.map((item) => normalizeScheduleItem(item, profile, task, candidateById))
    .sort((a, b) => ["周一", "周二", "周三", "周四", "周五", "周六", "周日"].indexOf(a.day) - ["周一", "周二", "周三", "周四", "周五", "周六", "周日"].indexOf(b.day));
  const pillars = finalizePillarsFromSchedule(strategy.contentPillars, schedule);

  return {
    overview: {
      title: plannerOutput.overview?.title || `${profile.shortName || profile.name}一周运营计划`,
      stage: stageLabels[profile.stage] || profile.stage,
      mode: operatingModeLabels[mode] || mode,
      goal: goalLabels[goal] || goal,
      audience: mainAudience,
      focus: plannerOutput.overview?.focus || firstAvailable(task.focus, "本周内容传播"),
      eventInfo: firstAvailable(task.eventInfo, "没有特定活动，按日常运营节奏处理"),
      rhythm: plannerOutput.overview?.rhythm || `本周 ${cadence.video} 条短视频、${cadence.xhsImage} 篇小红书、${cadence.moments} 条朋友圈。`,
      strategySummary: plannerOutput.overview?.strategySummary || strategy.strategySummary,
    },
    strategy,
    cadence,
    pillars: pillars.length ? pillars : buildPillars(profile, task),
    platformRhythm: (strategy.platformMix || []).map((item) => ({
      platform: item.platform,
      role: item.role,
      cadence: item.weight,
      content: item.reason,
    })),
    publishingSchedule: schedule,
    week: schedule,
    preparationTasks: plannerOutput.preparationTasks || [],
    reminders: plannerOutput.reminders || [],
  };
}

// 把本周策略转成选题生成 brief，让选题流水线按本周主题产出（而不是通用 balanced）。
function buildPlanGenerationBrief(profile, task = {}, strategy = {}) {
  const focus = String(task.focus || "").trim();
  const eventInfo = String(task.eventInfo || "").trim();
  const theme = focus || String(strategy.strategySummary || "").trim();
  const pillarFocuses = Array.isArray(strategy.contentPillars)
    ? strategy.contentPillars.map((p) => String(p.focus || p.label || "").trim()).filter(Boolean)
    : [];
  const mustCover = [...new Set([eventInfo, ...pillarFocuses].filter(Boolean))].slice(0, 6);
  const cadence = resolveCadence(task);
  const preferredPlatforms = [
    ...(cadence.xhsImage > 0 ? ["xhs"] : []),
    ...(cadence.video > 0 ? ["douyin", "video"] : []),
    ...(cadence.moments > 0 ? ["moments"] : []),
  ];
  return {
    theme,
    primaryGoal: String(task.goal || "").trim(),
    mustCover,
    mustAvoid: Array.isArray(profile.avoid) ? profile.avoid : [],
    preferredPlatforms,
    toneOverride: "",
  };
}

async function buildOperationPlanWithAi(profile, task = {}) {
  const fallbackPlan = buildOperationPlan(profile, task);
  const settings = await loadAiSettings();
  const resolved = resolveAiProvider(settings);

  if (!resolved) {
    return { ...fallbackPlan, aiMeta: buildLocalAiMeta(settings) };
  }

  const { provider, config } = resolved;
  const providerLabel = providerDefaults[provider]?.label || provider;

  try {
    const strategyText = await callAiText(provider, config, strategistMessages(profile, task));
    const strategy = extractJson(strategyText);
    if (!isValidStrategy(strategy)) throw new Error("策略输出结构不完整");

    const library = await loadTopicLibrary();
    const existingEntries = (library.entries || []);
    const reusableTopics = existingEntries.filter((entry) => entry.status !== "archived");
    const excludeTitles = existingEntries.map((entry) => entry.title).filter(Boolean);

    // 选题统一走选题库的 4 步高质量流水线，按本周主题生成。
    // 有真实活动(eventInfo) → hybrid(活动+认知兼顾)；否则 balanced：本周 focus 只作软主题，
    // 通过 generationBrief 引导题材，但仍产出多元科普/价值/信任/真实展示，不把整周变成「活动选题」。
    const generationBrief = buildPlanGenerationBrief(profile, task, strategy);
    const generationMode = task.eventInfo ? "hybrid" : "balanced";
    let generated = [];
    const directionSteps = [];
    try {
      const dirResult = await buildTopicDirectionsWithAi(profile, {
        ...task,
        generationBrief,
        generationMode,
        excludeTitles,
      });
      generated = Array.isArray(dirResult?.directions) ? dirResult.directions : [];
      if (Array.isArray(dirResult?.aiMeta?.steps)) directionSteps.push(...dirResult.aiMeta.steps);
    } catch {
      // 生成失败不致命：候选池退化为库内可复用选题。
    }

    // 新生成的选题入库，让计划与库同源、库逐渐长起来。
    if (generated.length) {
      const mergedEntries = mergeTopicsIntoLibrary(existingEntries, generated, profile, task);
      await saveTopicLibrary({ ...library, entries: mergedEntries });
    }

    // 候选池 = 新生成 + 可复用库选题（新生成优先）。
    const candidatePool = dedupeCandidateTopics([...generated, ...reusableTopics]);

    const plannerText = await callAiText(provider, config, plannerMessages(profile, task, strategy, candidatePool));
    const plannerOutput = extractJson(plannerText);
    enforceCandidateTopics(plannerOutput, candidatePool);
    if (!isValidPlannerPlan(plannerOutput, resolveCadence(task))) {
      throw new Error("排期输出结构不完整或与发布数量不匹配");
    }

    return {
      ...assembleAiPlan(profile, task, strategy, plannerOutput, candidatePool),
      aiMeta: {
        source: "ai",
        provider: providerLabel,
        model: config.model,
        steps: ["strategist", ...directionSteps.map((s) => `topic:${s}`), "planner"],
      },
    };
  } catch (error) {
    return {
      ...fallbackPlan,
      aiMeta: {
        source: "fallback",
        provider: providerLabel,
        model: config?.model || "",
        error: error.message || "AI 生成失败，已回退本地规则",
        steps: ["strategist", "planner"],
      },
    };
  }
}

function buildVideoMaterial(profile, topic) {
  const title = String(topic.title || "未命名选题");
  const isShowcase = SHOWCASE_CATEGORY_IDS.has(String(topic.contentType || ""));
  let structure = Array.isArray(topic.structure) && topic.structure.length ? topic.structure.slice() : ["开场", "展开", "可信细节", "引导"];
  // 视频校验要求至少 2 个分镜，兜底也要满足。
  if (structure.length < 2) structure = [...structure, "引导了解 / 到店咨询"];
  const materials = Array.isArray(topic.materials) && topic.materials.length ? topic.materials : ["场地真实画面"];
  const hook = {
    narration: isShowcase ? `带你真实看看${title}` : `很多家长都在问：${topic.parentQuestion || title}`,
    visual: materials[0] || "球场真实画面",
    onScreenText: title.length > 14 ? title.slice(0, 14) : title,
  };
  const script = structure.map((step, index) => ({
    id: index + 1,
    time: `${index * 6}-${index * 6 + 6}s`,
    visual: materials[index % materials.length] || "场地真实画面",
    narration: isShowcase
      ? `${step}`
      : `关于「${step}」，简单说清楚：结合真实训练讲一点，不夸大。`,
    onScreenText: step,
    intent: step,
  }));
  return {
    type: "video",
    title,
    durationHint: isShowcase ? "20-40s" : "30-50s",
    coverText: title.length > 18 ? title.slice(0, 18) : title,
    hook,
    script,
    shootingList: materials,
    editingNotes: ["竖屏拍摄", "字幕短句", "前 3 秒必须出现球场或问题", "结尾放私信/进群动作"],
    publishCopy: `${title}\n\n${topic.purpose}\n\n${topic.suggestedCta || topic.cta}`,
  };
}

function buildXhsImageMaterial(profile, topic) {
  const isShowcase = SHOWCASE_CATEGORY_IDS.has(String(topic.contentType || ""));
  const structure = Array.isArray(topic.structure) && topic.structure.length ? topic.structure : ["真实场地", "训练画面", "适合人群", "咨询入口"];
  const cover = {
    headline: topic.title,
    subline: isShowcase ? "真实记录，给你看看实际的样子" : `这篇主要解决：${topic.purpose}`,
  };
  const base = {
    type: "xhs_image",
    titles: [
      `${profile.city || "广州"}想打网球，先收藏这篇`,
      topic.title,
      `${profile.shortName || "这个网球场"}适合谁先来看看？`,
    ],
    cover,
    imageContents: [],
    shotList: [],
    body: [
      `${topic.title}`,
      "",
      isShowcase ? `这组图是真实记录，配文搭配实拍看。` : `这篇主要想解决：${topic.purpose}。`,
      "",
      `目前信息以球场实际同步为准，不编造效果和案例。`,
      `${topic.suggestedCta || topic.cta}`,
    ].join("\n"),
    tags: ["广州网球", "网球新手", "亲子运动", "周末运动", profile.shortName || "网球场"].filter(Boolean),
    commentGuide: "你第一次来网球场最担心什么？可以评论区问我。",
  };
  if (isShowcase) {
    base.shotList = structure.map((item) => ({ shot: `实拍：${item}`, caption: item }));
  } else {
    base.imageContents = structure.map((item) => ({ heading: item, lines: [`围绕「${item}」讲清楚关键的一点，具体、不夸大。`] }));
  }
  return base;
}

function buildMomentsMaterial(profile, topic) {
  return {
    type: "moments_text",
    versions: [
      {
        label: "自然版",
        text: `${profile.shortName || profile.name}最近会重点更新「${topic.title}」。如果你也想试试网球，或者想先了解场地和预约安排，可以先和我说一声。`,
      },
      {
        label: "轻推广版",
        text: `最近不少朋友问网球体验/订场怎么开始，我整理了一个方向：${topic.title}。后面开放信息和预约方式确认后，会优先同步给有兴趣的朋友。`,
      },
      {
        label: "图文配文版",
        text: `今天这组图主要讲：${topic.title}。\n先把真实场地、适合人群和咨询入口说清楚，大家不用急着做决定，先了解也可以。`,
      },
    ],
    imageTexts: (Array.isArray(topic.structure) ? topic.structure : []).slice(0, 4).map((item, index) => `图${index + 1}：${item}`),
  };
}

function buildCommunityMaterial(profile, topic) {
  return {
    type: "community",
    dailyTopic: `今天想问大家：关于「${topic.title}」，你最想先了解哪一部分？`,
    announcement: `大家好，今天同步一个网球场相关话题：${topic.title}。我们会基于真实场地和实际安排来更新，不夸大效果，也不编造案例。`,
    interaction: "可以直接回复：A 场地/位置 B 体验安排 C 费用/预约 D 适合人群",
    eventReminder: `如果你对这个方向感兴趣，可以先在群里回复关键词，我这边后续把${profile.shortName || "球场"}的具体安排同步给你。`,
    coldStart: "群里有第一次想接触网球的朋友吗？可以不用会打，先说说你最担心什么。",
    faqReplies: [
      "零基础可以先了解体验安排，不需要一开始就准备很多装备。",
      "具体时间、价格和预约方式以球场正式同步为准，我可以先帮你记录意向。",
      "孩子是否适合开始，要看年龄、兴趣和身体状态，不建议用统一标准判断。",
    ],
  };
}

function resolveTopicSource(task, profile) {
  if (task.topic?.title) {
    const normalized = normalizeTopicRaw(task.topic, profile, task);
    let contentType = task.topic.contentType || "";
    if (!contentType) {
      // 自由想法等没有显式形态时，按想法文本(标题+角度+要点)自动判断。
      const overrides = task.brief || {};
      const hint = [
        normalized.title,
        overrides.topicAngle || task.topic.parentQuestion || "",
        Array.isArray(overrides.keyPoints) ? overrides.keyPoints.join(" ") : "",
      ].join(" ");
      contentType = inferContentTypeFromText(hint);
    }
    return {
      ...normalized,
      contentGoal: task.topic.contentGoal || "",
      chainId: task.topic.chainId || "",
      contentType,
      parentQuestion: task.topic.parentQuestion || "",
    };
  }
  return topicBank.find((topic) => topic.id === task.topicId) || topicBank[0];
}

function buildTopicFromPlanSlot(profile, task = {}) {
  const goal = inferPrimaryGoal(task);
  const mode = inferOperatingMode(profile, { ...task, goal });
  const normalizedTask = { ...task, goal, mode };
  const { topicId, planSlot, topic: passedTopic } = task;

  if (passedTopic?.title) {
    return decorateTopic(normalizeTopicRaw(passedTopic, profile, normalizedTask), profile, normalizedTask, {
      score: 100,
      source: "plan",
      planSlots: planSlot ? [planSlot] : passedTopic.planSlots || [],
    });
  }

  if (planSlot) {
    return decorateTopic(
      topicFromScheduleSlot({ ...planSlot, topicId: topicId || planSlot.topicId }, profile, normalizedTask),
      profile,
      normalizedTask,
      { score: 100, source: "plan", planSlots: [planSlot] },
    );
  }

  const seed = topicBank.find((topic) => topic.id === topicId);
  if (seed) {
    return decorateTopic(
      normalizeTopicRaw({ ...seed, source: "plan" }, profile, normalizedTask),
      profile,
      normalizedTask,
      { score: 100, source: "plan", planSlots: [] },
    );
  }

  return decorateTopic(topicFromScheduleSlot({ topicId, topicTitle: "排期选题" }, profile, normalizedTask), profile, normalizedTask, {
    score: 100,
    source: "plan",
    planSlots: planSlot ? [planSlot] : [],
  });
}

function buildMaterialByFormat(profile, topic, format) {
  if (format === "video") return buildVideoMaterial(profile, topic);
  if (format === "xhs_image") return buildXhsImageMaterial(profile, topic);
  if (format === "moments_text" || format === "moments_image") return buildMomentsMaterial(profile, topic);
  if (format === "community") return buildCommunityMaterial(profile, topic);
  throw new Error(`不支持的内容类型 ${format}`);
}

function materialShapeForFormat(format) {
  if (format === "video") {
    return {
      type: "video",
      title: "string",
      durationHint: "string",
      coverText: "string",
      hook: { narration: "string", visual: "string", onScreenText: "string" },
      script: [{ time: "string", visual: "string", narration: "string", onScreenText: "string", intent: "string" }],
      shootingList: ["string"],
      editingNotes: ["string"],
      publishCopy: "string",
    };
  }
  if (format === "xhs_image") {
    return {
      type: "xhs_image",
      titles: ["string"],
      cover: { headline: "string", subline: "string" },
      imageContents: [{ heading: "string", lines: ["string"] }],
      shotList: [{ shot: "string", caption: "string" }],
      body: "string",
      tags: ["string"],
      commentGuide: "string",
    };
  }
  if (format === "moments_text" || format === "moments_image") {
    return {
      type: "moments_text",
      versions: [{ label: "string", text: "string" }],
      imageTexts: ["string"],
    };
  }
  if (format === "community") {
    return {
      type: "community",
      dailyTopic: "string",
      announcement: "string",
      interaction: "string",
      eventReminder: "string",
      coldStart: "string",
      faqReplies: ["string"],
    };
  }
  return { type: format };
}

// 统一内容输入契约：把选题 + 排期槽位 + 前端可编辑覆盖归一成单一 brief，
// 作为所有格式（图文/视频/朋友圈/社群）生成与修订的唯一来源。
function buildContentBrief(profile, topic, task = {}) {
  const planSlot = task.planSlot || topic.planSlots?.[0] || null;
  const overrides = task.brief || {};
  const base = {
    topicId: topic.id,
    title: firstAvailable(overrides.title, topic.title),
    goal: goalLabels[topic.goal] || topic.goal,
    purpose: topic.purpose,
    contentGoal: topic.contentGoal || "",
    parentQuestion: topic.parentQuestion || "",
    topicAngle: firstAvailable(overrides.topicAngle, task.planSlot?.topicAngle, topic.parentQuestion, topic.purpose),
    keyPoints: Array.isArray(overrides.keyPoints) && overrides.keyPoints.length
      ? overrides.keyPoints
      : (Array.isArray(topic.structure) ? topic.structure : []),
    materials: Array.isArray(overrides.materials) && overrides.materials.length ? overrides.materials : (topic.materials || []),
    cta: firstAvailable(overrides.cta, topic.suggestedCta, topic.cta, ""),
    risk: topic.risk || "",
    pillarLabel: topic.pillarLabel || "",
    platformText: topic.platformText || "",
    contentType: firstAvailable(topic.contentType, task.topic?.contentType, task.planSlot?.contentType, ""),
    planSlot: planSlot ? {
      day: planSlot.day,
      platform: planSlot.platform,
      format: planSlot.format,
      theme: planSlot.theme,
      whyPlatform: planSlot.whyPlatform,
      whyTiming: planSlot.whyTiming,
    } : null,
    focus: task.focus || "",
    eventInfo: task.eventInfo || "",
    source: topic.source || "",
  };
  return base;
}

// 按 format 分发的可插拔 spec：图文/视频/朋友圈/社群各自的输出结构与约束。
// 阶段四细化图文/视频时只改这里对应分支，不动主流程。
function formatSpecFor(format, brief = {}) {
  const formatType = format === "moments_image" ? "moments_text" : format;
  const spec = {
    formatType,
    formatLabel: formatLabels[format] || format,
    requiredShape: { material: materialShapeForFormat(format) },
    constraints: [`material.type 必须是 ${formatType}`],
  };
  if (formatType === "video") {
    const isShowcase = SHOWCASE_CATEGORY_IDS.has(String(brief.contentType || ""));
    spec.constraints.push(
      "每个镜头分三部分：narration=口播逐字稿(教练能直接照着念的口语原话)，visual=画面/动作(拍什么)，onScreenText=字幕(精简大字，不等于口播全文)。",
      "hook 是前 3 秒钩子：第一句口播(narration) + 第一个画面(visual) + 字幕(onScreenText)，要有明确钩子打法(痛点提问/反常识/冲突)，让人停下来。",
      "durationHint 给目标时长(如 30-45s)，口播总字数要和时长匹配(约每秒 4-5 字)，不要写念不完或太空的脚本。",
      "结尾镜头要有 CTA 口播(轻引导、不硬广)；publishCopy 是发布文案；shootingList 拍摄清单、editingNotes 轻量剪辑提示。",
      "内容要覆盖 brief 的 keyPoints、回答 parentQuestion、符合 contentGoal；不承诺效果/升学、不夸张、不编造案例。",
    );
    if (isShowcase) {
      spec.constraints.push(
        "本选题是真实展示类(实拍记录型)：以 visual 真实镜头为主，narration 简短(现场感/轻旁白即可)，不要长篇口播、不摆拍腔；真实记录，涉及学员需注明家长授权。",
        "script 围绕真实场景的关键画面推进，4-6 个镜头即可。",
      );
    } else {
      spec.constraints.push(
        "本选题是科普/观点类(口播讲解型)：以教练出镜口播为主、训练画面作 B-roll；narration 要充实完整、把一个认知讲透、逻辑连贯(钩子→展开→可信支撑→引导)。",
        "script 建议 6-8 个镜头，信息密度高，每镜服务一个内容目的。",
      );
    }
  } else if (formatType === "xhs_image") {
    const isShowcase = SHOWCASE_CATEGORY_IDS.has(String(brief.contentType || ""));
    spec.constraints.push(
      "小红书图文：titles 给 3-5 个备选标题；tags 不要带 # 号，3-6 个、含本地/品类/场景词；body 是搭配发布的一整段正文（辅助），主内容放在图上。",
      "cover 是封面文案：headline 为封面大字强钩子（决定点击），subline 为副文案/痛点补充；不要写成排版/字体说明，只写文字内容。",
    );
    if (isShowcase) {
      spec.constraints.push(
        "本选题是真实展示类：配图就是真实实拍图，不是文字排版图。请填 shotList：每项 shot=这张图拍什么（实拍建议），caption=图上简短文字（一句内）；不要堆砌长段文字。",
        "shotList 建议 4-8 项，覆盖真实场景的关键画面；cover 简洁即可。",
        "不要输出 imageContents。",
      );
      // 真实展示类只要 shotList，删掉 imageContents 以免模型误填。
      delete spec.requiredShape.material.imageContents;
    } else {
      spec.constraints.push(
        "本选题是科普/观点类：小红书「图片即内容」，主内容写在每张图上。请填 imageContents：每项 heading=这张图的小标题，lines=该图要讲清的要点（2-4 条，信息密度高、具体可信、不空泛）。",
        "imageContents 建议 4-8 张图，每张只讲透一个点，整体覆盖 brief 的 keyPoints；cover.headline 要强钩子。",
        "不要输出 shotList。",
      );
      // 科普/观点类只要 imageContents，删掉 shotList 以免模型误填。
      delete spec.requiredShape.material.shotList;
    }
  } else if (formatType === "moments_text") {
    spec.constraints.push(
      "朋友圈：熟人私域、更口语，轻提醒轻转化；versions 建议 3 个不同语气版本。",
    );
  } else if (formatType === "community") {
    spec.constraints.push(
      "社群：群内互动、答疑、活动提醒；faqReplies 给常见问题的可复用回复。",
    );
  }
  return spec;
}

function topicContentMessages(profile, task, topic, format, fallbackMaterial) {
  const brief = buildContentBrief(profile, topic, task);
  const spec = formatSpecFor(format, brief);
  return [
    {
      role: "system",
      content: [
        "你是网球场内容运营写手，为单个选题生成可直接使用的发布物料。",
        "必须基于球场档案、内容 brief 和（如有）排期平台要求写作。",
        "语气真实、克制、专业但不端着；不编造价格、开放时间、学员案例、爆满现场或效果承诺。",
        "输出必须是严格 JSON，不要 Markdown，不要解释。",
        "只返回一个 material 对象。",
      ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify({
        taskType: "topic_content_material",
        venueProfile: {
          name: profile.name,
          shortName: profile.shortName,
          city: profile.city,
          location: profile.location,
          stage: stageLabels[profile.stage] || profile.stage,
          positioning: profile.positioning,
          services: profile.services,
          audiences: profile.audiences,
          tone: profile.tone,
          booking: profile.booking,
          wechat: profile.wechat,
          avoid: profile.avoid,
        },
        brief,
        contentRequest: {
          format,
          formatLabel: spec.formatLabel,
        },
        referenceStructure: (topic.source === "reference" && Array.isArray(topic.structure)) ? topic.structure : null,
        requiredShape: spec.requiredShape,
        constraints: [
          ...spec.constraints,
          brief.planSlot ? `这是 ${brief.planSlot.day} 排期，平台 ${brief.planSlot.platform}，请按该平台调整表达。` : "未提供排期，按选题默认平台习惯写。",
          brief.parentQuestion ? `这条选题要回答家长的问题：「${brief.parentQuestion}」，全文围绕家长视角，不要写成成人自练或球友角度。` : null,
          brief.contentGoal ? `内容目标是「${brief.contentGoal}」，表达克制、不承诺效果或升学、不贴阶层标签。` : null,
          topic.source === "reference" ? "本选题来自参考改写：信息顺序对齐 referenceStructure，但文案必须 100% 本地化，禁止复用参考原文、对方品牌名或未经证实的数据。" : null,
        ].filter(Boolean),
        localExample: fallbackMaterial,
      }),
    },
  ];
}

// 定向修订：把当前物料 + 用户自然语言指令喂回模型，只改需要改的部分。
function contentRefineMessages(profile, task, topic, format, currentMaterial, instruction, fallbackMaterial) {
  const brief = buildContentBrief(profile, topic, task);
  const spec = formatSpecFor(format, brief);
  return [
    {
      role: "system",
      content: [
        "你是网球场内容运营写手，正在按用户的修改指令对一份已生成的物料做定向修订。",
        "只按指令改动需要改的部分，其余内容尽量保留；保持完全相同的 JSON 结构。",
        "不编造价格、开放时间、学员案例、爆满现场或效果承诺；语气真实克制。",
        "输出必须是严格 JSON，不要 Markdown，不要解释。只返回一个 material 对象。",
      ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify({
        taskType: "topic_content_refine",
        venueProfile: {
          name: profile.name,
          shortName: profile.shortName,
          stage: stageLabels[profile.stage] || profile.stage,
          positioning: profile.positioning,
          tone: profile.tone,
          avoid: profile.avoid,
        },
        brief,
        instruction: String(instruction || "").slice(0, 400),
        currentMaterial,
        requiredShape: spec.requiredShape,
        constraints: [
          ...spec.constraints,
          "严格遵循用户 instruction；指令没提到的字段保持原样或仅做必要润色，不要整篇重写。",
        ],
        localExample: fallbackMaterial,
      }),
    },
  ];
}

function normalizeMaterial(raw, format, fallback) {
  const formatType = format === "moments_image" ? "moments_text" : format;
  const input = raw?.material || raw || {};

  if (formatType === "video") {
    const rawHook = input.hook;
    const fbHook = fallback.hook || {};
    // 兼容旧数据：hook 可能是字符串。
    const hook = typeof rawHook === "string"
      ? { narration: rawHook, visual: firstAvailable(fbHook.visual, ""), onScreenText: firstAvailable(fbHook.onScreenText, "") }
      : {
        narration: firstAvailable(rawHook?.narration, fbHook.narration, ""),
        visual: firstAvailable(rawHook?.visual, fbHook.visual, ""),
        onScreenText: firstAvailable(rawHook?.onScreenText, fbHook.onScreenText, ""),
      };
    return {
      type: "video",
      title: firstAvailable(input.title, fallback.title),
      durationHint: firstAvailable(input.durationHint, fallback.durationHint, "30-45s"),
      coverText: firstAvailable(input.coverText, fallback.coverText),
      hook,
      script: Array.isArray(input.script) && input.script.length
        ? input.script.map((shot, index) => ({
          id: index + 1,
          time: firstAvailable(shot.time, fallback.script?.[index]?.time, `${index * 5}-${index * 5 + 5}s`),
          visual: firstAvailable(shot.visual, fallback.script?.[index]?.visual, "场地真实画面"),
          // 兼容旧数据：无 narration 时用旧 subtitle 兜口播。
          narration: firstAvailable(shot.narration, shot.subtitle, fallback.script?.[index]?.narration, ""),
          onScreenText: firstAvailable(shot.onScreenText, shot.subtitle, fallback.script?.[index]?.onScreenText, ""),
          intent: firstAvailable(shot.intent, fallback.script?.[index]?.intent, "推进内容"),
        }))
        : fallback.script,
      shootingList: Array.isArray(input.shootingList) && input.shootingList.length ? input.shootingList : fallback.shootingList,
      editingNotes: Array.isArray(input.editingNotes) && input.editingNotes.length ? input.editingNotes : fallback.editingNotes,
      publishCopy: firstAvailable(input.publishCopy, fallback.publishCopy),
    };
  }

  if (formatType === "xhs_image") {
    const fbCover = fallback.cover || {};
    const cover = {
      headline: firstAvailable(input.cover?.headline, input.coverText, fbCover.headline, (Array.isArray(input.titles) && input.titles[0]) || fallback.titles?.[0]),
      subline: firstAvailable(input.cover?.subline, fbCover.subline, ""),
    };
    let imageContents = Array.isArray(input.imageContents) && input.imageContents.length
      ? input.imageContents.map((item) => ({
        heading: firstAvailable(item.heading, item.title, ""),
        lines: Array.isArray(item.lines) ? item.lines.filter(Boolean) : (item.line ? [item.line] : []),
      })).filter((item) => item.heading || item.lines.length)
      : [];
    // 兼容旧数据：模型若仍返回扁平 imageTexts，映射进 imageContents。
    if (!imageContents.length && Array.isArray(input.imageTexts) && input.imageTexts.length) {
      imageContents = input.imageTexts.map((text) => ({ heading: "", lines: [String(text)] }));
    }
    let shotList = Array.isArray(input.shotList) && input.shotList.length
      ? input.shotList.map((item) => ({
        shot: firstAvailable(item.shot, item.visual, ""),
        caption: firstAvailable(item.caption, item.text, ""),
      })).filter((item) => item.shot || item.caption)
      : [];
    // 两个都空时回退到本地兜底里非空的那一个，避免渲染空白。
    if (!imageContents.length && !shotList.length) {
      imageContents = Array.isArray(fallback.imageContents) ? fallback.imageContents : [];
      shotList = Array.isArray(fallback.shotList) ? fallback.shotList : [];
    }
    return {
      type: "xhs_image",
      titles: Array.isArray(input.titles) && input.titles.length ? input.titles : fallback.titles,
      cover,
      imageContents,
      shotList,
      body: firstAvailable(input.body, fallback.body),
      tags: Array.isArray(input.tags) && input.tags.length ? input.tags.map((tag) => String(tag).replace(/^#/, "")) : fallback.tags,
      commentGuide: firstAvailable(input.commentGuide, fallback.commentGuide),
    };
  }

  if (formatType === "moments_text") {
    return {
      type: "moments_text",
      versions: Array.isArray(input.versions) && input.versions.length
        ? input.versions.map((version, index) => ({
          label: firstAvailable(version.label, fallback.versions?.[index]?.label, `版本${index + 1}`),
          text: firstAvailable(version.text, fallback.versions?.[index]?.text, ""),
        }))
        : fallback.versions,
      imageTexts: Array.isArray(input.imageTexts) && input.imageTexts.length ? input.imageTexts : fallback.imageTexts,
    };
  }

  if (formatType === "community") {
    return {
      type: "community",
      dailyTopic: firstAvailable(input.dailyTopic, fallback.dailyTopic),
      announcement: firstAvailable(input.announcement, fallback.announcement),
      interaction: firstAvailable(input.interaction, fallback.interaction),
      eventReminder: firstAvailable(input.eventReminder, fallback.eventReminder),
      coldStart: firstAvailable(input.coldStart, fallback.coldStart),
      faqReplies: Array.isArray(input.faqReplies) && input.faqReplies.length ? input.faqReplies : fallback.faqReplies,
    };
  }

  return fallback;
}

function isValidMaterial(material, format) {
  const formatType = format === "moments_image" ? "moments_text" : format;
  if (!material || material.type !== formatType) return false;
  if (formatType === "video") {
    const scriptOk = Array.isArray(material.script) && material.script.length >= 2
      && material.script.every((shot) => shot.narration || shot.visual);
    const hookOk = Boolean(material.hook?.narration || material.hook?.visual);
    return scriptOk && hookOk && Boolean(material.publishCopy);
  }
  if (formatType === "xhs_image") {
    const hasTitles = Array.isArray(material.titles) && material.titles.length;
    const hasCover = Boolean(material.cover?.headline);
    const hasImages = (Array.isArray(material.imageContents) && material.imageContents.length)
      || (Array.isArray(material.shotList) && material.shotList.length);
    return hasTitles && Boolean(material.body) && hasCover && hasImages;
  }
  if (formatType === "moments_text") return Array.isArray(material.versions) && material.versions.length && material.versions[0]?.text;
  if (formatType === "community") return Boolean(material.announcement) && Boolean(material.dailyTopic);
  return false;
}

async function buildTopicContentWithAi(profile, task = {}) {
  const fallbackPack = buildTopicContent(profile, task);
  const formats = task.formats?.length ? task.formats : fallbackPack.materials.map((item) => item.type);
  const format = formats[0];
  if (!format) return fallbackPack;

  const settings = await loadAiSettings();
  const resolved = resolveAiProvider(settings);
  if (!resolved) {
    return { ...fallbackPack, aiMeta: buildLocalAiMeta(settings) };
  }

  const { provider, config } = resolved;
  const providerLabel = providerDefaults[provider]?.label || provider;
  const fallbackMaterial = fallbackPack.materials.find((item) => item.type === (format === "moments_image" ? "moments_text" : format))
    || buildMaterialByFormat(profile, fallbackPack.topic, format);

  try {
    const text = await callAiText(provider, config, topicContentMessages(profile, task, fallbackPack.topic, format, fallbackMaterial));
    const material = normalizeMaterial(extractJson(text), format, fallbackMaterial);
    if (!isValidMaterial(material, format)) throw new Error("AI 返回结构不完整");
    return {
      ...fallbackPack,
      materials: [material],
      aiMeta: { source: "ai", provider: providerLabel, model: config.model, format },
    };
  } catch (error) {
    return {
      ...fallbackPack,
      aiMeta: {
        source: "fallback",
        provider: providerLabel,
        model: config?.model || "",
        format,
        error: error.message || "AI 生成失败，已回退本地规则",
      },
    };
  }
}

async function buildContentRefineWithAi(profile, task = {}) {
  const fallbackPack = buildTopicContent(profile, task);
  const format = (task.formats?.length ? task.formats[0] : null) || task.format;
  const currentMaterial = task.currentMaterial;
  const instruction = String(task.instruction || "").trim();

  if (!format) return { ...fallbackPack, aiMeta: { source: "fallback", error: "缺少内容类型 format" } };
  if (!currentMaterial || !instruction) {
    return { ...fallbackPack, materials: currentMaterial ? [currentMaterial] : fallbackPack.materials, aiMeta: { source: "fallback", format, error: "缺少当前物料或修改指令" } };
  }

  const settings = await loadAiSettings();
  const resolved = resolveAiProvider(settings);
  if (!resolved) {
    return { ...fallbackPack, materials: [currentMaterial], aiMeta: { source: "local", reason: "未配置可用的 AI，无法定向修订，已保留原物料", format } };
  }

  const { provider, config } = resolved;
  const providerLabel = providerDefaults[provider]?.label || provider;

  try {
    const text = await callAiText(provider, config, contentRefineMessages(profile, task, fallbackPack.topic, format, currentMaterial, instruction, currentMaterial));
    const material = normalizeMaterial(extractJson(text), format, currentMaterial);
    if (!isValidMaterial(material, format)) throw new Error("AI 返回结构不完整");
    return {
      ...fallbackPack,
      materials: [material],
      aiMeta: { source: "ai", provider: providerLabel, model: config.model, format },
    };
  } catch (error) {
    return {
      ...fallbackPack,
      materials: [currentMaterial],
      aiMeta: {
        source: "fallback",
        provider: providerLabel,
        model: config?.model || "",
        format,
        error: error.message || "定向修订失败，已保留原物料",
      },
    };
  }
}

function buildTopicContent(profile, task = {}) {
  const sourceTopic = resolveTopicSource(task, profile);
  const topic = enrichTopic(sourceTopic, profile, task);
  const formats = task.formats?.length ? task.formats : topic.formats;
  const materials = [];

  if (formats.includes("video")) materials.push(buildMaterialByFormat(profile, topic, "video"));
  if (formats.includes("xhs_image")) materials.push(buildMaterialByFormat(profile, topic, "xhs_image"));
  if (formats.includes("moments_text") || formats.includes("moments_image")) materials.push(buildMaterialByFormat(profile, topic, "moments_text"));
  if (formats.includes("community")) materials.push(buildMaterialByFormat(profile, topic, "community"));

  return {
    topic,
    materials,
    execution: {
      materialNeed: topic.materials,
      publishAction: topic.suggestedCta || topic.cta,
      riskCheck: topic.risk,
      nextStep: "先确认事实信息和素材，再选择 1-2 个平台发布，不要同一天全平台发完全一样的文案。",
    },
  };
}

function buildCommunityPlan(profile, task = {}) {
  const weeklyPlan = task.plan?.week ? task.plan : buildOperationPlan(profile, task);
  const audience = audienceLabels[task.audience] || "群内成员";
  const mode = operatingModeLabels[inferOperatingMode(profile, task)] || "日常运营";
  const sourceDays = weeklyPlan.week?.length ? weeklyPlan.week : buildOperationPlan(profile, task).week;
  const communityDays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"].map((day, index) => {
    const source = sourceDays[index % sourceDays.length];
    return { ...source, day };
  });

  return {
    overview: {
      title: `${profile.shortName || profile.name}本周社群运营`,
      source: weeklyPlan.overview?.title || "一周运营计划",
      mode,
      audience,
      principle: "社群话题跟随一周计划主题，但表达更轻、更互动、更适合收集意向。",
    },
    week: communityDays.map((day) => {
      const topic = topicFromScheduleSlot(day, profile, task);
      return {
        day: day.day,
        sourceTopic: day.topicTitle,
        pillar: day.pillarLabel,
        goal: goalLabels[day.goal] || day.goal,
        groupTopic: `今天围绕「${day.topicTitle}」聊一下：${day.topicAngle || "大家最想先了解哪一部分？"}`,
        message: `今天同步一个和${profile.shortName || "球场"}有关的小主题：${day.topicTitle}。${day.topicAngle || topic.purpose}。有兴趣的朋友可以直接在群里回复，我这边会按实际信息继续补充。`,
        interaction: communityInteractionForTopic(topic),
        followUp: "群里收集回复，并私聊高意向用户；公域内容发布后的高频问题可以带回群里继续答疑。",
        risk: day.risk || topic.risk,
      };
    }),
    faq: [
      {
        question: "零基础可以来吗？",
        short: "可以，零基础可以先从轻量体验开始，不需要一上来就会打。",
        follow: "你是自己想体验，还是想给孩子了解？我可以按情况给你更具体的建议。",
      },
      {
        question: "怎么预约？",
        short: "预约方式以我们正式同步为准。你可以先把想来的时间段发我，我帮你记录意向。",
        follow: "大概是工作日晚上、周末白天，还是想先看看场地？",
      },
      {
        question: "一个人来可以吗？",
        short: "可以先了解，后续也会有社群约球和体验安排。",
        follow: "你更偏向找球友约打，还是想先上一次体验？",
      },
      {
        question: "孩子适合吗？",
        short: "可以先看孩子年龄、兴趣和身体状态，不建议用统一标准判断。",
        follow: "孩子多大了？之前有没有接触过球类运动？",
      },
    ],
    reminders: [
      "社群每天只做一个核心动作，不要连续刷屏。",
      "群里先互动，再通知，再私聊跟进高意向用户。",
      "活动期可以提高提醒频率；日常期以轻话题和答疑为主。",
      "没有确认的价格、时间、名额和规则，不要在群里写死。",
    ],
  };
}

function communityInteractionForTopic(topic) {
  const interactions = {
    opening: "可以回复：A 想看场地 B 想知道位置 C 想了解开放时间 D 想进群等通知",
    adult_beginner: "可以回复：A 不会打担心尴尬 B 不知道装备 C 想先体验 D 想找人一起打",
    junior: "可以回复：A 孩子年龄 B 是否零基础 C 想先体验 D 想了解上课安排",
    community: "可以回复：A 周末想约 B 工作日晚上 C 想找同水平球友 D 先观望",
    booking: "可以回复：A 想订场 B 想问价格 C 想看时间段 D 想了解规则",
    trust: "可以回复：A 想看流程 B 想问教练 C 想了解强度 D 想先体验",
  };
  return interactions[topic.goal] || "可以回复：A 想了解场地 B 想体验 C 想约球 D 想进群";
}

function requestPathname(req) {
  return new URL(req.url || "/", `http://${req.headers.host || "localhost"}`).pathname;
}

async function serveStatic(req, res) {
  const pathname = requestPathname(req);
  const requested = pathname === "/" ? "/index.html" : pathname;
  const safePath = path.normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(__dirname, safePath);

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    await access(filePath, constants.R_OK);
  } catch {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const ext = path.extname(filePath);
  res.writeHead(200, { "content-type": contentTypes[ext] || "application/octet-stream" });
  const stream = createReadStream(filePath);
  stream.on("error", () => {
    if (!res.headersSent) {
      res.writeHead(500);
      res.end("Internal error");
      return;
    }
    res.destroy();
  });
  stream.pipe(res);
}

const server = http.createServer(async (req, res) => {
  const pathname = requestPathname(req);

  try {
    if (req.method === "OPTIONS") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && pathname === "/api/health") {
      sendJson(res, 200, {
        ok: true,
        version: "0.2.0",
        features: ["operation-plan", "topic-library", "topic-directions", "topic-reference", "topic-content", "community-plan", "agent-topic-brief", "agent-direction-refine", "agent-route", "agent-plan-slot-refine"],
      });
      return;
    }

    if (req.method === "GET" && pathname === "/api/profile") {
      sendJson(res, 200, await loadProfile());
      return;
    }

    if (req.method === "POST" && pathname === "/api/profile") {
      const body = await readJson(req);
      await saveProfile(body.profile || {});
      sendJson(res, 200, { ok: true, profile: body.profile });
      return;
    }

    if (req.method === "GET" && pathname === "/api/ai-settings") {
      sendJson(res, 200, publicAiSettings(await loadAiSettings()));
      return;
    }

    if (req.method === "POST" && pathname === "/api/ai-settings") {
      const body = await readJson(req);
      const settings = await saveAiSettings(body.settings || {});
      sendJson(res, 200, { ok: true, settings: publicAiSettings(settings) });
      return;
    }

    if (req.method === "POST" && pathname === "/api/ai-test") {
      const body = await readJson(req);
      const saved = await loadAiSettings();
      const provider = body.provider || saved.activeProvider;
      const config = {
        ...(saved.providers[provider] || {}),
        ...(body.config || {}),
      };
      sendJson(res, 200, await testAiConnection(provider, config));
      return;
    }

    if (req.method === "POST" && pathname === "/api/operation-plan") {
      const body = await readJson(req);
      const profile = body.profile || await loadProfile();
      sendJson(res, 200, await buildOperationPlanWithAi(profile, body.task || {}));
      return;
    }

    if (req.method === "GET" && pathname === "/api/topic-library") {
      const profile = await loadProfile();
      sendJson(res, 200, await buildTopicLibraryView(profile, {}));
      return;
    }

    if (req.method === "POST" && pathname === "/api/topic-library") {
      const body = await readJson(req);
      const profile = body.profile || await loadProfile();
      const task = body.task || {};
      if (Array.isArray(body.entries)) {
        const library = await loadTopicLibrary();
        const entries = mergeTopicsIntoLibrary(library.entries || [], body.entries, profile, task);
        await saveTopicLibrary({ ...library, entries });
      }
      sendJson(res, 200, await buildTopicLibraryView(profile, task));
      return;
    }

    if ((req.method === "PATCH" || req.method === "DELETE") && pathname.startsWith("/api/topic-library/")) {
      const id = decodeURIComponent(pathname.slice("/api/topic-library/".length));
      const body = req.method === "PATCH" ? await readJson(req) : {};
      const profile = body.profile || await loadProfile();
      const task = body.task || {};
      if (req.method === "DELETE") {
        await deleteTopicEntry(id);
      } else {
        const updated = await updateTopicEntry(id, body.patch || {}, profile, task);
        if (!updated) {
          sendJson(res, 404, { error: "选题不存在" });
          return;
        }
      }
      sendJson(res, 200, await buildTopicLibraryView(profile, task));
      return;
    }

    if (req.method === "POST" && pathname === "/api/topic-reference/parse") {
      const body = await readJson(req);
      const profile = body.profile || await loadProfile();
      sendJson(res, 200, await buildReferenceDirectionsWithAi(profile, body.task || {}, body.reference || {}));
      return;
    }

    if (req.method === "POST" && (pathname === "/api/topic-directions" || pathname === "/api/topics")) {
      const body = await readJson(req);
      const profile = body.profile || await loadProfile();
      const task = { ...(body.task || {}), generationBrief: body.generationBrief || body.task?.generationBrief };
      sendJson(res, 200, await buildTopicDirectionsWithAi(profile, task));
      return;
    }

    if (req.method === "POST" && pathname === "/api/agent/topic-brief") {
      const body = await readJson(req);
      const profile = body.profile || await loadProfile();
      sendJson(res, 200, await buildAgentTopicBrief(profile, body.message || body.text || "", body.priorBrief || null));
      return;
    }

    if (req.method === "POST" && pathname === "/api/agent/direction-refine") {
      const body = await readJson(req);
      const profile = body.profile || await loadProfile();
      sendJson(res, 200, await buildDirectionRefine(profile, body.direction || {}, body.instruction || ""));
      return;
    }

    if (req.method === "POST" && pathname === "/api/agent/route") {
      const body = await readJson(req);
      const profile = body.profile || await loadProfile();
      sendJson(res, 200, await buildAgentRoute(profile, body.message || body.text || "", body.context || {}));
      return;
    }

    if (req.method === "POST" && pathname === "/api/agent/plan-slot-refine") {
      const body = await readJson(req);
      const profile = body.profile || await loadProfile();
      sendJson(res, 200, await buildPlanSlotRefine(profile, body.plan || {}, body.slotIndex, body.instruction || ""));
      return;
    }

    if (req.method === "POST" && pathname === "/api/topic-resolve") {
      const body = await readJson(req);
      const profile = body.profile || await loadProfile();
      sendJson(res, 200, { topic: buildTopicFromPlanSlot(profile, body.task || {}) });
      return;
    }

    if (req.method === "POST" && pathname === "/api/topic-content") {
      const body = await readJson(req);
      const profile = body.profile || await loadProfile();
      const result = await buildTopicContentWithAi(profile, body.task || {});
      await bumpTopicProduceCount(body.task?.topicId);
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "POST" && pathname === "/api/topic-content/refine") {
      const body = await readJson(req);
      const profile = body.profile || await loadProfile();
      const result = await buildContentRefineWithAi(profile, body.task || {});
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "POST" && pathname === "/api/content/shape-idea") {
      const body = await readJson(req);
      const profile = body.profile || await loadProfile();
      sendJson(res, 200, await buildIdeaTopicWithAi(profile, body.idea || body.message || ""));
      return;
    }

    if (req.method === "POST" && pathname === "/api/community-plan") {
      const body = await readJson(req);
      const profile = body.profile || await loadProfile();
      sendJson(res, 200, buildCommunityPlan(profile, body.task || {}));
      return;
    }

    if (req.method === "GET" && pathname === "/api/finished-content") {
      sendJson(res, 200, await loadFinishedContent());
      return;
    }

    if (req.method === "POST" && pathname === "/api/finished-content") {
      const body = await readJson(req);
      await upsertFinishedItem(body.item || {});
      sendJson(res, 200, await loadFinishedContent());
      return;
    }

    if (req.method === "DELETE" && pathname.startsWith("/api/finished-content/")) {
      const id = decodeURIComponent(pathname.slice("/api/finished-content/".length));
      await deleteFinishedItem(id);
      sendJson(res, 200, await loadFinishedContent());
      return;
    }

    if (req.method === "GET" && pathname === "/api/weekly-plan") {
      sendJson(res, 200, await loadWeeklyPlan());
      return;
    }

    if (req.method === "POST" && pathname === "/api/weekly-plan") {
      const body = await readJson(req);
      sendJson(res, 200, await saveWeeklyPlan(body.plan || null));
      return;
    }

    if (req.method === "DELETE" && pathname === "/api/weekly-plan") {
      await saveWeeklyPlan(null);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET") {
      await serveStatic(req, res);
      return;
    }

    sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Server error" });
  }
});

server.listen(port, host, () => {
  console.log(`Super Tennis Agent running at http://${host}:${port}`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Try PORT=5174 npm run dev`);
    return;
  }
  throw error;
});
