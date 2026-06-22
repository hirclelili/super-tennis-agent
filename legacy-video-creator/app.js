const stepOrder = ["brief", "assets", "strategy", "script", "production", "preview"];

const state = {
  step: "brief",
  creationMode: "existing",
  assets: [],
  themes: [],
  selectedThemeId: null,
  script: [],
  editPlan: [],
  activeRewrite: null,
  rewriteDraft: null,
  profileSaved: false,
};

const creationModeCopy = {
  existing: {
    label: "直接用现有素材出片",
    prompt: "你选择了直接用现有素材出片。先补充商家和宣传信息，下一步上传素材后，我会组织成选题方向和剪辑结构。",
    briefTitle: "现有素材情况",
    fields: ["素材里大概有什么", "一定要用/优先用什么", "这次不要怎么做"],
    defaults: [
      "门店环境、产品特写、活动海报、短视频片段",
      "优先用产品特写和店内氛围素材",
      "不补拍，不做复杂口播，尽量用已有素材剪出完整视频。",
    ],
    assetTitle: "上传你想直接使用的素材",
    assetHelp: "把这次想用的图片和视频放进来。Agent 会优先基于现有素材生成选题方向和剪辑结构，不默认要求补拍。",
    assetNote: "这条路径会把脚本理解成“剪辑结构”：先看你有什么素材，再决定怎么排列、配字幕和转场。",
    planButton: "基于素材生成选题",
    nextButton: "下一步：上传现有素材",
    strategyTitle: "选择最适合现有素材的选题方向",
    strategyHelp: "AI 会优先考虑你已有素材能不能支撑，不默认要求补拍。",
    scriptTitle: "检查并调整内容结构",
    scriptHelp: "这一步先确认每段讲什么、画面表达什么、字幕怎么说。素材匹配和缺素材处理放到下一步执行清单。",
    visualColumn: "画面/素材安排",
  },
  planning: {
    label: "帮我规划拍摄",
    prompt: "你选择了规划拍摄。我会先给你选题方向和能照着拍的简单脚本，素材可以先不上传。",
    briefTitle: "拍摄条件",
    fields: ["现在能拍什么场景", "谁来拍/谁能出镜", "拍摄限制"],
    defaults: [
      "门店环境、产品制作过程、店员服务、活动物料",
      "店员可以手部出镜，暂时不做正脸口播",
      "希望 30 分钟内能拍完，用手机拍摄即可。",
    ],
    assetTitle: "可以先跳过素材",
    assetHelp: "如果你还没拍，可以直接生成选题方向。我会在脚本里写清楚建议拍什么。",
    assetNote: "这条路径会把脚本理解成“拍摄清单 + 简单分镜”：重点告诉你先拍什么、怎么拍、为什么拍。",
    planButton: "生成拍摄选题",
    nextButton: "下一步：生成选题",
    strategyTitle: "选择一个值得拍的选题方向",
    strategyHelp: "AI 会根据商家信息和拍摄条件，给出可以照着拍的宣传方向。",
    scriptTitle: "检查并调整拍摄脚本",
    scriptHelp: "每一段会尽量写成商家能照着拍的内容：拍什么、字幕/旁白和这一段目的。",
    visualColumn: "拍什么",
  },
  mixed: {
    label: "已有素材 + 可以补一点",
    prompt: "你选择了混合模式。我会先尽量使用现有素材，确实缺关键画面时再给少量补拍建议。",
    briefTitle: "素材与补拍边界",
    fields: ["已有素材大概有什么", "可以补拍什么", "不能补拍/不想补拍什么"],
    defaults: [
      "已有门店环境和产品照片，缺少顾客使用场景",
      "可以补拍 2-3 个产品近景或店员操作镜头",
      "不安排顾客正脸出镜，不做长口播。",
    ],
    assetTitle: "上传已有素材",
    assetHelp: "先上传已有素材，Agent 会判断哪些能直接用、哪些镜头如果补拍会更好。",
    assetNote: "这条路径会先消化现有素材，只有缺关键画面时才给少量补拍建议，不会把事情做复杂。",
    planButton: "生成选题和补拍建议",
    nextButton: "下一步：上传素材/确认补拍",
    strategyTitle: "选择选题和补拍方向",
    strategyHelp: "AI 会先使用现有素材，再判断是否需要少量补拍关键镜头。",
    scriptTitle: "检查脚本和补拍建议",
    scriptHelp: "每一段会标出素材怎么用；如果缺关键画面，再给少量补拍建议。",
    visualColumn: "素材/补拍安排",
  },
};

const PROFILE_KEY = "videoCreator.storeProfile";
const MAX_UPLOAD_FILES = 20;
const MAX_ASSET_SIZE_MB = 80;
const MAX_ASSET_SIZE_BYTES = MAX_ASSET_SIZE_MB * 1024 * 1024;
let renderProgressTimer = null;
const ASSET_PROFILE_VERSION = 1;
const ALLOWED_ASSET_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
]);

const videoLengthCopy = {
  "15s": {
    label: "15 秒左右",
    durationLabel: "15s",
    range: "12-18 秒",
    themeHint: "只适合单一信息点，选题必须聚焦，不要塞多个卖点。",
    scriptHint: "脚本控制在 3-4 段，字幕短、节奏快，只保留一个核心动作。",
  },
  "30s": {
    label: "30 秒左右",
    durationLabel: "30s",
    range: "25-35 秒",
    themeHint: "适合讲清一个完整宣传点，可以包含主体、理由、证据和行动。",
    scriptHint: "脚本控制在 5-6 段，每段承担一个信息功能。",
  },
  "1min": {
    label: "1 分钟左右",
    durationLabel: "1min",
    range: "50-70 秒",
    themeHint: "适合更完整地解释背景、优势、流程或用户顾虑。",
    scriptHint: "脚本控制在 7-9 段，要有清晰信息推进，不能只是短视频段落拉长。",
  },
  "3min_plus": {
    label: "3 分钟以上",
    durationLabel: "3min+",
    range: "180 秒以上",
    themeHint: "适合深度介绍、完整服务流程、品牌故事或详细测评，需要章节结构。",
    scriptHint: "脚本按章节生成 8-12 段，每段可以更完整，但仍要具体可拍。",
  },
};

const contentFormatCopy = {
  auto: "让 AI 按目标判断",
  announcement: "告知介绍型",
  tour: "带看体验型",
  reason: "理由种草型",
  problem_solution: "问题解决型",
  comparison: "对比说明型",
  story: "故事记录型",
  offer: "权益行动型",
};

const briefTemplates = {
  offline: {
    chipPrefix: "门店",
    profileTitle: "商家档案",
    labels: ["店铺名称/类型", "店铺特色", "所在场景/区域", "希望用户记住什么"],
    projectTitle: "产品/活动信息",
    projectLabels: ["产品/活动名称", "核心卖点", "价格/权益", "活动时间"],
    projectTypes: [
      ["store_product", "店铺 + 具体产品/活动"],
      ["store", "只做店铺宣传"],
      ["product", "只做产品种草"],
    ],
    prompt: "这是线下门店模板，我会重点看位置、到店理由、空间氛围和服务体验。",
  },
  ecommerce: {
    chipPrefix: "网店",
    profileTitle: "网店档案",
    labels: ["店铺名称/主营类目", "店铺优势", "销售渠道/平台", "希望用户记住什么"],
    projectTitle: "商品/活动信息",
    projectLabels: ["商品/活动名称", "商品卖点", "价格/优惠/赠品", "上新/大促时间"],
    projectTypes: [
      ["store_product", "网店 + 具体商品/活动"],
      ["store", "只做店铺/品牌宣传"],
      ["product", "只做商品种草"],
    ],
    prompt: "这是网店模板，我会重点看商品卖点、优惠机制、用户痛点、下单理由和平台种草表达。",
  },
  service: {
    chipPrefix: "服务",
    profileTitle: "服务商家档案",
    labels: ["商家名称/服务类型", "服务优势", "服务范围/预约方式", "希望客户记住什么"],
    projectTitle: "服务/套餐信息",
    projectLabels: ["服务/套餐名称", "解决的问题", "价格/权益", "适用时间/预约周期"],
    projectTypes: [
      ["store_product", "商家 + 服务/套餐"],
      ["store", "只做商家宣传"],
      ["product", "只做服务套餐"],
    ],
    prompt: "这是本地服务模板，我会重点看客户痛点、服务流程、信任感、案例和预约转化。",
  },
  brand: {
    chipPrefix: "品牌",
    profileTitle: "品牌档案",
    labels: ["品牌/产品线名称", "品牌优势", "销售渠道/覆盖场景", "品牌主张"],
    projectTitle: "产品/ campaign 信息",
    projectLabels: ["产品/campaign 名称", "核心差异点", "权益/组合", "上市/传播周期"],
    projectTypes: [
      ["store_product", "品牌 + 具体产品/campaign"],
      ["store", "只做品牌宣传"],
      ["product", "只做产品种草"],
    ],
    prompt: "这是品牌产品模板，我会重点看差异化、用户心智、使用场景和选题方向。",
  },
};

const demoThemes = [
  {
    id: "date",
    title: "七夕约会第一杯",
    promise: "用限定饮品和店内氛围制造约会理由，适合做小红书种草。",
    hook: "今年七夕，不用跑远也能有仪式感。",
    rhythm: "温柔快剪",
    duration: 18,
    score: "转化强",
    shots: ["门头", "玫瑰拿铁特写", "双人入座", "出杯过程", "活动字幕"],
  },
  {
    id: "craft",
    title: "一杯限定怎么诞生",
    promise: "突出制作过程和产品质感，让用户觉得新品值得专门来一趟。",
    hook: "这杯玫瑰拿铁，只卖到七夕当天。",
    rhythm: "产品特写",
    duration: 22,
    score: "质感强",
    shots: ["咖啡萃取", "玫瑰糖浆", "拉花", "杯身标签", "手持成品"],
  },
  {
    id: "offer",
    title: "下班后的限定套餐",
    promise: "把优惠、场景和行动引导放在一起，适合抖音本地生活转化。",
    hook: "下班后 30 分钟，给今天加一点甜。",
    rhythm: "信息快剪",
    duration: 15,
    score: "引流强",
    shots: ["套餐展示", "价格牌", "店内座位", "顾客举杯", "地址 CTA"],
  },
];

const openingThemesPre = [
  {
    id: "pre_intro",
    title: "先认识一下，这家新店是谁",
    promise: "用主体亮相和场地空镜做开幕前介绍，回答「这是谁、干什么的」。",
    hook: "附近这家新店快见面了，先带你看一眼它是谁。",
    rhythm: "告知记录",
    duration: 18,
    score: "认知向",
    shots: ["门头/场馆外观", "招牌与品牌信息", "场地/空间空镜", "服务品类字幕", "团队筹备合影", "开幕时间预告"],
  },
  {
    id: "pre_location",
    title: "新店在哪，怎么去最方便",
    promise: "用位置和周边路线降低找店成本，适合开幕前发布。",
    hook: "如果住在这附近，这家店开业前可以先记下位置。",
    rhythm: "路线指引",
    duration: 15,
    score: "实用向",
    shots: ["街区/地标", "门头特写", "停车/地铁提示", "入口动线", "地址字幕", "收藏提示"],
  },
  {
    id: "pre_offer_scope",
    title: "开业后，这里能体验到什么",
    promise: "用服务范畴介绍建立预期，只列业务大类，不拍教学过程。",
    hook: "正式开业前，可以先了解这里准备提供哪些服务。",
    rhythm: "温和介绍",
    duration: 20,
    score: "预期向",
    shots: ["场地/器械/陈列", "前台/接待区", "服务列表字幕", "团队准备", "开幕时间", "邀请关注"],
  },
];

const openingThemes = [
  {
    id: "opening_welcome",
    title: "新店开业，第一批来的人看到了什么",
    promise: "用真实开业氛围和到店体验做分享，避免硬广口吻。",
    hook: "这家店开业了，第一批来的人是这样看的。",
    rhythm: "开业记录",
    duration: 18,
    score: "记录向",
    shots: ["门头开业布置", "店内全景", "服务/出餐过程", "开业礼遇字幕", "地址导航"],
  },
  {
    id: "opening_gift",
    title: "开业见面礼，来了能体验到什么",
    promise: "用「见面礼/礼遇」讲清开业权益，不用限时抢购等敏感表达。",
    hook: "开业期间来店，能体验到这些专属安排。",
    rhythm: "温和介绍",
    duration: 15,
    score: "礼遇向",
    shots: ["礼遇说明字幕", "招牌产品/服务", "店内体验", "店员接待", "地址收藏"],
  },
  {
    id: "opening_first",
    title: "新开业的店，第一眼印象如何",
    promise: "用空间和服务细节建立信任，适合试营业/开业当天发布。",
    hook: "新开业的店，第一眼就能看出来用不用心。",
    rhythm: "探店质感",
    duration: 22,
    score: "信任向",
    shots: ["门头", "环境细节", "产品/服务过程", "团队接待", "收藏/地址"],
  },
];

const storeThemes = [
  {
    id: "store_vibe",
    title: "下班后的附近小店",
    promise: "用门店环境、动线和氛围建立“我想去坐一坐”的理由，适合店铺宣传。",
    hook: "如果你下班后只想安静待一会儿，可以来这里。",
    rhythm: "氛围漫游",
    duration: 20,
    score: "记忆点强",
    shots: ["门头", "店内全景", "座位区", "灯光细节", "店员服务", "地址字幕"],
  },
  {
    id: "store_reason",
    title: "为什么附近的人会常来",
    promise: "把店铺特色、位置便利和用户场景讲清楚，适合本地生活引流。",
    hook: "这家店不是路过才来，是来过以后会记住。",
    rhythm: "本地生活",
    duration: 18,
    score: "引流强",
    shots: ["街区位置", "招牌", "招待过程", "顾客入座", "特色区域", "营业时间"],
  },
  {
    id: "store_story",
    title: "一家店的气质",
    promise: "突出品牌感和主理人审美，让店铺从普通地址变成值得收藏的目的地。",
    hook: "有些店，一进门就知道不是随便开的。",
    rhythm: "品牌质感",
    duration: 24,
    score: "品牌感强",
    shots: ["主理人/店员", "空间设计", "招牌细节", "服务瞬间", "顾客感受", "店名定格"],
  },
];

const ecommerceThemes = [
  {
    id: "ecom_seed",
    title: "为什么这件值得入手",
    promise: "用痛点、卖点和使用场景建立购买理由，适合网店商品种草。",
    hook: "如果你也在找一个省心的选择，可以先看这个。",
    rhythm: "种草讲解",
    duration: 20,
    score: "种草强",
    shots: ["商品主图", "细节特写", "使用前后", "卖点字幕", "评价截图", "购买入口"],
  },
  {
    id: "ecom_offer",
    title: "限时优惠怎么更划算",
    promise: "把价格权益、赠品和下单时机讲清楚，适合大促和直播间引流。",
    hook: "这波活动别直接拍，先看怎么买更划算。",
    rhythm: "信息快剪",
    duration: 15,
    score: "转化强",
    shots: ["商品组合", "价格权益", "赠品", "库存/时间", "直播间/店铺入口"],
  },
  {
    id: "ecom_compare",
    title: "同类产品怎么选",
    promise: "用对比和避坑逻辑突出差异点，适合建立信任和转化。",
    hook: "同类产品很多，但真正要看这几点。",
    rhythm: "对比测评",
    duration: 24,
    score: "信任强",
    shots: ["竞品对比", "核心参数", "真实使用", "细节差异", "用户评价"],
  },
];

