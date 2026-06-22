import { createServer } from "node:http";
import https from "node:https";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ffmpegPath from "ffmpeg-static";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = loadEnv(path.join(__dirname, ".env"));
const port = Number(process.env.PORT || env.PORT || 5173);
const model = env.DEEPSEEK_MODEL || process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
const apiKey = env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY || "";
const arkApiKey = env.ARK_API_KEY || process.env.ARK_API_KEY || "";
const arkVisionModel = env.ARK_VISION_MODEL || process.env.ARK_VISION_MODEL || "doubao-seed-1-6-vision-250815";
const arkBaseUrl = env.ARK_BASE_URL || process.env.ARK_BASE_URL || "https://ark.cn-beijing.volces.com";
const host = env.HOST || process.env.HOST || "127.0.0.1";
const uploadsDir = path.resolve(__dirname, env.UPLOADS_DIR || process.env.UPLOADS_DIR || "uploads");
const outputsDir = path.resolve(__dirname, env.OUTPUTS_DIR || process.env.OUTPUTS_DIR || "outputs");
const dataDir = path.resolve(__dirname, env.DATA_DIR || process.env.DATA_DIR || "data");
const projectsDir = path.join(dataDir, "projects");
const currentProjectPath = path.join(projectsDir, "current.json");
const maxUploadFiles = Number(env.MAX_UPLOAD_FILES || process.env.MAX_UPLOAD_FILES || 20);
const maxAssetSizeMb = Number(env.MAX_ASSET_SIZE_MB || process.env.MAX_ASSET_SIZE_MB || 80);
const maxAssetSizeBytes = maxAssetSizeMb * 1024 * 1024;
const maxRenderSegments = positiveNumber(env.MAX_RENDER_SEGMENTS || process.env.MAX_RENDER_SEGMENTS, 12);
const maxRenderDurationSeconds = positiveNumber(env.MAX_RENDER_DURATION_SECONDS || process.env.MAX_RENDER_DURATION_SECONDS, 180);
const maxRenderSegmentSeconds = positiveNumber(env.MAX_RENDER_SEGMENT_SECONDS || process.env.MAX_RENDER_SEGMENT_SECONDS, 30);
const maxRenderTextLength = positiveNumber(env.MAX_RENDER_TEXT_LENGTH || process.env.MAX_RENDER_TEXT_LENGTH, 220);
const allowedAssetTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
]);

const staticTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".m4v": "video/x-m4v",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/ai/themes") {
      await handleThemes(req, res);
      return;
    }

    if (req.method === "POST" && req.url === "/api/ai/script") {
      await handleScript(req, res);
      return;
    }

    if (req.method === "POST" && req.url === "/api/ai/rewrite") {
      await handleRewrite(req, res);
      return;
    }

    if (req.method === "POST" && req.url === "/api/assets/upload") {
      await handleAssetUpload(req, res);
      return;
    }

    if (req.method === "POST" && req.url === "/api/assets/vision-profile") {
      await handleAssetVisionProfile(req, res);
      return;
    }

    if (req.method === "GET" && req.url === "/api/projects/current") {
      await handleReadCurrentProject(req, res);
      return;
    }

    if (req.method === "POST" && req.url === "/api/projects/current") {
      await handleSaveCurrentProject(req, res);
      return;
    }

    if (req.method === "POST" && req.url === "/api/render/video") {
      await handleRenderVideo(req, res);
      return;
    }

    if (req.method === "GET" || req.method === "HEAD") {
      await serveStatic(req, res);
      return;
    }

    sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: error.message || "Server error" });
  }
});

await ensureRuntimeDirectories();

server.listen(port, host, () => {
  console.log(`Video Creator Agent running at http://${host}:${port}`);
  console.log(`Runtime dirs: uploads=${relativeRuntimePath(uploadsDir)}, outputs=${relativeRuntimePath(outputsDir)}`);
  if (!apiKey) {
    console.warn("Missing DEEPSEEK_API_KEY. AI endpoints will return a clear error until .env is configured.");
  }
  if (!arkApiKey) {
    console.warn("Missing ARK_API_KEY. Volcengine vision profiling will use local basic analysis until .env is configured.");
  }
});

async function ensureRuntimeDirectories() {
  await Promise.all([
    mkdir(uploadsDir, { recursive: true }),
    mkdir(outputsDir, { recursive: true }),
    mkdir(projectsDir, { recursive: true }),
  ]);
}

