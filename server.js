import http from "node:http";
import https from "node:https";
import { access, constants, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 原子写 JSON：先写 .tmp，再 rename 覆盖目标文件。
// 避免进程在写到一半时被杀、崩溃、断电，导致目标 JSON 损坏（全 0 字节或半截）。
async function atomicWriteJson(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await rename(tmp, filePath);
}
const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 5173);

// 简单 token 鉴权：未设置 ACCESS_TOKEN 时不启用（保留本地开发体验）。
// 设置后，所有 /api/* 请求和首屏 HTML 都需要带 token。
// 团队成员首次访问时，输入 token，浏览器把它存 localStorage 自动带上。
// 也支持把 token 放在 URL ?token=xxx 里直接打开分享链接。
const accessToken = process.env.ACCESS_TOKEN || "";

function extractTokenFromRequest(req) {
  const auth = req.headers["authorization"];
  if (auth && /^Bearer\s+/i.test(auth)) {
    return auth.replace(/^Bearer\s+/i, "").trim();
  }
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    return url.searchParams.get("token") || "";
  } catch {
    return "";
  }
}

function unauthorized(res, pathname) {
  res.writeHead(401, {
    "content-type": "application/json; charset=utf-8",
    "www-authenticate": 'Bearer realm="tennis-agent"',
  });
  res.end(JSON.stringify({ error: "未授权：请输入访问令牌", authRequired: true, pathname }));
}
const profilePath = path.join(__dirname, "data", "venue-profile.json");
const aiSettingsPath = path.join(__dirname, "data", "ai-settings.local.json");
const topicLibraryPath = path.join(__dirname, "data", "topic-library.json");
const finishedContentPath = path.join(__dirname, "data", "finished-content.json");
const weeklyPlanPath = path.join(__dirname, "data", "weekly-plan.json");
const weeklyPlansPath = path.join(__dirname, "data", "weekly-plans.json");
const communityPlansPath = path.join(__dirname, "data", "community-plans.json");
const campaignPlansPath = path.join(__dirname, "data", "campaign-plans.json");
const agentMemoryPath = path.join(__dirname, "data", "agent-memory.local.json");
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

const xhsSensitiveReplacements = [
  ["加微信", "留言"],
  ["加我微信", "留言"],
  ["加VX", "留言"],
  ["加vx", "留言"],
  ["加 V", "留言"],
  ["加V", "留言"],
  ["私信我", "留言"],
  ["私聊我", "留言"],
  ["戳我", "留言"],
  ["私我", "留言"],
  ["进微信群", "参与交流"],
  ["进群", "参与交流"],
  ["微信群", "社群"],
  ["点击链接", "查看入口"],
  ["主页联系方式", "主页信息"],
  ["淘宝搜", "平台搜索"],
  ["全网第一", "口碑不错"],
  ["最受欢迎", "很多人会关注"],
  ["错过不再有", "可以先了解"],
  ["再不抢就没了", "感兴趣可以提前了解"],
  ["万人疯抢", "关注度较高"],
  ["限时特价", "阶段性安排"],
  ["全民免单", "体验安排"],
  ["点击有惊喜", "可以留言了解"],
  ["点击获取", "可以留言了解"],
  ["领取奖品", "了解活动信息"],
  ["无效退款", "具体规则以实际说明为准"],
  ["零风险", "先了解再决定"],
  ["国家推荐", "不少家庭会关注"],
  ["机关专供", "特定渠道"],
  ["中国驰名商标", "品牌认知度不错"],
  ["专家推荐", "教练视角建议"],
  ["医生推荐", "专业人士建议"],
  ["领导人推荐", "公开信息提到"],
  ["保本", "风险相对可控"],
  ["稳赚", "收益不确定"],
  ["无风险", "需自行判断风险"],
  ["高收益", "收益空间"],
  ["高回报", "回报空间"],
  ["投资必赚", "投资需谨慎"],
  ["被动收入", "长期收益"],
  ["祛斑", "淡化瑕疵"],
  ["美白", "提亮"],
  ["祛痘", "改善痘痘困扰"],
  ["抗衰", "关注状态维护"],
  ["消炎", "舒缓"],
  ["杀菌", "清洁"],
  ["修复", "改善"],
  ["医疗级", "专业感"],
  ["医美级", "精细护理"],
  ["药用", "护理"],
  ["根治", "改善"],
  ["治愈", "缓解"],
  ["防癌", "健康管理"],
  ["抗癌", "健康管理"],
  ["降压", "健康管理"],
  ["降糖", "健康管理"],
  ["减肥", "体态管理"],
  ["瘦身", "体态管理"],
  ["养胃", "饮食照顾"],
  ["增强免疫力", "帮助保持状态"],
  ["临床验证", "有相关依据"],
  ["无副作用", "体验因人而异"],
  ["药到病除", "逐步改善"],
  ["强效", "效果更明显"],
  ["速效", "反馈较快"],
  ["特效", "针对性较强"],
  ["秒杀", "活动价"],
  ["抢爆", "关注度较高"],
  ["抢疯了", "关注度较高"],
  ["点击领奖", "了解活动信息"],
  ["恭喜获奖", "活动通知"],
  ["一键三连", "欢迎互动"],
  ["保证", "尽量"],
  ["立竿见影", "逐步看到变化"],
  ["纯天然", "自然感"],
  ["超赚", "比较划算"],
  ["精准", "更有针对性"],
  ["vx", "留言"],
  ["VX", "留言"],
  ["微信", "官方渠道"],
  ["QQ", "留言"],
  ["私信", "留言"],
  ["私聊", "留言"],
  ["链接", "入口"],
  ["代购", "购买"],
  ["同号", "同名账号"],
  ["老地方见", "主页信息"],
  ["某宝", "平台"],
  ["某信", "官方渠道"],
  ["某音", "短视频平台"],
  ["绿色软件", "官方渠道"],
  ["招财", "好彩头"],
  ["旺运", "好彩头"],
  ["化解小人", "减少困扰"],
  ["逢凶化吉", "顺利一些"],
  ["护身", "陪伴感"],
  ["提升运势", "带来积极感受"],
  ["旺人旺财", "好彩头"],
  ["增强第六感", "增强感知"],
  ["时来运转", "状态变好"],
  ["万事亨通", "顺利"],
  ["区块链", "新技术"],
  ["虚拟货币", "数字资产"],
  ["NO.1", "口碑不错"],
  ["No.1", "口碑不错"],
  ["no.1", "口碑不错"],
  ["最佳", "比较合适"],
  ["最高", "较高"],
  ["最低", "较低"],
  ["最火", "关注度较高"],
  ["唯一", "比较特别"],
  ["顶级", "质感高级"],
  ["极致", "很细致"],
  ["完美", "完成度较高"],
  ["永久", "长期"],
  ["100%", "比较"],
  ["万能", "适用面较广"],
  ["零瑕疵", "细节不错"],
  ["彻底", "比较充分"],
  ["史无前例", "少见"],
  ["天花板", "水平不错"],
  ["鼻祖", "早期代表"],
  ["独家", "特色"],
  ["仅此一次", "阶段性"],
  ["国家级", "专业"],
  ["世界级", "专业"],
  ["国际级", "专业"],
  ["宇宙级", "专业"],
  ["特级", "高规格"],
  ["千万级", "规模较大"],
  ["领袖品牌", "品牌认知度不错"],
  ["遥遥领先", "表现突出"],
];

function xhsCompliancePolicy() {
  return {
    rule: "小红书图文与后续修改都要避开极限承诺、医疗功效、过度营销、导流、权威背书、玄学和金融收益承诺类表达。",
    avoidExamples: [
      "最/最佳/最高/最低/最火/全网第一/唯一/顶级/完美/100%/万能/根治/天花板/独家/国家级/世界级",
      "祛斑/美白/祛痘/抗衰/消炎/杀菌/医疗级/医美级/治愈/减肥/增强免疫力/无副作用/特效/速效",
      "秒杀/抢爆/再不抢就没了/限时特价/点击领奖/无效退款/零风险/保证/立竿见影/精准",
      "加 V/vx/微信/QQ/戳我/私我/私信/进群/链接/淘宝搜/老地方见/某信/某音",
      "国家推荐/专家推荐/医生推荐/招财/旺运/稳赚/保本/高收益/投资必赚/躺赚",
    ],
    replacements: [
      "把「最」类绝对表达改成「更」「比较」「不少人会」「很多家庭会关注」。",
      "把「保证/立竿见影」改成「可以先体验/先观察/以实际安排为准」。",
      "把「私信/加微信/进群」改成「留言说说孩子年龄和纠结点」「评论区交流」。",
      "涉及训练效果只说体验、参与状态、兴趣、节奏，不承诺成绩、升学、疗效或长期效果。",
    ],
  };
}

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
  content: 4,
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
  // 收紧 CORS：仅允许同源请求（请求带 Origin 时回显，否则不设）。
  // 浏览器同源请求不会带 Origin，非同源才会带 —— 这样既兼容本机浏览器调用，
  // 又避免被任意网页跨域调接口。
  const origin = currentRequest?.headers?.origin;
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
  };
  if (origin) headers["access-control-allow-origin"] = origin;
  res.writeHead(statusCode, headers);
  res.end(JSON.stringify(data, null, 2));
}

// 当前请求对象的快照，供 sendJson 读取 origin 用，避免给所有 42 个 sendJson 调用点加参数。
let currentRequest = null;

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
  await atomicWriteJson(profilePath, profile);
}

function defaultAgentMemory() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    operatingGoal: "",
    preferences: [],
    constraints: [],
    confirmedFacts: [],
    currentTask: {
      type: "",
      status: "idle",
      objective: "",
      missingInfo: [],
      nextActions: [],
    },
    recentResults: [],
  };
}

