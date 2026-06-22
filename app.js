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
  planPageSetup: document.querySelector("#planPageSetup"),
  planPageBoard: document.querySelector("#planPageBoard"),
  planBoardContent: document.querySelector("#planBoardContent"),
  planSetupAlert: document.querySelector("#planSetupAlert"),
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
  topicPillarFilter: document.querySelector("#topicPillarFilter"),
  topicPlatformFilter: document.querySelector("#topicPlatformFilter"),
  topicSourceFilter: document.querySelector("#topicSourceFilter"),
  topicStatusFilter: document.querySelector("#topicStatusFilter"),
  communityBtn: document.querySelector("#communityBtn"),
  planView: document.querySelector("#planView"),
  topicsView: document.querySelector("#topicsView"),
  topicsResult: document.querySelector("#topicsResult"),
  contentView: document.querySelector("#contentView"),
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
  agentMessages: document.querySelector("#agentMessages"),
  agentResultBlock: document.querySelector("#agentResultBlock"),
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
    mode: document.querySelector("#modeInput"),
    goal: document.querySelector("#goalInput"),
    audience: document.querySelector("#audienceInput"),
    videoCadence: document.querySelector("#videoCadenceInput"),
    xhsCadence: document.querySelector("#xhsCadenceInput"),
    momentsCadence: document.querySelector("#momentsCadenceInput"),
    focus: document.querySelector("#focusInput"),
    eventInfo: document.querySelector("#eventInput"),
  },
};

let profile = null;
let currentTopics = [];
let topicLibraryData = null;
let directionSession = null;
let savedDirectionIds = new Set();
let topicFilters = { search: "", pillar: "", platform: "", source: "", status: "active" };
let topicCategory = null;
let currentPlan = null;
let currentTopic = null;
let currentPlanSlot = null;
let currentContentData = null;
let contentBrief = null;
let materialReady = false;
let finishedContent = [];
let libraryFormatFilter = "all";
let communityReady = false;
let topicsReady = false;
let activeView = "plan";
let agentSession = { open: false, messages: [], priorBrief: null, lastMode: null, busy: false, pendingResult: false, activeResult: null };
let currentRoute = { module: "plan", page: "setup", slotIndex: null };
let apiBase = "";
const generatedMaterials = {};
const materialAiMeta = {};
const providerIds = ["openai", "deepseek", "gemini", "doubao"];

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
  const target = `${apiBase}${url}`;
  const httpMethod = method || (payload ? "POST" : "GET");
  const options = httpMethod === "GET"
    ? {}
    : {
        method: httpMethod,
        headers: { "content-type": "application/json" },
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
    if (response.status === 405 && payload) {
      throw new Error("当前服务版本过旧，缺少 API 接口。请停止旧进程后重新运行 npm run dev，再刷新页面。");
    }
    throw new Error(data.error || `请求失败 (${response.status})`);
  }
  return data;
}

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

function materialToText(m) {
  if (!m) return "";
  if (m.type === "video") {
    const hook = m.hook && typeof m.hook === "object" ? m.hook : { narration: m.hook || "" };
    const script = Array.isArray(m.script) ? m.script : [];
    const fullNarration = [hook.narration, ...script.map((s) => s.narration)].filter(Boolean).join("\n");
    const fullSubtitle = [hook.onScreenText, ...script.map((s) => s.onScreenText)].filter(Boolean).join("\n");
    return [
      m.title,
      `时长：${m.durationHint || ""}　封面：${m.coverText || ""}`,
      `【前3秒钩子】\n口播：${hook.narration || ""}\n画面：${hook.visual || ""}\n字幕：${hook.onScreenText || ""}`,
      "【口播逐字稿（整段）】",
      fullNarration,
      "【字幕（整段）】",
      fullSubtitle,
      "【分镜表】",
      ...script.map((s) => `[${s.time || ""}] ${s.intent || ""}\n画面：${s.visual || ""}\n口播：${s.narration || ""}\n字幕：${s.onScreenText || ""}`),
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
  return JSON.stringify(m, null, 2);
}

function updateContext() {
  if (els.venueNameLabel && profile) {
    els.venueNameLabel.textContent = profile.shortName || profile.name || "未命名球场";
  }
}

function defaultPlanPage() {
  return currentPlan ? "board" : "setup";
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
    const allowed = ["setup", "board"];
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
      next.page = currentPlan ? "board" : "setup";
    }
    if (next.page !== "setup" && !currentPlan) next.page = "setup";
  }
  if (next.module === "topics") {
    if (next.page === "generate" && !directionSession) next.page = null;
  }
  return next;
}

function renderModuleVisibility(module) {
  activeView = module;
  if (module !== "topics" && els.topicsModalRoot) els.topicsModalRoot.innerHTML = "";
  for (const item of els.navItems) item.classList.toggle("active", item.dataset.view === module);
  els.planView.classList.toggle("hidden", module !== "plan");
  els.topicsView.classList.toggle("hidden", module !== "topics");
  els.contentView.classList.toggle("hidden", module !== "content");
  els.libraryView.classList.toggle("hidden", module !== "library");
  els.channelsView.classList.toggle("hidden", module !== "channels");
  els.profileView.classList.toggle("hidden", module !== "profile");
  els.aiView.classList.toggle("hidden", module !== "ai");
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
  const crumbs = [{ label: "一周计划", nav: currentPlan ? "board" : "setup" }];

  if (page === "setup") {
    crumbs.push({ label: "本周设定", current: true });
    els.planBreadcrumb.innerHTML = renderBreadcrumb(crumbs);
    els.planActions.innerHTML = currentPlan
      ? `<button class="secondary" data-plan-nav="board" type="button">返回看板</button>`
      : "";
    return;
  }

  crumbs.push({ label: "排期看板", current: true });
  els.planBreadcrumb.innerHTML = renderBreadcrumb(crumbs);
  els.planActions.innerHTML = `
    <button class="secondary" data-plan-nav="setup" type="button">编辑设定</button>
  `;
}

function renderPlanSubpage(page) {
  els.planPageSetup?.classList.toggle("hidden", page !== "setup");
  els.planPageBoard?.classList.toggle("hidden", page !== "board");
  if (page === "board" && currentPlan) renderPlanBoard(currentPlan);
}