function relativeRuntimePath(dir) {
  const relative = path.relative(__dirname, dir);
  return relative && !relative.startsWith("..") ? relative : dir;
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function briefTextBundle(brief) {
  return [
    brief.direction,
    brief.product,
    brief.productFeature,
    brief.timing,
    brief.offer,
    brief.brandMessage,
    brief.audience,
  ]
    .filter(Boolean)
    .join(" ");
}

function detectOpeningStage(brief) {
  const text = briefTextBundle(brief);
  if (/开业前|开业前夕|即将开业|开幕前|试营业前|筹备中|装修|预热|倒计时|敬请期待|快要开业|马上要开/.test(text)) {
    return "pre_opening";
  }
  if (/开业后|开业一段时间|开业回顾/.test(text)) return "post_opening";
  if (/试营业|正式开业|开业当天|开张|刚开业|开业了/.test(text)) return "opening";
  if (/开业|新店|开幕/.test(text)) return "opening";
  return null;
}

function resolveOpeningStage(brief) {
  if (brief.openingStageResolved) return brief.openingStageResolved;
  if (brief.openingStage && brief.openingStage !== "auto") return brief.openingStage;
  return detectOpeningStage(brief) || "opening";
}

function detectCampaignType(brief) {
  const text = briefTextBundle(brief);
  if (briefMentionsOpening(brief)) return "opening";
  if (/周年|庆典|店庆/.test(text)) return "anniversary";
  if (/优惠|打折|满减|活动|大促/.test(text)) return "promotion";
  if (/上新|新品|首发|上市/.test(text)) return "launch";
  return "general";
}

function briefMentionsOpening(brief) {
  return /开业|开幕|新店|试营业|开张|开张大吉|酬宾|剪彩|即将开业/.test(briefTextBundle(brief));
}

function detectSceneType(brief) {
  const text = briefTextBundle(brief);
  if (briefMentionsOpening(brief)) return "opening";
  if (/周年|庆典|店庆|节日|七夕|春节|中秋|端午|情人节|母亲节|父亲节|圣诞/.test(text)) return "anniversary";
  if (/优惠|打折|活动|大促|套餐|礼遇|权益|报名|预约|团购|折扣|赠品/.test(text)) return "promotion";
  if (/上新|新品|新服务|新套餐|首发|上市|新款|新菜|新课/.test(text)) return "launch";
  if (brief.projectType === "store") return "store";
  if (brief.businessType === "ecommerce") return "ecommerce";
  if (brief.businessType === "service") return "service";
  if (brief.projectType === "product") return "product";
  return "store_product";
}

function buildScenePrompt(brief, task) {
  const scene = detectSceneType(brief);
  return [
    `【宣传场景识别】${sceneLabel(scene)}`,
    task === "themes" ? buildSceneThemeRules(scene, brief) : buildSceneScriptRules(scene, brief),
  ].join("\n");
}

function detectContentIntent(brief, scene = detectSceneType(brief), theme = null) {
  if (theme) {
    const themeText = [
      theme?.strategy,
      theme?.title,
      theme?.contentGoal,
      theme?.promise,
      theme?.reason,
      ...(Array.isArray(theme?.storyline) ? theme.storyline : []),
    ]
      .filter(Boolean)
      .join(" ");
    const themeIntent = detectIntentFromText(themeText);
    if (themeIntent) {
      if ((scene === "ecommerce" || scene === "product") && themeIntent === "venue_preview") return "product_seed";
      return themeIntent;
    }
  }

  const text = [
    briefTextBundle(brief),
    brief.contentFormatLabel,
    brief.contentFormat,
  ]
    .filter(Boolean)
    .join(" ");

  return detectIntentFromText(text) || defaultIntentForScene(scene);
}

function detectIntentFromText(text = "") {
  if (/对比选择|对比|比较|区别|测评|怎么选/.test(text)) return "comparison";
  if (/权益行动|权益|礼遇|活动|套餐|报名|预约|团购|赠品|领取/.test(text)) return "offer_action";
  if (/新店告知|活动告知|新店亮相|主体亮相|即将开业|开业告知|公告|通知/.test(text)) return "announcement";
  if (/场地预览|空间预览|路线|位置|顶楼|门头|带看|探店|探秘|环境|场地|空间/.test(text)) return "venue_preview";
  if (/养号科普|科普|认知|入门|误区|知识|常识|几岁|为什么/.test(text)) return "education";
  if (/真实记录|故事|记录|纪实|筹备|主理人|日常|过程/.test(text)) return "story_record";
  if (/信任建立|信任|专业|流程|资质|安全|顾虑|放心/.test(text)) return "trust";
  if (/产品\/服务种草|产品|商品|服务|种草|卖点|使用场景|适合谁/.test(text)) return "product_seed";
  return "";
}

function defaultIntentForScene(scene) {
  if (scene === "opening") return "announcement";
  if (scene === "promotion") return "offer_action";
  if (scene === "ecommerce" || scene === "product") return "product_seed";
  if (scene === "service") return "trust";
  if (scene === "store") return "venue_preview";
  return "announcement";
}

function contentIntentLabel(intent) {
  const labels = {
    announcement: "新店/活动告知",
    venue_preview: "场地/空间预览",
    education: "养号科普",
    trust: "信任建立",
    product_seed: "产品/服务种草",
    offer_action: "权益行动",
    comparison: "对比选择",
    story_record: "真实记录",
  };
  return labels[intent] || labels.announcement;
}

function candidateIntentsForScene(scene, brief) {
  const preferred = detectContentIntent(brief, scene);
  const defaults = {
    opening:
      resolveOpeningStage(brief) === "pre_opening"
        ? ["announcement", "venue_preview", "education"]
        : ["announcement", "venue_preview", "offer_action"],
    store: ["venue_preview", "story_record", "trust"],
    product: ["education", "product_seed", "offer_action"],
    promotion: ["offer_action", "product_seed", "trust"],
    launch: ["announcement", "product_seed", "education"],
    anniversary: ["story_record", "trust", "offer_action"],
    ecommerce: ["education", "product_seed", "comparison"],
    service: ["education", "trust", "offer_action"],
    store_product: ["announcement", "product_seed", "offer_action"],
  };
  const list = defaults[scene] || defaults.store_product;
  return [preferred, ...list].filter((item, index, array) => item && array.indexOf(item) === index).slice(0, 3);
}

function buildContentIntentPrompt(brief, task, theme = null) {
  const scene = detectSceneType(brief);
  const intent = detectContentIntent(brief, scene, theme);
  const candidates = candidateIntentsForScene(scene, brief);
  const themeRules =
    task === "themes"
      ? [
          `本次建议生成的 3 个内容目的：${candidates.map(contentIntentLabel).join(" / ")}。`,
          "三个选题的 strategy 必须分别使用这些内容目的名，不能继续只写“认知型/理由型/行动型”。",
          "每个选题必须按对应内容目的填写 contentGoal、storyline、mustInclude、avoid、materialFit、cta。",
          ...candidates.map((item) => buildIntentThemeRules(item, brief)),
        ]
      : [
          `当前选题内容目的：${contentIntentLabel(intent)}。`,
          buildIntentScriptRules(intent, brief),
          "脚本必须按当前内容目的的信息顺序推进；如果 theme.strategy 与 brief 场景冲突，以 theme.strategy 表示的内容目的为准，但不得违反事实边界和创作路径。",
        ];

  return ["【内容目的系统】", ...themeRules].join("\n");
}

function buildIntentThemeRules(intent, brief = {}) {
  const rules = {
    announcement: [
      "【内容目的：新店/活动告知】",
      "选题要解决：用户还不知道这个商家/活动是什么，需要先建立主体认知。",
      "storyline：主体是谁 → 在哪里/什么阶段 → 能提供什么 → 用户下一步关注/收藏/到店/预约。",
      "mustInclude：商家主体、位置/渠道或活动时间、当前状态、行动入口。",
      "avoid：不要写成行业科普、教学成果、产品测评、顾客反馈；不要编造优惠和名额。",
    ],
    venue_preview: [
      "【内容目的：场地/空间预览】",
      "选题要解决：用户想先看环境、位置、路线或空间是否值得关注。",
      "storyline：入口/位置 → 到达路线或空间动线 → 关键环境/设备/陈列 → 适合什么场景 → 收藏/关注。",
      "mustInclude：真实可拍空间、位置/渠道、场地/环境细节、行动入口。",
      "avoid：不要写顾客体验、教学过程、成果案例；没有交通信息不要编造地铁/停车。",
    ],
    education: [
      "【内容目的：养号科普】",
      "选题要解决：用户暂时不一定要消费，但值得先建立认知并关注账号。",
      "storyline：常见疑问/误区 → 正确认知 → 简单解释 → 和商家轻关联 → 关注后续。",
      "mustInclude：一个明确科普问题、克制的行业常识、商家即将提供相关内容或服务的轻提示。",
      "avoid：不得编造本店已有学员、教学成果、教练资质、省队退役、升学加分、免费体验名额、家长好评；不得把“专业教练/训练效果”写成本店事实；不得承诺长高或必然效果；不要使用“黄金期、最佳、最适合、一定要学”等绝对表达。",
    ],
    trust: [
      "【内容目的：信任建立】",
      "选题要解决：用户为什么能放心关注、咨询或预约。",
      "storyline：用户顾虑 → 商家流程/环境/细节 → 可验证证据 → 适合人群 → 咨询/关注。",
      "mustInclude：流程、细节、限制或注意事项、行动入口。",
      "avoid：不得编造资质、证书、案例、客户评价或效果承诺。",
    ],
    product_seed: [
      "【内容目的：产品/服务种草】",
      "选题要解决：用户为什么需要这个产品/服务，它解决什么问题。",
      "storyline：用户痛点/场景 → 产品/服务亮相 → 卖点证据 → 适合谁 → 购买/咨询/到店。",
      "mustInclude：产品/服务主体、一个具体卖点、可拍/可剪证据、行动入口。",
      "avoid：不要只堆形容词；不要让商家背景喧宾夺主；不要编造评价和价格。",
    ],
    offer_action: [
      "【内容目的：权益行动】",
      "选题要解决：用户现在可以做什么，权益/预约/套餐如何理解。",
      "storyline：权益是什么 → 谁适合 → 包含/使用方式 → 时间或条件（仅 brief 提供时） → 领取/预约/到店。",
      "mustInclude：权益或行动入口、适合人群、使用/领取方式。",
      "avoid：不得编造金额、名额、库存、截止时间；不要抢购、秒杀、逼单。",
    ],
    comparison: [
      "【内容目的：对比选择】",
      "选题要解决：用户在几个选择之间不知道怎么判断。",
      "storyline：常见选择困惑 → 对比维度 → 当前产品/服务适合谁 → 如何选择 → 行动入口。",
      "mustInclude：对比维度、适合人群、选择建议、行动入口。",
      "avoid：不要贬低竞品；没有数据不要编造参数、测评结论。",
    ],
    story_record: [
      "【内容目的：真实记录】",
      "选题要解决：通过经营/筹备/日常细节建立真实感和亲近感。",
      "storyline：正在发生什么 → 关键细节 → 商家态度/记忆点 → 用户能期待什么 → 关注/到店。",
      "mustInclude：真实过程、具体细节、商家态度、行动入口。",
      "avoid：不要编造老客故事、销售数据、热闹场面；不要煽情空话。",
    ],
  };
  return (rules[intent] || rules.announcement).join("\n");
}

function buildIntentScriptRules(intent, brief = {}) {
  const rules = {
    announcement: "脚本顺序：主体亮相 → 位置/状态 → 服务/活动范围 → 可信画面 → 关注/收藏/到店/预约。",
    venue_preview: "脚本顺序：入口/位置 → 路线/空间动线 → 场地/环境细节 → 用户能期待什么 → 关注/收藏。",
    education:
      "脚本顺序：家长/用户常见疑问 → 正确认知 → 简单解释 → 商家轻关联 → 关注后续。科普只讲常识，不写本店成果、资质、学员、专业教练事实、升学、免费名额；不要说黄金期、最佳、最适合、一定要学。",
    trust: "脚本顺序：用户顾虑 → 流程/环境/细节 → 可验证证据 → 适合人群/限制 → 咨询/预约。",
    product_seed: "脚本顺序：痛点/场景 → 产品/服务亮相 → 卖点证据画面 → 适合谁 → 行动入口。",
    offer_action: "脚本顺序：权益/行动是什么 → 谁适合 → 怎么用/怎么预约 → 条件（仅 brief 提供时） → 行动入口。",
    comparison: "脚本顺序：选择困惑 → 对比维度 → 当前方案适合谁 → 选择建议 → 行动入口。",
    story_record: "脚本顺序：真实事件/过程 → 关键细节 → 商家态度/记忆点 → 用户期待 → 关注/到店。",
  };
  return `【内容目的脚本规则：${contentIntentLabel(intent)}】\n${rules[intent] || rules.announcement}`;
}

function sceneLabel(scene) {
  const labels = {
    opening: "开业/新店/试营业",
    store: "店铺日常宣传",
    product: "产品/服务种草",
    promotion: "活动/权益/套餐宣传",
    launch: "上新/新品/新服务",
    anniversary: "周年/店庆/节日节点",
    ecommerce: "电商/网店商品宣传",
    service: "本地服务/预约类宣传",
    store_product: "店铺 + 产品/活动综合宣传",
  };
  return labels[scene] || labels.store_product;
}

function buildSceneThemeRules(scene, brief) {
  if (scene === "opening") {
    const stage = resolveOpeningStage(brief);
    const stageRules = {
      pre_opening:
        "开业前：三条选题分别围绕主体亮相、位置/路线/场地筹备、服务范围/开业时间/关注收藏；不得写顾客体验、学员训练、教学成果、销量案例。",
      opening:
        "开业中/试营业：三条选题分别围绕第一眼印象、现场可真实拍到的体验、开业礼遇或到店/预约方式；不得编造热闹排队、好评或成交。",
      post_opening:
        "开业后：三条选题分别围绕经营状态、真实可拍体验、持续到店/预约理由；不得写成开业前预告，也不得编造案例数据。",
    };
    return [
      "【场景选题规则：开业/新店/试营业】",
      stageRules[stage] || stageRules.opening,
      "选题要先解决“用户还不知道这家店”的认知问题，再给出能收藏/关注/到店/预约的理由。",
      "title 可以有传播感，但必须看得出是新店或开业信息，不要变成行业招生、课程成果、产品测评。",
      "脚本主线必须能被无顾客、少素材、手机拍摄的商家执行。",
    ].join("\n");
  }

  if (scene === "store") {
    return [
      "【场景选题规则：店铺日常宣传】",
      "选题要回答：用户为什么会记住这家店、什么场景下会来、它和附近普通选择有什么不同。",
      "三条选题建议拉开为：①第一眼记忆点 ②真实到店/使用场景 ③店铺细节或服务态度形成的信任。",
      "避免只写“环境好、服务好、值得来”这类空泛表达；必须把位置、空间、服务、氛围转成具体到店理由。",
      "不得强行生成具体产品/活动；如果 brief 没给活动，不要编造折扣、套餐或节日。",
    ].join("\n");
  }

  if (scene === "product") {
    return [
      "【场景选题规则：产品/服务种草】",
      "选题要回答：用户为什么需要它、它解决什么问题、用什么画面证明卖点、适合谁/不适合谁。",
      "三条选题建议拉开为：①痛点切入 ②卖点证据/使用场景 ③适合人群与行动入口。",
      "店铺信息只能作为可信背景，不能喧宾夺主写成店铺宣传。",
      "不得只罗列卖点；每个卖点都要能对应一个可拍或可剪画面。",
    ].join("\n");
  }

  if (scene === "promotion") {
    return [
      "【场景选题规则：活动/权益/套餐宣传】",
      "选题要回答：权益是什么、谁适合、为什么现在了解、怎么领取/预约/到店。",
      "三条选题建议拉开为：①权益清楚说明 ②适合人群/场景 ③第一次来或下单怎么选。",
      "表达要克制，像商家正常告知，不要硬广逼单；不得使用抢购、秒杀、最低价等平台敏感词。",
      "不得编造 brief 没提供的优惠金额、名额、库存、截止时间、赠品。",
    ].join("\n");
  }

  if (scene === "launch") {
    return [
      "【场景选题规则：上新/新品/新服务】",
      "选题要回答：为什么上新、第一眼看什么、适合谁、和原有产品/服务有什么关系。",
      "三条选题建议拉开为：①新品亮相 ②新在哪里/差异点 ③使用场景或尝试理由。",
      "不要写成普通产品介绍；必须突出“新”的动机和用户愿意尝试的理由。",
      "不得编造上市时间、库存、限量、测评数据或用户反馈。",
    ].join("\n");
  }

  if (scene === "anniversary") {
    return [
      "【场景选题规则：周年/店庆/节日节点】",
      "选题要回答：这个节点对用户有什么意义，是感谢老客、吸引新客，还是制造再次到店/关注理由。",
      "三条选题建议拉开为：①节点记忆 ②用户关系/感谢 ③节点礼遇或再次到店理由。",
      "避免空泛煽情；必须把节点和店铺记忆点、产品/服务或用户场景绑定。",
      "不得编造经营年限、老客故事、销量、排队、活动金额。",
    ].join("\n");
  }

  if (scene === "ecommerce") {
    return [
      "【场景选题规则：电商/网店商品宣传】",
      "选题要回答：商品解决什么痛点、细节/参数/对比如何证明、用户为什么现在下单或进店看。",
      "三条选题建议拉开为：①使用痛点 ②细节/对比/参数证据 ③下单理由/店铺入口。",
      "不得出现门头、到店、路线、停车、店内空间等线下逻辑。",
      brief.creationMode === "existing"
        ? "如果没有竞品图、截图、评价图或对比素材，不得生成依赖这些画面的对比选题；只能用现有商品图、细节图、使用场景图和字幕完成。"
        : "",
      "根据平台表达：小红书偏真实种草和使用感，抖音偏短平快转化，直播间偏权益和入口。",
    ].filter(Boolean).join("\n");
  }

  if (scene === "service") {
    return [
      "【场景选题规则：本地服务/预约类宣传】",
      "选题要回答：用户有什么痛点、服务流程为什么可信、专业性如何被看见、怎么预约咨询。",
      "三条选题建议拉开为：①问题切入 ②流程/专业信任 ③适合人群与预约路径。",
      "不得夸大效果、承诺必然结果；没有案例就不要编造案例、前后对比或客户评价。",
      "画面优先服务流程、工具/环境、沟通确认、注意事项、预约方式。",
    ].join("\n");
  }

  return [
    "【场景选题规则：店铺 + 产品/活动综合宣传】",
    "选题要同时讲清商家是谁，以及这次产品/活动为什么值得看，二者必须有关联。",
    "三条选题建议拉开为：①商家主体与本次重点 ②产品/活动对用户的理由 ③用户下一步行动。",
    "不要让产品信息淹没商家，也不要只讲店铺而看不出本次宣传重点。",
  ].join("\n");
}

function buildSceneScriptRules(scene, brief) {
  if (scene === "opening") {
    const stage = resolveOpeningStage(brief);
    const stageRules = {
      pre_opening:
        "开业前脚本顺序：主体/品牌亮相 → 位置/路线 → 场地/筹备空镜 → 服务范围大类 → 开业时间或关注收藏。不得出现顾客、学员训练、教学成果。",
      opening:
        "开业中脚本顺序：主体开业状态 → 第一眼环境/服务 → 真实可拍体验 → 开业礼遇或到店/预约方式 → 地址/关注。",
      post_opening:
        "开业后脚本顺序：商家已开始经营 → 真实可拍体验/服务细节 → 持续到店/预约理由 → 地址/关注。",
    };
    return [
      "【场景脚本规则：开业/新店/试营业】",
      stageRules[stage] || stageRules.opening,
      "字幕要像开业告知或真实记录，不要像行业招生广告。",
      "visual 只写当前阶段真实可拍内容；不把目标用户直接写成已有素材。",
    ].join("\n");
  }

  if (scene === "store") {
    return [
      "【场景脚本规则：店铺日常宣传】",
      "信息顺序：第一眼记忆点 → 到店/使用场景 → 空间/服务/氛围证据 → 适合谁 → 收藏/到店。",
      "每段都要把“环境好、服务好”落成具体画面，例如门头、动线、座位、服务动作、细节、地址。",
      "不要突然插入未提供的活动、产品名或价格。",
    ].join("\n");
  }

  if (scene === "product") {
    return [
      "【场景脚本规则：产品/服务种草】",
      "信息顺序：用户需求/痛点 → 产品/服务亮相 → 卖点证据画面 → 适合人群/使用场景 → 行动入口。",
      "subtitle 要少讲形容词，多讲用户能理解的好处；visual 要能证明卖点。",
      "店铺信息只在开头或结尾做可信背景。",
    ].join("\n");
  }

  if (scene === "promotion") {
    return [
      "【场景脚本规则：活动/权益/套餐宣传】",
      "信息顺序：权益/套餐是什么 → 谁适合 → 包含什么/怎么用 → 为什么现在了解 → 领取/预约/到店方式。",
      "如果 brief 没有金额、名额、时间，不得补写；可写“以店内实际信息为准”。",
      "字幕要清楚但克制，不要逼单、喊抢、制造焦虑。",
    ].join("\n");
  }

  if (scene === "launch") {
    return [
      "【场景脚本规则：上新/新品/新服务】",
      "信息顺序：新品/新服务亮相 → 新在哪里 → 适合什么场景/人群 → 体验或细节证据 → 尝试/咨询入口。",
      "不要把新品脚本写成普通产品介绍；必须体现“为什么现在值得看”。",
    ].join("\n");
  }

  if (scene === "anniversary") {
    return [
      "【场景脚本规则：周年/店庆/节日节点】",
      "信息顺序：节点是什么 → 和用户有什么关系 → 店铺记忆点/产品服务 → 节点礼遇或再次到店理由 → 行动入口。",
      "情绪表达要克制具体，不要空泛煽情；没有老客故事就不编故事。",
    ].join("\n");
  }

  if (scene === "ecommerce") {
    return [
      "【场景脚本规则：电商/网店商品宣传】",
      "信息顺序：痛点/使用场景 → 商品亮相 → 细节/参数/对比证据 → 适合谁 → 店铺/直播间/下单入口。",
      "visual 不得写门头、路线、到店、停车；优先商品细节、使用过程、对比图、评价/保障（仅 brief 提供时）。",
      "字幕要像真实种草或商品说明，不要线下探店口吻。",
    ].join("\n");
  }

  if (scene === "service") {
    return [
      "【场景脚本规则：本地服务/预约类宣传】",
      "信息顺序：用户痛点 → 沟通/判断 → 服务流程 → 专业细节/注意事项 → 预约咨询。",
      "不承诺必然效果；没有案例就不写前后对比、客户反馈或成功案例。",
      "visual 优先流程和细节，让用户觉得可信、知道怎么预约。",
    ].join("\n");
  }

  return [
    "【场景脚本规则：店铺 + 产品/活动综合宣传】",
    "信息顺序：商家主体 → 本次产品/活动重点 → 用户为什么需要 → 画面证据 → 行动入口。",
    "店铺和产品/活动都要出现，但不要互相抢主角。",
  ].join("\n");
}

function buildPlatformSafeRules() {
  return [
    "【平台合规 · 必须遵守】",
    "表达风格：像店主或附近邻居真诚分享，生活记录/探店感受，禁止电商硬广、逼单、恐慌式营销。",
    "禁用词（title/hook/promise/shots 均不可出现）：限时抢购、秒杀、最低价、底价、史上最低、促销、满减、清仓、疯抢、抢、爆抢、最后一天、再不买就、血亏、炸裂福利、限时抢、早鸟价、赢在起跑线。",
    "推荐用词：开业礼遇、见面礼、开幕体验、试营业邀您品鉴、筹备进展、即将见面、附近新店、值得期待。",
    "禁止虚假紧迫感、夸大承诺、诱导刷屏式口号。",
  ].join("\n");
}

function buildRealityRules(brief) {
  const stage = resolveOpeningStage(brief);
  const audienceNote = brief.audience?.trim()
    ? `目标用户「${brief.audience}」只用于文案称呼，不得因此假设已有该人群的实拍素材（例如开业前不得出现学生/亲子/情侣约会/顾客满座）。`
    : "不得凭空假设人群场景素材。";

  const factualRules = [
    "【事实边界】只能复述 brief 中明确提供的地址、交通、价格、时间、权益、资质和设施信息。",
    "不得自行补充：地铁站、停车方便、楼下就是某设施、全区唯一/独一份、第一家、最高处、城市景观、休息区、二维码、店铺截图、名额、优惠金额、证书、已有好评、已有顾客。",
    "如果想表达位置便利，只能写成“位置在 brief 提供的地点，可按实际情况补充路线”，不能编造交通条件。",
  ].join("\n");

  if (stage === "pre_opening") {
    return [
      factualRules,
      "【开业前 · 镜头必须符合现实】当前是开业前预热，尚未正式接待顾客。",
      "shots 允许：门头/场馆外观、装修收尾、招牌、场地/空间空镜、器械或陈列到位、团队筹备、前台/接待区、周边路线、可提供的服务品类字幕、开幕时间预告；养号科普类还可使用口播、道具空镜、文字要点和场地空镜。",
      "shots 严禁：任何学员/顾客上课训练、教练现场教学、儿童打球、亲子互动、比赛颁奖、满座、排队、好评截图、销量数据、限购抢购。",
      audienceNote,
    ].join("\n");
  }

  if (stage === "opening") {
    return [
      factualRules,
      "【开业中 · 镜头现实性】可有少量真实到店体验，但不要编造未发生的拥挤营销画面；优先店员接待、环境、产品/服务过程。",
      audienceNote,
    ].join("\n");
  }

  return `${factualRules}\n【镜头现实性】shots 必须基于当前阶段可真实拍到的画面，不得编造。${audienceNote}`;
}

function buildCampaignCore(brief) {
  const parts = [];
  if (brief.direction?.trim()) parts.push(`核心诉求：${brief.direction.trim()}`);
  if (brief.product?.trim()) parts.push(`活动/产品：${brief.product.trim()}`);
  if (brief.productFeature?.trim()) parts.push(`卖点：${brief.productFeature.trim()}`);
  if (brief.timing?.trim()) parts.push(`时间：${brief.timing.trim()}`);
  if (brief.offer?.trim()) parts.push(`权益：${brief.offer.trim()}`);
  if (brief.audience?.trim()) parts.push(`目标用户：${brief.audience.trim()}`);
  if (brief.brandMessage?.trim()) parts.push(`品牌记忆点：${brief.brandMessage.trim()}`);
  return parts.length ? parts.join("；") : "";
}

function buildOpeningAnnouncementRules(brief) {
  const stage = resolveOpeningStage(brief);
  const lines = [
    "【宣传目的：开业/新店告知 · 最高优先级】",
    "这是新店亮相或开幕传播，不是日常经营片、课程招生片、教学成果片、产品种草片。",
    "主题与脚本的信息顺序必须先建立「认知」：商家主体是谁、在哪里、现在是什么阶段、开业后能提供什么大类服务、用户为什么可以先收藏/关注。",
    "商家类型、目标用户、特色描述只能作为背景信息，不得反过来改变视频目的。",
    "不得套用该行业的常规经营叙事：教培/课程类不得写学员成长、从零到一、教学成果、家长顾虑解答、孩子训练过程；餐饮不得写已到店试吃；服务类不得写已完成案例。",
    "brief 里的服务对象可以出现在文案称呼中（如面向家长/少儿），但不得推断出尚未发生的训练、上课、比赛、颁奖等实拍。",
  ];

  if (stage === "pre_opening") {
    lines.push(
      "阶段=开业前预热：语气是「即将见面/先认识/先收藏」；禁止写已开业、已有学员、已有顾客体验、教学过程、效果提升。",
    );
    lines.push(
      "开业前允许的主题主线只有：①商家主体亮相 ②位置/路线告知 ③场地/空间筹备 ④服务范围大类介绍 ⑤开业时间/邀请收藏。",
    );
    lines.push(
      "开业前禁止的主题主线：孩子成长、专业成果可视化、从零到第一拍、家长最关心的问题、课程效果、教学对比、训练挑战、价格优惠冲刺。",
    );
  } else {
    lines.push("阶段=开业/试营业期：可写「初见」「见面」「来看看」；仍以介绍为主，不要写成运营多年的案例片。");
  }

  lines.push(
    "三条主题必须按开业告知分工：①主体与场地亮相 ②位置/路线/空间亮点 ③服务范围与开业信息。不要生成课程转化型或成长型主题。",
  );

  return lines.join("\n");
}

function buildCampaignPurposePrompt(brief, task) {
  const campaignType = detectCampaignType(brief);
  const stage = campaignType === "opening" ? resolveOpeningStage(brief) : null;

  if (campaignType === "opening") {
    const lines = [buildOpeningAnnouncementRules(brief)];
    if (task === "themes") {
      lines.push(
        "主题生成硬要求：title/hook/promise 必须让用户一眼看出这是开业/即将开业信息；不得把「少儿/课程/产品/服务对象」写成主题主线。",
      );
      if (stage === "pre_opening") {
        lines.push(
          "开业前预热的 title 示例方向：『这家店快和大家见面了』『先看看它开在哪里』『开业前先认识一下这里』。不要写『孩子成长』『专业成果』『你的孩子只差一步』。",
        );
      }
    } else {
      lines.push(
        "脚本生成硬要求：第 1 段交代商家主体或位置；第 2-3 段展示场地/筹备/服务大类；最后一段给开业时间、地址或收藏邀请。",
      );
    }
    return lines.join("\n");
  }

  if (campaignType === "anniversary") {
    return [
      "【宣传目的：周年/店庆】",
      "主题围绕庆典记忆、用户关系、回馈礼遇、再次到店/关注理由。",
      "不要写成普通新品种草或开业告知。",
    ].join("\n");
  }

  if (campaignType === "promotion") {
    return [
      "【宣传目的：活动/权益宣传】",
      "主题围绕权益是什么、适合谁、为什么现在了解；表达要清楚但不要硬广逼单。",
      "不要写成纯品牌大片，也不要夸大稀缺和紧迫感。",
    ].join("\n");
  }

  if (campaignType === "launch") {
    return [
      "【宣传目的：上新/新品】",
      "主题围绕新品差异、使用场景、体验感和适合人群。",
      "不要偏成店铺开业或泛泛品牌宣传。",
    ].join("\n");
  }

  if (brief.projectType === "store") {
    return [
      "【宣传目的：日常店铺/商家宣传】",
      "主题围绕商家是谁、在哪里、记忆点是什么、用户为什么可以来/关注。",
      "不要强行写具体产品或活动。",
    ].join("\n");
  }

  if (brief.projectType === "product") {
    return [
      "【宣传目的：产品/服务种草】",
      "主题围绕产品/服务本身、用户痛点、体验场景、信任理由和转化入口。",
      "商家信息只作背景，不要喧宾夺主。",
    ].join("\n");
  }

  return [
    "【宣传目的：店铺 + 产品/活动综合宣传】",
    "主题需要同时讲清商家是谁，以及这次产品/活动为什么值得看。",
  ].join("\n");
}

function buildGlobalSystemPrompt(task) {
  const taskName = {
    themes: "视频选题方向策划",
    script: "分镜脚本",
    rewrite: "脚本改写",
  }[task];

  return [
    `你是服务中国中小商家的营销短视频 ${taskName} agent，熟悉抖音、小红书、视频号的本地生活、电商种草和品牌宣传。`,
    "你必须只返回 JSON，不要 Markdown，不要解释，不要在 JSON 外输出任何文字。",
    "最高目标：生成商家本人或运营人员真的能拍、能剪、能发布的方案，而不是专业导演式空话。",
    "所有建议必须基于 brief，不得编造用户没有提供的素材、顾客、销量、评价、价格、门店状态或活动事实。",
    "表达要像真实商家/运营的自然表达：具体、克制、可执行，避免硬广腔、夸张承诺和平台敏感词。",
    buildPlatformSafeRules(),
  ].join("\n");
}

function buildBusinessTypePrompt(brief) {
  const prompts = {
    offline: [
      "【商家类型：实体店/线下门店】",
      "优先判断：用户为什么要到店、位置/时间是否方便、环境/服务/产品是否能形成记忆点。",
      "主题要落到真实到店理由：门头、空间、产品/服务过程、店员服务、地址时间、用户场景。",
      "不要写成纯品牌大片，也不要默认有大量顾客、排队、热闹现场。",
    ],
    ecommerce: [
      "【商家类型：网店/电商】",
      "优先判断：用户痛点、商品差异、使用场景、下单理由、优惠权益是否讲得清楚。",
      "主题要落到商品卖点、细节展示、使用前后/对比、评价或保障、店铺/直播间入口。",
      "不要套线下到店逻辑，不要要求拍门头或到店场景。",
    ],
    service: [
      "【商家类型：本地服务】",
      "优先判断：客户痛点、专业信任、服务流程、案例结果、预约咨询路径。",
      "主题要落到问题场景、沟通判断、服务过程、结果/反馈、预约方式。",
      "不要夸大效果，不要承诺必然结果；没有案例就不要编造案例。",
    ],
    brand: [
      "【商家类型：品牌/产品方】",
      "优先判断：品牌主张、产品差异、使用场景、渠道转化和用户心智。",
      "主题要落到品牌记忆点、核心差异、产品细节、场景化使用、渠道/购买入口。",
      "不要写成泛泛的门店探店，除非 brief 明确是线下门店活动。",
    ],
  };

  return (prompts[brief.businessType] || prompts.offline).join("\n");
}

function buildCreationModePrompt(brief, task) {
  const mode = brief.creationMode || "existing";
  const routeContext = brief.routeContext?.trim() || "未填写";
  const materialRule = brief.materialRule?.trim() || "未填写";
  const limit = brief.limit?.trim() || "未填写";

  if (mode === "planning") {
    return [
      "【创作路径：帮我规划拍摄】",
      `可拍场景：${routeContext}`,
      `出镜/拍摄条件：${materialRule}`,
      `拍摄限制：${limit}`,
      "输出应像商家可以照着执行的拍摄方案：优先写手机可拍、低成本、少人员、短时间能完成的镜头。",
      "不要写航拍、复杂灯光、大量演员、专业转场、剧情短片等普通商家难以完成的内容。",
      "如果 brief 没写能拍顾客/用户/学员/客户，就不要安排这些人出镜。",
      "脚本 visual 字段必须写“拍什么/怎么拍”，不要写成已有素材剪辑顺序。",
      task === "themes" ? "主题要比较不同拍摄路线的可行性，不能只给好听标题；materialFit 必须说明为什么商家能拍出来。" : "",
    ].filter(Boolean).join("\n");
  }

  if (mode === "mixed") {
    return [
      "【创作路径：已有素材 + 可以补一点】",
      `已有素材：${routeContext}`,
      `可以补拍：${materialRule}`,
      `不能补拍/不想补拍：${limit}`,
      "必须先使用已有素材，只有缺少关键转化画面时才提出少量补拍建议。",
      "不要把方案写成大规模重新拍摄；补拍建议最多承担补洞作用。",
      "补拍建议必须少、具体、必要；如果补拍条件未填写，就把缺口改成字幕、图文、空镜或已有素材重排。",
      "脚本 visual 字段要明确区分“用已有素材”和“建议补拍”。",
    ].join("\n");
  }

  return [
    "【创作路径：直接用现有素材出片】",
    `已有素材：${routeContext}`,
    `必须使用/优先使用：${materialRule}`,
    `限制：${limit}`,
    "这是剪辑结构任务，不是拍摄规划任务。",
    "不得默认要求补拍；不得写需要新拍顾客、口播、复杂剧情的方案。",
    "visual 和 shots 只能安排 brief 已描述的现有素材；不得写未提供的截图、对比图、竞品图、顾客图、店铺页、评价图、示意图、虚拟场景、替代背景。",
    "如果现有素材不足，用字幕、封面文字、局部裁切、图文信息、节奏重排解决，不要假装有新素材，也不要改成补拍方案。",
    "主题和脚本都要围绕已有素材能不能支撑来设计；脚本 visual 字段写“画面/素材安排”，不要写“去拍什么”。",
  ].join("\n");
}

function buildCampaignPrompt(brief) {
  const lines = [];
  const projectType = brief.projectType || "store_product";
  const campaignCore = buildCampaignCore(brief);

  if (campaignCore) {
    lines.push(`【本次宣传核心 · 最高优先级】${campaignCore}`);
    lines.push("所有 title、hook、promise、visual、subtitle、intent 都必须服务这个核心诉求。");
  } else {
    lines.push("【本次宣传核心】brief 未提供明确诉求，只能按商家常规宣传处理；仍需结合商家档案，不要胡乱发散。");
  }

  if (projectType === "store") {
    lines.push(
      "【宣传范围：只做店铺/商家宣传】以商家主体、位置、环境、服务、品牌记忆点为主；不要编造具体产品名或活动名。",
    );
  } else if (projectType === "product") {
    lines.push(
      "【宣传范围：只做产品/服务种草】产品/服务是主角；店铺信息只作可信背景，不要喧宾夺主。",
    );
  } else {
    lines.push("【宣传范围：店铺 + 具体产品/活动】需要同时讲清商家是谁、这次产品/活动为什么值得看，二者要有清晰关联。");
  }

  return lines.join("\n");
}

function videoLengthRules(brief = {}) {
  const key = brief.videoLength || "30s";
  const rules = {
    "15s": {
      label: "15 秒左右",
      min: 12,
      max: 18,
      fallback: 15,
      scriptSegments: "3-4 段",
      guidance: "只适合单一信息点，必须聚焦一个传播动作，不要塞多个卖点。",
    },
    "30s": {
      label: "30 秒左右",
      min: 25,
      max: 35,
      fallback: 30,
      scriptSegments: "5-6 段",
      guidance: "适合讲清一个完整宣传点，可包含主体、理由、证据和行动。",
    },
    "1min": {
      label: "1 分钟左右",
      min: 50,
      max: 70,
      fallback: 60,
      scriptSegments: "7-9 段",
      guidance: "适合解释背景、优势、流程或用户顾虑，必须有清晰信息推进。",
    },
    "3min_plus": {
      label: "3 分钟以上",
      min: 180,
      max: 240,
      fallback: 180,
      scriptSegments: "8-12 段章节式",
      guidance: "适合深度介绍、完整服务流程、品牌故事或详细测评，要按章节推进。",
    },
  };
  return rules[key] || rules["30s"];
}

function buildContentFormatPrompt(brief = {}) {
  const format = brief.contentFormat || "auto";
  const label = brief.contentFormatLabel || "让 AI 按目标判断";
  const prompts = {
    auto: [
      "【内容结构：自动判断】",
      "先根据宣传目的、商家类型、创作路径和视频时长判断最合适的大结构，再在该结构下生成 3 个小选题。",
      "不要把内容结构和选题方向混为一谈：结构是视频逻辑，选题是这条视频为什么值得做。",
    ],
    announcement: [
      "【内容结构：告知介绍型】",
      "适合开业、新店、活动通知、品牌/门店首次亮相。",
      "信息顺序优先：主体是谁 → 在哪里/什么时候 → 提供什么 → 用户下一步做什么。",
    ],
    tour: [
      "【内容结构：带看体验型】",
      "适合门店空间、服务场景、到店路线、环境氛围。",
      "信息顺序优先：入口/到达 → 空间/产品/服务细节 → 用户体验感 → 收藏/到店理由。",
    ],
    reason: [
      "【内容结构：理由种草型】",
      "适合产品、服务、套餐、店铺卖点。",
      "信息顺序优先：用户为什么会在意 → 核心理由 → 证据/画面 → 适合谁 → 行动入口。",
    ],
    problem_solution: [
      "【内容结构：问题解决型】",
      "适合本地服务、课程、咨询、维修护理、痛点明显的产品。",
      "信息顺序优先：常见问题 → 为什么会这样 → 商家怎么解决 → 用户获得什么 → 预约/咨询。",
    ],
    comparison: [
      "【内容结构：对比说明型】",
      "适合同类选择、前后对比、不同套餐/产品解释。",
      "信息顺序优先：对比对象 → 关键差异 → 适合人群 → 如何选择 → 行动入口。",
    ],
    story: [
      "【内容结构：故事记录型】",
      "适合品牌故事、开业筹备、主理人记录、真实经营片。",
      "信息顺序优先：事件/变化 → 关键细节 → 情绪或态度 → 记忆点 → 关注/到店。",
    ],
    offer: [
      "【内容结构：权益行动型】",
      "适合活动权益、套餐、报名预约、开业礼遇。",
      "信息顺序优先：权益是什么 → 谁适合 → 为什么现在了解 → 怎么领取/预约。",
      "表达必须克制，不要使用抢购、秒杀、最低价等平台敏感词。",
    ],
  };

  return [
    `【用户选择的内容结构】${label}`,
    ...(prompts[format] || prompts.auto),
  ].join("\n");
}

function buildVideoLengthPrompt(brief = {}) {
  const rules = videoLengthRules(brief);
  return [
    `【用户选择的视频时长】${rules.label}`,
    `选题 duration 必须在 ${rules.min}-${rules.max} 秒之间；脚本建议 ${rules.scriptSegments}。`,
    rules.guidance,
    "时长会影响内容密度：短视频只保留核心动作，长视频必须增加章节和信息层次，不要简单拉长字幕。",
  ].join("\n");
}

function buildStoreIdentityPrompt(brief, task) {
  const store = brief.store?.trim() || "";
  const storeFeature = brief.storeFeature?.trim() || "";
  const location = brief.location?.trim() || "";
  const brandMessage = brief.brandMessage?.trim() || "";
  const identity = [
    store ? `商家主体=${store}` : "",
    storeFeature ? `商家特色=${storeFeature}` : "",
    location ? `位置/渠道=${location}` : "",
    brandMessage ? `品牌记忆点=${brandMessage}` : "",
  ].filter(Boolean).join("；");

  const base = [
    "【商家档案使用规则 · 必须执行】",
    identity ? `本次必须使用这些商家信息：${identity}` : "商家档案缺失时，不得编造商家名、位置或特色。",
    "不要只围绕行业/产品泛写；必须让结果看起来是为这个具体商家生成的。",
    "如果有商家名称，主题、脚本至少要在关键位置体现商家主体；如果有位置/渠道，至少一个主题或脚本段落要体现位置/渠道；如果有特色或品牌记忆点，必须转化为卖点或字幕表达。",
  ];

  if (task === "themes") {
    base.push(
      "生成主题时：每个 theme 的 reason 必须说明它如何使用商家主体/特色/位置；shots 至少包含一个和商家档案相关的画面（例如门头、场地、渠道入口、空间、服务场景）。",
    );
  } else {
    base.push(
      "生成/改写脚本时：第 1 或第 2 段必须交代商家主体；全片必须至少有一段交代位置/渠道或品牌记忆点；不得生成看不出是哪家店的通用脚本。",
    );
  }

  return base.join("\n");
}

function buildBriefSnapshot(brief) {
  const scene = detectSceneType(brief);
  const intent = detectContentIntent(brief, scene);
  return [
    "【brief 摘要】",
    `商家类型：${brief.businessType || "offline"}`,
    `商家主体：${brief.store || "未填写"}`,
    `商家特色：${brief.storeFeature || "未填写"}`,
    `位置/渠道：${brief.location || "未填写"}`,
    `品牌记忆点：${brief.brandMessage || "未填写"}`,
    `本次宣传范围：${brief.projectType || "store_product"}`,
    `本次目标：${brief.goal || "未推导"}`,
    `识别宣传场景：${sceneLabel(scene)}`,
    `识别内容目的：${contentIntentLabel(intent)}`,
    `发布平台：${brief.platform || "全平台"}`,
    `风格：${brief.style || "自然真实"}`,
    `视频时长：${brief.videoLengthLabel || videoLengthRules(brief).label}`,
    `内容结构：${brief.contentFormatLabel || "让 AI 按目标判断"}`,
    `想宣传什么：${brief.direction || "未填写"}`,
    `目标用户：${brief.audience || "未填写"}`,
    brief.product ? `产品/活动：${brief.product}` : "",
    brief.productFeature ? `卖点：${brief.productFeature}` : "",
    brief.offer ? `价格/权益：${brief.offer}` : "",
    brief.timing ? `时间：${brief.timing}` : "",
  ].filter(Boolean).join("\n");
}

function buildBriefGuidance(brief, task = "themes") {
  return [
    buildBriefSnapshot(brief),
    buildScenePrompt(brief, task),
    buildContentIntentPrompt(brief, task),
    buildStoreIdentityPrompt(brief, task),
    buildBusinessTypePrompt(brief),
    buildCreationModePrompt(brief, task),
    buildVideoLengthPrompt(brief),
    buildContentFormatPrompt(brief),
    buildCampaignPrompt(brief),
    buildRealityRules(brief),
  ].join("\n\n");
}

function buildScriptGuidance(brief, theme) {
  return [
    buildBriefSnapshot(brief),
    buildScenePrompt(brief, "script"),
    buildContentIntentPrompt(brief, "script", theme),
    buildStoreIdentityPrompt(brief, "script"),
    buildBusinessTypePrompt(brief),
    buildCreationModePrompt(brief, "script"),
    buildVideoLengthPrompt(brief),
    buildContentFormatPrompt(brief),
    buildCampaignPrompt(brief),
    buildRealityRules(brief),
  ].join("\n\n");
}

function buildThemeTaskPrompt(brief = {}) {
  const length = videoLengthRules(brief);
  const lines = [
    "【任务：生成视频选题方向】",
    "你不是在写标题，而是在做视频选题决策：这条视频为什么值得做、解决什么传播问题、后续脚本应该怎么推进。",
    "生成 3 个互不重复、可执行的选题方向。",
    "三个选题必须有明确策略分工，不能只是同义改写。默认覆盖：①认知型：让用户知道这是谁/是什么 ②理由型：让用户知道为什么值得看/来/买 ③行动型：让用户知道现在可以怎么做；若场景规则另有分工，以场景规则为准。",
    "每个选题必须说明它解决什么传播问题、为什么适合当前 brief、信息如何推进，以及素材/拍摄可行性。",
    "每个选题必须返回 storyline、mustInclude、avoid、materialFit、cta；这些字段会传给脚本生成，不能写空泛词。",
    "不要生成脱离商家主体的通用行业选题。至少 2 个选题的 title 或 hook 要能看出具体商家、位置/渠道、特色或品牌记忆点。",
    "title 是选题方向名，不是广告标题；hook 是第一秒字幕/旁白，要自然、具体、有信息。",
    "shots 写 4-7 条可执行画面；在 existing 模式下写已有素材可匹配画面，在 planning 模式下写可拍画面，在 mixed 模式下可标注少量补拍。",
    `本次视频时长为${length.label}，duration 必须控制在 ${length.min}-${length.max} 秒，并且选题的信息量要匹配这个时长。`,
  ];

  if (detectSceneType(brief) === "opening" && resolveOpeningStage(brief) === "pre_opening") {
    lines.push(
      "开业前预热可以生成新店告知、场地预览、养号科普，但禁止把选题写成本店已有教学成果、学员成长、比赛案例、家长好评、价格权益冲刺。科普类只能讲行业常识和账号后续内容。",
    );
  }

  return lines.join("\n");
}

function buildScriptTaskPrompt(brief, theme) {
  const length = videoLengthRules(brief);
  const visualLabel =
    brief.creationMode === "planning"
      ? "拍什么（拍摄清单）"
      : brief.creationMode === "mixed"
        ? "素材/补拍安排"
        : "画面/素材安排";

  return [
    "【任务：生成脚本】",
    `根据 brief 和选中的视频选题方向，生成 ${length.scriptSegments} 脚本，时间轴连续覆盖 theme.duration 秒左右。`,
    `本次视频时长要求：${length.label}；${length.guidance}`,
    `选题方向：${theme.title || ""}；选题策略：${theme.strategy || ""}；传播目标：${theme.contentGoal || theme.promise || ""}。`,
    `第一秒钩子：${theme.hook || ""}；视频主线：${normalizePromptArray(theme.storyline).join(" → ")}。`,
    `必须包含：${normalizePromptArray(theme.mustInclude).join(" / ")}。`,
    `不要跑偏到：${normalizePromptArray(theme.avoid).join(" / ")}。`,
    `适用素材/拍摄条件：${theme.materialFit || ""}；结尾动作：${theme.cta || ""}；推荐理由：${theme.reason || ""}。`,
    `visual 字段写法：${visualLabel}。`,
    "每段必须有明确功能：开场抓注意、说明主体/卖点、展示证据或场景、补充权益/信任、行动引导。",
    "脚本必须顺着选题的 storyline 推进，不要重新发明另一个主题。",
    "脚本不能像通用行业模板。第 1-2 段必须让用户知道这是哪个商家/店铺/品牌；如果 brief 有位置/渠道，必须自然放入一段字幕或画面。",
    "subtitle 要像能直接放到视频里的字幕/旁白，短句、口语、具体；intent 写这一段为什么存在。",
    "不要写抽象词堆砌，不要写无法执行的大制作镜头。",
    detectSceneType(brief) === "opening"
      ? "开业前/新店相关脚本必须服从场景和内容目的规则。若是养号科普，可以讲行业常识，但 visual 不得写本店已有学员训练、教练授课成果、儿童打球实拍、证书颁奖、早鸟价促销。"
      : "",
  ].filter(Boolean).join("\n");
}

function normalizePromptArray(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (value) return [String(value).trim()].filter(Boolean);
  return [];
}

function buildRewriteTaskPrompt(instruction) {
  return [
    "【任务：改写完整脚本】",
    `用户改写指令：${instruction || "未填写"}`,
    "先判断用户是要改风格、改节奏、突出价格/权益、弱化营销感、换表达、压缩时长、扩展时长、改成小红书/抖音表达，还是按素材限制重排。",
    "必须返回完整脚本数组，而不是只返回修改片段。",
    "可以调整镜头数量、时长分配、画面、字幕和 intent，但不能偏离 brief、theme 和创作路径约束。",
    "如果用户要求“不要补拍/直接用素材”，必须移除新增拍摄要求。",
    "如果用户要求“更高级”，应改为更克制、有质感、少硬广，不要只替换几个形容词。",
    "如果用户要求“节奏更快”，应减少段落或压缩每段时长，并让字幕更短。",
    "如果用户要求“突出价格/权益”，只能使用 brief 已提供的价格、权益、时间和领取方式，不得编造金额、名额或截止时间。",
    "如果用户要求“更像小红书”，表达更真实、具体、少口号；如果要求“更像抖音”，开头更直接、信息更快，但仍不能硬广逼单。",
    "改写后每段 intent 也要同步改变，不能只改字幕。",
  ].join("\n");
}

function themeOutputContract(brief = {}) {
  const length = videoLengthRules(brief);
  return [
    "【输出 JSON】",
    "{\"themes\":[{\"id\":\"短英文id\",\"title\":\"选题方向名\",\"contentGoal\":\"这条视频要解决的传播问题\",\"strategy\":\"认知型|理由型|行动型|其他明确策略\",\"promise\":\"用户看完能获得什么信息或行动理由\",\"hook\":\"开头钩子\",\"storyline\":[\"信息推进1\",\"信息推进2\",\"信息推进3\"],\"mustInclude\":[\"必须出现的信息\"],\"avoid\":[\"不要跑偏到的方向\"],\"materialFit\":\"适合的素材/拍摄条件\",\"rhythm\":\"节奏/形式\",\"duration\":数字秒数,\"score\":\"优势标签\",\"shots\":[\"建议镜头1\"],\"cta\":\"结尾动作\",\"reason\":\"推荐理由\"}]}",
    `硬性要求：duration 为 ${length.min}-${length.max} 的整数；shots 4-7 条；storyline 3-5 条；mustInclude 2-5 条；avoid 2-5 条；id 用简短英文或拼音；reason 必须说明该选题如何呼应 brief、内容结构与当前创作路径。`,
  ].join("\n");
}

function scriptOutputContract() {
  return [
    "【输出 JSON】",
    "{\"script\":[{\"id\":1,\"time\":\"0-3s\",\"visual\":\"...\",\"subtitle\":\"字幕/旁白\",\"intent\":\"这一段目的\",\"audioStrategy\":\"keep_original|tts_bgm|bgm_only\"}]}",
    "audioStrategy：真人出镜/口播用 keep_original；图文展示/旁白解说用 tts_bgm；纯氛围用 bgm_only。",
  ].join("\n");
}

async function handleThemes(req, res) {
  ensureApiKey();
  const body = await readJson(req);
  const brief = body.brief || {};
  const result = await callDeepSeek({
    system: buildGlobalSystemPrompt("themes"),
    user: [
      buildThemeTaskPrompt(brief),
      buildBriefGuidance(brief, "themes"),
      themeOutputContract(brief),
      `brief=${JSON.stringify(brief)}`,
    ].join("\n\n"),
  });
  const themes = normalizeThemes(result.themes, brief);
  sendJson(res, 200, { themes });
}

async function handleScript(req, res) {
  ensureApiKey();
  const body = await readJson(req);
  const brief = body.brief || {};
  const theme = body.theme || {};
  const result = await callDeepSeek({
    system: buildGlobalSystemPrompt("script"),
    user: [
      buildScriptTaskPrompt(brief, theme),
      buildScriptGuidance(brief, theme),
      scriptOutputContract(),
      `brief=${JSON.stringify(brief)}`,
      `theme=${JSON.stringify(theme)}`,
    ].join("\n\n"),
  });
  const script = normalizeScript(result.script, brief);
  sendJson(res, 200, { script });
}

async function handleRewrite(req, res) {
  ensureApiKey();
  const body = await readJson(req);
  const brief = body.brief || {};
  const theme = body.theme || {};
  const script = body.script || [];
  const instruction = body.instruction || "";
  const result = await callDeepSeek({
    system: buildGlobalSystemPrompt("rewrite"),
    user: [
      buildRewriteTaskPrompt(instruction),
      buildBriefGuidance(brief, "rewrite"),
      scriptOutputContract(),
      `instruction=${instruction}`,
      `brief=${JSON.stringify(brief)}`,
      `theme=${JSON.stringify(theme)}`,
      `currentScript=${JSON.stringify(script)}`,
    ].join("\n\n"),
  });
  const rewritten = normalizeScript(result.script, brief);
  sendJson(res, 200, { script: rewritten });
}

async function handleAssetUpload(req, res) {
  const contentType = req.headers["content-type"] || "";
  if (!contentType.includes("multipart/form-data")) {
    sendJson(res, 400, { error: "请使用 multipart/form-data 上传素材。" });
    return;
  }

  const contentLength = Number(req.headers["content-length"] || 0);
  if (contentLength > maxAssetSizeBytes * maxUploadFiles) {
    sendJson(res, 413, { error: `本次上传总量太大。最多 ${maxUploadFiles} 个素材，单个素材不超过 ${maxAssetSizeMb}MB。` });
    return;
  }

  const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[1] || contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[2];
  if (!boundary) {
    sendJson(res, 400, { error: "上传请求缺少 boundary。" });
    return;
  }

  const body = await readBuffer(req);
  const files = parseMultipartFiles(body, boundary).filter((file) => file.filename && file.data.length);
  if (!files.length) {
    sendJson(res, 400, { error: "没有收到可用素材文件。" });
    return;
  }

  if (files.length > maxUploadFiles) {
    sendJson(res, 400, { error: `一次最多上传 ${maxUploadFiles} 个素材。` });
    return;
  }

  const invalidFile = files.find((file) => !isAllowedAssetType(file.contentType, file.filename));
  if (invalidFile) {
    sendJson(res, 400, { error: `暂不支持「${sanitizeFilename(invalidFile.filename)}」的文件类型。请上传 PNG、JPG、WebP、GIF、MP4、MOV 或 WebM。` });
    return;
  }

  const oversizedFile = files.find((file) => file.data.length > maxAssetSizeBytes);
  if (oversizedFile) {
    sendJson(res, 413, { error: `「${sanitizeFilename(oversizedFile.filename)}」超过 ${maxAssetSizeMb}MB，请压缩后再上传。` });
    return;
  }

  await mkdir(uploadsDir, { recursive: true });
  const assets = [];

  for (const file of files) {
    const safeName = sanitizeFilename(file.filename);
    const ext = normalizedAssetExtension(safeName, file.contentType);
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const storedName = `${id}${ext}`;
    const targetPath = path.join(uploadsDir, storedName);
    await writeFile(targetPath, file.data);
    assets.push({
      id,
      name: safeName,
      type: file.contentType || staticTypes[ext] || "application/octet-stream",
      size: file.data.length,
      url: `/uploads/${storedName}`,
      tags: buildBasicAssetTags(file.contentType, safeName),
      analysisStatus: "basic_saved",
    });
  }

  sendJson(res, 200, { assets });
}

async function handleAssetVisionProfile(req, res) {
  ensureArkApiKey();
  const body = await readJson(req);
  const asset = body.asset || {};
  const assetPath = resolveLocalAssetPath(asset.url);

  if (!assetPath || !existsSync(assetPath)) {
    sendJson(res, 400, { error: "没有找到可识别的本地素材文件。" });
    return;
  }

  const kind = assetKindFromType(asset.type, assetPath);
  if (!["image", "video"].includes(kind)) {
    sendJson(res, 400, { error: "当前只支持图片和视频素材识别。" });
    return;
  }

  const imageDataUrl = kind === "image"
    ? await localImageToDataUrl(assetPath, asset.type)
    : await videoKeyframeToDataUrl(assetPath);
  const result = await callVolcengineVision({
    imageUrl: imageDataUrl,
    assetName: asset.name || path.basename(assetPath),
    mediaKind: kind,
  });
  sendJson(res, 200, { profile: normalizeVisionProfile(result, asset) });
}

async function handleReadCurrentProject(req, res) {
  if (!existsSync(currentProjectPath)) {
    sendJson(res, 404, { error: "还没有保存过本地项目草稿。" });
    return;
  }

  const project = JSON.parse(await readFile(currentProjectPath, "utf8"));
  sendJson(res, 200, { project });
}

async function handleSaveCurrentProject(req, res) {
  const body = await readJson(req);
  const project = body.project || {};
  const snapshot = {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    ...project,
  };
  await mkdir(projectsDir, { recursive: true });
  await writeFile(currentProjectPath, JSON.stringify(snapshot, null, 2));
  sendJson(res, 200, {
    project: snapshot,
    savedTo: relativeRuntimePath(currentProjectPath),
  });
}

async function handleRenderVideo(req, res) {
  if (!ffmpegPath) {
    sendJson(res, 500, { error: "当前项目没有可用 FFmpeg，请先安装 ffmpeg-static。" });
    return;
  }

  const body = await readJson(req);
  const timeline = Array.isArray(body.timeline) ? body.timeline : [];
  const title = body.title || "Video Creator";
  const validation = validateRenderTimeline(timeline);
  if (validation.error) {
    sendJson(res, 400, { error: validation.error });
    return;
  }

  const renderId = `render_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const renderDir = path.join(outputsDir, renderId);
  await mkdir(renderDir, { recursive: true });

  const segmentPaths = [];
  for (const [index, segment] of timeline.entries()) {
    const outputPath = path.join(renderDir, `segment_${String(index + 1).padStart(3, "0")}.mp4`);
    await renderSegment({ segment, outputPath, title });
    segmentPaths.push(outputPath);
  }

  const concatPath = path.join(renderDir, "concat.txt");
  await writeFile(concatPath, segmentPaths.map((item) => `file '${item.replace(/'/g, "'\\''")}'`).join("\n"));
  const outputName = `${renderId}.mp4`;
  const outputPath = path.join(outputsDir, outputName);
  await runFfmpeg(["-y", "-f", "concat", "-safe", "0", "-i", concatPath, "-c", "copy", outputPath]);

  sendJson(res, 200, {
    videoUrl: `/outputs/${outputName}`,
    filename: outputName,
    renderId,
  });
}