const serviceThemes = [
  {
    id: "service_problem",
    title: "这个问题可以这样解决",
    promise: "从用户痛点切入，展示服务流程和结果，适合预约咨询。",
    hook: "如果你最近也遇到这个问题，先别急着乱试。",
    rhythm: "问题解决",
    duration: 22,
    score: "咨询强",
    shots: ["问题场景", "服务流程", "专业细节", "案例结果", "预约方式"],
  },
  {
    id: "service_trust",
    title: "一次服务背后的细节",
    promise: "突出专业、流程和服务态度，适合建立信任感。",
    hook: "真正让人放心的服务，细节都藏在过程里。",
    rhythm: "信任建立",
    duration: 24,
    score: "信任强",
    shots: ["接待", "检查/沟通", "服务过程", "客户反馈", "门店/团队"],
  },
  {
    id: "service_package",
    title: "这个套餐适合谁",
    promise: "讲清适用人群、权益和预约方式，适合套餐促销。",
    hook: "这个套餐不是所有人都需要，但这类人很适合。",
    rhythm: "套餐说明",
    duration: 18,
    score: "转化强",
    shots: ["套餐内容", "适用人群", "权益字幕", "案例", "预约 CTA"],
  },
];

const scriptPresets = {
  date: [
    ["0-3s", "门头和橱窗扫过，傍晚灯光入镜", "今年七夕，不用跑远也能有仪式感。", "先给用户一个到店理由"],
    ["3-7s", "玫瑰拿铁出杯，奶泡和花瓣特写", "限定玫瑰拿铁，只在这个周末供应。", "突出限定感和产品颜值"],
    ["7-12s", "两个人坐下、举杯、轻松聊天", "适合下班后约会，也适合临时给对方一个小惊喜。", "建立使用场景"],
    ["12-16s", "甜品和饮品同框，桌面俯拍", "点双人套餐会更划算。", "自然带出促销"],
    ["16-18s", "门店地址和活动时间", "收藏这家店，七夕前来打卡。", "行动引导"],
  ],
  craft: [
    ["0-3s", "咖啡液流入杯中", "一杯七夕限定，从第一秒就要好看。", "开场抓住质感"],
    ["3-8s", "加入玫瑰风味和牛奶", "玫瑰香气、顺滑奶感，还有一点点甜。", "讲清产品口味"],
    ["8-13s", "拉花与花瓣装饰", "每一杯都会现场制作。", "强调手作感"],
    ["13-18s", "手持饮品走过店内", "很适合拍照，也很适合送给喜欢的人。", "连接社交传播"],
    ["18-22s", "成品定格和店名", "七夕限定，售完就没有。", "制造稀缺感"],
  ],
  offer: [
    ["0-2s", "套餐和价格快速出现", "七夕约会套餐，今天安排上。", "直接给信息"],
    ["2-5s", "饮品、甜品、座位连续快切", "一杯玫瑰拿铁加一份甜品。", "说明组合"],
    ["5-9s", "情侣或朋友举杯", "下班路过，就能完成一个小约会。", "降低行动门槛"],
    ["9-12s", "活动时间和门店环境", "本周末限时供应。", "强调时效"],
    ["12-15s", "地址、营业时间、预约提示", "现在收藏，别等当天找不到位置。", "强 CTA"],
  ],
  store_vibe: [
    ["0-3s", "门头和街区环境，展示店铺很好找到", "下班后想安静待一会儿，可以来这里。", "给用户一个到店场景"],
    ["3-7s", "推门进入，扫过座位、灯光和空间", "不用跑远，也能有一个舒服的放松角落。", "建立店铺氛围"],
    ["7-12s", "店员服务、顾客坐下、空间细节", "适合一个人放空，也适合和朋友慢慢聊。", "扩大使用人群"],
    ["12-16s", "店内特色区域和招牌细节", "这家店的记忆点，是安静和有质感。", "强化品牌印象"],
    ["16-20s", "地址、营业时间、门店外观定格", "收藏起来，下次路过就进来坐坐。", "行动引导"],
  ],
  store_reason: [
    ["0-3s", "街区和门头快速出现", "附近的人为什么会常来这家店？", "用问题做开场钩子"],
    ["3-7s", "展示位置、进店动线、店内座位", "位置方便，环境也不吵。", "说明到店门槛低"],
    ["7-12s", "服务过程和店内特色", "适合下班后短暂停一下。", "建立高频场景"],
    ["12-15s", "顾客入座或朋友聊天", "不是特意赶路，也值得顺手收藏。", "转成收藏动作"],
    ["15-18s", "地址和营业时间", "在附近的话，今天就能来。", "本地 CTA"],
  ],
  store_story: [
    ["0-4s", "空间设计、招牌和细节慢切", "有些店，一进门就知道不是随便开的。", "建立品牌质感"],
    ["4-9s", "主理人/店员整理空间或准备服务", "从灯光、座位到每一次服务，都有自己的节奏。", "表达经营态度"],
    ["9-14s", "店内细节和用户停留状态", "它卖的不只是产品，也是一个可以停下来的地方。", "提升情绪价值"],
    ["14-20s", "门店不同角落和招牌定格", "适合约会、独处，也适合重新认识附近。", "扩展使用场景"],
    ["20-24s", "店名、地址、收藏提示", "收藏这家店，下次来附近别错过。", "品牌 CTA"],
  ],
  ecom_seed: [
    ["0-3s", "商品主图和使用场景快速出现", "如果你也在找一个省心的选择，可以先看这个。", "用痛点建立兴趣"],
    ["3-8s", "商品细节和核心卖点特写", "它最值得看的，是这几个细节。", "突出差异点"],
    ["8-13s", "真实使用场景或前后对比", "不是只好看，日常用起来也方便。", "建立使用价值"],
    ["13-17s", "评价、销量或保障信息", "新手也可以放心入手。", "补充信任"],
    ["17-20s", "购买入口、活动权益", "现在进店看活动价。", "行动引导"],
  ],
  ecom_offer: [
    ["0-2s", "商品组合和优惠信息快速出现", "这波活动别直接拍，先看怎么买更划算。", "用权益开场"],
    ["2-6s", "价格、赠品、满减分层展示", "核心优惠是组合价和赠品。", "讲清利益点"],
    ["6-10s", "商品细节和适用场景", "适合想一次配齐的人。", "建立购买场景"],
    ["10-13s", "活动时间或库存提示", "限时活动，错过要等下一波。", "制造时效"],
    ["13-15s", "店铺/直播间入口", "点进店铺看当前活动。", "转化 CTA"],
  ],
  ecom_compare: [
    ["0-3s", "同类商品对比画面", "同类产品很多，但真正要看这几点。", "建立测评感"],
    ["3-8s", "参数和细节差异展示", "第一个看材质，第二个看使用体验。", "给选择标准"],
    ["8-14s", "真实使用或测试过程", "用起来顺不顺手，比图片更重要。", "建立可信度"],
    ["14-20s", "优势总结和适用人群", "如果你看重省心和质感，它会更适合。", "锁定人群"],
    ["20-24s", "价格权益和购买入口", "活动期入手更合适。", "引导转化"],
  ],
  service_problem: [
    ["0-3s", "用户问题场景", "如果你最近也遇到这个问题，先别急着乱试。", "用痛点开场"],
    ["3-8s", "服务前沟通和判断", "先判断原因，再决定怎么处理。", "建立专业感"],
    ["8-14s", "服务过程和细节", "过程越清楚，客户越放心。", "展示流程"],
    ["14-19s", "结果或客户反馈", "处理完之后，差别会很明显。", "展示结果"],
    ["19-22s", "预约方式和服务范围", "需要的话，可以先预约咨询。", "咨询 CTA"],
  ],
  service_trust: [
    ["0-4s", "接待和服务环境", "真正让人放心的服务，细节都藏在过程里。", "建立信任"],
    ["4-9s", "沟通、检查或方案确认", "每一步都会先讲清楚。", "降低顾虑"],
    ["9-15s", "服务过程细节", "专业不是说出来的，是做出来的。", "展示能力"],
    ["15-20s", "客户反馈或结果", "客户愿意再来，靠的是稳定体验。", "建立口碑"],
    ["20-24s", "门店/团队和预约信息", "想了解可以先预约。", "行动引导"],
  ],
  service_package: [
    ["0-3s", "套餐内容快速展示", "这个套餐不是所有人都需要，但这类人很适合。", "限定适用人群"],
    ["3-7s", "适合人群和问题场景", "如果你正好有这些需求，可以重点看。", "对准目标用户"],
    ["7-12s", "套餐权益和流程", "包含这些服务，预约后按流程来。", "讲清权益"],
    ["12-15s", "案例或效果反馈", "效果好不好，关键看执行细节。", "补充信任"],
    ["15-18s", "预约方式和时间", "最近有名额，可以先咨询。", "转化 CTA"],
  ],
};

const els = {
  storeChip: document.querySelector("#storeChip"),
  profilePanel: document.querySelector("#profilePanel"),
  profileForm: document.querySelector("#profileForm"),
  profileTitle: document.querySelector("#profileTitle"),
  profileSummary: document.querySelector("#profileSummary"),
  toggleProfileBtn: document.querySelector("#toggleProfileBtn"),
  saveProfileBtn: document.querySelector("#saveProfileBtn"),
  businessType: document.querySelector("#businessTypeInput"),
  storeLabel: document.querySelector("#storeLabel"),
  storeFeatureLabel: document.querySelector("#storeFeatureLabel"),
  locationLabel: document.querySelector("#locationLabel"),
  brandMessageLabel: document.querySelector("#brandMessageLabel"),
  projectBriefTitle: document.querySelector("#projectBriefTitle"),
  productLabel: document.querySelector("#productLabel"),
  productFeatureLabel: document.querySelector("#productFeatureLabel"),
  offerLabel: document.querySelector("#offerLabel"),
  timingLabel: document.querySelector("#timingLabel"),
  projectType: document.querySelector("#projectTypeInput"),
  productBrief: document.querySelector("#productBrief"),
  store: document.querySelector("#storeInput"),
  storeFeature: document.querySelector("#storeFeatureInput"),
  location: document.querySelector("#locationInput"),
  brandMessage: document.querySelector("#brandMessageInput"),
  product: document.querySelector("#productInput"),
  productFeature: document.querySelector("#productFeatureInput"),
  offer: document.querySelector("#offerInput"),
  timing: document.querySelector("#timingInput"),
  business: document.querySelector("#businessInput"),
  platform: document.querySelector("#platformInput"),
  direction: document.querySelector("#directionInput"),
  videoLength: document.querySelector("#videoLengthInput"),
  contentFormat: document.querySelector("#contentFormatInput"),
  openingStageGroup: document.querySelector("#openingStageGroup"),
  openingStage: document.querySelector("#openingStageInput"),
  audience: document.querySelector("#audienceInput"),
  style: document.querySelector("#styleInput"),
  modeBriefTitle: document.querySelector("#modeBriefTitle"),
  modeContextLabel: document.querySelector("#modeContextLabel"),
  materialRuleLabel: document.querySelector("#materialRuleLabel"),
  limitLabel: document.querySelector("#limitLabel"),
  modeContext: document.querySelector("#modeContextInput"),
  materialRule: document.querySelector("#materialRuleInput"),
  limit: document.querySelector("#limitInput"),
  modeAssetNote: document.querySelector("#modeAssetNote"),
  briefNextBtn: document.querySelector("#briefNextBtn"),
  planBtn: document.querySelector("#planBtn"),
  loadDemoBtn: document.querySelector("#loadDemoBtn"),
  chatLog: document.querySelector("#chatLog"),
  agentDock: document.querySelector("#agentDock"),
  agentStatus: document.querySelector("#agentStatus"),
  agentPrompt: document.querySelector("#agentPrompt"),
  agentToggleBtn: document.querySelector("#agentToggleBtn"),
  feedback: document.querySelector("#feedbackInput"),
  feedbackBtn: document.querySelector("#feedbackBtn"),
  themeGrid: document.querySelector("#themeGrid"),
  scriptTable: document.querySelector("#scriptTable"),
  timeline: document.querySelector("#timeline"),
  productionList: document.querySelector("#productionList"),
  assetInput: document.querySelector("#assetInput"),
  assetGrid: document.querySelector("#assetGrid"),
  assetCount: document.querySelector("#assetCount"),
  visionSummary: document.querySelector("#visionSummary"),
  recognizeAllBtn: document.querySelector("#recognizeAllBtn"),
  videoPoster: document.querySelector("#videoPoster"),
  subtitleStrip: document.querySelector("#subtitleStrip"),
  durationLabel: document.querySelector("#durationLabel"),
  renderBtn: document.querySelector("#renderBtn"),
  previewBtn: document.querySelector("#previewBtn"),
  renderVideoBtn: document.querySelector("#renderVideoBtn"),
  renderResult: document.querySelector("#renderResult"),
  saveProjectBtn: document.querySelector("#saveProjectBtn"),
  loadProjectBtn: document.querySelector("#loadProjectBtn"),
  exportBtn: document.querySelector("#exportBtn"),
};

function storeProfileFromForm() {
  return {
    businessType: els.businessType.value,
    store: els.store.value.trim(),
    storeFeature: els.storeFeature.value.trim(),
    location: els.location.value.trim(),
    brandMessage: els.brandMessage.value.trim(),
  };
}

function applyStoreProfile(profile) {
  els.businessType.value = profile.businessType || "offline";
  els.store.value = profile.store || "";
  els.storeFeature.value = profile.storeFeature || "";
  els.location.value = profile.location || "";
  els.brandMessage.value = profile.brandMessage || "";
  state.profileSaved = Boolean(profile.store);
  applyBusinessTemplate({ preserveValues: true });
  renderProfileState();
}

function saveStoreProfile({ silent = false } = {}) {
  const profile = storeProfileFromForm();
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  state.profileSaved = Boolean(profile.store);
  renderProfileState();
  els.profilePanel.classList.add("hidden");
  if (!silent) {
    addMessage("商家档案已保存。之后创建新视频时，我会自动复用这些基础信息。");
  }
}

function loadStoreProfile() {
  const saved = localStorage.getItem(PROFILE_KEY);
  if (!saved) {
    renderProfileState();
    return;
  }
  try {
    const profile = JSON.parse(saved);
    if (profile.store === "社区精品咖啡店") {
      localStorage.removeItem(PROFILE_KEY);
      renderProfileState();
      return;
    }
    applyStoreProfile(profile);
    renderProfileState();
  } catch {
    localStorage.removeItem(PROFILE_KEY);
    renderProfileState();
  }
}

function renderProfileState() {
  const profile = storeProfileFromForm();
  const template = briefTemplates[profile.businessType] || briefTemplates.offline;
  if (!state.profileSaved) {
    els.storeChip.textContent = `未保存${template.chipPrefix}档案`;
    els.profileSummary.textContent = `${template.profileTitle}只需要填写一次，后续视频项目会自动复用。`;
    els.toggleProfileBtn.textContent = "关闭档案";
    return;
  }
  els.storeChip.textContent = profile.store || `已保存${template.chipPrefix}档案`;
  els.profileSummary.textContent = `${profile.store || "店铺"} · ${profile.storeFeature || "待补充特色"} · ${profile.location || "待补充位置"}`;
  els.toggleProfileBtn.textContent = "关闭档案";
}