function handlePlanNavClick(event) {
  const nav = event.target.closest("[data-plan-nav]");
  if (!nav) return false;
  const target = nav.dataset.planNav;
  if (target === "setup") navigate({ module: "plan", page: "setup", slotIndex: null });
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
  if (page === "generate") {
    els.topicsBreadcrumb.innerHTML = renderTopicsBreadcrumb([
      { label: "选题库", nav: "library" },
      { label: "生成结果", current: true },
    ]);
    const total = directionSession?.directions?.length || 0;
    const unsaved = (directionSession?.directions || []).filter((d) => !savedDirectionIds.has(d.id)).length;
    els.topicsActions.innerHTML = `
      <button class="secondary" data-topics-nav="library" type="button">返回选题库</button>
      <button class="secondary" data-topics-action="regenerate" type="button">重新生成</button>
      ${unsaved ? `<button class="primary" data-topics-action="save-all" type="button">全选保存到库（${unsaved}）</button>` : ""}
      ${total ? `<button class="ghost" data-topics-action="clear" type="button">清空本次</button>` : ""}
    `;
    return;
  }
  els.topicsBreadcrumb.innerHTML = renderTopicsBreadcrumb([{ label: "选题库", current: true }]);
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
    mode: els.task.mode.value,
    goal: els.task.goal.value,
    audience: els.task.audience.value || undefined,
    cadence: {
      video: Number(els.task.videoCadence.value || 0),
      xhsImage: Number(els.task.xhsCadence.value || 0),
      moments: Number(els.task.momentsCadence.value || 0),
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
    console.error(error);
  }
}

async function saveAiSettings() {
  const restore = setLoading(els.saveAiBtn, "保存中");
  els.aiStatus.textContent = "保存中";
  try {
    const data = await apiRequest("/api/ai-settings", { settings: readAiSettingsForm() });
    fillAiSettings(data.settings);
    els.aiStatus.textContent = "已保存";
  } catch (error) {
    els.aiStatus.textContent = error.message;
  } finally {
    restore();
  }
}

async function testAiProvider(provider) {
  const button = els.aiView.querySelector(`.ai-test[data-provider="${provider}"]`);
  const status = providerField(provider, "status");
  const restore = setLoading(button, "测试中");
  status.textContent = "测试中...";
  try {
    const config = readAiSettingsForm().providers[provider];
    const data = await apiRequest("/api/ai-test", { provider, config });
    status.textContent = data.message || "连接成功";
  } catch (error) {
    status.textContent = error.message;
  } finally {
    restore();
  }
}