function validateRenderTimeline(timeline) {
  if (!timeline.length) {
    return { error: "缺少可渲染的剪辑时间线。" };
  }

  if (timeline.length > maxRenderSegments) {
    return { error: `一次最多渲染 ${maxRenderSegments} 个镜头，请先删减或拆成多条视频导出。` };
  }

  let totalDuration = 0;
  for (const [index, segment] of timeline.entries()) {
    const shotNumber = index + 1;
    const duration = segmentDurationSeconds(segment);

    if (!Number.isFinite(duration) || duration <= 0) {
      return { error: `镜头 ${shotNumber} 的时长异常，请检查开始/结束时间。` };
    }

    if (duration > maxRenderSegmentSeconds) {
      return { error: `镜头 ${shotNumber} 时长约 ${formatSeconds(duration)}，超过单段 ${maxRenderSegmentSeconds} 秒上限，请先拆短。` };
    }

    totalDuration += duration;
    if (totalDuration > maxRenderDurationSeconds) {
      return { error: `当前视频总时长约 ${formatSeconds(totalDuration)}，超过 ${maxRenderDurationSeconds} 秒上限，请先缩短后再导出。` };
    }

    const subtitleLength = compactTextLength(segment.subtitle);
    if (subtitleLength > maxRenderTextLength) {
      return { error: `镜头 ${shotNumber} 字幕/旁白太长，当前约 ${subtitleLength} 字，请控制在 ${maxRenderTextLength} 字以内。` };
    }

    const visualLength = compactTextLength(segment.visualGoal);
    if (visualLength > maxRenderTextLength) {
      return { error: `镜头 ${shotNumber} 的“拍什么”太长，当前约 ${visualLength} 字，请控制在 ${maxRenderTextLength} 字以内。` };
    }
  }

  return { totalDuration };
}

