const els = {
  venueNameLabel: document.querySelector("#venueNameLabel"),
  profileStatus: document.querySelector("#profileStatus"),
  profileShortcutBtn: document.querySelector("#profileShortcutBtn"),
  aiShortcutBtn: document.querySelector("#aiShortcutBtn"),
  saveProfileBtn: document.querySelector("#saveProfileBtn"),
  saveAiBtn: document.querySelector("#saveAiBtn"),
  aiStatus: document.querySelector("#aiStatus"),
  activeProviderInput: document.querySelector("#activeProviderInput"),
  planBtn: document.querySelector("#planBtn"),
  planChrome: document.querySelector("#planChrome"),
  planBreadcrumb: document.querySelector("#planBreadcrumb"),
  planActions: document.querySelector("#planActions"),
  planSubpage: document.querySelector("#planSubpage"),
  planPageList: document.querySelector("#planPageList"),
  planListContent: document.querySelector("#planListContent"),
  planPageSetup: document.querySelector("#planPageSetup"),
  planPageBoard: document.querySelector("#planPageBoard"),
  planBoardContent: document.querySelector("#planBoardContent"),
  planSetupAlert: document.querySelector("#planSetupAlert"),
  planStageContext: document.querySelector("#planStageContext"),
  topicsGenerateBtn: document.querySelector("#topicsGenerateBtn"),
  topicsCampaignBtn: document.querySelector("#topicsCampaignBtn"),
  topicsReferenceBtn: document.querySelector("#topicsReferenceBtn"),
  topicsManualBtn: document.querySelector("#topicsManualBtn"),
  topicsChrome: document.querySelector("#topicsChrome"),
  topicsBreadcrumb: document.querySelector("#topicsBreadcrumb"),
  topicsActions: document.querySelector("#topicsActions"),
  topicsPageLibrary: document.querySelector("#topicsPageLibrary"),
  topicsPageGenerate: document.querySelector("#topicsPageGenerate"),
  topicsGenerateContent: document.querySelector("#topicsGenerateContent"),
  topicsModalRoot: document.querySelector("#topicsModalRoot"),
  topicLibraryToolbar: document.querySelector("#topicLibraryToolbar"),
  topicSearchInput: document.querySelector("#topicSearchInput"),
  topicShowArchived: document.querySelector("#topicShowArchived"),
  communityBtn: document.querySelector("#communityBtn"),
  groupTypeTabs: document.querySelector("#groupTypeTabs"),
  communityHistory: document.querySelector("#communityHistory"),
  planView: document.querySelector("#planView"),
  topicsView: document.querySelector("#topicsView"),
  topicsResult: document.querySelector("#topicsResult"),
  contentView: document.querySelector("#contentView"),
  campaignView: document.querySelector("#campaignView"),
  libraryView: document.querySelector("#libraryView"),
  libraryResult: document.querySelector("#libraryResult"),
  channelsView: document.querySelector("#channelsView"),
  channelsResult: document.querySelector("#channelsResult"),
  profileView: document.querySelector("#profileView"),
  aiView: document.querySelector("#aiView"),
  navItems: Array.from(document.querySelectorAll(".nav-item")),
  agentDock: document.querySelector("#agentDock"),
  agentFab: document.querySelector("#agentFab"),
  agentPanel: document.querySelector("#agentPanel"),
  agentContextLabel: document.querySelector("#agentContextLabel"),
  agentExpandBtn: document.querySelector("#agentExpandBtn"),
  agentMessages: document.querySelector("#agentMessages"),
  agentInput: document.querySelector("#agentInput"),
  agentSendBtn: document.querySelector("#agentSendBtn"),
  agentCloseBtn: document.querySelector("#agentCloseBtn"),
  fields: {
    name: document.querySelector("#nameInput"),
    shortName: document.querySelector("#shortNameInput"),
    city: document.querySelector("#cityInput"),
    location: document.querySelector("#locationInput"),
    stage: document.querySelector("#stageInput"),
    positioning: document.querySelector("#positioningInput"),
    services: document.querySelector("#servicesInput"),
    audiences: document.querySelector("#audiencesInput"),
    tone: document.querySelector("#toneInput"),
    booking: document.querySelector("#bookingInput"),
    wechat: document.querySelector("#wechatInput"),
  },
  task: {
    goal: document.querySelector("#goalInput"),
    audience: document.querySelector("#audienceInput"),
    contentCadence: document.querySelector("#contentCadenceInput"),
    focus: document.querySelector("#focusInput"),
    eventInfo: document.querySelector("#eventInput"),
  },
};

let profile = null;
let currentTopics = [];
let topicLibraryData = null;
let directionSession = null;
let savedDirectionIds = new Set();
let topicFilters = { search: "", showArchived: false };
let topicCategory = null;
let currentPlan = null;
let currentPlanId = null;
let plansIndex = [];
let currentTopic = null;
let currentPlanSlot = null;
let currentPlanSlotIndex = null;
let currentContentData = null;
let contentBrief = null;
let materialReady = false;
let finishedContent = [];
let libraryFormatFilter = "all";
let libraryViewMode = "byPlan";
let communityReady = false;
let communityPlansByGroup = {};
let communityIndex = [];
let currentGroupType = "prospect_parents";
let currentCampaignPlan = null;
let currentCampaignBrief = "";
let currentCampaignId = "";
let campaignsIndex = [];
let campaignReady = false;
const CAMPAIGN_MATERIAL_FORMATS = [
  "campaign_poster",
  "campaign_invite",
  "campaign_signup",
  "campaign_faq",
  "campaign_notice",
];
const CAMPAIGN_MATERIAL_LABELS = {
  campaign_poster: "海报文字",
  campaign_invite: "邀请文案",
  campaign_signup: "报名接龙",
  campaign_faq: "答疑 FAQ",
  campaign_notice: "家长须知",
};
const CAMPAIGN_MATERIAL_DESCRIPTIONS = {
  campaign_poster: "朋友圈/电梯口/前台易拉宝：主标+副标+亮点+时间地点+卖点+CTA+视觉",
  campaign_invite: "一对一私聊 / 老学员朋友圈定向邀约文字",
  campaign_signup: "群内接龙模板 + 报名字段",
  campaign_faq: "5-8 条家长可能问的问题 + 回答",
  campaign_notice: "活动当天流程 + 注意事项 + 到场准备清单",
};
let topicsReady = false;
let activeView = "plan";
let agentSession = { open: false, expanded: false, messages: [], priorBrief: null, lastMode: null, busy: false, pendingResult: false, activeResult: null, activeFormat: null };
let currentRoute = { module: "plan", page: "setup", slotIndex: null };
let profileReturnRoute = null;
let apiBase = "";
const generatedMaterials = {};
const materialAiMeta = {};
const providerIds = ["openai", "deepseek", "gemini", "doubao"];

const stageLabelMap = {
  pre_opening: "开业前预热",
  trial: "试营业",
  open: "正式运营",
  daily: "日常经营",
};

const materialTypes = [
  {
    type: "video",
    label: "视频脚本",
    channel: "小红书 / 抖音 / 视频号",
    description: "适合需要镜头、字幕、剪辑提示和发布文案的短视频。",
  },
  {
    type: "xhs_image",
    label: "小红书图文",
    channel: "小红书",
    description: "适合沉淀搜索、讲清楚问题、搭配图片和图上文字。",
  },
  {
    type: "moments_text",
    label: "朋友圈文案",
    channel: "微信朋友圈",
    description: "适合熟人私域，表达更自然，轻提醒和轻转化。",
  },
  {
    type: "community",
    label: "社群话术",
    channel: "微信群",
    description: "适合群内互动、收集意向、答疑和活动提醒。",
  },
  {
    type: "campaign_poster",
    label: "活动物料 · 海报文字",
    channel: "朋友圈 / 电梯口 / 前台易拉宝",
    description: "主标 + 副标 + 活动亮点 + 时间地点 + 3 条卖点 + CTA + 视觉建议。",
  },
  {
    type: "campaign_invite",
    label: "活动物料 · 邀请文案",
    channel: "一对一 / 朋友圈定向",
    description: "一对一私聊 / 老学员朋友圈定向邀约文字。",
  },
  {
    type: "campaign_signup",
    label: "活动物料 · 报名接龙",
    channel: "微信群",
    description: "群内接龙模板 + 报名字段。",
  },
  {
    type: "campaign_faq",
    label: "活动物料 · 答疑 FAQ",
    channel: "群 / 朋友圈 / 私信",
    description: "5-8 条家长可能问的问题 + 回答。",
  },
  {
    type: "campaign_notice",
    label: "活动物料 · 家长须知",
    channel: "群 / 私信 / 打印",
    description: "活动当天流程 + 注意事项 + 到场准备清单。",
  },
];

function linesToArray(value) {
  return String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function arrayToLines(value) {
  return Array.isArray(value) ? value.join("\n") : "";
}

async function apiRequest(url, payload, method) {
  const token = getAccessToken();
  const withToken = token && !/[?&]token=/.test(url) ? `${url}${url.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}` : url;
  const target = `${apiBase}${withToken}`;
  const httpMethod = method || (payload ? "POST" : "GET");
  const baseHeaders = token ? { authorization: `Bearer ${token}` } : {};
  const options = httpMethod === "GET"
    ? { headers: { ...baseHeaders } }
    : {
        method: httpMethod,
        headers: { ...baseHeaders, "content-type": "application/json" },
        body: payload ? JSON.stringify(payload) : undefined,
      };
  let response;
  try {
    response = await fetch(target, options);
  } catch {
    throw new Error("无法连接本地服务。请确认 npm run dev 正在运行且终端没有报错；若刚才有 ERR_HTTP_HEADERS_SENT，请重启服务后再试。");
  }

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    if (response.status === 401 && data?.authRequired) {
      clearAccessToken();
      promptForAccessToken();
      throw new Error("需要访问令牌");
    }
    if (response.status === 405 && payload) {
      throw new Error("当前服务版本过旧，缺少 API 接口。请停止旧进程后重新运行 npm run dev，再刷新页面。");
    }
    throw new Error(data.error || `请求失败 (${response.status})`);
  }
  return data;
}

// 访问令牌管理：URL ?token=xxx 优先，存到 localStorage 后剥离 URL。
// 401 时清掉并弹窗重新输入。
const ACCESS_TOKEN_KEY = "tennisAccessToken";