function normalizeStringList(value = [], limit = 12) {
  return (Array.isArray(value) ? value : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeAgentMemory(memory = {}) {
  const base = defaultAgentMemory();
  const currentTask = memory.currentTask && typeof memory.currentTask === "object" ? memory.currentTask : {};
  const recentResults = (Array.isArray(memory.recentResults) ? memory.recentResults : [])
    .map((item) => ({
      type: String(item?.type || "").trim(),
      title: String(item?.title || "").trim(),
      summary: String(item?.summary || "").trim(),
      createdAt: item?.createdAt || new Date().toISOString(),
    }))
    .filter((item) => item.type || item.title || item.summary)
    .slice(0, 8);

  return {
    ...base,
    ...memory,
    version: 1,
    updatedAt: memory.updatedAt || base.updatedAt,
    operatingGoal: String(memory.operatingGoal || "").trim(),
    preferences: normalizeStringList(memory.preferences, 16),
    constraints: normalizeStringList(memory.constraints, 16),
    confirmedFacts: normalizeStringList(memory.confirmedFacts, 20),
    currentTask: {
      type: String(currentTask.type || "").trim(),
      status: ["idle", "collecting", "running", "reviewing", "done"].includes(currentTask.status) ? currentTask.status : "idle",
      objective: String(currentTask.objective || "").trim(),
      missingInfo: normalizeStringList(currentTask.missingInfo, 8),
      nextActions: normalizeStringList(currentTask.nextActions, 8),
    },
    recentResults,
  };
}

async function loadAgentMemory() {
  try {
    const raw = await readFile(agentMemoryPath, "utf8");
    return normalizeAgentMemory(JSON.parse(raw));
  } catch (error) {
    if (error.code === "ENOENT") return defaultAgentMemory();
    throw error;
  }
}

async function saveAgentMemory(memory = {}) {
  const normalized = normalizeAgentMemory({
    ...memory,
    updatedAt: new Date().toISOString(),
  });
  await atomicWriteJson(agentMemoryPath, normalized);
  return normalized;
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

// 把 brief.contentType 解析成可用的硬锁类型；不可用(非法/本阶段未解锁)时返回 ""。
function resolveLockContentType(contentType, stagePolicy) {
  const lock = String(contentType || "").trim();
  if (!lock) return "";
  if (lock === "explainer") return "explainer";
  if (!SHOWCASE_CATEGORY_IDS.has(lock)) return "";
  const available = (stagePolicy?.availableShowcase || []).some((ct) => ct.id === lock);
  return available ? lock : "";
}

function lockContentTypeLabel(lock, stagePolicy) {
  if (lock === "explainer") return "观点讲解(explainer)";
  const ct = (stagePolicy?.availableShowcase || []).find((c) => c.id === lock);
  return ct ? `${ct.label}(${lock})` : lock;
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

// 题材 -> 形态亲和：动态/过程类天生适合视频，认知/资质类适合图文。
// 一周计划据此让形态跟着题材走（而非按平台配额硬塞），平台再跟随形态。
const VIDEO_FIRST_CONTENT_TYPES = new Set([
  "class_record",
  "student_growth",
  "venue_env",
  "behind_scene",
]);

function formatForContentType(contentType) {
  return VIDEO_FIRST_CONTENT_TYPES.has(String(contentType || "")) ? "video" : "xhs_image";
}

function platformForFormat(format) {
  return format === "video"
    ? { platform: "抖音/视频号", format: "短视频" }
    : { platform: "小红书", format: "图文" };
}

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
    campaignId: String(raw.campaignId || "").trim(),
    campaignTitle: String(raw.campaignTitle || "").trim(),
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
  await atomicWriteJson(topicLibraryPath, payload);
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
        campaignId: next.campaignId || existing.campaignId || "",
        campaignTitle: next.campaignTitle || existing.campaignTitle || "",
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
  const slotIndex = raw.slotIndex === null || raw.slotIndex === undefined || raw.slotIndex === ""
    ? null
    : Number(raw.slotIndex);
  return {
    id: makeFinishedId(raw),
    topicId: raw.topicId || "",
    topicTitle: raw.topicTitle || raw.title || "",
    format: raw.format || "",
    contentType: raw.contentType || "",
    category: raw.category || "",
    planId: raw.planId || "",
    planTitle: raw.planTitle || "",
    slotIndex: Number.isInteger(slotIndex) ? slotIndex : null,
    slotDay: raw.slotDay || "",
    slotPlatform: raw.slotPlatform || "",
    slotFormat: raw.slotFormat || "",
    slotTopicTitle: raw.slotTopicTitle || "",
    material: raw.material || null,
    brief: raw.brief || null,
    campaignId: raw.campaignId || "",
    campaignTitle: raw.campaignTitle || "",
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
  await atomicWriteJson(finishedContentPath, payload);
  return payload;
}

async function upsertFinishedItem(raw = {}) {
  const store = await loadFinishedContent();
  const next = normalizeFinishedItem(raw);
  const items = store.items || [];
  const index = items.findIndex((item) => item.id === next.id);
  const createdItem = index === -1;
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
  const saved = await saveFinishedContent({ ...store, items });
  return { ...saved, createdItem };
}

async function deleteFinishedItem(id) {
  const store = await loadFinishedContent();
  const items = (store.items || []).filter((item) => item.id !== id);
  await saveFinishedContent({ ...store, items });
  return true;
}

function makePlanId() {
  return `plan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function derivePlanLabel(plan = {}, createdAt = new Date().toISOString()) {
  const title = String(plan?.overview?.title || "一周计划").trim() || "一周计划";
  const d = new Date(createdAt);
  const stamp = Number.isNaN(d.getTime())
    ? ""
    : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return stamp ? `${title} · ${stamp}` : title;
}

async function readLegacyWeeklyPlan() {
  try {
    await access(weeklyPlanPath, constants.F_OK);
    const raw = JSON.parse(await readFile(weeklyPlanPath, "utf8"));
    if (!raw || !raw.plan) return null;
    return { updatedAt: raw.updatedAt || null, plan: raw.plan };
  } catch {
    return null;
  }
}

async function loadWeeklyPlans() {
  try {
    await access(weeklyPlansPath, constants.F_OK);
    const raw = JSON.parse(await readFile(weeklyPlansPath, "utf8"));
    const plans = Array.isArray(raw?.plans) ? raw.plans.filter((entry) => entry && entry.plan) : [];
    return { updatedAt: raw?.updatedAt || null, plans };
  } catch {
    // 首次：尝试迁移旧的单份 weekly-plan.json。
    const legacy = await readLegacyWeeklyPlan();
    if (legacy?.plan) {
      const createdAt = legacy.updatedAt || new Date().toISOString();
      const migrated = {
        updatedAt: createdAt,
        plans: [{
          id: makePlanId(),
          createdAt,
          label: derivePlanLabel(legacy.plan, createdAt),
          plan: legacy.plan,
        }],
      };
      try { await saveWeeklyPlans(migrated.plans); } catch { /* best effort */ }
      return migrated;
    }
    return { updatedAt: null, plans: [] };
  }
}

async function saveWeeklyPlans(plans) {
  await mkdir(path.dirname(weeklyPlansPath), { recursive: true });
  const payload = { updatedAt: new Date().toISOString(), plans: Array.isArray(plans) ? plans : [] };
  await atomicWriteJson(weeklyPlansPath, payload);
  return payload;
}

async function createWeeklyPlanEntry(plan) {
  const { plans } = await loadWeeklyPlans();
  const createdAt = new Date().toISOString();
  const entry = { id: makePlanId(), createdAt, label: derivePlanLabel(plan, createdAt), plan: plan || null };
  const next = [entry, ...plans];
  await saveWeeklyPlans(next);
  return { entry, plans: next };
}

async function updateWeeklyPlanEntry(id, plan) {
  const { plans } = await loadWeeklyPlans();
  let updated = null;
  const next = plans.map((entry) => {
    if (entry.id !== id) return entry;
    updated = { ...entry, plan: plan || entry.plan };
    return updated;
  });
  if (!updated) return { entry: null, plans };
  await saveWeeklyPlans(next);
  return { entry: updated, plans: next };
}

async function deleteWeeklyPlanEntry(id) {
  const { plans } = await loadWeeklyPlans();
  const next = plans.filter((entry) => entry.id !== id);
  await saveWeeklyPlans(next);
  return { plans: next };
}

function makeCommunityPlanId() {
  return `cmty-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function deriveCommunityLabel(plan = {}, createdAt = new Date().toISOString()) {
  const groupLabel = String(plan?.overview?.groupLabel || "社群方案").trim() || "社群方案";
  const d = new Date(createdAt);
  const stamp = Number.isNaN(d.getTime())
    ? ""
    : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return stamp ? `${groupLabel} · ${stamp}` : groupLabel;
}

async function loadCommunityPlans() {
  try {
    await access(communityPlansPath, constants.F_OK);
    const raw = JSON.parse(await readFile(communityPlansPath, "utf8"));
    const plans = Array.isArray(raw?.plans) ? raw.plans.filter((entry) => entry && entry.plan) : [];
    return { updatedAt: raw?.updatedAt || null, plans };
  } catch {
    return { updatedAt: null, plans: [] };
  }
}

async function saveCommunityPlans(plans) {
  await mkdir(path.dirname(communityPlansPath), { recursive: true });
  const payload = { updatedAt: new Date().toISOString(), plans: Array.isArray(plans) ? plans : [] };
  await atomicWriteJson(communityPlansPath, payload);
  return payload;
}

async function createCommunityPlanEntry({ plan, groupType, planId, planTitle } = {}) {
  const { plans } = await loadCommunityPlans();
  const createdAt = new Date().toISOString();
  const entry = {
    id: makeCommunityPlanId(),
    createdAt,
    label: deriveCommunityLabel(plan, createdAt),
    groupType: groupType || plan?.overview?.groupType || "prospect_parents",
    groupLabel: plan?.overview?.groupLabel || "",
    planId: planId || "",
    planTitle: planTitle || "",
    plan: plan || null,
  };
  const next = [entry, ...plans].slice(0, 100);
  await saveCommunityPlans(next);
  return { entry, plans: next };
}

async function deleteCommunityPlanEntry(id) {
  const { plans } = await loadCommunityPlans();
  const next = plans.filter((entry) => entry.id !== id);
  await saveCommunityPlans(next);
  return { plans: next };
}

function makeCampaignPlanId() {
  return `cmpn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function deriveCampaignLabel(plan = {}, createdAt = new Date().toISOString()) {
  const title = String(plan?.overview?.title || "活动方案").trim() || "活动方案";
  const d = new Date(createdAt);
  const stamp = Number.isNaN(d.getTime())
    ? ""
    : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return stamp ? `${title} · ${stamp}` : title;
}

async function loadCampaignPlans() {
  try {
    await access(campaignPlansPath, constants.F_OK);
    const raw = JSON.parse(await readFile(campaignPlansPath, "utf8"));
    const plans = Array.isArray(raw?.plans) ? raw.plans.filter((entry) => entry && entry.plan) : [];
    return { updatedAt: raw?.updatedAt || null, plans };
  } catch {
    return { updatedAt: null, plans: [] };
  }
}

async function saveCampaignPlans(plans) {
  await mkdir(path.dirname(campaignPlansPath), { recursive: true });
  const payload = { updatedAt: new Date().toISOString(), plans: Array.isArray(plans) ? plans : [] };
  await atomicWriteJson(campaignPlansPath, payload);
  return payload;
}

async function createCampaignPlanEntry({ plan, brief, planId, planTitle } = {}) {
  const { plans } = await loadCampaignPlans();
  const createdAt = new Date().toISOString();
  const entry = {
    id: makeCampaignPlanId(),
    createdAt,
    label: deriveCampaignLabel(plan, createdAt),
    brief: brief || "",
    typeLabel: plan?.overview?.typeLabel || "",
    planId: planId || "",
    planTitle: planTitle || "",
    plan: plan || null,
  };
  const next = [entry, ...plans].slice(0, 100);
  await saveCampaignPlans(next);
  return { entry, plans: next };
}

async function deleteCampaignPlanEntry(id) {
  const { plans } = await loadCampaignPlans();
  const next = plans.filter((entry) => entry.id !== id);
  await saveCampaignPlans(next);
  return { plans: next };
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
      campaignId: String(entry.campaignId || "").trim(),
      campaignTitle: String(entry.campaignTitle || "").trim(),
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
  await atomicWriteJson(aiSettingsPath, settings);
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

function firstAvailable(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function sanitizeXhsText(value) {
  let text = String(value ?? "");
  if (!text) return text;
  for (const [target, replacement] of xhsSensitiveReplacements) {
    text = text.split(target).join(replacement);
  }
  return text
    .replace(/最近/g, "这段时间")
    .replace(/最开始/g, "一开始")
    .replace(/最初/g, "一开始")
    .replace(/最终/g, "后来")
    .replace(/最后/g, "结尾")
    .replace(/最晚/g, "较晚")
    .replace(/最早/g, "较早")
    .replace(/最多/g, "较多")
    .replace(/最少/g, "较少")
    .replace(/最(好|适合|重要|容易|直接|快|高|低|划算|火|受欢迎|核心|关键|值得|应该|推荐|舒服|稳|安全|专业|有效|强|靠谱|真实|该|常|怕|想|担心|纠结|关心|在意|难|简单|合适|自然|像|有用|吸引人)/g, "更$1")
    .replace(/最/g, "更");
}

function sanitizeXhsValue(value) {
  if (typeof value === "string") return sanitizeXhsText(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeXhsValue(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeXhsValue(item)]));
  }
  return value;
}

function sanitizeXhsMaterial(material) {
  if (!material || material.type !== "xhs_image") return material;
  return sanitizeXhsValue(material);
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
  const brief = slot.topicBrief && typeof slot.topicBrief === "object" ? slot.topicBrief : {};
  return normalizeTopicRaw({
    ...base,
    id: slot.topicId || makeTopicId("plan", slot.topicTitle),
    title: slot.topicTitle || brief.title || base.title || "排期选题",
    goal: slot.goal || base.goal || inferPrimaryGoal(task),
    purpose: slot.topicAngle || brief.topicAngle || slot.reason || base.purpose || "完成本周排期内容",
    parentQuestion: slot.topicParentQuestion || brief.parentQuestion || base.parentQuestion || "",
    contentGoal: slot.topicContentGoal || brief.contentGoal || base.contentGoal || "",
    materials: slot.topicMaterials || slot.materialNeed || brief.materials || base.materials || ["场地空镜"],
    structure: slot.topicStructure || slot.topicKeyPoints || brief.keyPoints || slot.structure || base.structure || ["开场", "说明要点", "行动引导"],
    cta: slot.topicCta || brief.cta || slot.action || base.cta,
    risk: slot.topicRisk || brief.risk || slot.risk || base.risk || "未确认的信息不要写死",
    platforms: inferPlatformsFromLabel(slot.platform),
    formats: inferFormatsFromLabel(slot.platform, slot.format),
    contentType: slot.contentType || brief.contentType || base.contentType || "",
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

function agentRouteMessages(profile, message, framework, context = {}, history = []) {
  // 把历史对话作为额外的 messages 插入（system 之后、user 之前），让分类器看到上下文
  const historyMessages = (history || []).map((h) => ({
    role: h.role === "assistant" ? "assistant" : "user",
    content: String(h.text || "").slice(0, 400),
  }));
  return [
    {
      role: "system",
      content: [
        "你是少儿网球机构的「全局运营助手」，要把运营者的一句话分流到正确的能力，并在需要时直接给经营建议。",
        "可用能力（intent）：",
        "- plan：想要一周内容计划 / 排期 / 发布节奏。",
        "- topic：想要选题方向 / 拍什么 / 内容角度。",
        "- content：想把某个想法或某条已有选题做成具体内容（小红书图文 / 短视频脚本 / 朋友圈）。这时要解析出：contentIdea（要做成内容的一句话想法）、targetFormat（用户点名的形态，没点名留空）、libraryRef（用户若指『选题库里那条 / 第N条 / 关于XX的那条』，给出匹配关键词或序号，否则 null）。真正的内容会在主面板的内容工作台里生成。",
        "- campaign：想策划一个活动 / 活动方案 / 活动创意 / 体验课玩法 / 开业活动 / 亲子活动。真正的活动方案会在主面板生成。",
        "- chat：其他经营咨询或闲聊，不触发上面四个生成流程。",
        "判定 chat 时再细分 chatKind：",
        "- advice：与这家球场经营相关（招生、定价思路、活动点子、同城竞争、家长沟通、续费留存、运营节奏等）。这时你要以「懂这家球场的运营顾问」身份，结合 venueProfile 给具体、可落地的建议；如果建议天然能接回某个能力，就在 suggestedAction 里给出（如帮忙排一周计划或出几条选题）。",
        "- offtopic：与球场经营无关（写代码、查天气、通用闲聊等）。一句话礼貌收边，并把话题拉回经营，不要展开。",
        "硬约束：遵守 contentRules.forbiddenFraming 与 profile.avoid——不承诺提分/升学/效果，不贴阶层标签，不编造价格、开放时间、师生比、学员案例；涉及这些不确定信息时，说「这取决于你们实际安排」而不是替运营者编造。",
        "当 intent 是 plan 或 topic 时，顺便把这句话解析成 generationBrief 和 generationMode（balanced=日常养号 / focused=活动聚焦 / hybrid=活动+认知兼顾）；信息不足时用 clarify 列最多 3 个追问。",
        "reply 始终必填：chat 时是你的正式回答，其他 intent 时是一句过渡确认语。",
        "【上下文感知】用户最后一句话如果是「接着问 / 调整 / 评价 / 解释 / 继续 / 怎么看 / 为什么 / 怎么改 / 不太行 / 再来」等跟问性质的话，**必须读上面 history 来理解他在说什么**，不要因为新一句里没有 plan/topic/content/campaign 关键词就猜错。",
        "【chat 优先】只有当用户的最新一句话本身就是一个明确的新任务时（如「帮我排下周计划」「出 5 个选题」「策划一场开业活动」），才走 plan/topic/content/campaign。问「为什么」「怎么调」「谈谈」「这样行吗」「家长会问什么」这类 → 永远是 chat/advice。",
        "【非功能对话示例】这些是 chat 不是功能：「这个方案为什么不太好」「家长最关心什么」「价格怎么定合适」「我应该先做社群还是先做内容」「开业前一个月怎么安排」「如果效果不好怎么办」「你觉得呢」「为什么」",
        "输出必须是严格 JSON，不要 Markdown，不要解释。",
      ].join("\n"),
    },
    ...historyMessages,
    {
      role: "user",
      content: JSON.stringify({
        taskType: "agent_route",
        venueProfile: profileForPrompt(profile),
        contentRules: framework.contentRules || {},
        context: {
          currentResultType: context.currentResultType || null,
          activeView: context.activeView || "",
          route: context.route || null,
          memory: context.memory || null,
          weeklyPlan: context.weeklyPlan || null,
          topicDirections: context.topicDirections || null,
          contentWorkbench: context.contentWorkbench || null,
          campaignPlan: context.campaignPlan || null,
          communityPlan: context.communityPlan || null,
        },
        history: historyMessages.map((m) => ({ role: m.role, text: m.content })),
        userMessage: String(message || ""),
        requiredShape: {
          intent: "plan|topic|content|campaign|chat",
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
          contentIdea: "string（仅 intent=content 时，要做成内容的一句话；否则留空）",
          targetFormat: "xhs_image|video|moments_text|null（仅 intent=content 时；用户没点名形态就 null）",
          libraryRef: { match: "string（标题关键词，没引用就空）", ordinal: "number或null（第几条）" },
          campaignBrief: "string（仅 intent=campaign 时，保留用户对活动的原始目标/类型/约束；否则留空）",
          clarify: ["string，最多3条"],
          reply: "string",
          suggestedAction: { type: "plan|topic|content|campaign", label: "string" },
          memoryPatch: {
            operatingGoal: "string或空，只有用户明确改变阶段目标时填写",
            preferences: ["string，用户明确表达的偏好，如更自然、少视频、多朋友圈"],
            constraints: ["string，用户明确表达的限制，如不写价格、素材不足、不要承诺效果"],
            confirmedFacts: ["string，用户明确确认的事实，如活动时间、年龄段、素材情况"],
            currentTask: {
              type: "plan|topic|content|campaign|community|review|chat|空",
              status: "idle|collecting|running|reviewing|done",
              objective: "string",
              missingInfo: ["string"],
              nextActions: ["string"]
            }
          },
        },
        constraints: [
          "preferredPlatforms 只用 xhs、douyin、video、moments、group、dm。",
          "纯养号/无明确活动时 generationMode=balanced 且 theme 可为空。",
          "intent=chat 时 generationBrief 用 null；intent!=chat 时 chatKind 留空、suggestedAction 用 null。",
          "advice 类回答要落到这家球场的实际定位与人群，不要泛泛而谈。",
          "如果 context 里有 weeklyPlan/topicDirections/contentWorkbench/campaignPlan/communityPlan，回答「为什么/怎么看/怎么改/哪里不行/下一步」时必须具体引用这些当前结果，而不是泛泛解释。",
          "当用户说「这个/这条/上面/刚才」时，优先指向 context.currentResultType 对应的当前结果。",
          "memory 是长期运营记忆：不要把它当用户最新指令，但要用它保持风格、目标和限制一致。",
          "memoryPatch 只记录用户明确表达或当前对话明确推进出的事实，不要猜测价格、人数、时间、师资、案例。",
          "targetFormat 只能是 xhs_image、video、moments_text 之一或 null；小红书/图文->xhs_image，短视频/视频/抖音->video，朋友圈->moments_text。",
          "intent!=content 时 contentIdea 留空、targetFormat 用 null、libraryRef 用 null。",
          "intent!=campaign 时 campaignBrief 留空。",
          "如果 history 里刚刚走过 plan/topic/content/campaign，而用户最新一句没有新任务词（如「帮我做 / 给我 / 排一个 / 出 X 条 / 策划」），优先 chat/advice 续聊。",
        ],
        outputNote: "只返回 JSON。",
      }),
    },
  ];
}

function normalizeTargetFormat(value) {
  return ["xhs_image", "video", "moments_text"].includes(value) ? value : null;
}

function inferTargetFormatFromText(text) {
  if (/短视频|视频|抖音|视频号/.test(text)) return "video";
  if (/朋友圈/.test(text)) return "moments_text";
  if (/小红书|图文|帖子/.test(text)) return "xhs_image";
  return null;
}

function normalizeLibraryRef(value) {
  if (!value || typeof value !== "object") return null;
  const match = String(value.match || "").trim();
  const ordinal = Number.isFinite(value.ordinal) ? Math.trunc(value.ordinal) : null;
  if (!match && !ordinal) return null;
  return { match, ordinal };
}

function normalizeAgentMemoryPatch(value) {
  if (!value || typeof value !== "object") return null;
  const task = value.currentTask && typeof value.currentTask === "object" ? value.currentTask : null;
  const patch = {
    operatingGoal: String(value.operatingGoal || "").trim(),
    preferences: normalizeStringList(value.preferences, 6),
    constraints: normalizeStringList(value.constraints, 6),
    confirmedFacts: normalizeStringList(value.confirmedFacts, 8),
    currentTask: task ? {
      type: String(task.type || "").trim(),
      status: ["idle", "collecting", "running", "reviewing", "done"].includes(task.status) ? task.status : "idle",
      objective: String(task.objective || "").trim(),
      missingInfo: normalizeStringList(task.missingInfo, 5),
      nextActions: normalizeStringList(task.nextActions, 5),
    } : null,
  };
  const hasTask = patch.currentTask && (
    patch.currentTask.type
    || patch.currentTask.objective
    || patch.currentTask.missingInfo.length
    || patch.currentTask.nextActions.length
    || patch.currentTask.status !== "idle"
  );
  if (!patch.operatingGoal && !patch.preferences.length && !patch.constraints.length && !patch.confirmedFacts.length && !hasTask) {
    return null;
  }
  return patch;
}

function buildAgentRouteFallback(message) {
  const text = String(message || "");
  const planHit = /计划|排期|一周|周计划|发什么|怎么发|节奏|日程/.test(text);
  const topicHit = /选题|方向|题目|拍什么|内容角度|出几条|做几条/.test(text);
  const contentHit = /脚本|帖子|做成|生产内容|图文|短视频/.test(text) && /做成|生成|帮我写|脚本/.test(text);
  const campaignHit = /(策划|方案|活动点子|活动创意|活动玩法|活动主题|活动怎么做|做个活动|设计一个活动|办个活动)/.test(text)
    && /活动|体验课|开业|亲子|成人|新手|招生|报名|节假日|寒假|暑假|比赛|公开课/.test(text);
  const isEvent = /活动|营|开业|体验课|报名|招生|节|赛/.test(text);
  if (campaignHit) {
    return {
      intent: "campaign",
      chatKind: "",
      generationMode: "focused",
      generationBrief: null,
      campaignBrief: text.trim(),
      clarify: [],
      reply: "好的，这就帮你策划活动方案。",
      suggestedAction: null,
    };
  }
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
      contentIdea: text.trim(),
      targetFormat: inferTargetFormatFromText(text),
      libraryRef: null,
      clarify: [],
      reply: "好的，这就带你进内容生产。",
      suggestedAction: null,
    };
  }
  return {
    intent: "chat",
    chatKind: "advice",
    generationMode: "balanced",
    generationBrief: null,
    campaignBrief: "",
    clarify: [],
    reply: "我可以帮你排一周计划、生成选题方向，也能聊聊招生、活动、家长沟通这些经营问题。你想先从哪块开始？",
    suggestedAction: null,
  };
}

// 检测「明显是接着问 / 聊一聊」的用户输入——不触发功能意图，走 chat
// 命中条件任一：
//   1) 文本很短（≤18 字）且包含跟问性质词（为什么/怎么/能行/怎么样/调整/改/再/继续/再来/不太行/谈谈/说说/觉得/解释/讲讲/聊聊/然后呢/还有呢/下一步）
//   2) 文本以「那/那这个/那这条/这个/这条/它/它俩/这个方案/这个计划」等指代词开头（明显是接着上条说）
//   3) 文本中含「家长/价格/招生/续费/话术/同行/对比/经验/心得/问题/困难」等纯经营问题词（不是任务动词）
const FOLLOW_UP_PATTERNS = [
  /^(为什么|怎么|能行|怎么样|怎么调|怎么改|再|继续|再来|不太行|谈谈|说说|觉得|解释|讲讲|聊聊|然后呢|还有呢|下一步|好不好|行不行|值不值|可以么|对不对)/,
  /^(那|那这个|那这条|这个|这条|它|它俩|刚才|之前|上面|上面那个|这条方案|这个方案|这个计划|这条计划)/,
  /^(帮我|给我|再帮|再给)?\s*(调整|改|优化|改写|改一下|改短|改长)/,
  /^(效果|学员|家长|价格|续费|招生|话术|开学|开业前|开业后|活动后|活动前|寒暑假|周末|淡季|旺季).*(怎么办|怎么样|好不好|行不行|能行吗)/,
  /(我应该|要不要|该不该|先.{0,6}还是|还是先|怎么选)/,
];
const ADVICE_TOPIC_PATTERNS = /(家长|价格|定价|招生|续费|话术|同行|竞争|对比|经验|心得|困难|问题|挑战|踩过|复盘|反思|担心|焦虑|觉得|看法|建议|意见)/;
const TASK_VERB = /(帮我|给我|请|麻烦|能不能|可不可以|想让你|想请|排\s*一?个|排\s*下周|排\s*下个月|出\s*\d+\s*条|策划|生成|做一篇|写一篇|设计一个|做一条|出个|出几个|出个方案|给个|给一|帮我出)/;
function looksLikeFollowUp(message, history = []) {
  const text = String(message || "").trim();
  if (!text) return false;
  // 0) 有明确任务动词 → 不是跟问
  if (TASK_VERB.test(text)) return false;
  // 1) 跟问性质（前缀匹配）
  if (FOLLOW_UP_PATTERNS.some((re) => re.test(text))) return true;
  // 2) 包含「怎么/为什么/如何」且无任务动词 → 经营问题
  if (/(怎么|为什么|如何|怎样|啥样)/.test(text) && text.length <= 30) return true;
  // 3) 短问题 + 经营话题词
  if (text.length <= 22 && ADVICE_TOPIC_PATTERNS.test(text)) return true;
  // 4) 有历史 + 短问题 + 无任务动词
  if (history.length >= 1 && text.length <= 16 && !/(请|帮|生成|排|出\s*\d+|策划|做|写|设计)/.test(text)) return true;
  return false;
}

// 在历史已知时，给一个"接着聊"的中性回复（chat/advice）
// 不调 AI（避免在没 LLM 情况下阻塞），用模板回复。AI 路径仍会覆盖它。
function buildChatReplyFromHistory(message, history, profile) {
  const contextualHint = buildAgentContextualFallbackReply(message, history, profile);
  if (contextualHint) return contextualHint;
  return {
    intent: "chat",
    chatKind: "advice",
    generationMode: "balanced",
    generationBrief: null,
    campaignBrief: "",
    clarify: [],
    reply: "好的，我接着说——你想往哪个方向聊：是活动节奏、家长沟通、定价思路，还是继续把刚才那个方案调一下？",
    suggestedAction: null,
  };
}

function buildAgentContextualFallbackReply(message, history, profile, context = {}) {
  const text = String(message || "").trim();
  const resultType = context.currentResultType || "";
  const venueName = profile.shortName || profile.name || "球场";
  const make = (reply, suggestedAction = null) => ({
    intent: "chat",
    chatKind: "advice",
    generationMode: "balanced",
    generationBrief: null,
    campaignBrief: "",
    clarify: [],
    reply,
    suggestedAction,
  });

  if (!/(为什么|怎么|如何|哪里|不行|行不行|怎么看|下一步|建议|优化|调整|改)/.test(text)) {
    return null;
  }

  if (resultType === "weekly-plan" && context.weeklyPlan) {
    const slots = context.weeklyPlan.slots || [];
    const slotText = slots.slice(0, 3).map((slot) => `${slot.day}${slot.platform ? ` ${slot.platform}` : ""}${slot.topicTitle ? `「${slot.topicTitle}」` : ""}`).join("；");
    return make(
      `我会从节奏看这版计划：${slotText || "目前已有排期"}。更稳的检查方式是三件事：第一，前半周先解决家长认知，别一上来就强转化；第二，周末前安排可预约/可咨询的内容，让用户有下一步；第三，同一周不要所有内容都讲同一个点，要有场地、专业、体验门槛和行动入口。对${venueName}来说，如果当前阶段还在预热，最该避免的是写成已经满场、已有大量案例的成熟机构口吻。`,
      { type: "topic", label: "据此出选题" },
    );
  }

  if (resultType === "topic-directions" && context.topicDirections?.length) {
    const top = context.topicDirections.slice(0, 3).map((item) => `第${item.index}条「${item.title}」`).join("、");
    return make(
      `我会优先看这批选题能不能回答家长真实顾虑。${top} 里，好的选题应该同时满足：标题像家长会问的话、结构能拍出来、结尾有轻咨询动作。若你觉得“不够好”，通常不是再加卖点，而是把标题改得更具体，把「孩子/家长为什么在意」写出来，再删掉任何像效果承诺的表达。`,
      { type: "content", label: "挑一条做内容" },
    );
  }

  if (resultType === "content-material" && context.contentWorkbench) {
    const title = context.contentWorkbench.topicTitle || "当前选题";
    const angle = context.contentWorkbench.topicAngle || "";
    return make(
      `这条内容现在的核心是「${title}」${angle ? `，角度是「${angle}」` : ""}。优化时先别大改全篇，建议只动三处：开头第一句更像家长问题，中段加一个真实可拍的场地/教练细节，结尾从“报名”降到“私信了解/先记录意向”。如果你在主面板选中一段文字，我可以只替换那一段。`,
      null,
    );
  }

  if (resultType === "campaign-plan" && context.campaignPlan) {
    const title = context.campaignPlan.title || "当前活动";
    const coreIdea = context.campaignPlan.coreIdea || "";
    return make(
      `这个活动「${title}」要先看执行成本和转化路径。${coreIdea ? `核心想法是「${coreIdea}」。` : ""}我建议用三条线判断：用户为什么愿意来、现场有没有可拍可传播的瞬间、活动结束后怎么接到体验/社群/订场。对${venueName}来说，活动文案要轻一点，别把体验课写成训练成果承诺。`,
      { type: "topic", label: "据此出活动选题" },
    );
  }

  return null;
}

async function buildAgentRoute(profile, message, context = {}, history = []) {
  const framework = await loadAngleFramework();
  const settings = await loadAiSettings();
  const resolved = resolveAiProvider(settings);
  // 如果用户最后一句明显是「接着问」/「聊一聊」(不是新任务)，优先走 chat
  const followUpHint = looksLikeFollowUp(message, history);
  let result = followUpHint
    ? (buildAgentContextualFallbackReply(message, history, profile, context) || buildChatReplyFromHistory(message, history, profile))
    : buildAgentRouteFallback(message);
  let aiMeta = buildLocalAiMeta(settings);

  if (resolved) {
    const { provider, config } = resolved;
    const providerLabel = providerDefaults[provider]?.label || provider;
    try {
      const text = await callAiText(provider, config, agentRouteMessages(profile, message, framework, context, history));
      const data = extractJson(text);
      if (!data || typeof data !== "object") throw new Error("AI 返回结构不完整");
      const intent = ["plan", "topic", "content", "campaign", "chat"].includes(data.intent) ? data.intent : result.intent;
      const isChat = intent === "chat";
      const suggested = data.suggestedAction && ["plan", "topic", "content", "campaign"].includes(data.suggestedAction.type)
        ? { type: data.suggestedAction.type, label: String(data.suggestedAction.label || "").trim() || "去生成" }
        : null;
      const isContent = intent === "content";
      const isCampaign = intent === "campaign";
      result = {
        intent,
        chatKind: isChat ? (["advice", "offtopic"].includes(data.chatKind) ? data.chatKind : "advice") : "",
        generationMode: ["balanced", "focused", "hybrid"].includes(data.generationMode) ? data.generationMode : result.generationMode,
        generationBrief: (isChat || isCampaign) ? null : normalizeBrief(data.generationBrief),
        campaignBrief: isCampaign ? String(data.campaignBrief || message || "").trim() : "",
        contentIdea: isContent ? String(data.contentIdea || "").trim() : "",
        targetFormat: isContent ? normalizeTargetFormat(data.targetFormat) : null,
        libraryRef: isContent ? normalizeLibraryRef(data.libraryRef) : null,
        clarify: Array.isArray(data.clarify) ? data.clarify.map(String).slice(0, 3) : [],
        reply: String(data.reply || "").trim() || result.reply,
        suggestedAction: isChat ? suggested : null,
        memoryPatch: normalizeAgentMemoryPatch(data.memoryPatch),
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
  const rawContentType = String(brief.contentType || "").trim();
  const contentType = (rawContentType === "explainer" || SHOWCASE_CATEGORY_IDS.has(rawContentType)) ? rawContentType : "";
  if (!theme && !mustCover.length && !String(brief.primaryGoal || "").trim() && !contentType) return null;
  return {
    theme,
    primaryGoal: String(brief.primaryGoal || "").trim(),
    contentType,
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

function campaignTypeFromBrief(brief = "") {
  const text = String(brief || "");
  if (/开业|试营业|新店/.test(text)) return { id: "opening", label: "开业体验活动", audience: "附近少儿家长、成人新手和附近球友", goal: "建立第一批到场体验与私域咨询" };
  if (/亲子|家庭|家长孩子/.test(text)) return { id: "family", label: "亲子网球日", audience: "4-12 岁孩子及家长", goal: "降低家长观望成本，制造家庭共同体验" };
  if (/成人|新手|零基础|约球/.test(text)) return { id: "adult", label: "成人新手体验局", audience: "附近成人新手和轻运动人群", goal: "把兴趣用户转成第一次到场体验" };
  if (/暑假|寒假|节假日|周末|儿童节|国庆|五一/.test(text)) return { id: "seasonal", label: "节假日主题活动", audience: "有假期运动安排需求的家庭", goal: "用阶段性主题集中获取体验意向" };
  if (/招生|报名|体验课|公开课|少儿|孩子/.test(text)) return { id: "junior", label: "少儿体验课活动", audience: "正在比较兴趣班的少儿家长", goal: "让家长看清第一次体验的流程和边界" };
  return { id: "daily", label: "日常拉新活动", audience: "附近潜在用户和已咨询未到场用户", goal: "用低门槛活动激活咨询与到场" };
}

function normalizeCampaignList(value, fallback = []) {
  if (!Array.isArray(value)) return fallback;
  return value.map((item) => {
    if (typeof item === "string") return item.trim();
    if (!item || typeof item !== "object") return null;
    return item;
  }).filter(Boolean);
}

function buildCampaignFallback(profile, task = {}) {
  const brief = firstAvailable(task.campaignBrief, task.eventInfo, task.focus, "日常拉新活动");
  const type = campaignTypeFromBrief(brief);
  const venue = firstAvailable(profile.shortName, profile.name, "球场");
  const planThemes = normalizeCampaignList(task.planContext?.themes).slice(0, 3);
  const titleMap = {
    opening: `${venue}开业体验日`,
    family: `${venue}亲子网球日`,
    adult: `${venue}成人新手体验局`,
    seasonal: `${venue}假期网球体验日`,
    junior: `${venue}少儿网球体验课`,
    daily: `${venue}轻体验活动`,
  };
  const title = titleMap[type.id] || `${venue}体验活动`;
  const coreIdea = type.id === "opening"
    ? "先让用户真实看见场地、流程和咨询入口，用轻体验建立第一批到场关系。"
    : type.id === "family"
      ? "让孩子动起来、让家长看清流程，用亲子共同参与降低第一次尝试门槛。"
      : type.id === "adult"
        ? "把「不会打」转成「可以先试一次」，用友好分组和基础体验降低心理压力。"
        : "用一个清晰主题把关注、私信、到场体验串成一条短路径。";

  return {
    overview: {
      title,
      typeLabel: type.label,
      audience: type.audience,
      goal: type.goal,
      coreIdea,
      whyNow: planThemes.length ? `可承接本周内容主题：${planThemes.join("、")}。` : "适合在日常运营中制造一次明确的到场理由。",
    },
    conceptCards: [
      { title: "先看场地再体验", angle: "用场地动线、器材、教练介绍降低陌生感。", suitableFor: "开业/试营业/第一次曝光" },
      { title: "30分钟轻体验", angle: "不强调学会，只强调安全、好玩、知道自己适不适合。", suitableFor: "新手和少儿家长" },
      { title: "小范围邀请制", angle: "控制人数，便于服务和后续私聊跟进。", suitableFor: "私域和社群转化" },
    ],
    eventFlow: [
      { phase: "报名前", time: "活动前 3-5 天", action: "发布活动预告，收集姓名、年龄/水平、可到场时间。", notes: "不写未确认价格、名额和开放时间。" },
      { phase: "到场签到", time: "0-10 分钟", action: "确认人数，简单介绍场地和安全注意事项。", notes: "拍摄场地、器材、准备动作等真实素材。" },
      { phase: "体验环节", time: "10-40 分钟", action: "按年龄或水平做基础击球、移动和小游戏体验。", notes: "孩子以趣味为主，成人以低门槛为主。" },
      { phase: "答疑转化", time: "40-55 分钟", action: "讲清后续体验/预约方式，统一收集问题。", notes: "不承诺训练效果，只说明实际安排。" },
      { phase: "活动后跟进", time: "当天晚上", action: "私聊发送照片/反馈/下一步预约入口。", notes: "高意向单独跟进，普通意向进社群沉淀。" },
    ],
    offerDesign: [
      { name: "到场体验名额", value: "让用户先完成第一次到场，不把门槛设得太高。", constraint: "名额、时间、费用按实际安排填写。" },
      { name: "咨询福利", value: "到场后可获得一次课程/约球安排说明。", constraint: "不写夸张优惠和效果承诺。" },
    ],
    contentHooks: [
      { channel: "小红书", hook: `${title}适合什么人来？`, format: "图文/短视频" },
      { channel: "抖音/视频号", hook: "第一次来球场会经历什么？", format: "20-35s 展示类视频" },
      { channel: "朋友圈", hook: "这周我们想先邀请一小批朋友来体验", format: "轻邀请文字" },
      { channel: "社群", hook: "报名接龙 + 常见问题集中答疑", format: "群公告/互动问答" },
    ],
    conversionPath: [
      { step: "看到内容", action: "用户通过场地展示或活动预告知道活动。", message: "评论/私信关键词：体验" },
      { step: "进入私域", action: "确认年龄、水平、可到场时间。", message: "发活动须知和到场提醒" },
      { step: "到场体验", action: "完成一次真实体验和答疑。", message: "活动后私聊下一步安排" },
    ],
    preparation: [
      { item: "活动时间与人数上限", owner: "运营/负责人", deadline: "活动前 5 天" },
      { item: "报名表单或私聊登记话术", owner: "运营", deadline: "活动前 4 天" },
      { item: "现场拍摄清单", owner: "内容负责人", deadline: "活动前 2 天" },
      { item: "活动后跟进话术", owner: "私域运营", deadline: "活动当天" },
    ],
    riskNotes: [
      "不承诺孩子一定爱上网球、一定进步或升学加分。",
      "价格、名额、时间、开放范围必须按实际确认后再发布。",
      "涉及儿童照片和视频需获得家长同意。",
    ],
    nextActions: [
      "确认活动时间、人数上限和是否收费。",
      "把活动方案转成 3-5 条公域选题。",
      "为意向家长群准备报名接龙和答疑话术。",
    ],
  };
}

function campaignMessages(profile, task, fallbackPlan, framework) {
  return [
    {
      role: "system",
      content: [
        "你是网球场活动策划顾问。请为这家球场策划一个可执行的活动方案。",
        "活动策划可以有创意，但必须落到真实球场可执行：目标人群、活动主张、现场流程、报名转化、内容传播、准备清单。",
        "不要使用空泛口号，不要编造价格、开放时间、师资案例、学员反馈、升学或训练效果。",
        "输出必须是严格 JSON，不要 Markdown，不要解释。",
      ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify({
        taskType: "campaign_plan",
        venueProfile: profileForPrompt(profile),
        userBrief: task.campaignBrief || "",
        weeklyInput: {
          goal: goalLabels[task.goal] || task.goal || "",
          focus: task.focus || "",
          eventInfo: task.eventInfo || "",
        },
        currentWeeklyPlan: planSummaryForPrompt(task.plan),
        planContext: task.planContext || null,
        fallbackShapeExample: fallbackPlan,
        contentRules: framework.contentRules || {},
        requiredShape: {
          overview: {
            title: "string",
            typeLabel: "string",
            audience: "string",
            goal: "string",
            coreIdea: "string",
            whyNow: "string",
          },
          conceptCards: [{ title: "string", angle: "string", suitableFor: "string" }],
          eventFlow: [{ phase: "string", time: "string", action: "string", notes: "string" }],
          offerDesign: [{ name: "string", value: "string", constraint: "string" }],
          contentHooks: [{ channel: "string", hook: "string", format: "string" }],
          conversionPath: [{ step: "string", action: "string", message: "string" }],
          preparation: [{ item: "string", owner: "string", deadline: "string" }],
          riskNotes: ["string"],
          nextActions: ["string"],
        },
        constraints: [
          "活动规模默认小而可控；如用户没有提供预算/人数/时间，不要替他编造具体数字，可写成待确认。",
          "必须包含 3-5 个 contentHooks，覆盖小红书/短视频/朋友圈/社群中的至少 3 类。",
          "活动后续要能接到选题生成和一周计划，因此标题、coreIdea、contentHooks 必须具体。",
          "风险边界必须包含不承诺效果、不编造价格时间、儿童肖像授权。",
        ],
        outputNote: "只返回 JSON。",
      }),
    },
  ];
}

function normalizeCampaignPlan(input, fallback, aiMeta) {
  const data = input && typeof input === "object" ? input : {};
  const overview = data.overview && typeof data.overview === "object" ? data.overview : {};
  return {
    overview: {
      title: firstAvailable(overview.title, fallback.overview.title),
      typeLabel: firstAvailable(overview.typeLabel, fallback.overview.typeLabel),
      audience: firstAvailable(overview.audience, fallback.overview.audience),
      goal: firstAvailable(overview.goal, fallback.overview.goal),
      coreIdea: firstAvailable(overview.coreIdea, fallback.overview.coreIdea),
      whyNow: firstAvailable(overview.whyNow, fallback.overview.whyNow),
    },
    conceptCards: normalizeCampaignList(data.conceptCards, fallback.conceptCards).slice(0, 5),
    eventFlow: normalizeCampaignList(data.eventFlow, fallback.eventFlow).slice(0, 7),
    offerDesign: normalizeCampaignList(data.offerDesign, fallback.offerDesign).slice(0, 4),
    contentHooks: normalizeCampaignList(data.contentHooks, fallback.contentHooks).slice(0, 6),
    conversionPath: normalizeCampaignList(data.conversionPath, fallback.conversionPath).slice(0, 5),
    preparation: normalizeCampaignList(data.preparation, fallback.preparation).slice(0, 6),
    riskNotes: normalizeCampaignList(data.riskNotes, fallback.riskNotes).slice(0, 5),
    nextActions: normalizeCampaignList(data.nextActions, fallback.nextActions).slice(0, 5),
    aiMeta,
  };
}

async function buildCampaignPlanWithAi(profile, task = {}) {
  const fallbackPlan = buildCampaignFallback(profile, task);
  const settings = await loadAiSettings();
  const resolved = resolveAiProvider(settings);
  if (!resolved) {
    return normalizeCampaignPlan(fallbackPlan, fallbackPlan, buildLocalAiMeta(settings));
  }

  const { provider, config } = resolved;
  const providerLabel = providerDefaults[provider]?.label || provider;
  try {
    const framework = await loadAngleFramework();
    const text = await callAiText(provider, config, campaignMessages(profile, task, fallbackPlan, framework));
    const data = extractJson(text);
    const aiMeta = { source: "ai", provider: providerLabel, model: config.model };
    return normalizeCampaignPlan(data, fallbackPlan, aiMeta);
  } catch (error) {
    return normalizeCampaignPlan(fallbackPlan, fallbackPlan, {
      source: "fallback",
      provider: providerLabel,
      model: config?.model || "",
      error: error.message || "活动策划失败，已回退本地规则",
    });
  }
}

// ===== 活动方案 → 对外物料二次生成 =====
// 6 类非社媒对外物料：海报文字 / 短信话术 / 邀请文案 / 报名接龙 / 答疑 FAQ / 家长须知
const CAMPAIGN_MATERIAL_META = [
  {
    format: "campaign_poster",
    label: "海报文字",
    description: "朋友圈/电梯口/前台易拉宝：主标+副标+3-5 卖点+二维码引导位",
  },
  {
    format: "campaign_invite",
    label: "邀请文案",
    description: "一对一私聊 / 老学员朋友圈定向邀约文字",
  },
  {
    format: "campaign_signup",
    label: "报名接龙",
    description: "群内接龙模板 + 报名字段（姓名/年龄/到场时间/联系方式）",
  },
  {
    format: "campaign_faq",
    label: "答疑 FAQ",
    description: "5-8 条家长可能问的问题 + 回答，覆盖时间/费用/年龄/着装/天气等",
  },
  {
    format: "campaign_notice",
    label: "家长须知",
    description: "活动当天流程 + 注意事项 + 到场准备清单（可打印）",
  },
];

const CAMPAIGN_MATERIAL_FORMAT_SET = new Set(CAMPAIGN_MATERIAL_META.map((m) => m.format));

function campaignMaterialMeta(format) {
  return CAMPAIGN_MATERIAL_META.find((m) => m.format === format) || null;
}

// 每种物料的"骨架"：heading 是强制展示的标题，maxBody 是 body 软上限（用于裁剪 AI 跑题的输出）
// slotCount 表示 AI 应该返回几段。AI 多段 / 少段 / 改名都被后处理强制改回这个骨架。
const CAMPAIGN_MATERIAL_CANONICAL = {
  campaign_poster: {
    slotCount: 7,
    sections: [
      { heading: "主标题（≤12 字）",          maxBody: 12,  truncation: "hard" },
      { heading: "副标题 / Tagline（≤20 字）", maxBody: 20,  truncation: "soft" },
      { heading: "活动亮点（1-2 句说清这是什么活动）", maxBody: 60, truncation: "soft" },
      { heading: "时间 + 地点",                maxBody: 60,  truncation: "soft" },
      { heading: "3 条卖点（bullet）",        maxBody: 120, truncation: "soft" },
      { heading: "CTA + 二维码位",            maxBody: 80,  truncation: "soft" },
      { heading: "视觉建议",                  maxBody: 120, truncation: "soft" },
    ],
    titleSuffix: "· 海报文字（1080×1920 竖版）",
  },
  campaign_invite: {
    slotCount: 3,
    sections: [
      { heading: "开场（介绍自己）", maxBody: 60, truncation: "soft" },
      { heading: "活动亮点",         maxBody: 80, truncation: "soft" },
      { heading: "行动号召",         maxBody: 40, truncation: "soft" },
    ],
    titleSuffix: "· 邀请文案",
  },
  campaign_signup: {
    slotCount: 5,
    sections: [
      { heading: "群公告（开群先发）", maxBody: 200, truncation: "soft" },
      { heading: "报名字段",           maxBody: 120, truncation: "soft" },
      { heading: "地址占位",           maxBody: 60,  truncation: "soft" },
      { heading: "报名截止",           maxBody: 40,  truncation: "soft" },
      { heading: "客服",               maxBody: 30,  truncation: "soft" },
    ],
    titleSuffix: "· 报名接龙",
  },
  campaign_faq: {
    slotCount: 6,
    sections: [
      { heading: "Q1 时间",      maxBody: 60, truncation: "soft" },
      { heading: "Q2 年龄",      maxBody: 60, truncation: "soft" },
      { heading: "Q3 装备/着装", maxBody: 60, truncation: "soft" },
      { heading: "Q4 收费/福利", maxBody: 60, truncation: "soft" },
      { heading: "Q5 天气/改期", maxBody: 60, truncation: "soft" },
      { heading: "Q6 家长陪同",  maxBody: 60, truncation: "soft" },
    ],
    titleSuffix: "· 答疑 FAQ",
  },
  campaign_notice: {
    slotCount: 4,
    sections: [
      { heading: "时间",         maxBody: 60,  truncation: "soft" },
      { heading: "地点",         maxBody: 60,  truncation: "soft" },
      { heading: "到场流程",     maxBody: 200, truncation: "soft" },
      { heading: "注意事项",     maxBody: 200, truncation: "soft" },
    ],
    titleSuffix: "· 家长须知",
  },
};

// 后处理：把 AI 返回的 sections 强制改写为 canonical 骨架。
// - heading 全部替换为 canonical 标题（用户看到的是稳定的标题）
// - body 按 positional 取 AI 的前 N 段；不足则从 fallback 补；超出则合并到最后一槽
// - maxBody 截断（hard=硬截断；soft=只在超长 2 倍以上时截断 + 省略号）
// - title 强制按 canonical 重写（避免 AI 把标题写成 slogan）
// - sanity 检查：若 AI 在某槽位的内容与"应该是什么"明显不符（如视觉建议槽出现"扫码"），用 fallback 替换
function enforceCampaignMaterialStructure(format, aiMaterial, fallbackMaterial) {
  const canon = CAMPAIGN_MATERIAL_CANONICAL[format];
  if (!canon) {
    return {
      title: aiMaterial?.title || fallbackMaterial?.title || "",
      sections: (aiMaterial?.sections || fallbackMaterial?.sections || []).map((s) => ({ heading: s.heading || "", body: String(s.body || "").trim() })),
    };
  }
  const aiSections = Array.isArray(aiMaterial?.sections) ? aiMaterial.sections : [];
  const fbSections = Array.isArray(fallbackMaterial?.sections) ? fallbackMaterial.sections : [];

  // 按 positional 取 AI 的前 N 段
  const collapsed = [];
  for (let i = 0; i < canon.slotCount; i += 1) {
    collapsed.push(String(aiSections[i]?.body || "").trim());
  }
  // 多余的 AI 段全部合并进 slot 3（CTA + 二维码位），不污染 slot 4（视觉建议）
  if (aiSections.length > canon.slotCount) {
    const extra = aiSections.slice(canon.slotCount).map((s) => String(s?.body || "").trim()).filter(Boolean);
    if (extra.length) {
      const ctaSlot = 3; // CTA + 二维码位
      collapsed[ctaSlot] = collapsed[ctaSlot]
        ? collapsed[ctaSlot] + "\n" + extra.join("\n")
        : extra.join("\n");
    }
  }
  // 不足时用 fallback 补
  for (let i = 0; i < canon.slotCount; i += 1) {
    if (!collapsed[i] && fbSections[i]?.body) collapsed[i] = String(fbSections[i].body).trim();
  }
  // sanity：视觉建议槽（slot 6 of campaign_poster）必须有视觉相关关键词，否则用 fallback
  if (format === "campaign_poster") {
    const visualSlot = 6;
    const body = collapsed[visualSlot] || "";
    if (body && !/(背景|主色|字体|视觉|色块|版式|布局)/.test(body) && fbSections[visualSlot]?.body) {
      collapsed[visualSlot] = String(fbSections[visualSlot].body).trim();
    }
  }
  // sanity：CTA 槽（slot 5 of campaign_poster）应包含明确的"行动/扫码"关键词，否则用 fallback
  if (format === "campaign_poster" && collapsed[5]) {
    if (!/(扫码|私信|回复|二维码|联系)/.test(collapsed[5]) && fbSections[5]?.body) {
      collapsed[5] = String(fbSections[5].body).trim();
    }
  }
  // 卖点 slot（slot 4 of campaign_poster）：过滤 social-hook 风格的 bullet（问句/纯流程描述/无价值点），然后补到 3 条
  if (format === "campaign_poster" && collapsed[4]) {
    const isHookLike = (b) => {
      if (/[？?]/.test(b)) return true;
      if (/(适合什么|什么人来|会经历什么|邀请.*来体验|怎么报名|常见问题|答疑|报名接龙|朋友圈|社群|小红书|抖音|视频号|群公告)/.test(b)) return true;
      if (b.replace(/^[·\-\s]+/, "").length < 4) return true;
      return false;
    };
    const bullets = collapsed[4].split(/\n+/).map((l) => l.trim()).filter(Boolean).filter((b) => !isHookLike(b));
    if (bullets.length > 3) bullets.length = 3;
    if (bullets.length < 3 && fbSections[4]?.body) {
      const fbBullets = String(fbSections[4].body).split(/\n+/).map((l) => l.trim()).filter(Boolean).filter((b) => !isHookLike(b));
      for (const b of fbBullets) {
        if (bullets.length >= 3) break;
        if (!bullets.includes(b)) bullets.push(b);
      }
    }
    collapsed[4] = bullets.slice(0, 3).join("\n") || (fbSections[4]?.body || "");
  }
  // 活动亮点 slot（slot 2 of campaign_poster）：过滤运营/规划话术（"建立关系"/"拉新" 等），用 fallback
  if (format === "campaign_poster" && collapsed[2]) {
    const isOperational = (b) => /(建立.*关系|拉新|第一批到场|邀约|沉淀|留存|转化|私域|拉新引流|首单)/.test(b);
    if (isOperational(collapsed[2]) && fbSections[2]?.body) {
      collapsed[2] = String(fbSections[2].body).trim();
    }
  }
  // 副标 slot（slot 1 of campaign_poster）：含运营话术时也用 fallback
  if (format === "campaign_poster" && collapsed[1]) {
    if (/(建立.*关系|拉新|第一批到场|沉淀|留存|私域|拉新引流|首单)/.test(collapsed[1]) && fbSections[1]?.body) {
      collapsed[1] = String(fbSections[1].body).trim();
    }
  }
  // 时间 + 地点 slot（slot 3 of campaign_poster）：必须含时间/地点关键词，否则用 fallback
  if (format === "campaign_poster" && collapsed[3]) {
    if (!/(时间|地点|周|月|日|号|上午|下午|场|待|前\s*\d+\s*天|群公告|地址|交通|停车|区|路|街)/.test(collapsed[3]) && fbSections[3]?.body) {
      collapsed[3] = String(fbSections[3].body).trim();
    }
  }
  // 邀请文案 3 段：开场/亮点/行动 都过滤运营话术
  if (format === "campaign_invite") {
    const isOperational = (b) => /(建立.*关系|拉新|第一批到场|邀约|沉淀|留存|转化|私域|拉新引流|首单|先把时间地点发您|我把时间地点)/.test(b);
    [0, 1, 2].forEach((i) => {
      if (collapsed[i] && isOperational(collapsed[i]) && fbSections[i]?.body) {
        collapsed[i] = String(fbSections[i].body).trim();
      }
    });
  }

  // 按 maxBody 截断 + 应用 canonical heading
  const out = canon.sections.map((slot, i) => {
    let body = collapsed[i] || "";
    const limit = slot.maxBody;
    if (slot.truncation === "hard" && limit && body.length > limit) {
      body = body.slice(0, limit).trimEnd();
    } else if (slot.truncation === "soft" && limit && body.length > limit * 2) {
      body = body.slice(0, limit).trimEnd() + "…";
    }
    return { heading: slot.heading, body };
  });
  // 强制 title：使用 fallback 模板生成的 title（保证有"· 物料名"后缀）
  const baseTitle = (fallbackMaterial?.title || aiMaterial?.title || "")
    .replace(/\s*[·・]\s*(海报文字|短信话术|邀请文案|报名接龙|答疑\s*FAQ|家长须知).*$/, "")
    .trim();
  const title = baseTitle ? `${baseTitle} ${canon.titleSuffix}` : (fallbackMaterial?.title || aiMaterial?.title || "");
  return { title, sections: out };
}

function summarizeCampaignPlanForMaterials(plan = {}) {
  const overview = plan.overview || {};
  return {
    title: overview.title || "",
    typeLabel: overview.typeLabel || "",
    audience: overview.audience || "",
    goal: overview.goal || "",
    coreIdea: overview.coreIdea || "",
    whyNow: overview.whyNow || "",
    eventFlow: Array.isArray(plan.eventFlow) ? plan.eventFlow : [],
    offerDesign: Array.isArray(plan.offerDesign) ? plan.offerDesign : [],
    contentHooks: Array.isArray(plan.contentHooks) ? plan.contentHooks : [],
    conversionPath: Array.isArray(plan.conversionPath) ? plan.conversionPath : [],
  };
}

function localCampaignPoster(profile, summary) {
  const venue = firstAvailable(profile?.shortName, profile?.name, "球场");
  const title = summary.title || `${venue}体验活动`;
  const posterTitle = title.length > 12 ? title.slice(0, 12) : title;
  // 副标：≤20 字定位,直接用 clean default（不能用 coreIdea——那是规划/运营语言）
  const subtitle = "先来一次真实体验，再决定下一步".slice(0, 20);
  // 活动亮点：1-2 句说清「这是什么样的活动」(家长视角,不是规划话术)
  const typeLabel = summary.typeLabel || "体验活动";
  const audience = summary.audience || "4-12 岁孩子及成人新手";
  const highlightBody = `${venue} 真实场地、真实教练的${typeLabel}，30 分钟带${audience.replace(/\d+\s*-\s*\d+\s*岁.*/, "孩子").replace(/成人新手/, "新手")}完成一次击球、移动和小游戏体验。`;
  // 时间 + 地点：未确定写"活动前 2 天群公告通知"
  const timeBody = "· 时间：活动前 2 天群公告通知\n· 地点：活动前 2 天群公告通知";
  // 卖点：家长可读的硬信息（受众 + 类型 + 福利）
  const bullets = [];
  if (summary.audience) bullets.push(`面向：${summary.audience}`);
  if (summary.typeLabel) bullets.push(`类型：${summary.typeLabel}`);
  for (const o of (summary.offerDesign || []).slice(0, 3)) {
    if (o?.name) bullets.push(o.name);
    if (bullets.length >= 3) break;
  }
  if (bullets.length < 3) bullets.push("真实场地、真实教练");
  if (bullets.length < 3) bullets.push("30 分钟轻体验");
  if (bullets.length < 3) bullets.push("现场答疑，不强制报名");
  const highlights = bullets.slice(0, 3).map((b) => (b.startsWith("·") ? b : `· ${b}`)).join("\n");
  const cta = "· 扫码报名 / 私信回复「体验」";
  return {
    title: `${posterTitle} · 海报文字（1080×1920 竖版）`,
    sections: [
      { heading: "主标题（≤12 字）", body: posterTitle },
      { heading: "副标题 / Tagline（≤20 字）", body: subtitle },
      { heading: "活动亮点（1-2 句说清这是什么活动）", body: highlightBody },
      { heading: "时间 + 地点", body: timeBody },
      { heading: "3 条卖点（bullet）", body: highlights },
      { heading: "CTA + 二维码位", body: `${cta}\n（请把二维码放在此区域下方居中）` },
      { heading: "视觉建议", body: "背景：场地真实照片（教练与孩子互动 / 球场全景），主色用球场绿；字体：主标用粗体黑/白，副标用细体；信息层级：主标 > 亮点 > 时间地点 > 卖点 > CTA > 二维码。" },
    ],
  };
}

function localCampaignInvite(profile, summary) {
  const venue = firstAvailable(profile?.shortName, profile?.name, "球场");
  const title = summary.title || `${venue}体验活动`;
  // 活动亮点：从受众 + 核心动作 提炼「家长视角的一句话」,不用 coreIdea(那是规划语言)
  const highlights = [
    `${venue} 真实场地、真实教练`,
    `30 分钟轻体验，不用先报名`,
    `现场介绍后续课程，看完再决定`,
  ];
  // 开场：直接说"我们这边在做 + 想到您"——像私信给家长,不用"我是运营"这种角色描述
  return {
    title: `${title} · 邀请文案`,
    sections: [
      { heading: "开场（介绍自己）", body: `Hi，${venue} 这边最近在办「${title}」，想到您，就想邀您带孩子来玩一次。` },
      { heading: "活动亮点", body: `这次想让孩子真实感受一下：\n${highlights.map((h) => `· ${h}`).join("\n")}\n不强制报名课程，先来玩一次。` },
      { heading: "行动号召", body: `如果时间合适，回我一句「体验」我发地址和到场时间给您；不方便也没关系～` },
    ],
  };
}

function localCampaignSignup(profile, summary) {
  const venue = firstAvailable(profile?.shortName, profile?.name, "球场");
  const title = summary.title || `${venue}体验活动`;
  return {
    title: `${title} · 报名接龙`,
    sections: [
      { heading: "群公告（开群先发）", body: `【${title} · 报名接龙】先报先得，请按下面格式回复，方便我们私聊确认时间。` },
      { heading: "报名字段", body: "1. 孩子昵称 + 年龄\n2. 计划到场时间（上午场 / 下午场）\n3. 家长联系方式（电话或微信）" },
      { heading: "提醒", body: "· 报名后我们私聊发地址和注意事项\n· 名额有限，先到先得" },
      { heading: "地址占位", body: `（活动前 2 天在群公告补充：${venue} 具体地址 + 交通 + 停车）` },
      { heading: "报名截止", body: "（活动前 1 天 18:00）" },
      { heading: "客服", body: `任何问题群里 @运营，或私信 ${venue} 客服。` },
    ],
  };
}

function localCampaignFaq(profile, summary) {
  const venue = firstAvailable(profile?.shortName, profile?.name, "球场");
  const title = titleSafe(summary);
  return {
    title: `${title} · 答疑 FAQ`,
    sections: [
      { heading: "Q1 活动几点开始？", body: "时间以最终群公告为准，会提前 2 天通知，报名后单独私聊提醒。" },
      { heading: "Q2 适合多大的孩子？", body: "默认 4-12 岁分两组；成人新手请私聊另约时段。" },
      { heading: "Q3 需要自备球拍吗？", body: "不用，场地提供试用球拍和球。建议穿运动鞋和宽松衣物。" },
      { heading: "Q4 怎么收费？", body: `首次体验按 ${venue} 实际安排为准；体验当天会介绍后续课程与约球方式，不强制报名。` },
      { heading: "Q5 下雨天怎么办？", body: "室内场地不受影响；如极端天气会提前 1 天通知改期。" },
      { heading: "Q6 家长可以陪同吗？", body: "建议全程陪同，场地有家长休息区。" },
    ],
  };
}

function localCampaignNotice(profile, summary) {
  const venue = firstAvailable(profile?.shortName, profile?.name, "球场");
  const title = summary.title || `${venue}体验活动`;
  const flow = summary.eventFlow.slice(0, 6);
  const flowLines = flow.length
    ? flow.map((f, i) => `${i + 1}. ${f.phase || ""}：${f.action || ""}${f.time ? `（${f.time}）` : ""}`).join("\n")
    : "1. 签到 2. 安全须知 3. 体验 4. 答疑 5. 离场";
  return {
    title: `${title} · 家长须知`,
    sections: [
      { heading: "时间", body: "（活动前 2 天在群公告补充具体日期 + 上午场/下午场时段）" },
      { heading: "地点", body: `${venue}（详细地址 + 交通 + 停车 活动前 1 天在群公告补充）` },
      { heading: "到场流程", body: flowLines },
      { heading: "注意事项", body: "· 穿运动鞋、运动服\n· 不要带贵重物品\n· 现场听从教练安排\n· 拍摄含孩子的素材前会先征求家长同意" },
      { heading: "联系方式", body: `任何问题群里 @运营，或私信 ${venue} 客服。` },
    ],
  };
}

function titleSafe(summary) {
  return summary?.title || "活动";
}

const LOCAL_CAMPAIGN_MATERIAL_BUILDERS = {
  campaign_poster: localCampaignPoster,
  campaign_invite: localCampaignInvite,
  campaign_signup: localCampaignSignup,
  campaign_faq: localCampaignFaq,
  campaign_notice: localCampaignNotice,
};

function buildCampaignMaterialLocal(profile, summary, format) {
  const builder = LOCAL_CAMPAIGN_MATERIAL_BUILDERS[format];
  if (!builder) return null;
  return builder(profile, summary);
}

function buildCampaignMaterialsFallback(profile, summary, formats) {
  return formats.map((format) => {
    const meta = campaignMaterialMeta(format) || { format, label: format };
    const material = buildCampaignMaterialLocal(profile, summary, format) || { title: meta.label, sections: [] };
    return { format, label: meta.label, material };
  });
}

function campaignMaterialMessages(profile, summary, formats, fallbackMaterials) {
  // 每种 format 严格指定 sections 数量、heading 文本、body 字数上限。
  // 后处理会按这套骨架强制改写：所以即使 AI 跑题，最终结果仍会符合骨架。
  const formatRules = {
    campaign_poster: {
      slotCount: 7,
      titleHint: "<主标> · 海报文字（1080×1920 竖版）",
      sections: [
        { heading: "主标题（≤12 字）",                       bodyHint: "≤12 字醒目短语，沿用活动标题最关键的几个字。不要写长句。" },
        { heading: "副标题 / Tagline（≤20 字）",             bodyHint: "≤20 字一句话定位，例如「先来一次真实体验，再决定下一步」。**不要直接抄 coreIdea**（那是规划摘要）。" },
        { heading: "活动亮点（1-2 句说清这是什么活动）",    bodyHint: "1-2 句说清「这个活动是什么、为什么值得来」。**家长视角的描述**。不要写「建立关系」「拉新」「第一批到场」这种运营/规划话术。" },
        { heading: "时间 + 地点",                           bodyHint: "明确就写明确，未确定就写「活动前 2 天群公告通知」。两行 bullet。" },
        { heading: "3 条卖点（bullet）",                     bodyHint: "用 `· ` 开头的 3 条，每条 ≤ 18 字。**必须从受众(audience) + 类型(typeLabel) + 福利(offerDesign.name) 提炼家长可读的硬信息**。**严禁使用 contentHooks**——那是给小红书/抖音的社交钩子（问句/悬念）。" },
        { heading: "CTA + 二维码位",                        bodyHint: "「扫码报名 / 私信回复『体验』」+ 一行「（请把二维码放在此区域下方居中）」。" },
        { heading: "视觉建议",                              bodyHint: "1-2 句：背景/主色/字体建议。" },
      ],
    },
    campaign_invite: {
      slotCount: 3,
      sections: [
        { heading: "开场（介绍自己）", bodyHint: "≤60 字，**像私信给一个家长**。直接说「我们这边在做 + 想到您」,不要说「我是运营」「建立关系」「第一批到场」这种内部/规划话术。" },
        { heading: "活动亮点",         bodyHint: "≤80 字，**3 条 bullet**。家长视角的具体价值（场地/时长/动作/福利），不是抽象描述。" },
        { heading: "行动号召",         bodyHint: "≤40 字，**像跟朋友说话**。比如「回我一句『体验』我发地址给您；不方便也没关系～」。不要说「我把时间地点发您」「有名额」这种内部/销售口吻。" },
      ],
    },
    campaign_signup: {
      slotCount: 5,
      sections: [
        { heading: "群公告（开群先发）", bodyHint: "群公告开头话术，说明活动 + 接龙。" },
        { heading: "报名字段",           bodyHint: "编号 1./2./3. 列出报名字段（姓名、孩子年龄、到场时间、联系方式）。" },
        { heading: "地址占位",           bodyHint: "地址行占位；未确定写「活动前 2 天群公告通知」。" },
        { heading: "报名截止",           bodyHint: "报名截止时间占位。" },
        { heading: "客服",               bodyHint: "客服联系方式。" },
      ],
    },
    campaign_faq: {
      slotCount: 6,
      sections: [
        { heading: "Q1 时间",      bodyHint: "≤60 字 A。" },
        { heading: "Q2 年龄",      bodyHint: "≤60 字 A。" },
        { heading: "Q3 装备/着装", bodyHint: "≤60 字 A。" },
        { heading: "Q4 收费/福利", bodyHint: "≤60 字 A；不写具体价格。" },
        { heading: "Q5 天气/改期", bodyHint: "≤60 字 A。" },
        { heading: "Q6 家长陪同",  bodyHint: "≤60 字 A。" },
      ],
    },
    campaign_notice: {
      slotCount: 4,
      sections: [
        { heading: "时间",     bodyHint: "≤60 字；未确定写「活动前 2 天群公告通知」。" },
        { heading: "地点",     bodyHint: "≤60 字。" },
        { heading: "到场流程", bodyHint: "编号 1./2./3. 流程；信息不全时写「活动前 2 天群公告补充」。" },
        { heading: "注意事项", bodyHint: "用 `· ` 开头，3-5 条。" },
      ],
    },
  };

  const systemLines = [
    "你是网球场活动物料撰写助手。基于已有活动方案，针对家长 / 意向家长 / 社群成员生成可立即发布的对外物料文案。",
    "硬性约束：",
    "1) 每种物料的 sections 数量严格 = 指定的 slotCount；多写少写都会被后处理裁掉。",
    "2) 每段的 heading 文本必须按下面指定的写，不要改写、不要加副标题、不要合并段。",
    "3) 每段 body 用 \\n 表示换行，遵守字数上限。",
    "4) 不要编造价格、开放时间、师资案例、学员反馈、训练或升学效果。",
    "5) 海报要像海报：主标 + 副标 + 3 条 bullet 卖点 + CTA + 视觉建议。",
    "6) 短信正文必须 ≤70 字符（不含签名），后处理会硬截断。",
    "",
    "物料骨架（每种 format 一份）：",
  ];

  formats.forEach((f) => {
    const r = formatRules[f];
    if (!r) return;
    systemLines.push(`\n# ${f}  (slotCount=${r.slotCount})`);
    r.sections.forEach((s, i) => {
      systemLines.push(`  [${i + 1}] heading: "${s.heading}" — ${s.bodyHint}`);
    });
    if (r.titleHint) systemLines.push(`  title: 形如「${r.titleHint}」`);
  });

  systemLines.push("\n输出严格 JSON：{ items: [{ format, label, material: { title, sections: [{heading, body}] } }] }。不要 Markdown，不要解释。");

  return [
    { role: "system", content: systemLines.join("\n") },
    {
      role: "user",
      content: JSON.stringify({
        taskType: "campaign_materials",
        venueProfile: profileForPrompt(profile),
        campaign: summary,
        formats: formats.map((f) => {
          const meta = campaignMaterialMeta(f);
          const r = formatRules[f];
          return {
            format: f,
            label: meta?.label || f,
            description: meta?.description || "",
            slotCount: r?.slotCount,
            sections: r?.sections,
          };
        }),
        skeletonReference: fallbackMaterials,
        outputNote: "只返回 JSON。",
      }),
    },
  ];
}

function normalizeCampaignMaterialItem(raw, fallback) {
  const format = raw?.format || fallback?.format || "";
  const meta = campaignMaterialMeta(format);
  const label = raw?.label || meta?.label || fallback?.label || format;
  const rawMaterial = raw?.material && typeof raw.material === "object" ? raw.material : (fallback?.material || { title: label, sections: [] });
  // 强制结构：永远按 canonical 骨架输出（保证标题、段数、字数受控）
  const enforced = enforceCampaignMaterialStructure(format, rawMaterial, fallback?.material || null);
  return {
    format,
    label,
    material: {
      title: enforced.title || label,
      sections: enforced.sections.filter((s) => s.heading || s.body),
    },
  };
}

async function buildCampaignMaterialDraftsWithAi(profile, summary, formats) {
  const fallbackMaterials = buildCampaignMaterialsFallback(profile, summary, formats);
  const settings = await loadAiSettings();
  const resolved = resolveAiProvider(settings);
  if (!resolved) {
    return {
      materials: fallbackMaterials,
      aiMeta: { source: "fallback", provider: "local", model: "", error: "未配置 AI，提供本地模板" },
    };
  }
  const { provider, config } = resolved;
  const providerLabel = providerDefaults[provider]?.label || provider;
  try {
    const text = await callAiText(provider, config, campaignMaterialMessages(profile, summary, formats, fallbackMaterials));
    const data = extractJson(text);
    const list = Array.isArray(data?.items) ? data.items : [];
    const byFormat = new Map(list.map((it) => [it.format, it]));
    const materials = formats.map((format) => {
      const fallback = fallbackMaterials.find((m) => m.format === format);
      return normalizeCampaignMaterialItem(byFormat.get(format) || {}, fallback);
    });
    return { materials, aiMeta: { source: "ai", provider: providerLabel, model: config.model } };
  } catch (error) {
    return {
      materials: fallbackMaterials,
      aiMeta: { source: "fallback", provider: providerLabel, model: config?.model || "", error: error.message || "活动物料生成失败，已回退本地模板" },
    };
  }
}

function buildCampaignMaterialsRequest() {
  return {
    validate: (body = {}) => {
      const campaignId = String(body.campaignId || "").trim();
      const campaignTitle = String(body.campaignTitle || "").trim();
      const rawFormats = Array.isArray(body.formats) ? body.formats : [];
      const formats = [...new Set(rawFormats.filter((f) => CAMPAIGN_MATERIAL_FORMAT_SET.has(f)))];
      if (!campaignId) return { error: "缺少 campaignId" };
      if (!formats.length) return { error: "未选择任何物料类型" };
      return { campaignId, campaignTitle, formats };
    },
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
          brief?.contentType === "explainer"
            ? "本次内容方向已锁定为「观点讲解」：topQuestions/weeklyFocus 聚焦家长的认知与价值决策问题，不要把重点放在拍摄真实展示画面上。"
            : (brief?.contentType ? `本次内容方向已锁定为真实展示类「${brief.contentType}」：shootableAssets 与 weeklyFocus 都围绕这一类真实画面展开。` : null),
        ].filter(Boolean),
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

function angleMessages(profile, task, insight, framework, mode, brief, excludeTitles, stagePolicy = DEFAULT_STAGE_POLICY, lockContentType = "", want = 0) {
  const coverage = framework.modeCoverage?.[mode] || {};
  const lockLabel = lockContentType ? lockContentTypeLabel(lockContentType, stagePolicy) : "";
  // slot 路径方向已窄，少出 angles 留筛选余量。
  const angleCountText = want > 0 ? `${want + 2}-${want + 3} 条` : "6-10 条";
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
          `输出 ${angleCountText} angles。`,
          lockContentType === "explainer"
            ? `【硬锁】本批所有 angles 必须 contentType=explainer（观点讲解，来自 chains），禁止出现任何真实展示类。请在 explainer 内部覆盖认知/价值/信任/行动等不同 contentGoal，做出 ${angleCountText} 角度差异，不要重复同一切面。`
            : lockContentType
              ? `【硬锁】本批所有 angles 必须 contentType=${lockContentType}（${lockLabel}），全部为该真实展示类，禁止出现 explainer 或其它真实展示类。请在该类的不同 dimensions/场景里做出 ${angleCountText} 角度差异。`
              : coverageConstraintText(mode, coverage),
          lockContentType ? null : showcaseConstraintText(mode, stagePolicy),
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

function buildAnglesFallback(profile, task, insight, framework, mode, allowedAudienceIds, stagePolicy = DEFAULT_STAGE_POLICY, lockContentType = "") {
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

  // 硬锁=explainer：只回观点角度，不混真实展示。
  if (lockContentType === "explainer") return explainerAngles;
  // 硬锁=某真实展示类：整批只产该类，按其 dimensions 展开多条角度。
  if (lockContentType && SHOWCASE_CATEGORY_IDS.has(lockContentType)) {
    const ct = (stagePolicy?.availableShowcase || []).find((c) => c.id === lockContentType);
    if (ct) {
      const dims = (ct.dimensions && ct.dimensions.length) ? ct.dimensions : [`真实的${ct.label}`];
      return dims.slice(0, 6).map((dim, index) => {
        const platforms = index % 2 === 0 ? platformByGoal.douyin : platformByGoal.xhs;
        return {
          chainId: ct.id,
          contentType: ct.id,
          contentGoal: (ct.primaryGoals && ct.primaryGoals[0]) || "信任",
          parentQuestion: `家长想看看真实的${ct.label}：${dim}`,
          hookPattern: `用真实画面展示「${dim}」`,
          structure: ct.structureTemplate || ["开场镜头", "真实片段/细节", "不夸大的边界", "体验/咨询入口"],
          proofType: "真实拍摄，不摆拍",
          platforms,
          formats: platforms.includes("xhs") ? ["xhs_image"] : ["video"],
          risk: ct.compliance || "真实记录，不承诺效果",
          title: dim,
        };
      });
    }
  }

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

function topicDirectionMessages(profile, task, insight, angles, framework, mode, stagePolicy = DEFAULT_STAGE_POLICY, lockContentType = "", want = 0) {
  const showcaseLabels = showcaseLabelsFor(stagePolicy);
  const lockLabel = lockContentType ? lockContentTypeLabel(lockContentType, stagePolicy) : "";
  const dirCountText = want > 0 ? `${want}（精选，不要凑数）` : "4-8";
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
          lockContentType ? `【硬锁】本批所有 directions 的 contentType 必须 = ${lockContentType}（${lockLabel}），禁止出现任何其它 contentType。` : null,
          `directions 数量 ${dirCountText}，每条对应 angles 里的一条（chainId 与 contentType 一致）。`,
          "真实展示类的 structure 用拍摄式（开场镜头 → 真实片段/细节 → 不夸大的边界 → 体验入口），materials 写真实可拍画面；不要写成口播讲解。",
          "audiences 只用 parents、teens；禁止 adults/players/corporate。",
          "platforms 只用 xhs、douyin、video、moments、group、dm；formats 只用 video、xhs_image、moments_text、moments_image、community。",
          "goal 优先 junior；活动类可用 event；信任类可用 trust。",
          "structure 要具体可用于后续脚本（如「家长疑问 → 训练里练到什么 → 边界 → 体验入口」）。",
          "禁止照抄 angles 的 dimension 原文当标题，要本地化成更口语的家长标题。",
        ].filter(Boolean),
        outputNote: "只返回 JSON。",
      }),
    },
  ];
}

function directionCriticMessages(profile, framework, directions, stagePolicy = DEFAULT_STAGE_POLICY, lockContentType = "", want = 0) {
  const showcaseLabels = showcaseLabelsFor(stagePolicy);
  const allowedTypes = (stagePolicy?.allowedContentTypes || ["explainer"]);
  const lockLabel = lockContentType ? lockContentTypeLabel(lockContentType, stagePolicy) : "";
  const keepText = want > 0 ? `${want}` : "4";
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
        lockContentType: lockContentType || undefined,
        checklist: [
          "是否家长决策视角（不是球友/白领/成人自练）",
          lockContentType
            ? `【硬锁】每条 contentType 是否都 = ${lockContentType}（${lockLabel}）；不是的要改成该类型或删除，绝不要改成其它类型`
            : "整批是否覆盖 ≥3 种 contentGoal",
          lockContentType ? null : "contentType 是否都在 allowedContentTypes 内（出现未解锁的真实课堂/学员成长要删或改）",
          lockContentType ? null : "真实展示占比是否大致达到 targetShowcaseShare（不足可把个别 explainer 改写为可用的真实展示类）",
          "真实展示类是否写成拍摄式而非讲解稿；学员成长是否真实、不承诺效果、注明需家长授权",
          "materials 是否都能在少儿网球场真实拍到",
          "是否触犯 contentRules.forbiddenFraming 或 profile.avoid（承诺效果/升学/夸张）",
          "标题/角度是否与同批其它条目重复",
        ].filter(Boolean),
        requiredShape: { directions: ["与输入同结构（含 contentType），仅保留合格项，可改写 title/purpose"] },
        constraints: [
          `至少保留 ${keepText} 条；若多条雷同只留最好的一条。`,
          "对触碰禁用表述的条目，改写为合规措辞而不是直接删光。",
          "保留每条的 contentType 字段。",
          lockContentType ? `本批为硬锁类型，所有保留/改写后的 direction 的 contentType 必须 = ${lockContentType}，禁止改成其它类型。` : null,
        ].filter(Boolean),
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

function directionsFromAngles(profile, normalizedTask, insight, angles, want = 0) {
  const take = Number(want) > 0 ? Math.max(1, Math.floor(Number(want))) : 6;
  const raw = angles.slice(0, take).map((angle, index) => ({
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
  // 硬锁内容类型：slot 已定方向(科普/某真实展示类)时，整批只产该类型。
  // 真实展示类若本阶段不可用(如开业前无学员)，则放弃锁定退回正常混排。
  const lockContentType = resolveLockContentType(brief?.contentType, stagePolicy);
  // 期望条数：从一周计划某格生成时方向已窄，要少而精（want=3）；直接生成入口不传，保持原数量。
  const want = Number(task.maxDirections) > 0 ? Math.max(1, Math.floor(Number(task.maxDirections))) : 0;
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
  let angles = buildAnglesFallback(profile, task, insight, framework, mode, allowedAudienceIds, stagePolicy, lockContentType);
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

      const angleText = await callAiText(provider, config, angleMessages(profile, task, insight, framework, mode, brief, task.excludeTitles, stagePolicy, lockContentType, want));
      const angleData = extractJson(angleText);
      if (angleData && Array.isArray(angleData.angles) && angleData.angles.length) {
        angles = angleData.angles;
        steps.push("angles");
      }

      const topicText = await callAiText(provider, config, topicDirectionMessages(profile, task, insight, angles, framework, mode, stagePolicy, lockContentType, want));
      const topicData = extractJson(topicText);
      if (!topicData || !Array.isArray(topicData.directions) || !topicData.directions.length) {
        throw new Error("AI 返回选题结构不完整");
      }
      let rawDirections = topicData.directions;
      steps.push("topics");

      try {
        const criticText = await callAiText(provider, config, directionCriticMessages(profile, framework, rawDirections, stagePolicy, lockContentType, want));
        const criticData = extractJson(criticText);
        const criticMin = want ? Math.max(2, want - 1) : 4;
        if (criticData && Array.isArray(criticData.directions) && criticData.directions.length >= criticMin) {
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
    directions = directionsFromAngles(profile, normalizedTask, insight, angles, want);
  }

  // 硬锁兜底：无论 AI/critic 是否守规，最终只放该类型；若全被过滤掉则用本地锁定角度重建。
  if (lockContentType) {
    let onType = directions.filter((d) => String(d.contentType || "") === lockContentType);
    if (!onType.length) {
      const lockedAngles = buildAnglesFallback(profile, task, insight, framework, mode, allowedAudienceIds, stagePolicy, lockContentType);
      onType = directionsFromAngles(profile, normalizedTask, insight, lockedAngles, want)
        .filter((d) => String(d.contentType || "") === lockContentType);
    }
    if (onType.length) directions = onType;
  }

  // 最终兜底：按需裁到目标条数（slot 路径少而精）。
  if (want && directions.length > want) directions = directions.slice(0, want);

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

// ---------------------------------------------------------------------------
// 一周计划槽位的选题生成管道（Slot Pipeline）
// ---------------------------------------------------------------------------
// 与主入口 buildTopicDirectionsWithAi 的区别：
//   1. 跳过 insight + angles：槽位已具体到主题，不必再展开决策链；
//   2. 直接基于 brief.theme + slot 字段生成 N 条具体标题（偏成稿、像选题）；
//   3. 跳过 critic：槽位路径少而精，一次成型。
// 输出仍走相同的 direction schema，前端可直接用。
function slotTopicsMessages(profile, task, brief, framework, stagePolicy, lockContentType, want = 3) {
  const showcaseLabels = showcaseLabelsFor(stagePolicy);
  const lockLabel = lockContentType ? lockContentTypeLabel(lockContentType, stagePolicy) : "";
  return [
    {
      role: "system",
      content: [
        "你是少儿网球内容的选题成稿顾问（Slot Topics 角色）。",
        "你拿到的是一周计划里某一个具体排期槽位：主题方向、平台/格式/目标都已确定。",
        "任务：基于给定主题直接写出「像成稿一样具体」的标题方向，【不要】再展开洞察/角度/通用矩阵，【不要】再发散到无关主题。",
        "每条标题要让人看完就能判断「这就是这一格要做的选题」，像运营组当天敲定的选题清单。",
        "explainer 写成讲解/价值稿；真实展示类（class_record/student_growth/venue_env/faculty_course/behind_scene）要写成「拍什么真实画面」，不要写成讲解稿。",
        "标题面向家长，具体、不标题党、不夸张；遵守 contentRules 与 profile.avoid。",
        "输出必须是严格 JSON，不要 Markdown，不要解释。",
      ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify({
        taskType: "junior_slot_topic_directions",
        venueProfile: profileForPrompt(profile),
        slotContext: {
          theme: brief?.theme || "",
          primaryGoal: brief?.primaryGoal || "",
          contentType: brief?.contentType || "",
          mustCover: brief?.mustCover || [],
          preferredPlatforms: brief?.preferredPlatforms || [],
          day: task?.slot?.day || "",
          platform: task?.slot?.platform || "",
          format: task?.slot?.format || "",
          directionHint: task?.slot?.directionHint || "",
          topicTitle: task?.slot?.topicTitle || "",
          topicAngle: task?.slot?.topicAngle || "",
        },
        availableShowcase: showcaseLabels,
        contentRules: framework.contentRules || {},
        requiredShape: {
          directions: [{
            id: "string，slot_ai_ 前缀",
            contentType: "string，explainer 或真实展示类 id",
            chainId: "string",
            contentGoal: "认知|比较|价值|信任|行动|活动",
            parentQuestion: "string",
            reason: "string，为什么现在做（1 句，扣回槽位）",
            title: "string（具体到像成稿标题，不要发散）",
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
          lockContentType ? `【硬锁】本批所有 directions 的 contentType 必须 = ${lockContentType}（${lockLabel}），禁止出现任何其它 contentType。` : null,
          `directions 数量 ${want}，每条都必须紧扣「主题：${brief?.theme || ""}」，不能偏题。`,
          "【关键】这是槽位专用管道，跳过洞察与角度矩阵；不要再产出 insight / angles / 决策问题。",
          "【关键】标题要更具体、更像成稿（接近最终标题），不要再写「关于 XX / XX 解析 / XX 指南」这种宽泛的方向词；要有角度、有场景、有钩子。",
          "【关键】reason 必须扣回槽位（为什么这一格要做这个），而不是通用原因。",
          "真实展示类的 structure 用拍摄式（开场镜头 → 真实片段/细节 → 不夸大的边界 → 体验入口），materials 写真实可拍画面；不要写成口播讲解。",
          "audiences 只用 parents、teens；禁止 adults/players/corporate。",
          "platforms 优先使用 slot.preferredPlatforms；formats 与平台一致即可。",
          "goal 优先 junior；活动类可用 event；信任类可用 trust。",
          "禁止照搬槽位 hint 原文当标题，要本地化成更口语的家长标题。",
        ].filter(Boolean),
        outputNote: "只返回 JSON。",
      }),
    },
  ];
}

function directionsFromSlotFallback(profile, normalizedTask, brief, stagePolicy, lockContentType, want = 3) {
  const theme = String(brief?.theme || "未指定主题").trim();
  const preferredPlatforms = Array.isArray(brief?.preferredPlatforms) && brief.preferredPlatforms.length
    ? brief.preferredPlatforms
    : ["xhs"];
  const lock = lockContentType || "explainer";
  const isExplainer = lock === "explainer";
  const isShowcase = ["class_record", "student_growth", "venue_env", "faculty_course", "behind_scene"].includes(lock);
  // 三条本地 fallback 也要角度不同、标题不同，避免模板感。
  const angleLibrary = [
    {
      suffix: "家长最常问的 3 件事",
      reason: "本格先用家长最常问的 3 件事回应主题，让标题一眼就回答「我点开能看到什么」。",
      purpose: "把家长最关心的子问题挑出来，挨个讲清楚，让标题自带「清单」价值。",
      contentGoal: "认知",
      parentQuestion: `关于「${theme}」，家长最先会问什么`,
      structure: isExplainer
        ? [`家长最常问的 3 件事：${theme}`, "教练视角怎么拆解", "家长可以怎么观察/核实", "体验入口"]
        : ["开场镜头（家长视角）", "训练现场对应画面", "不夸大的边界", "体验/咨询入口"],
      materials: ["教练讲解片段", "训练现场画面", "家长观察小贴士"],
      cta: "留言孩子的年龄/学龄段，教练给具体建议",
    },
    {
      suffix: "训练里到底练什么",
      reason: "本条紧扣槽位主题，把训练里能真实练到的内容拍出来，落地「训练现场证据」。",
      purpose: "让家长看到本主题对应训练里真实可拍的内容，建立「训练到底在练什么」的认知。",
      contentGoal: "信任",
      parentQuestion: `学「${theme}」这件事，孩子到底练到什么`,
      structure: isExplainer
        ? [`家长疑问：${theme}`, "训练里练到的具体动作", "不夸大的边界（多久/什么程度）", "体验入口"]
        : ["开场：训练环境", "真实训练片段", "教练纠正细节", "体验入口"],
      materials: ["学员训练片段", "教练纠正细节", "训练道具/球拍特写"],
      cta: "预约一次体验课，亲自看训练过程",
    },
    {
      suffix: "最容易踩的 1 个坑",
      reason: "本条从槽位主题里挑一个最容易踩的坑做纠偏，标题自带「别再 XX」提醒。",
      purpose: "纠偏一个与主题强相关的常见误区，帮家长避免无效投入，提升标题吸引力。",
      contentGoal: "认知",
      parentQuestion: `关于「${theme}」，家长最容易踩的坑是什么`,
      structure: isExplainer
        ? [`常见误区：${theme}`, "为什么这么坑", "正确的观察/做法", "体验入口"]
        : ["开场：误区演示", "正确示范对比", "边界说明", "体验入口"],
      materials: ["误区演示对比", "正确示范", "教练解释字幕"],
      cta: "如果你也在纠结这条，可以先来体验一次再决定",
    },
  ];
  const raw = angleLibrary.slice(0, want).map((angle, index) => {
    const platforms = preferredPlatforms;
    const formats = platforms.includes("douyin") || platforms.includes("video")
      ? ["video"]
      : (platforms.includes("moments") ? ["moments_text", "moments_image"] : ["xhs_image"]);
    return {
      id: makeTopicId("slot_local", `${theme}-${angle.suffix}`),
      chainId: "slot_local",
      contentType: lock,
      contentGoal: angle.contentGoal,
      parentQuestion: angle.parentQuestion,
      reason: angle.reason,
      title: `${theme}｜${angle.suffix}`,
      purpose: angle.purpose,
      goal: isExplainer ? "junior" : (isShowcase ? "trust" : "junior"),
      audiences: ["parents"],
      platforms,
      formats,
      structure: angle.structure,
      materials: angle.materials,
      cta: angle.cta,
      risk: "不承诺效果/升学，不编造案例",
      source: "ai",
    };
  });
  return decorateDirectionList(raw, profile, normalizedTask);
}

async function buildSlotDirectionsWithAi(profile, task = {}) {
  const framework = await loadAngleFramework();
  const brief = normalizeBrief(task.generationBrief);
  const mode = resolveGenerationMode(task, brief);
  const stagePolicy = resolveStagePolicy(profile, framework);
  const lockContentType = resolveLockContentType(brief?.contentType, stagePolicy);
  const want = Number(task.maxDirections) > 0 ? Math.max(1, Math.floor(Number(task.maxDirections))) : 3;
  const allowedAudienceIds = allowedAudiencesForProfile(profile);
  const goal = inferPrimaryGoal(task);
  const operatingMode = inferOperatingMode(profile, { ...task, goal });
  const pillars = buildPillars(profile, { ...task, goal, mode: operatingMode });
  const normalizedTask = { ...task, goal, mode: operatingMode, pillars: pillars.map((pillar) => pillar.id) };

  const settings = await loadAiSettings();
  const resolved = resolveAiProvider(settings);
  let aiMeta = buildLocalAiMeta(settings);
  let directions = [];
  const steps = [];

  if (resolved) {
    const { provider, config } = resolved;
    const providerLabel = providerDefaults[provider]?.label || provider;
    try {
      const topicText = await callAiText(
        provider,
        config,
        slotTopicsMessages(profile, normalizedTask, brief, framework, stagePolicy, lockContentType, want)
      );
      const topicData = extractJson(topicText);
      if (!topicData || !Array.isArray(topicData.directions) || !topicData.directions.length) {
        throw new Error("AI 返回选题结构不完整");
      }
      directions = decorateDirectionList(topicData.directions, profile, normalizedTask);
      steps.push("topics");
      aiMeta = { source: "ai", provider: providerLabel, model: config.model, steps };
    } catch (error) {
      aiMeta = {
        source: "fallback",
        provider: providerLabel,
        model: config?.model || "",
        steps,
        error: error.message || "AI 生成失败，已回退本地规则",
      };
    }
  }

  if (!directions.length) {
    directions = directionsFromSlotFallback(profile, normalizedTask, brief, stagePolicy, lockContentType, want);
  }

  // 硬锁兜底：保证最终方向都落在槽位指定类型
  if (lockContentType) {
    let onType = directions.filter((d) => String(d.contentType || "") === lockContentType);
    if (!onType.length) {
      onType = directionsFromSlotFallback(profile, normalizedTask, brief, stagePolicy, lockContentType, want)
        .filter((d) => String(d.contentType || "") === lockContentType);
    }
    if (onType.length) directions = onType;
  }

  if (want && directions.length > want) directions = directions.slice(0, want);

  const themeText = String(brief?.theme || "本槽位主题").trim();
  const summary = {
    mode: operatingModeLabels[operatingMode] || operatingMode,
    goal: goalLabels[goal] || goal,
    generationMode: mode,
    audience: allowedAudienceIds.map((id) => audienceLabels[id] || id).join(" / ") || "少儿家长",
    stage: stageLabels[profile.stage] || profile.stage,
    pipeline: "slot",
    suggestion: `围绕「${themeText}」生成了 ${directions.length} 条具体选题，直接挑选采用或保存到选题库。`,
    count: directions.length,
  };

  return {
    sessionId: `slot_dir_${Date.now().toString(36)}`,
    generatedAt: new Date().toISOString(),
    generationMode: mode,
    pipeline: "slot",
    slotTheme: themeText,
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
  const c = task.cadence || {};
  let content;
  if (Number.isFinite(Number(c.content))) {
    content = Number(c.content);
  } else if (Number.isFinite(Number(c.video)) || Number.isFinite(Number(c.xhsImage))) {
    // 兼容旧数据：公域总数 = 旧的视频 + 图文配额（朋友圈忽略）。
    content = (Number(c.video) || 0) + (Number(c.xhsImage) || 0);
  } else {
    content = cadenceDefaults.content;
  }
  return { content: Math.max(1, Math.floor(content) || cadenceDefaults.content) };
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
  // 本地兜底也只产出「方向槽位」，不写死具体选题（具体选题走选题路径按需生成）。
  let pillarCursor = 0;
  const nextPillar = () => {
    const pillar = seedPillars[pillarCursor % seedPillars.length] || {};
    pillarCursor += 1;
    return pillar;
  };
  // 内容优先：取 N 个公域日槽，形态/平台由每格题材(contentType)亲和派生。
  const publicDays = ["周一", "周二", "周四", "周六", "周日", "周三", "周五"];
  const makeSlot = (day) => {
    const pillar = nextPillar();
    const direction = String(pillar.focus || pillar.role || pillar.label || "本周内容方向").trim();
    const contentType = pillar.contentType || "explainer";
    const derived = platformForFormat(formatForContentType(contentType));
    const raw = {
      day,
      platform: derived.platform,
      format: derived.format,
      theme: pillar.label || "本周内容方向",
      goal,
      contentType,
      directionHint: direction,
      pillar: pillar.id,
      pillarLabel: pillar.label,
      whyPlatform: `${contentType === "explainer" || contentType === "faculty_course" ? "认知/资质类题材适合图文沉淀" : "动态过程类题材适合短视频呈现"}，在${derived.platform}发布`,
      whyTiming: `安排在${day}发布`,
    };
    return normalizeScheduleItem(raw, profile, normalizedTask);
  };
  const selected = publicDays
    .slice(0, Math.max(1, cadence.content))
    .map(makeSlot)
    .sort((a, b) => ["周一", "周二", "周三", "周四", "周五", "周六", "周日"].indexOf(a.day) - ["周一", "周二", "周三", "周四", "周五", "周六", "周日"].indexOf(b.day));
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
      rhythm: `本周公域 ${cadence.content} 条（图文/视频按题材自动分配）。`,
      strategySummary: "本地兜底排期：按本周支柱铺方向，形态跟着题材走（图文/视频），不分平台配额。",
    },
    cadence,
    pillars,
    platformRhythm: [
      { platform: "小红书", role: "搜索沉淀和本地种草", cadence: "认知/资质类题材", content: "为什么学网球、师资课程等图文" },
      { platform: "抖音/视频号", role: "同城曝光和熟人传播", cadence: "动态过程类题材", content: "课堂、学员成长、场地环境、幕后等短视频" },
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

// 把 stagePolicy 摘成可读的「本阶段内容配比」给 strategist/planner 用，
// 让一周计划的题材结构与选题库流水线保持一致（如开业前=科普为主+少量真实展示）。
function stageMixGuidance(stagePolicy = DEFAULT_STAGE_POLICY) {
  const showcasePct = Math.round((stagePolicy.showcaseShare || 0) * 100);
  const explainerPct = 100 - showcasePct;
  const availableShowcase = (stagePolicy.availableShowcase || []).map((ct) => `${ct.label}(${ct.id})`);
  return {
    stage: stagePolicy.label || "",
    explainerPct,
    showcasePct,
    allowedContentTypes: stagePolicy.allowedContentTypes || ["explainer"],
    availableShowcase,
    note: stagePolicy.note || "",
  };
}

function strategistMessages(profile, task, stagePolicy = DEFAULT_STAGE_POLICY) {
  const context = buildContextPack(profile, task);
  const stageMix = stageMixGuidance(stagePolicy);
  return [
    {
      role: "system",
      content: [
        "你是网球场内容运营策略顾问（Strategist 角色）。",
        "你的任务是根据球场档案和运营输入，推导本周平台策略与内容方向，而不是套用固定周历模板。",
        "必须结合 stage、goal、audience 推理公域/私域权重，并解释理由。",
        "内容支柱必须同时覆盖『认知科普类』(为什么学网球、网球对孩子专注力/坚持/成长的价值、网球与升学名校等正向认知) 和『真实展示/沟通类』(场地、师资、预约开放、运营幕后)。",
        "即使在开业前，也不要把整周支柱都做成场地/预约/体验等沟通类——认知科普类是建立『为什么选网球、为什么选我们』认知的关键，必须保留。",
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
        stageContentMix: stageMix,
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
          "contentPillars 必须至少包含 2 个『认知科普类』支柱（如：为什么学网球、网球对孩子成长/专注力的价值、网球与升学名校等正向认知），不要让支柱全是场地/预约/体验等沟通类。",
          `本阶段题材大致配比：约 ${stageMix.explainerPct}% 科普讲解(explainer) + 约 ${stageMix.showcasePct}% 真实展示；真实展示本阶段只能用：${stageMix.availableShowcase.join("、") || "暂无"}，不要提还不存在的真实课堂/学员成长。`,
          "禁止原样照搬 pillarReference 的 exampleLabel 和 exampleAngle；label 与 focus 都要体现本周差异。",
          "focus 至少 15 字，写清本周该支柱解决什么问题、适合什么人群、与 stage/goal 的关系。",
          "schedulingPrinciples 要写清「什么题适合什么平台、什么阶段不适合什么平台」。",
        ],
      }),
    },
  ];
}

function plannerMessages(profile, task, strategy, stagePolicy = DEFAULT_STAGE_POLICY) {
  const context = buildContextPack(profile, task);
  const stageMix = stageMixGuidance(stagePolicy);
  const showcaseEnum = stageMix.allowedContentTypes.filter((id) => id !== "explainer");
  const contentTypeEnum = ["explainer", ...showcaseEnum].join("|");
  return [
    {
      role: "system",
      content: [
        "你是网球场内容运营排期策划（Planner 角色），本轮只负责「安排」，不负责创作具体选题。",
        "你的产出是一张「本周内容骨架」：决定每天发哪个平台、什么形式、属于哪个内容支柱、要解决家长的什么方向问题，以及为什么这样排。",
        "严禁写出具体的选题标题——具体选题会在用户点「生成选题」时由专门的选题流水线生成。你只给方向（directionHint）。",
        "directionHint 用一句话写清这一格要解决的家长决策问题或内容方向，例如「打消零基础家长对孩子跟不上的顾虑」「真实展示场地与到达路线」，而不是一个可发布的标题。",
        "每一格要标注 contentType：explainer（科普/观点讲解）或本阶段允许的真实展示类。",
        "explainer 不等于操作说明：它包含『认知型科普』（为什么学网球、网球对孩子专注力/坚持/成长的价值、网球与升学名校等），不要把 explainer 都做成体验流程/预约这类操作型。",
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
        stageContentMix: stageMix,
        requiredShape: {
          overview: {
            title: "string",
            focus: "string",
            rhythm: "string",
            strategySummary: "string",
          },
          publishingSchedule: [{
            day: "周一|周二|周三|周四|周五|周六|周日",
            platform: "小红书|抖音/视频号",
            format: "图文|短视频",
            theme: "string，这一格的内容方向短语（非可发布标题）",
            goal: "opening|booking|junior|adult_beginner|community|event|trust|daily",
            contentType: contentTypeEnum,
            directionHint: "string，一句话写清这一格要解决的家长决策问题或内容方向（非可发布标题）",
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
          `publishingSchedule 共 ${context.cadence.content} 条公域内容；不要排朋友圈/微信群/社群。`,
          "严禁写具体选题标题；theme 与 directionHint 都只给方向，不要写成一个可直接发布的标题。",
          "每条 contentType 按 stageContentMix 的题材配比安排（科普讲解 / 真实展示），由档案阶段决定，不要用本阶段未解锁的类型。",
          "format 由题材决定（不是由你随意指定）：class_record/student_growth/venue_env/behind_scene 这类动态过程题材一律用『短视频』；explainer/faculty_course 这类认知/资质题材用『图文』。platform 跟随 format：图文->小红书，短视频->抖音/视频号。",
          "尽量让每一格的方向/支柱各不相同，整周覆盖多种家长问题与内容类型。",
          "whyPlatform 和 whyTiming 必填，且要具体，不要空话。",
          "每条排期的 pillar/pillarLabel 必须引用 strategy.contentPillars，不要自造未在策略中出现的支柱。",
          `本周题材按本阶段配比安排：约 ${stageMix.explainerPct}% 的格子用 explainer(科普讲解)、约 ${stageMix.showcasePct}% 用真实展示；真实展示只能用 ${showcaseEnum.join("、") || "（本阶段无）"}，不要用本阶段未解锁的真实课堂/学员成长。`,
          "整周必须至少有 2 格是『认知型科普』方向（为什么学网球 / 网球对孩子成长的价值 / 专业认知等），不要把所有格子都排成场地/预约/体验/幕后等沟通类——即使在开业前也要有认知科普。",
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

function isValidPlannerPlan(data, cadence) {
  if (!data || !data.overview || !Array.isArray(data.publishingSchedule) || !data.publishingSchedule.length) {
    return false;
  }
  const schedule = data.publishingSchedule;
  // 公域内容总条数对得上即可（图文/视频由题材决定，不再分别卡数）。
  if (schedule.length !== cadence.content) return false;
  // 一周计划只产公域内容，不应出现朋友圈/社群。
  return schedule.every((item) => !/朋友圈|社群|微信群/.test(String(item.platform || "")));
}

function normalizeScheduleItem(raw, profile, task) {
  // 槽位只承载「方向」，不再写死具体选题。topicFromScheduleSlot 仅用于补默认 goal/audience/素材等。
  const topic = topicFromScheduleSlot(raw, profile, task);
  const pillarId = pillarDefinitions[raw.pillar] ? raw.pillar : topicPillar(topic);
  const contentType = String(raw.contentType || "").trim();
  const directionHint = String(raw.directionHint || raw.topicAngle || raw.reason || "").trim();
  const category = resolveTopicCategory({ contentType, goal: raw.goal || topic.goal });
  // 形态跟着题材走：已知 contentType 时由亲和派生 format/platform，保证不会再出现题材-形态错配。
  const derived = contentType ? platformForFormat(formatForContentType(contentType)) : null;
  return {
    day: raw.day,
    platform: derived ? derived.platform : raw.platform,
    format: derived ? derived.format : raw.format,
    theme: raw.theme || directionHint || "本周内容方向",
    goal: raw.goal || topic.goal,
    directionHint: directionHint || raw.theme || "",
    whyPlatform: raw.whyPlatform || `适合在${raw.platform}发布`,
    whyTiming: raw.whyTiming || `安排在${raw.day}`,
    pillar: pillarId,
    pillarLabel: raw.pillarLabel || pillarDefinitions[pillarId]?.label || pillarId,
    contentType,
    category: category.id,
    categoryLabel: category.label,
    targetAudience: raw.targetAudience || topic.audiences.map((item) => audienceLabels[item] || item).join(" / "),
    materialNeed: Array.isArray(raw.materialNeed) && raw.materialNeed.length ? raw.materialNeed : topic.materials.slice(0, 4),
    action: raw.action || topic.cta,
    risk: raw.risk || topic.risk,
    reason: raw.reason || directionHint || topic.purpose,
  };
}

function assembleAiPlan(profile, task, strategy, plannerOutput) {
  const goal = inferPrimaryGoal(task);
  const mode = inferOperatingMode(profile, { ...task, goal });
  const cadence = resolveCadence(task);
  const mainAudience = audienceLabels[task.audience] || "附近潜在用户";
  const schedule = plannerOutput.publishingSchedule.map((item) => normalizeScheduleItem(item, profile, task))
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
      rhythm: plannerOutput.overview?.rhythm || `本周公域 ${cadence.content} 条（图文/视频按题材分配）。`,
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
  // 内容优先：平台由题材亲和决定，这里给两条公域平台都开放，具体形态在排期阶段按题材派生。
  const preferredPlatforms = ["xhs", "douyin", "video"];
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
    const framework = await loadAngleFramework();
    const stagePolicy = resolveStagePolicy(profile, framework);

    const strategyText = await callAiText(provider, config, strategistMessages(profile, task, stagePolicy));
    const strategy = extractJson(strategyText);
    if (!isValidStrategy(strategy)) throw new Error("策略输出结构不完整");

    // Planner 只排「方向骨架」，不产具体选题；具体选题由用户在每格点「生成选题」时走选题路径生成。
    const plannerText = await callAiText(provider, config, plannerMessages(profile, task, strategy, stagePolicy));
    const plannerOutput = extractJson(plannerText);
    if (!isValidPlannerPlan(plannerOutput, resolveCadence(task))) {
      throw new Error("排期输出结构不完整或与发布数量不匹配");
    }

    return {
      ...assembleAiPlan(profile, task, strategy, plannerOutput),
      aiMeta: {
        source: "ai",
        provider: providerLabel,
        model: config.model,
        steps: ["strategist", "planner"],
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

function compactCharCount(value) {
  return String(value || "").replace(/\s+/g, "").length;
}

function clipText(value, max = 18) {
  const text = String(value || "").trim();
  return text.length > max ? text.slice(0, max) : text;
}

function videoDurationPolicy(contentType) {
  const type = String(contentType || "").trim();
  if (SHOWCASE_CATEGORY_IDS.has(type)) {
    return {
      kind: "showcase",
      durationHint: "20-35s",
      estimatedDurationSeconds: 28,
      shotRange: [4, 6],
      narrationCharRange: [70, 150],
      defaultSteps: ["开场亮相", "真实画面", "关键细节", "适合人群", "轻引导"],
    };
  }
  if (type === "explainer") {
    return {
      kind: "explainer",
      durationHint: "45-60s",
      estimatedDurationSeconds: 52,
      shotRange: [6, 8],
      narrationCharRange: [180, 280],
      defaultSteps: ["痛点提问", "核心判断", "原因一", "原因二", "真实细节", "误区提醒", "轻引导"],
    };
  }
  return {
    kind: "balanced",
    durationHint: "30-45s",
    estimatedDurationSeconds: 38,
    shotRange: [5, 7],
    narrationCharRange: [120, 210],
    defaultSteps: ["开场问题", "核心观点", "真实细节", "适合人群", "轻引导"],
  };
}

function videoShotTime(index, total, estimatedDurationSeconds) {
  const each = Math.max(4, Math.round(estimatedDurationSeconds / Math.max(total, 1)));
  const start = index * each;
  const end = index === total - 1 ? estimatedDurationSeconds : Math.min(estimatedDurationSeconds, start + each);
  return `${start}-${end}s`;
}

function normalizeVideoSteps(structure = [], policy) {
  const source = Array.isArray(structure) && structure.length ? structure.slice() : [];
  const steps = source.map((item) => String(item || "").trim()).filter(Boolean);
  for (const step of policy.defaultSteps) {
    if (steps.length >= policy.shotRange[0]) break;
    if (!steps.includes(step)) steps.push(step);
  }
  if (steps.length > policy.shotRange[1]) return steps.slice(0, policy.shotRange[1]);
  return steps.length ? steps : policy.defaultSteps.slice(0, policy.shotRange[0]);
}

function subtitleFromNarration(narration, fallback = "") {
  const text = String(narration || fallback || "").trim();
  const segments = text
    .split(/[，。！？；：,.!?;:\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const picked = segments.find((item) => item.length >= 4 && item.length <= 18) || segments[0] || fallback;
  return clipText(picked, 18);
}

function videoNarrationCharCount(material = {}) {
  const hook = material.hook && typeof material.hook === "object" ? material.hook : { narration: material.hook || "" };
  const script = Array.isArray(material.script) ? material.script : [];
  return compactCharCount([hook.narration, ...script.map((shot) => shot.narration)].filter(Boolean).join(""));
}

function buildVideoMaterial(profile, topic) {
  const title = String(topic.title || "未命名选题");
  const policy = videoDurationPolicy(topic.contentType);
  const isShowcase = policy.kind === "showcase";
  const structure = normalizeVideoSteps(topic.structure, policy);
  const materials = Array.isArray(topic.materials) && topic.materials.length ? topic.materials : ["场地真实画面"];
  const hookNarration = isShowcase
    ? `先带你真实看看${title}。`
    : `很多家长都会问：${topic.parentQuestion || title}。`;
  const hook = {
    narration: hookNarration,
    visual: materials[0] || "球场真实画面",
    onScreenText: subtitleFromNarration(hookNarration, title),
  };
  const script = structure.map((step, index) => {
    const narration = isShowcase
      ? `这里看${step}，重点是用真实画面说清楚，不夸张也不硬推。`
      : `关于${step}，我们用一个简单判断来说：先看孩子的兴趣和状态，再看训练是否循序渐进，不要用夸张承诺做决定。`;
  return {
      id: index + 1,
    time: videoShotTime(index, structure.length, policy.estimatedDurationSeconds),
    visual: materials[index % materials.length] || "场地真实画面",
    narration,
    onScreenText: subtitleFromNarration(narration, step),
      intent: step,
    };
  });
  const material = {
    type: "video",
    title,
    durationHint: policy.durationHint,
    estimatedDurationSeconds: policy.estimatedDurationSeconds,
    coverText: title.length > 18 ? title.slice(0, 18) : title,
    hook,
    script,
    subtitleStyle: "key_points",
    shootingList: materials,
    editingNotes: [
      "竖屏拍摄",
      "字幕用口播重点短句，不另写一套意思",
      `目标口播字数 ${policy.narrationCharRange[0]}-${policy.narrationCharRange[1]} 字`,
      "前 3 秒必须出现球场或问题",
      "结尾放评论或预约了解动作",
    ],
    publishCopy: `${title}\n\n${topic.purpose}\n\n${topic.suggestedCta || topic.cta}`,
  };
  material.narrationCharCount = videoNarrationCharCount(material);
  return {
    ...material,
  };
}

function buildXhsImageMaterial(profile, topic) {
  const isShowcase = SHOWCASE_CATEGORY_IDS.has(String(topic.contentType || ""));
  const structure = Array.isArray(topic.structure) && topic.structure.length ? topic.structure : ["真实场地", "训练画面", "适合人群", "咨询入口"];
  const city = profile.city || "广州";
  const venue = profile.shortName || profile.name || "这个网球场";
  const cover = {
    headline: isShowcase ? `${venue}真实场地\n先带你看看` : "孩子选运动\n可以先看看网球",
    subline: isShowcase ? "先看环境，再决定要不要来体验" : "先体验，再判断适不适合",
  };
  const base = {
    type: "xhs_image",
    titles: [
      `给孩子选运动时，很多${city}家长会把网球放进备选`,
      "篮球、游泳、羽毛球都看过，也可以再看看网球",
      "孩子适不适合网球，先看这几个状态",
      "不急着报名，先看孩子在球场上的反应",
      topic.title,
    ],
    cover,
    imageContents: [],
    shotList: [],
    body: [
      "很多家长给孩子选运动时，都会在篮球、游泳、羽毛球和网球之间犹豫。",
      "",
      isShowcase
        ? `这组图先带你看看${venue}的真实环境。比起听介绍，先看孩子在球场上的状态会更直观。`
        : `真正需要判断的，不是哪个项目更高级，而是孩子愿不愿意参与、有没有一点成就感、家庭节奏能不能持续安排。`,
      "",
      "网球的特点是反馈比较直接，孩子能从击球和来回球里感受到参与感。但它也不是适合每个孩子，还是建议先体验、先观察，再慢慢决定。",
      "",
      `${venue}目前提供青少年及成人网球相关服务，具体安排以球场实际同步为准。`,
    ].join("\n"),
    tags: [`${city}网球`, "少儿网球", "亲子运动", "青少年运动", venue].filter(Boolean),
    commentGuide: "你初次来网球场会担心什么？可以在评论区说说孩子年龄和你的纠结点。",
  };
  if (isShowcase) {
    base.shotList = structure.map((item) => ({ shot: `实拍：${item}`, caption: item }));
  } else {
    base.imageContents = [
      {
        heading: "很多家长会把网球放进备选",
        lines: ["不是因为它更高级。", "而是孩子能不能参与、愿不愿意继续，比较容易在体验里观察到。"],
      },
      {
        heading: "每项运动适合的孩子不一样",
        lines: ["喜欢同伴互动，可以多看团队类项目。", "喜欢专注和反复练习，也可以试试网球的节奏。"],
      },
      {
        heading: "真正影响坚持的是孩子状态",
        lines: ["有没有兴趣。", "有没有一点成就感。", "下一次还愿不愿意走进球场。"],
      },
      {
        heading: "选运动先看三个问题",
        lines: ["孩子性格。", "家庭时间能否稳定安排。", "体验后的真实反应。"],
      },
      {
        heading: "先体验，再慢慢决定",
        lines: ["不急着比较，也不急着报名。", "先看孩子在球场上的状态，会更容易判断。"],
      },
    ];
  }
  return sanitizeXhsMaterial(base);
}

function buildXhsVisualPlan(profile, topic, options = {}) {
  const structure = Array.isArray(options.structure) && options.structure.length ? options.structure : ["先看结论", "怎么判断", "怎么开始"];
  const titleText = `${topic.title || ""} ${topic.parentQuestion || ""} ${topic.purpose || ""}`;
  const isShowcase = Boolean(options.isShowcase);
  const isQuestion = /吗|怎么|为什么|要不要|适不适合|能不能|是不是|？|\?/.test(titleText);
  const hasCompare = /对比|区别|避坑|误区|不是|别|不要|而是/.test(titleText);
  const hasSteps = /步骤|流程|第一次|新手|开始|入门|预约|体验/.test(titleText);
  const theme = isShowcase
    ? "real_court_story"
    : hasCompare ? "myth_vs_truth" : hasSteps ? "starter_steps" : isQuestion ? "question_cards" : "coach_notes";
  const contentLayouts = isShowcase
    ? ["photo_caption", "scene_detail", "quote_card", "save_share"]
    : hasCompare
      ? ["myth_fact", "contrast", "checklist", "quote_card"]
      : hasSteps
        ? ["steps", "checklist", "timeline", "save_share"]
        : isQuestion
          ? ["question_stamp", "answer_card", "checklist", "quote_card"]
          : ["coach_note", "checklist", "stat_callout", "save_share"];
  const coverBadge = xhsColumnBadge(topic, isShowcase);
  return {
    theme,
    coverLayout: isShowcase ? "photo_lead" : (isQuestion ? "question_stamp" : "big_hook"),
    mood: isShowcase ? "真实记录感" : "像运营重新设计的一组小红书卡片，按文案含义换版式，不做简单自适应",
    accent: profile.shortName || profile.name || "Super Tennis",
    pages: [
      { role: "cover", layout: isShowcase ? "photo_lead" : (isQuestion ? "question_stamp" : "big_hook"), badge: coverBadge, highlight: topic.parentQuestion || topic.purpose || "" },
      ...structure.slice(0, 8).map((item, index) => ({
        role: "content",
        layout: contentLayouts[index % contentLayouts.length],
        badge: `图 ${index + 2}`,
        highlight: String(item || "").slice(0, 18),
      })),
      { role: "cta", layout: "save_share", badge: "收藏 / 咨询", highlight: topic.suggestedCta || topic.cta || "" },
    ],
  };
}

function xhsColumnBadge(topic = {}, isShowcase = false) {
  const text = `${topic.title || ""} ${topic.parentQuestion || ""} ${topic.purpose || ""}`;
  if (isShowcase) return "场地实拍 · 到店前看";
  if (/孩子|少儿|儿童|几岁|启蒙|亲子/.test(text)) return "网球科普 · 启蒙篇";
  if (/新手|第一次|入门|零基础/.test(text)) return "网球科普 · 新手篇";
  if (/课程|教练|训练|发球|正手|反手/.test(text)) return "网球训练 · 基础篇";
  return "网球科普 · 收藏篇";
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
      estimatedDurationSeconds: "number",
      narrationCharCount: "number",
      subtitleStyle: "key_points",
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
    const policy = videoDurationPolicy(brief.contentType);
    const isShowcase = policy.kind === "showcase";
    spec.constraints.push(
      `本条视频按题材使用时长策略：durationHint=${policy.durationHint}，estimatedDurationSeconds 约 ${policy.estimatedDurationSeconds}，script 镜头数控制在 ${policy.shotRange[0]}-${policy.shotRange[1]} 个。`,
      `口播总字数 narrationCharCount 控制在 ${policy.narrationCharRange[0]}-${policy.narrationCharRange[1]} 字；按中文口播约每秒 4-5 字估算，不能生成念不完的脚本。`,
      "每个镜头分三部分：narration=口播逐字稿(教练能直接照着念的口语原话)，visual=画面/动作(拍什么)，onScreenText=重点字幕。",
      "subtitleStyle 必须是 key_points；onScreenText 是重点字幕，必须来自对应 narration 的关键词/短句，不能表达另一套意思，不能和口播割裂。",
      "hook 是前 3 秒钩子：第一句口播(narration) + 第一个画面(visual) + 重点字幕(onScreenText)，要有明确钩子打法(痛点提问/反常识/冲突)，让人停下来。",
      "结尾镜头要有 CTA 口播(轻引导、不硬广)；publishCopy 是发布文案；shootingList 拍摄清单、editingNotes 轻量剪辑提示。",
      "内容要覆盖 brief 的 keyPoints、回答 parentQuestion、符合 contentGoal；不承诺效果/升学、不夸张、不编造案例。",
    );
    if (isShowcase) {
      spec.constraints.push(
        "本选题是真实展示类(实拍记录型)：以 visual 真实镜头为主，narration 简短(现场感/轻旁白即可)，不要长篇口播、不摆拍腔；真实记录，涉及学员需注明家长授权。",
        "script 围绕真实场景的关键画面推进，4-6 个镜头即可，画面承担主要信息。",
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
      "小红书图文不是科普文章，也不是 PPT。核心不是解释「网球为什么好」，而是复现家长的真实决策瞬间：原来我也有这个困惑、这个观点以前没人这么说、说的就是我。",
      "内容视角必须先讲家长，再讲网球；先写犹豫/选择/担心，再给判断方式。不要一上来介绍项目优势。",
      "titles 给 4-6 个备选标题，至少包含：家长共鸣型、决策瞬间型、反常识型、讨论型。标题要像小红书用户会点开的自然句，不要写成论文题或机构宣传语。",
      "标题避免「为什么会考虑网球」「网球适不适合」这类平铺直叙句；优先使用「很多家长后来都会...」「给孩子选运动时...」「不是因为...而是...」「看完篮球/游泳/羽毛球后...」这类有情境的表达。",
      "cover 是封面文案：headline 控制为 1-2 行短句，每行尽量 8-12 个字；要有停留理由。subline 只补一个具体痛点，不要长句，不要写成排版说明。",
      "body 正文必须按小红书阅读节奏：开头先写家长场景/困惑，中段给判断框架，结尾轻转化。不要整篇一直解释网球，不要像百科或课程介绍。",
      "commentGuide 是正文之外单独输出的评论引导语，必须自然引导家长在评论区说孩子年龄、性格或比较纠结的点；不要写私信、加联系方式、进群、点链接。",
      "tags 不要带 # 号，3-6 个、含本地/品类/场景词；所有标题、封面、图上文字、正文、标签、评论引导都要避开 compliancePolicy 中的敏感表达。",
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
        "本选题是科普/观点类：小红书「图片即内容」，但每页不是 PPT 小标题 + bullet。请填 imageContents：heading 是一句有观点的短句；lines 是 2-4 句自然短句，像在帮家长判断，不要写成干巴巴清单。",
        "imageContents 建议 4-7 张图，每页只讲透一个判断点；允许使用「不是...而是...」「真正影响的是...」「先看这三个问题」这类小红书表达。",
        "每页要减少说教感，增加代入感；不要反复说规则清晰、路径清楚，要把它翻译成家长能感受到的选择理由。",
        "cover.headline 要有钩子，不能超过两行；正文和图文都要覆盖 brief 的 keyPoints，但必须改写成家长决策语言。",
        "优先输出「家长正在犹豫的场景 -> 不做项目优劣排名 -> 给观察孩子的方法 -> 建议先体验再判断」这条逻辑，不要写成网球优势清单。",
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
  const xhsStyleReference = format === "xhs_image" ? {
    titlePatterns: [
      "为什么越来越多广州家长，后来都会把网球放进备选？",
      "篮球、游泳、羽毛球都看过，为什么后来又去看了网球？",
      "给孩子选运动时，真正要看的不是项目名气",
      "不是网球更高级，而是孩子适不适合先体验",
    ],
    coverPatterns: [
      "为什么越来越多家长\n会把网球放进备选？",
      "孩子刚开始选运动\n为什么很多人看网球？",
      "不是网球更高级\n而是先看孩子适不适合",
    ],
    pageWriting: [
      "每页用一句观点切入，不要写成 PPT 目录。",
      "每页 2-4 句短句，少用抽象词，多写家长能观察到的状态。",
      "多用决策语言：先看孩子愿不愿意、有没有成就感、家庭能不能长期安排。",
      "不要做项目优劣排名；用「适合谁 / 不适合谁 / 先体验再判断」降低广告感。",
    ],
    bodyFlow: [
      "开头：家长给孩子选运动时的纠结场景。",
      "中段：不是哪个项目更高级，而是孩子是否愿意持续参与。",
      "展开：网球的特点要翻译成家长能理解的体验理由。",
      "结尾：先体验、先观察，不急着报名。",
    ],
  } : null;
  return [
    {
      role: "system",
      content: [
        "你是网球场内容运营写手，为单个选题生成可直接使用的发布物料。",
        "必须基于球场档案、内容 brief 和（如有）排期平台要求写作。",
        "语气真实、克制、专业但不端着；不编造价格、开放时间、学员案例、爆满现场或效果承诺。",
        format === "xhs_image" ? "小红书图文必须避开极限绝对、医疗功效、过度营销、导流、权威背书、玄学、金融收益承诺类表达；评论引导只能引导留言/评论，不要引导加联系方式或进群。" : null,
        "输出必须是严格 JSON，不要 Markdown，不要解释。",
        "只返回一个 material 对象。",
      ].filter(Boolean).join("\n"),
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
        platformStyleReference: xhsStyleReference,
        compliancePolicy: format === "xhs_image" ? xhsCompliancePolicy() : null,
        referenceStructure: (topic.source === "reference" && Array.isArray(topic.structure)) ? topic.structure : null,
        requiredShape: spec.requiredShape,
        constraints: [
          ...spec.constraints,
          brief.planSlot ? `这是 ${brief.planSlot.day} 排期，平台 ${brief.planSlot.platform}，请按该平台调整表达。` : "未提供排期，按选题默认平台习惯写。",
          brief.parentQuestion ? `这条选题要回答家长的问题：「${brief.parentQuestion}」，全文围绕家长视角，不要写成成人自练或球友角度。` : null,
          brief.contentGoal ? `内容目标是「${brief.contentGoal}」，表达克制、不承诺效果或升学、不贴阶层标签。` : null,
          topic.source === "reference" ? "本选题来自参考改写：信息顺序对齐 referenceStructure，但文案必须完全本地化，禁止复用参考原文、对方品牌名或未经证实的数据。" : null,
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
  const xhsRewriteGuide = format === "xhs_image" ? {
    diagnosis: [
      "如果用户说生硬、不够吸引、太像科普、广告感强，默认不是小修，而是重写标题、封面、每页图内容和正文开头。",
      "优先把内容从「解释网球」改成「帮家长做选择」。",
      "减少 PPT 式 bullet，改成小红书式观点短句。",
    ],
    rewriteTargets: [
      "标题要制造家长决策瞬间，而不是陈述主题。",
      "封面必须短，1-2 行，能让家长停下来。",
      "每页图内容要像一句观点 + 2-4 句解释。",
      "正文开头先写家长纠结，再写判断框架，结尾轻转化。",
    ],
  } : null;
  return [
    {
      role: "system",
      content: [
        "你是网球场内容运营写手，正在按用户的修改指令对一份已生成的物料做定向修订。",
        "如果用户要求整篇、整体、全文、重写一版、换风格，你可以重构完整内容；否则只按指令改动需要改的部分，其余内容尽量保留。",
        "无论局部还是整体修改，都必须保持完全相同的 JSON 结构。",
        "不编造价格、开放时间、学员案例、爆满现场或效果承诺；语气真实克制。",
        format === "xhs_image" ? "小红书修改必须同步做违禁词避雷：避开极限绝对、医疗功效、过度营销、导流、权威背书、玄学、金融收益承诺；不要把留言引导改成私信、加联系方式或进群。" : null,
        "输出必须是严格 JSON，不要 Markdown，不要解释。只返回一个 material 对象。",
      ].filter(Boolean).join("\n"),
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
        currentText: String(task.currentText || "").slice(0, 8000),
        platformRewriteGuide: xhsRewriteGuide,
        compliancePolicy: format === "xhs_image" ? xhsCompliancePolicy() : null,
        requiredShape: spec.requiredShape,
        constraints: [
          ...spec.constraints,
          "严格遵循用户 instruction；如果 instruction 明确要求整篇/整体/全文/重写/换风格，就按 requiredShape 生成一版完整新 material，并覆盖封面、图上文字、正文、标签等相关字段。",
          format === "xhs_image" ? "小红书整篇修改时，不能只同义词替换。必须实质性改标题、封面、imageContents、body，使它更像家长会收藏/评论的小红书内容。" : null,
          "如果 instruction 只是局部调整，则指令没提到的字段保持原样或仅做必要润色。",
          task.currentText ? "currentText 是用户当前在前端看到/编辑过的全文；整体重写时要参考 currentText 的信息，不要只看旧 JSON 字段。" : null,
        ].filter(Boolean),
        localExample: fallbackMaterial,
      }),
    },
  ];
}

function selectionRefineMessages(profile, task, topic, format) {
  const brief = buildContentBrief(profile, topic, task);
  const selectedText = String(task.selectedText || "").slice(0, 1200);
  const currentText = String(task.currentText || "").slice(0, 8000);
  const instruction = String(task.instruction || "").slice(0, 500);
  return [
    {
      role: "system",
      content: [
        "你是网球场内容运营写手，正在对一篇已生成内容中的选中文字做局部改写。",
        "你只能改写 selectedText 这一段，并返回可直接替换 selectedText 的文本。",
        "不要返回整篇文章，不要解释，不要 Markdown，不要 JSON 以外的内容。",
        "保留原文事实和语气边界；不编造价格、时间、学员案例、爆满现场、效果承诺或升学暗示。",
        format === "xhs_image" ? "如果是小红书图文，替换文本也必须避开极限绝对、医疗功效、过度营销、导流、权威背书、玄学、金融收益承诺类表达。" : null,
        "输出必须是严格 JSON，格式为 {\"replacement\":\"...\"}。",
      ].filter(Boolean).join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify({
        taskType: "topic_content_selection_refine",
        venueProfile: {
          name: profile.name,
          shortName: profile.shortName,
          city: profile.city,
          stage: stageLabels[profile.stage] || profile.stage,
          positioning: profile.positioning,
          tone: profile.tone,
          avoid: profile.avoid,
        },
        brief,
        contentRequest: {
          format,
          formatLabel: formatSpecFor(format, brief).formatLabel,
        },
        instruction,
        selectedText,
        surroundingContent: currentText,
        compliancePolicy: format === "xhs_image" ? xhsCompliancePolicy() : null,
        constraints: [
          "replacement 必须能直接放回原位置，前后语义自然衔接。",
          "如果用户要求变短，就明显压缩；如果要求更口语，就像真实运营者会说的话。",
          "不要改写 selectedText 之外的内容，不要新增无依据事实。",
        ],
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
    const normalizedScript = Array.isArray(input.script) && input.script.length
      ? input.script.map((shot, index) => {
        const narration = firstAvailable(shot.narration, shot.subtitle, fallback.script?.[index]?.narration, "");
        return {
          id: index + 1,
          time: firstAvailable(shot.time, fallback.script?.[index]?.time, `${index * 5}-${index * 5 + 5}s`),
          visual: firstAvailable(shot.visual, fallback.script?.[index]?.visual, "场地真实画面"),
          // 兼容旧数据：无 narration 时用旧 subtitle 兜口播。
          narration,
          onScreenText: firstAvailable(shot.onScreenText, shot.subtitle, subtitleFromNarration(narration), fallback.script?.[index]?.onScreenText, ""),
          intent: firstAvailable(shot.intent, fallback.script?.[index]?.intent, "推进内容"),
        };
      })
      : fallback.script;
    const material = {
      type: "video",
      title: firstAvailable(input.title, fallback.title),
      durationHint: firstAvailable(input.durationHint, fallback.durationHint, "30-45s"),
      estimatedDurationSeconds: Number(input.estimatedDurationSeconds) || Number(fallback.estimatedDurationSeconds) || null,
      coverText: firstAvailable(input.coverText, fallback.coverText),
      hook,
      script: normalizedScript,
      subtitleStyle: input.subtitleStyle === "key_points" ? "key_points" : (fallback.subtitleStyle || "key_points"),
      shootingList: Array.isArray(input.shootingList) && input.shootingList.length ? input.shootingList : fallback.shootingList,
      editingNotes: Array.isArray(input.editingNotes) && input.editingNotes.length ? input.editingNotes : fallback.editingNotes,
      publishCopy: firstAvailable(input.publishCopy, fallback.publishCopy),
    };
    material.narrationCharCount = Number(input.narrationCharCount) || Number(fallback.narrationCharCount) || videoNarrationCharCount(material);
    return material;
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
    return sanitizeXhsMaterial({
      type: "xhs_image",
      titles: Array.isArray(input.titles) && input.titles.length ? input.titles : fallback.titles,
      cover,
      imageContents,
      shotList,
      body: firstAvailable(input.body, fallback.body),
      tags: Array.isArray(input.tags) && input.tags.length ? input.tags.map((tag) => String(tag).replace(/^#/, "")) : fallback.tags,
      commentGuide: firstAvailable(input.commentGuide, fallback.commentGuide),
    });
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

function normalizeXhsVisualPlan(input = {}, fallback = {}, options = {}) {
  const allowedThemes = new Set(["question_cards", "starter_steps", "myth_vs_truth", "coach_notes", "real_court_story"]);
  const allowedLayouts = new Set([
    "big_hook", "question_stamp", "photo_lead", "checklist", "steps", "contrast", "myth_fact",
    "answer_card", "coach_note", "stat_callout", "quote_card", "photo_caption", "scene_detail", "timeline", "save_share",
  ]);
  const pageCount = Math.max(2, Number(options.pageCount) || 2);
  const sourcePages = Array.isArray(input.pages) && input.pages.length ? input.pages : (Array.isArray(fallback.pages) ? fallback.pages : []);
  const fallbackLayouts = ["big_hook", "checklist", "steps", "contrast", "quote_card", "save_share"];
  const pages = Array.from({ length: pageCount }, (_, index) => {
    const page = sourcePages[index] || {};
    const role = index === 0 ? "cover" : (index === pageCount - 1 ? "cta" : "content");
    const fallbackLayout = role === "cover"
      ? (fallback.coverLayout || "big_hook")
      : (role === "cta" ? "save_share" : fallbackLayouts[index % fallbackLayouts.length]);
    const layout = allowedLayouts.has(page.layout) ? page.layout : (allowedLayouts.has(fallbackLayout) ? fallbackLayout : "checklist");
    return {
      role,
      layout,
      badge: firstAvailable(page.badge, role === "cover" ? "封面" : (role === "cta" ? "咨询" : `图 ${index + 1}`)),
      highlight: firstAvailable(page.highlight, ""),
    };
  });
  const theme = allowedThemes.has(input.theme) ? input.theme : (allowedThemes.has(fallback.theme) ? fallback.theme : "coach_notes");
  const coverLayout = allowedLayouts.has(input.coverLayout) ? input.coverLayout : (allowedLayouts.has(fallback.coverLayout) ? fallback.coverLayout : pages[0].layout);
  return {
    theme,
    coverLayout,
    mood: firstAvailable(input.mood, fallback.mood, ""),
    accent: firstAvailable(input.accent, fallback.accent, ""),
    pages,
  };
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

async function buildSelectionRefineWithAi(profile, task = {}) {
  const fallbackPack = buildTopicContent(profile, task);
  const format = task.format || (task.formats?.length ? task.formats[0] : "");
  const selectedText = String(task.selectedText || "").trim();
  const instruction = String(task.instruction || "").trim();

  if (!format) return { replacement: selectedText, aiMeta: { source: "fallback", error: "缺少内容类型 format" } };
  if (!selectedText || !instruction) {
    return { replacement: selectedText, aiMeta: { source: "fallback", format, error: "缺少选中文字或修改要求" } };
  }

  const settings = await loadAiSettings();
  const resolved = resolveAiProvider(settings);
  if (!resolved) {
    return { replacement: selectedText, aiMeta: { source: "local", reason: "未配置可用的 AI，无法局部修改", format } };
  }

  const { provider, config } = resolved;
  const providerLabel = providerDefaults[provider]?.label || provider;

  try {
    const text = await callAiText(provider, config, selectionRefineMessages(profile, task, fallbackPack.topic, format));
    const data = extractJson(text);
    const replacement = format === "xhs_image"
      ? sanitizeXhsText(data.replacement || "").trim()
      : String(data.replacement || "").trim();
    if (!replacement) throw new Error("AI 返回的 replacement 为空");
    return {
      replacement,
      aiMeta: { source: "ai", provider: providerLabel, model: config.model, format },
    };
  } catch (error) {
    return {
      replacement: selectedText,
      aiMeta: {
        source: "fallback",
        provider: providerLabel,
        model: config?.model || "",
        format,
        error: error.message || "局部修改失败，已保留原文",
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

// 社群运营三类群：各自有独立的私域任务（承接/转化/留存/裂变），节奏与话术按群定制。
const COMMUNITY_GROUP_TYPES = [
  {
    id: "prospect_parents",
    label: "意向家长群",
    audience: "还在了解、尚未报名的家长",
    mission: "答疑解顾虑，把意向家长转化为体验课 / 报名",
    rhythmFocus: "答疑 + 干货种草 + 体验课接龙",
    scriptKinds: ["welcome", "announcement", "faq", "privateFollowUp", "trialSignup"],
  },
  {
    id: "enrolled_parents",
    label: "在读学员家长群",
    audience: "已报名的在读学员家长",
    mission: "留存陪伴、续费与转介绍",
    rhythmFocus: "打卡反馈 + 成长展示 + 答疑",
    scriptKinds: ["welcome", "announcement", "faq", "privateFollowUp", "renewal", "referral"],
  },
  {
    id: "adult_players",
    label: "成人约球群",
    audience: "成人网球爱好者 / 球友",
    mission: "约球促活、提高场地利用与口碑",
    rhythmFocus: "约球接龙 + 水平匹配 + 轻社交",
    scriptKinds: ["welcome", "announcement", "faq", "privateFollowUp", "matchSignup"],
  },
];

const SCRIPT_KIND_LABELS = {
  welcome: "入群欢迎语",
  announcement: "群公告模板",
  faq: "常见问答",
  privateFollowUp: "高意向私聊跟进",
  trialSignup: "体验课接龙",
  matchSignup: "约球接龙",
  renewal: "续费话术",
  referral: "转介绍话术",
};

function resolveGroupType(id) {
  return COMMUNITY_GROUP_TYPES.find((g) => g.id === id) || COMMUNITY_GROUP_TYPES[0];
}

// 每类群的一周动作骨架；kind=reuse 为干货日（复用一周计划公域方向）。
const COMMUNITY_RHYTHM_TEMPLATES = {
  prospect_parents: [
    { day: "周一", kind: "icebreaker" },
    { day: "周二", kind: "qa" },
    { day: "周三", kind: "reuse" },
    { day: "周四", kind: "case" },
    { day: "周五", kind: "trialSignup" },
    { day: "周六", kind: "reuse" },
    { day: "周日", kind: "feedback" },
  ],
  enrolled_parents: [
    { day: "周一", kind: "checkin" },
    { day: "周二", kind: "growth" },
    { day: "周三", kind: "reuse" },
    { day: "周四", kind: "qa" },
    { day: "周五", kind: "feedback" },
    { day: "周六", kind: "reuse" },
    { day: "周日", kind: "referralSoft" },
  ],
  adult_players: [
    { day: "周一", kind: "social" },
    { day: "周二", kind: "matchSignup" },
    { day: "周三", kind: "reuse" },
    { day: "周四", kind: "qa" },
    { day: "周五", kind: "matchSignup" },
    { day: "周六", kind: "social" },
    { day: "周日", kind: "feedback" },
  ],
};

function buildCommunityDay(kind, ctx) {
  const { profile, day, reuseSlot } = ctx;
  const brand = profile.shortName || profile.name || "球场";
  if (kind === "reuse") {
    const title = reuseSlot?.topicTitle || reuseSlot?.theme || reuseSlot?.directionHint || "本周公域主题";
    const angle = reuseSlot?.topicAngle || reuseSlot?.directionHint || "";
    return {
      day,
      action: "干货日 · 复用公域内容",
      isReuse: true,
      sourceTopic: title,
      groupTopic: `把本周发出去的公域内容搬进群里聊：「${title}」`,
      message: `这周我们在公域发了一条「${title}」。${angle ? angle + "。" : ""}群里的家人可以先看，看完有想问的直接在群里问，我会结合咱们${brand}的实际情况补充——群里问会回得更细。`,
      interaction: "看完可以回复：A 还想看更多这类 B 有具体问题想问 C 想来现场看看",
      followUp: "整理群里的提问，高意向单独私聊；高频问题沉淀进常见问答。",
      risk: "复用公域成品时不要在群里改写出未确认的价格 / 时间 / 名额。",
    };
  }
  const presets = {
    icebreaker: {
      action: "轻话题破冰",
      groupTopic: "用轻松话题让群活跃起来",
      message: "先问个轻松的：给孩子找运动，你最看重哪点？A 长个子/体态 B 专注力/坚持 C 有个长期爱好 D 社交。随便聊聊，我也好按大家的关注点多分享。",
      interaction: "直接回复 A/B/C/D，或说说你家娃的情况",
      followUp: "记下每位家长的关注点，后续推送/私聊更精准。",
      risk: "只做轻互动，不要急着推销。",
    },
    qa: {
      action: "集中答疑",
      groupTopic: "开放提问，集中解答顾虑",
      message: "今天是群里的答疑时间～关于学网球、孩子能不能跟上、怎么开始，有问题都可以问，我统一回。零基础、年龄、时间安排都能聊。",
      interaction: "把你最想问的问题直接发群里",
      followUp: "答疑后把高意向单独私聊跟进。",
      risk: "不确定的信息先说‘以正式通知为准’，不要写死。",
    },
    case: {
      action: "案例 · 化解顾虑",
      groupTopic: "用真实场景化解‘孩子坐不住/跟不上’",
      message: "常有家长担心‘我家孩子坐不住，能学网球吗’。其实网球课是动起来的，反而适合精力旺盛的孩子；教练会从挥拍、捡球小游戏开始，先让孩子有成就感。有同样顾虑的可以群里说说，我帮你具体分析。",
      interaction: "回复你最担心的一点，我针对性解答",
      followUp: "针对每个顾虑给方案，邀约到店体验。",
      risk: "不夸大效果、不承诺成绩。",
    },
    trialSignup: {
      action: "体验课接龙",
      groupTopic: "发起本周体验课接龙",
      message: "本周开放少量体验名额～想带孩子来的家长群里接龙，格式：『孩子年龄+方便时间段』，例：6岁/周六上午。我按接龙顺序统一安排，名额有限先到先得。",
      interaction: "按『孩子年龄+方便时间』接龙",
      followUp: "接龙后逐个私聊确认时间，发定位与注意事项。",
      risk: "名额/时间以实际可排为准，不要超额承诺。",
    },
    feedback: {
      action: "反馈收集",
      groupTopic: "收集反馈，温和收口本周",
      message: "周末啦～这周群里聊了不少，想听听大家：还有什么想了解的，或希望多分享哪方面？你的反馈决定下周群里聊什么。",
      interaction: "一句话说说你想看的内容或还没解决的问题",
      followUp: "汇总反馈定下周社群主题；高意向继续私聊。",
      risk: "保持轻松，不要变成催单。",
    },
    checkin: {
      action: "训练打卡",
      groupTopic: "鼓励家长晒娃训练打卡",
      message: "新的一周开始～欢迎家长晒一晒孩子上周的训练或在家练习的小视频/照片，互相鼓励。坚持最难，看到别的孩子也在练，娃更有动力。",
      interaction: "发孩子训练照片/视频，或打卡『本周已练X次』",
      followUp: "给每个打卡的孩子具体鼓励；亮点可做成成长展示。",
      risk: "经家长同意再公开孩子影像。",
    },
    growth: {
      action: "成长展示",
      groupTopic: "展示学员阶段性进步",
      message: "分享一个小进步：很多孩子从接不到球，到能连续对打几拍，背后是每周的坚持。我们会持续记录孩子的成长，也欢迎家长分享你观察到的变化～",
      interaction: "说说你家娃最近的一个小变化",
      followUp: "把典型成长整理成案例，用于转介绍与公域内容。",
      risk: "如实展示，不夸大、不对比贬低其他孩子。",
    },
    referralSoft: {
      action: "口碑 · 转介绍",
      groupTopic: "自然带出转介绍",
      message: "谢谢这周家长们的陪伴～如果觉得孩子练得开心、有变化，欢迎把我们推荐给身边同样在给孩子找运动的朋友。老学员介绍的新朋友，我们也会有专属的小心意。",
      interaction: "身边有想了解的朋友，可以直接拉进群或私聊我",
      followUp: "对接转介绍名单，给到老学员答谢。",
      risk: "答谢规则以正式说明为准，不要群里临时承诺。",
    },
    social: {
      action: "轻社交破冰",
      groupTopic: "活跃球友氛围",
      message: "球友们好～新的一周先报个到：大家一般什么时间方便打球？工作日晚上多还是周末多？也欢迎自报水平（新手/进阶/想找陪练），方便互相约。",
      interaction: "报时间段 + 自报水平（新手/进阶）",
      followUp: "按时间和水平帮球友互相牵线。",
      risk: "保持开放友好，不排斥新手。",
    },
    matchSignup: {
      action: "约球接龙",
      groupTopic: "发起约球接龙",
      message: "约球接龙来啦～想约球的按格式接龙：『日期+时间段+水平』，例：周六上午/进阶。人齐我帮忙协调场地，新手也别怕，可以约新手友好场。",
      interaction: "按『日期+时间段+水平』接龙",
      followUp: "凑齐人后确认场地并建临时小群/私聊。",
      risk: "场地以实际可订为准。",
    },
  };
  const p = presets[kind] || presets.qa;
  return { day, action: p.action, isReuse: false, sourceTopic: "", groupTopic: p.groupTopic, message: p.message, interaction: p.interaction, followUp: p.followUp, risk: p.risk };
}

function buildCommunityScript(kind, ctx) {
  const { profile, groupDef } = ctx;
  const brand = profile.shortName || profile.name || "我们";
  switch (kind) {
    case "welcome":
      return {
        key: "welcome",
        title: SCRIPT_KIND_LABELS.welcome,
        type: "text",
        content: `欢迎加入${brand}${groupDef.label}！我是这里的教练/运营。群里会定期分享网球科普、孩子成长记录${groupDef.id === "adult_players" ? "和约球/活动信息" : "和体验/活动信息"}。有任何问题随时在群里问，也可以私聊我。为了大家的体验，群里不发广告、不刷屏，谢谢配合～`,
      };
    case "announcement":
      return {
        key: "announcement",
        title: SCRIPT_KIND_LABELS.announcement,
        type: "text",
        content: `【${brand}群公告】\n1. 本群用于${groupDef.mission}相关的分享与交流。\n2. 每天会有一个小话题/答疑，欢迎参与。\n3. ${groupDef.id === "adult_players" ? "约球、活动、场地信息" : "体验、活动信息"}会在群内第一时间同步。\n4. 价格/时间/名额以正式通知为准。\n有问题直接 @我 或私聊。`,
      };
    case "faq": {
      const faqByGroup = {
        prospect_parents: [
          "零基础可以来吗？——可以，从挥拍和小游戏开始，不需要一上来就会打。",
          "孩子多大适合？——按年龄、兴趣和身体状态看，可以先来体验判断。",
          "怎么预约/收费？——以正式通知为准，可以先把方便的时间段发我登记意向。",
          "需要自带装备吗？——初期可先用我们的，体验后再考虑添置。",
          "孩子坐不住能学吗？——网球是动起来的，反而适合精力旺盛的孩子。",
        ],
        enrolled_parents: [
          "请假能补课吗？——以正式补课规则为准，提前在群里/私聊说一声。",
          "在家怎么辅助练习？——我会按孩子情况给小练习，家长配合鼓励即可。",
          "什么时候需要升级装备？——按孩子进度来，不急着一步到位。",
          "有没有比赛/展示机会？——会按阶段安排，提前在群里通知。",
          "下一期怎么续/时间怎么排？——快上完时我会提前同步，帮你预留时间。",
        ],
        adult_players: [
          "新手能约吗？——可以，群里有新手友好场，欢迎报名。",
          "怎么订场/费用？——以实际可订与正式通知为准。",
          "怎么找到水平相当的球友？——自报水平，我帮忙按水平牵线。",
          "需要自带球拍吗？——建议自带，没有也可以先借用。",
          "一个人也能来吗？——可以，接龙后我帮你凑局。",
        ],
      };
      return { key: "faq", title: SCRIPT_KIND_LABELS.faq, type: "list", content: faqByGroup[groupDef.id] || faqByGroup.prospect_parents };
    }
    case "privateFollowUp": {
      const fByGroup = {
        prospect_parents: [
          "（破冰）您好，看到您在群里关注孩子学网球，方便问下孩子多大、之前接触过球类吗？我按情况给您具体建议。",
          "（解顾虑）您之前担心的[顾虑]，其实可以这样安排…要不要先来一次体验，让孩子自己感受下？",
          "（邀约）本周六上午还有 1 个体验名额，要不要我先帮您留着？",
        ],
        enrolled_parents: [
          "（关怀）这周孩子状态不错，[具体表现]，在家可以让他这样小练习一下…",
          "（续费）孩子这期快上完了，下一期时间我先帮您预留，您看是否继续？",
          "（转介绍）您身边如果有朋友也想给孩子找运动，欢迎推荐，老学员介绍有专属答谢。",
        ],
        adult_players: [
          "（牵线）您和[球友]都是周末进阶水平，要不要我帮你们约一场？",
          "（促活）本周六上午有球局，已经 3 个人了，您来凑一场？",
          "（关怀）最近没怎么看到您打球，这周有空一起来活动下？",
        ],
      };
      return { key: "privateFollowUp", title: SCRIPT_KIND_LABELS.privateFollowUp, type: "list", content: fByGroup[groupDef.id] || fByGroup.prospect_parents };
    }
    case "trialSignup":
      return {
        key: "trialSignup",
        title: SCRIPT_KIND_LABELS.trialSignup,
        type: "text",
        content: "【本周体验课接龙】\n格式：孩子年龄 + 方便时间段（例：6岁/周六上午）\n1. \n2. \n3. \n名额有限，按接龙顺序安排，我会逐个私聊确认。",
      };
    case "matchSignup":
      return {
        key: "matchSignup",
        title: SCRIPT_KIND_LABELS.matchSignup,
        type: "text",
        content: "【约球接龙】\n格式：日期 + 时间段 + 水平（新手/进阶，例：周六上午/进阶）\n1. \n2. \n3. \n人齐协调场地，新手友好，欢迎报名。",
      };
    case "renewal":
      return {
        key: "renewal",
        title: SCRIPT_KIND_LABELS.renewal,
        type: "list",
        content: [
          "（提前预告）孩子这期还剩 X 节，续报下一期可以保留现在的上课时间和教练。",
          "（价值回顾）这一期孩子的变化：[具体]，建议趁状态连上，避免中断。",
          "（临门）下一期名额开始排了，要不要我先帮您把时间锁上？",
        ],
      };
    case "referral":
      return {
        key: "referral",
        title: SCRIPT_KIND_LABELS.referral,
        type: "list",
        content: [
          "（自然开口）孩子练得开心的话，欢迎把我们推荐给身边的朋友～",
          "（答谢）老学员成功介绍新朋友，双方都有专属小心意（具体以正式说明为准）。",
          "（提供工具）我整理了一段可以直接转发给朋友的介绍，需要的话发您。",
        ],
      };
    default:
      return null;
  }
}

function communityReminders(groupDef) {
  const base = [
    "社群每天只做一个核心动作，不要连续刷屏。",
    "群里先互动、再通知、再私聊跟进高意向。",
    "没有确认的价格、时间、名额和规则，不要在群里写死。",
  ];
  const extra = {
    prospect_parents: "答疑和体验接龙是转化重点，问完一定要私聊收口。",
    enrolled_parents: "续费和转介绍要自然带出，先做好陪伴和成长展示。",
    adult_players: "约球以促活和体验为主，照顾新手、控制场地节奏。",
  };
  return [...base, extra[groupDef.id]].filter(Boolean);
}

function communitySchedule(plan = {}) {
  if (Array.isArray(plan.publishingSchedule) && plan.publishingSchedule.length) return plan.publishingSchedule;
  if (Array.isArray(plan.week) && plan.week.length) return plan.week;
  return [];
}

function resolveCommunityWeeklyPlan(profile, task = {}) {
  return communitySchedule(task.plan).length ? task.plan : buildOperationPlan(profile, task);
}

function hasInvalidPlaceholder(value) {
  if (typeof value === "string") return /\bundefined\b/.test(value);
  if (Array.isArray(value)) return value.some(hasInvalidPlaceholder);
  if (value && typeof value === "object") return Object.values(value).some(hasInvalidPlaceholder);
  return false;
}

function buildCommunityPlan(profile, task = {}, groupDef = COMMUNITY_GROUP_TYPES[0]) {
  const weeklyPlan = resolveCommunityWeeklyPlan(profile, task);
  const mode = operatingModeLabels[inferOperatingMode(profile, task)] || "日常运营";
  const publicSlots = communitySchedule(weeklyPlan).filter(Boolean);
  const template = COMMUNITY_RHYTHM_TEMPLATES[groupDef.id] || COMMUNITY_RHYTHM_TEMPLATES.prospect_parents;
  let reuseCursor = 0;
  const week = template.map(({ day, kind }) => {
    let reuseSlot = null;
    if (kind === "reuse" && publicSlots.length) {
      reuseSlot = publicSlots[reuseCursor % publicSlots.length];
      reuseCursor += 1;
    }
    return buildCommunityDay(kind, { profile, groupDef, day, reuseSlot });
  });
  const scriptLibrary = groupDef.scriptKinds
    .map((kind) => buildCommunityScript(kind, { profile, groupDef, task }))
    .filter(Boolean);

  return {
    overview: {
      title: `${profile.shortName || profile.name}本周${groupDef.label}运营`,
      groupType: groupDef.id,
      groupLabel: groupDef.label,
      mission: groupDef.mission,
      audience: groupDef.audience,
      mode,
      source: weeklyPlan.overview?.title || "一周运营计划",
      principle: `${groupDef.label}聚焦：${groupDef.rhythmFocus}；干货日复用本周公域内容，其余天做互动与转化。`,
    },
    week,
    scriptLibrary,
    reminders: communityReminders(groupDef),
  };
}

function communityMessages(profile, task, groupDef, weeklyPlan, stagePolicy = DEFAULT_STAGE_POLICY) {
  const publicDirections = communitySchedule(weeklyPlan)
    .map((slot) => slot.topicTitle || slot.theme || slot.directionHint)
    .filter(Boolean)
    .slice(0, 6);
  const scriptKindList = groupDef.scriptKinds.map((k) => `${k}(${SCRIPT_KIND_LABELS[k] || k})`).join("、");
  return [
    {
      role: "system",
      content: [
        "你是网球场私域社群运营负责人。社群运营属于『私域承接 → 转化 → 留存 → 裂变』，与公域获客（一周计划）是不同的活。",
        `本次只服务一类群：${groupDef.label}（${groupDef.audience}）；这个群的核心任务是：${groupDef.mission}；节奏侧重：${groupDef.rhythmFocus}。`,
        "产出两块：1) 本周社群节奏 week（周一到周日共 7 天，每天一个核心动作，促活/转化导向，不要照搬公域选题）；2) 话术库 scriptLibrary（可复用文案）。",
        "week 里要有 1-2 个『干货日』(isReuse=true)：把本周公域内容搬进群二次承接，并加一句进群专属钩子，引导群内提问/到店；其余天围绕互动、答疑、接龙、打卡等。",
        `scriptLibrary 只产这些种类：${scriptKindList}；每条给 key、title、type(text 或 list)、content(text 为字符串，list 为字符串数组)。`,
        "不得编造价格、时间、名额、优惠等未确认信息；涉及时统一写‘以正式通知为准’。risk 要体现 profile.avoid。",
        "输出必须是严格 JSON，不要 Markdown，不要解释。",
      ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify({
        taskType: "community_operation_plan",
        venueProfile: {
          name: profile.name,
          shortName: profile.shortName,
          stage: profile.stage,
          city: profile.city,
          highlights: profile.highlights,
          avoid: profile.avoid,
        },
        groupType: groupDef.id,
        weeklyInput: { focus: task.focus || "", eventInfo: task.eventInfo || "" },
        publicContentThisWeek: publicDirections,
        stageContentMix: stageMixGuidance(stagePolicy),
        requiredShape: {
          overview: { title: "string", mission: "string", principle: "string" },
          week: [{
            day: "周一|周二|周三|周四|周五|周六|周日",
            action: "string，这一天的核心动作名",
            isReuse: "boolean，是否干货日",
            sourceTopic: "string，干货日填复用的公域主题，否则空",
            groupTopic: "string，今天群里聊什么",
            message: "string，可直接发群的消息文案",
            interaction: "string，引导群成员怎么回复/参与",
            followUp: "string，群后跟进动作",
            risk: "string，风险提示",
          }],
          scriptLibrary: [{ key: "string", title: "string", type: "text|list", content: "string 或 string[]" }],
          reminders: ["string"],
        },
        constraints: [
          "week 必须正好 7 天，周一到周日各一条。",
          "至少 1 天 isReuse=true，且 sourceTopic 来自 publicContentThisWeek。",
          `scriptLibrary 必须覆盖：${groupDef.scriptKinds.join("、")}，不要产其它种类。`,
          "message 是可直接复制发群的中文文案，口语、亲切、不刷屏、不夸大。",
          "不写死价格/时间/名额；未确认信息写‘以正式通知为准’。",
        ],
      }),
    },
  ];
}

function isValidCommunityPlan(data, groupDef) {
  if (!data || !data.overview || !Array.isArray(data.week) || data.week.length !== 7) return false;
  if (!Array.isArray(data.scriptLibrary) || !data.scriptLibrary.length) return false;
  if (hasInvalidPlaceholder(data)) return false;
  const days = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  const hasReuse = data.week.some((item) => item && item.isReuse === true);
  if (!hasReuse) return false;
  const hasMissingDayText = days.some((day, index) => {
    const item = data.week.find((d) => d && d.day === day) || data.week[index];
    return !item
      || !String(item.action || "").trim()
      || !String(item.groupTopic || "").trim()
      || !String(item.message || "").trim()
      || !String(item.interaction || "").trim()
      || !String(item.followUp || "").trim();
  });
  if (hasMissingDayText) return false;
  const keys = new Set(data.scriptLibrary.map((s) => s && s.key));
  return groupDef.scriptKinds.every((k) => keys.has(k));
}

function assembleCommunityPlan(profile, task, groupDef, aiOutput, weeklyPlan) {
  const fallback = buildCommunityPlan(profile, task, groupDef);
  const dayOrder = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  const publicSlots = communitySchedule(weeklyPlan).filter(Boolean);
  let reuseCursor = 0;
  const week = dayOrder.map((day, index) => {
    const raw = (aiOutput.week || []).find((d) => d && d.day === day) || aiOutput.week?.[index] || {};
    const fb = fallback.week[index];
    const isReuse = typeof raw.isReuse === "boolean" ? raw.isReuse : Boolean(fb.isReuse);
    let sourceTopic = String(raw.sourceTopic || fb.sourceTopic || "").trim();
    if (isReuse && !sourceTopic && publicSlots.length) {
      const slot = publicSlots[reuseCursor % publicSlots.length];
      reuseCursor += 1;
      sourceTopic = slot.topicTitle || slot.theme || slot.directionHint || "";
    }
    return {
      day,
      action: String(raw.action || fb.action || "").trim(),
      isReuse,
      sourceTopic,
      groupTopic: String(raw.groupTopic || fb.groupTopic || "").trim(),
      message: String(raw.message || fb.message || "").trim(),
      interaction: String(raw.interaction || fb.interaction || "").trim(),
      followUp: String(raw.followUp || fb.followUp || "").trim(),
      risk: String(raw.risk || fb.risk || "").trim(),
    };
  });
  const scriptLibrary = groupDef.scriptKinds.map((kind) => {
    const raw = (aiOutput.scriptLibrary || []).find((s) => s && s.key === kind);
    const fb = fallback.scriptLibrary.find((s) => s.key === kind);
    if (!raw) return fb;
    const type = raw.type === "list" ? "list" : (fb?.type || "text");
    let content = raw.content;
    if (type === "list") content = Array.isArray(content) ? content.filter(Boolean) : (fb?.content || []);
    else content = typeof content === "string" && content.trim() ? content : (fb?.content || "");
    return { key: kind, title: SCRIPT_KIND_LABELS[kind] || raw.title || kind, type, content };
  });
  return {
    overview: {
      title: String(aiOutput.overview?.title || fallback.overview.title),
      groupType: groupDef.id,
      groupLabel: groupDef.label,
      mission: String(aiOutput.overview?.mission || groupDef.mission),
      audience: groupDef.audience,
      mode: fallback.overview.mode,
      source: fallback.overview.source,
      principle: String(aiOutput.overview?.principle || fallback.overview.principle),
    },
    week,
    scriptLibrary,
    reminders: Array.isArray(aiOutput.reminders) && aiOutput.reminders.length ? aiOutput.reminders : fallback.reminders,
  };
}

async function buildCommunityPlanWithAi(profile, task = {}, groupDef = COMMUNITY_GROUP_TYPES[0]) {
  const weeklyPlan = resolveCommunityWeeklyPlan(profile, task);
  const settings = await loadAiSettings();
  const resolved = resolveAiProvider(settings);

  if (!resolved) {
    return { ...buildCommunityPlan(profile, task, groupDef), aiMeta: buildLocalAiMeta(settings) };
  }

  const { provider, config } = resolved;
  const providerLabel = providerDefaults[provider]?.label || provider;

  try {
    const framework = await loadAngleFramework();
    const stagePolicy = resolveStagePolicy(profile, framework);
    const text = await callAiText(provider, config, communityMessages(profile, task, groupDef, weeklyPlan, stagePolicy));
    const output = extractJson(text);
    if (!isValidCommunityPlan(output, groupDef)) throw new Error("社群方案输出结构不完整");
    return {
      ...assembleCommunityPlan(profile, task, groupDef, output, weeklyPlan),
      aiMeta: { source: "ai", provider: providerLabel, model: config.model, steps: ["community"] },
    };
  } catch (error) {
    return {
      ...buildCommunityPlan(profile, task, groupDef),
      aiMeta: {
        source: "fallback",
        provider: providerLabel,
        model: config?.model || "",
        error: error.message || "AI 生成失败，已回退本地规则",
        steps: ["community"],
      },
    };
  }
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
  currentRequest = req;

  try {
    if (req.method === "OPTIONS") {
      sendJson(res, 200, { ok: true });
      return;
    }

    // 鉴权：ACCESS_TOKEN 未设置 = 不启用（本地开发）。
    // 设置后只挡 /api/*；首屏和静态资源（CSS/JS/favicon/图片）全部放行，
    // 这样浏览器才能加载 index.html，进而通过前端 JS 把 token 加到 API 请求里。
    // 用户没 token 时，访问首屏会看到登录页（由前端 app.js 渲染），而不是被服务端拦截。
    if (accessToken && pathname.startsWith("/api/")) {
      const supplied = extractTokenFromRequest(req);
      if (!supplied || supplied !== accessToken) {
        unauthorized(res, pathname);
        return;
      }
    }

    // 已废弃的鉴权门已删除（之前会把 CSS/JS 也挡了，导致 UI 加载不出来）。
    // 现在鉴权只挡 /api/*；首屏和静态资源放行，浏览器加载完 index.html 后，
    // 前端 JS 通过 fetch 时带 Authorization 头来访问 API。

    if (req.method === "GET" && pathname === "/api/health") {
      sendJson(res, 200, {
        ok: true,
        version: "0.2.0",
        features: ["operation-plan", "topic-library", "topic-directions", "topic-reference", "topic-content", "topic-content-selection-refine", "community-plan", "agent-topic-brief", "agent-direction-refine", "agent-route", "agent-memory", "agent-plan-slot-refine"],
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

    if (req.method === "POST" && pathname === "/api/topic-slot-directions") {
      const body = await readJson(req);
      const profile = body.profile || await loadProfile();
      const task = { ...(body.task || {}), generationBrief: body.generationBrief || body.task?.generationBrief, slot: body.slot || body.task?.slot || {} };
      sendJson(res, 200, await buildSlotDirectionsWithAi(profile, task));
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
      const history = Array.isArray(body.history)
        ? body.history.filter((h) => h && (h.role === "user" || h.role === "assistant") && typeof h.text === "string").slice(-6)
        : [];
      sendJson(res, 200, await buildAgentRoute(profile, body.message || body.text || "", body.context || {}, history));
      return;
    }

    if (req.method === "GET" && pathname === "/api/agent-memory") {
      sendJson(res, 200, await loadAgentMemory());
      return;
    }

    if (req.method === "POST" && pathname === "/api/agent-memory") {
      const body = await readJson(req);
      sendJson(res, 200, await saveAgentMemory(body.memory || {}));
      return;
    }

    if (req.method === "POST" && pathname === "/api/agent/campaign-plan") {
      const body = await readJson(req);
      const profile = body.profile || await loadProfile();
      sendJson(res, 200, await buildCampaignPlanWithAi(profile, body.task || {}));
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

    if (req.method === "POST" && pathname === "/api/topic-content/selection-refine") {
      const body = await readJson(req);
      const profile = body.profile || await loadProfile();
      const result = await buildSelectionRefineWithAi(profile, body.task || {});
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
      const groupDef = resolveGroupType(body.task?.groupType);
      sendJson(res, 200, await buildCommunityPlanWithAi(profile, body.task || {}, groupDef));
      return;
    }

    if (req.method === "GET" && pathname === "/api/finished-content") {
      sendJson(res, 200, await loadFinishedContent());
      return;
    }

    if (req.method === "POST" && pathname === "/api/finished-content") {
      const body = await readJson(req);
      const saved = await upsertFinishedItem(body.item || {});
      if (saved.createdItem) await bumpTopicProduceCount(body.item?.topicId);
      sendJson(res, 200, saved);
      return;
    }

    if (req.method === "DELETE" && pathname.startsWith("/api/finished-content/")) {
      const id = decodeURIComponent(pathname.slice("/api/finished-content/".length));
      await deleteFinishedItem(id);
      sendJson(res, 200, await loadFinishedContent());
      return;
    }

    if (req.method === "GET" && pathname === "/api/weekly-plans") {
      sendJson(res, 200, await loadWeeklyPlans());
      return;
    }

    if (req.method === "POST" && pathname === "/api/weekly-plans") {
      const body = await readJson(req);
      const { entry, plans } = await createWeeklyPlanEntry(body.plan || null);
      sendJson(res, 200, { entry, plans });
      return;
    }

    if (req.method === "PUT" && pathname.startsWith("/api/weekly-plans/")) {
      const id = decodeURIComponent(pathname.slice("/api/weekly-plans/".length));
      const body = await readJson(req);
      const { entry, plans } = await updateWeeklyPlanEntry(id, body.plan || null);
      if (!entry) {
        sendJson(res, 404, { error: "计划不存在" });
        return;
      }
      sendJson(res, 200, { entry, plans });
      return;
    }

    if (req.method === "DELETE" && pathname.startsWith("/api/weekly-plans/")) {
      const id = decodeURIComponent(pathname.slice("/api/weekly-plans/".length));
      const { plans } = await deleteWeeklyPlanEntry(id);
      sendJson(res, 200, { plans });
      return;
    }

    if (req.method === "GET" && pathname === "/api/community-plans") {
      sendJson(res, 200, await loadCommunityPlans());
      return;
    }

    if (req.method === "POST" && pathname === "/api/community-plans") {
      const body = await readJson(req);
      const { entry, plans } = await createCommunityPlanEntry({
        plan: body.plan || null,
        groupType: body.groupType,
        planId: body.planId,
        planTitle: body.planTitle,
      });
      sendJson(res, 200, { entry, plans });
      return;
    }

    if (req.method === "DELETE" && pathname.startsWith("/api/community-plans/")) {
      const id = decodeURIComponent(pathname.slice("/api/community-plans/".length));
      const { plans } = await deleteCommunityPlanEntry(id);
      sendJson(res, 200, { plans });
      return;
    }

    if (req.method === "GET" && pathname === "/api/campaign-plans") {
      sendJson(res, 200, await loadCampaignPlans());
      return;
    }

    if (req.method === "POST" && pathname === "/api/campaign-plans") {
      const body = await readJson(req);
      const { entry, plans } = await createCampaignPlanEntry({
        plan: body.plan || null,
        brief: body.brief,
        planId: body.planId,
        planTitle: body.planTitle,
      });
      sendJson(res, 200, { entry, plans });
      return;
    }

    if (req.method === "DELETE" && pathname.startsWith("/api/campaign-plans/")) {
      const id = decodeURIComponent(pathname.slice("/api/campaign-plans/".length));
      const { plans } = await deleteCampaignPlanEntry(id);
      sendJson(res, 200, { plans });
      return;
    }

    if (req.method === "POST" && pathname === "/api/campaign-materials/generate") {
      const body = await readJson(req);
      const profile = body?.profile || (await loadProfile());
      const validated = buildCampaignMaterialsRequest().validate(body || {});
      if (validated.error) {
        sendJson(res, 400, { error: validated.error });
        return;
      }
      const plan = body?.plan || {};
      const summary = summarizeCampaignPlanForMaterials(plan);
      const { materials, aiMeta } = await buildCampaignMaterialDraftsWithAi(profile, summary, validated.formats);
      const idPrefix = `campaign-${validated.campaignId}`;
      const items = materials.map((m) => ({
        id: `${idPrefix}-${m.format}`,
        topicId: "",
        topicTitle: m.label,
        title: m.material.title,
        format: m.format,
        contentType: "campaign_material",
        category: "campaign_material",
        planId: "",
        planTitle: validated.campaignTitle,
        campaignId: validated.campaignId,
        campaignTitle: validated.campaignTitle,
        material: { type: m.format, title: m.material.title, sections: m.material.sections },
        brief: { campaignId: validated.campaignId, campaignTitle: validated.campaignTitle, format: m.format, label: m.label },
      }));
      const saved = [];
      for (const item of items) {
        const result = await upsertFinishedItem(item);
        if (result?.createdItem) await bumpTopicProduceCount(item.topicId);
        saved.push(item.id);
      }
      sendJson(res, 200, { materials: items, savedIds: saved, aiMeta });
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

process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[uncaughtException]", error);
});