async function renderSegment({ segment, outputPath, title }) {
  const duration = segmentDurationSeconds(segment);
  const assetPath = resolveLocalAssetPath(segment.assetUrl);
  const keepOriginalAudio = segment.audioStrategy === "keep_original"
    || (segment.mediaKind === "video" && segment.audioStrategy !== "bgm_only");
  const assPath = outputPath.replace(/\.mp4$/i, ".ass");
  await writeFile(assPath, buildSegmentAss({
    subtitle: segment.subtitle || "",
    label: `镜头 ${segment.id || ""}`,
    title,
    isCard: !assetPath || segment.mediaKind === "subtitle_card",
    duration,
  }));
  const vf = buildVideoFilter({ assPath });

  if (assetPath && existsSync(assetPath)) {
    const isImage = /\.(png|jpe?g|webp|gif)$/i.test(assetPath);
    if (isImage || !keepOriginalAudio) {
      const visualInputArgs = isImage
        ? ["-loop", "1", "-i", assetPath]
        : ["-stream_loop", "-1", "-i", assetPath];
      await renderWithSilentAudio({ visualInputArgs, duration, vf, outputPath });
    } else {
      await runFfmpeg([
        "-y",
        "-stream_loop",
        "-1",
        "-i",
        assetPath,
        "-t",
        String(duration),
        "-map",
        "0:v:0",
        "-map",
        "0:a?",
        "-vf",
        vf,
        "-r",
        "30",
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-pix_fmt",
        "yuv420p",
        "-shortest",
        "-movflags",
        "+faststart",
        outputPath,
      ]);
    }
    return;
  }

  await renderWithSilentAudio({
    visualInputArgs: ["-f", "lavfi", "-i", `color=c=0x102824:s=1080x1920:d=${duration}`],
    duration,
    vf,
    outputPath,
  });
}