function renderPlanAiMeta(plan) {
  const source = plan.aiMeta?.source;
  if (source === "ai") {
    const steps = Array.isArray(plan.aiMeta.steps) ? plan.aiMeta.steps.join(" → ") : "AI";
    return `<small class="ai-meta">策略与排期已由 ${escapeHtml(plan.aiMeta.provider || "AI")} 生成（${escapeHtml(steps)}）</small>`;
  }
  if (source === "fallback") {
    return `<small class="ai-meta">AI 策略/排期失败，已使用本地规则兜底：${escapeHtml(plan.aiMeta.error || "AI 不可用")}</small>`;
  }
  if (source === "local") {
    const reason = plan.aiMeta?.reason || "未配置可用的 AI";
    return `<small class="ai-meta">${escapeHtml(reason)}，当前使用本地规则生成。请在「AI 连接」里确认默认服务商和 API Key 已保存。</small>`;
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
  const strategy = plan.strategy;
  const summary = strategy?.strategySummary || plan.overview?.strategySummary || "";
  const platformMix = strategy?.platformMix || plan.platformRhythm?.map((item) => ({
    platform: item.platform,
    weight: item.cadence || item.weight,
    role: item.role,
    reason: item.content,
  })) || [];

  return `
    <section class="board-strategy">
      <div class="board-section-head">
        <h3>本周策略</h3>
        ${summary ? `<p>${escapeHtml(summary)}</p>` : ""}
      </div>

      ${platformMix.length ? `
        <div class="strategy-platform-grid">
          ${platformMix.map((item) => `
            <article class="strategy-platform-card ${platformToneClass(item.platform)}">
              <div class="strategy-platform-card-top">
                <strong>${escapeHtml(item.platform)}</strong>
                <span>${escapeHtml(item.weight || "")}</span>
              </div>
              <p>${escapeHtml(item.role || "")}</p>
              ${item.reason ? `<small>${escapeHtml(item.reason)}</small>` : ""}
            </article>
          `).join("")}
        </div>
      ` : ""}

      ${strategy?.privateDomainPolicy ? `
        <div class="strategy-private-note">
          <strong>私域</strong>
          <span>朋友圈：${escapeHtml(strategy.privateDomainPolicy.moments || "")}</span>
          <span>社群：${escapeHtml(strategy.privateDomainPolicy.community || "")}</span>
        </div>
      ` : ""}

      ${Array.isArray(plan.pillars) && plan.pillars.length ? `
        <div class="board-section-head board-section-head-sub">
          <h4>内容支柱</h4>
          ${plan.overview?.rhythm ? `<p>${escapeHtml(plan.overview.rhythm)}</p>` : ""}
        </div>
        <div class="strategy-pillar-grid">
          ${plan.pillars.map((pillar) => `
            <article class="strategy-pillar-card">
              <div class="strategy-pillar-card-top">
                <strong>${escapeHtml(pillar.label)}</strong>
                <span>${escapeHtml(pillar.ratio)}${pillar.slotCount ? ` · ${pillar.slotCount} 条` : ""}</span>
              </div>
              <p>${escapeHtml(pillar.role)}</p>
            </article>
          `).join("")}
        </div>
      ` : ""}

      ${(Array.isArray(plan.preparationTasks) && plan.preparationTasks.length)
        || (Array.isArray(plan.reminders) && plan.reminders.length) ? `
        <div class="strategy-notes-grid">
          ${Array.isArray(plan.preparationTasks) && plan.preparationTasks.length ? `
            <section class="strategy-note-card">
              <h4>素材准备</h4>
              ${renderList(plan.preparationTasks)}
            </section>
          ` : ""}
          ${Array.isArray(plan.reminders) && plan.reminders.length ? `
            <section class="strategy-note-card">
              <h4>执行提醒</h4>
              ${renderList(plan.reminders)}
            </section>
          ` : ""}
        </div>
      ` : ""}
    </section>
  `;
}

function renderScheduleRow(slot, index) {
  return `
    <article class="schedule-row ${platformToneClass(slot.platform)}">
      <div class="schedule-row-meta">
        <strong class="schedule-row-day">${escapeHtml(slot.day)}</strong>
        <span class="platform-badge">${escapeHtml(slot.platform)}</span>
        ${slot.format ? `<span class="format-tag">${escapeHtml(slot.format)}</span>` : ""}
        ${slot.categoryLabel ? `<span class="mini-tag mini-tag-cat">${escapeHtml(slot.categoryLabel)}</span>` : ""}
        ${slot.pillarLabel ? `<span class="mini-tag">${escapeHtml(slot.pillarLabel)}</span>` : ""}
      </div>
      <div class="schedule-row-body">
        <h3 class="schedule-row-title">${escapeHtml(slot.topicTitle)}</h3>
        ${slot.topicAngle ? `<p class="schedule-row-angle">${escapeHtml(slot.topicAngle)}</p>` : ""}
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
        <button class="primary plan-slot-action" data-slot-index="${index}" type="button">生成内容</button>
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
      </div>
    </div>

    ${renderBoardStrategySection(plan)}

    <section class="board-schedule">
      <div class="board-section-head">
        <h3>本周排期</h3>
        <p>每条可直接生成内容；需要时可点「展开详情」查看补充说明。</p>
      </div>
      ${renderWeekStrip(schedule)}
      <div class="schedule-row-list">
        ${entries.map(({ slot, index }) => renderScheduleRow(slot, index)).join("")}
      </div>
    </section>
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
  if (source === "ai") {
    return `<small class="ai-meta">已由 ${escapeHtml(data.aiMeta.provider || "AI")} 结合球场档案${data.summary?.planLinkedCount ? "和本周计划方向" : ""} 生成选题方向</small>`;
  }
  if (source === "fallback") {
    return `<small class="ai-meta">AI 生成失败，已使用本地规则兜底：${escapeHtml(data.aiMeta.error || "AI 不可用")}</small>`;
  }
  if (source === "local") {
    const reason = data.aiMeta?.reason || "未配置可用的 AI";
    return `<small class="ai-meta">${escapeHtml(reason)}，当前使用本地规则生成选题方向。</small>`;
  }
  return "";
}

function filterTopicLibrary(topics = []) {
  const search = topicFilters.search.trim().toLowerCase();
  const status = topicFilters.status || "active";
  return topics.filter((topic) => {
    const topicStatus = topic.status || "active";
    if (status === "active" && topicStatus === "archived") return false;
    if (status === "archived" && topicStatus !== "archived") return false;
    if (status === "unproduced" && (topicStatus === "archived" || (topic.produceCount || 0) > 0)) return false;
    if (status === "produced" && (topic.produceCount || 0) === 0) return false;
    if (topicFilters.source && topic.source !== topicFilters.source) return false;
    if (topicFilters.pillar && topic.pillar !== topicFilters.pillar) return false;
    if (topicFilters.platform && !(topic.platforms || []).includes(topicFilters.platform)) return false;
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

function populateTopicPillarFilter(pillars = []) {
  if (els.topicPillarFilter) {
    els.topicPillarFilter.innerHTML = [
      `<option value="">全部支柱</option>`,
      ...pillars.map((pillar) => `<option value="${escapeHtml(pillar.id)}">${escapeHtml(pillar.label)}</option>`),
    ].join("");
    els.topicPillarFilter.value = topicFilters.pillar;
  }
  if (els.topicPlatformFilter) els.topicPlatformFilter.value = topicFilters.platform;
  if (els.topicSourceFilter) els.topicSourceFilter.value = topicFilters.source;
  if (els.topicStatusFilter) els.topicStatusFilter.value = topicFilters.status;
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
          <span>${escapeHtml(topic.sourceLabel || topic.source || "选题")}</span>
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
        <h4>素材需求</h4>
        <p>${escapeHtml((topic.materials || []).join("、"))}</p>
        <small class="topic-risk">${escapeHtml(topic.risk)}</small>
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
      <p>${escapeHtml(data.summary?.suggestion || "按题材浏览选题库，点进某类查看具体选题。")}</p>
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
        : `<article class="empty-state compact"><h3>这个分类还没有选题</h3><p>去「生成选题方向」或「从参考开始」补充，满意的保存入库即可。</p></article>`}
    </div>
  `;
}

function renderTopicLibrary(data) {
  topicLibraryData = data;
  currentTopics = data.topics || [];
  topicsReady = currentTopics.length > 0;
  updateContext();
  populateTopicPillarFilter(data.pillars || []);

  const inDetail = Boolean(topicCategory);
  // 工具栏（搜索/状态等）仅在分类详情态显示；概览态隐藏。
  els.topicLibraryToolbar?.classList.toggle("hidden", !currentTopics.length || !inDetail);

  if (!currentTopics.length) {
    topicCategory = null;
    els.topicsResult.innerHTML = `
      <article class="empty-state">
        <p class="eyebrow">Topic Library</p>
        <h2>暂无选题</h2>
        <p>点击「生成选题方向」会根据球场档案和运营输入产出一批角度，挑选后保存入库；也可以「从参考开始」或「手动添加」。</p>
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
  return `
    <article class="content-card">
      <p class="eyebrow">Video Script</p>
      <h2>${escapeHtml(material.title)}</h2>
      <div class="video-meta-pills">
        ${renderPills([
          material.durationHint ? `时长 ${escapeHtml(material.durationHint)}` : "",
          material.coverText ? `封面 ${escapeHtml(material.coverText)}` : "",
        ].filter(Boolean))}
      </div>
      <h4>前 3 秒钩子</h4>
      <div class="video-hook">
        <p><span class="video-line-tag">口播</span>${escapeHtml(hook.narration || "")}</p>
        <p><span class="video-line-tag">画面</span>${escapeHtml(hook.visual || "")}</p>
        <p><span class="video-line-tag">字幕</span>${escapeHtml(hook.onScreenText || "")}</p>
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
          <p><span class="video-line-tag">字幕</span>${escapeHtml(shot.onScreenText || "")}</p>
        </div>
      `).join("")}
      <h4>口播逐字稿（可整段复制）</h4>
      <pre>${escapeHtml(fullNarration)}</pre>
      <h4>字幕（可整段复制）</h4>
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
  return "";
}

function renderMaterialAiMeta(meta) {
  if (!meta) return "";
  if (meta.source === "ai") {
    return `<small class="ai-meta">本物料已由 ${escapeHtml(meta.provider || "AI")} 生成</small>`;
  }
  if (meta.source === "fallback") {
    return `<small class="ai-meta">AI 生成失败，已使用本地模板兜底：${escapeHtml(meta.error || "AI 不可用")}</small>`;
  }
  if (meta.source === "local") {
    const reason = meta.reason || "未配置可用的 AI";
    return `<small class="ai-meta">${escapeHtml(reason)}，当前使用本地模板生成。</small>`;
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
  const availableTypes = materialTypes.filter((item) => (
    topicFormats.includes(item.type) || (item.type === "moments_text" && topicFormats.includes("moments_image"))
  ));
  const recommendedFormat = inferFormatFromPlanSlot(currentPlanSlot);
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
          <p class="eyebrow">第 1 步 · Content Brief</p>
          <h3>先确认这条内容要解决什么</h3>
        </div>
        <p>这份 brief 是所有内容类型的共同输入，修改后再生成会一起生效。</p>
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
          <span>转化动作 / CTA</span>
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
        <p>每次只生成一种；已配置 AI 时会优先用 AI 写稿，失败则回退本地模板。</p>
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
        <p>「重新生成」整体重写；「微调」按你的指令只改需要改的部分；可回滚历史版本。</p>
      </div>
      <div class="material-output" id="materialOutput">
        ${generatedCount
          ? Object.entries(generatedMaterials).map(([format, entry]) => renderMaterialBlock(format, entry)).join("")
          : `<article class="empty-state"><h2>还没有生成具体物料</h2><p>先从上面的内容类型里选择一个。建议一次只生成一个，用完再生成下一个。</p></article>`}
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

function renderCommunityPlan(data) {
  communityReady = true;
  updateContext();
  els.channelsResult.innerHTML = `
    <div class="page-header">
      <div>
        <p class="eyebrow">Community Operations</p>
        <h2>${escapeHtml(data.overview.title)}</h2>
        <p>${escapeHtml(data.overview.principle)}</p>
      </div>
      ${renderPills([data.overview.mode, data.overview.audience, data.overview.source])}
    </div>

    <section class="page-section">
      <div class="section-head">
        <div>
          <p class="eyebrow">Weekly Community Flow</p>
          <h3>本周社群节奏</h3>
        </div>
        <p>每一天跟随一周计划主题，但用群里更自然的互动方式推进。</p>
      </div>
      <div class="community-week">
        ${data.week.map((day) => `
          <article class="community-day">
            <div class="card-topline">
              <span>${escapeHtml(day.day)}</span>
              <strong>${escapeHtml(day.pillar)}</strong>
            </div>
            <h3>${escapeHtml(day.sourceTopic)}</h3>
            <div class="copy-block"><strong>群话题</strong><pre>${escapeHtml(day.groupTopic)}</pre></div>
            <div class="copy-block"><strong>群内消息</strong><pre>${escapeHtml(day.message)}</pre></div>
            <div class="copy-block"><strong>互动选项</strong><pre>${escapeHtml(day.interaction)}</pre></div>
            <div class="copy-block"><strong>跟进动作</strong><pre>${escapeHtml(day.followUp)}</pre></div>
            <small>${escapeHtml(day.risk)}</small>
          </article>
        `).join("")}
      </div>
    </section>

    <section class="page-section">
      <div class="section-head">
        <div>
          <p class="eyebrow">FAQ</p>
          <h3>本周可复用回复</h3>
        </div>
      </div>
      <div class="faq-grid">
        ${data.faq.map((item) => `
          <article class="faq-card">
            <h3>${escapeHtml(item.question)}</h3>
            <p>${escapeHtml(item.short)}</p>
            <small>${escapeHtml(item.follow)}</small>
          </article>
        `).join("")}
      </div>
    </section>

    <section class="page-section">
      <div class="section-head">
        <div>
          <p class="eyebrow">Reminders</p>
          <h3>社群执行提醒</h3>
        </div>
      </div>
      <div class="note-box">${renderList(data.reminders)}</div>
    </section>
  `;
}

async function loadProfile() {
  try {
    fillProfileForm(await apiRequest("/api/profile"));
  } catch (error) {
    els.profileStatus.textContent = "读取失败";
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
  toastTimer = setTimeout(() => el.classList.remove("app-toast-show"), 2800);
}

async function persistPlan() {
  try {
    await apiRequest("/api/weekly-plan", { plan: currentPlan || null });
  } catch (error) {
    console.error("一周计划保存失败", error);
    showToast("一周计划未能保存到服务器，请检查网络后重试", "error");
  }
}

async function restoreWeeklyPlan() {
  try {
    const data = await apiRequest("/api/weekly-plan");
    if (data && data.plan) {
      currentPlan = data.plan;
      communityReady = false;
    }
  } catch (error) {
    console.error(error);
  }
}

async function generatePlan(opts = {}) {
  const { brief = null, mode = null, fromAgent = false } = opts;
  const restore = setLoading(els.planBtn, "策略生成中");
  clearPlanSetupAlert();
  try {
    profile = readProfileForm();
    const task = readTask();
    if (mode) task.generationMode = mode;
    if (brief) task.generationBrief = brief;
    const plan = await apiRequest("/api/operation-plan", { profile, task });
    currentPlan = plan;
    communityReady = false;
    persistPlan();
    updateContext();
    navigate({ module: "plan", page: "board", slotIndex: null });
    notifyAgentResult("weekly-plan", { origin: fromAgent ? "agent" : "panel" });
    return plan;
  } catch (error) {
    showPlanSetupAlert(error.message);
    if (fromAgent) throw error;
    return null;
  } finally {
    restore();
  }
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

function renderFinishedLibrary() {
  if (!els.libraryResult) return;
  const items = [...finishedContent].sort((a, b) => (
    new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
  ));
  if (!items.length) {
    els.libraryResult.innerHTML = `<article class="empty-state"><h2>成品库还是空的</h2><p>去「内容生产」生成内容，满意后点「定稿」即可归档到这里。</p></article>`;
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

  const cards = visible.map((item) => {
    const meta = materialTypeMeta(item.format);
    const preview = escapeHtml((materialToText(item.material) || "").slice(0, 120));
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
          <button class="secondary library-reopen" data-library-id="${escapeHtml(item.id)}" type="button">重新打开继续改</button>
          <button class="ghost library-delete" data-library-id="${escapeHtml(item.id)}" type="button">删除</button>
        </div>
        <div class="library-card-detail hidden" data-library-detail="${escapeHtml(item.id)}"></div>
      </article>
    `;
  }).join("");

  els.libraryResult.innerHTML = `${filterRow}<div class="library-list">${cards}</div>`;
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
    alert("复制失败，请手动选择文本复制。");
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
  if (!confirm("确定从成品库删除这条成品吗？")) return;
  try {
    const data = await apiRequest(`/api/finished-content/${encodeURIComponent(id)}`, null, "DELETE");
    finishedContent = Array.isArray(data.items) ? data.items : [];
    renderFinishedLibrary();
  } catch (error) {
    alert(`删除失败：${error.message}`);
  }
}