function getAccessToken() {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("token");
    if (fromUrl) {
      window.localStorage.setItem(ACCESS_TOKEN_KEY, fromUrl);
      const cleaned = new URL(window.location.href);
      cleaned.searchParams.delete("token");
      window.history.replaceState({}, "", cleaned.toString());
    }
  } catch {}
  try {
    return window.localStorage.getItem(ACCESS_TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

function clearAccessToken() {
  try { window.localStorage.removeItem(ACCESS_TOKEN_KEY); } catch {}
}

function promptForAccessToken() {
  const existing = document.getElementById("accessTokenOverlay");
  if (existing) existing.remove();
  const overlay = document.createElement("div");
  overlay.id = "accessTokenOverlay";
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;z-index:9999;padding:24px";
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:28px;max-width:380px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.25)">
      <h2 style="margin:0 0 8px;font-size:18px">需要访问令牌</h2>
      <p style="margin:0 0 16px;color:#6b7280;font-size:14px">令牌不正确或已失效，请重新输入。</p>
      <input id="accessTokenInput" type="password" placeholder="访问令牌" style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;box-sizing:border-box">
      <div style="display:flex;gap:8px;margin-top:16px">
        <button id="accessTokenConfirm" style="flex:1;padding:10px 16px;background:#111827;color:#fff;border:0;border-radius:8px;font-size:14px;cursor:pointer">进入</button>
        <button id="accessTokenCancel" style="padding:10px 16px;background:#f3f4f6;color:#111827;border:0;border-radius:8px;font-size:14px;cursor:pointer">取消</button>
      </div>
      <div id="accessTokenError" style="color:#b91c1c;font-size:13px;margin-top:10px;min-height:18px"></div>
    </div>`;
  document.body.appendChild(overlay);
  const input = overlay.querySelector("#accessTokenInput");
  const confirm = overlay.querySelector("#accessTokenConfirm");
  const cancel = overlay.querySelector("#accessTokenCancel");
  const err = overlay.querySelector("#accessTokenError");
  input.focus();
  const submit = () => {
    const v = input.value.trim();
    if (!v) { err.textContent = "请输入令牌"; return; }
    window.localStorage.setItem(ACCESS_TOKEN_KEY, v);
    overlay.remove();
    location.reload();
  };
  confirm.onclick = submit;
  cancel.onclick = () => overlay.remove();
  input.onkeydown = (e) => { if (e.key === "Enter") submit(); };
}

// 启动时如果服务器要求 token 但本地没有，把覆盖层挂上（防止用户瞎点 API 直接 401 一片报错）。
(function ensureTokenOverlayOnBoot() {
  const token = getAccessToken();
  if (!token) {
    // 延迟到 DOM 可用再挂；这里用一个轻探针：发一次 /api/health，不带 token，看是否 401。
    fetch(`${apiBase}/api/health`).then(async (r) => {
      if (r.status === 401) promptForAccessToken();
    }).catch(() => { /* 服务器还没起来，不弹 */ });
  }
})();

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderList(items) {
  return `<ul>${(items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderPills(items) {
  return `<ul class="pill-list">${(items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderSimpleCards(items, className = "") {
  return (items || []).map((item) => {
    if (typeof item === "string") return `<article class="mini-card ${className}"><p>${escapeHtml(item)}</p></article>`;
    const title = item.title || item.name || item.phase || item.step || item.channel || item.item || "";
    const body = item.description || item.angle || item.action || item.message || item.notes || item.reason || item.value || "";
    const meta = item.suitableFor || item.time || item.format || item.deadline || item.owner || "";
    return `
      <article class="mini-card ${className}">
        ${title ? `<strong>${escapeHtml(title)}</strong>` : ""}
        ${body ? `<p>${escapeHtml(body)}</p>` : ""}
        ${meta ? `<small>${escapeHtml(meta)}</small>` : ""}
      </article>
    `;
  }).join("");
}

function materialTypeMeta(type) {
  return materialTypes.find((item) => item.type === type) || {
    type,
    label: type,
    channel: "内容平台",
    description: "按当前选题生成对应物料。",
  };
}

function buildBriefFromTopic(topic) {
  return {
    title: topic.title || "",
    topicAngle: topic.parentQuestion || topic.purpose || "",
    keyPoints: Array.isArray(topic.structure) ? topic.structure.slice() : [],
    cta: topic.suggestedCta || topic.cta || "",
    parentQuestion: topic.parentQuestion || "",
    contentGoal: topic.contentGoal || topic.contentGoalLabel || "",
    risk: topic.risk || "",
  };
}

function readContentBriefFromDom() {
  if (!els.contentView) return;
  const angle = els.contentView.querySelector('[data-brief="topicAngle"]');
  const points = els.contentView.querySelector('[data-brief="keyPoints"]');
  const cta = els.contentView.querySelector('[data-brief="cta"]');
  if (!angle && !points && !cta) return;
  contentBrief = {
    ...(contentBrief || {}),
    topicAngle: angle ? angle.value.trim() : contentBrief?.topicAngle,
    keyPoints: points ? linesToArray(points.value) : contentBrief?.keyPoints,
    cta: cta ? cta.value.trim() : contentBrief?.cta,
  };
}

function briefPayload() {
  if (!contentBrief) return undefined;
  return {
    title: contentBrief.title,
    topicAngle: contentBrief.topicAngle,
    keyPoints: contentBrief.keyPoints,
    cta: contentBrief.cta,
  };
}

function compactCharCount(value) {
  return String(value || "").replace(/\s+/g, "").length;
}

function videoNarrationCharCount(material) {
  const hook = material?.hook && typeof material.hook === "object" ? material.hook : { narration: material?.hook || "" };
  const script = Array.isArray(material?.script) ? material.script : [];
  return compactCharCount([hook.narration, ...script.map((s) => s.narration)].filter(Boolean).join(""));
}

function videoSubtitleStyleLabel(style) {
  return style === "key_points" ? "重点字幕" : "字幕";
}

function materialToText(m) {
  if (!m) return "";
  if (m.type === "video") {
    const hook = m.hook && typeof m.hook === "object" ? m.hook : { narration: m.hook || "" };
    const script = Array.isArray(m.script) ? m.script : [];
    const fullNarration = [hook.narration, ...script.map((s) => s.narration)].filter(Boolean).join("\n");
    const fullSubtitle = [hook.onScreenText, ...script.map((s) => s.onScreenText)].filter(Boolean).join("\n");
    const narrationCount = Number(m.narrationCharCount) || videoNarrationCharCount(m);
    const subtitleLabel = videoSubtitleStyleLabel(m.subtitleStyle);
    return [
      m.title,
      `时长：${m.durationHint || ""}${m.estimatedDurationSeconds ? `（约 ${m.estimatedDurationSeconds}s）` : ""}　口播字数：${narrationCount || ""}　字幕：${subtitleLabel}　封面：${m.coverText || ""}`,
      `【前3秒钩子】\n口播：${hook.narration || ""}\n画面：${hook.visual || ""}\n${subtitleLabel}：${hook.onScreenText || ""}`,
      "【口播逐字稿（整段）】",
      fullNarration,
      `【${subtitleLabel}（整段）】`,
      fullSubtitle,
      "【分镜表】",
      ...script.map((s) => `[${s.time || ""}] ${s.intent || ""}\n画面：${s.visual || ""}\n口播：${s.narration || ""}\n${subtitleLabel}：${s.onScreenText || ""}`),
      `拍摄清单：${(m.shootingList || []).join("；")}`,
      `剪辑提示：${(m.editingNotes || []).join("；")}`,
      `发布文案：\n${m.publishCopy || ""}`,
    ].join("\n\n");
  }
  if (m.type === "xhs_image") {
    const cover = m.cover || {};
    const imageContents = Array.isArray(m.imageContents) ? m.imageContents : [];
    const shotList = Array.isArray(m.shotList) ? m.shotList : [];
    const lines = [
      `标题备选：${(m.titles || []).join(" / ")}`,
      "",
      `【封面图】${cover.headline || ""}${cover.subline ? `\n${cover.subline}` : ""}`,
      "",
    ];
    if (imageContents.length) {
      lines.push("【每张图内容】");
      imageContents.forEach((item, index) => {
        lines.push(`图${index + 1}${item.heading ? ` · ${item.heading}` : ""}`);
        (item.lines || []).forEach((line) => lines.push(`- ${line}`));
      });
      lines.push("");
    } else if (shotList.length) {
      lines.push("【配图建议（真实实拍）】");
      shotList.forEach((item, index) => {
        lines.push(`图${index + 1}：拍摄 ${item.shot || ""}${item.caption ? ` | 图上文字 ${item.caption}` : ""}`);
      });
      lines.push("");
    }
    lines.push("【正文】", m.body || "", "", `标签：${(m.tags || []).map((t) => `#${t}`).join(" ")}`, m.commentGuide || "");
    return lines.join("\n");
  }
  if (m.type === "moments_text") {
    return (m.versions || []).map((v) => `【${v.label || ""}】\n${v.text || ""}`).join("\n\n");
  }
  if (m.type === "community") {
    return [
      `今日话题：${m.dailyTopic || ""}`,
      `群公告：${m.announcement || ""}`,
      `互动选项：${m.interaction || ""}`,
      `活动提醒：${m.eventReminder || ""}`,
      `冷场破冰：${m.coldStart || ""}`,
      `常见回复：\n${(m.faqReplies || []).join("\n")}`,
    ].join("\n\n");
  }
  if (typeof m.type === "string" && m.type.startsWith("campaign_") && Array.isArray(m.sections)) {
    const head = m.title ? `${m.title}\n` : "";
    return head + m.sections
      .map((s) => `【${s.heading || ""}】\n${s.body || ""}`)
      .join("\n\n");
  }
  return JSON.stringify(m, null, 2);
}

function updateContext() {
  if (els.venueNameLabel && profile) {
    els.venueNameLabel.textContent = profile.shortName || profile.name || "未命名球场";
  }
}

function defaultPlanPage() {
  return "list";
}

function buildRouteHash(route) {
  if (route.module === "plan") {
    return `#plan/${route.page || defaultPlanPage()}`;
  }
  if (route.module === "topics") {
    return route.page === "generate" ? "#topics/generate" : "#topics";
  }
  return `#${route.module}`;
}

function parseRouteHash(hash = location.hash) {
  const raw = hash.replace(/^#/, "").trim();
  if (!raw) return { module: "plan", page: defaultPlanPage(), slotIndex: null };
  const parts = raw.split("/").filter(Boolean);
  const module = parts[0] || "plan";
  if (module === "plan") {
    const page = parts[1] || defaultPlanPage();
    if (page === "slot" || page === "strategy") {
      return { module: "plan", page: "board", slotIndex: null };
    }
    const allowed = ["list", "setup", "board"];
    return {
      module: "plan",
      page: allowed.includes(page) ? page : defaultPlanPage(),
      slotIndex: null,
    };
  }
  if (module === "topics") {
    return { module: "topics", page: parts[1] === "generate" ? "generate" : null, slotIndex: null };
  }
  return { module, page: null, slotIndex: null };
}

function normalizeRoute(route) {
  const next = { ...route, slotIndex: null };
  if (next.module === "plan") {
    if (!next.page || next.page === "slot" || next.page === "strategy") {
      next.page = "list";
    }
    if (next.page === "board" && !currentPlan) next.page = "list";
  }
  if (next.module === "topics") {
    if (next.page === "generate" && !directionSession) next.page = null;
  }
  if (next.module === "campaign") {
    next.page = null;
  }
  return next;
}

function renderModuleVisibility(module) {
  activeView = module;
  if (module !== "topics" && els.topicsModalRoot) els.topicsModalRoot.innerHTML = "";
  for (const item of els.navItems) item.classList.toggle("active", item.dataset.view === module);
  els.profileShortcutBtn?.classList.toggle("is-active", module === "profile");
  els.aiShortcutBtn?.classList.toggle("is-active", module === "ai");
  els.planView.classList.toggle("hidden", module !== "plan");
  els.topicsView.classList.toggle("hidden", module !== "topics");
  els.contentView.classList.toggle("hidden", module !== "content");
  els.campaignView?.classList.toggle("hidden", module !== "campaign");
  els.libraryView.classList.toggle("hidden", module !== "library");
  els.channelsView.classList.toggle("hidden", module !== "channels");
  els.profileView.classList.toggle("hidden", module !== "profile");
  els.aiView.classList.toggle("hidden", module !== "ai");
  updateAgentContextLabel();
}

function navigate(routeInput, { replace = false } = {}) {
  const next = normalizeRoute(typeof routeInput === "string"
    ? parseRouteHash(routeInput.startsWith("#") ? routeInput : `#${routeInput}`)
    : { ...currentRoute, ...routeInput });
  currentRoute = next;
  const hash = buildRouteHash(next);
  if (replace) {
    history.replaceState(null, "", hash);
  } else if (location.hash !== hash) {
    history.pushState(null, "", hash);
  }
  renderRoute();
}

function renderRoute() {
  const { module, page } = currentRoute;
  renderModuleVisibility(module);
  if (module === "plan") {
    renderPlanChrome(page);
    renderPlanSubpage(page);
  }
  if (module === "topics") {
    renderTopicsChrome(page);
    renderTopicsSubpage(page);
  }
  if (module === "library") {
    renderFinishedLibrary();
  }
  if (module === "content") {
    renderContentModule();
  }
  if (module === "campaign") {
    renderCampaignModule();
  }
  if (module === "channels") {
    renderChannelsModule();
  }
}

function setView(view) {
  if (view === "plan") {
    navigate({ module: "plan", page: defaultPlanPage(), slotIndex: null }, { replace: true });
    return;
  }
  navigate({ module: view, page: null, slotIndex: null });
}

function renderBreadcrumb(crumbs) {
  return crumbs.map((item, index) => {
    const prefix = index > 0 ? `<span class="breadcrumb-sep">›</span>` : "";
    if (item.current) {
      return `${prefix}<span class="breadcrumb-current">${escapeHtml(item.label)}</span>`;
    }
    return `${prefix}<button class="breadcrumb-link" data-plan-nav="${escapeHtml(item.nav)}" type="button">${escapeHtml(item.label)}</button>`;
  }).join("");
}

function renderPlanChrome(page) {
  if (!els.planBreadcrumb || !els.planActions) return;
  els.planChrome?.classList.toggle("hidden", page === "list");

  if (page === "list") {
    els.planBreadcrumb.innerHTML = "";
    els.planActions.innerHTML = "";
    return;
  }

  const crumbs = [{ label: "一周计划", nav: "list" }];

  if (page === "setup") {
    crumbs.push({ label: "本周设定", current: true });
    els.planBreadcrumb.innerHTML = renderBreadcrumb(crumbs);
    els.planActions.innerHTML = `<button class="secondary" data-plan-nav="list" type="button">返回列表</button>`;
    return;
  }

  crumbs.push({ label: "排期看板", current: true });
  els.planBreadcrumb.innerHTML = renderBreadcrumb(crumbs);
  els.planActions.innerHTML = `
    <button class="primary" data-plan-nav="setup" type="button">生成新一周计划</button>
    <button class="secondary" data-plan-nav="list" type="button">返回列表</button>
  `;
}

function renderPlanSubpage(page) {
  els.planPageList?.classList.toggle("hidden", page !== "list");
  els.planPageSetup?.classList.toggle("hidden", page !== "setup");
  els.planPageBoard?.classList.toggle("hidden", page !== "board");
  if (page === "list") renderPlanList();
  if (page === "board" && currentPlan) renderPlanBoard(currentPlan);
}

function handlePlanNavClick(event) {
  const nav = event.target.closest("[data-plan-nav]");
  if (!nav) return false;
  const target = nav.dataset.planNav;
  if (target === "list") navigate({ module: "plan", page: "list", slotIndex: null });
  else if (target === "setup") navigate({ module: "plan", page: "setup", slotIndex: null });
  else if (target === "board") navigate({ module: "plan", page: "board", slotIndex: null });
  return true;
}

function renderTopicsBreadcrumb(crumbs) {
  return crumbs.map((item, index) => {
    const prefix = index > 0 ? `<span class="breadcrumb-sep">›</span>` : "";
    if (item.current) {
      return `${prefix}<span class="breadcrumb-current">${escapeHtml(item.label)}</span>`;
    }
    return `${prefix}<button class="breadcrumb-link" data-topics-nav="${escapeHtml(item.nav)}" type="button">${escapeHtml(item.label)}</button>`;
  }).join("");
}

function renderTopicsChrome(page) {
  if (!els.topicsBreadcrumb || !els.topicsActions) return;
  els.topicsChrome?.classList.toggle("hidden", page !== "generate");
  if (page === "generate") {
    els.topicsBreadcrumb.innerHTML = renderTopicsBreadcrumb([
      { label: "选题库", nav: "library" },
      { label: "生成结果", current: true },
    ]);
    const total = directionSession?.directions?.length || 0;
    const unsaved = (directionSession?.directions || []).filter((d) => !savedDirectionIds.has(d.id)).length;
    const fromSlot = directionSession?.sourceSlotIndex !== null && directionSession?.sourceSlotIndex !== undefined;
    els.topicsActions.innerHTML = `
      ${fromSlot ? `<button class="secondary" data-topics-action="back-plan" type="button">返回一周计划</button>` : `<button class="secondary" data-topics-nav="library" type="button">返回选题库</button>`}
      <button class="secondary" data-topics-action="regenerate" type="button">重新生成</button>
      ${unsaved ? `<button class="primary" data-topics-action="save-all" type="button">全选保存到库（${unsaved}）</button>` : ""}
      ${total ? `<button class="ghost" data-topics-action="clear" type="button">清空本次</button>` : ""}
    `;
    return;
  }
  els.topicsBreadcrumb.innerHTML = "";
  els.topicsActions.innerHTML = "";
}

function renderTopicsSubpage(page) {
  els.topicsPageLibrary?.classList.toggle("hidden", page === "generate");
  els.topicsPageGenerate?.classList.toggle("hidden", page !== "generate");
  if (page === "generate") {
    renderTopicGenerateStep(directionSession);
  } else {
    loadTopicLibrary();
  }
}

function handleTopicsNavClick(event) {
  const nav = event.target.closest("[data-topics-nav]");
  if (!nav) return false;
  const target = nav.dataset.topicsNav.replace(/^topics:/, "");
  if (target === "library") navigate({ module: "topics", page: null, slotIndex: null });
  else if (target === "generate") navigate({ module: "topics", page: "generate", slotIndex: null });
  return true;
}

function showPlanSetupAlert(message, type = "error") {
  if (!els.planSetupAlert) return;
  els.planSetupAlert.classList.remove("hidden");
  els.planSetupAlert.className = `subpage-alert subpage-alert-${type}`;
  els.planSetupAlert.textContent = message;
}

function clearPlanSetupAlert() {
  if (!els.planSetupAlert) return;
  els.planSetupAlert.classList.add("hidden");
  els.planSetupAlert.textContent = "";
}

function updatePlanStageContext(stage = els.fields.stage?.value || profile?.stage) {
  if (!els.planStageContext) return;
  els.planStageContext.textContent = stageLabelMap[stage] || stage || "未设置";
}

function fillProfileForm(data) {
  profile = data;
  els.fields.name.value = data.name || "";
  els.fields.shortName.value = data.shortName || "";
  els.fields.city.value = data.city || "";
  els.fields.location.value = data.location || "";
  els.fields.stage.value = data.stage || "pre_opening";
  els.fields.positioning.value = data.positioning || "";
  els.fields.services.value = arrayToLines(data.services);
  els.fields.audiences.value = arrayToLines(data.audiences);
  els.fields.tone.value = data.tone || "";
  els.fields.booking.value = data.booking || "";
  els.fields.wechat.value = data.wechat || "";
  els.venueNameLabel.textContent = data.shortName || data.name || "未命名球场";
  els.profileStatus.textContent = "已载入";
  els.profileStatus.classList.remove("status-error", "status-success");
  updatePlanStageContext(data.stage);
}

function readProfileForm() {
  return {
    ...profile,
    name: els.fields.name.value.trim(),
    shortName: els.fields.shortName.value.trim(),
    city: els.fields.city.value.trim(),
    location: els.fields.location.value.trim(),
    stage: els.fields.stage.value,
    positioning: els.fields.positioning.value.trim(),
    services: linesToArray(els.fields.services.value),
    audiences: linesToArray(els.fields.audiences.value),
    tone: els.fields.tone.value.trim(),
    booking: els.fields.booking.value.trim(),
    wechat: els.fields.wechat.value.trim(),
  };
}

function readTask() {
  return {
    goal: els.task.goal.value,
    audience: els.task.audience.value || undefined,
    cadence: {
      content: Number(els.task.contentCadence.value || 4),
    },
    focus: els.task.focus.value.trim(),
    eventInfo: els.task.eventInfo.value.trim(),
  };
}

function setLoading(button, loadingText) {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = loadingText;
  return () => {
    button.disabled = false;
    button.textContent = original;
  };
}

function providerCard(provider) {
  return els.aiView.querySelector(`.ai-provider-card[data-provider="${provider}"]`);
}

function providerField(provider, field) {
  return providerCard(provider).querySelector(`[data-ai-field="${field}"]`);
}

function fillAiSettings(settings) {
  els.activeProviderInput.value = settings.activeProvider || "openai";
  els.aiStatus.classList.remove("status-error", "status-success");
  for (const provider of providerIds) {
    const config = settings.providers?.[provider] || {};
    providerField(provider, "enabled").checked = Boolean(config.enabled);
    providerField(provider, "apiKey").value = "";
    providerField(provider, "model").value = config.model || "";
    providerField(provider, "baseUrl").value = config.baseUrl || "";
    providerField(provider, "maskedKey").textContent = config.hasKey
      ? `已保存：${config.maskedKey}`
      : "未保存 API Key";
    providerField(provider, "status").textContent = "";
  }
  els.aiStatus.textContent = "已载入";
}

function readAiSettingsForm() {
  return {
    activeProvider: els.activeProviderInput.value,
    providers: Object.fromEntries(providerIds.map((provider) => [provider, {
      enabled: providerField(provider, "enabled").checked,
      apiKey: providerField(provider, "apiKey").value.trim(),
      model: providerField(provider, "model").value.trim(),
      baseUrl: providerField(provider, "baseUrl").value.trim(),
    }])),
  };
}

async function loadAiSettings() {
  try {
    fillAiSettings(await apiRequest("/api/ai-settings"));
  } catch (error) {
    els.aiStatus.textContent = "读取失败";
    els.aiStatus.classList.add("status-error");
    console.error(error);
  }
}

async function saveAiSettings() {
  const restore = setLoading(els.saveAiBtn, "保存中");
  els.aiStatus.textContent = "保存中";
  els.aiStatus.classList.remove("status-error", "status-success");
  try {
    const data = await apiRequest("/api/ai-settings", { settings: readAiSettingsForm() });
    fillAiSettings(data.settings);
    els.aiStatus.textContent = "已保存";
    els.aiStatus.classList.remove("status-error");
    els.aiStatus.classList.add("status-success");
    showToast("AI 连接已保存");
  } catch (error) {
    els.aiStatus.textContent = error.message;
    els.aiStatus.classList.remove("status-success");
    els.aiStatus.classList.add("status-error");
    showToast(error.message || "AI 连接保存失败", "error");
  } finally {
    restore();
  }
}

async function testAiProvider(provider) {
  const button = els.aiView.querySelector(`.ai-test[data-provider="${provider}"]`);
  const status = providerField(provider, "status");
  const restore = setLoading(button, "测试中");
  status.textContent = "测试中...";
  status.classList.remove("is-success", "is-error");
  try {
    const config = readAiSettingsForm().providers[provider];
    const data = await apiRequest("/api/ai-test", { provider, config });
    status.textContent = data.message || "连接成功";
    status.classList.add("is-success");
  } catch (error) {
    status.textContent = error.message;
    status.classList.add("is-error");
  } finally {
    restore();
  }
}

function renderPlanAiMeta(plan) {
  const source = plan.aiMeta?.source;
  if (source === "fallback") {
    return `<small class="ai-meta">AI 失败，已回退本地规则：${escapeHtml(plan.aiMeta.error || "AI 不可用")}</small>`;
  }
  return "";
}

const scheduleDayOrder = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

function sortScheduleEntries(schedule) {
  const dayIndex = (day) => {
    const index = scheduleDayOrder.indexOf(day);
    return index === -1 ? 99 : index;
  };
  return schedule
    .map((slot, index) => ({ slot, index }))
    .sort((a, b) => dayIndex(a.slot.day) - dayIndex(b.slot.day));
}

function renderWeekStrip(schedule) {
  const daysWithSlots = new Set(schedule.map((slot) => slot.day));
  return `
    <div class="week-strip" aria-label="本周排期概览">
      ${scheduleDayOrder.map((day) => `
        <span class="week-strip-day ${daysWithSlots.has(day) ? "has-slot" : "is-empty"}">${escapeHtml(day.replace("周", ""))}</span>
      `).join("")}
    </div>
  `;
}

function renderBoardStrategySection(plan) {
  const pillars = Array.isArray(plan.pillars) ? plan.pillars : [];
  if (!pillars.length) return "";
  return `
    <section class="board-pillars">
      <span class="board-pillars-label">本周支柱</span>
      <div class="board-pillar-chips">
        ${pillars.map((pillar) => `
          <span class="board-pillar-chip">${escapeHtml(pillar.label)}${pillar.slotCount ? `<em>${pillar.slotCount}</em>` : ""}</span>
        `).join("")}
      </div>
    </section>
  `;
}

function renderScheduleRow(slot, index) {
  const hasTopic = Boolean(slot.topicTitle);
  return `
    <article class="schedule-row ${platformToneClass(slot.platform)} ${hasTopic ? "has-topic" : ""}">
      <div class="schedule-row-meta">
        <strong class="schedule-row-day">${escapeHtml(slot.day)}</strong>
        <span class="platform-badge">${escapeHtml(slot.platform)}</span>
        ${slot.format ? `<span class="format-tag">${escapeHtml(slot.format)}</span>` : ""}
        ${slot.categoryLabel ? `<span class="mini-tag mini-tag-cat">${escapeHtml(slot.categoryLabel)}</span>` : ""}
        ${slot.pillarLabel ? `<span class="mini-tag">${escapeHtml(slot.pillarLabel)}</span>` : ""}
      </div>
      <div class="schedule-row-body">
        <h3 class="schedule-row-title">${escapeHtml(slot.directionHint || slot.theme || slot.topicTitle || "本周内容方向")}</h3>
        ${slot.topicTitle ? `<button class="schedule-row-picked" data-slot-content="${index}" type="button" title="点击进入这条选题的内容工作台">已选选题：${escapeHtml(slot.topicTitle)}</button>` : (slot.theme && slot.directionHint && slot.theme !== slot.directionHint ? `<p class="schedule-row-angle">${escapeHtml(slot.theme)}</p>` : slot.topicAngle ? `<p class="schedule-row-angle">${escapeHtml(slot.topicAngle)}</p>` : "")}
        <details class="schedule-row-details">
          <summary class="schedule-row-toggle" title="展开或收起本条排期的补充说明">
            <span class="schedule-row-toggle-icon" aria-hidden="true"></span>
            <span class="schedule-row-toggle-open">展开详情</span>
            <span class="schedule-row-toggle-close">收起详情</span>
          </summary>
          <div class="schedule-row-details-body">
            ${slot.whyPlatform ? `<p><strong>平台</strong>${escapeHtml(slot.whyPlatform)}</p>` : slot.reason ? `<p>${escapeHtml(slot.reason)}</p>` : ""}
            ${slot.whyTiming ? `<p><strong>节奏</strong>${escapeHtml(slot.whyTiming)}</p>` : ""}
            ${Array.isArray(slot.materialNeed) && slot.materialNeed.length ? `
              <div><strong>素材</strong>${renderList(slot.materialNeed)}</div>
            ` : ""}
            ${slot.action ? `<p><strong>动作</strong>${escapeHtml(slot.action)}</p>` : ""}
            ${slot.risk ? `<p class="schedule-risk">${escapeHtml(slot.risk)}</p>` : ""}
          </div>
        </details>
      </div>
      <div class="schedule-row-action">
        ${hasTopic ? `<button class="primary slot-content-action" data-slot-content="${index}" type="button">做内容</button>` : ""}
        <button class="${hasTopic ? "secondary" : "primary"} plan-slot-action" data-slot-index="${index}" type="button">${hasTopic ? "重新生成选题" : "生成选题"}</button>
      </div>
    </article>
  `;
}

function renderPlanBoard(plan) {
  if (!els.planBoardContent) return;
  const schedule = plan.publishingSchedule || plan.week || [];
  const entries = sortScheduleEntries(schedule);

  els.planBoardContent.innerHTML = `
    <div class="board-toolbar">
      <div class="board-toolbar-main">
        <h2>${escapeHtml(plan.overview.title)}</h2>
        <p>${escapeHtml(plan.overview.focus)}</p>
      </div>
      <div class="board-toolbar-meta">
        ${renderPills([
          plan.overview.stage,
          plan.overview.goal,
          `${schedule.length} 条排期`,
        ].filter(Boolean))}
        ${renderPlanAiMeta(plan)}
        <button class="ghost small" data-plan-plan-campaign type="button">策划配套活动</button>
      </div>
    </div>

    ${renderPlanCampaignBanner(plan)}

    ${renderBoardStrategySection(plan)}

    <section class="board-schedule">
      <div class="board-section-head">
        <h3>本周排期</h3>
      </div>
      ${renderWeekStrip(schedule)}
      <div class="schedule-row-list">
        ${entries.map(({ slot, index }) => renderScheduleRow(slot, index)).join("")}
      </div>
    </section>
  `;
}

function renderPlanCampaignBanner(plan) {
  const link = plan?.campaignLink;
  if (!link || !link.id) return "";
  const exists = campaignsIndex.some((entry) => entry.id === link.id);
  return `
    <div class="plan-campaign-banner">
      <span class="chip-tag">配合活动</span>
      <span class="plan-campaign-title">本周配合：${escapeHtml(link.title || "活动方案")}</span>
      ${exists ? `<button class="ghost small" data-plan-view-campaign="${escapeHtml(link.id)}" type="button">查看活动</button>` : `<span class="plan-campaign-missing">（活动已删除）</span>`}
    </div>
  `;
}

function platformToneClass(platform) {
  const value = String(platform || "");
  if (/小红书|xhs/i.test(value)) return "platform-xhs";
  if (/朋友圈|moments/i.test(value)) return "platform-moments";
  if (/视频|抖音|video/i.test(value)) return "platform-video";
  return "platform-default";
}

function renderTopicsAiMeta(data) {
  const source = data.aiMeta?.source;
  if (source === "fallback") {
    return `<small class="ai-meta">AI 失败，已回退本地规则：${escapeHtml(data.aiMeta.error || "AI 不可用")}</small>`;
  }
  return "";
}

function filterTopicLibrary(topics = []) {
  const search = topicFilters.search.trim().toLowerCase();
  return topics.filter((topic) => {
    const topicStatus = topic.status || "active";
    if (!topicFilters.showArchived && topicStatus === "archived") return false;
    if (!search) return true;
    const haystack = [
      topic.title,
      topic.purpose,
      topic.pillarLabel,
      topic.platformText,
      topic.formatText,
      topic.audienceText,
      ...(topic.materials || []),
      topic.note,
    ].join(" ").toLowerCase();
    return haystack.includes(search);
  });
}

const formatQuickLabels = {
  video: "生成视频脚本",
  xhs_image: "生成小红书图文",
  moments_text: "生成朋友圈",
  moments_image: "生成朋友圈",
  community: "生成社群话术",
};

function renderFormatQuickButtons(topic, context) {
  const seen = new Set();
  const buttons = [];
  for (const format of topic.formats || []) {
    const normalized = format === "moments_image" ? "moments_text" : format;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    const label = formatQuickLabels[normalized];
    if (!label) continue;
    buttons.push(`<button class="quick-format" data-${context}-quick="${escapeHtml(topic.id)}" data-format="${escapeHtml(normalized)}" type="button">${escapeHtml(label)}</button>`);
  }
  return buttons.length ? `<div class="quick-format-row">${buttons.join("")}</div>` : "";
}

function syncTopicFilterInputs() {
  if (els.topicSearchInput) els.topicSearchInput.value = topicFilters.search;
  if (els.topicShowArchived) els.topicShowArchived.checked = topicFilters.showArchived;
}

function renderStructurePreview(topic) {
  const structure = Array.isArray(topic.structure) ? topic.structure : [];
  if (!structure.length) return "";
  return `
    <details class="topic-structure">
      <summary>内容结构（${structure.length} 步）</summary>
      <ol>${structure.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
    </details>
  `;
}

function renderTopicCard(topic) {
  const planSlots = Array.isArray(topic.usedInPlanSlots)
    ? topic.usedInPlanSlots
    : (Array.isArray(topic.planSlots) ? topic.planSlots : []);
  const planBadge = planSlots.length
    ? `<span class="topic-badge">本周排期 ${planSlots.length}</span>`
    : "";
  const producedBadge = (topic.produceCount || 0) > 0
    ? `<span class="topic-badge topic-badge-muted">已生产 ${topic.produceCount}</span>`
    : "";
  const archivedBadge = topic.status === "archived" ? `<span class="topic-badge topic-badge-muted">已归档</span>` : "";
  return `
    <article class="topic-card ${topic.status === "archived" ? "is-archived" : ""}" data-topic-id="${escapeHtml(topic.id)}">
      <div class="topic-card-main">
        <div class="card-topline">
          ${planBadge}
          ${producedBadge}
          ${archivedBadge}
          <span class="topic-score">匹配 ${escapeHtml(topic.score)}</span>
        </div>
        <h3>${escapeHtml(topic.title)}</h3>
        <p class="topic-purpose">${escapeHtml(topic.purpose)}</p>
        ${renderPills([topic.pillarLabel, topic.platformText, topic.formatText, topic.audienceText])}
        ${renderStructurePreview(topic)}
        ${topic.note ? `<p class="topic-note">${escapeHtml(topic.note)}</p>` : ""}
      </div>
      <div class="topic-card-side">
        <button class="primary topic-generate" data-topic-id="${escapeHtml(topic.id)}" type="button">生成内容</button>
        ${renderFormatQuickButtons(topic, "lib")}
        <div class="topic-card-tools">
          <button class="link-button" data-topic-adopt="${escapeHtml(topic.id)}" type="button">采用到排期</button>
          <button class="link-button" data-topic-edit="${escapeHtml(topic.id)}" type="button">编辑</button>
          <button class="link-button" data-topic-archive="${escapeHtml(topic.id)}" type="button">${topic.status === "archived" ? "取消归档" : "归档"}</button>
        </div>
      </div>
    </article>
  `;
}

function renderCategoryOverview(data) {
  const categories = data.categories || [];
  const counts = new Map();
  for (const topic of currentTopics) {
    if ((topic.status || "active") === "archived") continue;
    counts.set(topic.category, (counts.get(topic.category) || 0) + 1);
  }

  const groupsOrder = [];
  const byGroup = new Map();
  for (const cat of categories) {
    if (!byGroup.has(cat.group)) {
      byGroup.set(cat.group, { label: cat.groupLabel || cat.group, items: [] });
      groupsOrder.push(cat.group);
    }
    byGroup.get(cat.group).items.push(cat);
  }

  const sections = groupsOrder.map((groupId) => {
    const group = byGroup.get(groupId);
    const cards = group.items.map((cat) => {
      const count = counts.get(cat.id) || 0;
      return `
        <button class="topic-cat-card ${count ? "" : "is-empty"}" data-topic-cat="${escapeHtml(cat.id)}" type="button">
          <span class="topic-cat-name">${escapeHtml(cat.label)}</span>
          <span class="topic-cat-count">${count} 条</span>
        </button>
      `;
    }).join("");
    return `
      <section class="topic-cat-section">
        <h3 class="topic-cat-group">${escapeHtml(group.label)}</h3>
        <div class="topic-cat-grid">${cards}</div>
      </section>
    `;
  }).join("");

  els.topicsResult.innerHTML = `
    <div class="topic-library-meta">
      ${renderPills([
        `共 ${currentTopics.length} 条`,
        data.updatedAt ? `更新 ${escapeHtml(new Date(data.updatedAt).toLocaleString("zh-CN"))}` : "",
      ].filter(Boolean))}
    </div>
    ${sections}
  `;
}

function renderCategoryDetail(data) {
  const category = (data.categories || []).find((cat) => cat.id === topicCategory);
  const label = category?.label || "选题";
  const inCategory = currentTopics.filter((topic) => topic.category === topicCategory);
  const filtered = filterTopicLibrary(inCategory);
  const filterHint = filtered.length !== inCategory.length
    ? `筛选后 ${filtered.length} / ${inCategory.length} 条`
    : `共 ${inCategory.length} 条`;

  els.topicsResult.innerHTML = `
    <div class="topic-cat-breadcrumb">
      <button class="link-button" data-topic-cat-back type="button">← 返回分类</button>
      <span class="topic-cat-crumb">选题库 / ${escapeHtml(label)}</span>
    </div>
    <div class="topic-library-meta">
      ${renderPills([filterHint].filter(Boolean))}
    </div>
    <div class="topic-library-list">
      ${filtered.length
        ? filtered.map((topic) => renderTopicCard(topic)).join("")
        : `<article class="empty-state compact"><h3>暂无选题</h3><p>生成选题方向。</p></article>`}
    </div>
  `;
}

function renderTopicLibrary(data) {
  topicLibraryData = data;
  currentTopics = data.topics || [];
  topicsReady = currentTopics.length > 0;
  updateContext();
  syncTopicFilterInputs();

  const inDetail = Boolean(topicCategory);
  // 工具栏（搜索/状态等）仅在分类详情态显示；概览态隐藏。
  els.topicLibraryToolbar?.classList.toggle("hidden", !currentTopics.length || !inDetail);

  if (!currentTopics.length) {
    topicCategory = null;
    els.topicsResult.innerHTML = `
      <article class="empty-state">
        <h2>暂无选题</h2>
        <p>生成选题方向，挑选后保存入库。</p>
      </article>
    `;
    return;
  }

  if (inDetail) {
    renderCategoryDetail(data);
  } else {
    renderCategoryOverview(data);
  }
}

function applyTopicFilters() {
  if (!topicLibraryData) return;
  renderTopicLibrary(topicLibraryData);
}

function renderVideo(material) {
  const hook = material.hook && typeof material.hook === "object" ? material.hook : { narration: material.hook || "" };
  const script = Array.isArray(material.script) ? material.script : [];
  const fullNarration = [hook.narration, ...script.map((s) => s.narration)].filter(Boolean).join("\n");
  const fullSubtitle = [hook.onScreenText, ...script.map((s) => s.onScreenText)].filter(Boolean).join("\n");
  const narrationCount = Number(material.narrationCharCount) || videoNarrationCharCount(material);
  const subtitleLabel = videoSubtitleStyleLabel(material.subtitleStyle);
  return `
    <article class="content-card">
      <p class="eyebrow">视频脚本</p>
      <h2>${escapeHtml(material.title)}</h2>
      <div class="video-meta-pills">
        ${renderPills([
          material.durationHint ? `时长 ${escapeHtml(material.durationHint)}` : "",
          material.estimatedDurationSeconds ? `预计 ${escapeHtml(material.estimatedDurationSeconds)}s` : "",
          narrationCount ? `口播 ${escapeHtml(narrationCount)} 字` : "",
          subtitleLabel,
          material.coverText ? `封面 ${escapeHtml(material.coverText)}` : "",
        ].filter(Boolean))}
      </div>
      <h4>前 3 秒钩子</h4>
      <div class="video-hook">
        <p><span class="video-line-tag">口播</span>${escapeHtml(hook.narration || "")}</p>
        <p><span class="video-line-tag">画面</span>${escapeHtml(hook.visual || "")}</p>
        <p><span class="video-line-tag">${escapeHtml(subtitleLabel)}</span>${escapeHtml(hook.onScreenText || "")}</p>
      </div>
      <div class="video-copy-actions">
        <button class="ghost video-copy-script" data-format="video" type="button">复制口播稿</button>
        <button class="ghost video-copy-subtitle" data-format="video" type="button">复制字幕</button>
      </div>
      <h4>分镜</h4>
      ${script.map((shot) => `
        <div class="script-row">
          <strong>${escapeHtml(shot.time || "")}${shot.intent ? ` · ${escapeHtml(shot.intent)}` : ""}</strong>
          <p><span class="video-line-tag">画面</span>${escapeHtml(shot.visual || "")}</p>
          <p><span class="video-line-tag">口播</span>${escapeHtml(shot.narration || "")}</p>
          <p><span class="video-line-tag">${escapeHtml(subtitleLabel)}</span>${escapeHtml(shot.onScreenText || "")}</p>
        </div>
      `).join("")}
      <h4>口播逐字稿（可整段复制）</h4>
      <pre>${escapeHtml(fullNarration)}</pre>
      <h4>${escapeHtml(subtitleLabel)}（可整段复制）</h4>
      <pre>${escapeHtml(fullSubtitle)}</pre>
      <h4>拍摄清单</h4>
      ${renderList(material.shootingList)}
      <h4>剪辑提示</h4>
      ${renderList(material.editingNotes)}
      <h4>发布文案</h4>
      <pre>${escapeHtml(material.publishCopy)}</pre>
    </article>
  `;
}

function renderXhs(material) {
  const cover = material.cover || {};
  const imageContents = Array.isArray(material.imageContents) ? material.imageContents : [];
  const shotList = Array.isArray(material.shotList) ? material.shotList : [];
  const coverBlock = (cover.headline || cover.subline) ? `
      <h4>封面图</h4>
      <div class="xhs-cover">
        ${cover.headline ? `<p class="xhs-cover-headline">${escapeHtml(cover.headline)}</p>` : ""}
        ${cover.subline ? `<p class="xhs-cover-subline">${escapeHtml(cover.subline)}</p>` : ""}
      </div>
  ` : "";
  const imagesBlock = imageContents.length ? `
      <h4>每张图内容</h4>
      <div class="xhs-image-list">
        ${imageContents.map((item, index) => `
          <div class="xhs-image-card">
            <strong>图${index + 1}${item.heading ? ` · ${escapeHtml(item.heading)}` : ""}</strong>
            ${renderList(item.lines || [])}
          </div>
        `).join("")}
      </div>
  ` : shotList.length ? `
      <h4>配图建议（真实实拍）</h4>
      <div class="xhs-image-list">
        ${shotList.map((item, index) => `
          <div class="xhs-image-card">
            <strong>图${index + 1}</strong>
            ${item.shot ? `<p>拍摄：${escapeHtml(item.shot)}</p>` : ""}
            ${item.caption ? `<p>图上文字：${escapeHtml(item.caption)}</p>` : ""}
          </div>
        `).join("")}
      </div>
  ` : "";
  return `
    <article class="content-card">
      <p class="eyebrow">小红书图文</p>
      <h2>标题备选</h2>
      ${renderList(material.titles)}
      ${coverBlock}
      ${imagesBlock}
      <h4>正文</h4>
      <pre>${escapeHtml(material.body)}</pre>
      ${renderPills((material.tags || []).map((tag) => `#${tag}`))}
      <div class="note-box">${escapeHtml(material.commentGuide)}</div>
    </article>
  `;
}

function renderMoments(material) {
  return `
    <article class="content-card">
      <p class="eyebrow">朋友圈</p>
      <h2>文案版本</h2>
      ${material.versions.map((version) => `
        <div class="copy-block">
          <strong>${escapeHtml(version.label)}</strong>
          <pre>${escapeHtml(version.text)}</pre>
        </div>
      `).join("")}
      <h4>配图文字</h4>
      ${renderList(material.imageTexts)}
    </article>
  `;
}

function renderCommunity(material) {
  return `
    <article class="content-card">
      <p class="eyebrow">微信社群</p>
      <h2>社群运营话术</h2>
      <div class="copy-block"><strong>今日话题</strong><pre>${escapeHtml(material.dailyTopic)}</pre></div>
      <div class="copy-block"><strong>群公告</strong><pre>${escapeHtml(material.announcement)}</pre></div>
      <div class="copy-block"><strong>互动选项</strong><pre>${escapeHtml(material.interaction)}</pre></div>
      <div class="copy-block"><strong>活动提醒</strong><pre>${escapeHtml(material.eventReminder)}</pre></div>
      <div class="copy-block"><strong>冷场破冰</strong><pre>${escapeHtml(material.coldStart)}</pre></div>
      <h4>常见回复</h4>
      ${renderList(material.faqReplies)}
    </article>
  `;
}

function renderMaterial(material) {
  if (material.type === "video") return renderVideo(material);
  if (material.type === "xhs_image") return renderXhs(material);
  if (material.type === "moments_text") return renderMoments(material);
  if (material.type === "community") return renderCommunity(material);
  if (typeof material.type === "string" && material.type.startsWith("campaign_") && Array.isArray(material.sections)) {
    return renderMaterialCampaign(material);
  }
  return "";
}

function renderMaterialCampaign(material) {
  const title = material.title || "";
  const sections = Array.isArray(material.sections) ? material.sections : [];
  if (!sections.length) {
    return `<div class="campaign-material-detail"><p class="muted">暂无段落</p></div>`;
  }
  const blocks = sections.map((s) => `
    <div class="campaign-material-section">
      <h4>${escapeHtml(s.heading || "")}</h4>
      <pre>${escapeHtml(s.body || "")}</pre>
    </div>
  `).join("");
  return `
    <div class="campaign-material-detail">
      ${title ? `<div class="campaign-material-title">${escapeHtml(title)}</div>` : ""}
      ${blocks}
    </div>
  `;
}

function renderMaterialAiMeta(meta) {
  if (!meta) return "";
  if (meta.source === "fallback") {
    return `<small class="ai-meta">AI 失败，已回退本地模板：${escapeHtml(meta.error || "AI 不可用")}</small>`;
  }
  return "";
}

function inferFormatFromPlanSlot(slot) {
  if (!slot) return null;
  const platform = String(slot.platform || "");
  const format = String(slot.format || "");
  if (platform.includes("小红书") || format.includes("图文")) return "xhs_image";
  if (platform.includes("抖音") || platform.includes("视频号") || format.includes("短视频")) return "video";
  if (platform.includes("朋友圈") || format.includes("文字") || format.includes("图文")) return "moments_text";
  if (platform.includes("社群") || platform.includes("微信群")) return "community";
  return null;
}

function renderMaterialBlock(format, entry) {
  const meta = materialTypeMeta(format);
  const isFinal = entry.status === "final";
  const history = Array.isArray(entry.history) ? entry.history : [];
  return `
    <div class="material-block ${isFinal ? "is-final" : ""}" data-format-block="${escapeHtml(format)}">
      <div class="material-block-head">
        <div class="material-block-title">
          <span class="material-status ${isFinal ? "final" : "draft"}">${isFinal ? "定稿" : "草稿"}</span>
          <strong>${escapeHtml(meta.label)}</strong>
        </div>
        <div class="material-block-actions">
          <button class="ghost material-copy" data-format="${escapeHtml(format)}" type="button">复制</button>
          <button class="${isFinal ? "secondary" : "primary"} material-finalize" data-format="${escapeHtml(format)}" type="button">${isFinal ? "取消定稿" : "定稿"}</button>
        </div>
      </div>
      ${renderMaterial(entry.material)}
      ${renderMaterialAiMeta(entry.aiMeta)}
      <div class="material-refine">
        <input class="material-refine-input" data-format="${escapeHtml(format)}" type="text" placeholder="定向微调，如：更口语 / 标题再来5个 / 第2镜头换个开场" />
        <button class="secondary material-refine-apply" data-format="${escapeHtml(format)}" type="button">微调</button>
      </div>
      ${history.length ? `
        <details class="material-history">
          <summary>历史版本（${history.length}）</summary>
          ${history.map((h, index) => `
            <div class="material-history-row">
              <span>${escapeHtml(h.label || `版本${index + 1}`)}</span>
              <button class="ghost material-rollback" data-format="${escapeHtml(format)}" data-version="${index}" type="button">回滚此版</button>
            </div>
          `).join("")}
        </details>
      ` : ""}
    </div>
  `;
}

function renderTopicContent(data) {
  currentTopic = data.topic;
  currentContentData = data;
  materialReady = Object.keys(generatedMaterials).length > 0;
  if (!contentBrief) contentBrief = buildBriefFromTopic(data.topic);
  updateContext();
  const topicFormats = data.topic.formats || [];
  const recommendedFormat = inferFormatFromPlanSlot(currentPlanSlot);
  // 默认始终提供 视频/小红书图文/朋友圈 三类，不再因 topic.formats 过滤隐藏；
  // 社群话术仅在选题含 community 或排期是社群/微信群时出现。
  const showCommunity = topicFormats.includes("community")
    || recommendedFormat === "community"
    || /社群|微信群/.test(String(currentPlanSlot?.platform || ""));
  const availableTypes = materialTypes
    .filter((item) => item.type !== "community" || showCommunity)
    .slice()
    .sort((a, b) => {
      if (a.type === recommendedFormat) return -1;
      if (b.type === recommendedFormat) return 1;
      return 0;
    });
  const generatedCount = Object.keys(generatedMaterials).length;
  const finalCount = Object.values(generatedMaterials).filter((e) => e.status === "final").length;
  const planHint = currentPlanSlot
    ? `来自排期：${currentPlanSlot.day} · ${currentPlanSlot.platform} · ${currentPlanSlot.format}`
    : "";
  const brief = contentBrief || buildBriefFromTopic(data.topic);
  els.contentView.innerHTML = `
    <div class="page-header">
      <div>
        <p class="eyebrow">内容工作台</p>
        <h2>${escapeHtml(data.topic.title)}</h2>
        <p>${escapeHtml(data.topic.venueFit)}</p>
        ${planHint ? `<p class="topic-plan-hint">${escapeHtml(planHint)}</p>` : ""}
      </div>
      <div class="workbench-head-actions">
        <button class="ghost content-reset" type="button">+ 新内容</button>
        ${renderPills([data.topic.pillarLabel, data.topic.platformText, `${generatedCount} 个草稿`, `${finalCount} 个定稿`])}
      </div>
    </div>

    <section class="page-section workbench-step">
      <div class="section-head">
        <div>
          <p class="eyebrow">第 1 步 · 内容简报</p>
          <h3>先确认这条内容要解决什么</h3>
        </div>
      </div>
      <div class="brief-grid">
        <label class="brief-field brief-field-wide">
          <span>内容角度</span>
          <textarea data-brief="topicAngle" rows="2" placeholder="这条内容主要回答/呈现什么">${escapeHtml(brief.topicAngle || "")}</textarea>
        </label>
        <label class="brief-field brief-field-wide">
          <span>要点（每行一条）</span>
          <textarea data-brief="keyPoints" rows="4" placeholder="按顺序列出要讲的关键点">${escapeHtml((brief.keyPoints || []).join("\n"))}</textarea>
        </label>
        <label class="brief-field">
          <span>转化动作</span>
          <input data-brief="cta" type="text" value="${escapeHtml(brief.cta || "")}" placeholder="例如：私信孩子年龄，获取体验建议" />
        </label>
        <div class="brief-context note-box">
          ${brief.parentQuestion ? `<p><strong>家长问题</strong>${escapeHtml(brief.parentQuestion)}</p>` : ""}
          ${brief.contentGoal ? `<p><strong>内容目标</strong>${escapeHtml(brief.contentGoal)}</p>` : ""}
          ${brief.risk ? `<p class="schedule-risk"><strong>风险</strong>${escapeHtml(brief.risk)}</p>` : ""}
        </div>
      </div>
    </section>

    <section class="page-section workbench-step">
      <div class="section-head">
        <div>
          <p class="eyebrow">第 2 步 · 选择类型并生成草稿</p>
          <h3>选择本次要生成的内容类型</h3>
        </div>
      </div>
      <div class="content-type-grid">
        ${availableTypes.map((item) => `
          <article class="content-type-card ${recommendedFormat === item.type ? "recommended" : ""}">
            <div>
              <span>${escapeHtml(item.channel)}</span>
              <h3>${escapeHtml(item.label)}${recommendedFormat === item.type ? " · 排期推荐" : ""}</h3>
              <p>${escapeHtml(item.description)}</p>
            </div>
            <button class="${generatedMaterials[item.type] ? "secondary" : "primary"} material-generate" data-format="${escapeHtml(item.type)}" type="button">
              ${generatedMaterials[item.type] ? "重新生成" : "生成"}
            </button>
          </article>
        `).join("")}
      </div>
    </section>

    <section class="page-section workbench-step">
      <div class="section-head">
        <div>
          <p class="eyebrow">第 3 步 · 迭代与定稿</p>
          <h3>逐条微调，满意后定稿</h3>
        </div>
      </div>
      <div class="material-output" id="materialOutput">
        ${generatedCount
          ? Object.entries(generatedMaterials).map(([format, entry]) => renderMaterialBlock(format, entry)).join("")
          : `<article class="empty-state"><h2>暂无物料</h2><p>选择内容类型后生成。</p></article>`}
      </div>
    </section>
  `;
}

function rerenderContent() {
  if (currentContentData) renderTopicContent(currentContentData);
}

function renderTopicDesk(topic) {
  contentBrief = buildBriefFromTopic(topic);
  const data = buildTopicBrief(topic);
  renderTopicContent(data);
}

function buildTopicBrief(topic) {
  return {
    topic,
    materials: [],
    execution: {
      materialNeed: topic.materials || [],
      publishAction: topic.suggestedCta || topic.cta || "根据当前目标引导咨询、预约或进群。",
      riskCheck: topic.risk || "未确认的信息不要写死。",
      nextStep: "先选择一个最需要的内容类型生成，确认可用后再继续生成其他类型。",
    },
  };
}

const GROUP_TYPE_LABELS = {
  prospect_parents: "意向家长群",
  enrolled_parents: "在读学员家长群",
  adult_players: "成人约球群",
};

function syncGroupTabs() {
  const label = GROUP_TYPE_LABELS[currentGroupType] || "本群";
  els.communityBtn.textContent = `生成${label}方案`;
  els.groupTypeTabs?.querySelectorAll(".group-tab").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.group === currentGroupType);
  });
}

function buildCommunityCacheForPlan(planId) {
  const cache = {};
  if (!planId) return cache;
  // communityIndex 为最新在前，取每个群类型在该一周计划下的最新一份。
  for (const entry of communityIndex) {
    if (entry.planId !== planId || !entry.plan) continue;
    const group = entry.groupType || entry.plan?.overview?.groupType;
    if (group && !cache[group]) cache[group] = entry.plan;
  }
  return cache;
}

function resetCommunityPlans() {
  communityReady = false;
  communityPlansByGroup = buildCommunityCacheForPlan(currentPlanId);
}

async function restoreCommunityPlans() {
  try {
    const data = await apiRequest("/api/community-plans");
    communityIndex = Array.isArray(data?.plans) ? data.plans : [];
    communityPlansByGroup = buildCommunityCacheForPlan(currentPlanId);
  } catch (error) {
    console.error("社群历史读取失败", error);
  }
}

async function deleteCommunityPlanEntry(id) {
  const entry = communityIndex.find((item) => item.id === id);
  if (!entry) return;
  const confirmed = await requestConfirm({
    title: "删除社群方案",
    message: `确定删除「${entry.label || "这份社群方案"}」？删除后不可恢复。`,
    confirmText: "删除",
    danger: true,
  });
  if (!confirmed) return;
  try {
    const data = await apiRequest(`/api/community-plans/${encodeURIComponent(id)}`, null, "DELETE");
    communityIndex = Array.isArray(data?.plans) ? data.plans : communityIndex.filter((item) => item.id !== id);
    communityPlansByGroup = buildCommunityCacheForPlan(currentPlanId);
    renderCommunityHistory();
    showToast("社群方案已删除");
  } catch (error) {
    showToast(error.message || "删除失败", "error");
  }
}

function openCommunityHistoryEntry(id) {
  const entry = communityIndex.find((item) => item.id === id);
  if (!entry || !entry.plan) return;
  if (entry.groupType) currentGroupType = entry.groupType;
  renderCommunityPlan(entry.plan);
}

function renderCommunityHistory() {
  if (!els.communityHistory) return;
  if (!communityIndex.length) {
    els.communityHistory.innerHTML = "";
    return;
  }
  els.communityHistory.innerHTML = `
    <section class="page-section">
      <div class="section-head">
        <div>
          <p class="eyebrow">历史方案</p>
          <h3>已生成的社群方案</h3>
        </div>
      </div>
      <ul class="community-history-list">
        ${communityIndex.map((entry) => {
          const groupLabel = entry.groupLabel || GROUP_TYPE_LABELS[entry.groupType] || "社群";
          const planTitle = entry.planTitle ? ` · ${escapeHtml(entry.planTitle)}` : "";
          return `
            <li class="community-history-item">
              <button class="community-history-open" data-community-open="${escapeHtml(entry.id)}" type="button">
                <span class="chip-tag">${escapeHtml(groupLabel)}</span>
                <span class="community-history-label">${escapeHtml(entry.label || "社群方案")}${planTitle}</span>
              </button>
              <button class="ghost small ghost-danger" data-community-delete="${escapeHtml(entry.id)}" type="button">删除</button>
            </li>
          `;
        }).join("")}
      </ul>
    </section>
  `;
}

function renderChannelsModule() {
  selectCommunityGroup(currentGroupType);
  renderCommunityHistory();
}

async function restoreCampaignPlans() {
  try {
    const data = await apiRequest("/api/campaign-plans");
    campaignsIndex = Array.isArray(data?.plans) ? data.plans : [];
  } catch (error) {
    console.error("活动历史读取失败", error);
  }
}

async function persistCampaignPlan(plan, brief = "") {
  if (!plan) return;
  try {
    const saved = await apiRequest("/api/campaign-plans", {
      plan,
      brief: brief || currentCampaignBrief || "",
      planId: currentPlanId || "",
      planTitle: currentPlan?.overview?.title || "",
    });
    if (saved?.entry?.id) currentCampaignId = saved.entry.id;
    if (Array.isArray(saved?.plans)) campaignsIndex = saved.plans;
    if (currentRoute.module === "campaign") renderCampaignHistory();
  } catch (error) {
    console.error("活动方案保存失败", error);
    showToast("活动方案已生成，但未能保存到服务器", "error");
  }
}

async function deleteCampaignPlanEntry(id) {
  const entry = campaignsIndex.find((item) => item.id === id);
  if (!entry) return;
  const confirmed = await requestConfirm({
    title: "删除活动方案",
    message: `确定删除「${entry.label || "这份活动方案"}」？删除后不可恢复。`,
    confirmText: "删除",
    danger: true,
  });
  if (!confirmed) return;
  try {
    const data = await apiRequest(`/api/campaign-plans/${encodeURIComponent(id)}`, null, "DELETE");
    campaignsIndex = Array.isArray(data?.plans) ? data.plans : campaignsIndex.filter((item) => item.id !== id);
    if (currentRoute.module === "campaign") renderCampaignHistory();
    showToast("活动方案已删除");
  } catch (error) {
    showToast(error.message || "删除失败", "error");
  }
}

function openCampaignHistoryEntry(id) {
  const entry = campaignsIndex.find((item) => item.id === id);
  if (!entry || !entry.plan) return;
  currentCampaignBrief = entry.brief || "";
  currentCampaignId = entry.id;
  renderCampaignPlan(entry.plan);
}

function campaignHistoryMarkup() {
  if (!campaignsIndex.length) return "";
  return `
    <section class="page-section">
      <div class="section-head">
        <div>
          <p class="eyebrow">历史方案</p>
          <h3>已生成的活动方案</h3>
        </div>
      </div>
      <ul class="community-history-list">
        ${campaignsIndex.map((entry) => {
          const typeLabel = entry.typeLabel || "活动";
          const planTitle = entry.planTitle ? ` · 配合「${escapeHtml(entry.planTitle)}」` : "";
          return `
            <li class="community-history-item">
              <button class="community-history-open" data-campaign-open="${escapeHtml(entry.id)}" type="button">
                <span class="chip-tag">${escapeHtml(typeLabel)}</span>
                <span class="community-history-label">${escapeHtml(entry.label || "活动方案")}${planTitle}</span>
              </button>
              <button class="ghost small ghost-danger" data-campaign-delete="${escapeHtml(entry.id)}" type="button">删除</button>
            </li>
          `;
        }).join("")}
      </ul>
    </section>
  `;
}

function renderCampaignHistory() {
  const host = els.campaignView?.querySelector("#campaignHistory");
  if (host) host.innerHTML = campaignHistoryMarkup();
}

function campaignProducedTopics() {
  if (!currentCampaignId) return [];
  const topics = topicLibraryData?.topics || [];
  return topics.filter((t) => t.campaignId && t.campaignId === currentCampaignId);
}

function campaignTopicsMarkup() {
  if (!currentCampaignId) return "";
  const topics = campaignProducedTopics();
  if (!topics.length) return "";
  return `
    <section class="page-section">
      <div class="section-head">
        <div>
          <p class="eyebrow">已产出选题</p>
          <h3>由本活动生成的选题（${topics.length}）</h3>
        </div>
      </div>
      <ul class="community-history-list">
        ${topics.map((t) => `
          <li class="community-history-item">
            <button class="community-history-open" data-campaign-topic="${escapeHtml(t.id)}" type="button">
              ${t.categoryLabel ? `<span class="chip-tag">${escapeHtml(t.categoryLabel)}</span>` : ""}
              <span class="community-history-label">${escapeHtml(t.title)}</span>
            </button>
            <button class="ghost small" data-campaign-topic-content="${escapeHtml(t.id)}" type="button">做内容</button>
          </li>
        `).join("")}
      </ul>
    </section>
  `;
}

function renderCampaignTopics() {
  const host = els.campaignView?.querySelector("#campaignTopics");
  if (host) host.innerHTML = campaignTopicsMarkup();
}

// 活动页需要选题库数据来展示"已产出选题"；缺失时静默加载后再刷新该区块。
async function ensureCampaignTopics() {
  if (!currentCampaignId) return;
  if (!topicLibraryData) {
    try { await loadTopicLibrary(); } catch { /* ignore */ }
  }
  renderCampaignTopics();
}

function campaignProducedMaterials() {
  if (!currentCampaignId) return [];
  return finishedContent.filter((item) => item && item.campaignId === currentCampaignId);
}

function campaignMaterialsMarkup() {
  if (!currentCampaignId) return "";
  const items = campaignProducedMaterials();
  if (!items.length) {
    return `
      <section class="page-section">
        <div class="section-head"><div><p class="eyebrow">活动物料</p><h3>对外资料（0）</h3></div></div>
        <p class="campaign-materials-empty">活动方案确定后，点上方「生成活动物料」生成对外资料（海报/短信/报名接龙/FAQ/家长须知）。</p>
      </section>
    `;
  }
  const ordered = [...items].sort((a, b) => (
    new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
  ));
  return `
    <section class="page-section" id="campaignMaterialsSection">
      <div class="section-head">
        <div>
          <p class="eyebrow">活动物料</p>
          <h3>对外资料（${ordered.length}）</h3>
        </div>
        <div class="button-row">
          <button class="secondary" data-campaign-materials type="button">再生成</button>
        </div>
      </div>
      <ul class="campaign-materials-list">
        ${ordered.map((item) => {
          const meta = materialTypeMeta(item.format);
          const firstBody = Array.isArray(item.material?.sections) ? (item.material.sections[0]?.body || "") : "";
          const previewSource = (firstBody && String(firstBody).trim())
            ? String(firstBody)
            : (materialToText(item.material) || "");
          const preview = escapeHtml(previewSource.replace(/\n+/g, " ").slice(0, 80));
          return `
            <li class="campaign-materials-item" data-campaign-material-row="${escapeHtml(item.id)}">
              <div class="campaign-materials-item-head">
                <span class="library-format-badge">${escapeHtml(meta.label)}</span>
                <span class="campaign-materials-preview">${preview}…</span>
                <span class="campaign-materials-item-actions">
                  <button class="ghost small" data-campaign-material-toggle="${escapeHtml(item.id)}" type="button" aria-expanded="false">查看</button>
                  <button class="ghost small" data-campaign-material-copy="${escapeHtml(item.id)}" type="button">复制</button>
                  <button class="link-button" data-campaign-material-regen="${escapeHtml(item.id)}" type="button">重新生成该项</button>
                </span>
              </div>
              <div class="campaign-materials-item-detail hidden" data-campaign-material-detail="${escapeHtml(item.id)}"></div>
            </li>
          `;
        }).join("")}
      </ul>
    </section>
  `;
}

function renderCampaignMaterials() {
  const host = els.campaignView?.querySelector("#campaignMaterials");
  if (host) host.innerHTML = campaignMaterialsMarkup();
}

function toggleCampaignMaterialInline(id, button) {
  const detail = els.campaignView?.querySelector(`[data-campaign-material-detail="${CSS.escape(id)}"]`);
  if (!detail) return;
  const item = finishedContent.find((it) => it.id === id);
  if (!item) return;
  const willOpen = detail.classList.contains("hidden");
  if (willOpen) {
    detail.innerHTML = renderMaterialCampaign(item.material || { sections: [] });
    detail.classList.remove("hidden");
    if (button) {
      button.textContent = "收起";
      button.setAttribute("aria-expanded", "true");
    }
    requestAnimationFrame(() => detail.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  } else {
    detail.classList.add("hidden");
    detail.innerHTML = "";
    if (button) {
      button.textContent = "查看";
      button.setAttribute("aria-expanded", "false");
    }
  }
}

async function copyCampaignMaterialInline(id, button) {
  const item = finishedContent.find((it) => it.id === id);
  if (!item) {
    showToast("物料已被删除", "error");
    return;
  }
  await copyTextWithFeedback(materialToText(item.material), button);
}

async function regenerateCampaignMaterialItem(id, button) {
  if (!currentCampaignId || !currentCampaignPlan) {
    showToast("缺少活动方案上下文", "error");
    return;
  }
  const item = finishedContent.find((it) => it.id === id);
  if (!item) {
    showToast("物料已被删除", "error");
    return;
  }
  // id 形如 "campaign-<campaignId>-<format>"
  const m = String(id).match(/^campaign-[a-z0-9-]+-(.+)$/);
  const format = m ? m[1] : item.format;
  if (!format || !CAMPAIGN_MATERIAL_FORMATS.includes(format)) {
    showToast("无法识别物料类型", "error");
    return;
  }
  if (button) {
    button.disabled = true;
    button.textContent = "生成中…";
  }
  try {
    profile = readProfileForm();
    const data = await apiRequest("/api/campaign-materials/generate", {
      profile,
      campaignId: currentCampaignId,
      campaignTitle: currentCampaignPlan?.overview?.title || item.campaignTitle || "",
      brief: currentCampaignBrief || "",
      plan: currentCampaignPlan,
      formats: [format],
    });
    await loadFinishedContent();
    const tag = data?.aiMeta?.source === "ai"
      ? `AI 已重新生成「${CAMPAIGN_MATERIAL_LABELS[format] || format}」`
      : `已用本地模板重新生成「${CAMPAIGN_MATERIAL_LABELS[format] || format}」`;
    showToast(tag);
    await ensureCampaignMaterials();
  } catch (error) {
    showToast(error.message || "重新生成失败", "error");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "重新生成该项";
    }
  }
}

async function ensureCampaignMaterials() {
  if (!currentCampaignId) return;
  if (!finishedContent.length) {
    try { await loadFinishedContent(); } catch { /* ignore */ }
  }
  renderCampaignMaterials();
}

function openCampaignMaterialsModal() {
  if (!currentCampaignId) {
    showToast("请先生成活动方案", "error");
    return;
  }
  const existing = new Set(campaignProducedMaterials().map((it) => it.format));
  const selected = new Set(CAMPAIGN_MATERIAL_FORMATS.filter((f) => !existing.has(f)));
  const tiles = CAMPAIGN_MATERIAL_FORMATS.map((format) => {
    const label = CAMPAIGN_MATERIAL_LABELS[format] || format;
    const desc = CAMPAIGN_MATERIAL_DESCRIPTIONS[format] || "";
    const isSelected = selected.has(format);
    const exist = existing.has(format);
    return `
      <button type="button" class="campaign-material-tile ${isSelected ? "is-selected" : ""}" data-campaign-material-tile="${format}" aria-pressed="${isSelected}">
        <span class="campaign-material-tile-mark" aria-hidden="true"></span>
        <span class="campaign-material-tile-body">
          <strong>${escapeHtml(label)}</strong>
          <small>${escapeHtml(desc)}</small>
        </span>
        ${exist ? `<em class="campaign-material-tile-tag">已有将覆盖</em>` : ""}
      </button>
    `;
  }).join("");
  const overlay = document.createElement("div");
  overlay.className = "app-confirm-backdrop";
  overlay.innerHTML = `
    <div class="app-confirm campaign-material-modal" role="dialog" aria-label="生成活动物料">
      <header class="campaign-material-modal-head">
        <div>
          <h3>选择要生成的对外物料</h3>
        </div>
        <button class="campaign-material-close" type="button" data-campaign-material-cancel aria-label="关闭">×</button>
      </header>
      <form class="campaign-material-form">
        <div class="campaign-material-toolbar">
          <span class="campaign-material-count"><b id="campaignMaterialCount">${selected.size}</b> / ${CAMPAIGN_MATERIAL_FORMATS.length} 已选</span>
          <span class="campaign-material-shortcuts">
            <button type="button" class="link-button" data-campaign-material-all>全选</button>
          </span>
        </div>
        <div class="campaign-material-grid">${tiles}</div>
        <div class="app-confirm-actions">
          <button class="ghost" type="button" data-campaign-material-cancel>取消</button>
          <button class="primary" type="submit" id="campaignMaterialSubmit">生成 ${selected.size} 项物料</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);
  const submitBtn = overlay.querySelector("#campaignMaterialSubmit");
  const countEl = overlay.querySelector("#campaignMaterialCount");
  const refreshCount = () => {
    const n = overlay.querySelectorAll(".campaign-material-tile.is-selected").length;
    countEl.textContent = String(n);
    submitBtn.textContent = `生成 ${n} 项物料`;
  };
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay || event.target.closest("[data-campaign-material-cancel]")) {
      overlay.remove();
      return;
    }
    // 必须是点击"全选"按钮本身才全选（之前用 querySelector 永远返回 toolbar 里的按钮，导致任意点击都触发全选）
    if (event.target.closest("[data-campaign-material-all]")) {
      overlay.querySelectorAll(".campaign-material-tile").forEach((el) => { el.classList.add("is-selected"); el.setAttribute("aria-pressed", "true"); });
      refreshCount();
      return;
    }
    const tile = event.target.closest(".campaign-material-tile");
    if (tile) {
      tile.classList.toggle("is-selected");
      tile.setAttribute("aria-pressed", tile.classList.contains("is-selected") ? "true" : "false");
      refreshCount();
    }
  });
  const form = overlay.querySelector("form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formats = Array.from(overlay.querySelectorAll(".campaign-material-tile.is-selected"))
      .map((el) => el.dataset.campaignMaterialTile);
    if (!formats.length) {
      showToast("请至少选择一种物料", "error");
      return;
    }
    const restore = setLoading(submitBtn, "生成中");
    overlay.remove();
    try {
      await generateCampaignMaterials(formats);
    } finally {
      restore();
    }
  });
}