async function renderWithSilentAudio({ visualInputArgs, duration, vf, outputPath }) {
  await runFfmpeg([
    "-y",
    ...visualInputArgs,
    "-f",
    "lavfi",
    "-t",
    String(duration),
    "-i",
    "anullsrc=channel_layout=stereo:sample_rate=44100",
    "-t",
    String(duration),
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-vf",
    vf,
    "-r",
    "30",
    "-c:v",
    "libx264",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-pix_fmt",
    "yuv420p",
    "-shortest",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
}

function segmentDurationSeconds(segment = {}) {
  const duration = Number(segment.duration);
  if (Number.isFinite(duration) && duration > 0) return duration;

  const start = Number(segment.start);
  const end = Number(segment.end);
  if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
    return end - start;
  }

  return NaN;
}

function compactTextLength(value) {
  return String(value || "").replace(/\s+/g, "").length;
}

function formatSeconds(value) {
  const rounded = Math.round(Number(value) * 10) / 10;
  return `${rounded} 秒`;
}

function buildVideoFilter({ assPath }) {
  const base = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920";
  return `${base},subtitles='${escapeSubtitleFilterPath(assPath)}'`;
}

function buildSegmentAss({ subtitle, label, title, isCard, duration }) {
  const fontName = "PingFang SC";
  const end = assTime(duration);
  const titleLine = isCard ? `Dialogue: 0,0:00:00.00,${end},Title,,0,0,0,,${escapeAssText(title)}\n` : "";
  return `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Title, ${fontName}, 68, &H00FFFFFF, &H000000FF, &H66000000, &H66000000, -1, 0, 0, 0, 100, 100, 0, 0, 1, 3, 0, 8, 96, 96, 360, 1
Style: Label, ${fontName}, 32, &HCCFFFFFF, &H000000FF, &H66000000, &H66000000, -1, 0, 0, 0, 100, 100, 0, 0, 1, 2, 0, 1, 54, 54, 292, 1
Style: Subtitle, ${fontName}, 52, &H00FFFFFF, &H000000FF, &HAA000000, &H99000000, -1, 0, 0, 0, 100, 100, 0, 0, 4, 3, 0, 2, 82, 82, 118, 1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${titleLine}Dialogue: 0,0:00:00.00,${end},Label,,0,0,0,,${escapeAssText(label)}
Dialogue: 0,0:00:00.00,${end},Subtitle,,0,0,0,,${wrapAssText(escapeAssText(subtitle), 18)}
`;
}

function assTime(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  const centiseconds = Math.floor((safe - Math.floor(safe)) * 100);
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
}

function wrapAssText(text, maxChars = 18) {
  const normalized = String(text || "").replace(/\s+/g, "");
  if (normalized.length <= maxChars) return normalized;
  const lines = [];
  for (let index = 0; index < normalized.length; index += maxChars) {
    lines.push(normalized.slice(index, index + maxChars));
  }
  return lines.slice(0, 3).join("\\N");
}

function escapeAssText(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/\r?\n/g, "\\N");
}