function setSelectOptions(select, options, selectedValue) {
  select.innerHTML = "";
  options.forEach((item) => {
    const option = document.createElement("option");
    if (Array.isArray(item)) {
      option.value = item[0];
      option.textContent = item[1];
    } else {
      option.value = item;
      option.textContent = item;
    }
    select.appendChild(option);
  });
  if (selectedValue && Array.from(select.options).some((option) => option.value === selectedValue)) {
    select.value = selectedValue;
  }
}

function briefTextBundle(brief) {
  return [brief.direction, brief.product, brief.productFeature, brief.timing, brief.offer, brief.brandMessage]
    .filter(Boolean)
    .join(" ");
}

function briefMentionsOpening(brief) {
  return /开业|开幕|新店|试营业|开张|开张大吉|酬宾|剪彩|即将开业/.test(briefTextBundle(brief));
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
  if (brief.openingStage && brief.openingStage !== "auto") return brief.openingStage;
  return detectOpeningStage(brief) || "opening";
}

function syncOpeningStageVisibility() {
  const preview = {
    direction: els.direction.value,
    product: els.product?.value || "",
    timing: els.timing?.value || "",
  };
  els.openingStageGroup.classList.toggle("hidden", !briefMentionsOpening(preview));
}

function deriveGoal({ projectType, businessType, direction = "", product = "", timing = "" }) {
  const promoText = `${direction}${product}${timing}`;
  if (/开业前|即将开业|开业前夕|预热|筹备/.test(promoText)) return "开业预热";
  if (/开业|开幕|新店|试营业|开张|开张大吉/.test(promoText)) return "开业宣传";
  if (/周年|店庆|庆典/.test(promoText)) return "周年庆典";
  if (/优惠|满减|活动|大促/.test(promoText) && !/促销/.test(promoText)) return "活动宣传";

  if (projectType === "store") {
    return (
      { offline: "到店引流", ecommerce: "品牌曝光", service: "预约咨询", brand: "品牌曝光" }[businessType] ||
      "品牌曝光"
    );
  }
  if (projectType === "product") {
    return (
      { offline: "产品种草", ecommerce: "商品种草", service: "服务种草", brand: "产品种草" }[businessType] ||
      "产品种草"
    );
  }
  return (
    { offline: "活动促销", ecommerce: "商品种草", service: "套餐促销", brand: "产品种草" }[businessType] || "产品种草"
  );
}

function projectTypeLabel(projectType, businessType = els.businessType.value) {
  const template = briefTemplates[businessType] || briefTemplates.offline;
  const match = template.projectTypes.find(([value]) => value === projectType);
  return match ? match[1] : projectType;
}

function applyBusinessTemplate({ preserveValues = false } = {}) {
  const template = briefTemplates[els.businessType.value] || briefTemplates.offline;
  const previousProjectType = els.projectType.value;

  els.storeLabel.textContent = template.labels[0];
  els.profileTitle.textContent = template.profileTitle;
  els.storeFeatureLabel.textContent = template.labels[1];
  els.locationLabel.textContent = template.labels[2];
  els.brandMessageLabel.textContent = template.labels[3];
  els.projectBriefTitle.textContent = template.projectTitle;
  els.productLabel.textContent = template.projectLabels[0];
  els.productFeatureLabel.textContent = template.projectLabels[1];
  els.offerLabel.textContent = template.projectLabels[2];
  els.timingLabel.textContent = template.projectLabels[3];

  setSelectOptions(els.projectType, template.projectTypes, preserveValues ? previousProjectType : template.projectTypes[0][0]);

  els.agentPrompt.textContent = template.prompt;
  updateBriefMode();
  renderProfileState();
}

function addMessage(text, type = "agent") {
  const node = document.createElement("div");
  node.className = `message ${type}`;
  node.textContent = text;
  els.chatLog.appendChild(node);
  els.chatLog.scrollTop = els.chatLog.scrollHeight;
}

function setAgentMinimized(isMinimized) {
  els.agentDock.classList.toggle("agent-minimized", isMinimized);
  els.agentToggleBtn.textContent = isMinimized ? "⌃" : "⌄";
  els.agentToggleBtn.title = isMinimized ? "展开 Agent" : "收起 Agent";
  els.agentToggleBtn.setAttribute("aria-expanded", String(!isMinimized));
}

function includesProductInBrief(projectType = els.projectType.value) {
  return projectType === "store_product" || projectType === "product";
}

function buildCampaignCore(brief) {
  const parts = [];
  if (brief.direction) parts.push(`核心诉求：${brief.direction}`);
  if (brief.product) parts.push(`活动/产品：${brief.product}`);
  if (brief.productFeature) parts.push(`卖点：${brief.productFeature}`);
  if (brief.timing) parts.push(`时间：${brief.timing}`);
  if (brief.offer) parts.push(`权益：${brief.offer}`);
  if (brief.audience) parts.push(`目标用户：${brief.audience}`);
  return parts.join("；");
}

function currentBrief() {
  const projectType = els.projectType.value;
  const profile = storeProfileFromForm();
  const direction = els.direction.value.trim();
  const brief = {
    creationMode: state.creationMode,
    projectType,
    ...profile,
    platform: els.platform.value,
    direction,
    videoLength: els.videoLength.value,
    videoLengthLabel: videoLengthCopy[els.videoLength.value]?.label || "30 秒左右",
    contentFormat: els.contentFormat.value,
    contentFormatLabel: contentFormatCopy[els.contentFormat.value] || "让 AI 按目标判断",
    audience: els.audience.value.trim(),
    style: els.style.value,
    routeContext: els.modeContext.value.trim(),
    materialRule: els.materialRule.value.trim(),
    limit: els.limit.value.trim(),
  };

  if (includesProductInBrief(brief.projectType)) {
    brief.product = els.product.value.trim();
    brief.productFeature = els.productFeature.value.trim();
    brief.offer = els.offer.value.trim();
    brief.timing = els.timing.value.trim();
  }

  brief.goal = deriveGoal({
    projectType,
    businessType: profile.businessType,
    direction,
    product: brief.product || "",
    timing: brief.timing || "",
  });
  brief.campaignCore = buildCampaignCore(brief);
  brief.openingStage = els.openingStage?.value || "auto";
  if (briefMentionsOpening(brief)) {
    brief.openingStageResolved = resolveOpeningStage(brief);
  }

  return brief;
}

function clearProductFields() {
  els.product.value = "";
  els.productFeature.value = "";
  els.offer.value = "";
  els.timing.value = "";
}

const openingScriptPresetsPre = {
  pre_intro: [
    ["0-3s", "门头/场馆外观、招牌", "附近这家新店快开业了，先认识一下它是谁。", "主体亮相"],
    ["3-7s", "场地/空间空镜、灯光", "正式见面前，可以先看场地和环境。", "建立认知"],
    ["7-12s", "服务品类/业务范围字幕", "开业后主要提供这些服务（列大类即可）。", "说明能提供什么"],
    ["12-16s", "团队筹备合影或整理场地", "这是即将见面的团队和服务准备。", "建立信任"],
    ["16-20s", "地址、路线、开业时间字幕", "地址和开业时间在这里，欢迎收藏。", "开幕邀请"],
  ],
  pre_location: [
    ["0-3s", "街区/地标与门头", "这家店开在这个位置，附近很好找。", "位置亮相"],
    ["3-7s", "入口、动线、停车或地铁提示", "从这边走最方便。", "降低找店成本"],
    ["7-11s", "场地外观或接待区", "正式开业前，场地已经准备好了。", "空间预期"],
    ["11-15s", "服务范畴字幕", "开业后可以在这里体验这些服务。", "说明业务"],
    ["15-18s", "开幕时间与收藏提示", "开业时间记一下，到时候来看看。", "邀请"],
  ],
};

const openingScriptPresets = {
  opening_welcome: [
    ["0-3s", "门头开业布置、招牌特写", "这家店开业了，第一批来的人是这样看的。", "开业记录"],
    ["3-8s", "店内全景、灯光、座位/陈列", "新开业的店，环境和服务都还在「第一印象」阶段。", "建立印象"],
    ["8-13s", "产品/服务准备、店员接待", "开业期间来店，能体验到这些安排。", "给出理由"],
    ["13-17s", "细节特写", "附近如果还没来过，可以趁开业来试试。", "扩大受众"],
    ["17-20s", "地址、营业时间、收藏提示", "地址和营业时间在这里，欢迎来看看。", "行动引导"],
  ],
  opening_gift: [
    ["0-2s", "开业礼遇说明字幕", "开业期间来店，有这些见面礼可以了解。", "温和开场"],
    ["2-6s", "招牌产品/服务特写", "开业礼遇主要围绕这几项体验。", "讲清内容"],
    ["6-10s", "店内体验过程", "适合第一次来的人先了解。", "降低门槛"],
    ["10-14s", "店员接待", "有问题可以直接问店里。", "建立信任"],
    ["14-18s", "地址与收藏 CTA", "地址在这里，欢迎收藏。", "行动引导"],
  ],
};

function scriptPresetForFallback(brief, themeId) {
  if (scriptPresets[themeId]) return scriptPresets[themeId];
  if (openingScriptPresetsPre[themeId]) return openingScriptPresetsPre[themeId];
  if (openingScriptPresets[themeId]) return openingScriptPresets[themeId];
  if (briefMentionsOpening(brief)) {
    return resolveOpeningStage(brief) === "pre_opening"
      ? openingScriptPresetsPre.pre_intro
      : openingScriptPresets.opening_welcome;
  }

  const { businessType, projectType } = brief;
  if (projectType === "store") {
    if (businessType === "service") return scriptPresets.service_trust;
    if (businessType === "ecommerce") return scriptPresets.store_vibe;
    return scriptPresets.store_vibe;
  }
  if (businessType === "ecommerce") return scriptPresets.ecom_seed;
  if (businessType === "service") return scriptPresets.service_problem;
  if (businessType === "brand") return scriptPresets.ecom_seed;
  return scriptPresets.store_vibe;
}

function currentTheme() {
  return state.themes.find((item) => item.id === state.selectedThemeId) || null;
}

function setCreationMode(mode) {
  if (!creationModeCopy[mode]) return;
  const previousMode = state.creationMode;
  state.creationMode = mode;
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });
  const copy = creationModeCopy[mode];
  els.agentPrompt.textContent = copy.prompt;
  els.modeBriefTitle.textContent = copy.briefTitle;
  els.modeContextLabel.textContent = copy.fields[0];
  els.materialRuleLabel.textContent = copy.fields[1];
  els.limitLabel.textContent = copy.fields[2];
  els.modeContext.placeholder = copy.defaults[0];
  els.materialRule.placeholder = copy.defaults[1];
  els.limit.placeholder = copy.defaults[2];
  if (previousMode !== mode) {
    els.modeContext.value = "";
    els.materialRule.value = "";
    els.limit.value = "";
  }
  els.modeAssetNote.textContent = copy.assetNote;
  els.planBtn.textContent = copy.planButton;
  els.briefNextBtn.textContent = copy.nextButton;
  const assetHeading = document.querySelector("#assetsStep h2");
  const assetHelp = document.querySelector("#assetsStep .step-heading p:not(.eyebrow)");
  const strategyHeading = document.querySelector("#strategyStep h2");
  const strategyHelp = document.querySelector("#strategyStep .step-heading p:not(.eyebrow)");
  const scriptHeading = document.querySelector("#scriptStep h2");
  const scriptHelp = document.querySelector("#scriptStep .step-heading p:not(.eyebrow)");
  if (assetHeading) assetHeading.textContent = copy.assetTitle;
  if (assetHelp) assetHelp.textContent = copy.assetHelp;
  if (strategyHeading) strategyHeading.textContent = copy.strategyTitle;
  if (strategyHelp) strategyHelp.textContent = copy.strategyHelp;
  if (scriptHeading) scriptHeading.textContent = copy.scriptTitle;
  if (scriptHelp) scriptHelp.textContent = copy.scriptHelp;
  document.querySelector('[data-step="assets"] strong').textContent = mode === "planning" ? "拍摄" : "素材";
  if (state.script.length) renderScript();
}

function updateBriefMode() {
  const projectType = els.projectType.value;
  const isStoreOnly = projectType === "store";
  const isProductOnly = projectType === "product";
  const showProductBrief = includesProductInBrief(projectType);

  els.productBrief.classList.toggle("hidden", !showProductBrief);

  if (isStoreOnly) {
    clearProductFields();
    els.agentPrompt.textContent = "这次按「只做店铺宣传」来设计。我会重点看空间、位置、用户场景和店铺记忆点，不会编造具体产品或活动。";
  } else if (isProductOnly) {
    els.agentPrompt.textContent = "这次按「只做产品种草」来设计。我会围绕你填写的产品/服务信息写选题方向和脚本，店铺信息只作背景。";
  } else {
    const template = briefTemplates[els.businessType.value] || briefTemplates.offline;
    els.agentPrompt.textContent = template.prompt;
  }
}

function setStep(step) {
  state.step = step;
  setAgentMinimized(true);
  document.querySelectorAll(".step-view").forEach((view) => {
    view.classList.toggle("hidden", view.id !== `${step}Step`);
  });

  const activeIndex = stepOrder.indexOf(step);
  document.querySelectorAll(".step-item").forEach((item) => {
    const index = stepOrder.indexOf(item.dataset.step);
    item.classList.toggle("active", item.dataset.step === step);
    item.classList.toggle("done", index < activeIndex);
  });

  updateAgentPrompt();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateAgentPrompt() {
  const labels = {
    brief: "正在看背景",
    assets: "正在看素材",
    strategy: "正在做策划",
    script: "正在当编导",
    production: "正在整理执行清单",
    preview: "正在准备成片",
  };
  const theme = state.themes.find((item) => item.id === state.selectedThemeId);
  const prompts = {
    brief: state.profileSaved
      ? creationModeCopy[state.creationMode].prompt
      : "先把店铺档案保存下来。之后每次做视频，我都会读取这部分信息，不需要你反复填写。",
    assets: "有素材就上传，没有也可以直接继续。我会根据本次工作方式，决定是做剪辑结构还是补拍建议。",
    strategy: "我给了 3 个选题方向。你选一个最像你想发出去的视频方案，我再继续写脚本。",
    script: theme
      ? `现在围绕选题《${theme.title}》改脚本。主页面保留最终版本，你可以在这里告诉我“更高级”“更快”“突出优惠”。`
      : "先选一个选题方向，我再开始写分镜脚本。",
    production: "我把脚本拆成了执行清单。这里适合检查：哪些用现有素材，哪些需要补拍，剪辑时先后怎么排。",
    preview: theme
      ? `这是选题《${theme.title}》的成片结构预览。确认后可以导出方案，后续会在这里接真实剪辑。`
      : "生成预览前需要先确认选题和脚本。",
  };
  els.agentStatus.textContent = labels[state.step];
  els.agentPrompt.textContent = prompts[state.step];
}

function personalizeThemes(themes, brief) {
  const storeName = brief.store || "店铺";
  const focus = brief.direction || brief.product || "宣传";
  const length = videoLengthCopy[brief.videoLength] || videoLengthCopy["30s"];
  const fallbackDuration = { "15s": 15, "30s": 30, "1min": 60, "3min_plus": 180 }[brief.videoLength] || 30;
  return themes.map((theme) => ({
    ...theme,
    title: theme.title.replace(/这家店|门店|店铺/g, storeName),
    contentGoal: theme.contentGoal || theme.promise || `让用户知道${storeName}这次${focus}的关键信息。`,
    strategy: theme.strategy || "认知型",
    promise: theme.promise
      .replace(/新品|产品/g, brief.product || focus)
      .replace(/店铺|门店|这家店/g, storeName),
    hook: theme.hook.replace(/店铺|门店|这家店/g, storeName),
    storyline: theme.storyline || ["亮出商家主体", "说明关键信息", "展示可拍画面", "引导收藏/咨询"],
    mustInclude: theme.mustInclude || [storeName, brief.location || "位置/渠道", focus],
    avoid: theme.avoid || ["偏离本次宣传目的", "编造未提供素材或事实"],
    materialFit: theme.materialFit || "适合按当前素材和拍摄条件执行。",
    duration: fallbackDuration,
    rhythm: `${theme.rhythm || "短视频结构"} · ${length.durationLabel}`,
    cta: theme.cta || "收藏/关注，等待后续信息。",
    reason: `围绕「${focus}」给 ${storeName} 做传播。`,
  }));
}

function localThemesForBrief(brief) {
  if (briefMentionsOpening(brief)) {
    const stage = resolveOpeningStage(brief);
    const themes = stage === "pre_opening" ? openingThemesPre : openingThemes;
    return personalizeThemes(themes, brief);
  }

  let sourceThemes;
  if (brief.projectType === "store") {
    sourceThemes = storeThemes;
  } else if (brief.businessType === "service") {
    sourceThemes = serviceThemes;
  } else if (brief.businessType === "ecommerce" || brief.businessType === "brand") {
    sourceThemes = ecommerceThemes;
  } else {
    sourceThemes = brief.projectType === "product" ? ecommerceThemes : demoThemes;
  }

  return personalizeThemes(sourceThemes, brief);
}

async function apiRequest(path, payload) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "AI 请求失败，请稍后重试。");
  }
  return data;
}