function reopenFinishedItem(id) {
  const item = findFinishedItem(id);
  if (!item) return;
  currentPlanSlot = null;
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

function setDirectionSession(session, { origin = "panel" } = {}) {
  directionSession = session;
  savedDirectionIds = new Set();
  navigate({ module: "topics", page: "generate", slotIndex: null });
  onDirectionSessionChanged(origin);
}

function onDirectionSessionChanged(origin = "panel") {
  notifyAgentResult("topic-directions", { origin });
}

function notifyAgentResult(type, { origin = "panel" } = {}) {
  if (!agentSession) return;
  agentSession.activeResult = { type };
  if (agentSession.open) {
    renderAgentResultBlock();
  } else if (activeResultData()) {
    agentSession.pendingResult = true;
  }
  updateAgentFab();
}

function activeResultData() {
  const type = agentSession?.activeResult?.type;
  if (type === "topic-directions") return directionSession;
  if (type === "weekly-plan") return currentPlan;
  if (type === "content-material") return currentTopic ? { topic: currentTopic } : null;
  return null;
}

async function generateDirections(opts = {}) {
  const { brief = null, mode = null, eventInfo = null, focus = null, fromAgent = false, restore: externalRestore } = opts;
  const restore = externalRestore
    || (els.topicsGenerateBtn ? setLoading(els.topicsGenerateBtn, "生成中") : () => {});
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
    const payload = { profile, task };
    if (brief) payload.generationBrief = brief;
    const data = await apiRequest("/api/topic-directions", payload);
    setDirectionSession(data, { origin: fromAgent ? "agent" : "panel" });
    return data;
  } catch (error) {
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

const STEP_LABELS = { insight: "家长洞察", angles: "角度展开", topics: "选题成稿", critic: "质检" };

function renderDirectionAiMeta(session) {
  const meta = session?.aiMeta;
  if (!meta) return "";
  const stepText = Array.isArray(meta.steps) && meta.steps.length
    ? `<span class="ai-steps">${meta.steps.map((step) => escapeHtml(STEP_LABELS[step] || step)).join(" › ")}</span>`
    : "";
  if (meta.source === "ai") return `<small class="ai-meta">已由 ${escapeHtml(meta.provider || "AI")} 生成 ${session.directions.length} 条方向 ${stepText}</small>`;
  if (meta.source === "fallback") return `<small class="ai-meta">AI 未跑完整流程，已用本地家长决策链兜底：${escapeHtml(meta.error || "AI 不可用")} ${stepText}</small>`;
  if (meta.source === "local") return `<small class="ai-meta">${escapeHtml(meta.reason || "未配置可用的 AI")}，当前使用本地家长决策链生成方向。</small>`;
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
  return `
    <article class="direction-card ${saved ? "is-saved" : ""}" data-direction-id="${escapeHtml(direction.id)}">
      <div class="direction-card-main">
        <div class="card-topline">
          <span>${escapeHtml(direction.sourceLabel || "选题方向")}</span>
          ${direction.contentGoal ? `<span class="goal-chip ${CONTENT_GOAL_CLASS[direction.contentGoal] || ""}">${escapeHtml(direction.contentGoal)}</span>` : ""}
          ${saved ? `<span class="topic-badge">已入库</span>` : ""}
        </div>
        <h3>${escapeHtml(direction.title)}</h3>
        ${direction.parentQuestion ? `<p class="direction-parent-q">家长会问：${escapeHtml(direction.parentQuestion)}</p>` : ""}
        ${direction.reason ? `<p class="direction-reason">为什么现在做：${escapeHtml(direction.reason)}</p>` : ""}
        <p class="topic-purpose"><strong>解决什么：</strong>${escapeHtml(direction.purpose)}</p>
        ${renderPills([direction.pillarLabel, direction.platformText, direction.formatText, direction.audienceText])}
        ${renderStructurePreview(direction)}
        <div class="direction-meta">
          <p><strong>素材：</strong>${escapeHtml((direction.materials || []).join("、"))}</p>
          <p><strong>转化：</strong>${escapeHtml(direction.suggestedCta || direction.cta || "")}</p>
          <small class="topic-risk">${escapeHtml(direction.risk)}</small>
        </div>
      </div>
      <div class="direction-card-actions">
        <button class="${saved ? "secondary" : "primary"} direction-save" data-direction-id="${escapeHtml(direction.id)}" type="button">${saved ? "已保存" : "保存到选题库"}</button>
        <button class="secondary direction-content" data-direction-id="${escapeHtml(direction.id)}" type="button">生成内容</button>
        <button class="ghost direction-discard" data-direction-id="${escapeHtml(direction.id)}" type="button">丢弃</button>
      </div>
    </article>
  `;
}

function renderTopicGenerateStep(session) {
  if (!els.topicsGenerateContent) return;
  if (!session || !Array.isArray(session.directions) || !session.directions.length) {
    els.topicsGenerateContent.innerHTML = `<article class="empty-state"><h2>还没有生成方向</h2><p>返回选题库点「生成选题方向」开始。</p></article>`;
    return;
  }
  const refMeta = session.referenceMeta;
  els.topicsGenerateContent.innerHTML = `
    <div class="page-header">
      <div>
        <p class="eyebrow">${session.origin === "reference" ? "Reference → Directions" : "Topic Directions"}</p>
        <h2>本次选题方向（${session.directions.length} 条）</h2>
        <p>${escapeHtml(session.summary?.suggestion || "挑选满意的方向保存入库，或直接生成内容。")}</p>
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

async function saveDirections(directions) {
  if (!directions.length) return;
  profile = readProfileForm();
  const data = await apiRequest("/api/topic-library", {
    profile,
    task: { ...readTask(), plan: currentPlan || undefined },
    entries: directions,
  });
  topicLibraryData = data;
  for (const direction of directions) savedDirectionIds.add(direction.id);
  renderTopicsChrome("generate");
  renderTopicGenerateStep(directionSession);
  refreshAgentResultBlock();
}

async function saveDirection(id) {
  const direction = findDirection(id);
  if (!direction) return;
  try {
    await saveDirections([direction]);
  } catch (error) {
    alert(error.message);
  }
}

async function saveAllDirections() {
  const unsaved = (directionSession?.directions || []).filter((d) => !savedDirectionIds.has(d.id));
  try {
    await saveDirections(unsaved);
  } catch (error) {
    alert(error.message);
  }
}

function discardDirection(id) {
  if (!directionSession) return;
  directionSession.directions = directionSession.directions.filter((direction) => direction.id !== id);
  savedDirectionIds.delete(id);
  if (!directionSession.directions.length) {
    directionSession = null;
    navigate({ module: "topics", page: null, slotIndex: null });
    refreshAgentResultBlock();
    return;
  }
  renderTopicsChrome("generate");
  renderTopicGenerateStep(directionSession);
  refreshAgentResultBlock();
}

function clearDirectionSession() {
  directionSession = null;
  savedDirectionIds = new Set();
  navigate({ module: "topics", page: null, slotIndex: null });
  refreshAgentResultBlock();
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
    renderBlock(session) {
      const list = session?.directions || [];
      if (!list.length) return "";
      const rows = list.slice(0, 4).map((d, i) => {
        const saved = savedDirectionIds.has(d.id);
        return `<li><span class="agent-rb-index">${i + 1}</span><span class="agent-rb-title">${escapeHtml(d.title)}</span>${saved ? `<span class="agent-rb-saved">已存</span>` : ""}</li>`;
      }).join("");
      const more = list.length > 4 ? `<li class="agent-rb-more">…还有 ${list.length - 4} 条，详见主面板</li>` : "";
      const unsaved = list.filter((d) => !savedDirectionIds.has(d.id)).length;
      return `
        <div class="agent-rb-head">${escapeHtml(resultRegistry["topic-directions"].summarize(session))}</div>
        <ul class="agent-rb-list">${rows}${more}</ul>
        <div class="agent-rb-chips">
          ${unsaved ? `<button class="agent-chip" data-agent-action="save-all" type="button">全部保存（${unsaved}）</button>` : ""}
          <button class="agent-chip" data-agent-action="regenerate" type="button">再来一批</button>
          <button class="agent-chip" data-agent-action="variant-moments" type="button">换朋友圈向</button>
          <button class="agent-chip" data-agent-action="clear" type="button">清空本次</button>
        </div>
        <p class="agent-rb-hint">可以说「第2条做成小红书」直接进内容生产。</p>
      `;
    },
  },
  "weekly-plan": {
    isEmpty: (plan) => !plan || !((plan.publishingSchedule || plan.week || []).length),
    summarize(plan) {
      const schedule = plan?.publishingSchedule || plan?.week || [];
      return `已生成一周计划（${schedule.length} 条排期）`;
    },
    renderBlock(plan) {
      const schedule = plan?.publishingSchedule || plan?.week || [];
      if (!schedule.length) return "";
      const rows = schedule.slice(0, 5).map((s) => {
        const label = `${escapeHtml(s.platform || "")}${s.topicTitle || s.theme ? " · " + escapeHtml(s.topicTitle || s.theme) : ""}`;
        return `<li><span class="agent-rb-index">${escapeHtml(s.day || "")}</span><span class="agent-rb-title">${label}</span></li>`;
      }).join("");
      const more = schedule.length > 5 ? `<li class="agent-rb-more">…共 ${schedule.length} 条，详见主面板</li>` : "";
      return `
        <div class="agent-rb-head">${escapeHtml(resultRegistry["weekly-plan"].summarize(plan))}</div>
        <ul class="agent-rb-list">${rows}${more}</ul>
        <div class="agent-rb-chips">
          <button class="agent-chip" data-agent-action="plan-regenerate" type="button">重排一版</button>
          <button class="agent-chip" data-agent-action="plan-to-topics" type="button">据此出选题</button>
        </div>
        <p class="agent-rb-hint">可以说「周三换成小红书图文」单条调整。</p>
      `;
    },
  },
  "content-material": {
    isEmpty: (data) => !data || !data.topic,
    summarize(data) {
      return `内容生产：${data?.topic?.title || ""}`;
    },
    renderBlock(data) {
      const topic = data?.topic;
      if (!topic) return "";
      return `
        <div class="agent-rb-head">${escapeHtml(resultRegistry["content-material"].summarize(data))}</div>
        <p class="agent-rb-hint">已在主面板打开内容生产，可选小红书图文或短视频脚本。</p>
      `;
    },
  },
};

function openAgent() {
  agentSession.open = true;
  agentSession.pendingResult = false;
  els.agentPanel?.classList.remove("hidden");
  if (!agentSession.messages.length) {
    pushAgentMessage("assistant", "你好，我是这家球场的运营助手。可以帮你排一周计划、生成选题方向，也能聊聊招生、活动、家长沟通这些经营问题。直接描述本周/本次想做什么，例如「7月暑期营，5天限12人，想招4-8岁」，或点上方按钮。", { skipRender: true });
  }
  renderAgentMessages();
  renderAgentResultBlock();
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

function pushAgentMessage(role, text, { skipRender = false, meta = "" } = {}) {
  agentSession.messages.push({ role, text, meta });
  if (!skipRender) renderAgentMessages();
}

function renderAgentMessages() {
  if (!els.agentMessages) return;
  els.agentMessages.innerHTML = agentSession.messages.map((m) => {
    const metaHtml = m.meta ? `<small class="agent-msg-meta">${escapeHtml(m.meta)}</small>` : "";
    const chips = (m.chips || []).map((c) => `<button class="agent-chip" data-agent-chip="${escapeHtml(c.value || c.label)}" data-agent-chip-kind="${escapeHtml(c.kind || "fill")}" type="button">${escapeHtml(c.label)}</button>`).join("");
    const chipRow = chips ? `<div class="agent-msg-chips">${chips}</div>` : "";
    return `<div class="agent-msg agent-msg-${m.role}"><div class="agent-bubble">${escapeHtml(m.text)}</div>${metaHtml}${chipRow}</div>`;
  }).join("");
  if (agentSession.busy) {
    els.agentMessages.innerHTML += `<div class="agent-msg agent-msg-assistant"><div class="agent-bubble agent-typing">思考中…</div></div>`;
  }
  els.agentMessages.scrollTop = els.agentMessages.scrollHeight;
}

function renderAgentResultBlock() {
  if (!els.agentResultBlock) return;
  const type = agentSession?.activeResult?.type;
  const handler = type ? resultRegistry[type] : null;
  const data = activeResultData();
  if (!handler || !data || (handler.isEmpty && handler.isEmpty(data))) {
    els.agentResultBlock.innerHTML = "";
    els.agentResultBlock.classList.remove("has-result");
    return;
  }
  els.agentResultBlock.innerHTML = handler.renderBlock(data);
  els.agentResultBlock.classList.add("has-result");
}

function refreshAgentResultBlock() {
  if (!agentSession) return;
  if (agentSession.open) renderAgentResultBlock();
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
  await runAgentRoute(text);
}

async function runAgentRoute(text) {
  agentSession.busy = true;
  renderAgentMessages();
  try {
    profile = readProfileForm();
    const data = await apiRequest("/api/agent/route", {
      profile,
      message: text,
      context: { currentResultType: agentSession?.activeResult?.type || null },
    });
    agentSession.busy = false;
    const provider = data.aiMeta?.source === "ai" ? data.aiMeta.provider : (data.aiMeta?.source === "fallback" ? "本地兜底" : "");
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
        agentSession.messages.push({ role: "assistant", text: reply, meta: provider ? `意图解析 · ${provider}` : "", chips });
        renderAgentMessages();
      } else {
        pushAgentMessage("assistant", reply, { meta: provider ? `意图解析 · ${provider}` : "" });
        if (isPlan) await agentGeneratePlan(agentSession.priorBrief, agentSession.lastMode);
        else await agentGenerate();
      }
      return;
    }

    if (intent === "content") {
      pushAgentMessage("assistant", data.reply || "想做成具体内容的话，先在「选题」里选一条，我带你进内容生产。", { meta: provider ? `意图解析 · ${provider}` : "" });
      return;
    }

    const reply = data.reply || "我可以帮你排一周计划、生成选题方向，也能聊聊招生、活动、家长沟通这些经营问题。";
    const chips = [];
    if (data.suggestedAction && data.suggestedAction.type) {
      const valueMap = { plan: "__plan__", topic: "__topic__", content: "__content__" };
      const kindMap = { plan: "suggest-plan", topic: "suggest-topic", content: "suggest-content" };
      chips.push({
        label: data.suggestedAction.label || "去生成",
        value: valueMap[data.suggestedAction.type] || data.suggestedAction.label,
        kind: kindMap[data.suggestedAction.type] || "fill",
      });
    }
    agentSession.messages.push({ role: "assistant", text: reply, meta: provider ? `运营建议 · ${provider}` : "", chips });
    renderAgentMessages();
  } catch (error) {
    agentSession.busy = false;
    pushAgentMessage("assistant", `处理失败：${error.message}`);
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
    const provider = data.aiMeta?.source === "ai" ? data.aiMeta.provider : (data.aiMeta?.source === "fallback" ? "本地兜底" : "");
    const reply = data.reply || "我已理解你的需求。";
    const chips = (Array.isArray(data.clarifyQuestions) ? data.clarifyQuestions : []).map((q) => ({ label: q, value: q, kind: "fill" }));
    chips.unshift({ label: "直接生成选题", value: "__generate__", kind: "generate" });
    agentSession.messages.push({ role: "assistant", text: reply, meta: provider ? `意图解析 · ${provider}` : "", chips });
    renderAgentMessages();
  } catch (error) {
    agentSession.busy = false;
    pushAgentMessage("assistant", `解析失败：${error.message}`);
  }
}

async function agentGenerate(extraBrief = null) {
  if (agentSession.busy) return;
  if (extraBrief) agentSession.priorBrief = mergeBrief(agentSession.priorBrief, extraBrief);
  agentSession.busy = true;
  pushAgentMessage("assistant", "正在按家长决策链生成选题，结果会显示在主面板…");
  try {
    const data = await generateDirections({ brief: agentSession.priorBrief, mode: agentSession.lastMode, fromAgent: true });
    agentSession.busy = false;
    agentSession.messages.pop();
    const provider = data?.aiMeta?.source === "ai" ? data.aiMeta.provider : (data?.aiMeta?.source === "fallback" ? "本地兜底" : "");
    pushAgentMessage("assistant", `${resultRegistry["topic-directions"].summarize(data)}。可以说「全部保存」「再来一批」「换朋友圈向」，或「第2条软一点」。`, { meta: provider });
  } catch (error) {
    agentSession.busy = false;
    agentSession.messages.pop();
    pushAgentMessage("assistant", `生成失败：${error.message}`);
  }
}

async function agentGeneratePlan(brief = null, mode = null) {
  if (agentSession.busy) return;
  agentSession.busy = true;
  pushAgentMessage("assistant", "正在排一周计划，结果会显示在主面板…");
  try {
    const plan = await generatePlan({ brief, mode, fromAgent: true });
    agentSession.busy = false;
    agentSession.messages.pop();
    if (!plan) { pushAgentMessage("assistant", "计划没有生成成功，请补充信息后再试。"); return; }
    const provider = plan?.aiMeta?.source === "ai" ? plan.aiMeta.provider : (plan?.aiMeta?.source === "fallback" ? "本地兜底" : "");
    pushAgentMessage("assistant", `${resultRegistry["weekly-plan"].summarize(plan)}。可以说「重排一版」「据此出选题」，或「周三换成小红书图文」单条调整。`, { meta: provider });
  } catch (error) {
    agentSession.busy = false;
    agentSession.messages.pop();
    pushAgentMessage("assistant", `生成失败：${error.message}`);
  }
}

function routeAgentIntent(text) {
  const type = agentSession?.activeResult?.type;
  if (type === "topic-directions") return routeTopicIntent(text);
  if (type === "weekly-plan") return routePlanIntent(text);
  return false;
}

const PLAN_WEEKDAY_MAP = { 一: "周一", 二: "周二", 三: "周三", 四: "周四", 五: "周五", 六: "周六", 日: "周日", 天: "周日" };

function weekdayFromText(text) {
  const m = text.match(/周\s*([一二三四五六日天])/);
  return m ? PLAN_WEEKDAY_MAP[m[1]] || null : null;
}

function routePlanIntent(text) {
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
      refreshAgentResultBlock();
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

  if (ord && /(做成|生成|出|改成).{0,6}(小红书|图文|短视频|视频|抖音|朋友圈)/.test(text)) {
    const dir = directionSession.directions[ord - 1];
    if (dir) {
      const fmt = /短视频|视频|抖音/.test(text) ? "video" : (/朋友圈/.test(text) ? "moments_text" : "xhs_image");
      const fmtLabel = fmt === "video" ? "短视频脚本" : (fmt === "moments_text" ? "朋友圈" : "小红书图文");
      openContentForDirection(dir.id, fmt);
      notifyAgentResult("content-material", { origin: "agent" });
      pushAgentMessage("assistant", `已把第 ${ord} 条「${dir.title}」带入内容生产（${fmtLabel}）。`);
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
      refreshAgentResultBlock();
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
    pushAgentMessage("assistant", "先在「选题」里选一条，再说「第N条做成小红书/短视频」，我带你进内容生产。");
    return;
  }
  if (els.agentInput) {
    els.agentInput.value = value;
    autoGrowAgentInput();
    els.agentInput.focus();
  }
}

function handleAgentResultAction(action) {
  if (action === "save-all") {
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
    alert(error.message);
  }
}

function openAdoptModal(id) {
  const topic = currentTopics.find((item) => item.id === id);
  if (!topic || !els.topicsModalRoot) return;
  const schedule = currentPlan?.publishingSchedule || currentPlan?.week || [];
  if (!schedule.length) {
    alert("还没有本周计划。请先在「一周计划」生成排期，再把选题采用到具体槽位。");
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
  alert(`已把「${topic.title}」采用到 ${slot.day} · ${slot.platform}。回到一周计划看板即可看到。`);
}

async function startContentFromPlanSlot(slotIndex) {
  const schedule = currentPlan?.publishingSchedule || currentPlan?.week || [];
  const slot = schedule[slotIndex];
  if (!slot) return;

  currentPlanSlot = slot;
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

    currentTopic = topic;
    topicsReady = true;
    updateContext();
    setView("content");
    renderTopicDesk(topic);
  } catch (error) {
    alert(error.message);
  }
}

function openContentForTopic(topic, format) {
  if (!topic) return;
  currentPlanSlot = null;
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

function renderContentStart() {
  els.contentView.innerHTML = `
    <div class="page-header">
      <div>
        <p class="eyebrow">内容工作台</p>
        <h2>从一个想法开始</h2>
        <p>不用先有选题——写下你想做的内容或角度，直接开始生产；也可以让 AI 先帮你整理成一条完整选题。</p>
      </div>
    </div>
    <section class="page-section workbench-step content-start">
      <label class="content-start-field">
        <span>你的想法 / 角度</span>
        <textarea id="contentIdeaInput" rows="4" placeholder="例如：介绍我们的场地环境 / 4岁能不能学网球 / 学员一个月的进步"></textarea>
      </label>
      <p class="content-start-hint">系统会按你的想法自动判断是「科普讲解」还是「真实展示」，进入工作台后还能继续调整 brief。</p>
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
    openContentForTopic(data.topic);
  } catch (error) {
    alert(error.message);
  } finally {
    restore();
  }
}

function resetContentToStart() {
  currentTopic = null;
  currentPlanSlot = null;
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

function openContentForDirection(id, format) {
  const direction = findDirection(id);
  if (direction) openContentForTopic(direction, format);
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
    renderTopicContent(content);
  } catch (error) {
    const output = els.contentView.querySelector("#materialOutput");
    if (output) {
      output.innerHTML = `<article class="empty-state"><h2>生成失败</h2><p>${escapeHtml(error.message)}</p></article>`;
    }
  } finally {
    restore();
  }
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
  readContentBriefFromDom();
  const button = els.contentView.querySelector(`.material-refine-apply[data-format="${CSS.escape(format)}"]`);
  const restore = button ? setLoading(button, "微调中") : () => {};
  try {
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
      alert(content.aiMeta.error || content.aiMeta.reason || "微调未生效，请检查 AI 配置后重试。");
      return;
    }
    const material = (content.materials || [])[0];
    if (!material) throw new Error("微调失败");
    const history = [...(entry.history || []), { material: entry.material, aiMeta: entry.aiMeta, label: "微调前" }];
    generatedMaterials[format] = { ...entry, material, aiMeta: content.aiMeta || entry.aiMeta, history, status: "draft" };
    rerenderContent();
  } catch (error) {
    alert(error.message);
  } finally {
    restore();
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
    const finishedId = `${currentTopic.id}-${format}`;
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
      };
      const data = await apiRequest("/api/finished-content", { item });
      if (data && Array.isArray(data.items)) finishedContent = data.items;
    } else {
      const data = await apiRequest(`/api/finished-content/${encodeURIComponent(finishedId)}`, null, "DELETE");
      if (data && Array.isArray(data.items)) finishedContent = data.items;
    }
  } catch (error) {
    // 同步失败时回滚乐观状态，避免界面显示与成品库不一致。
    const current = generatedMaterials[format];
    if (current) generatedMaterials[format] = { ...current, status: prevStatus };
    rerenderContent();
    alert(`成品库同步失败：${error.message}`);
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
    alert("复制失败，请手动选择文本复制。");
  }
}