function escapeSubtitleFilterPath(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/:/g, "\\:");
}

function resolveLocalAssetPath(assetUrl = "") {
  if (!assetUrl || !assetUrl.startsWith("/uploads/")) return "";
  const clean = path.normalize(assetUrl.replace(/^\/uploads\//, ""));
  const filePath = path.join(uploadsDir, clean);
  return filePath.startsWith(uploadsDir) ? filePath : "";
}

async function localImageToDataUrl(filePath, contentType = "") {
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = contentType?.startsWith("image/") ? contentType : staticTypes[ext] || "image/jpeg";
  const data = await readFile(filePath);
  return `data:${mimeType};base64,${data.toString("base64")}`;
}

async function videoKeyframeToDataUrl(filePath) {
  const framePath = path.join(outputsDir, `vision_frame_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`);
  await runFfmpeg([
    "-y",
    "-ss",
    "1",
    "-i",
    filePath,
    "-frames:v",
    "1",
    "-q:v",
    "3",
    framePath,
  ]);
  try {
    return await localImageToDataUrl(framePath, "image/jpeg");
  } finally {
    await unlink(framePath).catch(() => {});
  }
}

function assetKindFromType(contentType = "", filename = "") {
  if (String(contentType).startsWith("image/")) return "image";
  if (String(contentType).startsWith("video/")) return "video";
  const ext = path.extname(String(filename)).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext)) return "image";
  if ([".mp4", ".mov", ".webm", ".m4v"].includes(ext)) return "video";
  return "file";
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args);
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg 渲染失败：${stderr.split("\n").slice(-8).join("\n")}`));
      }
    });
  });
}

function parseMultipartFiles(buffer, boundary) {
  const delimiter = Buffer.from(`--${boundary}`);
  const files = [];
  let cursor = 0;

  while (cursor < buffer.length) {
    const partStart = buffer.indexOf(delimiter, cursor);
    if (partStart === -1) break;
    const contentStart = partStart + delimiter.length;
    if (buffer.slice(contentStart, contentStart + 2).toString() === "--") break;

    const headerStart = buffer.slice(contentStart, contentStart + 2).toString() === "\r\n" ? contentStart + 2 : contentStart;
    const headerEnd = buffer.indexOf(Buffer.from("\r\n\r\n"), headerStart);
    if (headerEnd === -1) break;

    const nextPart = buffer.indexOf(delimiter, headerEnd + 4);
    if (nextPart === -1) break;

    const headers = buffer.slice(headerStart, headerEnd).toString("utf8");
    const disposition = headers.match(/content-disposition:\s*([^\r\n]+)/i)?.[1] || "";
    const filename = disposition.match(/filename="([^"]*)"/i)?.[1] || "";
    const contentType = headers.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || "";
    const dataEnd = nextPart >= 2 && buffer.slice(nextPart - 2, nextPart).toString() === "\r\n" ? nextPart - 2 : nextPart;
    const data = buffer.slice(headerEnd + 4, dataEnd);

    if (filename) {
      files.push({ filename, contentType, data });
    }
    cursor = nextPart;
  }

  return files;
}

function sanitizeFilename(name) {
  const fallback = "asset";
  const clean = path
    .basename(String(name || fallback))
    .replace(/[^\w.\-\u4e00-\u9fa5 ]+/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return clean || fallback;
}

function normalizedAssetExtension(filename, contentType = "") {
  const fromName = path.extname(filename).toLowerCase();
  if (fromName && staticTypes[fromName]) return fromName;
  if (contentType.includes("png")) return ".png";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return ".jpg";
  if (contentType.includes("webp")) return ".webp";
  if (contentType.includes("gif")) return ".gif";
  if (contentType.includes("quicktime")) return ".mov";
  if (contentType.includes("webm")) return ".webm";
  if (contentType.includes("mp4")) return ".mp4";
  return ".bin";
}

function isAllowedAssetType(contentType = "", filename = "") {
  if (allowedAssetTypes.has(contentType)) return true;
  const ext = path.extname(filename).toLowerCase();
  return [".png", ".jpg", ".jpeg", ".webp", ".gif", ".mp4", ".mov", ".webm", ".m4v"].includes(ext);
}

function buildBasicAssetTags(contentType = "", filename = "") {
  const tags = [];
  if (contentType.startsWith("image/")) tags.push("图片");
  if (contentType.startsWith("video/")) tags.push("视频");
  if (/门头|招牌|外观|入口/.test(filename)) tags.push("门头/外观");
  if (/产品|商品|餐|咖啡|饮品|包装/.test(filename)) tags.push("产品");
  if (/环境|空间|店内|座位|装修/.test(filename)) tags.push("环境");
  if (/价格|优惠|海报|活动|权益/.test(filename)) tags.push("信息图");
  return tags.length ? tags : ["待识别"];
}

async function callDeepSeek({ system, user }) {
  const requestBody = JSON.stringify({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.7,
    response_format: { type: "json_object" },
  });

  let response;
  try {
    response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: requestBody,
    });
  } catch (error) {
    if (error?.cause?.code !== "SELF_SIGNED_CERT_IN_CHAIN") {
      throw error;
    }
    console.warn("Node TLS certificate chain issue detected. Retrying DeepSeek request with local development TLS fallback.");
    response = await deepSeekHttpsRequest(requestBody);
  }

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`DeepSeek request failed: ${response.status} ${safeErrorText(text)}`);
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("DeepSeek returned a non-JSON HTTP response.");
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("DeepSeek response did not include message content.");
  }

  return parseJsonContent(content);
}

function deepSeekHttpsRequest(requestBody) {
  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: "api.deepseek.com",
        path: "/chat/completions",
        method: "POST",
        rejectUnauthorized: false,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(requestBody),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            text: async () => body,
          });
        });
      },
    );
    request.on("error", reject);
    request.write(requestBody);
    request.end();
  });
}

function parseJsonContent(content) {
  const cleaned = content
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        // Fall through to the explicit error below.
      }
    }
  }

  throw new Error("AI 输出格式异常：没有返回可解析的 JSON。");
}

function softenMarketingCopy(text) {
  const rules = [
    [/限时抢购|限时抢/g, "开幕礼遇"],
    [/秒杀/g, "专属体验"],
    [/促销/g, "礼遇"],
    [/满减/g, "组合礼遇"],
    [/抢购|疯抢|爆抢/g, "关注"],
    [/最低价|史上最低|底价/g, "诚意价"],
    [/最后一天|再不买就/g, "开幕期间"],
    [/血亏|炸裂福利/g, "见面礼"],
    [/限时供应|限时优惠/g, "开幕期间"],
    [/限时福利/g, "开业礼遇"],
    [/早鸟价?/g, "开幕安排"],
    [/赢在起跑线/g, "值得期待"],
    [/独一份|唯一/g, "有记忆点"],
    [/楼下就是地铁站|地铁站很近|停车方便/g, "位置按实际路线为准"],
    [/宜家风/g, "整洁感"],
    [/从零到一/g, "全新亮相"],
    [/蜕变/g, "新开始"],
    [/最地道的.*启蒙/g, "专业团队"],
  ];
  let result = String(text);
  for (const [pattern, replacement] of rules) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function normalizeThemes(themes, brief = {}) {
  if (!Array.isArray(themes) || themes.length === 0) {
    throw new Error("AI 输出格式异常：themes 必须是数组。");
  }

  const subject =
    brief.projectType === "store"
      ? brief.store || "店铺"
      : brief.product || brief.store || "宣传主体";
  const duration = videoLengthRules(brief);

  return themes.slice(0, 3).map((theme, index) => {
    const intent = detectContentIntent(brief, detectSceneType(brief), theme);
    const fallback = intentFallbackFields(intent, brief, subject);
    return {
      id: String(theme.id || `ai_theme_${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, "_"),
      title: softenMarketingCopy(theme.title || `${subject}方向 ${index + 1}`),
      contentGoal: softenMarketingCopy(theme.contentGoal || theme.promise || fallback.contentGoal),
      strategy: contentIntentLabel(intent),
      promise: softenMarketingCopy(theme.promise || fallback.promise),
      hook: softenMarketingCopy(theme.hook || fallback.hook),
      storyline: normalizeStringArray(theme.storyline, fallback.storyline).map((item) => softenMarketingCopy(item)),
      mustInclude: normalizeStringArray(theme.mustInclude, fallback.mustInclude).map((item) => softenMarketingCopy(item)),
      avoid: normalizeStringArray(theme.avoid, fallback.avoid).map((item) => softenMarketingCopy(item)),
      materialFit: softenMarketingCopy(theme.materialFit || fallback.materialFit),
      rhythm: String(theme.rhythm || fallback.rhythm),
      duration: clampNumber(theme.duration, duration.min, duration.max, duration.fallback),
      score: String(theme.score || fallback.score),
      shots: normalizeStringArray(theme.shots, fallback.shots).map((shot) => sanitizeExistingAssetText(softenMarketingCopy(shot), brief)),
      cta: softenMarketingCopy(theme.cta || fallback.cta),
      reason: softenMarketingCopy(theme.reason || fallback.reason),
    };
  });
}