function formatBytes(bytes = 0) {
  if (!bytes) return "未知大小";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function assetFileExtension(name = "") {
  return name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] || "";
}

function isAllowedAssetFile(file) {
  if (ALLOWED_ASSET_TYPES.has(file.type)) return true;
  return [".png", ".jpg", ".jpeg", ".webp", ".gif", ".mp4", ".mov", ".webm", ".m4v"].includes(assetFileExtension(file.name));
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return "";
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}m${String(rest).padStart(2, "0")}s`;
}

function mediaKind(asset) {
  if (asset.type?.startsWith("image")) return "image";
  if (asset.type?.startsWith("video")) return "video";
  return "file";
}

function orientationLabel(width, height) {
  if (!width || !height) return "待分析";
  if (height > width) return "竖版";
  if (width > height) return "横版";
  return "方形";
}

function assetSummary(asset) {
  const size = asset.width && asset.height ? `${asset.width}x${asset.height}` : "尺寸待识别";
  const duration = asset.duration ? ` · ${formatDuration(asset.duration)}` : "";
  return `${orientationLabel(asset.width, asset.height)} · ${size}${duration} · ${formatBytes(asset.size)}`;
}

function assetStatus(asset) {
  if (asset.recognition?.status === "running") {
    return { label: "识别中", className: "pending" };
  }
  if (asset.recognition?.status === "failed") {
    return { label: "识别失败", className: "failed" };
  }
  if (asset.recognition?.status === "video_pending") {
    return { label: "待抽帧", className: "saved" };
  }
  if (asset.profile?.source === "vision_model") {
    return { label: "视觉已识别", className: "ready" };
  }
  if (asset.profile || asset.analysisStatus === "client_analyzed" || asset.width || asset.height || asset.duration) {
    return { label: "已生成画像", className: "ready" };
  }
  if (asset.analysisStatus === "basic_saved") {
    return { label: "已保存", className: "saved" };
  }
  return { label: "待识别", className: "pending" };
}

function assetUseHints(asset) {
  const tags = new Set(assetProfileTags(asset));
  const hints = [];
  if (tags.has("门头/外观")) hints.push("适合开头亮相");
  if (tags.has("环境/空间")) hints.push("适合氛围铺垫");
  if (tags.has("产品/服务") || tags.has("产品")) hints.push("适合卖点展示");
  if (tags.has("信息/海报") || tags.has("信息图")) hints.push("适合权益说明");
  if (tags.has("人物/过程")) hints.push("适合过程展示");
  if (tags.has("少儿/儿童")) hints.push("适合亲子/少儿场景");
  if (tags.has("教学/培训")) hints.push("适合专业介绍");
  if (mediaKind(asset) === "video") hints.push("适合动态镜头");
  if (asset.width && asset.height && asset.height >= asset.width) hints.push("竖版优先");
  if (!hints.length) hints.push("等待脚本匹配");
  return Array.from(new Set(hints)).slice(0, 3);
}

function assetScriptMatches(asset) {
  if (!state.script.length) return [];
  refreshEditPlan();
  return state.editPlan
    .filter((item) => item.assetId === asset.id)
    .map((item) => `镜头 ${item.id}`);
}

function assetMatchLabel(asset) {
  const matches = assetScriptMatches(asset);
  if (!state.script.length) return "生成脚本后可匹配";
  if (!matches.length) return "暂未匹配脚本段";
  return `已匹配 ${matches.join("、")}`;
}

function buildAssetTags(asset) {
  const profile = buildLocalAssetProfile(asset);
  const tags = new Set([...(asset.tags || []), ...profile.labels]);
  if (asset.width && asset.height) tags.add(orientationLabel(asset.width, asset.height));
  if (asset.duration) tags.add(asset.duration <= 4 ? "短片段" : "长片段");
  return Array.from(tags).filter(Boolean).slice(0, 8);
}

function analyzeUploadedAsset(asset) {
  return new Promise((resolve) => {
    const kind = mediaKind(asset);
    const done = (extra = {}) => {
      const base = { ...asset, ...extra };
      const profile = buildLocalAssetProfile(base);
      const enriched = {
        ...base,
        profile,
        tags: buildAssetTags({ ...base, profile }),
        analysisStatus: "profiled_basic",
      };
      resolve(enriched);
    };

    if (kind === "image") {
      const image = new Image();
      image.onload = () => done({ width: image.naturalWidth, height: image.naturalHeight, analysisStatus: "client_analyzed" });
      image.onerror = () => done();
      image.src = asset.url;
      return;
    }

    if (kind === "video") {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.onloadedmetadata = () =>
        done({
          width: video.videoWidth,
          height: video.videoHeight,
          duration: Number.isFinite(video.duration) ? video.duration : null,
          hasAudio: true,
          analysisStatus: "client_analyzed",
        });
      video.onerror = () => done();
      video.src = asset.url;
      return;
    }

    done();
  });
}

async function enrichAssetWithVisionProfile(asset) {
  const profiled = await analyzeUploadedAsset(asset);
  try {
    const data = await apiRequest("/api/assets/vision-profile", { asset: profiled });
    const visionProfile = data.profile;
    const enriched = {
      ...profiled,
      profile: {
        ...profiled.profile,
        ...visionProfile,
        labels: Array.from(new Set([...(profiled.profile?.labels || []), ...(visionProfile.labels || [])])).slice(0, 16),
        signals: Array.from(new Set([...(visionProfile.signals || []), ...(profiled.profile?.signals || [])])).slice(0, 10),
      },
      analysisStatus: "vision_profiled",
    };
    enriched.tags = buildAssetTags(enriched);
    return {
      asset: withRecognitionState(enriched, {
        status: "done",
        stage: mediaKind(profiled) === "video" ? "已抽取视频关键帧并完成火山视觉识别" : "火山视觉识别完成",
      }),
      visionStatus: "ok",
    };
  } catch (error) {
    return {
      asset: withRecognitionState(profiled, {
        status: "failed",
        stage: "已回退本地基础画像",
        error: error.message,
      }),
      visionStatus: "failed",
      error,
    };
  }
}

function withRecognitionState(asset, statePatch = {}) {
  return {
    ...asset,
    recognition: {
      status: "local",
      stage: "已生成本地基础画像",
      updatedAt: new Date().toISOString(),
      ...(asset.recognition || {}),
      ...statePatch,
    },
  };
}

async function runVisionRecognitionForAsset(assetId, { force = false } = {}) {
  const index = state.assets.findIndex((asset) => asset.id === assetId);
  if (index === -1) return { status: "missing" };

  const current = state.assets[index];
  if (!force && current.profile?.source === "vision_model") {
    return { status: "already_done" };
  }
  state.assets[index] = withRecognitionState(current, {
    status: "running",
    stage: mediaKind(current) === "video" ? "正在抽取视频关键帧并调用火山视觉模型" : "正在调用火山视觉模型识别画面内容",
    error: "",
  });
  renderAssets();

  const result = await enrichAssetWithVisionProfile(current);
  state.assets[index] = result.asset;
  renderAssets();
  renderScript();
  renderTimeline();
  renderProductionList();
  updatePreview();
  return { status: result.visionStatus, error: result.error };
}

async function recognizeAllAssets({ force = false } = {}) {
  if (!state.assets.length) {
    addMessage("还没有素材可以识别，请先上传图片或视频。");
    return;
  }

  els.recognizeAllBtn.disabled = true;
  addMessage(`开始识别素材库：图片直接识别，视频会先抽关键帧再识别。`);
  const summary = { ok: 0, failed: 0, alreadyDone: 0 };

  for (const asset of [...state.assets]) {
    const result = await runVisionRecognitionForAsset(asset.id, { force });
    if (result.status === "ok") summary.ok += 1;
    if (result.status === "failed") summary.failed += 1;
    if (result.status === "already_done") summary.alreadyDone += 1;
  }

  els.recognizeAllBtn.disabled = false;
  addMessage(`素材识别完成：${summary.ok} 个视觉识别成功，${summary.failed} 个失败，${summary.alreadyDone} 个已识别。`);
}

function buildLocalAssetProfile(asset) {
  const kind = mediaKind(asset);
  const text = assetProfileText(asset);
  const labels = new Set(asset.profile?.labels || []);
  const signals = [];
  const addLabel = (label, signal) => {
    labels.add(label);
    if (signal) signals.push(signal);
  };

  const rules = [
    { pattern: /门头|招牌|外观|入口|门脸|店面|front|sign/i, labels: ["门头/外观"], signal: "文件名或标签疑似门头/外观" },
    { pattern: /环境|空间|店内|室内|大厅|前台|休息区|装修|灯光|场馆|场地|球场|网球场|court|venue/i, labels: ["环境/空间"], signal: "文件名或标签疑似环境/空间" },
    { pattern: /网球|球拍|球网|运动|训练场|tennis/i, labels: ["环境/空间", "运动场景"], signal: "文件名或标签疑似网球/运动场景" },
    { pattern: /少儿|儿童|孩子|小孩|亲子|学生|青少年|kid|child/i, labels: ["少儿/儿童", "人物/过程"], signal: "文件名或标签疑似少儿/儿童" },
    { pattern: /教练|教学|培训|课程|上课|训练|指导|课堂|coach|class|training/i, labels: ["教学/培训", "人物/过程"], signal: "文件名或标签疑似教学/训练过程" },
    { pattern: /人物|团队|店员|老师|服务|接待|操作|制作|过程|people|staff/i, labels: ["人物/过程"], signal: "文件名或标签疑似人物/过程" },
    { pattern: /产品|商品|服务|套餐|课程包|饮品|餐品|包装|product|service/i, labels: ["产品/服务"], signal: "文件名或标签疑似产品/服务" },
    { pattern: /海报|价格|优惠|权益|活动|地址|路线|时间|二维码|预约|咨询|poster|price|offer/i, labels: ["信息/海报"], signal: "文件名或标签疑似信息/海报" },
  ];

  rules.forEach((rule) => {
    if (rule.pattern.test(text)) {
      rule.labels.forEach((label) => addLabel(label, rule.signal));
    }
  });

  if (kind === "image") addLabel("图片素材");
  if (kind === "video") addLabel("视频素材");
  if (asset.width && asset.height) {
    addLabel(orientationLabel(asset.width, asset.height));
    if (asset.height >= asset.width) addLabel("竖版友好");
    if (asset.width > asset.height) addLabel("需要竖版裁切");
  }
  if (asset.duration) {
    addLabel(asset.duration <= 4 ? "短片段" : "长片段");
  }

  const quality = inferAssetQuality(asset);
  const confidence = inferProfileConfidence({ asset, labels: Array.from(labels), signals });
  return {
    version: ASSET_PROFILE_VERSION,
    source: asset.profile?.source || "local_basic",
    confidence,
    labels: Array.from(labels).filter(Boolean).slice(0, 12),
    signals: Array.from(new Set(signals)).slice(0, 5),
    mediaKind: kind,
    orientation: orientationLabel(asset.width, asset.height),
    quality,
    summary: buildAssetProfileSummary({ asset, labels, confidence, quality }),
    modelReady: true,
  };
}

function assetProfileText(asset) {
  return [asset.name, ...(asset.tags || []), ...(asset.profile?.labels || []), ...(asset.profile?.summary ? [asset.profile.summary] : [])]
    .filter(Boolean)
    .join(" ");
}

function assetProfileTags(asset) {
  const profile = asset.profile || buildLocalAssetProfile(asset);
  return Array.from(new Set([...(asset.tags || []), ...(profile.labels || [])])).filter(Boolean);
}

function inferAssetQuality(asset) {
  if (!asset.width || !asset.height) return "待确认";
  const pixels = asset.width * asset.height;
  if (pixels >= 1080 * 1600) return "清晰度较好";
  if (pixels >= 720 * 1000) return "清晰度可用";
  return "尺寸偏小";
}

function inferProfileConfidence({ asset, labels, signals }) {
  let confidence = 35;
  if (asset.width && asset.height) confidence += 15;
  if (asset.duration) confidence += 8;
  confidence += Math.min(32, signals.length * 12);
  confidence += Math.min(10, labels.length * 2);
  return Math.max(30, Math.min(92, confidence));
}

function buildAssetProfileSummary({ asset, labels, confidence, quality }) {
  const coreLabels = Array.from(labels).filter((label) => !["图片素材", "视频素材", "竖版友好", "需要竖版裁切", "短片段", "长片段"].includes(label)).slice(0, 3);
  const labelCopy = coreLabels.length ? coreLabels.join(" / ") : "内容待人工确认";
  return `${mediaKind(asset) === "video" ? "视频" : "图片"} · ${labelCopy} · ${quality} · 置信度 ${confidence}%`;
}

function parseShotRange(time = "", index = 0) {
  const match = String(time).match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (!match) {
    return { start: index * 3, end: (index + 1) * 3, duration: 3 };
  }
  const start = Number(match[1]);
  const end = Number(match[2]);
  return { start, end, duration: Math.max(1, end - start) };
}

function inferAssetNeedFromShot(shot) {
  return inferShotAssetProfile(shot).all;
}

function inferShotAssetProfile(shot) {
  const text = [shot.visual, shot.subtitle, shot.intent].filter(Boolean).join(" ");
  const primary = [];
  const rules = [
    [/门头|招牌|外观|街区|入口|路线|地址/, "门头/外观"],
    [/环境|空间|店内|座位|灯光|装修|场地|场馆|球场|网球场|全景/, "环境/空间"],
    [/少儿|儿童|孩子|小孩|学生|青少年|亲子/, "少儿/儿童"],
    [/教练|教学|培训|课程|上课|训练|指导/, "教学/培训"],
    [/产品|商品|饮品|咖啡|餐品|套餐|包装|特写|服务品类|课程包/, "产品/服务"],
    [/价格|优惠|权益|活动|时间|海报|字幕|CTA|预约|咨询/, "信息/海报"],
    [/店员|团队|主理人|服务|接待|操作|制作/, "人物/过程"],
  ];
  rules.forEach(([pattern, tag]) => {
    if (pattern.test(text)) primary.push(tag);
  });
  const uniquePrimary = Array.from(new Set(primary));
  const alternatives = Array.from(new Set(uniquePrimary.flatMap(alternativeNeedsFor)));
  const all = uniquePrimary.length ? Array.from(new Set([...uniquePrimary, ...alternatives])) : ["可用素材"];
  return {
    primary: uniquePrimary.length ? uniquePrimary : ["可用素材"],
    alternatives,
    all,
  };
}

function alternativeNeedsFor(need) {
  const alternatives = {
    "门头/外观": ["环境/空间", "信息/海报"],
    "环境/空间": ["运动场景", "门头/外观"],
    "少儿/儿童": ["人物/过程", "教学/培训"],
    "教学/培训": ["人物/过程", "运动场景", "少儿/儿童"],
    "产品/服务": ["信息/海报", "教学/培训"],
    "信息/海报": ["产品/服务", "门头/外观"],
    "人物/过程": ["教学/培训", "少儿/儿童"],
  };
  return alternatives[need] || [];
}

function fallbackForShot(shot) {
  const needs = inferAssetNeedFromShot(shot);
  if (needs.includes("信息/海报")) return "没有对应画面时，用品牌底图或纯色信息卡承接字幕。";
  if (needs.includes("门头/外观")) return "没有门头素材时，用店名字幕卡加环境或产品画面替代。";
  if (needs.includes("产品/服务")) return "没有产品特写时，用现有主体素材局部裁切并强化字幕卖点。";
  return "没有匹配素材时，用最接近的清晰素材加字幕说明。";
}

function ensureShotMetadata(shot) {
  const needProfile = inferShotAssetProfile(shot);
  shot.assetNeedProfile = needProfile;
  shot.assetNeed = needProfile.all;
  if (!shot.fallback) shot.fallback = fallbackForShot(shot);
  if (!shot.priority) shot.priority = shot.id === 1 ? "must" : "normal";
  return shot;
}

function normalizeNeedProfile(needs = []) {
  if (!Array.isArray(needs) && typeof needs === "object") {
    const primary = needs.primary?.length ? needs.primary : [];
    const alternatives = needs.alternatives?.length ? needs.alternatives : [];
    return {
      primary,
      alternatives,
      all: needs.all?.length ? needs.all : Array.from(new Set([...primary, ...alternatives])),
    };
  }
  return {
    primary: needs.filter((need) => need !== "可用素材"),
    alternatives: [],
    all: needs,
  };
}

function assetMatchScore(asset, needs = []) {
  const needProfile = normalizeNeedProfile(needs);
  const tags = new Set(assetProfileTags(asset));
  const profile = asset.profile || buildLocalAssetProfile(asset);
  const normalizedNeeds = needProfile.all.filter((need) => need !== "可用素材");
  let score = normalizedNeeds.length ? 0 : 12;

  needProfile.primary.forEach((need) => {
    if (need === "可用素材") return;
    if (tags.has(need)) score += 48;
    else if (isCompatibleAssetNeed(need, tags)) score += 24;
  });
  needProfile.alternatives.forEach((need) => {
    if (tags.has(need)) score += 18;
  });

  if (mediaKind(asset) === "video") score += 10;
  if (asset.width && asset.height && asset.height >= asset.width) score += 12;
  if (asset.width && asset.height && asset.width > asset.height) score -= 6;
  if (profile.quality === "清晰度较好") score += 8;
  if (profile.quality === "清晰度可用") score += 4;
  if (profile.quality === "尺寸偏小") score -= 10;
  if (profile.confidence >= 75) score += 8;
  if (profile.confidence < 45) score -= 8;

  return Math.max(0, score);
}

function isCompatibleAssetNeed(need, tags) {
  const compatible = {
    "环境/空间": ["运动场景", "竖版友好"],
    "人物/过程": ["教学/培训", "少儿/儿童"],
    "教学/培训": ["人物/过程", "少儿/儿童", "运动场景"],
    "少儿/儿童": ["人物/过程", "教学/培训"],
    "产品/服务": ["信息/海报", "教学/培训"],
    "信息/海报": ["产品/服务"],
    "门头/外观": ["环境/空间"],
  };
  return (compatible[need] || []).some((tag) => tags.has(tag));
}

function assetMatchReasons(asset, needs = []) {
  const needProfile = normalizeNeedProfile(needs);
  const tags = new Set(assetProfileTags(asset));
  const profile = asset.profile || buildLocalAssetProfile(asset);
  const reasons = [];
  needProfile.primary.forEach((need) => {
    if (need === "可用素材") return;
    if (tags.has(need)) reasons.push(`主需求命中 ${need}`);
    else if (isCompatibleAssetNeed(need, tags)) reasons.push(`主需求 ${need} 有可替代标签`);
  });
  needProfile.alternatives.forEach((need) => {
    if (tags.has(need)) reasons.push(`替代需求命中 ${need}`);
  });
  if (mediaKind(asset) === "video") reasons.push("视频素材");
  if (asset.width && asset.height && asset.height >= asset.width) reasons.push("竖版友好");
  if (asset.width && asset.height && asset.width > asset.height) reasons.push("需竖版裁切");
  if (profile.quality && profile.quality !== "待确认") reasons.push(profile.quality);
  if (profile.confidence) reasons.push(`识别置信度 ${profile.confidence}%`);
  return Array.from(new Set(reasons));
}

function assetMatchDetail(asset, needs = []) {
  const needProfile = normalizeNeedProfile(needs);
  if (!asset) {
    return {
      matched: [],
      compatible: [],
      missing: needProfile.primary.filter((need) => need !== "可用素材"),
      reason: "还没有可用素材，先用字幕卡或补充上传素材。",
    };
  }

  const tags = new Set(assetProfileTags(asset));
  const score = assetMatchScore(asset, needProfile);
  const matched = needProfile.primary.filter((need) => tags.has(need));
  const compatible = needProfile.primary.filter((need) => need !== "可用素材" && !tags.has(need) && isCompatibleAssetNeed(need, tags));
  const missing = needProfile.primary.filter((need) => need !== "可用素材" && !tags.has(need) && !compatible.includes(need));
  const reasonParts = assetMatchReasons(asset, needs);
  return {
    matched,
    compatible,
    missing,
    score,
    reason: reasonParts.length ? `评分 ${score}：${reasonParts.join("；")}` : `评分 ${score}：没有命中明确画像，只作为低置信候选。`,
  };
}

function shotBindingStatus(shot, asset) {
  if (shot.assetMode === "subtitle_card") return { label: "字幕卡", className: "card" };
  if (shot.assetId && asset) return { label: "手动绑定", className: "manual" };
  if (asset) return { label: "自动推荐", className: "auto" };
  return { label: "缺素材", className: "missing" };
}

function subtitleCardVisualForShot(shot) {
  const needs = shot.assetNeed || inferAssetNeedFromShot(shot);
  if (needs.includes("门头/外观")) return "字幕卡：店名/主体信息 + 地址或开业时间，作为门头素材缺失时的开场画面。";
  if (needs.includes("信息/海报")) return "字幕卡：活动权益/时间/行动入口，用文字信息替代海报素材。";
  if (needs.includes("产品/服务")) return "字幕卡：产品/服务名称 + 核心卖点，用信息卡承接卖点说明。";
  return "字幕卡：用品牌底图和大字标题承接这一段关键信息。";
}

function applySubtitleCardToShot(shot) {
  shot.assetMode = "subtitle_card";
  shot.assetId = "";
  shot.visual = subtitleCardVisualForShot(shot);
  shot.audioStrategy = shot.audioStrategy || "tts_bgm";
  shot.fallback = "已改为字幕卡，不再强依赖实拍素材。";
  return shot;
}

function bestAssetForShot(shot) {
  if (shot.assetMode === "subtitle_card") return null;
  if (!state.assets.length) return null;
  if (shot.assetId) return state.assets.find((asset) => asset.id === shot.assetId) || null;
  const needs = shot.assetNeedProfile || inferShotAssetProfile(shot);
  const ranked = [...state.assets]
    .map((asset) => ({ asset, score: assetMatchScore(asset, needs) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (!best) return null;
  if (needs.some((need) => need !== "可用素材") && best.score < 24) return null;
  return best.asset;
}

function buildEditPlan() {
  const used = new Map();
  return state.script.map((rawShot, index) => {
    const shot = ensureShotMetadata(rawShot);
    const range = parseShotRange(shot.time, index);
    const selected = bestAssetForShot(shot);
    if (selected) used.set(selected.id, (used.get(selected.id) || 0) + 1);
    return {
      id: shot.id,
      start: range.start,
      end: range.end,
      duration: range.duration,
      visualGoal: shot.visual,
      subtitle: shot.subtitle,
      intent: shot.intent,
      audioStrategy: shot.audioStrategy || "tts_bgm",
      assetNeed: shot.assetNeed,
      assetNeedProfile: shot.assetNeedProfile || inferShotAssetProfile(shot),
      assetId: selected?.id || null,
      assetName: shot.assetMode === "subtitle_card" ? "字幕卡" : selected?.name || null,
      assetUrl: selected?.url || null,
      mediaKind: shot.assetMode === "subtitle_card" ? "subtitle_card" : selected ? mediaKind(selected) : "fallback_card",
      assetMode: shot.assetMode || "asset",
      crop: selected?.width && selected?.height && selected.height >= selected.width ? "contain_9_16" : "smart_crop_9_16",
      fallback: selected ? "" : shot.fallback,
      editNotes: selected
        ? `${selected.name} · ${assetSummary(selected)}`
        : shot.fallback,
    };
  });
}

function refreshEditPlan() {
  state.script.forEach(ensureShotMetadata);
  state.editPlan = buildEditPlan();
}

function validateBriefForThemes(brief) {
  if (!brief.store?.trim()) {
    return "请先填写并保存商家档案（至少要有商家/店铺名称）。";
  }
  if (!brief.direction?.trim()) {
    return "请先填写「这次想宣传什么」（例如：新店开业、开业酬宾），否则选题容易偏成日常探店。";
  }
  if (includesProductInBrief(brief.projectType) && !brief.product?.trim()) {
    return "你选择了需要填写产品/活动信息，请先补充名称后再生成选题。";
  }
  return null;
}

function routeHintForBrief(brief) {
  if (briefMentionsOpening(brief)) {
    return resolveOpeningStage(brief) === "pre_opening"
      ? "主体介绍、位置路线、场地筹备、服务范畴（无学员/上课镜头）"
      : "商家亮相、位置交通、见面礼遇、服务范畴介绍";
  }
  if (/周年|店庆/.test(briefTextBundle(brief))) return "庆典记忆、回馈礼遇、老客新客理由";
  if (/优惠|满减|活动/.test(briefTextBundle(brief))) return "权益说明、到店理由、真实体验";
  if (brief.projectType === "store") return "门店记忆点、到店理由、品牌气质";
  return "卖点种草、场景转化、信任建立";
}

function inferContentFormatFromText(text) {
  if (/带看|探店|逛店|看店|路线|空间/.test(text)) return "tour";
  if (/问题|解答|答疑|顾虑|为什么|怎么办/.test(text)) return "problem_solution";
  if (/对比|比较|区别|怎么选/.test(text)) return "comparison";
  if (/故事|记录|纪实|筹备|主理人/.test(text)) return "story";
  if (/权益|礼遇|活动|报名|预约|套餐/.test(text)) return "offer";
  if (/告知|介绍|通知|开业|新店|亮相/.test(text)) return "announcement";
  if (/种草|理由|推荐|值得/.test(text)) return "reason";
  return "";
}

async function generateThemes() {
  const brief = currentBrief();
  const validationError = validateBriefForThemes(brief);
  if (validationError) {
    addMessage(validationError);
    if (!state.profileSaved) els.profilePanel.classList.remove("hidden");
    return;
  }

  els.planBtn.disabled = true;
  els.planBtn.textContent = "AI 正在生成选题...";
  state.themes = [];
  state.selectedThemeId = null;
  state.script = [];
  state.editPlan = [];
  renderThemes();
  renderScript();
  renderTimeline();
  renderProductionList();

  let usedFallback = false;
  const stageNote =
    brief.openingStageResolved === "pre_opening"
      ? "（开业前预热：镜头不含顾客/学生/满座）"
      : brief.openingStageResolved
        ? `（阶段：${brief.openingStageResolved}）`
        : "";
  addMessage(`本次宣传重点：${brief.campaignCore || brief.direction}${stageNote}；时长：${brief.videoLengthLabel}；结构：${brief.contentFormatLabel}`);

  try {
    const data = await apiRequest("/api/ai/themes", { brief });
    state.themes = data.themes;
    addMessage("DeepSeek 已根据你的宣传诉求生成 3 个选题方向。");
  } catch (error) {
    usedFallback = true;
    state.themes = localThemesForBrief(brief);
    addMessage(
      `${error.message} 已改用本地模板兜底${briefMentionsOpening(brief) ? "（已按开业场景匹配）" : ""}。配置 DeepSeek Key 后可获得更贴切的 AI 策划。`,
    );
  } finally {
    els.planBtn.disabled = false;
    els.planBtn.textContent = creationModeCopy[state.creationMode].planButton;
  }

  renderThemes();
  addMessage(
    `我先按「${projectTypeLabel(brief.projectType, brief.businessType)} / ${brief.platform} / ${brief.videoLengthLabel}」来策划。建议路线：${routeHintForBrief(brief)}。${usedFallback ? "（当前为本地兜底，可能与 AI 结果有差距）" : ""}`,
  );
  setStep("strategy");
}

function renderThemes() {
  els.themeGrid.innerHTML = "";
  if (!state.themes.length) {
    els.themeGrid.innerHTML = '<div class="message">先完成前两步，我会在这里生成选题方向。</div>';
    return;
  }

  state.themes.forEach((theme) => {
    const card = document.createElement("article");
    card.className = `theme-card ${theme.id === state.selectedThemeId ? "selected" : ""}`;
    card.innerHTML = `
      <div>
        <div class="metric-row">
          <span class="pill">${theme.rhythm}</span>
          <span class="pill">${theme.strategy || "选题策略"}</span>
          <span class="pill">${theme.duration}s</span>
          <span class="pill">${theme.score}</span>
        </div>
        <h3>${theme.title}</h3>
        <p>${theme.contentGoal || theme.promise}</p>
        <p><strong>开头钩子：</strong>${theme.hook}</p>
        <p><strong>视频主线：</strong>${(theme.storyline || []).join(" → ")}</p>
        <p><strong>必须包含：</strong>${(theme.mustInclude || []).join(" / ")}</p>
        <p><strong>不要跑偏到：</strong>${(theme.avoid || []).join(" / ")}</p>
        <p><strong>适合素材：</strong>${theme.materialFit || "按当前素材和拍摄条件执行"}</p>
        <p><strong>建议画面：</strong>${theme.shots.join(" / ")}</p>
      </div>
      <button class="primary-action" type="button" data-theme-id="${theme.id}">选择这个选题</button>
    `;
    els.themeGrid.appendChild(card);
  });
}

async function selectTheme(themeId) {
  const theme = state.themes.find((item) => item.id === themeId);
  if (!theme) {
    addMessage("未找到该选题，请重新生成选题方向后再选择。");
    return;
  }

  state.selectedThemeId = themeId;
  renderThemes();
  state.script = [];
  renderScript();
  renderTimeline();
  setStep("script");

  const brief = currentBrief();
  try {
    addMessage(`已选择《${theme.title}》。DeepSeek 正在生成分镜脚本。`);
    const data = await apiRequest("/api/ai/script", { brief, theme });
    state.script = data.script.map(ensureShotMetadata);
    addMessage(`脚本已生成，共 ${state.script.length} 个镜头，你可以逐段调整。`);
  } catch (error) {
    const fallbackPreset = scriptPresetForFallback(brief, themeId);
    state.script = fallbackPreset.map(([time, visual, subtitle, intent], index) => ({
      id: index + 1,
      time,
      visual,
      subtitle,
      intent,
      audioStrategy: "tts_bgm",
    })).map(ensureShotMetadata);
    addMessage(`${error.message} 当前显示的是本地兜底脚本，只用于跑通结构；要得到更贴合商家的脚本，需要配置 AI Key 或手动把每段改具体。`);
  }

  renderScript();
  renderTimeline();
  renderProductionList();
  updatePreview();
}

function renderScript() {
  els.scriptTable.innerHTML = "";
  if (!state.script.length) {
    els.scriptTable.innerHTML = '<div class="message">先选择选题方向，我会生成可编辑分镜。</div>';
    return;
  }

  refreshEditPlan();
  const visualColumn = creationModeCopy[state.creationMode].visualColumn;
  state.script.forEach((shot) => {
    const row = document.createElement("article");
    row.className = "script-row";
    row.innerHTML = `
      <div class="script-cell">
        <span>时间</span>
        <input value="${shot.time}" data-field="time" data-id="${shot.id}" />
      </div>
      <div class="script-cell">
        <span>${visualColumn}</span>
        <textarea data-field="visual" data-id="${shot.id}">${shot.visual}</textarea>
      </div>
      <div class="script-cell">
        <span>字幕/旁白</span>
        <textarea data-field="subtitle" data-id="${shot.id}">${shot.subtitle}</textarea>
        <button class="rewrite-icon subtitle-rewrite" type="button" title="只改字幕/旁白" data-rewrite-action="open" data-mode="subtitle" data-id="${shot.id}">✎</button>
      </div>
      <div class="script-cell">
        <span>这一段目的</span>
        <textarea data-field="intent" data-id="${shot.id}">${shot.intent}</textarea>
      </div>
      <div class="script-cell script-action-cell">
        <button class="rewrite-icon segment-rewrite" type="button" title="重做本段" data-rewrite-action="open" data-mode="segment" data-id="${shot.id}">↻</button>
      </div>
      ${renderRewritePanel(shot)}
    `;
    els.scriptTable.appendChild(row);
  });
}

function renderTimeline() {
  els.timeline.innerHTML = "";
  if (!state.script.length) {
    els.timeline.innerHTML = '<div class="message">脚本确认后，这里会显示剪辑结构。</div>';
    return;
  }

  refreshEditPlan();
  state.editPlan.forEach((shot) => {
    const node = document.createElement("article");
    node.className = "timeline-card";
    node.innerHTML = `
      <strong>${shot.start}-${shot.end}s · 镜头 ${shot.id}</strong>
      <p>${shot.visualGoal}</p>
      <p>${shot.subtitle}</p>
      <p><b>素材：</b>${shot.assetName || "使用字幕卡/待补素材"}</p>
    `;
    els.timeline.appendChild(node);
  });
}

function productionActionLabel() {
  if (state.creationMode === "planning") return "拍摄动作";
  if (state.creationMode === "mixed") return "素材/补拍";
  return "素材使用";
}

function productionNoteForShot(shot) {
  if (state.creationMode === "planning") {
    return "按脚本现场拍这一段，优先手机竖拍，画面保持稳定。";
  }
  if (state.creationMode === "mixed") {
    return /补拍|建议补拍|新拍/.test(shot.visual)
      ? "这一段是补拍镜头，确认是否真的有必要；没有条件就让 Agent 改成现有素材版本。"
      : "优先使用已有素材，如果画面不够完整再少量补拍。";
  }
  return "直接从已上传/已有素材中匹配，不默认新增拍摄任务。";
}

function renderProductionList() {
  if (!els.productionList) return;
  els.productionList.innerHTML = "";
  if (!state.script.length) {
    els.productionList.innerHTML = '<div class="message">脚本确认后，这里会自动整理拍摄/素材执行清单。</div>';
    return;
  }

  refreshEditPlan();
  state.editPlan.forEach((plan) => {
    const shot = state.script.find((item) => item.id === plan.id) || plan;
    const asset = plan.assetId ? state.assets.find((item) => item.id === plan.assetId) : null;
    const matchDetail =
      plan.mediaKind === "subtitle_card"
        ? { missing: [], reason: "已改成字幕卡，这一段会用文字画面承接。" }
        : assetMatchDetail(asset, plan.assetNeedProfile || plan.assetNeed || []);
    const needProfile = plan.assetNeedProfile || inferShotAssetProfile(shot);
    const status = shotBindingStatus(shot, asset);
    const card = document.createElement("article");
    card.className = "timeline-card production-card";
    card.innerHTML = `
      <strong>${shot.time} · ${productionActionLabel()} <span class="binding-status ${status.className}">${status.label}</span></strong>
      <p><b>画面：</b>${shot.visual || plan.visualGoal}</p>
      <p><b>字幕：</b>${shot.subtitle}</p>
      <p><b>主需求：</b>${(needProfile.primary || []).join(" / ")}</p>
      ${needProfile.alternatives?.length ? `<p><b>可替代素材：</b>${needProfile.alternatives.join(" / ")}</p>` : ""}
      <p><b>已匹配素材：</b>${plan.assetName || "暂无，进入剪辑时会用字幕卡或提示补素材"}</p>
      <p><b>匹配说明：</b>${matchDetail.reason}</p>
      ${matchDetail.compatible?.length ? `<p><b>可替代：</b>${matchDetail.compatible.join(" / ")}</p>` : ""}
      ${matchDetail.missing?.length ? `<p><b>缺少：</b>${matchDetail.missing.join(" / ")}</p>` : ""}
      <p><b>剪辑注意：</b>${productionNoteForShot(shot)}</p>
      <div class="binding-actions production-actions">
        <button class="mini-action" type="button" data-action="subtitle-card" data-id="${shot.id}">
          改成字幕卡
        </button>
      </div>
    `;
    els.productionList.appendChild(card);
  });
}

function updatePreview() {
  const theme = state.themes.find((item) => item.id === state.selectedThemeId);
  const firstSubtitle = state.script[0]?.subtitle || "脚本字幕会出现在这里";
  refreshEditPlan();
  const firstPlan = state.editPlan[0];
  if (firstPlan?.mediaKind === "subtitle_card") {
    els.videoPoster.innerHTML = `<div class="subtitle-card-preview"><strong>${theme?.title || "字幕卡"}</strong><span>${firstPlan.subtitle}</span></div>`;
  } else if (firstPlan?.mediaKind === "image") {
    els.videoPoster.innerHTML = `<img src="${firstPlan.assetUrl}" alt="${firstPlan.assetName}" />`;
  } else if (firstPlan?.mediaKind === "video") {
    els.videoPoster.innerHTML = `<video src="${firstPlan.assetUrl}" muted loop playsinline autoplay></video>`;
  } else {
    els.videoPoster.innerHTML = `<span>${theme?.title || "选择选题后生成预览"}</span>`;
  }
  els.subtitleStrip.textContent = firstSubtitle;
  const plannedDuration = state.editPlan.length ? Math.max(...state.editPlan.map((item) => item.end)) : theme?.duration || 0;
  els.durationLabel.textContent = `预计 ${plannedDuration}s · ${currentBrief().videoLengthLabel}`;
  updateAgentPrompt();
}

function renderAssets() {
  els.assetGrid.innerHTML = "";
  els.assetCount.textContent = `${state.assets.length} 个素材`;
  renderVisionSummary();
  if (!state.assets.length) {
    els.assetGrid.innerHTML = '<div class="message">还没有上传素材。也可以直接生成选题，让 agent 给补拍建议。</div>';
    return;
  }

  state.assets.forEach((asset) => {
    const card = document.createElement("article");
    card.className = "asset-card";
    const status = assetStatus(asset);
    const useHints = assetUseHints(asset);
    const profile = asset.profile || buildLocalAssetProfile(asset);
    const recognition = asset.recognition || {};
    const canVisionRecognize = ["image", "video"].includes(mediaKind(asset));
    const media = asset.type.startsWith("image")
      ? `<img src="${asset.url}" alt="${escapeRenderText(asset.name)}" />`
      : asset.type.startsWith("video")
        ? `<video src="${asset.url}" muted></video>`
        : "<span>素材</span>";
    card.innerHTML = `
      <div class="asset-thumb">${media}</div>
      <div class="asset-body">
        <div class="asset-headline">
          <div class="asset-name" title="${escapeRenderText(asset.name)}">${escapeRenderText(asset.name)}</div>
          <span class="asset-status ${status.className}">${status.label}</span>
        </div>
        <div class="asset-meta">${assetSummary(asset)}</div>
        <div class="asset-profile">
          <strong>素材画像</strong>
          <span>${escapeRenderText(profile.summary)}</span>
        </div>
        <div class="asset-recognition ${recognition.status || "local"}">
          <strong>${assetRecognitionTitle(asset)}</strong>
          <span>${escapeRenderText(assetRecognitionDetail(asset))}</span>
        </div>
        <div class="asset-fit">${assetMatchLabel(asset)}</div>
        <div class="asset-tags">${assetProfileTags(asset).map((tag) => `<span>${escapeRenderText(tag)}</span>`).join("")}</div>
        <div class="asset-hints">${useHints.map((hint) => `<span>${escapeRenderText(hint)}</span>`).join("")}</div>
        <div class="asset-signals">${(profile.signals || []).length ? profile.signals.map((signal) => `<span>${escapeRenderText(signal)}</span>`).join("") : "<span>等待视觉模型进一步识别画面内容</span>"}</div>
        <div class="asset-actions">
          <button class="mini-action" type="button" data-action="recognize-asset" data-id="${asset.id}" ${canVisionRecognize ? "" : "disabled"}>
            ${asset.profile?.source === "vision_model" ? "重新识别" : "视觉识别"}
          </button>
        </div>
      </div>
    `;
    els.assetGrid.appendChild(card);
  });
}

function renderVisionSummary() {
  if (!els.visionSummary) return;
  const total = state.assets.length;
  if (!total) {
    els.visionSummary.textContent = "等待上传素材";
    return;
  }
  const visionDone = state.assets.filter((asset) => asset.profile?.source === "vision_model").length;
  const running = state.assets.filter((asset) => asset.recognition?.status === "running").length;
  const failed = state.assets.filter((asset) => asset.recognition?.status === "failed").length;
  els.visionSummary.textContent = `视觉识别 ${visionDone}/${total}${running ? ` · ${running} 识别中` : ""}${failed ? ` · ${failed} 失败` : ""}`;
}

function assetRecognitionTitle(asset) {
  const status = asset.recognition?.status;
  if (status === "running") return "识别状态：识别中";
  if (status === "done" || asset.profile?.source === "vision_model") return "识别状态：视觉已识别";
  if (status === "failed") return "识别状态：识别失败";
  if (status === "video_pending") return "识别状态：视频待抽帧";
  return "识别状态：本地基础画像";
}

function assetRecognitionDetail(asset) {
  const recognition = asset.recognition || {};
  if (recognition.error) return `${recognition.stage || "识别失败"}：${recognition.error}`;
  if (recognition.stage) return recognition.stage;
  if (asset.profile?.source === "vision_model") return "已调用火山视觉模型理解画面内容。";
  return "已根据文件信息、尺寸、文件名和已有标签生成基础画像。";
}

async function applyFeedback() {
  const text = els.feedback.value.trim();
  if (!text) return;
  addMessage(text, "user");
  els.feedback.value = "";

  if (text.includes("没有素材")) {
    setCreationMode("planning");
    addMessage("可以，没有素材也能继续。我会优先给你选题方向和补拍清单。");
    if (state.step === "assets") generateThemes();
    return;
  }

  if (text.includes("直接用现有素材") || text.includes("直接出片") || text.includes("不补拍")) {
    setCreationMode("existing");
    addMessage("已切换成直接用现有素材出片。我会优先把已有素材组织成剪辑结构，不默认要求补拍。");
    setStep("brief");
    return;
  }

  if (text.includes("规划拍摄") || text.includes("帮我规划拍摄")) {
    setCreationMode("planning");
    addMessage("已切换成规划拍摄。我会先给选题方向和能照着拍的简单脚本。");
    setStep("brief");
    return;
  }

  if (text.includes("可以补") || text.includes("补一点") || text.includes("部分素材")) {
    setCreationMode("mixed");
    addMessage("已切换成混合模式。我会先用已有素材，必要时给少量补拍建议。");
    setStep("brief");
    return;
  }

  if (text.includes("只做店铺") || text.includes("店铺宣传")) {
    els.projectType.value = "store";
    updateBriefMode();
    addMessage("已切换成只做店铺宣传。后面我会重点围绕门店氛围、位置、服务和用户到店理由来策划。");
    setStep("brief");
    return;
  }

  const inferredFormat = inferContentFormatFromText(text);
  if (inferredFormat && els.contentFormat.value !== inferredFormat) {
    els.contentFormat.value = inferredFormat;
    addMessage(`收到，我会把它按「${contentFormatCopy[inferredFormat]}」的结构来理解。`);
    if (!state.script.length) return;
  }

  if ((text.includes("跳到主题") || text.includes("生成主题") || text.includes("跳到选题") || text.includes("生成选题")) && !state.themes.length) {
    generateThemes();
    return;
  }

  if (text.includes("跳到脚本") && state.themes.length && !state.script.length) {
    selectTheme(state.themes[0].id);
    return;
  }

  if (!state.script.length) {
    addMessage("收到。我会把这个偏好带进后面的选题方向和脚本里。");
    return;
  }

  try {
    addMessage("DeepSeek 正在按你的意见改写脚本。");
    const data = await apiRequest("/api/ai/rewrite", {
      brief: currentBrief(),
      theme: currentTheme(),
      script: state.script,
      instruction: text,
    });
    state.script = data.script.map(ensureShotMetadata);
    addMessage("脚本已按你的意见改写。");
    renderScript();
    renderTimeline();
    renderProductionList();
    updatePreview();
    return;
  } catch (error) {
    addMessage(`${error.message} 先用本地规则帮你改一版。`);
  }

  const lower = text.toLowerCase();
  if (text.includes("高级") || text.includes("质感")) {
    state.script = state.script.map((shot) => ({
      ...shot,
      subtitle: shot.subtitle.replace("划算", "更有仪式感").replace("促销", "限定体验"),
    }));
    addMessage("我把脚本改得更偏质感表达，弱化了直接促销。");
  } else if (text.includes("快") || lower.includes("fast")) {
    state.script = state.script.slice(0, 4).map((shot, index) => ({ ...shot, id: index + 1 }));
    addMessage("已压缩成更快的节奏，适合 12-15 秒短视频。");
  } else if (text.includes("价格") || text.includes("优惠")) {
    state.script.splice(2, 0, {
      id: 3,
      time: "7-10s",
      visual: "套餐价格和活动时间清晰出现",
      subtitle: "七夕限定套餐，到店更划算。",
      intent: "突出价格权益",
    });
    state.script = state.script.map((shot, index) => ({ ...shot, id: index + 1 }));
    addMessage("已加入价格权益镜头，转化信息会更明确。");
  } else {
    state.script[0].subtitle = `${state.script[0].subtitle} ${text}`;
    addMessage("我先把你的修改意见放进开场表达里，后续接模型后可以做更完整的重写。");
  }

  renderScript();
  renderTimeline();
  updatePreview();
}

function currentProjectSnapshot() {
  refreshEditPlan();
  return {
    brief: currentBrief(),
    creationMode: state.creationMode,
    themes: state.themes,
    selectedThemeId: state.selectedThemeId,
    selectedTheme: state.themes.find((item) => item.id === state.selectedThemeId),
    script: state.script,
    assets: state.assets.map(({ id, name, type, size, url, width, height, duration, tags }) => ({
      id,
      name,
      type,
      size,
      url,
      width,
      height,
      duration,
      tags,
    })),
    editTimeline: state.editPlan,
    renderSpec: {
      format: "vertical_9_16",
      width: 1080,
      height: 1920,
      fps: 30,
      subtitleSource: "script.subtitle",
      engineReadyFor: ["ffmpeg", "remotion"],
    },
  };
}

function exportProject() {
  const project = currentProjectSnapshot();
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "video-creator-plan.json";
  link.click();
  URL.revokeObjectURL(url);
  addMessage("已导出当前 brief、选题方向、脚本和素材清单。");
}

async function saveProjectDraft() {
  const project = currentProjectSnapshot();
  els.saveProjectBtn.disabled = true;
  try {
    const data = await apiRequest("/api/projects/current", { project });
    addMessage(`项目草稿已保存到本地：${data.savedTo || "data/projects/current.json"}`);
  } catch (error) {
    addMessage(`${error.message} 项目草稿保存失败。`);
  } finally {
    els.saveProjectBtn.disabled = false;
  }
}

async function loadProjectDraft() {
  els.loadProjectBtn.disabled = true;
  try {
    const response = await fetch("/api/projects/current");
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "读取项目草稿失败。");
    applyProjectSnapshot(data.project || {});
    addMessage(`已恢复本地项目草稿${data.project?.updatedAt ? `（保存于 ${new Date(data.project.updatedAt).toLocaleString()}）` : ""}。`);
  } catch (error) {
    addMessage(error.message);
  } finally {
    els.loadProjectBtn.disabled = false;
  }
}

function applyProjectSnapshot(project) {
  const brief = project.brief || {};
  setCreationMode(project.creationMode || brief.creationMode || "existing");
  applyStoreProfile({
    businessType: brief.businessType || "offline",
    store: brief.store || "",
    storeFeature: brief.storeFeature || "",
    location: brief.location || "",
    brandMessage: brief.brandMessage || "",
  });
  els.projectType.value = brief.projectType || "store_product";
  updateBriefMode();
  els.platform.value = brief.platform || "全平台";
  els.direction.value = brief.direction || "";
  els.videoLength.value = brief.videoLength || "30s";
  els.contentFormat.value = brief.contentFormat || "auto";
  els.audience.value = brief.audience || "";
  els.style.value = brief.style || "氛围感种草";
  els.modeContext.value = brief.routeContext || "";
  els.materialRule.value = brief.materialRule || "";
  els.limit.value = brief.limit || "";
  els.product.value = brief.product || "";
  els.productFeature.value = brief.productFeature || "";
  els.offer.value = brief.offer || "";
  els.timing.value = brief.timing || "";
  if (els.openingStage) els.openingStage.value = brief.openingStage || "auto";

  state.assets = Array.isArray(project.assets) ? project.assets : [];
  state.themes = Array.isArray(project.themes) ? project.themes : project.selectedTheme ? [project.selectedTheme] : [];
  state.selectedThemeId = project.selectedThemeId || project.selectedTheme?.id || null;
  state.script = Array.isArray(project.script) ? project.script.map(ensureShotMetadata) : [];
  refreshEditPlan();
  syncOpeningStageVisibility();
  renderProfileState();
  renderAssets();
  renderThemes();
  renderScript();
  renderTimeline();
  renderProductionList();
  updatePreview();
  setStep(state.script.length ? "preview" : state.themes.length ? "strategy" : "brief");
}

function rewriteModeCopy(mode) {
  if (mode === "segment") {
    return {
      title: "重做本段",
      help: "适合这一段方向不对、画面不存在、内容和真实情况不符。会改拍什么、字幕/旁白和这一段目的，不改时间。",
      placeholder: "例如：我们没有休息区和前台，改成展示球场、球网、儿童训练器材，突出专业和安全。",
      previewButton: "预览重做",
    };
  }
  return {
    title: "只改字幕/旁白",
    help: "适合结构满意，只是这句话不好。只改字幕/旁白，不改拍什么和这一段目的。",
    placeholder: "例如：更像家长口吻，别太硬广，突出孩子入门和专业感。",
    previewButton: "预览改写",
  };
}

function renderRewritePanel(shot) {
  if (!state.activeRewrite || state.activeRewrite.shotId !== shot.id) return "";
  const copy = rewriteModeCopy(state.activeRewrite.mode);
  const draft = state.rewriteDraft;
  return `
    <div class="rewrite-panel">
      <div class="rewrite-panel-head">
        <strong>${copy.title}</strong>
        <span>${copy.help}</span>
      </div>
      <textarea class="rewrite-instruction" data-rewrite-field="instruction" data-id="${shot.id}" placeholder="${copy.placeholder}">${state.activeRewrite.instruction || ""}</textarea>
      ${
        draft
          ? `<div class="rewrite-preview">
              ${state.activeRewrite.mode === "segment" ? `<p><b>拍什么：</b>${draft.visual}</p>` : ""}
              <p><b>字幕/旁白：</b>${draft.subtitle}</p>
              ${state.activeRewrite.mode === "segment" ? `<p><b>这一段目的：</b>${draft.intent}</p>` : ""}
            </div>`
          : ""
      }
      <div class="rewrite-actions">
        <button class="secondary-action" type="button" data-rewrite-action="cancel" data-id="${shot.id}">取消</button>
        <button class="secondary-action" type="button" data-rewrite-action="preview" data-id="${shot.id}">${copy.previewButton}</button>
        <button class="primary-action" type="button" data-rewrite-action="apply" data-id="${shot.id}" ${draft ? "" : "disabled"}>应用</button>
      </div>
    </div>
  `;
}

function openRewritePanel(shotId, mode) {
  state.activeRewrite = { shotId, mode, instruction: "" };
  state.rewriteDraft = null;
  renderScript();
}

function updateRewriteInstruction(shotId, instruction) {
  if (!state.activeRewrite || state.activeRewrite.shotId !== shotId) return;
  state.activeRewrite.instruction = instruction;
  state.rewriteDraft = null;
}

function previewShotRewrite(shot) {
  if (!state.activeRewrite) return;
  const instruction = state.activeRewrite.instruction?.trim() || "";
  state.rewriteDraft =
    state.activeRewrite.mode === "segment"
      ? buildSegmentRewriteDraft(shot, instruction)
      : buildSubtitleRewriteDraft(shot, instruction);
  renderScript();
}

function buildSubtitleRewriteDraft(shot, instruction) {
  const brief = currentBrief();
  const audience = brief.audience || "家长";
  const store = brief.store || "这里";
  const subject = brief.storeFeature || brief.brandMessage || "孩子的学习体验";
  let subtitle = shot.subtitle;

  if (/家长|孩子|少儿|网球|专业|安全|入门/.test(instruction)) {
    subtitle = `家长第一次了解${store}，更关心的是孩子能不能安全入门、训练是否专业。`;
  } else if (/短|简短|精简/.test(instruction)) {
    subtitle = `${store}，先让家长看到专业和安心。`;
  } else if (/弱化|别太硬广|自然/.test(instruction)) {
    subtitle = `如果想让孩子多了解一项运动，可以先从这里开始看看。`;
  } else if (instruction) {
    subtitle = `围绕${audience}最关心的${subject}，这一段可以这样说。`;
  }

  return { subtitle };
}

function buildSegmentRewriteDraft(shot, instruction) {
  const text = `${instruction} ${shot.visual} ${shot.subtitle}`;
  const brief = currentBrief();
  const store = brief.store || "俱乐部";

  if (/没有|无|不要|休息区|前台/.test(text)) {
    return {
      visual: "球场地面、球网、儿童球拍、训练用球等基础训练环境细节",
      subtitle: `孩子第一次接触网球，家长更关心的是环境是否安全、训练是否有章法。`,
      intent: "用真实场地和训练器材建立基础信任，避免依赖不存在的配套空间。",
    };
  }

  if (/教练|专业|训练/.test(text)) {
    return {
      visual: "教练整理球拍、摆放训练用球、示范基础动作的细节画面",
      subtitle: `${store}会从基础动作和训练习惯开始，让孩子循序渐进地了解网球。`,
      intent: "突出训练专业性和成长路径，让家长理解课程价值。",
    };
  }

  return {
    visual: "真实可拍的场地、器材和训练准备细节",
    subtitle: `开业前，先让家长看到这里真实的训练环境和准备状态。`,
    intent: "用真实可拍内容承接这一段信息，避免编造不存在的画面。",
  };
}

function applyRewriteDraft(shot) {
  if (!state.rewriteDraft || !state.activeRewrite) return;
  if (state.activeRewrite.mode === "segment") {
    shot.visual = state.rewriteDraft.visual;
    shot.subtitle = state.rewriteDraft.subtitle;
    shot.intent = state.rewriteDraft.intent;
    shot.assetNeed = inferAssetNeedFromShot(shot);
    shot.fallback = fallbackForShot(shot);
    shot.assetMode = "";
    shot.assetId = "";
  } else {
    shot.subtitle = state.rewriteDraft.subtitle;
  }
  state.activeRewrite = null;
  state.rewriteDraft = null;
  renderScript();
  renderTimeline();
  renderProductionList();
  updatePreview();
}

async function renderVideoFile() {
  refreshEditPlan();
  const validation = validateRenderPlan(state.editPlan);
  if (validation.error) {
    addMessage(validation.error);
    return;
  }
  els.renderVideoBtn.disabled = true;
  els.renderVideoBtn.textContent = "正在生成...";
  startRenderProgress({
    totalSegments: state.editPlan.length,
    hasRealMedia: state.editPlan.some((item) => item.assetUrl && item.mediaKind !== "subtitle_card"),
  });
  addMessage(validation.warning || "正在用 FFmpeg 生成 MP4 视频文件。");

  try {
    const response = await fetch("/api/render/video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timeline: state.editPlan,
        title: currentTheme()?.title || currentBrief().store || "Video Creator",
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || "FFmpeg 渲染失败。");
      error.status = response.status;
      error.isRenderValidation = response.status === 400;
      throw error;
    }
    finishRenderProgress("MP4 视频文件已生成");
    renderVideoResult({
      url: data.videoUrl,
      filename: data.filename || "video.mp4",
      label: "MP4 视频文件已生成",
      note: "这是服务端 FFmpeg 渲染结果，可直接下载使用。",
    });
    addMessage("FFmpeg MP4 视频已生成，可以在成片页预览和下载。");
  } catch (error) {
    if (error.isRenderValidation) {
      showRenderProgressError(error.message);
      addMessage(error.message);
      return;
    }
    if (!window.MediaRecorder) {
      showRenderProgressError(error.message);
      addMessage(`${error.message} 当前浏览器也不支持 WebM 兜底导出。`);
      return;
    }
    addMessage(`${error.message} 正在回退到浏览器 WebM 预览导出。`);
    setRenderProgress(88, "FFmpeg 失败，正在生成预览兜底", "会先导出 WebM 预览文件，MP4 可在修复后重新导出。");
    const blob = await renderTimelineToWebm(state.editPlan);
    const url = URL.createObjectURL(blob);
    const filename = `video-preview-${Date.now()}.webm`;
    finishRenderProgress("WebM 预览视频已生成");
    renderVideoResult({
      url,
      filename,
      label: "WebM 预览视频已生成",
      note: "这是浏览器端兜底导出，FFmpeg 修复后可生成 MP4。",
    });
  } finally {
    els.renderVideoBtn.disabled = false;
    els.renderVideoBtn.textContent = "导出视频";
  }
}

function startRenderProgress({ totalSegments, hasRealMedia }) {
  stopRenderProgressTimer();
  const mediaCopy = hasRealMedia ? "正在读取素材并准备竖版画面。" : "当前会使用字幕卡生成预览画面。";
  setRenderProgress(8, "检查导出方案", `${totalSegments} 个镜头待渲染。${mediaCopy}`);

  let progress = 8;
  renderProgressTimer = window.setInterval(() => {
    const remaining = 92 - progress;
    const step = remaining > 30 ? 4 : remaining > 12 ? 2 : 0.8;
    progress = Math.min(92, progress + step);
    setRenderProgress(progress, renderProgressTitle(progress), renderProgressDetail(progress, totalSegments));
    if (progress >= 92) stopRenderProgressTimer();
  }, 520);
}

function renderProgressTitle(progress) {
  if (progress < 18) return "准备素材";
  if (progress < 55) return "渲染镜头";
  if (progress < 78) return "合成片段";
  if (progress < 92) return "写入 MP4";
  return "等待 FFmpeg 完成";
}

function renderProgressDetail(progress, totalSegments) {
  if (progress < 18) return "正在整理时间线、字幕和画面比例。";
  if (progress < 55) return `正在逐段生成 ${totalSegments} 个竖版镜头。`;
  if (progress < 78) return "正在把分段视频拼接成完整成片。";
  if (progress < 92) return "正在写入 MP4 文件和下载信息。";
  return "视频较长或素材较大时，这一步会多等一会儿。";
}

function setRenderProgress(percent, title, detail) {
  const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
  els.renderResult.innerHTML = `
    <div class="render-progress-head">
      <strong>${escapeRenderText(title)}</strong>
      <span>${safePercent}%</span>
    </div>
    <div class="render-progress-track" aria-label="导出进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${safePercent}" role="progressbar">
      <div class="render-progress-fill" style="width: ${safePercent}%"></div>
    </div>
    <span>${escapeRenderText(detail)}</span>
  `;
  els.renderResult.classList.remove("hidden", "render-error");
}

function finishRenderProgress(title) {
  stopRenderProgressTimer();
  setRenderProgress(100, title, "导出完成，正在准备预览和下载入口。");
}

function showRenderProgressError(message) {
  stopRenderProgressTimer();
  els.renderResult.innerHTML = `
    <div class="render-progress-head">
      <strong>导出被中止</strong>
      <span>未完成</span>
    </div>
    <div class="render-progress-track" aria-label="导出进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" role="progressbar">
      <div class="render-progress-fill" style="width: 100%"></div>
    </div>
    <span>${escapeRenderText(message)}</span>
  `;
  els.renderResult.classList.remove("hidden");
  els.renderResult.classList.add("render-error");
}

function stopRenderProgressTimer() {
  if (renderProgressTimer) {
    window.clearInterval(renderProgressTimer);
    renderProgressTimer = null;
  }
}

function escapeRenderText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderVideoResult({ url, filename, label, note }) {
  els.renderResult.innerHTML = `
    <div class="render-result-head">
      <strong>${label}</strong>
      <a class="render-download" href="${url}" download="${filename}">下载视频</a>
    </div>
    <video class="render-player" src="${url}" controls playsinline></video>
    <span>${note}</span>
  `;
  els.renderResult.classList.remove("hidden");
}

function validateRenderPlan(timeline) {
  if (!timeline.length) {
    return { error: "请先生成脚本和成片结构，再生成视频文件。" };
  }
  const totalDuration = Math.max(...timeline.map((item) => Number(item.end) || 0));
  if (!Number.isFinite(totalDuration) || totalDuration <= 0) {
    return { error: "当前时间线时长异常，请先检查脚本每段时间。" };
  }
  const hasRealMedia = timeline.some((item) => item.assetUrl && item.mediaKind !== "subtitle_card");
  if (!hasRealMedia) {
    return { warning: "当前没有匹配到真实素材，会先生成全字幕卡预览视频。" };
  }
  return {};
}

async function renderTimelineToWebm(timeline) {
  const width = 720;
  const height = 1280;
  const fps = 24;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const media = await preloadTimelineMedia(timeline);
  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, { mimeType: preferredRecorderMimeType() });
  const chunks = [];
  recorder.ondataavailable = (event) => {
    if (event.data?.size) chunks.push(event.data);
  };

  const totalDuration = Math.max(...timeline.map((item) => item.end), 3);
  recorder.start();
  const startTime = performance.now();

  await new Promise((resolve) => {
    const draw = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      const segment = timeline.find((item) => elapsed >= item.start && elapsed < item.end) || timeline[timeline.length - 1];
      drawVideoFrame(ctx, width, height, segment, media.get(segment.id), elapsed);
      if (elapsed < totalDuration) {
        requestAnimationFrame(draw);
      } else {
        resolve();
      }
    };
    draw();
  });

  const stopped = new Promise((resolve) => {
    recorder.onstop = resolve;
  });
  recorder.stop();
  await stopped;
  return new Blob(chunks, { type: recorder.mimeType || "video/webm" });
}

function preferredRecorderMimeType() {
  const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "video/webm";
}

async function preloadTimelineMedia(timeline) {
  const entries = await Promise.all(
    timeline.map(async (segment) => [segment.id, await loadRenderableMedia(segment)]),
  );
  return new Map(entries);
}

function loadRenderableMedia(segment) {
  if (!segment.assetUrl || segment.mediaKind === "subtitle_card") return Promise.resolve(null);
  return new Promise((resolve) => {
    if (segment.mediaKind === "image") {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = segment.assetUrl;
      return;
    }
    if (segment.mediaKind === "video") {
      const video = document.createElement("video");
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.onloadeddata = async () => {
        try {
          await video.play();
        } catch {
          // Drawing the first decoded frame is enough for this preview renderer.
        }
        resolve(video);
      };
      video.onerror = () => resolve(null);
      video.src = segment.assetUrl;
      return;
    }
    resolve(null);
  });
}

function drawVideoFrame(ctx, width, height, segment, media, elapsed) {
  ctx.fillStyle = "#1d242b";
  ctx.fillRect(0, 0, width, height);

  if (media) {
    drawCoverMedia(ctx, media, width, height);
  } else {
    drawSubtitleCardBackground(ctx, width, height, segment, elapsed);
  }

  ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
  ctx.fillRect(0, height - 230, width, 230);
  ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
  ctx.fillRect(42, height - 212, 150, 34);
  drawWrappedText(ctx, `镜头 ${segment.id} · ${segment.start}-${segment.end}s`, 60, height - 206, width - 120, 22, {
    align: "left",
    color: "#dbeafe",
    font: "700 19px sans-serif",
  });
  drawWrappedText(ctx, segment.subtitle || "", width / 2, height - 154, width - 92, 34, {
    align: "center",
    color: "#ffffff",
    font: "800 31px sans-serif",
  });
}

function drawCoverMedia(ctx, media, width, height) {
  const sourceWidth = media.videoWidth || media.naturalWidth || width;
  const sourceHeight = media.videoHeight || media.naturalHeight || height;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  ctx.drawImage(media, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

function drawSubtitleCardBackground(ctx, width, height, segment, elapsed) {
  ctx.fillStyle = "#102824";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#0f766e";
  ctx.fillRect(50, 88, width - 100, height - 360);
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.fillRect(84 + Math.sin(elapsed) * 10, 142, width - 168, 230);
  drawWrappedText(ctx, currentTheme()?.title || "字幕卡", width / 2, 250, width - 140, 42, {
    align: "center",
    color: "#ffffff",
    font: "900 44px sans-serif",
  });
  drawWrappedText(ctx, segment.visualGoal || "文字信息卡", width / 2, 492, width - 150, 32, {
    align: "center",
    color: "#e8f3f0",
    font: "800 28px sans-serif",
  });
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, options = {}) {
  ctx.font = options.font || "700 24px sans-serif";
  ctx.fillStyle = options.color || "#fff";
  ctx.textAlign = options.align || "left";
  ctx.textBaseline = "top";
  const chars = String(text || "").split("");
  const lines = [];
  let line = "";
  chars.forEach((char) => {
    const testLine = `${line}${char}`;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = char;
    } else {
      line = testLine;
    }
  });
  if (line) lines.push(line);
  lines.slice(0, 4).forEach((item, index) => {
    ctx.fillText(item, x, y + index * lineHeight);
  });
}

els.briefNextBtn.addEventListener("click", async () => {
  if (!state.profileSaved) {
    els.profilePanel.classList.remove("hidden");
    addMessage("先保存一次商家档案就可以继续。之后每条视频只需要填写本次宣传内容。");
    return;
  }

  const validationError = validateBriefForThemes(currentBrief());
  if (validationError) {
    addMessage(validationError);
    return;
  }

  if (state.creationMode === "planning") {
    addMessage("规划拍摄模式：跳过素材上传，直接根据你的背景生成选题方向。");
    setStep("strategy");
    if (!state.themes.length) await generateThemes();
    return;
  }

  addMessage(`本次信息已整理。下一步按「${creationModeCopy[state.creationMode].label}」继续。`);
  setStep("assets");
});

els.planBtn.addEventListener("click", generateThemes);

els.saveProfileBtn.addEventListener("click", () => {
  saveStoreProfile();
  renderProfileState();
});

els.toggleProfileBtn.addEventListener("click", () => {
  els.profilePanel.classList.toggle("hidden");
  renderProfileState();
});

els.storeChip.addEventListener("click", () => {
  els.profilePanel.classList.toggle("hidden");
  renderProfileState();
});

els.loadDemoBtn.addEventListener("click", () => {
  els.businessType.value = "offline";
  applyBusinessTemplate();
  els.projectType.value = "store";
  els.store.value = "广州Super超级网球俱乐部";
  els.storeFeature.value = "少儿网球培训教育";
  els.location.value = "广州市白云区丽影少年宫";
  els.brandMessage.value = "少儿网球培训教育专业性，成长性";
  saveStoreProfile({ silent: true });
  clearProductFields();
  els.platform.value = "全平台";
  els.direction.value = "开业前预热宣传";
  els.videoLength.value = "1min";
  els.contentFormat.value = "announcement";
  els.openingStage.value = "pre_opening";
  syncOpeningStageVisibility();
  els.audience.value = "附近有意愿让小孩了解或者学习网球的家长/意愿让孩子发展一项体育运动的家长";
  els.style.value = "口播介绍";
  updateBriefMode();
  addMessage("网球俱乐部示例 brief 已载入，可以从第一步重新体验。");
  setStep("brief");
});

els.businessType.addEventListener("change", () => {
  applyBusinessTemplate();
  renderProfileState();
  addMessage(`${briefTemplates[els.businessType.value].profileTitle}模板已切换，档案字段会按这个商家类型重新组织。`);
});

els.projectType.addEventListener("change", updateBriefMode);
els.direction.addEventListener("input", syncOpeningStageVisibility);
els.openingStage?.addEventListener("change", syncOpeningStageVisibility);

document.querySelectorAll("[data-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    setCreationMode(button.dataset.mode);
    addMessage(`已选择「${creationModeCopy[state.creationMode].label}」。`);
  });
});

els.themeGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-theme-id]");
  if (button) selectTheme(button.dataset.themeId);
});

els.productionList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const id = Number(button.dataset.id);
  const shot = state.script.find((item) => item.id === id);
  if (!shot) return;

  if (button.dataset.action === "subtitle-card") {
    applySubtitleCardToShot(shot);
    renderScript();
    renderTimeline();
    renderProductionList();
    updatePreview();
    addMessage(`镜头 ${id} 已改成字幕卡，用文字信息承接这一段。`);
  }
});

els.scriptTable.addEventListener("click", (event) => {
  const button = event.target.closest("[data-rewrite-action]");
  if (!button) return;
  const id = Number(button.dataset.id);
  const shot = state.script.find((item) => item.id === id);
  if (!shot) return;

  const action = button.dataset.rewriteAction;
  if (action === "open") {
    openRewritePanel(id, button.dataset.mode || "subtitle");
    return;
  }
  if (action === "preview") {
    previewShotRewrite(shot);
    return;
  }
  if (action === "apply") {
    applyRewriteDraft(shot);
    return;
  }
  if (action === "cancel") {
    state.activeRewrite = null;
    state.rewriteDraft = null;
    renderScript();
  }
});

els.scriptTable.addEventListener("input", (event) => {
  const input = event.target;
  if (input.dataset.rewriteField === "instruction") {
    updateRewriteInstruction(Number(input.dataset.id), input.value);
    return;
  }
  const id = Number(input.dataset.id);
  const field = input.dataset.field;
  const shot = state.script.find((item) => item.id === id);
  if (!shot || !field) return;
  if (field === "assetNeed") {
    shot.assetNeed = input.value
      .split(/[,，、/]/)
      .map((item) => item.trim())
      .filter(Boolean);
  } else {
    shot[field] = input.value;
  }
  renderTimeline();
  renderProductionList();
  updatePreview();
});

els.scriptTable.addEventListener("change", (event) => {
  const input = event.target;
  const id = Number(input.dataset.id);
  const field = input.dataset.field;
  const shot = state.script.find((item) => item.id === id);
  if (!shot || field !== "assetId") return;
  shot.assetId = input.value;
  shot.assetMode = input.value ? "asset" : "";
  renderScript();
  renderTimeline();
  renderProductionList();
  updatePreview();
});

els.assetInput.addEventListener("change", async (event) => {
  const files = Array.from(event.target.files);
  if (!files.length) return;

  if (files.length > MAX_UPLOAD_FILES) {
    addMessage(`一次最多上传 ${MAX_UPLOAD_FILES} 个素材。你这次选择了 ${files.length} 个，可以分批上传。`);
    els.assetInput.value = "";
    return;
  }

  const invalidFile = files.find((file) => !isAllowedAssetFile(file));
  if (invalidFile) {
    addMessage(`暂不支持「${invalidFile.name}」这种文件。请上传 PNG、JPG、WebP、GIF、MP4、MOV 或 WebM。`);
    els.assetInput.value = "";
    return;
  }

  const oversizedFile = files.find((file) => file.size > MAX_ASSET_SIZE_BYTES);
  if (oversizedFile) {
    addMessage(`「${oversizedFile.name}」有 ${formatBytes(oversizedFile.size)}，超过 ${MAX_ASSET_SIZE_MB}MB，请压缩后再上传。`);
    els.assetInput.value = "";
    return;
  }

  const formData = new FormData();
  files.forEach((file) => formData.append("assets", file));

  els.assetInput.disabled = true;
  addMessage(`正在保存并分析 ${files.length} 个素材。图片会直接视觉识别，视频会先抽关键帧再识别。`);
  try {
    const response = await fetch("/api/assets/upload", {
      method: "POST",
      body: formData,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "素材上传失败。");
    const analyzed = [];
    let visionCount = 0;
    let visionFailed = 0;
    for (const asset of data.assets || []) {
      const result = await enrichAssetWithVisionProfile(asset);
      analyzed.push(result.asset);
      if (result.visionStatus === "ok") visionCount += 1;
      if (result.visionStatus === "failed") visionFailed += 1;
    }
    state.assets.push(...analyzed);
    renderAssets();
    renderScript();
    renderTimeline();
    renderProductionList();
    const parts = [`已保存 ${analyzed.length} 个素材`];
    if (visionCount) parts.push(`${visionCount} 个素材完成火山视觉识别`);
    if (visionFailed) parts.push(`${visionFailed} 个素材视觉识别失败，已回退本地画像`);
    addMessage(`${parts.join("，")}。脚本里现在可以直接绑定素材。`);
  } catch (error) {
    addMessage(`${error.message} 请稍后重试。`);
  } finally {
    els.assetInput.disabled = false;
    els.assetInput.value = "";
  }
});

els.recognizeAllBtn?.addEventListener("click", () => {
  recognizeAllAssets({ force: false });
});

els.assetGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action='recognize-asset']");
  if (!button) return;
  runVisionRecognitionForAsset(button.dataset.id, { force: true }).then((result) => {
    if (result.status === "ok") addMessage("这个素材已完成视觉识别，匹配结果会自动更新。");
    if (result.status === "failed") addMessage("这个素材视觉识别失败，已保留本地基础画像。");
  });
});

els.feedbackBtn.addEventListener("click", applyFeedback);
els.feedback.addEventListener("keydown", (event) => {
  if (event.key === "Enter") applyFeedback();
});

els.agentToggleBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  setAgentMinimized(!els.agentDock.classList.contains("agent-minimized"));
});

els.agentDock.addEventListener("click", () => {
  if (els.agentDock.classList.contains("agent-minimized")) {
    setAgentMinimized(false);
  }
});

els.renderBtn.addEventListener("click", async () => {
  if (!state.selectedThemeId) {
    await generateThemes();
    await selectTheme(state.themes[0]?.id || "date");
  }
  renderTimeline();
  renderProductionList();
  updatePreview();
  addMessage("已把脚本整理成拍摄/素材执行清单。确认后再进入成片结构预览。");
  setStep("production");
});

els.previewBtn.addEventListener("click", () => {
  renderTimeline();
  renderProductionList();
  updatePreview();
  addMessage("已生成一个可预览的剪辑结构。真实版本会在这一步调用剪辑引擎输出视频。");
  setStep("preview");
});

els.renderVideoBtn.addEventListener("click", renderVideoFile);
els.saveProjectBtn.addEventListener("click", saveProjectDraft);
els.loadProjectBtn.addEventListener("click", loadProjectDraft);
els.exportBtn.addEventListener("click", exportProject);

document.querySelectorAll(".step-item").forEach((item) => {
  item.addEventListener("click", async () => {
    const requested = item.dataset.step;
    if (requested === "strategy" && !state.themes.length) {
      await generateThemes();
      return;
    }
    if (requested === "script" && !state.script.length) {
      addMessage(state.themes.length ? "请先在选题页选择一个方向，我会自动生成脚本。" : "请先生成并选择一个选题方向。");
      return;
    }
    if (requested === "production" && !state.script.length) {
      addMessage("请先生成并确认脚本，再整理拍摄/素材执行清单。");
      return;
    }
    if (requested === "preview") return;
    setStep(requested);
  });
});

document.querySelectorAll("[data-back]").forEach((button) => {
  button.addEventListener("click", () => setStep(button.dataset.back));
});

document.querySelectorAll("[data-agent-command]").forEach((button) => {
  button.addEventListener("click", () => {
    els.feedback.value = button.dataset.agentCommand;
    applyFeedback();
  });
});

addMessage("你好，我是你的营销视频创作 Agent。主页面负责确认背景、选题方向、脚本和预览；我负责解释推荐、追问缺失信息，也可以按你的话改主页面里的结果。");
applyBusinessTemplate({ preserveValues: true });
loadStoreProfile();
updateBriefMode();
setCreationMode(state.creationMode);
syncOpeningStageVisibility();
renderAssets();
renderThemes();
renderScript();
renderTimeline();
renderProductionList();
updatePreview();
setStep("brief");
setAgentMinimized(true);