async function generateCommunityPlan() {
  const restore = setLoading(els.communityBtn, "生成中");
  communityReady = false;
  updateContext();
  els.channelsResult.innerHTML = `<article class="empty-state"><h2>正在生成微信社群节奏</h2><p>会优先读取当前一周计划里的主题。</p></article>`;
  setView("channels");
  try {
    profile = readProfileForm();
    const data = await apiRequest("/api/community-plan", { profile, task: { ...readTask(), plan: currentPlan } });
    renderCommunityPlan(data);
  } catch (error) {
    els.channelsResult.innerHTML = `<article class="empty-state"><h2>生成失败</h2><p>${escapeHtml(error.message)}</p></article>`;
  } finally {
    restore();
  }
}

els.saveProfileBtn.addEventListener("click", async () => {
  els.profileStatus.textContent = "保存中";
  profile = readProfileForm();
  await apiRequest("/api/profile", { profile });
  updateContext();
  els.profileStatus.textContent = "已保存";
});

els.profileShortcutBtn.addEventListener("click", () => setView("profile"));
els.aiShortcutBtn.addEventListener("click", () => setView("ai"));

els.planBtn.addEventListener("click", () => generatePlan());

els.planView.addEventListener("click", (event) => {
  if (handlePlanNavClick(event)) return;
  const button = event.target.closest(".plan-slot-action");
  if (!button) return;
  startContentFromPlanSlot(Number(button.dataset.slotIndex));
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
    if (action === "regenerate") generateDirections();
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
  const dirDiscard = event.target.closest(".direction-discard");
  if (dirDiscard) { discardDirection(dirDiscard.dataset.directionId); return; }
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

els.libraryView.addEventListener("click", (event) => {
  const filter = event.target.closest("[data-library-filter]");
  if (filter) { libraryFormatFilter = filter.dataset.libraryFilter; renderFinishedLibrary(); return; }
  const expand = event.target.closest(".library-expand");
  if (expand) { toggleFinishedDetail(expand.dataset.libraryId); return; }
  const copy = event.target.closest(".library-copy");
  if (copy) { copyFinishedItem(copy.dataset.libraryId, copy); return; }
  const reopen = event.target.closest(".library-reopen");
  if (reopen) { reopenFinishedItem(reopen.dataset.libraryId); return; }
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
els.communityBtn.addEventListener("click", generateCommunityPlan);
els.saveAiBtn.addEventListener("click", saveAiSettings);

els.topicSearchInput?.addEventListener("input", (event) => {
  topicFilters.search = event.target.value;
  applyTopicFilters();
});
els.topicPillarFilter?.addEventListener("change", (event) => {
  topicFilters.pillar = event.target.value;
  applyTopicFilters();
});
els.topicPlatformFilter?.addEventListener("change", (event) => {
  topicFilters.platform = event.target.value;
  applyTopicFilters();
});
els.topicSourceFilter?.addEventListener("change", (event) => {
  topicFilters.source = event.target.value;
  applyTopicFilters();
});
els.topicStatusFilter?.addEventListener("change", (event) => {
  topicFilters.status = event.target.value;
  applyTopicFilters();
});

els.aiView.addEventListener("click", (event) => {
  const button = event.target.closest(".ai-test");
  if (!button) return;
  testAiProvider(button.dataset.provider);
});

els.agentFab?.addEventListener("click", toggleAgent);
els.agentCloseBtn?.addEventListener("click", closeAgent);
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
  if (action) { handleAgentResultAction(action.dataset.agentAction); return; }
});

window.addEventListener("hashchange", () => {
  currentRoute = normalizeRoute(parseRouteHash());
  renderRoute();
});

async function bootstrap() {
  loadAiSettings();
  await Promise.all([loadProfile(), restoreWeeklyPlan()]);
  loadFinishedContent();
  updateContext();
  navigate(parseRouteHash(location.hash), { replace: true });
}

bootstrap();