async function generateCampaignMaterials(formats) {
  if (!currentCampaignId || !currentCampaignPlan) {
    showToast("缺少活动方案上下文", "error");
    return;
  }
  try {
    profile = readProfileForm();
    const data = await apiRequest("/api/campaign-materials/generate", {
      profile,
      campaignId: currentCampaignId,
      campaignTitle: currentCampaignPlan?.overview?.title || "",
      brief: currentCampaignBrief || "",
      plan: currentCampaignPlan,
      formats,
    });
    await loadFinishedContent();
    if (data?.aiMeta) {
      const tag = data.aiMeta.source === "ai"
        ? `AI 已生成 ${formats.length} 项物料（${data.aiMeta.provider || ""}）`
        : `已用本地模板生成 ${formats.length} 项物料`;
      showToast(tag);
    } else {
      showToast(`已生成 ${formats.length} 项活动物料`);
    }
    await ensureCampaignMaterials();
    requestAnimationFrame(() => {
      const host = els.campaignView?.querySelector("#campaignMaterialsSection");
      if (host) host.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  } catch (error) {
    showToast(error.message || "活动物料生成失败", "error");
  }
}

function renderAiMetaBadge(aiMeta) {
  if (!aiMeta) return "";
  const isAi = aiMeta.source === "ai";
  const label = isAi ? `AI 生成 · ${aiMeta.provider || ""}` : "本地兜底";
  const title = aiMeta.error ? ` title="${escapeHtml(aiMeta.error)}"` : "";
  return `<span class="ai-meta-badge ${isAi ? "is-ai" : "is-fallback"}"${title}>${escapeHtml(label)}</span>`;
}

function renderScriptContent(item) {
  if (item.type === "list" && Array.isArray(item.content)) {
    return `<ul class="script-list">${item.content.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`;
  }
  return `<pre>${escapeHtml(String(item.content || ""))}</pre>`;
}

function renderCommunityEmpty(groupType = currentGroupType) {
  const label = GROUP_TYPE_LABELS[groupType] || "社群";
  communityReady = false;
  syncGroupTabs();
  els.channelsResult.innerHTML = `
    <article class="empty-state">
      <h2>暂无${escapeHtml(label)}方案</h2>
      <p>点击「生成${escapeHtml(label)}方案」。</p>
    </article>
  `;
}

function selectCommunityGroup(groupType) {
  currentGroupType = groupType || currentGroupType;
  syncGroupTabs();
  const cached = communityPlansByGroup[currentGroupType];
  if (cached) {
    renderCommunityPlan(cached);
    return;
  }
  renderCommunityEmpty(currentGroupType);
}

function renderCommunityPlan(data) {
  if (!data) {
    renderCommunityEmpty();
    return;
  }
  communityReady = true;
  if (data.overview?.groupType) currentGroupType = data.overview.groupType;
  communityPlansByGroup[currentGroupType] = data;
  syncGroupTabs();
  updateContext();
  const overview = data.overview || {};
  const week = Array.isArray(data.week) ? data.week : [];
  els.channelsResult.innerHTML = `
    <div class="page-header">
      <div>
        <h2>${escapeHtml(overview.title || `${GROUP_TYPE_LABELS[currentGroupType] || "社群"}运营方案`)} ${renderAiMetaBadge(data.aiMeta)}</h2>
        <p>${escapeHtml(overview.principle || "")}</p>
      </div>
      ${renderPills([overview.groupLabel, overview.mission, overview.mode].filter(Boolean))}
    </div>

    <section class="page-section">
      <div class="section-head">
        <div>
          <p class="eyebrow">社群节奏</p>
          <h3>本周社群节奏</h3>
        </div>
      </div>
      <div class="community-week">
        ${week.map((day) => `
          <article class="community-day${day.isReuse ? " is-reuse" : ""}">
            <div class="card-topline">
              <span>${escapeHtml(day.day)}</span>
              <strong>${escapeHtml(day.action || "")}</strong>
            </div>
            ${day.isReuse ? `<span class="reuse-tag">复用公域${day.sourceTopic ? "：" + escapeHtml(day.sourceTopic) : ""}</span>` : ""}
            <div class="copy-block"><strong>群话题</strong><pre>${escapeHtml(day.groupTopic)}</pre></div>
            <div class="copy-block"><strong>群内消息</strong><pre>${escapeHtml(day.message)}</pre></div>
            <div class="copy-block"><strong>互动引导</strong><pre>${escapeHtml(day.interaction)}</pre></div>
            <div class="copy-block"><strong>跟进动作</strong><pre>${escapeHtml(day.followUp)}</pre></div>
            <small>${escapeHtml(day.risk || "")}</small>
          </article>
        `).join("")}
      </div>
    </section>

    <section class="page-section">
      <div class="section-head">
        <div>
          <p class="eyebrow">话术库</p>
          <h3>可复用话术</h3>
        </div>
      </div>
      <div class="script-grid">
        ${(data.scriptLibrary || []).map((item) => `
          <article class="script-card">
            <div class="card-topline">
              <strong>${escapeHtml(item.title)}</strong>
              <button class="ghost small" data-copy-script="${escapeHtml(item.key)}" type="button">复制</button>
            </div>
            ${renderScriptContent(item)}
          </article>
        `).join("")}
      </div>
    </section>

    <section class="page-section">
      <div class="section-head">
        <div>
          <p class="eyebrow">执行提醒</p>
          <h3>社群执行提醒</h3>
        </div>
      </div>
      <div class="note-box">${renderList(data.reminders)}</div>
    </section>
  `;
  els.channelsResult.querySelectorAll("[data-copy-script]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.copyScript;
      const item = (data.scriptLibrary || []).find((s) => s.key === key);
      if (!item) return;
      const text = Array.isArray(item.content) ? item.content.join("\n") : String(item.content || "");
      copyTextWithFeedback(text, btn);
    });
  });
}