function intentFallbackFields(intent, brief, subject) {
  const location = brief.location || "位置/渠道";
  const direction = brief.direction || "本次宣传重点";
  const common = {
    materialFit: "适合按当前素材和拍摄条件执行。",
    rhythm: "自然短视频",
    score: "推荐",
    reason: `呼应「${direction}」，适合${brief.platform || "平台"}发布。`,
  };
  const fields = {
    announcement: {
      contentGoal: `让用户知道${subject}是谁、在哪里、当前是什么状态。`,
      promise: `看完能知道${subject}的关键信息和下一步怎么关注。`,
      hook: `${subject}准备和大家见面了，先认识一下。`,
      storyline: ["亮出主体", "说明位置/阶段", "介绍服务或活动范围", "引导关注/收藏"],
      mustInclude: [subject, location, direction, "关注/收藏"],
      avoid: ["行业泛泛科普", "编造优惠名额", "已有顾客或学员成果"],
      shots: ["门头/主体画面", "位置或空间", "服务范围字幕", "行动入口"],
      cta: "先关注/收藏，后续信息及时了解。",
    },
    venue_preview: {
      contentGoal: "用位置、路线或空间画面降低用户了解门槛。",
      promise: "看完知道这里大概长什么样、怎么找到、是否值得关注。",
      hook: "先带你看一眼这个空间。",
      storyline: ["入口/位置", "路线或空间动线", "关键环境细节", "用户期待", "关注/收藏"],
      mustInclude: [subject, location, "真实可拍空间", "关注/收藏"],
      avoid: ["编造交通条件", "顾客体验", "教学成果"],
      shots: ["入口/门头", "路线/动线", "空间空镜", "细节特写", "地址/关注"],
      cta: "先收藏，后续开放信息继续更新。",
    },
    education: {
      contentGoal: "先建立用户对相关产品/服务/行业的正确认知，适合养号。",
      promise: "看完能获得一个有用的入门常识，而不是被硬广推销。",
      hook: "很多人第一次了解这件事，都会先误会这一点。",
      storyline: ["常见疑问/误区", "正确认知", "简单解释", "商家轻关联", "关注后续"],
      mustInclude: ["一个明确科普问题", "克制常识解释", subject, "关注后续内容"],
      avoid: ["本店已有学员或客户", "教学成果或案例", "教练资质", "升学加分", "免费体验名额", "效果承诺", "黄金期/最佳等绝对表达"],
      shots: ["口播或字幕开场", "道具/场地空镜", "文字要点", "商家轻关联画面", "关注提示"],
      cta: "后续会继续分享相关入门内容，可以先关注。",
    },
    trust: {
      contentGoal: "降低用户顾虑，建立可信感。",
      promise: "看完知道商家在流程、环境或细节上为什么值得了解。",
      hook: "真正让人放心的地方，通常藏在这些细节里。",
      storyline: ["用户顾虑", "流程/环境/细节", "可验证证据", "适合人群", "咨询/预约"],
      mustInclude: [subject, "流程或细节", "限制或注意事项", "咨询/预约"],
      avoid: ["编造证书资质", "客户好评", "效果承诺", "成功案例"],
      shots: ["环境/工具", "流程细节", "注意事项字幕", "联系方式/预约入口"],
      cta: "想了解可以先咨询/关注。",
    },
    product_seed: {
      contentGoal: "说明产品/服务为什么值得用户了解。",
      promise: "看完知道它解决什么问题、适合谁。",
      hook: "如果你也有这个需求，可以先看这一点。",
      storyline: ["痛点/场景", "产品/服务亮相", "卖点证据", "适合人群", "行动入口"],
      mustInclude: [subject, brief.product || "产品/服务主体", "具体卖点", "行动入口"],
      avoid: ["只堆形容词", "编造评价价格", "喧宾夺主写店铺"],
      shots: ["主体画面", "细节特写", "使用/场景画面", "行动入口"],
      cta: "需要的话可以进店/咨询了解。",
    },
    offer_action: {
      contentGoal: "讲清用户现在可以获得什么或怎么行动。",
      promise: "看完知道权益/预约/套餐是什么、怎么了解。",
      hook: "这次重点可以先看这几个信息。",
      storyline: ["权益/行动是什么", "谁适合", "怎么用/怎么预约", "条件说明", "行动入口"],
      mustInclude: [subject, brief.offer || "权益/行动入口", "适合人群", "领取/预约方式"],
      avoid: ["编造金额", "编造名额", "编造截止时间", "抢购逼单"],
      shots: ["权益字幕", "主体画面", "适合人群说明", "预约/咨询入口"],
      cta: "想了解可以先咨询/预约。",
    },
    comparison: {
      contentGoal: "帮助用户在不同选择之间建立判断标准。",
      promise: "看完知道该看哪些差异，以及自己适合哪种。",
      hook: "别急着选，先看这几个区别。",
      storyline: ["选择困惑", "对比维度", "适合人群", "选择建议", "行动入口"],
      mustInclude: ["对比维度", subject, "适合人群", "行动入口"],
      avoid: ["贬低竞品", "编造参数", "虚构测评结论"],
      shots: ["对比字幕", "细节画面", "适合人群说明", "行动入口"],
      cta: "不确定的话可以先咨询/了解。",
    },
    story_record: {
      contentGoal: "用真实过程或经营细节建立亲近感。",
      promise: "看完能感受到商家的真实状态和态度。",
      hook: "今天想记录一下这里正在发生的事。",
      storyline: ["真实事件/过程", "关键细节", "商家态度", "用户期待", "关注/到店"],
      mustInclude: [subject, "真实过程", "具体细节", "关注/到店"],
      avoid: ["编造老客故事", "编造热闹场面", "销售数据", "空泛煽情"],
      shots: ["筹备/经营过程", "细节特写", "空间/人员动作", "关注提示"],
      cta: "后续继续更新，可以先关注。",
    },
  };
  return { ...common, ...(fields[intent] || fields.announcement) };
}