async function loadProfile() {
  try {
    fillProfileForm(await apiRequest("/api/profile"));
  } catch (error) {
    els.profileStatus.textContent = "读取失败";
    els.profileStatus.classList.add("status-error");
    console.error(error);
  }
}

let toastTimer = null;
function showToast(message, type = "info") {
  let el = document.getElementById("appToast");
  if (!el) {
    el = document.createElement("div");
    el.id = "appToast";
    el.className = "app-toast";
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.toggle("app-toast-error", type === "error");
  el.classList.add("app-toast-show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("app-toast-show"), 10000);
}

function requestConfirm({ title = "确认操作", message = "", confirmText = "确认", danger = false } = {}) {
  return new Promise((resolve) => {
    let root = document.getElementById("appConfirmRoot");
    if (!root) {
      root = document.createElement("div");
      root.id = "appConfirmRoot";
      document.body.appendChild(root);
    }
    root.innerHTML = `
      <div class="app-confirm-backdrop" role="presentation">
        <section class="app-confirm" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
          <h3>${escapeHtml(title)}</h3>
          ${message ? `<p>${escapeHtml(message)}</p>` : ""}
          <div class="app-confirm-actions">
            <button class="secondary" data-confirm-cancel type="button">取消</button>
            <button class="${danger ? "danger" : "primary"}" data-confirm-ok type="button">${escapeHtml(confirmText)}</button>
          </div>
        </section>
      </div>
    `;
    const close = (value) => {
      root.innerHTML = "";
      resolve(value);
    };
    root.querySelector("[data-confirm-cancel]")?.addEventListener("click", () => close(false));
    root.querySelector("[data-confirm-ok]")?.addEventListener("click", () => close(true));
    root.querySelector(".app-confirm-backdrop")?.addEventListener("click", (event) => {
      if (event.target.classList.contains("app-confirm-backdrop")) close(false);
    });
  });
}

async function persistPlan() {
  if (!currentPlan || !currentPlanId) return;
  try {
    const data = await apiRequest(`/api/weekly-plans/${encodeURIComponent(currentPlanId)}`, { plan: currentPlan }, "PUT");
    if (Array.isArray(data?.plans)) plansIndex = data.plans;
  } catch (error) {
    console.error("一周计划保存失败", error);
    showToast("一周计划未能保存到服务器，请检查网络后重试", "error");
  }
}

async function restoreWeeklyPlan() {
  try {
    const data = await apiRequest("/api/weekly-plans");
    plansIndex = Array.isArray(data?.plans) ? data.plans : [];
    // 默认载入最近一份，保证社群运营/对话助手等依赖 currentPlan 的功能可用。
    const latest = plansIndex[0];
    if (latest && latest.plan) {
      currentPlan = latest.plan;
      currentPlanId = latest.id;
      resetCommunityPlans();
    }
  } catch (error) {
    console.error(error);
  }
}

function openPlan(id) {
  const entry = plansIndex.find((item) => item.id === id);
  if (!entry || !entry.plan) return;
  currentPlan = entry.plan;
  currentPlanId = entry.id;
  resetCommunityPlans();
  updateContext();
  navigate({ module: "plan", page: "board", slotIndex: null });
}

async function deletePlanEntry(id) {
  const entry = plansIndex.find((item) => item.id === id);
  if (!entry) return;
  const confirmed = await requestConfirm({
    title: "删除一周计划",
    message: `确定删除「${entry.label || "这份计划"}」？删除后不可恢复。`,
    confirmText: "删除",
    danger: true,
  });
  if (!confirmed) return;
  try {
    const data = await apiRequest(`/api/weekly-plans/${encodeURIComponent(id)}`, null, "DELETE");
    plansIndex = Array.isArray(data?.plans) ? data.plans : plansIndex.filter((item) => item.id !== id);
    if (currentPlanId === id) {
      const latest = plansIndex[0];
      currentPlan = latest?.plan || null;
      currentPlanId = latest?.id || null;
      resetCommunityPlans();
      updateContext();
    }
    renderPlanList();
    showToast("一周计划已删除");
  } catch (error) {
    showToast(error.message || "删除失败", "error");
  }
}

async function generatePlan(opts = {}) {
  const { brief = null, mode = null, fromAgent = false, campaignLink = null } = opts;
  const restore = setLoading(els.planBtn, "策略生成中");
  clearPlanSetupAlert();
  try {
    profile = readProfileForm();
    const task = readTask();
    if (mode) task.generationMode = mode;
    if (brief) task.generationBrief = brief;
    const plan = await apiRequest("/api/operation-plan", { profile, task });
    if (campaignLink && campaignLink.id) {
      plan.campaignLink = { id: campaignLink.id, title: campaignLink.title || "" };
    }
    currentPlan = plan;
    resetCommunityPlans();
    try {
      const saved = await apiRequest("/api/weekly-plans", { plan });
      if (saved?.entry?.id) currentPlanId = saved.entry.id;
      if (Array.isArray(saved?.plans)) plansIndex = saved.plans;
    } catch (saveError) {
      console.error("一周计划保存失败", saveError);
      showToast("一周计划已生成，但未能保存到服务器", "error");
    }
    updateContext();
    navigate({ module: "plan", page: "board", slotIndex: null });
    setAgentResultContext("weekly-plan");
    if (!fromAgent) showToast("一周计划已生成");
    return plan;
  } catch (error) {
    showPlanSetupAlert(error.message);
    if (fromAgent) throw error;
    return null;
  } finally {
    restore();
  }
}

function renderPlanList() {
  if (!els.planListContent) return;
  if (!plansIndex.length) {
    els.planListContent.innerHTML = `
      <article class="empty-state">
        <h2>还没有一周计划</h2>
        <p>生成新一周计划。</p>
      </article>
    `;
    return;
  }
  els.planListContent.innerHTML = `
    <div class="plan-list">
      ${plansIndex.map((entry) => {
        const plan = entry.plan || {};
        const schedule = plan.publishingSchedule || plan.week || [];
        const pills = [plan.overview?.stage, plan.overview?.goal, `${schedule.length} 条排期`].filter(Boolean);
        return `
          <article class="plan-list-card" data-plan-open="${escapeHtml(entry.id)}">
            <div class="plan-list-card-main">
              <strong>${escapeHtml(plan.overview?.title || entry.label || "一周计划")}</strong>
              <p>${escapeHtml(plan.overview?.focus || "")}</p>
              <div class="plan-list-card-pills">${renderPills(pills)}</div>
            </div>
            <div class="plan-list-card-actions">
              <span class="plan-list-card-time">${escapeHtml(formatPlanTime(entry.createdAt))}</span>
              <button class="ghost-danger plan-list-delete" data-plan-delete="${escapeHtml(entry.id)}" type="button" title="删除这份计划">删除</button>
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function formatPlanTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

async function loadTopicLibrary() {
  try {
    profile = readProfileForm();
    const data = await apiRequest("/api/topic-library");
    if (currentPlan) {
      data.topics = (data.topics || []).map((topic) => {
        const schedule = currentPlan.publishingSchedule || currentPlan.week || [];
        const slots = schedule
          .filter((slot) => slot.topicId === topic.id)
          .map((slot) => ({
            day: slot.day,
            platform: slot.platform,
            format: slot.format,
            theme: slot.theme,
          }));
        return slots.length ? { ...topic, usedInPlanSlots: slots, planSlots: slots } : topic;
      });
      const planLinkedCount = data.topics.filter((topic) => (
        Array.isArray(topic.usedInPlanSlots) && topic.usedInPlanSlots.length
      )).length;
      if (data.summary) data.summary.planLinkedCount = planLinkedCount;
    }
    renderTopicLibrary(data);
  } catch (error) {
    els.topicsResult.innerHTML = `<article class="empty-state"><h2>读取失败</h2><p>${escapeHtml(error.message)}</p></article>`;
  }
}

function libraryTitles() {
  return (topicLibraryData?.topics || []).map((topic) => topic.title);
}

async function loadFinishedContent() {
  try {
    const data = await apiRequest("/api/finished-content");
    finishedContent = Array.isArray(data.items) ? data.items : [];
  } catch (error) {
    finishedContent = [];
    console.error(error);
  }
  if (activeView === "library") renderFinishedLibrary();
}

function renderFinishedCard(item) {
  const meta = materialTypeMeta(item.format);
  const isCampaign = typeof item.format === "string" && item.format.startsWith("campaign_");
  // 优先用 sections[0].body 作预览，避免 JSON 截断
  const firstSectionBody = Array.isArray(item.material?.sections) ? item.material.sections[0]?.body : "";
  const previewSource = (firstSectionBody && String(firstSectionBody).trim())
    ? String(firstSectionBody)
    : (materialToText(item.material) || "");
  const preview = escapeHtml(previewSource.slice(0, 120));
  const time = item.updatedAt ? new Date(item.updatedAt).toLocaleString("zh-CN") : "";
  return `
    <article class="library-card" data-library-id="${escapeHtml(item.id)}">
      <div class="library-card-head">
        <div>
          <span class="library-format-badge">${escapeHtml(meta.label)}</span>
          <strong class="library-card-title">${escapeHtml(item.topicTitle || "未命名选题")}</strong>
        </div>
        <span class="library-card-time">${escapeHtml(time)}</span>
      </div>
      <p class="library-card-preview">${preview}…</p>
      <div class="library-card-actions">
        <button class="ghost library-expand" data-library-id="${escapeHtml(item.id)}" type="button">展开全文</button>
        <button class="ghost library-copy" data-library-id="${escapeHtml(item.id)}" type="button">复制</button>
        ${isCampaign ? "" : `<button class="secondary library-reopen" data-library-id="${escapeHtml(item.id)}" type="button">重新打开继续改</button>`}
        <button class="ghost library-delete" data-library-id="${escapeHtml(item.id)}" type="button">删除</button>
      </div>
      <div class="library-card-detail hidden" data-library-detail="${escapeHtml(item.id)}"></div>
    </article>
  `;
}

function renderLibraryModeToggle() {
  return `
    <div class="library-mode-toggle">
      <button class="library-mode-chip ${libraryViewMode === "byPlan" ? "is-active" : ""}" data-library-mode="byPlan" type="button">按一周计划</button>
      <button class="library-mode-chip ${libraryViewMode === "flat" ? "is-active" : ""}" data-library-mode="flat" type="button">全部成品</button>
    </div>
  `;
}

function renderFinishedLibrary() {
  if (!els.libraryResult) return;
  const items = [...finishedContent].sort((a, b) => (
    new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
  ));
  const toggle = renderLibraryModeToggle();
  if (!items.length) {
    els.libraryResult.innerHTML = `${toggle}<article class="empty-state"><h2>成品库为空</h2><p>定稿后归档。</p></article>`;
    return;
  }

  if (libraryViewMode === "byPlan") {
    els.libraryResult.innerHTML = `${toggle}${renderFinishedByPlan(items)}`;
    return;
  }

  const formatCounts = items.reduce((acc, item) => {
    acc[item.format] = (acc[item.format] || 0) + 1;
    return acc;
  }, {});
  const filters = [{ id: "all", label: `全部 ${items.length}` }, ...materialTypes
    .filter((type) => formatCounts[type.type])
    .map((type) => ({ id: type.type, label: `${type.label} ${formatCounts[type.type]}` }))];
  const filterRow = `
    <div class="library-filters">
      ${filters.map((f) => `
        <button class="library-filter-chip ${libraryFormatFilter === f.id ? "is-active" : ""}" data-library-filter="${escapeHtml(f.id)}" type="button">${escapeHtml(f.label)}</button>
      `).join("")}
    </div>
  `;

  const visible = libraryFormatFilter === "all"
    ? items
    : items.filter((item) => item.format === libraryFormatFilter);

  const cards = visible.map((item) => renderFinishedCard(item)).join("");

  els.libraryResult.innerHTML = `${toggle}${filterRow}<div class="library-list">${cards}</div>`;
  // 从活动页「打开」过来的物料：自动展开并滚动到视野内
  const pendingId = window.__pendingFinishedExpandId;
  if (pendingId) {
    window.__pendingFinishedExpandId = null;
    if (items.some((it) => it.id === pendingId)) {
      const target = els.libraryResult.querySelector(`[data-library-detail="${CSS.escape(pendingId)}"]`);
      if (target && target.classList.contains("hidden")) {
        toggleFinishedDetail(pendingId);
      }
      const card = els.libraryResult.querySelector(`[data-library-id="${CSS.escape(pendingId)}"]`);
      card?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
}

function renderFinishedByPlan(items) {
  const usedItemIds = new Set();
  const itemBelongsToSlot = (item, planId, slot, slotIndex) => {
    if (item.planId) {
      return item.planId === planId && Number(item.slotIndex) === Number(slotIndex);
    }
    return Boolean(slot.topicId && item.topicId && item.topicId === slot.topicId);
  };
  const planBlocks = plansIndex.map((entry) => {
    const plan = entry.plan || {};
    const schedule = plan.publishingSchedule || plan.week || [];
    if (!schedule.length) return "";
    const rows = sortScheduleEntries(schedule).map(({ slot, index }) => {
      const slotItems = items.filter((item) => itemBelongsToSlot(item, entry.id, slot, index));
      for (const item of slotItems) usedItemIds.add(item.id);
      const metaLine = [slot.day, slot.platform, slot.categoryLabel || slot.pillarLabel].filter(Boolean).join(" · ");
      const dir = slot.topicTitle || slot.directionHint || slot.theme || "本周内容方向";
      let body;
      if (!slot.topicTitle) {
        body = `<p class="index-slot-empty">未选选题</p>`;
      } else if (!slotItems.length) {
        body = `
          <p class="index-slot-empty">选题已定，未产出成品</p>
          <button class="secondary index-slot-content" data-index-plan="${escapeHtml(entry.id)}" data-index-slot="${index}" type="button">做内容</button>
        `;
      } else {
        body = `<div class="index-card-list">${slotItems.map((item) => renderFinishedCard(item)).join("")}</div>`;
      }
      return `
        <article class="index-slot ${slot.topicTitle ? "has-topic" : ""}">
          <div class="index-slot-head">
            <span class="index-slot-meta">${escapeHtml(metaLine)}</span>
            <strong class="index-slot-dir">${escapeHtml(dir)}</strong>
            ${slotItems.length ? `<span class="index-slot-count">${slotItems.length} 条成品</span>` : ""}
          </div>
          ${body}
        </article>
      `;
    }).join("");
    return `
      <section class="index-plan">
        <div class="index-plan-head">
          <button class="index-plan-title" data-index-plan-open="${escapeHtml(entry.id)}" type="button">${escapeHtml(plan.overview?.title || entry.label || "一周计划")}</button>
          <span class="index-plan-time">${escapeHtml(formatPlanTime(entry.createdAt))}</span>
        </div>
        <div class="index-slot-list">${rows}</div>
      </section>
    `;
  }).join("");

  const leftovers = items.filter((item) => !usedItemIds.has(item.id));
  const leftoverBlock = leftovers.length ? `
    <section class="index-plan index-plan-orphan">
      <div class="index-plan-head">
        <strong class="index-plan-title-static">未归入计划的成品</strong>
        <span class="index-plan-time">${leftovers.length} 条</span>
      </div>
      <div class="index-card-list">${leftovers.map((item) => renderFinishedCard(item)).join("")}</div>
    </section>
  ` : "";

  if (!planBlocks.trim() && !leftoverBlock) {
    return `<article class="empty-state"><h2>暂无可索引内容</h2><p>先在一周计划里采用选题并定稿内容。</p></article>`;
  }
  return `<div class="index-plan-list">${planBlocks}${leftoverBlock}</div>`;
}

async function openContentFromIndexSlot(planId, slotIndex) {
  const entry = plansIndex.find((p) => p.id === planId);
  if (entry?.plan) {
    currentPlan = entry.plan;
    currentPlanId = entry.id;
  }
  await startContentFromPlanSlot(slotIndex);
}

function findFinishedItem(id) {
  return finishedContent.find((item) => item.id === id) || null;
}

async function copyFinishedItem(id, button) {
  const item = findFinishedItem(id);
  if (!item) return;
  await copyTextWithFeedback(materialToText(item.material), button);
}

function videoPartText(material, part) {
  if (!material || material.type !== "video") return "";
  const hook = material.hook && typeof material.hook === "object" ? material.hook : { narration: material.hook || "" };
  const script = Array.isArray(material.script) ? material.script : [];
  return part === "subtitle"
    ? [hook.onScreenText, ...script.map((s) => s.onScreenText)].filter(Boolean).join("\n")
    : [hook.narration, ...script.map((s) => s.narration)].filter(Boolean).join("\n");
}

async function copyTextWithFeedback(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    if (button) {
      const original = button.textContent;
      button.textContent = "已复制";
      setTimeout(() => { button.textContent = original; }, 1500);
    }
  } catch {
    showToast("复制失败，请手动选择文本复制", "error");
  }
}

async function copyFinishedVideoPart(id, part, button) {
  const item = findFinishedItem(id);
  if (!item) return;
  await copyTextWithFeedback(videoPartText(item.material, part), button);
}

function toggleFinishedDetail(id) {
  const detail = els.libraryResult?.querySelector(`[data-library-detail="${CSS.escape(id)}"]`);
  if (!detail) return;
  const item = findFinishedItem(id);
  if (!item) return;
  if (detail.classList.contains("hidden")) {
    detail.innerHTML = renderMaterial(item.material);
    detail.classList.remove("hidden");
  } else {
    detail.classList.add("hidden");
    detail.innerHTML = "";
  }
}

async function deleteFinishedItem(id) {
  const confirmed = await requestConfirm({
    title: "删除成品",
    message: "确定从成品库删除这条成品吗？删除后不可恢复。",
    confirmText: "删除",
    danger: true,
  });
  if (!confirmed) return;
  try {
    const data = await apiRequest(`/api/finished-content/${encodeURIComponent(id)}`, null, "DELETE");
    finishedContent = Array.isArray(data.items) ? data.items : [];
    renderFinishedLibrary();
    showToast("成品已删除");
  } catch (error) {
    showToast(`删除失败：${error.message}`, "error");
  }
}

function reopenFinishedItem(id) {
  const item = findFinishedItem(id);
  if (!item) return;
  if (typeof item.format === "string" && item.format.startsWith("campaign_")) {
    showToast("活动物料无对应选题，请用「展开全文」查看或回活动页重新生成", "error");
    return;
  }
  currentPlanSlot = null;
  currentPlanSlotIndex = null;
  if (item.planId) {
    const entry = plansIndex.find((planEntry) => planEntry.id === item.planId);
    const schedule = entry?.plan ? (entry.plan.publishingSchedule || entry.plan.week || []) : [];
    const hasSlotIndex = item.slotIndex !== null && item.slotIndex !== undefined && item.slotIndex !== "";
    const slot = hasSlotIndex && Number.isInteger(Number(item.slotIndex)) ? schedule[Number(item.slotIndex)] : null;
    if (entry?.plan && slot) {
      currentPlan = entry.plan;
      currentPlanId = entry.id;
      currentPlanSlot = slot;
      currentPlanSlotIndex = Number(item.slotIndex);
    }
  }
  const topic = {
    ...(item.brief || {}),
    id: item.topicId,
    title: item.topicTitle,
    contentType: item.contentType,
    category: item.category,
    formats: [item.format],
  };
  currentTopic = topic;
  contentBrief = item.brief || buildBriefFromTopic(topic);
  for (const key of Object.keys(generatedMaterials)) delete generatedMaterials[key];
  generatedMaterials[item.format] = { format: item.format, status: "final", material: item.material, aiMeta: null, history: [] };
  materialReady = true;
  updateContext();
  setView("content");
  renderTopicContent({ topic, materials: [item.material], execution: {} });
}

function setDirectionSession(session, { origin = "panel", sourceSlotIndex = null } = {}) {
  directionSession = session;
  if (directionSession && typeof directionSession === "object") {
    directionSession.sourceSlotIndex = (sourceSlotIndex === null || sourceSlotIndex === undefined)
      ? null
      : Number(sourceSlotIndex);
  }
  savedDirectionIds = new Set();
  navigate({ module: "topics", page: "generate", slotIndex: null });
  onDirectionSessionChanged(origin);
}

function onDirectionSessionChanged() {
  setAgentResultContext("topic-directions");
}

// 只设自然语言路由上下文（供 routeAgentIntent 判断后续口令），不出卡片。
// 主面板与共享生成函数都调它，保证主面板生成后切到对话也能继续用自然语言修改。
function setAgentResultContext(type) {
  if (!agentSession) return;
  agentSession.activeResult = { type };
  updateAgentFab();
}

// 仅对话内调用：在对话里追加一条带「动作卡片」的 assistant 消息（含数据快照）。
function emitAgentCard(type, { text = null } = {}) {
  if (!agentSession) return;
  setAgentResultContext(type);
  const handler = resultRegistry[type];
  const data = activeResultData();
  if (!handler || !data || (handler.isEmpty && handler.isEmpty(data))) {
    if (text) pushAgentMessage("assistant", text);
    return;
  }
  const snapshot = cloneSnapshot(data);
  if (type === "weekly-plan" && snapshot && typeof snapshot === "object") {
    snapshot.__planId = currentPlanId || null;
  }
  // content-material 去重：工作台是单活跃态，同一 topic 不重复出卡片，仅更新最近一张。
  if (type === "content-material") {
    for (let i = agentSession.messages.length - 1; i >= 0; i -= 1) {
      const c = agentSession.messages[i].card;
      if (c && c.type === "content-material") {
        if (c.data?.topic?.id && snapshot?.topic?.id && c.data.topic.id === snapshot.topic.id) {
          c.data = snapshot;
          if (text) pushAgentMessage("assistant", text);
          else renderAgentMessages();
          return;
        }
        break;
      }
    }
  }
  const card = { id: makeAgentCardId(), type, data: snapshot };
  const summary = text || (handler.summarize ? handler.summarize(data) : "");
  pushAgentMessage("assistant", summary, { card });
  if (!agentSession.open) agentSession.pendingResult = true;
  updateAgentFab();
}

function findAgentCardById(id) {
  if (!id) return null;
  for (const m of agentSession.messages) {
    if (m.card && m.card.id === id) return m.card;
  }
  return null;
}

function activeResultData() {
  const type = agentSession?.activeResult?.type;
  if (type === "topic-directions") return directionSession;
  if (type === "weekly-plan") return currentPlan;
  if (type === "content-material") return currentTopic ? { topic: currentTopic } : null;
  if (type === "campaign-plan") return currentCampaignPlan;
  return null;
}

async function generateDirections(opts = {}) {
  const { brief = null, mode = null, eventInfo = null, focus = null, fromAgent = false, sourceSlotIndex = null, maxDirections = null, campaignLink = null, restore: externalRestore } = opts;
  const restore = externalRestore
    || (els.topicsGenerateBtn ? setLoading(els.topicsGenerateBtn, "生成中") : () => {});
  // 占位 session：让路由守卫(normalizeRoute)放行到「生成结果页」，否则首次生成时
  // directionSession 为空会被踢回选题库主页，加载动画就渲染进了隐藏的结果页。
  directionSession = { directions: [], loading: true, sourceSlotIndex };
  savedDirectionIds = new Set();
  navigate({ module: "topics", page: "generate", slotIndex: null });
  renderDirectionLoading();
  try {
    profile = readProfileForm();
    const task = { ...readTask(), plan: currentPlan || undefined, excludeTitles: libraryTitles() };
    // Main 选题方向 path stays daily-clean: force balanced and drop the plan page's
    // 活动/重点 inputs. Campaign topics come through the dedicated 活动选题 entry.
    const resolvedMode = mode || "balanced";
    task.generationMode = resolvedMode;
    if (resolvedMode === "balanced") {
      task.eventInfo = "";
      task.focus = "";
    } else {
      if (eventInfo != null) task.eventInfo = eventInfo;
      if (focus != null) task.focus = focus;
    }
    if (Number(maxDirections) > 0) task.maxDirections = Number(maxDirections);
    const payload = { profile, task };
    if (brief) payload.generationBrief = brief;
    const data = await apiRequest("/api/topic-directions", payload);
    if (campaignLink && campaignLink.id && Array.isArray(data?.directions)) {
      data.campaignId = campaignLink.id;
      data.campaignTitle = campaignLink.title || "";
      for (const d of data.directions) {
        d.campaignId = campaignLink.id;
        d.campaignTitle = campaignLink.title || "";
      }
    }
    setDirectionSession(data, { origin: fromAgent ? "agent" : "panel", sourceSlotIndex });
    return data;
  } catch (error) {
    // 清掉占位 loading session，避免之后再进结果页看到空的加载态。
    if (directionSession?.loading) directionSession = null;
    if (els.topicsGenerateContent) {
      els.topicsGenerateContent.innerHTML = `<article class="empty-state"><h2>生成失败</h2><p>${escapeHtml(error.message)}</p></article>`;
    }
    if (fromAgent) throw error;
    return null;
  } finally {
    restore();
  }
}

const PIPELINE_STEPS = [
  { id: "insight", label: "分析家长决策点" },
  { id: "angles", label: "展开内容角度" },
  { id: "topics", label: "生成选题方向" },
];

function renderDirectionLoading() {
  if (!els.topicsGenerateContent) return;
  const steps = PIPELINE_STEPS.map((step) => `<li class="pipeline-step is-running">${escapeHtml(step.label)}</li>`).join("");
  els.topicsGenerateContent.innerHTML = `
    <article class="empty-state direction-loading">
      <h2>正在按家长决策链生成选题…</h2>
      <ol class="pipeline-progress">${steps}</ol>
      <p>洞察 → 角度 → 选题三步推理中，稍候片刻即可挑选保存或直接生产。</p>
    </article>
  `;
}

function renderDirectionAiMeta(session) {
  const meta = session?.aiMeta;
  if (!meta) return "";
  if (meta.source === "fallback") return `<small class="ai-meta">AI 失败，已回退本地规则：${escapeHtml(meta.error || "AI 不可用")}</small>`;
  return "";
}

const CONTENT_GOAL_CLASS = { 认知: "goal-awareness", 比较: "goal-compare", 价值: "goal-value", 信任: "goal-trust", 行动: "goal-action", 活动: "goal-campaign" };

function renderInsightPanel(session) {
  const insight = session?.insight;
  if (!insight) return "";
  const topQuestions = Array.isArray(insight.topQuestions) ? insight.topQuestions : [];
  const angles = Array.isArray(session.angles) ? session.angles : [];
  const angleRows = angles.map((angle) => `
    <tr>
      <td><span class="goal-chip ${CONTENT_GOAL_CLASS[angle.contentGoal] || ""}">${escapeHtml(angle.contentGoal || angle.chainId || "")}</span></td>
      <td>${escapeHtml(angle.parentQuestion || angle.title || "")}</td>
    </tr>
  `).join("");
  return `
    <details class="evidence-panel" open>
      <summary>本次依据：家长洞察 + 角度矩阵</summary>
      <div class="evidence-body">
        <div class="evidence-block">
          <h4>家长在纠结什么</h4>
          ${topQuestions.length ? renderList(topQuestions) : "<p>—</p>"}
          ${insight.weeklyFocus ? `<p class="evidence-focus"><strong>本次重点：</strong>${escapeHtml(insight.weeklyFocus)}</p>` : ""}
        </div>
        ${angles.length ? `
          <div class="evidence-block">
            <h4>角度矩阵（${angles.length} 条）</h4>
            <table class="angle-matrix"><tbody>${angleRows}</tbody></table>
          </div>
        ` : ""}
      </div>
    </details>
  `;
}

function renderDirectionCard(direction) {
  const saved = savedDirectionIds.has(direction.id);
  const fromSlot = directionSession?.sourceSlotIndex !== null && directionSession?.sourceSlotIndex !== undefined;
  return `
    <article class="direction-card ${saved ? "is-saved" : ""}" data-direction-id="${escapeHtml(direction.id)}">
      <div class="direction-card-main">
        <div class="card-topline">
          ${direction.contentGoal ? `<span class="goal-chip ${CONTENT_GOAL_CLASS[direction.contentGoal] || ""}">${escapeHtml(direction.contentGoal)}</span>` : ""}
          ${saved ? `<span class="topic-badge">已入库</span>` : ""}
        </div>
        <h3>${escapeHtml(direction.title)}</h3>
        ${direction.parentQuestion ? `<p class="direction-parent-q">家长会问：${escapeHtml(direction.parentQuestion)}</p>` : ""}
        ${direction.reason ? `<p class="direction-reason">为什么现在做：${escapeHtml(direction.reason)}</p>` : ""}
        <p class="topic-purpose"><strong>解决什么：</strong>${escapeHtml(direction.purpose)}</p>
        ${renderPills([direction.pillarLabel, direction.platformText, direction.formatText, direction.audienceText])}
        ${renderStructurePreview(direction)}
        ${direction.risk ? `<small class="topic-risk">${escapeHtml(direction.risk)}</small>` : ""}
      </div>
      <div class="direction-card-actions">
        ${fromSlot ? `<button class="primary direction-adopt-slot" data-direction-id="${escapeHtml(direction.id)}" type="button">采用到这个排期格</button>` : ""}
        <button class="${saved ? "secondary" : (fromSlot ? "secondary" : "primary")} direction-save" data-direction-id="${escapeHtml(direction.id)}" type="button">${saved ? "已保存" : "保存到选题库"}</button>
        <button class="secondary direction-content" data-direction-id="${escapeHtml(direction.id)}" type="button">生成内容</button>
      </div>
    </article>
  `;
}

function renderTopicGenerateStep(session) {
  if (!els.topicsGenerateContent) return;
  if (!session || !Array.isArray(session.directions) || !session.directions.length) {
    els.topicsGenerateContent.innerHTML = `<article class="empty-state"><h2>暂无方向</h2><p>生成选题方向。</p></article>`;
    return;
  }
  const refMeta = session.referenceMeta;
  els.topicsGenerateContent.innerHTML = `
    <div class="page-header">
      <div>
        <h2>选题方向（${session.directions.length} 条）</h2>
      </div>
      ${renderDirectionAiMeta(session)}
    </div>
    ${renderInsightPanel(session)}
    ${refMeta ? `
      <section class="reference-summary">
        <h4>参考结构拆解（仅学结构，不复制原文）</h4>
        <p><strong>概述：</strong>${escapeHtml(refMeta.topicSummary || "")}</p>
        ${refMeta.hookPattern ? `<p><strong>开头：</strong>${escapeHtml(refMeta.hookPattern)}</p>` : ""}
        ${Array.isArray(refMeta.structure) && refMeta.structure.length ? `<div><strong>结构：</strong>${renderList(refMeta.structure)}</div>` : ""}
        ${refMeta.ctaType ? `<p><strong>转化：</strong>${escapeHtml(refMeta.ctaType)}</p>` : ""}
      </section>
    ` : ""}
    <div class="direction-list">
      ${session.directions.map((direction) => renderDirectionCard(direction)).join("")}
    </div>
  `;
}

function findDirection(id) {
  return (directionSession?.directions || []).find((direction) => direction.id === id);
}

async function persistTopicsToLibrary(entries, { markSaved = false } = {}) {
  if (!entries.length) return null;
  profile = readProfileForm();
  const data = await apiRequest("/api/topic-library", {
    profile,
    task: { ...readTask(), plan: currentPlan || undefined },
    entries,
  });
  topicLibraryData = data;
  currentTopics = Array.isArray(data?.topics) ? data.topics : currentTopics;
  if (markSaved) {
    for (const entry of entries) savedDirectionIds.add(entry.id);
  }
  return data;
}

async function saveDirections(directions) {
  if (!directions.length) return;
  await persistTopicsToLibrary(directions, { markSaved: true });
  renderTopicsChrome("generate");
  renderTopicGenerateStep(directionSession);
  syncLatestCardSnapshot();
}

async function saveDirection(id) {
  const direction = findDirection(id);
  if (!direction) return;
  try {
    await saveDirections([direction]);
    showToast("选题已保存");
  } catch (error) {
    showToast(error.message || "选题保存失败", "error");
  }
}

async function saveAllDirections() {
  const unsaved = (directionSession?.directions || []).filter((d) => !savedDirectionIds.has(d.id));
  try {
    await saveDirections(unsaved);
    showToast(unsaved.length ? `已保存 ${unsaved.length} 条选题` : "没有新的选题需要保存");
  } catch (error) {
    showToast(error.message || "选题保存失败", "error");
  }
}

async function archiveLibraryTopicById(id) {
  if (!id) return;
  const data = await apiRequest(
    `/api/topic-library/${encodeURIComponent(id)}`,
    { profile: readProfileForm(), task: readTask(), patch: { status: "archived" } },
    "PATCH",
  );
  topicLibraryData = data;
}

async function writeDirectionToSlot(direction) {
  const slotIndex = directionSession?.sourceSlotIndex;
  const schedule = currentPlan?.publishingSchedule || currentPlan?.week || [];
  const slot = (slotIndex === null || slotIndex === undefined) ? null : schedule[slotIndex];
  if (!slot) return null;
  const prevId = slot.topicId;
  await saveDirections([direction]);
  slot.topicId = direction.id;
  slot.topicTitle = direction.title;
  slot.topicAngle = direction.purpose;
  if (direction.contentType) slot.contentType = direction.contentType;
  if (Array.isArray(direction.materials)) slot.materialNeed = direction.materials;
  await persistPlan();
  // 清旧：替换了不同的旧选题、且没有别的排期格还在用它时，把旧选题归档（软删除，可在选题库恢复）。
  if (prevId && prevId !== direction.id) {
    const stillUsed = schedule.some((entry) => entry !== slot && entry.topicId === prevId);
    if (!stillUsed) {
      try { await archiveLibraryTopicById(prevId); } catch { /* 旧选题可能已不在库，忽略 */ }
    }
  }
  return slot;
}

async function adoptDirectionToSlot(id) {
  const direction = findDirection(id);
  if (!direction) return;
  try {
    const slot = await writeDirectionToSlot(direction);
    if (!slot) {
      showToast("没有找到对应的排期格，请回到一周计划重新进入", "error");
      return;
    }
    directionSession = null;
    savedDirectionIds = new Set();
    navigate({ module: "plan", page: "board" });
    syncLatestCardSnapshot();
    showToast(`已采用到 ${slot.day} · ${slot.platform}`);
  } catch (error) {
    showToast(error.message || "采用失败", "error");
  }
}

function discardDirection(id) {
  if (!directionSession) return;
  directionSession.directions = directionSession.directions.filter((direction) => direction.id !== id);
  savedDirectionIds.delete(id);
  if (!directionSession.directions.length) {
    directionSession = null;
    navigate({ module: "topics", page: null, slotIndex: null });
    syncLatestCardSnapshot();
    return;
  }
  renderTopicsChrome("generate");
  renderTopicGenerateStep(directionSession);
  syncLatestCardSnapshot();
  showToast("已丢弃这条选题");
}

function clearDirectionSession() {
  directionSession = null;
  savedDirectionIds = new Set();
  navigate({ module: "topics", page: null, slotIndex: null });
  syncLatestCardSnapshot();
}

/* ===================== 对话助手 Agent ===================== */

const CHINESE_NUMERALS = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };

function ordinalFromText(text) {
  const digit = text.match(/第?\s*(\d+)\s*条?/);
  if (digit) return Number(digit[1]);
  const cn = text.match(/第\s*([一二两三四五六七八九十])\s*条?/);
  if (cn) return CHINESE_NUMERALS[cn[1]] || null;
  return null;
}

function platformsFromText(text) {
  const map = [["朋友圈", "moments"], ["小红书", "xhs"], ["抖音", "douyin"], ["视频号", "video"], ["社群", "group"], ["微信群", "group"]];
  const hits = map.filter(([label]) => text.includes(label)).map(([, id]) => id);
  return [...new Set(hits)];
}

// 内联动作卡片外壳：紧凑、无详情列表。
// label=卡片标题；主"查看"按钮始终带 data-agent-card 走快照；ops=仅最新一张追加的操作按钮；hint=仅最新一张展示。
function agentCardShell({ cardId, isLatest, label, viewLabel, viewAction, ops = "", hint = "" }) {
  return `
    <div class="agent-card${isLatest ? " is-latest" : ""}">
      <div class="agent-card-head">${escapeHtml(label)}</div>
      <div class="agent-msg-chips agent-card-chips">
        <button class="agent-chip agent-chip-view" data-agent-action="${viewAction}" data-agent-card="${cardId}" type="button">${escapeHtml(viewLabel)}</button>
        ${ops}
      </div>
      ${isLatest && hint ? `<p class="agent-card-hint">${escapeHtml(hint)}</p>` : ""}
    </div>
  `;
}

const resultRegistry = {
  "topic-directions": {
    isEmpty: (session) => !session?.directions?.length,
    summarize(session) {
      const list = session?.directions || [];
      const campaign = list.filter((d) => d.chainId === "campaign_focus").length;
      return campaign
        ? `已生成 ${list.length} 条选题方向（活动向 ${campaign} 条）`
        : `已生成 ${list.length} 条选题方向`;
    },
    renderCard(session, { isLatest, cardId }) {
      const list = session?.directions || [];
      if (!list.length) return "";
      const unsaved = list.filter((d) => !savedDirectionIds.has(d.id)).length;
      const ops = isLatest ? `
          ${unsaved ? `<button class="agent-chip" data-agent-action="save-all" data-agent-card="${cardId}" type="button">全部保存（${unsaved}）</button>` : ""}
          <button class="agent-chip" data-agent-action="open-topic-library" data-agent-card="${cardId}" type="button">选题库</button>
          <button class="agent-chip" data-agent-action="regenerate" data-agent-card="${cardId}" type="button">再来一批</button>
          <button class="agent-chip" data-agent-action="variant-moments" data-agent-card="${cardId}" type="button">换朋友圈向</button>
          <button class="agent-chip" data-agent-action="clear" data-agent-card="${cardId}" type="button">清空本次</button>
      ` : "";
      return agentCardShell({
        cardId,
        isLatest,
        label: "选题方向",
        viewLabel: "查看选题",
        viewAction: "open-topics-generate",
        ops,
        hint: "可以说「第2条做成小红书」直接进内容生产。",
      });
    },
  },
  "weekly-plan": {
    isEmpty: (plan) => !plan || !((plan.publishingSchedule || plan.week || []).length),
    summarize(plan) {
      const schedule = plan?.publishingSchedule || plan?.week || [];
      return `已生成一周计划（${schedule.length} 条排期）`;
    },
    renderCard(plan, { isLatest, cardId }) {
      const schedule = plan?.publishingSchedule || plan?.week || [];
      if (!schedule.length) return "";
      const ops = isLatest ? `
          <button class="agent-chip" data-agent-action="plan-to-topics" data-agent-card="${cardId}" type="button">据此出选题</button>
          <button class="agent-chip" data-agent-action="plan-to-community" data-group="prospect_parents" data-agent-card="${cardId}" type="button">意向群方案</button>
          <button class="agent-chip" data-agent-action="plan-to-community" data-group="enrolled_parents" data-agent-card="${cardId}" type="button">在读群方案</button>
          <button class="agent-chip" data-agent-action="plan-to-community" data-group="adult_players" data-agent-card="${cardId}" type="button">约球群方案</button>
          <button class="agent-chip" data-agent-action="plan-regenerate" data-agent-card="${cardId}" type="button">重排一版</button>
      ` : "";
      return agentCardShell({
        cardId,
        isLatest,
        label: "一周计划",
        viewLabel: "查看排期",
        viewAction: "open-plan-board",
        ops,
        hint: "可以说「周三换成小红书图文」单条调整。",
      });
    },
  },
  "content-material": {
    isEmpty: (data) => !data || !data.topic,
    summarize(data) {
      return `内容生产：${data?.topic?.title || ""}`;
    },
    renderCard(data, { isLatest, cardId }) {
      const topic = data?.topic;
      if (!topic) return "";
      const ops = isLatest ? `
          <button class="agent-chip" data-agent-action="content-video" data-agent-card="${cardId}" type="button">短视频</button>
          <button class="agent-chip" data-agent-action="content-xhs" data-agent-card="${cardId}" type="button">小红书</button>
          <button class="agent-chip" data-agent-action="content-moments" data-agent-card="${cardId}" type="button">朋友圈</button>
          <button class="agent-chip" data-agent-action="content-community" data-agent-card="${cardId}" type="button">社群</button>
          <button class="agent-chip" data-agent-action="content-finalize" data-agent-card="${cardId}" type="button">定稿</button>
          <button class="agent-chip" data-agent-action="open-library" data-agent-card="${cardId}" type="button">成品库</button>
      ` : "";
      return agentCardShell({
        cardId,
        isLatest,
        label: `内容生产 · ${topic.title || ""}`,
        viewLabel: "查看工作台",
        viewAction: "open-content-workbench",
        ops,
        hint: "可说「生成短视频」「改短一点」「换个开头」「撤销」「定稿」。",
      });
    },
  },
  "campaign-plan": {
    isEmpty: (data) => !data?.overview?.title,
    summarize(data) {
      return `活动策划：${data?.overview?.title || ""}`;
    },
    renderCard(data, { isLatest, cardId }) {
      if (!data?.overview?.title) return "";
      const ops = isLatest ? `
          <button class="agent-chip" data-agent-action="campaign-to-topics" data-agent-card="${cardId}" type="button">据此出选题</button>
          <button class="agent-chip" data-agent-action="campaign-to-plan" data-agent-card="${cardId}" type="button">排活动周计划</button>
          <button class="agent-chip" data-agent-action="campaign-regenerate" data-agent-card="${cardId}" type="button">换一版活动</button>
      ` : "";
      return agentCardShell({
        cardId,
        isLatest,
        label: `活动方案 · ${data.overview.title}`,
        viewLabel: "查看方案",
        viewAction: "open-campaign-plan",
        ops,
        hint: "也可以说「更亲子一点」「做成开业活动」「降低执行成本」。",
      });
    },
  },
};

function updateAgentContextLabel() {
  if (!els.agentContextLabel) return;
  const labels = {
    plan: "当前：一周计划",
    topics: "当前：选题库",
    content: "当前：内容生产",
    campaign: "当前：活动策划",
    library: "当前：成品库",
    channels: "当前：社群运营",
    profile: "当前：球场档案",
    ai: "当前：AI 连接",
  };
  els.agentContextLabel.textContent = labels[activeView] || "和主工作区联动";
}

function openAgent() {
  agentSession.open = true;
  agentSession.pendingResult = false;
  els.agentPanel?.classList.remove("hidden");
  if (!agentSession.messages.length) {
    pushAgentMessage("assistant", "你可以直接说运营需求，我会把计划、选题或内容放回主工作区继续处理。", {
      skipRender: true,
    });
  }
  updateAgentContextLabel();
  updateAgentPanelMode();
  renderAgentMessages();
  updateAgentFab();
  els.agentInput?.focus();
}

function closeAgent() {
  agentSession.open = false;
  els.agentPanel?.classList.add("hidden");
  updateAgentFab();
}

function toggleAgent() {
  if (agentSession.open) closeAgent();
  else openAgent();
}

function updateAgentFab() {
  const dot = els.agentFab?.querySelector(".agent-fab-dot");
  if (!dot) return;
  dot.hidden = !(agentSession.pendingResult && !agentSession.open);
  els.agentFab?.classList.toggle("is-open", agentSession.open);
}

function updateAgentPanelMode() {
  els.agentPanel?.classList.toggle("is-expanded", Boolean(agentSession.expanded));
  if (els.agentExpandBtn) {
    els.agentExpandBtn.textContent = agentSession.expanded ? "还原" : "放大";
  }
}

function toggleAgentExpanded() {
  agentSession.expanded = !agentSession.expanded;
  updateAgentPanelMode();
}

function pushAgentMessage(role, text, { skipRender = false, meta = "", chips = [], card = null } = {}) {
  agentSession.messages.push({ role, text, meta, chips, card });
  if (!skipRender) renderAgentMessages();
}

function cloneSnapshot(data) {
  if (data == null) return data;
  try {
    return structuredClone(data);
  } catch {
    try {
      return JSON.parse(JSON.stringify(data));
    } catch {
      return data;
    }
  }
}

let agentCardSeq = 0;
function makeAgentCardId() {
  agentCardSeq += 1;
  return `card-${Date.now().toString(36)}-${agentCardSeq}`;
}

function renderResultCard(card, isLatest) {
  const handler = card && resultRegistry[card.type];
  if (!handler || !handler.renderCard) return "";
  if (handler.isEmpty && handler.isEmpty(card.data)) return "";
  return handler.renderCard(card.data, { isLatest, cardId: card.id });
}

function renderAgentMessages() {
  if (!els.agentMessages) return;
  // 记录每种结果类型最后一张卡片的下标：只有最新一张保留操作按钮，旧卡仅"查看"。
  const latestCardIndexByType = {};
  agentSession.messages.forEach((m, i) => {
    if (m.card && m.card.type) latestCardIndexByType[m.card.type] = i;
  });
  els.agentMessages.innerHTML = agentSession.messages.map((m, i) => {
    const metaHtml = m.meta ? `<small class="agent-msg-meta">${escapeHtml(m.meta)}</small>` : "";
    const chips = (m.chips || []).map((c) => `<button class="agent-chip" data-agent-chip="${escapeHtml(c.value || c.label)}" data-agent-chip-kind="${escapeHtml(c.kind || "fill")}" type="button">${escapeHtml(c.label)}</button>`).join("");
    const chipRow = chips ? `<div class="agent-msg-chips">${chips}</div>` : "";
    const cardHtml = m.card ? renderResultCard(m.card, i === latestCardIndexByType[m.card.type]) : "";
    return `<div class="agent-msg agent-msg-${m.role}"><div class="agent-bubble">${escapeHtml(m.text)}</div>${metaHtml}${chipRow}${cardHtml}</div>`;
  }).join("");
  if (agentSession.busy) {
    els.agentMessages.innerHTML += `<div class="agent-msg agent-msg-assistant"><div class="agent-bubble agent-typing">思考中…</div></div>`;
  }
  els.agentMessages.scrollTop = els.agentMessages.scrollHeight;
}

// 单条改写/保存等会改变全局结果数据后调用：把"当前 activeResult.type 的最新卡片"的
// data 快照用当前全局刷新一遍，使该卡片的「查看」反映最新版本；再重渲染对话。
function syncLatestCardSnapshot() {
  if (!agentSession) return;
  const type = agentSession?.activeResult?.type;
  const data = type ? activeResultData() : null;
  if (type && data) {
    for (let i = agentSession.messages.length - 1; i >= 0; i -= 1) {
      const card = agentSession.messages[i].card;
      if (card && card.type === type) {
        const snapshot = cloneSnapshot(data);
        if (type === "weekly-plan" && snapshot && typeof snapshot === "object") {
          snapshot.__planId = currentPlanId || card.data?.__planId || null;
        }
        card.data = snapshot;
        break;
      }
    }
  }
  if (agentSession.open) renderAgentMessages();
  updateAgentFab();
}

function mergeBrief(prior, incoming) {
  if (!incoming) return prior;
  if (!prior) return incoming;
  const uniq = (a = [], b = []) => [...new Set([...a, ...b])];
  return {
    ...prior,
    ...incoming,
    mustCover: uniq(prior.mustCover, incoming.mustCover),
    mustAvoid: uniq(prior.mustAvoid, incoming.mustAvoid),
    preferredPlatforms: incoming.preferredPlatforms?.length ? incoming.preferredPlatforms : prior.preferredPlatforms,
  };
}

async function sendAgentMessage() {
  const text = (els.agentInput?.value || "").trim();
  if (!text || agentSession.busy) return;
  els.agentInput.value = "";
  autoGrowAgentInput();
  pushAgentMessage("user", text);
  if (activeResultData() && routeAgentIntent(text)) return;
  if (isCampaignRequest(text)) {
    await agentGenerateCampaign(text);
    return;
  }
  await runAgentRoute(text);
}

async function runAgentRoute(text) {
  agentSession.busy = true;
  renderAgentMessages();
  try {
    profile = readProfileForm();
    // 带上最近 6 条对话历史（不含 chips 等元信息），让分类器能看到上下文
    const history = (agentSession.messages || [])
      .filter((m) => m && m.role && typeof m.text === "string")
      .slice(-6)
      .map((m) => ({ role: m.role, text: String(m.text).slice(0, 400) }));
    const data = await apiRequest("/api/agent/route", {
      profile,
      message: text,
      history,
      context: { currentResultType: agentSession?.activeResult?.type || null },
    });
    agentSession.busy = false;
    const intent = data.intent || "chat";

    if (intent === "plan" || intent === "topic") {
      const isPlan = intent === "plan";
      if (data.generationBrief) agentSession.priorBrief = mergeBrief(agentSession.priorBrief, data.generationBrief);
      if (data.generationMode) agentSession.lastMode = data.generationMode;
      const reply = data.reply || (isPlan ? "好的，这就帮你排一周计划。" : "好的，这就帮你生成选题方向。");
      if (Array.isArray(data.clarify) && data.clarify.length) {
        const chips = data.clarify.map((q) => ({ label: q, value: q, kind: "fill" }));
        chips.unshift(isPlan
          ? { label: "直接排计划", value: "__generate_plan__", kind: "generate-plan" }
          : { label: "直接生成选题", value: "__generate__", kind: "generate" });
        agentSession.messages.push({ role: "assistant", text: reply, chips });
        renderAgentMessages();
      } else {
        pushAgentMessage("assistant", reply);
        if (isPlan) await agentGeneratePlan(agentSession.priorBrief, agentSession.lastMode);
        else await agentGenerate();
      }
      return;
    }

    if (intent === "content") {
      await agentStartContent(data);
      return;
    }

    if (intent === "campaign") {
      await agentGenerateCampaign(data.campaignBrief || text);
      return;
    }

    const reply = data.reply || "我可以帮你排一周计划、生成选题方向，也能聊聊招生、活动、家长沟通这些经营问题。";
    const chips = [];
    if (data.suggestedAction && data.suggestedAction.type) {
      const valueMap = { plan: "__plan__", topic: "__topic__", content: "__content__", campaign: "__campaign__" };
      const kindMap = { plan: "suggest-plan", topic: "suggest-topic", content: "suggest-content", campaign: "suggest-campaign" };
      chips.push({
        label: data.suggestedAction.label || "去生成",
        value: valueMap[data.suggestedAction.type] || data.suggestedAction.label,
        kind: kindMap[data.suggestedAction.type] || "fill",
      });
    }
    agentSession.messages.push({ role: "assistant", text: reply, chips });
    renderAgentMessages();
  } catch (error) {
    agentSession.busy = false;
    pushAgentMessage("assistant", `处理失败：${error.message}`);
  }
}

const AGENT_FORMAT_LABELS = { xhs_image: "小红书图文", video: "短视频脚本", moments_text: "朋友圈", community: "社群" };

function agentFormatLabel(format) {
  return AGENT_FORMAT_LABELS[format] || (typeof materialTypeMeta === "function" ? materialTypeMeta(format)?.label : "") || "内容";
}

function contentEditHint() {
  return "可以说「生成短视频」「改短一点」「换个开头」「撤销」或「定稿」。";
}

async function resolveLibraryTopic(ref) {
  if (!ref) return null;
  if (!topicLibraryData) { try { await loadTopicLibrary(); } catch { /* ignore */ } }
  const topics = topicLibraryData?.topics || currentTopics || [];
  if (!topics.length) return null;
  if (ref.ordinal && topics[ref.ordinal - 1]) return topics[ref.ordinal - 1];
  if (ref.match) {
    const m = String(ref.match);
    return topics.find((t) => (t.title || "").includes(m) || (m && m.includes(t.title || ""))) || null;
  }
  return null;
}

async function agentStartContent(data) {
  const meta = "";
  const fmt = data.targetFormat || null;
  const fmtNote = fmt ? `（${agentFormatLabel(fmt)}）` : "";

  // 1) 引用选题库里已有的选题
  if (data.libraryRef && (data.libraryRef.match || data.libraryRef.ordinal)) {
    const topic = await resolveLibraryTopic(data.libraryRef);
    if (topic) {
      openContentForTopic(topic, fmt);
      agentSession.activeFormat = fmt || agentSession.activeFormat;
      emitAgentCard("content-material", { text: `已把「${topic.title}」带入内容生产${fmtNote}。${contentEditHint()}` });
      return;
    }
    pushAgentMessage("assistant", "选题库里没找到对应的那条，我先按你的描述来做。", { meta });
  }

  // 2) 自由想法 -> 整理成选题后打开工作台
  const idea = (data.contentIdea || "").trim();
  if (!idea) {
    pushAgentMessage("assistant", data.reply || "想做成什么内容？描述一句就行，比如「4岁孩子学网球能坚持吗，做成小红书」。", { meta });
    return;
  }

  agentSession.busy = true;
  pushAgentMessage("assistant", "正在把想法整理成选题，结果会显示在主面板…");
  try {
    profile = readProfileForm();
    const shaped = await apiRequest("/api/content/shape-idea", { profile, idea });
    agentSession.busy = false;
    agentSession.messages.pop();
    if (shaped && shaped.topic) {
      openContentForTopic(shaped.topic, fmt);
      agentSession.activeFormat = fmt || agentSession.activeFormat;
      emitAgentCard("content-material", { text: `已在主面板打开内容生产：「${shaped.topic.title}」${fmt ? `，正在生成${agentFormatLabel(fmt)}` : ""}。${contentEditHint()}` });
    } else {
      throw new Error("整理结果为空");
    }
  } catch (error) {
    agentSession.busy = false;
    if (agentSession.messages[agentSession.messages.length - 1]?.text?.startsWith("正在把想法整理成选题")) agentSession.messages.pop();
    // 兜底：用最简选题直接打开工作台
    const title = idea.length > 24 ? `${idea.slice(0, 24)}…` : idea;
    const topic = { id: `idea-${Date.now()}`, title, formats: ["video", "xhs_image", "moments_text", "community"], source: "idea" };
    openContentForIdea(topic, { title, topicAngle: idea, keyPoints: [], cta: "" });
    if (fmt) generateMaterial(fmt);
    agentSession.activeFormat = fmt || agentSession.activeFormat;
    emitAgentCard("content-material", { text: `已在主面板打开内容生产：「${title}」${fmt ? `，正在生成${agentFormatLabel(fmt)}` : ""}。${contentEditHint()}` });
  }
}

async function runAgentBrief(text) {
  agentSession.busy = true;
  renderAgentMessages();
  try {
    profile = readProfileForm();
    const data = await apiRequest("/api/agent/topic-brief", {
      profile,
      message: text,
      priorBrief: agentSession.priorBrief || undefined,
    });
    agentSession.busy = false;
    if (data.generationBrief) agentSession.priorBrief = mergeBrief(agentSession.priorBrief, data.generationBrief);
    if (data.generationMode) agentSession.lastMode = data.generationMode;
    const reply = data.reply || "我已理解你的需求。";
    const chips = (Array.isArray(data.clarifyQuestions) ? data.clarifyQuestions : []).map((q) => ({ label: q, value: q, kind: "fill" }));
    chips.unshift({ label: "直接生成选题", value: "__generate__", kind: "generate" });
    agentSession.messages.push({ role: "assistant", text: reply, chips });
    renderAgentMessages();
  } catch (error) {
    agentSession.busy = false;
    pushAgentMessage("assistant", `解析失败：${error.message}`);
  }
}

async function agentGenerate(extraBrief = null, { campaignLink = null } = {}) {
  if (agentSession.busy) return;
  if (extraBrief) agentSession.priorBrief = mergeBrief(agentSession.priorBrief, extraBrief);
  agentSession.busy = true;
  pushAgentMessage("assistant", "正在按家长决策链生成选题，结果会显示在主面板…");
  try {
    const data = await generateDirections({ brief: agentSession.priorBrief, mode: agentSession.lastMode, fromAgent: true, campaignLink });
    agentSession.busy = false;
    agentSession.messages.pop();
    emitAgentCard("topic-directions", { text: `${resultRegistry["topic-directions"].summarize(data)}。可以说「全部保存」「再来一批」「换朋友圈向」，或「第2条软一点」。` });
  } catch (error) {
    agentSession.busy = false;
    agentSession.messages.pop();
    pushAgentMessage("assistant", `生成失败：${error.message}`);
  }
}

async function agentGeneratePlan(brief = null, mode = null, campaignLink = null) {
  if (agentSession.busy) return;
  agentSession.busy = true;
  pushAgentMessage("assistant", "正在排一周计划，结果会显示在主面板…");
  try {
    const plan = await generatePlan({ brief, mode, fromAgent: true, campaignLink });
    agentSession.busy = false;
    agentSession.messages.pop();
    if (!plan) { pushAgentMessage("assistant", "计划没有生成成功，请补充信息后再试。"); return; }
    emitAgentCard("weekly-plan", { text: `${resultRegistry["weekly-plan"].summarize(plan)}。可以说「重排一版」「据此出选题」，或「周三换成小红书图文」单条调整。` });
  } catch (error) {
    agentSession.busy = false;
    agentSession.messages.pop();
    pushAgentMessage("assistant", `生成失败：${error.message}`);
  }
}

const CAMPAIGN_QUICK_CARDS = [
  { label: "开业体验活动", value: "开业体验活动" },
  { label: "少儿体验课", value: "少儿体验课" },
  { label: "亲子网球日", value: "亲子网球日" },
  { label: "成人新手局", value: "成人新手局" },
  { label: "节假日活动", value: "节假日活动" },
  { label: "自定义目标", value: "我想策划一个活动：", kind: "fill" },
];

function campaignCardGrid() {
  return CAMPAIGN_QUICK_CARDS
    .filter((item) => item.kind !== "fill")
    .map((item) => `
      <button class="campaign-template-card" data-campaign-template="${escapeHtml(item.value)}" type="button">
        <strong>${escapeHtml(item.label)}</strong>
        <span>生成方案</span>
      </button>
    `).join("");
}

function campaignBriefFromPlan(plan = null) {
  const schedule = plan?.publishingSchedule || plan?.week || [];
  const themes = schedule.map((slot) => slot.topicTitle || slot.directionHint || slot.theme).filter(Boolean).slice(0, 5);
  return {
    title: plan?.overview?.title || "",
    focus: plan?.overview?.focus || "",
    themes,
  };
}

function campaignBriefFromResult(plan = currentCampaignPlan) {
  const overview = plan?.overview || {};
  const hooks = Array.isArray(plan?.contentHooks) ? plan.contentHooks.map((h) => h.hook || h.title).filter(Boolean) : [];
  return {
    theme: overview.title || "活动策划",
    primaryGoal: "event",
    mustCover: [overview.coreIdea, overview.audience, overview.goal, ...hooks].filter(Boolean).slice(0, 6),
    mustAvoid: [],
    preferredPlatforms: ["xhs", "douyin", "video", "moments"],
    toneOverride: "具体、可信、轻转化，不夸张承诺活动效果",
  };
}

function showCampaignGuide() {
  pushAgentMessage("assistant", "想策划哪类活动？你可以先选一个方向，我会把完整方案放到主工作区。", {
    chips: CAMPAIGN_QUICK_CARDS.map((item) => ({
      label: item.label,
      value: item.value,
      kind: item.kind || "campaign-template",
    })),
  });
}

function isCampaignRequest(text) {
  return /(策划|方案|活动点子|活动创意|活动玩法|活动主题|活动怎么做|做个活动|设计一个活动|办个活动)/.test(text)
    && /活动|体验课|开业|亲子|成人|新手|招生|报名|节假日|寒假|暑假|比赛|公开课/.test(text);
}

async function agentGenerateCampaign(rawBrief = "") {
  if (agentSession.busy) return;
  const brief = String(rawBrief || "").trim() || "日常拉新活动";
  agentSession.busy = true;
  pushAgentMessage("assistant", "正在策划活动，结果会显示在主工作区…");
  try {
    profile = readProfileForm();
    const data = await apiRequest("/api/agent/campaign-plan", {
      profile,
      task: {
        ...readTask(),
        campaignBrief: brief,
        plan: currentPlan || undefined,
        planContext: campaignBriefFromPlan(currentPlan),
      },
    });
    agentSession.busy = false;
    agentSession.messages.pop();
    currentCampaignBrief = brief;
    renderCampaignPlan(data);
    await persistCampaignPlan(data, brief);
    emitAgentCard("campaign-plan", { text: `${resultRegistry["campaign-plan"].summarize(data)}。你可以继续「据此出选题」或「排活动周计划」。` });
  } catch (error) {
    agentSession.busy = false;
    agentSession.messages.pop();
    pushAgentMessage("assistant", `活动策划失败：${error.message}`);
  }
}

async function generateCampaignFromPanel(brief, button = null) {
  const text = String(brief || "").trim();
  if (!text) {
    els.campaignView?.querySelector("#campaignBriefInput")?.focus();
    return;
  }
  const restore = button ? setLoading(button, "生成中") : () => {};
  try {
    profile = readProfileForm();
    const data = await apiRequest("/api/agent/campaign-plan", {
      profile,
      task: {
        ...readTask(),
        campaignBrief: text,
        plan: currentPlan || undefined,
        planContext: campaignBriefFromPlan(currentPlan),
      },
    });
    currentCampaignBrief = text;
    renderCampaignPlan(data);
    await persistCampaignPlan(data, text);
    showToast("活动方案已生成");
  } catch (error) {
    showToast(error.message || "活动策划失败", "error");
  } finally {
    restore();
  }
}

function campaignToTopics() {
  if (!currentCampaignPlan) return;
  generateDirections({ brief: campaignBriefFromResult(), mode: "focused", fromAgent: false, campaignLink: currentCampaignLink() });
}

function currentCampaignLink() {
  if (!currentCampaignId || !currentCampaignPlan) return null;
  return { id: currentCampaignId, title: currentCampaignPlan?.overview?.title || "" };
}

function campaignToPlan() {
  if (!currentCampaignPlan) return;
  generatePlan({ brief: campaignBriefFromResult(), mode: "focused", fromAgent: false, campaignLink: currentCampaignLink() });
}

// 计划 → 活动：带本周计划上下文进活动策划（planContext 由 generateCampaignFromPanel 自动附带）。
function planToCampaign() {
  if (!currentPlan) { showToast("先生成一周计划再策划配套活动", "error"); return; }
  const focus = currentPlan.overview?.focus || "";
  const brief = `配合本周计划「${currentPlan.overview?.title || "一周计划"}」${focus ? `（重点：${focus}）` : ""}策划一个引流转化活动`;
  navigate({ module: "campaign", page: null, slotIndex: null });
  showToast("正在策划配套活动…");
  generateCampaignFromPanel(brief);
}

function routeCampaignIntent(text) {
  if (/(据此|根据|按这个|用这个).{0,6}(出选题|生成选题|内容选题)/.test(text)) {
    agentGenerate(campaignBriefFromResult(), { campaignLink: currentCampaignLink() });
    return true;
  }
  if (/(排|生成|做).{0,6}(活动周|一周计划|周计划|排期)/.test(text)) {
    const brief = campaignBriefFromResult();
    agentSession.priorBrief = mergeBrief(agentSession.priorBrief, brief);
    agentSession.lastMode = "focused";
    agentGeneratePlan(brief, "focused", currentCampaignLink());
    return true;
  }
  if (/(重来|重新|再来|换一版|换个|更亲子|更轻|更简单|降低成本|开业|亲子|成人|少儿|节假日|暑假|寒假|体验课)/.test(text)) {
    agentGenerateCampaign(text);
    return true;
  }
  return false;
}

function routeAgentIntent(text) {
  const type = agentSession?.activeResult?.type;
  if (type === "topic-directions") return routeTopicIntent(text);
  if (type === "weekly-plan") return routePlanIntent(text);
  if (type === "content-material") return routeContentIntent(text);
  if (type === "campaign-plan") return routeCampaignIntent(text);
  return false;
}

function contentFormatFromText(text) {
  if (/短视频|视频|抖音|视频号/.test(text)) return "video";
  if (/朋友圈/.test(text)) return "moments_text";
  if (/小红书|图文|帖子/.test(text)) return "xhs_image";
  if (/社群|社区/.test(text)) return "community";
  return null;
}

function routeContentIntent(text) {
  const explicitFmt = contentFormatFromText(text);
  const fmt = explicitFmt || agentSession.activeFormat;

  if (explicitFmt && /(生成|做成|做一个|做个|做一份|出一?[个版份]|来个|来一[版份]|换成|改成|再做|也做)/.test(text)) {
    pushAgentMessage("assistant", `好的，正在生成${agentFormatLabel(explicitFmt)}，详细结果看主面板。`);
    generateMaterial(explicitFmt);
    return true;
  }
  if (/(定稿|存成品|存入成品|入成品库|取消定稿)/.test(text)) {
    if (!fmt || !generatedMaterials[fmt]) { pushAgentMessage("assistant", "还没有可定稿的内容，先生成一版。"); return true; }
    finalizeMaterial(fmt).then(() => {
      const st = generatedMaterials[fmt]?.status;
      pushAgentMessage("assistant", st === "final" ? `已把${agentFormatLabel(fmt)}定稿并存入成品库。` : `已取消${agentFormatLabel(fmt)}的定稿。`);
      syncLatestCardSnapshot();
    });
    return true;
  }
  if (/(撤销|回到上一版|上一版|还原|回退|撤回)/.test(text)) {
    const entry = fmt ? generatedMaterials[fmt] : null;
    if (entry && Array.isArray(entry.history) && entry.history.length) {
      rollbackMaterial(fmt, entry.history.length - 1);
      pushAgentMessage("assistant", `已回到${agentFormatLabel(fmt)}的上一版，详细看主面板。`);
      syncLatestCardSnapshot();
    } else {
      pushAgentMessage("assistant", "没有可撤销的历史版本。");
    }
    return true;
  }
  if (/(改短|改长|短一点|长一点|精简|压缩|口语|正式|温和|开头|结尾|标题|钩子|换个?说法|换一种|加一?句|加个|删掉|去掉|润色|优化|改写|重写|改一下|改改|修改|调整|再软|再硬|更具体|具体一点|换标题)/.test(text)) {
    agentRefineMaterial(fmt, text);
    return true;
  }
  return false;
}

const PLAN_WEEKDAY_MAP = { 一: "周一", 二: "周二", 三: "周三", 四: "周四", 五: "周五", 六: "周六", 日: "周日", 天: "周日" };

function weekdayFromText(text) {
  const m = text.match(/周\s*([一二三四五六日天])/);
  return m ? PLAN_WEEKDAY_MAP[m[1]] || null : null;
}

function groupTypeFromText(text) {
  if (/在读|学员家长|已报名/.test(text)) return "enrolled_parents";
  if (/约球|球友|成人/.test(text)) return "adult_players";
  if (/意向|潜在|没报名|未报名/.test(text)) return "prospect_parents";
  return null;
}

function routePlanIntent(text) {
  if (/(社群|微信群).{0,8}(节奏|运营|话术|内容|生成|出|做)|根据.{0,4}计划.{0,6}(社群|微信群)/.test(text)) {
    const group = groupTypeFromText(text) || currentGroupType;
    pushAgentMessage("assistant", `正在根据当前一周计划生成${GROUP_TYPE_LABELS[group] || "社群"}运营方案。`);
    generateCommunityPlan(group);
    return true;
  }
  if (/(重排|重新排|再排|换一版|换个版|重新生成|再生成一版|再来一版)/.test(text)) {
    agentGeneratePlan(agentSession.priorBrief, agentSession.lastMode);
    return true;
  }
  if (/(据此|按计划|根据计划|顺便)?.{0,4}(出选题|生成选题|出几条选题)/.test(text)) {
    agentGenerate();
    return true;
  }
  const day = weekdayFromText(text);
  if (day && /(换|改|调整|改成|换成|改为|变成)/.test(text)) {
    const schedule = currentPlan?.publishingSchedule || currentPlan?.week || [];
    const index = schedule.findIndex((slot) => slot.day === day);
    if (index >= 0) { agentRefinePlanSlot(index, text); return true; }
    pushAgentMessage("assistant", `本周${day}没有排期，换一天或先重排一版试试。`);
    return true;
  }
  return false;
}

async function agentRefinePlanSlot(index, instruction) {
  if (!currentPlan) return;
  agentSession.busy = true;
  renderAgentMessages();
  try {
    profile = readProfileForm();
    const data = await apiRequest("/api/agent/plan-slot-refine", {
      profile,
      plan: currentPlan,
      slotIndex: index,
      instruction,
    });
    agentSession.busy = false;
    if (data?.slot) {
      const schedule = currentPlan.publishingSchedule || currentPlan.week || [];
      schedule[index] = data.slot;
      currentPlan.publishingSchedule = schedule;
      currentPlan.week = schedule;
      persistPlan();
      if (currentRoute.module === "plan") renderPlanBoard(currentPlan);
      syncLatestCardSnapshot();
      pushAgentMessage("assistant", `已调整 ${data.slot.day} 的排期：${data.slot.platform}${data.slot.topicTitle ? " · " + data.slot.topicTitle : ""}。`);
    } else {
      pushAgentMessage("assistant", "这条排期没改成功，请换个说法再试。");
    }
  } catch (error) {
    agentSession.busy = false;
    pushAgentMessage("assistant", `改写失败：${error.message}`);
  }
}

function routeTopicIntent(text) {
  const ord = ordinalFromText(text);
  const platforms = platformsFromText(text);

  if (ord && /(做成|生成|出|改成).{0,6}(小红书|图文|短视频|视频|抖音|朋友圈|社群|微信群)/.test(text)) {
    const dir = directionSession.directions[ord - 1];
    if (dir) {
      const fmt = /社群|微信群/.test(text)
        ? "community"
        : (/短视频|视频|抖音/.test(text) ? "video" : (/朋友圈/.test(text) ? "moments_text" : "xhs_image"));
      const fmtLabel = agentFormatLabel(fmt);
      openContentForDirection(dir.id, fmt);
      emitAgentCard("content-material", { text: `已把第 ${ord} 条「${dir.title}」带入内容生产（${fmtLabel}）。` });
      return true;
    }
  }
  if (/(全部|全选|都|所有).{0,4}(保存|入库)|保存(全部|所有)|都存/.test(text)) {
    saveAllDirections().then(() => pushAgentMessage("assistant", "已把未保存的选题都存入选题库。"));
    return true;
  }
  if (/保存|入库|收藏|存(一)?下/.test(text) && ord) {
    const dir = directionSession.directions[ord - 1];
    if (dir) { saveDirection(dir.id).then(() => pushAgentMessage("assistant", `已保存第 ${ord} 条「${dir.title}」到选题库。`)); return true; }
  }
  if (/(丢弃|删除|去掉|不要|删掉)/.test(text) && ord) {
    const dir = directionSession.directions[ord - 1];
    if (dir) { discardDirection(dir.id); pushAgentMessage("assistant", `已丢弃第 ${ord} 条。`); return true; }
  }
  if (ord && /(软|硬|换个?钩子|改写|重写|口语|正式|温和|短一点|长一点|再具体|更具体)/.test(text)) {
    agentRefineDirection(ord - 1, text);
    return true;
  }
  if (/(重新生成|再生成|换一批|再来一批|再来|重来|再出|换批|再生成一批)/.test(text)) {
    const extra = platforms.length ? { preferredPlatforms: platforms } : null;
    if (platforms.length) pushAgentMessage("assistant", `好的，这一批偏向${platforms.map((p) => ({ moments: "朋友圈", xhs: "小红书", douyin: "抖音", video: "视频号", group: "社群" }[p] || p)).join("、")}。`);
    agentGenerate(extra);
    return true;
  }
  if (/(就这样|可以了|开始生成|直接生成|生成吧|生成选题|出选题)/.test(text)) {
    agentGenerate();
    return true;
  }
  return false;
}

async function agentRefineDirection(index, instruction) {
  const dir = directionSession?.directions?.[index];
  if (!dir) { pushAgentMessage("assistant", "没找到对应的选题，请确认条目序号。"); return; }
  agentSession.busy = true;
  renderAgentMessages();
  try {
    profile = readProfileForm();
    const data = await apiRequest("/api/agent/direction-refine", {
      profile,
      direction: dir,
      instruction,
    });
    agentSession.busy = false;
    if (data?.direction) {
      directionSession.directions[index] = data.direction;
      savedDirectionIds.delete(dir.id);
      renderTopicsChrome("generate");
      renderTopicGenerateStep(directionSession);
      syncLatestCardSnapshot();
      pushAgentMessage("assistant", `已按要求改写第 ${index + 1} 条：「${data.direction.title}」。`);
    } else {
      pushAgentMessage("assistant", "改写没有返回有效结果，请换个说法再试。");
    }
  } catch (error) {
    agentSession.busy = false;
    pushAgentMessage("assistant", `改写失败：${error.message}`);
  }
}

function handleAgentQuickAction(kind) {
  if (agentSession.busy) return;
  if (kind === "plan") {
    pushAgentMessage("user", "生成一周计划");
    agentGeneratePlan(agentSession.priorBrief, agentSession.lastMode);
  } else if (kind === "topic") {
    pushAgentMessage("user", "生成选题方向");
    agentGenerate();
  } else if (kind === "content") {
    setView("content");
    pushAgentMessage("assistant", "已打开内容生产。你可以输入一个想法，或直接说「把4岁能不能学网球做成小红书」。");
  } else if (kind === "community") {
    setView("channels");
    if (currentPlan) {
      pushAgentMessage("assistant", "已打开社群运营。可以基于当前一周计划生成社群节奏。", {
        chips: [{ label: "生成社群节奏", value: "__community_generate__", kind: "generate-community" }],
      });
    } else {
      pushAgentMessage("assistant", "已打开社群运营。先有一周计划时，社群内容会更容易和本周主题对齐。");
    }
  } else if (kind === "campaign") {
    pushAgentMessage("user", "生成活动策划");
    showCampaignGuide();
  }
}

function handleAgentChip(value, kind) {
  if (kind === "generate" || kind === "suggest-topic" || value === "__generate__" || value === "__topic__") {
    agentGenerate();
    return;
  }
  if (kind === "generate-plan" || kind === "suggest-plan" || value === "__generate_plan__" || value === "__plan__") {
    agentGeneratePlan(agentSession.priorBrief, agentSession.lastMode);
    return;
  }
  if (kind === "suggest-content" || value === "__content__") {
    setView("content");
    pushAgentMessage("assistant", "想做成内容的话，直接描述就行，比如「4岁孩子学网球能坚持吗，做成小红书」，我直接带你进内容生产；也可以说「选题库里关于XX的做成视频」。");
    return;
  }
  if (kind === "suggest-community" || kind === "generate-community" || value === "__community__" || value === "__community_generate__") {
    setView("channels");
    if (kind === "generate-community" || value === "__community_generate__") {
      generateCommunityPlan();
    } else {
      pushAgentMessage("assistant", "已打开社群运营。你也可以说「根据本周计划生成社群节奏」。");
    }
    return;
  }
  if (kind === "campaign-template") {
    pushAgentMessage("user", value);
    agentGenerateCampaign(value);
    return;
  }
  if (kind === "suggest-campaign" || value === "__campaign__") {
    showCampaignGuide();
    return;
  }
  if (els.agentInput) {
    els.agentInput.value = value;
    autoGrowAgentInput();
    els.agentInput.focus();
  }
}

function runAgentMaterialAction(format) {
  if (!currentTopic) {
    setView("content");
    pushAgentMessage("assistant", "还没有选题。先在内容生产里输入一个想法，或直接告诉我想做什么内容。");
    return;
  }
  setView("content");
  agentSession.activeFormat = format;
  pushAgentMessage("assistant", `正在生成${agentFormatLabel(format)}，详细结果看主工作区。`);
  generateMaterial(format);
}

function handleAgentResultAction(action, el) {
  const card = findAgentCardById(el?.closest?.("[data-agent-card]")?.dataset?.agentCard);
  if (action === "open-plan-board") {
    // 查看类：优先按该卡片的快照恢复到那一版结果。
    if (card?.data) {
      currentPlan = cloneSnapshot(card.data);
      currentPlanId = card.data.__planId || currentPlanId;
      resetCommunityPlans();
      updateContext();
    }
    navigate({ module: "plan", page: "board" });
  } else if (action === "open-topics-generate") {
    if (card?.data) {
      directionSession = cloneSnapshot(card.data);
    }
    navigate({ module: "topics", page: "generate" });
    if (card?.data) renderTopicGenerateStep(directionSession);
  } else if (action === "open-topic-library") {
    navigate({ module: "topics", page: null });
  } else if (action === "open-content-workbench") {
    setView("content");
  } else if (action === "open-library") {
    setView("library");
  } else if (action === "save-all") {
    saveAllDirections().then(() => pushAgentMessage("assistant", "已把未保存的选题都存入选题库。"));
  } else if (action === "regenerate") {
    agentGenerate();
  } else if (action === "variant-moments") {
    pushAgentMessage("assistant", "好的，这一批偏向朋友圈私域表达。");
    agentGenerate({ preferredPlatforms: ["moments"] });
  } else if (action === "clear") {
    clearDirectionSession();
    pushAgentMessage("assistant", "已清空本次生成结果。");
  } else if (action === "plan-regenerate") {
    agentGeneratePlan(agentSession.priorBrief, agentSession.lastMode);
  } else if (action === "plan-to-topics") {
    agentGenerate();
  } else if (action === "plan-to-community") {
    const group = el?.dataset.group || currentGroupType;
    pushAgentMessage("assistant", `正在根据当前一周计划生成${GROUP_TYPE_LABELS[group] || "社群"}运营方案。`);
    generateCommunityPlan(group);
  } else if (action === "open-campaign-plan") {
    if (card?.data) renderCampaignPlan(cloneSnapshot(card.data));
    navigate({ module: "campaign", page: null });
  } else if (action === "campaign-to-topics") {
    agentGenerate(campaignBriefFromResult(), { campaignLink: currentCampaignLink() });
  } else if (action === "campaign-to-plan") {
    const brief = campaignBriefFromResult();
    agentSession.priorBrief = mergeBrief(agentSession.priorBrief, brief);
    agentSession.lastMode = "focused";
    agentGeneratePlan(brief, "focused", currentCampaignLink());
  } else if (action === "campaign-regenerate") {
    agentGenerateCampaign(currentCampaignPlan?.overview?.title || "换一版活动策划");
  } else if (action === "content-video") {
    runAgentMaterialAction("video");
  } else if (action === "content-xhs") {
    runAgentMaterialAction("xhs_image");
  } else if (action === "content-moments") {
    runAgentMaterialAction("moments_text");
  } else if (action === "content-community") {
    runAgentMaterialAction("community");
  } else if (action === "content-finalize") {
    const fmt = agentSession.activeFormat || Object.keys(generatedMaterials)[0];
    if (!fmt || !generatedMaterials[fmt]) {
      pushAgentMessage("assistant", "还没有可定稿的内容，先生成一版。");
      return;
    }
    finalizeMaterial(fmt).then(() => {
      const st = generatedMaterials[fmt]?.status;
      pushAgentMessage("assistant", st === "final" ? `已把${agentFormatLabel(fmt)}定稿并存入成品库。` : `已取消${agentFormatLabel(fmt)}的定稿。`);
      syncLatestCardSnapshot();
    });
  }
}

function autoGrowAgentInput() {
  const input = els.agentInput;
  if (!input) return;
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
}

function closeTopicModal() {
  if (els.topicsModalRoot) els.topicsModalRoot.innerHTML = "";
}

function openReferenceModal() {
  if (!els.topicsModalRoot) return;
  els.topicsModalRoot.innerHTML = `
    <div class="modal-overlay" data-modal-overlay>
      <div class="modal-card">
        <h3>从参考开始</h3>
        <p class="modal-hint">描述一条你想模仿的抖音/小红书内容：怎么开头、讲了哪几点、怎么转化。我们只学结构，不复制原文。</p>
        <div class="modal-grid">
          <label>平台
            <select data-ref-field="platform">
              <option value="douyin">抖音</option>
              <option value="video">视频号</option>
              <option value="xhs">小红书</option>
              <option value="moments">朋友圈</option>
            </select>
          </label>
          <label>形式
            <select data-ref-field="format">
              <option value="video">短视频</option>
              <option value="xhs_image">图文</option>
            </select>
          </label>
        </div>
        <label>参考内容描述
          <textarea data-ref-field="description" rows="5" placeholder="例如：开头用反问“成人零基础学网球会不会很丢人”，然后讲 3 个常见误区，最后引导私信预约体验课。可附上你看到的字幕/口播要点。"></textarea>
        </label>
        <label class="modal-file">截图（可选，仅作你自己的参考，不会上传）
          <input type="file" accept="image/*" data-ref-field="image" />
        </label>
        <div class="modal-image-preview" data-ref-preview></div>
        <div class="modal-actions">
          <button class="ghost" data-modal-close type="button">取消</button>
          <button class="primary" data-ref-submit type="button">解析并生成方向</button>
        </div>
        <div class="modal-alert hidden" data-ref-alert></div>
      </div>
    </div>
  `;
}

async function parseReference() {
  const root = els.topicsModalRoot;
  if (!root) return;
  const description = root.querySelector('[data-ref-field="description"]').value.trim();
  const platform = root.querySelector('[data-ref-field="platform"]').value;
  const format = root.querySelector('[data-ref-field="format"]').value;
  const alertBox = root.querySelector("[data-ref-alert]");
  if (!description) {
    alertBox.classList.remove("hidden");
    alertBox.textContent = "请先描述参考内容的结构和说了什么。";
    return;
  }
  const submit = root.querySelector("[data-ref-submit]");
  const restore = setLoading(submit, "解析中");
  try {
    profile = readProfileForm();
    const data = await apiRequest("/api/topic-reference/parse", {
      profile,
      task: { ...readTask(), plan: currentPlan || undefined },
      reference: { description, platform, format },
    });
    closeTopicModal();
    setDirectionSession(data, { origin: "panel" });
  } catch (error) {
    alertBox.classList.remove("hidden");
    alertBox.textContent = error.message;
  } finally {
    restore();
  }
}

function openCampaignModal() {
  if (!els.topicsModalRoot) return;
  els.topicsModalRoot.innerHTML = `
    <div class="modal-overlay" data-modal-overlay>
      <div class="modal-card campaign-modal">
        <h3>活动选题</h3>
        <p class="modal-hint">仅在要推活动时用。填一句活动信息，围绕这次活动生成一批选题方向；平时日常选题走「生成选题方向」即可。</p>
        <label>活动信息
          <textarea data-campaign-field="event" rows="4" placeholder="例如：暑期班 7/1 开课，前 20 名报名送 2 节体验课；面向 5-10 岁零基础孩子。"></textarea>
        </label>
        <div class="modal-actions">
          <button class="ghost" data-modal-close type="button">取消</button>
          <button class="primary" data-campaign-submit type="button">生成活动选题</button>
        </div>
        <div class="modal-alert hidden" data-campaign-alert></div>
      </div>
    </div>
  `;
}

async function submitCampaignTopics() {
  const root = els.topicsModalRoot;
  if (!root) return;
  const eventInfo = root.querySelector('[data-campaign-field="event"]').value.trim();
  const alertBox = root.querySelector("[data-campaign-alert]");
  if (!eventInfo) {
    alertBox.classList.remove("hidden");
    alertBox.textContent = "请先填写这次活动的信息。";
    return;
  }
  closeTopicModal();
  // generateDirections renders its own loading + error states on the result page.
  await generateDirections({ mode: "hybrid", eventInfo, focus: eventInfo });
}

const platformFormatMap = {
  xhs: { platforms: ["xhs"], formats: ["xhs_image"] },
  douyin: { platforms: ["douyin", "video"], formats: ["video"] },
  video: { platforms: ["video"], formats: ["video"] },
  moments: { platforms: ["moments"], formats: ["moments_text"] },
  group: { platforms: ["group"], formats: ["community"] },
};

function openManualModal(topic) {
  if (!els.topicsModalRoot) return;
  const editing = Boolean(topic);
  const primaryPlatform = (topic?.platforms || [])[0] || "xhs";
  els.topicsModalRoot.innerHTML = `
    <div class="modal-overlay" data-modal-overlay>
      <div class="modal-card">
        <h3>${editing ? "编辑选题" : "手动添加选题"}</h3>
        ${editing ? `<input type="hidden" data-manual-field="id" value="${escapeHtml(topic.id)}" />` : ""}
        <label>标题
          <input type="text" data-manual-field="title" value="${escapeHtml(topic?.title || "")}" placeholder="例如：成人零基础第一次来要准备什么" />
        </label>
        <label>解决什么（角度）
          <textarea data-manual-field="purpose" rows="2" placeholder="这条选题面向谁、解决什么顾虑或问题">${escapeHtml(topic?.purpose || "")}</textarea>
        </label>
        <label>平台
          <select data-manual-field="platform">
            <option value="xhs" ${primaryPlatform === "xhs" ? "selected" : ""}>小红书</option>
            <option value="douyin" ${primaryPlatform === "douyin" ? "selected" : ""}>抖音/视频号</option>
            <option value="video" ${primaryPlatform === "video" ? "selected" : ""}>视频号</option>
            <option value="moments" ${primaryPlatform === "moments" ? "selected" : ""}>朋友圈</option>
            <option value="group" ${primaryPlatform === "group" ? "selected" : ""}>微信群</option>
          </select>
        </label>
        <label>内容结构（每行一步）
          <textarea data-manual-field="structure" rows="4" placeholder="问题切入点\n说明要点\n咨询入口">${escapeHtml((topic?.structure || []).join("\n"))}</textarea>
        </label>
        <label>素材需求（每行一个）
          <textarea data-manual-field="materials" rows="2" placeholder="场地空镜\n教练出镜">${escapeHtml((topic?.materials || []).join("\n"))}</textarea>
        </label>
        <div class="modal-grid">
          <label>转化动作
            <input type="text" data-manual-field="cta" value="${escapeHtml(topic?.suggestedCta || topic?.cta || "")}" placeholder="私信咨询/预约体验" />
          </label>
          <label>风险提醒
            <input type="text" data-manual-field="risk" value="${escapeHtml(topic?.risk || "")}" placeholder="未确认的信息不要写死" />
          </label>
        </div>
        <div class="modal-actions">
          <button class="ghost" data-modal-close type="button">取消</button>
          <button class="primary" data-manual-submit type="button">${editing ? "保存修改" : "保存到选题库"}</button>
        </div>
        <div class="modal-alert hidden" data-manual-alert></div>
      </div>
    </div>
  `;
}

async function saveManualTopic() {
  const root = els.topicsModalRoot;
  if (!root) return;
  const get = (field) => root.querySelector(`[data-manual-field="${field}"]`);
  const id = get("id")?.value || "";
  const title = get("title").value.trim();
  const alertBox = root.querySelector("[data-manual-alert]");
  if (!title) {
    alertBox.classList.remove("hidden");
    alertBox.textContent = "请先填写标题。";
    return;
  }
  const platformKey = get("platform").value;
  const mapping = platformFormatMap[platformKey] || platformFormatMap.xhs;
  const payload = {
    title,
    purpose: get("purpose").value.trim(),
    structure: linesToArray(get("structure").value),
    materials: linesToArray(get("materials").value),
    cta: get("cta").value.trim(),
    risk: get("risk").value.trim(),
    platforms: mapping.platforms,
    formats: mapping.formats,
  };
  const submit = root.querySelector("[data-manual-submit]");
  const restore = setLoading(submit, "保存中");
  try {
    profile = readProfileForm();
    if (id) {
      const data = await apiRequest(
        `/api/topic-library/${encodeURIComponent(id)}`,
        { profile, task: readTask(), patch: payload },
        "PATCH",
      );
      topicLibraryData = data;
    } else {
      const data = await apiRequest("/api/topic-library", {
        profile,
        task: { ...readTask(), plan: currentPlan || undefined },
        entries: [{ ...payload, source: "manual" }],
      });
      topicLibraryData = data;
    }
    closeTopicModal();
    renderTopicLibrary(topicLibraryData);
  } catch (error) {
    alertBox.classList.remove("hidden");
    alertBox.textContent = error.message;
  } finally {
    restore();
  }
}

async function archiveTopic(id) {
  const topic = currentTopics.find((item) => item.id === id);
  if (!topic) return;
  const nextStatus = topic.status === "archived" ? "active" : "archived";
  try {
    profile = readProfileForm();
    const data = await apiRequest(
      `/api/topic-library/${encodeURIComponent(id)}`,
      { profile, task: readTask(), patch: { status: nextStatus } },
      "PATCH",
    );
    topicLibraryData = data;
    renderTopicLibrary(topicLibraryData);
  } catch (error) {
    showToast(error.message || "操作失败", "error");
  }
}

function openAdoptModal(id) {
  const topic = currentTopics.find((item) => item.id === id);
  if (!topic || !els.topicsModalRoot) return;
  const schedule = currentPlan?.publishingSchedule || currentPlan?.week || [];
  if (!schedule.length) {
    showToast("还没有本周计划，请先生成排期", "error");
    return;
  }
  const rows = sortScheduleEntries(schedule).map(({ slot, index }) => `
    <button class="adopt-slot" data-adopt-index="${index}" type="button">
      <strong>${escapeHtml(slot.day)} · ${escapeHtml(slot.platform)}</strong>
      <span>${escapeHtml(slot.topicTitle || "未命名")}</span>
    </button>
  `).join("");
  els.topicsModalRoot.innerHTML = `
    <div class="modal-overlay" data-modal-overlay>
      <div class="modal-card">
        <h3>采用到排期</h3>
        <p class="modal-hint">把「${escapeHtml(topic.title)}」放到本周某个排期槽位（替换该槽位的选题）。</p>
        <div class="adopt-slot-list" data-adopt-topic="${escapeHtml(id)}">${rows}</div>
        <div class="modal-actions">
          <button class="ghost" data-modal-close type="button">取消</button>
        </div>
      </div>
    </div>
  `;
}

function adoptTopicToSlot(topicId, slotIndex) {
  const topic = currentTopics.find((item) => item.id === topicId);
  const schedule = currentPlan?.publishingSchedule || currentPlan?.week || [];
  const slot = schedule[slotIndex];
  if (!topic || !slot) return;
  slot.topicId = topic.id;
  slot.topicTitle = topic.title;
  slot.topicAngle = topic.purpose;
  if (Array.isArray(topic.materials)) slot.materialNeed = topic.materials;
  persistPlan();
  closeTopicModal();
  loadTopicLibrary();
  showToast(`已采用到 ${slot.day} · ${slot.platform}`);
}

function slotPreferredPlatforms(platform) {
  const value = String(platform || "");
  if (/小红书|xhs/i.test(value)) return ["xhs"];
  if (/朋友圈|moments/i.test(value)) return ["moments"];
  if (/视频|抖音|video/i.test(value)) return ["douyin", "video"];
  return [];
}

function briefFromSlot(slot) {
  const theme = String(slot.directionHint || slot.theme || "").trim();
  const mustCover = [];
  if (slot.theme && slot.theme !== theme) mustCover.push(slot.theme);
  return {
    theme,
    primaryGoal: String(slot.goal || "").trim(),
    contentType: String(slot.contentType || "").trim(),
    mustCover,
    mustAvoid: Array.isArray(profile?.avoid) ? profile.avoid : [],
    preferredPlatforms: slotPreferredPlatforms(slot.platform),
    toneOverride: "",
  };
}

async function generateTopicFromSlot(slotIndex, restore) {
  const schedule = currentPlan?.publishingSchedule || currentPlan?.week || [];
  const slot = schedule[slotIndex];
  if (!slot) { restore?.(); return; }
  const eventInfo = String(currentPlan?.overview?.eventInfo || "").trim();
  const isEvent = slot.goal === "event" || (eventInfo && !/没有特定活动|日常运营/.test(eventInfo));
  await generateDirections({
    brief: briefFromSlot(slot),
    mode: isEvent ? "hybrid" : "balanced",
    sourceSlotIndex: slotIndex,
    maxDirections: 3,
    ...(restore ? { restore } : {}),
    ...(isEvent ? { eventInfo, focus: slot.directionHint || slot.theme } : {}),
  });
}

async function startContentFromPlanSlot(slotIndex) {
  const schedule = currentPlan?.publishingSchedule || currentPlan?.week || [];
  const slot = schedule[slotIndex];
  if (!slot) return;

  currentPlanSlot = slot;
  currentPlanSlotIndex = Number(slotIndex);
  materialReady = false;
  for (const key of Object.keys(generatedMaterials)) delete generatedMaterials[key];
  for (const key of Object.keys(materialAiMeta)) delete materialAiMeta[key];

  try {
    let topic = currentTopics.find((item) => item.id === slot.topicId);
    if (!topic) {
      profile = readProfileForm();
      const data = await apiRequest("/api/topic-resolve", {
        profile,
        task: {
          ...readTask(),
          topicId: slot.topicId,
          planSlot: {
            day: slot.day,
            platform: slot.platform,
            format: slot.format,
            theme: slot.theme,
            topicTitle: slot.topicTitle,
            topicAngle: slot.topicAngle,
            whyPlatform: slot.whyPlatform,
            whyTiming: slot.whyTiming,
            materialNeed: slot.materialNeed,
            reason: slot.reason,
            risk: slot.risk,
            goal: slot.goal,
            topicId: slot.topicId,
          },
        },
      });
      topic = data.topic;
    } else {
      topic = {
        ...topic,
        planSlots: [{ day: slot.day, platform: slot.platform, format: slot.format, theme: slot.theme }],
      };
    }

    if (!topic) throw new Error("topic_missing");
    currentTopic = topic;
    topicsReady = true;
    updateContext();
    setView("content");
    renderTopicDesk(topic);
  } catch (error) {
    if (error?.message === "topic_missing" || /not.?found|不存在|未找到|404/i.test(String(error?.message || ""))) {
      showToast("该选题可能已被删除或归档，请在这个排期格点「重新生成选题」", "error");
      return;
    }
    showToast(error.message || "内容生成失败", "error");
  }
}

function openContentForTopic(topic, format) {
  if (!topic) return;
  currentPlanSlot = null;
  currentPlanSlotIndex = null;
  currentTopic = topic;
  contentBrief = buildBriefFromTopic(topic);
  materialReady = false;
  for (const key of Object.keys(generatedMaterials)) delete generatedMaterials[key];
  for (const key of Object.keys(materialAiMeta)) delete materialAiMeta[key];
  updateContext();
  setView("content");
  renderTopicDesk(topic);
  if (format) generateMaterial(format);
}

function renderContentModule() {
  // 以是否有可渲染的工作台数据为准；只有 currentTopic 但无数据时不要留下旧内容。
  if (currentContentData) {
    rerenderContent();
    return;
  }
  renderContentStart();
}

function renderCampaignEmpty() {
  campaignReady = false;
  if (!els.campaignView) return;
  els.campaignView.innerHTML = `
    <div class="page-header">
      <div>
        <h2>活动策划</h2>
      </div>
    </div>
    <section class="page-section campaign-start">
      <div class="section-head">
        <div>
          <h3>从活动目标开始</h3>
        </div>
      </div>
      <label class="content-start-field">
        <span>活动目标 / 想法</span>
        <textarea id="campaignBriefInput" rows="4" placeholder="例如：策划一个开业体验活动 / 亲子网球日 / 暑期少儿体验课"></textarea>
      </label>
      <div class="content-start-actions">
        <button class="primary" data-campaign-generate type="button">生成活动方案</button>
      </div>
    </section>
    <section class="page-section campaign-start">
      <div class="section-head">
        <div>
          <h3>常用活动类型</h3>
        </div>
      </div>
      <div class="campaign-template-grid">${campaignCardGrid()}</div>
    </section>
    <div id="campaignHistory">${campaignHistoryMarkup()}</div>
  `;
}

function renderCampaignModule() {
  if (!currentCampaignPlan) {
    renderCampaignEmpty();
    return;
  }
  renderCampaignPlan(currentCampaignPlan);
}

function renderCampaignPlan(data) {
  if (!els.campaignView) return;
  if (!data) {
    renderCampaignEmpty();
    return;
  }
  currentCampaignPlan = data;
  campaignReady = true;
  const overview = data.overview || {};
  const cards = Array.isArray(data.conceptCards) ? data.conceptCards : [];
  const flow = Array.isArray(data.eventFlow) ? data.eventFlow : [];
  const offers = Array.isArray(data.offerDesign) ? data.offerDesign : [];
  const hooks = Array.isArray(data.contentHooks) ? data.contentHooks : [];
  const conversion = Array.isArray(data.conversionPath) ? data.conversionPath : [];
  const preparation = Array.isArray(data.preparation) ? data.preparation : [];
  const risks = Array.isArray(data.riskNotes) ? data.riskNotes : [];
  const nextActions = Array.isArray(data.nextActions) ? data.nextActions : [];

  els.campaignView.innerHTML = `
    <div class="page-header campaign-header">
      <div>
        <h2>${escapeHtml(overview.title || "活动策划方案")} ${renderAiMetaBadge(data.aiMeta)}</h2>
        ${overview.coreIdea ? `<p>${escapeHtml(overview.coreIdea)}</p>` : ""}
      </div>
      <div class="workbench-head-actions">
        ${renderPills([overview.typeLabel, overview.audience, overview.goal].filter(Boolean))}
        <div class="button-row">
          <button class="secondary" data-campaign-materials type="button">生成活动物料</button>
          <button class="secondary" data-campaign-to-topics type="button">生成选题方向</button>
          <button class="primary" data-campaign-to-plan type="button">排活动周计划</button>
        </div>
      </div>
    </div>

    <section class="campaign-grid">
      <article class="page-section campaign-hero">
        <div class="section-head">
          <div>
            <p class="eyebrow">活动主张</p>
            <h3>${escapeHtml(overview.title || "本次活动")}</h3>
          </div>
        </div>
        <div class="campaign-brief">
          ${overview.whyNow ? `<p><strong>为什么现在做：</strong>${escapeHtml(overview.whyNow)}</p>` : ""}
          ${overview.audience ? `<p><strong>面向人群：</strong>${escapeHtml(overview.audience)}</p>` : ""}
          ${overview.goal ? `<p><strong>目标：</strong>${escapeHtml(overview.goal)}</p>` : ""}
        </div>
      </article>

      ${cards.length ? `
        <section class="page-section">
          <div class="section-head"><div><p class="eyebrow">创意卡片</p><h3>可选活动角度</h3></div></div>
          <div class="mini-card-grid">${renderSimpleCards(cards, "campaign-concept-card")}</div>
        </section>
      ` : ""}

      ${flow.length ? `
        <section class="page-section campaign-wide">
          <div class="section-head"><div><p class="eyebrow">执行流程</p><h3>现场怎么跑</h3></div></div>
          <div class="campaign-timeline">
            ${flow.map((item, index) => `
              <article class="timeline-item">
                <span>${index + 1}</span>
                <div>
                  <strong>${escapeHtml(item.phase || item.title || item.step || "")}</strong>
                  <p>${escapeHtml([item.time, item.action, item.notes].filter(Boolean).join(" · "))}</p>
                </div>
              </article>
            `).join("")}
          </div>
        </section>
      ` : ""}

      ${offers.length ? `
        <section class="page-section">
          <div class="section-head"><div><p class="eyebrow">转化设计</p><h3>报名与权益</h3></div></div>
          <div class="mini-card-stack">${renderSimpleCards(offers)}</div>
        </section>
      ` : ""}

      ${conversion.length ? `
        <section class="page-section">
          <div class="section-head"><div><p class="eyebrow">转化路径</p><h3>从看到到报名</h3></div></div>
          <div class="mini-card-stack">${renderSimpleCards(conversion)}</div>
        </section>
      ` : ""}

      ${hooks.length ? `
        <section class="page-section campaign-wide">
          <div class="section-head"><div><p class="eyebrow">内容配套</p><h3>可延展内容钩子</h3></div></div>
          <div class="mini-card-grid">${renderSimpleCards(hooks)}</div>
        </section>
      ` : ""}

      ${preparation.length ? `
        <section class="page-section">
          <div class="section-head"><div><p class="eyebrow">准备清单</p><h3>活动前要确认</h3></div></div>
          <div class="mini-card-stack">${renderSimpleCards(preparation)}</div>
        </section>
      ` : ""}

      ${risks.length || nextActions.length ? `
        <section class="page-section">
          ${risks.length ? `<div class="campaign-note"><strong>风险边界</strong>${renderList(risks)}</div>` : ""}
          ${nextActions.length ? `<div class="campaign-note"><strong>下一步</strong>${renderList(nextActions)}</div>` : ""}
        </section>
      ` : ""}
    </section>
    <div id="campaignMaterials">${campaignMaterialsMarkup()}</div>
    <div id="campaignTopics">${campaignTopicsMarkup()}</div>
    <div id="campaignHistory">${campaignHistoryMarkup()}</div>
  `;
  if (currentRoute.module !== "campaign") {
    navigate({ module: "campaign", page: null, slotIndex: null });
    return;
  }
  setAgentResultContext("campaign-plan");
  ensureCampaignMaterials();
  ensureCampaignTopics();
}

function renderContentStart() {
  els.contentView.innerHTML = `
    <div class="page-header">
      <div>
        <h2>内容生产</h2>
      </div>
    </div>
    <section class="page-section workbench-step content-start">
      <div class="section-head">
        <div>
          <h3>从一个想法开始</h3>
        </div>
      </div>
      <label class="content-start-field">
        <span>你的想法 / 角度</span>
        <textarea id="contentIdeaInput" rows="4" placeholder="例如：介绍我们的场地环境 / 4岁能不能学网球 / 学员一个月的进步"></textarea>
      </label>
      <div class="content-start-actions">
        <button class="primary content-start" data-content-start="direct" type="button">开始生产</button>
        <button class="secondary content-start" data-content-start="shape" type="button">帮我整理成选题</button>
      </div>
    </section>
  `;
}

function readIdeaInput() {
  const input = els.contentView.querySelector("#contentIdeaInput");
  const idea = input ? input.value.trim() : "";
  if (!idea) {
    input?.focus();
    return null;
  }
  return idea;
}

function openContentForIdea(topic, brief) {
  currentPlanSlot = null;
  currentPlanSlotIndex = null;
  currentTopic = topic;
  contentBrief = brief || buildBriefFromTopic(topic);
  materialReady = false;
  for (const key of Object.keys(generatedMaterials)) delete generatedMaterials[key];
  for (const key of Object.keys(materialAiMeta)) delete materialAiMeta[key];
  updateContext();
  setView("content");
  renderTopicContent({ topic, materials: [], execution: {} });
}

async function startContentFromIdea(mode) {
  const idea = readIdeaInput();
  if (!idea) return;

  if (mode === "direct") {
    const title = idea.length > 24 ? `${idea.slice(0, 24)}…` : idea;
    const topic = {
      id: `idea-${Date.now()}`,
      title,
      formats: ["video", "xhs_image", "moments_text", "community"],
      source: "idea",
    };
    const brief = { title, topicAngle: idea, keyPoints: [], cta: "" };
    openContentForIdea(topic, brief);
    return;
  }

  const button = els.contentView.querySelector('.content-start[data-content-start="shape"]');
  const restore = button ? setLoading(button, "整理中") : () => {};
  try {
    profile = readProfileForm();
    const data = await apiRequest("/api/content/shape-idea", { profile, idea });
    if (!data || !data.topic) throw new Error("整理失败，请重试");
    try { await persistTopicsToLibrary([data.topic]); } catch { /* 入库失败不阻断内容生产 */ }
    openContentForTopic(data.topic);
  } catch (error) {
    showToast(error.message || "整理失败", "error");
  } finally {
    restore();
  }
}

function resetContentToStart() {
  currentTopic = null;
  currentPlanSlot = null;
  currentPlanSlotIndex = null;
  currentContentData = null;
  contentBrief = null;
  materialReady = false;
  for (const key of Object.keys(generatedMaterials)) delete generatedMaterials[key];
  for (const key of Object.keys(materialAiMeta)) delete materialAiMeta[key];
  renderContentStart();
}

function generateTopicContent(topicId, format) {
  const selected = currentTopics.find((topic) => topic.id === topicId);
  if (selected) openContentForTopic(selected, format);
}

async function openContentForDirection(id, format) {
  const direction = findDirection(id);
  if (!direction) return;
  // slot 来源：进工作台前先静默写回排期格，避免看板仍显示"未选选题"。
  const fromSlot = directionSession?.sourceSlotIndex !== null && directionSession?.sourceSlotIndex !== undefined;
  if (fromSlot) {
    try {
      const sourceSlotIndex = Number(directionSession.sourceSlotIndex);
      const slot = await writeDirectionToSlot(direction);
      directionSession = null;
      savedDirectionIds = new Set();
      openContentForTopic(direction, format);
      // openContentForTopic 会清空 currentPlanSlot，这里补回以保留"排期推荐/来自排期"上下文。
      if (slot) {
        currentPlanSlot = slot;
        currentPlanSlotIndex = sourceSlotIndex;
        renderTopicDesk(direction);
      }
      return;
    } catch (error) {
      showToast(error.message || "保存失败", "error");
      return;
    }
  }
  try {
    await persistTopicsToLibrary([direction], { markSaved: true });
  } catch (error) {
    showToast(error.message || "选题保存失败", "error");
    return;
  }
  openContentForTopic(direction, format);
}

async function generateMaterial(format) {
  if (!currentTopic) return;
  readContentBriefFromDom();
  const button = els.contentView.querySelector(`.material-generate[data-format="${CSS.escape(format)}"]`);
  const meta = materialTypeMeta(format);
  const restore = button ? setLoading(button, "生成中") : () => {};
  try {
    profile = readProfileForm();
    const content = await apiRequest("/api/topic-content", {
      profile,
      task: {
        ...readTask(),
        topicId: currentTopic.id,
        topic: currentTopic,
        planSlot: currentPlanSlot || undefined,
        brief: briefPayload(),
        formats: [format],
      },
    });
    const material = (content.materials || [])[0];
    if (!material) throw new Error(`这个选题暂不支持生成${meta.label}`);
    const prev = generatedMaterials[format];
    const history = prev
      ? [...(prev.history || []), { material: prev.material, aiMeta: prev.aiMeta, label: "上一版" }]
      : [];
    generatedMaterials[format] = { format, status: "draft", material, aiMeta: content.aiMeta || null, history };
    currentTopic = content.topic;
    materialReady = true;
    agentSession.activeFormat = format;
    renderTopicContent(content);
    syncLatestCardSnapshot();
    showToast(`${meta.label}已生成`);
  } catch (error) {
    const output = els.contentView.querySelector("#materialOutput");
    if (output) {
      output.innerHTML = `<article class="empty-state"><h2>生成失败</h2><p>${escapeHtml(error.message)}</p></article>`;
    }
    showToast(error.message || "内容生成失败", "error");
  } finally {
    restore();
  }
}

async function applyMaterialRefine(format, instruction) {
  const entry = generatedMaterials[format];
  if (!entry || !currentTopic) throw new Error("还没有可微调的内容");
  readContentBriefFromDom();
  profile = readProfileForm();
  const content = await apiRequest("/api/topic-content/refine", {
    profile,
    task: {
      ...readTask(),
      topicId: currentTopic.id,
      topic: currentTopic,
      planSlot: currentPlanSlot || undefined,
      brief: briefPayload(),
      format,
      currentMaterial: entry.material,
      instruction,
    },
  });
  if (content.aiMeta && content.aiMeta.source !== "ai") {
    throw new Error(content.aiMeta.error || content.aiMeta.reason || "微调未生效，请检查 AI 配置后重试。");
  }
  const material = (content.materials || [])[0];
  if (!material) throw new Error("微调失败");
  const history = [...(entry.history || []), { material: entry.material, aiMeta: entry.aiMeta, label: "微调前" }];
  generatedMaterials[format] = { ...entry, material, aiMeta: content.aiMeta || entry.aiMeta, history, status: "draft" };
  agentSession.activeFormat = format;
  rerenderContent();
  return material;
}

async function refineMaterial(format) {
  const entry = generatedMaterials[format];
  if (!entry || !currentTopic) return;
  const input = els.contentView.querySelector(`.material-refine-input[data-format="${CSS.escape(format)}"]`);
  const instruction = input ? input.value.trim() : "";
  if (!instruction) {
    input?.focus();
    return;
  }
  const button = els.contentView.querySelector(`.material-refine-apply[data-format="${CSS.escape(format)}"]`);
  const restore = button ? setLoading(button, "微调中") : () => {};
  try {
    await applyMaterialRefine(format, instruction);
    showToast(`${materialTypeMeta(format).label}已微调`);
  } catch (error) {
    showToast(error.message || "微调失败", "error");
  } finally {
    restore();
  }
}

async function agentRefineMaterial(format, instruction) {
  if (!format) { pushAgentMessage("assistant", "先生成一版内容（比如说「生成小红书」），我再帮你改。"); return; }
  if (!generatedMaterials[format]) { pushAgentMessage("assistant", `还没有生成${agentFormatLabel(format)}，先说「生成${agentFormatLabel(format)}」。`); return; }
  agentSession.busy = true;
  renderAgentMessages();
  try {
    await applyMaterialRefine(format, instruction);
    agentSession.busy = false;
    pushAgentMessage("assistant", `已按要求改写${agentFormatLabel(format)}，详细结果看主面板。`);
  } catch (error) {
    agentSession.busy = false;
    pushAgentMessage("assistant", `改写失败：${error.message}`);
  }
}

async function finalizeMaterial(format) {
  const entry = generatedMaterials[format];
  if (!entry || !currentTopic) return;
  if (!currentTopic.id) currentTopic.id = `topic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const prevStatus = entry.status;
  const nextStatus = entry.status === "final" ? "draft" : "final";
  generatedMaterials[format] = { ...entry, status: nextStatus };
  rerenderContent();
  try {
    const hasPlanSlot = currentPlanId && currentPlanSlot && Number.isInteger(Number(currentPlanSlotIndex));
    const finishedId = hasPlanSlot
      ? `${currentPlanId}-${currentPlanSlotIndex}-${currentTopic.id}-${format}`
      : `${currentTopic.id}-${format}`;
    if (nextStatus === "final") {
      const item = {
        id: finishedId,
        topicId: currentTopic.id,
        topicTitle: currentTopic.title || contentBrief?.title || "",
        format,
        contentType: currentTopic.contentType || "",
        category: currentTopic.category || "",
        material: entry.material,
        brief: briefPayload() || contentBrief || null,
        planId: currentPlanId || "",
        planTitle: currentPlan?.overview?.title || "",
        slotIndex: hasPlanSlot ? Number(currentPlanSlotIndex) : null,
        slotDay: currentPlanSlot?.day || "",
        slotPlatform: currentPlanSlot?.platform || "",
        slotFormat: currentPlanSlot?.format || "",
        slotTopicTitle: currentPlanSlot?.topicTitle || "",
      };
      const data = await apiRequest("/api/finished-content", { item });
      if (data && Array.isArray(data.items)) finishedContent = data.items;
    } else {
      const data = await apiRequest(`/api/finished-content/${encodeURIComponent(finishedId)}`, null, "DELETE");
      if (data && Array.isArray(data.items)) finishedContent = data.items;
    }
    showToast(nextStatus === "final" ? `${materialTypeMeta(format).label}已存入成品库` : `${materialTypeMeta(format).label}已取消定稿`);
  } catch (error) {
    // 同步失败时回滚乐观状态，避免界面显示与成品库不一致。
    const current = generatedMaterials[format];
    if (current) generatedMaterials[format] = { ...current, status: prevStatus };
    rerenderContent();
    showToast(`成品库同步失败：${error.message}`, "error");
  }
}

function rollbackMaterial(format, index) {
  const entry = generatedMaterials[format];
  if (!entry || !Array.isArray(entry.history)) return;
  const target = entry.history[index];
  if (!target) return;
  const history = entry.history.slice();
  history.splice(index, 1);
  history.push({ material: entry.material, aiMeta: entry.aiMeta, label: "回滚前" });
  generatedMaterials[format] = { ...entry, material: target.material, aiMeta: target.aiMeta, history, status: "draft" };
  rerenderContent();
}

async function copyVideoPart(format, part, button) {
  const entry = generatedMaterials[format];
  const material = entry?.material;
  if (!material || material.type !== "video") return;
  await copyTextWithFeedback(videoPartText(material, part), button);
}

async function copyMaterial(format) {
  const entry = generatedMaterials[format];
  if (!entry) return;
  const text = materialToText(entry.material);
  const button = els.contentView.querySelector(`.material-copy[data-format="${CSS.escape(format)}"]`);
  try {
    await navigator.clipboard.writeText(text);
    if (button) {
      const original = button.textContent;
      button.textContent = "已复制";
      setTimeout(() => { button.textContent = original; }, 1500);
    }
  } catch {
    showToast("复制失败，请手动选择文本复制", "error");
  }
}

async function generateCommunityPlan(groupType) {
  if (groupType) currentGroupType = groupType;
  setView("channels");
  const restore = setLoading(els.communityBtn, "生成中");
  communityReady = false;
  updateContext();
  syncGroupTabs();
  els.channelsResult.innerHTML = `<article class="empty-state"><h2>正在生成${escapeHtml(GROUP_TYPE_LABELS[currentGroupType] || "社群")}运营方案</h2></article>`;
  try {
    profile = readProfileForm();
    const data = await apiRequest("/api/community-plan", { profile, task: { ...readTask(), groupType: currentGroupType, plan: currentPlan } });
    renderCommunityPlan(data);
    try {
      const saved = await apiRequest("/api/community-plans", {
        plan: data,
        groupType: currentGroupType,
        planId: currentPlanId || "",
        planTitle: currentPlan?.overview?.title || "",
      });
      if (Array.isArray(saved?.plans)) communityIndex = saved.plans;
      renderCommunityHistory();
    } catch (saveError) {
      console.error("社群方案保存失败", saveError);
      showToast("社群方案已生成，但未能保存到服务器", "error");
    }
    showToast("社群方案已生成");
  } catch (error) {
    els.channelsResult.innerHTML = `<article class="empty-state"><h2>生成失败</h2><p>${escapeHtml(error.message)}</p></article>`;
    showToast(error.message || "社群方案生成失败", "error");
  } finally {
    restore();
    syncGroupTabs();
  }
}

els.saveProfileBtn.addEventListener("click", async () => {
  const restore = setLoading(els.saveProfileBtn, "保存中");
  els.profileStatus.textContent = "保存中";
  els.profileStatus.classList.remove("status-error", "status-success");
  try {
    profile = readProfileForm();
    await apiRequest("/api/profile", { profile });
    updateContext();
    els.profileStatus.textContent = "已保存";
    els.profileStatus.classList.add("status-success");
    navigate(profileReturnRoute || { module: "plan", page: "list", slotIndex: null }, { replace: true });
    showToast("球场档案已保存");
  } catch (error) {
    els.profileStatus.textContent = "保存失败";
    els.profileStatus.classList.add("status-error");
    showToast(error.message || "球场档案保存失败", "error");
  } finally {
    restore();
  }
});

els.profileShortcutBtn.addEventListener("click", () => {
  if (!["profile", "ai"].includes(currentRoute.module)) {
    profileReturnRoute = { ...currentRoute };
  }
  setView("profile");
});
els.aiShortcutBtn.addEventListener("click", () => setView("ai"));

els.planBtn.addEventListener("click", () => generatePlan());

els.planView.addEventListener("click", (event) => {
  if (handlePlanNavClick(event)) return;
  const deleteBtn = event.target.closest("[data-plan-delete]");
  if (deleteBtn) {
    event.stopPropagation();
    deletePlanEntry(deleteBtn.dataset.planDelete);
    return;
  }
  const card = event.target.closest("[data-plan-open]");
  if (card) {
    openPlan(card.dataset.planOpen);
    return;
  }
  const contentBtn = event.target.closest("[data-slot-content]");
  if (contentBtn) {
    event.stopPropagation();
    startContentFromPlanSlot(Number(contentBtn.dataset.slotContent));
    return;
  }
  const viewCampaignBtn = event.target.closest("[data-plan-view-campaign]");
  if (viewCampaignBtn) {
    openCampaignHistoryEntry(viewCampaignBtn.dataset.planViewCampaign);
    navigate({ module: "campaign", page: null, slotIndex: null });
    return;
  }
  const planCampaignBtn = event.target.closest("[data-plan-plan-campaign]");
  if (planCampaignBtn) {
    planToCampaign();
    return;
  }
  const button = event.target.closest(".plan-slot-action");
  if (!button) return;
  const restore = setLoading(button, "生成中");
  generateTopicFromSlot(Number(button.dataset.slotIndex), restore);
});

els.navItems.forEach((item) => {
  item.addEventListener("click", () => {
    const view = item.dataset.view;
    if (view === "plan") {
      navigate({ module: "plan", page: defaultPlanPage(), slotIndex: null });
      return;
    }
    navigate({ module: view, page: null, slotIndex: null });
  });
});

els.topicsView.addEventListener("click", (event) => {
  if (handleTopicsNavClick(event)) return;

  const actionBtn = event.target.closest("[data-topics-action]");
  if (actionBtn) {
    const action = actionBtn.dataset.topicsAction;
    if (action === "regenerate") {
      const slotIndex = directionSession?.sourceSlotIndex;
      if (slotIndex !== null && slotIndex !== undefined) generateTopicFromSlot(Number(slotIndex));
      else generateDirections();
    }
    else if (action === "back-plan") { directionSession = null; navigate({ module: "plan", page: "board" }); }
    else if (action === "save-all") saveAllDirections();
    else if (action === "clear") clearDirectionSession();
    return;
  }

  const modalClose = event.target.closest("[data-modal-close]");
  if (modalClose || event.target.matches("[data-modal-overlay]")) {
    closeTopicModal();
    return;
  }

  const refSubmit = event.target.closest("[data-ref-submit]");
  if (refSubmit) { parseReference(); return; }
  const campaignSubmit = event.target.closest("[data-campaign-submit]");
  if (campaignSubmit) { submitCampaignTopics(); return; }
  const manualSubmit = event.target.closest("[data-manual-submit]");
  if (manualSubmit) { saveManualTopic(); return; }
  const adoptSlot = event.target.closest("[data-adopt-index]");
  if (adoptSlot) {
    const topicId = adoptSlot.closest("[data-adopt-topic]")?.dataset.adoptTopic;
    adoptTopicToSlot(topicId, Number(adoptSlot.dataset.adoptIndex));
    return;
  }

  const catCard = event.target.closest("[data-topic-cat]");
  if (catCard) { topicCategory = catCard.dataset.topicCat; renderTopicLibrary(topicLibraryData); return; }
  const catBack = event.target.closest("[data-topic-cat-back]");
  if (catBack) { topicCategory = null; renderTopicLibrary(topicLibraryData); return; }

  const libQuick = event.target.closest("[data-lib-quick]");
  if (libQuick) { generateTopicContent(libQuick.dataset.libQuick, libQuick.dataset.format); return; }

  const generateBtn = event.target.closest(".topic-generate");
  if (generateBtn) { generateTopicContent(generateBtn.dataset.topicId); return; }

  const adoptBtn = event.target.closest("[data-topic-adopt]");
  if (adoptBtn) { openAdoptModal(adoptBtn.dataset.topicAdopt); return; }
  const editBtn = event.target.closest("[data-topic-edit]");
  if (editBtn) {
    const topic = currentTopics.find((item) => item.id === editBtn.dataset.topicEdit);
    if (topic) openManualModal(topic);
    return;
  }
  const archiveBtn = event.target.closest("[data-topic-archive]");
  if (archiveBtn) { archiveTopic(archiveBtn.dataset.topicArchive); return; }

  const dirSave = event.target.closest(".direction-save");
  if (dirSave) { saveDirection(dirSave.dataset.directionId); return; }
  const dirContent = event.target.closest(".direction-content");
  if (dirContent) { openContentForDirection(dirContent.dataset.directionId); return; }
  const dirAdoptSlot = event.target.closest(".direction-adopt-slot");
  if (dirAdoptSlot) { adoptDirectionToSlot(dirAdoptSlot.dataset.directionId); return; }
});

els.topicsView.addEventListener("change", (event) => {
  const fileInput = event.target.closest('[data-ref-field="image"]');
  if (!fileInput || !fileInput.files?.[0]) return;
  const preview = els.topicsModalRoot?.querySelector("[data-ref-preview]");
  if (!preview) return;
  const reader = new FileReader();
  reader.onload = () => { preview.innerHTML = `<img src="${reader.result}" alt="参考截图预览" />`; };
  reader.readAsDataURL(fileInput.files[0]);
});

els.contentView.addEventListener("click", (event) => {
  const generate = event.target.closest(".material-generate");
  if (generate) { generateMaterial(generate.dataset.format); return; }
  const refine = event.target.closest(".material-refine-apply");
  if (refine) { refineMaterial(refine.dataset.format); return; }
  const finalize = event.target.closest(".material-finalize");
  if (finalize) { finalizeMaterial(finalize.dataset.format); return; }
  const copy = event.target.closest(".material-copy");
  if (copy) { copyMaterial(copy.dataset.format); return; }
  const rollback = event.target.closest(".material-rollback");
  if (rollback) { rollbackMaterial(rollback.dataset.format, Number(rollback.dataset.version)); return; }
  const copyScript = event.target.closest(".video-copy-script");
  if (copyScript) { copyVideoPart(copyScript.dataset.format, "narration", copyScript); return; }
  const copySubtitle = event.target.closest(".video-copy-subtitle");
  if (copySubtitle) { copyVideoPart(copySubtitle.dataset.format, "subtitle", copySubtitle); return; }
  const contentStart = event.target.closest(".content-start");
  if (contentStart) { startContentFromIdea(contentStart.dataset.contentStart); return; }
  const contentReset = event.target.closest(".content-reset");
  if (contentReset) { resetContentToStart(); return; }
});

els.contentView.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  const input = event.target.closest(".material-refine-input");
  if (!input) return;
  event.preventDefault();
  refineMaterial(input.dataset.format);
});

els.campaignView?.addEventListener("click", (event) => {
  const histOpen = event.target.closest("[data-campaign-open]");
  if (histOpen) { openCampaignHistoryEntry(histOpen.dataset.campaignOpen); return; }
  const histDel = event.target.closest("[data-campaign-delete]");
  if (histDel) { deleteCampaignPlanEntry(histDel.dataset.campaignDelete); return; }
  const topicContent = event.target.closest("[data-campaign-topic-content]");
  if (topicContent) { generateTopicContent(topicContent.dataset.campaignTopicContent); return; }
  const topicOpen = event.target.closest("[data-campaign-topic]");
  if (topicOpen) { generateTopicContent(topicOpen.dataset.campaignTopic); return; }
  const template = event.target.closest("[data-campaign-template]");
  if (template) {
    generateCampaignFromPanel(template.dataset.campaignTemplate, template);
    return;
  }
  const generate = event.target.closest("[data-campaign-generate]");
  if (generate) {
    const input = els.campaignView.querySelector("#campaignBriefInput");
    generateCampaignFromPanel(input?.value || "", generate);
    return;
  }
  if (event.target.closest("[data-campaign-to-topics]")) {
    campaignToTopics();
    return;
  }
  if (event.target.closest("[data-campaign-to-plan]")) {
    campaignToPlan();
    return;
  }
  if (event.target.closest("[data-campaign-materials]")) {
    openCampaignMaterialsModal();
    return;
  }
  const matToggle = event.target.closest("[data-campaign-material-toggle]");
  if (matToggle) {
    toggleCampaignMaterialInline(matToggle.dataset.campaignMaterialToggle, matToggle);
    return;
  }
  const matCopy = event.target.closest("[data-campaign-material-copy]");
  if (matCopy) {
    copyCampaignMaterialInline(matCopy.dataset.campaignMaterialCopy, matCopy);
    return;
  }
  const matRegen = event.target.closest("[data-campaign-material-regen]");
  if (matRegen) {
    regenerateCampaignMaterialItem(matRegen.dataset.campaignMaterialRegen, matRegen);
    return;
  }
});

els.libraryView.addEventListener("click", (event) => {
  const mode = event.target.closest("[data-library-mode]");
  if (mode) { libraryViewMode = mode.dataset.libraryMode; renderFinishedLibrary(); return; }
  const planOpen = event.target.closest("[data-index-plan-open]");
  if (planOpen) { openPlan(planOpen.dataset.indexPlanOpen); return; }
  const slotContent = event.target.closest("[data-index-slot]");
  if (slotContent) { openContentFromIndexSlot(slotContent.dataset.indexPlan, Number(slotContent.dataset.indexSlot)); return; }
  const filter = event.target.closest("[data-library-filter]");
  if (filter) { libraryFormatFilter = filter.dataset.libraryFilter; renderFinishedLibrary(); return; }
  const expand = event.target.closest(".library-expand");
  if (expand) { toggleFinishedDetail(expand.dataset.libraryId); return; }
  const copy = event.target.closest(".library-copy");
  if (copy) { copyFinishedItem(copy.dataset.libraryId, copy); return; }
  const reopen = event.target.closest(".library-reopen");
  if (reopen) {
    const targetId = reopen.dataset.libraryId;
    const target = finishedContent.find((it) => it.id === targetId);
    if (target && typeof target.format === "string" && target.format.startsWith("campaign_")) {
      showToast("活动物料无对应选题，请用「展开全文」查看或回活动页重新生成", "error");
      return;
    }
    reopenFinishedItem(targetId);
    return;
  }
  const del = event.target.closest(".library-delete");
  if (del) { deleteFinishedItem(del.dataset.libraryId); return; }
  const vScript = event.target.closest(".video-copy-script");
  if (vScript) { copyFinishedVideoPart(vScript.closest(".library-card")?.dataset.libraryId, "narration", vScript); return; }
  const vSub = event.target.closest(".video-copy-subtitle");
  if (vSub) { copyFinishedVideoPart(vSub.closest(".library-card")?.dataset.libraryId, "subtitle", vSub); return; }
});

els.topicsGenerateBtn?.addEventListener("click", () => generateDirections());
els.topicsReferenceBtn?.addEventListener("click", openReferenceModal);
els.topicsCampaignBtn?.addEventListener("click", openCampaignModal);
els.topicsManualBtn?.addEventListener("click", () => openManualModal(null));
els.communityBtn.addEventListener("click", () => generateCommunityPlan());
els.groupTypeTabs?.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-group]");
  if (!btn) return;
  const group = btn.dataset.group;
  if (group === currentGroupType) return;
  selectCommunityGroup(group);
});
els.communityHistory?.addEventListener("click", (event) => {
  const openBtn = event.target.closest("[data-community-open]");
  if (openBtn) { openCommunityHistoryEntry(openBtn.dataset.communityOpen); return; }
  const delBtn = event.target.closest("[data-community-delete]");
  if (delBtn) { deleteCommunityPlanEntry(delBtn.dataset.communityDelete); return; }
});
els.saveAiBtn.addEventListener("click", saveAiSettings);
els.fields.stage?.addEventListener("change", () => updatePlanStageContext());

els.topicSearchInput?.addEventListener("input", (event) => {
  topicFilters.search = event.target.value;
  applyTopicFilters();
});
els.topicShowArchived?.addEventListener("change", (event) => {
  topicFilters.showArchived = event.target.checked;
  applyTopicFilters();
});

els.aiView.addEventListener("click", (event) => {
  const button = event.target.closest(".ai-test");
  if (!button) return;
  testAiProvider(button.dataset.provider);
});

els.agentFab?.addEventListener("click", toggleAgent);
els.agentCloseBtn?.addEventListener("click", closeAgent);
els.agentExpandBtn?.addEventListener("click", toggleAgentExpanded);
document.querySelector("#agentForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  sendAgentMessage();
});
els.agentInput?.addEventListener("input", autoGrowAgentInput);
els.agentInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendAgentMessage();
  }
});
els.agentPanel?.addEventListener("click", (event) => {
  const quick = event.target.closest("[data-agent-quick]");
  if (quick) { handleAgentQuickAction(quick.dataset.agentQuick); return; }
  const chip = event.target.closest("[data-agent-chip]");
  if (chip) { handleAgentChip(chip.dataset.agentChip, chip.dataset.agentChipKind); return; }
  const action = event.target.closest("[data-agent-action]");
  if (action) { handleAgentResultAction(action.dataset.agentAction, action); return; }
});

window.addEventListener("hashchange", () => {
  currentRoute = normalizeRoute(parseRouteHash());
  renderRoute();
});

async function bootstrap() {
  loadAiSettings();
  await Promise.all([loadProfile(), restoreWeeklyPlan()]);
  restoreCommunityPlans();
  restoreCampaignPlans();
  loadFinishedContent();
  updateContext();
  syncGroupTabs();
  navigate(parseRouteHash(location.hash), { replace: true });
}

bootstrap();