function normalizeScript(script, brief = {}) {
  if (!Array.isArray(script) || script.length === 0) {
    throw new Error("AI 输出格式异常：script 必须是数组。");
  }
  const maxSegments = brief.videoLength === "3min_plus" ? 12 : brief.videoLength === "1min" ? 9 : brief.videoLength === "15s" ? 5 : 8;

  return script.slice(0, maxSegments).map((shot, index) => ({
    id: Number(shot.id) || index + 1,
    time: String(shot.time || `${index * 3}-${(index + 1) * 3}s`),
    visual: sanitizeExistingAssetText(softenMarketingCopy(shot.visual || "根据素材安排画面。"), brief),
    subtitle: softenMarketingCopy(shot.subtitle || "补充字幕/旁白。"),
    intent: softenMarketingCopy(shot.intent || "推进宣传目标。"),
    audioStrategy: normalizeAudioStrategy(shot.audioStrategy),
  }));
}

function sanitizeExistingAssetText(text, brief = {}) {
  if (brief.creationMode !== "existing") return text;
  const known = [brief.routeContext, brief.materialRule].filter(Boolean).join(" ");
  let result = String(text);

  if (!/桌面使用图|桌面场景图/.test(known)) {
    result = result.replace(/桌面使用图|桌面场景图|虚拟桌面场景/g, "商品主图配“适合桌面收纳”字幕");
  }
  if (!/截图|店铺页|二维码/.test(known)) {
    result = result.replace(/店铺页面截图|店铺页截图|二维码|预约二维码/g, "文字行动入口");
  }
  if (!/评价|好评|反馈/.test(known)) {
    result = result.replace(/评价截图|好评截图|客户反馈|买家反馈/g, "文字说明");
  }
  if (!/对比|竞品/.test(known)) {
    result = result.replace(/竞品图|对比图|竞品对比/g, "文字对比要点");
  }

  return result;
}

function normalizeAudioStrategy(value) {
  return ["keep_original", "tts_bgm", "bgm_only"].includes(value) ? value : "tts_bgm";
}

async function callVolcengineVision({ imageUrl, assetName, mediaKind = "image" }) {
  const prompt = [
    "你是短视频剪辑素材识别助手。请只输出 JSON，不要输出 Markdown。",
    mediaKind === "video"
      ? "任务：识别这个商家短视频素材的关键帧，服务于本地生活/门店宣传剪辑匹配。请基于关键帧判断视频可能适合的画面用途。"
      : "任务：识别这张商家短视频素材图片，服务于本地生活/门店宣传剪辑匹配。",
    "重点判断：门头/外观、环境/空间、人物/过程、产品/服务、信息/海报、少儿/儿童、教学/培训、运动场景、中文招牌/OCR、画面质量、适合放在哪类镜头。",
    "输出格式：",
    "{\"labels\":[\"标签\"],\"summary\":\"一句话素材画像\",\"confidence\":0-100,\"signals\":[\"识别依据\"],\"ocr\":[\"画面文字\"],\"quality\":\"清晰度较好|清晰度可用|尺寸偏小|待确认\",\"recommendedUse\":[\"适合用途\"],\"avoidUse\":[\"不适合用途\"]}",
    `素材文件名：${assetName}`,
  ].join("\n");

  const response = await fetch(`${arkBaseUrl.replace(/\/$/, "")}/api/v3/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${arkApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: arkVisionModel,
      input: [
        {
          role: "user",
          content: [
            { type: "input_image", image_url: imageUrl },
            { type: "input_text", text: prompt },
          ],
        },
      ],
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`火山视觉识别失败：${response.status} ${safeErrorText(text)}`);
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("火山视觉接口返回了非 JSON 响应。");
  }

  return extractResponseJson(payload);
}

function normalizeVisionProfile(result = {}, asset = {}) {
  const labels = normalizeStringArray(result.labels, []);
  const signals = normalizeStringArray(result.signals, []);
  const ocr = normalizeStringArray(result.ocr, []);
  const recommendedUse = normalizeStringArray(result.recommendedUse, []);
  const avoidUse = normalizeStringArray(result.avoidUse, []);
  return {
    version: 1,
    source: "vision_model",
    provider: "volcengine",
    model: arkVisionModel,
    confidence: clampNumber(result.confidence, 0, 100, labels.length ? 75 : 50),
    labels: labels.slice(0, 16),
    signals: [...signals, ...ocr.map((item) => `OCR：${item}`)].slice(0, 10),
    ocr,
    mediaKind: assetKindFromType(asset.type, asset.url),
    orientation: result.orientation || "",
    quality: result.quality || "待确认",
    summary: result.summary || "视觉模型已完成素材识别。",
    recommendedUse,
    avoidUse,
    modelReady: true,
  };
}

function extractResponseJson(response) {
  const text = extractResponseText(response);
  const jsonText = text.match(/```json\s*([\s\S]*?)```/i)?.[1]
    || text.match(/```\s*([\s\S]*?)```/)?.[1]
    || text.match(/\{[\s\S]*\}/)?.[0]
    || "";
  if (!jsonText) {
    throw new Error("火山视觉模型没有返回可解析的 JSON。");
  }
  try {
    return JSON.parse(jsonText);
  } catch {
    throw new Error("火山视觉模型返回的 JSON 格式异常。");
  }
}

function extractResponseText(response) {
  if (typeof response.output_text === "string") return response.output_text;
  if (Array.isArray(response.output)) {
    const parts = [];
    for (const item of response.output) {
      if (typeof item.content === "string") parts.push(item.content);
      if (Array.isArray(item.content)) {
        item.content.forEach((content) => {
          if (typeof content.text === "string") parts.push(content.text);
          if (typeof content.output_text === "string") parts.push(content.output_text);
        });
      }
    }
    if (parts.length) return parts.join("\n");
  }
  if (Array.isArray(response.choices)) {
    return response.choices.map((choice) => choice.message?.content || choice.text || "").filter(Boolean).join("\n");
  }
  return "";
}

function normalizeStringArray(value, fallback) {
  if (!Array.isArray(value)) return fallback;
  const items = value.map((item) => String(item).trim()).filter(Boolean);
  return items.length ? items : fallback;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function ensureApiKey() {
  if (!apiKey) {
    throw new Error("缺少 DEEPSEEK_API_KEY。请在项目根目录创建 .env 并填入 DeepSeek API Key。");
  }
}

function ensureArkApiKey() {
  if (!arkApiKey) {
    throw new Error("缺少 ARK_API_KEY。请在项目根目录 .env 中填入火山方舟 API Key。");
  }
}

async function serveStatic(req, res) {
  const requestedUrl = new URL(req.url, `http://localhost:${port}`);
  const pathname = requestedUrl.pathname === "/" ? "/index.html" : requestedUrl.pathname;
  const safePath = path.normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = path.join(__dirname, safePath);

  if (!filePath.startsWith(__dirname)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  if (!existsSync(filePath)) {
    sendText(res, 404, "Not found");
    return;
  }

  const ext = path.extname(filePath);
  const data = await readFile(filePath);
  res.writeHead(200, {
    "Content-Type": staticTypes[ext] || "application/octet-stream",
    "Content-Length": data.length,
  });
  res.end(req.method === "HEAD" ? undefined : data);
}

async function readJson(req) {
  const buffer = await readBuffer(req);
  const text = buffer.toString("utf8");
  if (!text) return {};
  return JSON.parse(text);
}

async function readBuffer(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function sendText(res, status, text) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function loadEnv(filePath) {
  if (!existsSync(filePath)) return {};
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  const values = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    values[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
  return values;
}

function safeErrorText(text) {
  try {
    const parsed = JSON.parse(text);
    return parsed?.error?.message || parsed?.message || text.slice(0, 300);
  } catch {
    return text.slice(0, 300);
  }
}
