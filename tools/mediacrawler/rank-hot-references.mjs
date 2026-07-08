import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..", "..");
const libraryPath = path.join(rootDir, "data", "hot-references.json");
const rankingPath = path.join(rootDir, "data", "hot-reference-rankings.json");

const keywordGroups = {
  tennis: ["网球", "tennis", "球拍", "挥拍", "回球", "对墙", "发球", "接球"],
  parents: ["家长", "孩子", "小孩", "儿童", "少儿", "青少年", "亲子", "妈妈", "爸爸", "宝妈", "家庭"],
  decision: ["怎么选", "适合", "几岁", "要不要", "有没有必要", "第一项", "第一次", "入门", "启蒙", "兴趣班", "选择"],
  graphic: ["清单", "建议", "方法", "避坑", "误区", "科普", "对比", "区别", "必看", "收藏", "攻略", "指南"],
  local: ["广州", "白云", "同和", "天河", "越秀", "海珠", "番禺", "附近", "本地", "门店", "球场"],
  conversion: ["体验课", "预约", "报名", "探店", "开业", "活动", "打卡", "挑战", "社群", "咨询"],
  sport: ["运动", "篮球", "游泳", "羽毛球", "足球", "体能", "专注力", "协调", "坚持"],
};

const riskyWords = [
  "稳赚", "保本", "暴富", "逆袭", "治愈", "根治", "无效退款", "保证", "100%",
  "国家级", "世界级", "全网第一", "唯一", "最强", "天花板", "秒杀", "私信", "加微信", "加vx",
];

const weakSignals = ["抽象", "鸡汤", "玄学", "情感语录", "无关", "明星", "八卦", "穿搭", "美妆", "减肥"];

function textOf(item) {
  return [
    item.title,
    item.content,
    item.author,
    ...(Array.isArray(item.tags) ? item.tags : []),
  ].filter(Boolean).join("\n").toLowerCase();
}

function sourceTypeOf(item = {}) {
  const text = String(item.sourceType || item.raw?.type || "").trim().toLowerCase();
  if (["video", "视频"].includes(text)) return "video";
  if (["image", "normal", "images", "note", "graphic", "图文"].includes(text)) return "image";
  return "unknown";
}

function countHits(text, words) {
  return words.reduce((count, word) => count + (text.includes(String(word).toLowerCase()) ? 1 : 0), 0);
}

function metricsScore(metrics = {}) {
  const raw = (metrics.likes || 0)
    + (metrics.collects || 0) * 2.2
    + (metrics.comments || 0) * 3.2
    + (metrics.shares || 0) * 2.4;
  return Math.min(100, Math.round(Math.log10(raw + 1) * 24));
}

function detectMechanisms(text) {
  const mechanisms = [];
  if (/[？?]/.test(text) || /为什么|怎么|到底|适不适合|要不要/.test(text)) mechanisms.push("问题钩子");
  if (/不是|而是|误区|别急|先别|很多人.*错/.test(text)) mechanisms.push("反常识/纠偏");
  if (/对比|区别|篮球|游泳|羽毛球|怎么选/.test(text)) mechanisms.push("比较决策");
  if (/第一次|真实|记录|观察|体验|发生了什么/.test(text)) mechanisms.push("真实场景");
  if (/清单|步骤|方法|建议|避坑|注意/.test(text)) mechanisms.push("收藏型信息");
  if (/挑战|打卡|100个|30天|系列/.test(text)) mechanisms.push("系列/挑战");
  return mechanisms.length ? mechanisms : ["普通内容"];
}

function scoreFit(item) {
  const text = textOf(item);
  const hits = {
    tennis: countHits(text, keywordGroups.tennis),
    parents: countHits(text, keywordGroups.parents),
    decision: countHits(text, keywordGroups.decision),
    graphic: countHits(text, keywordGroups.graphic),
    local: countHits(text, keywordGroups.local),
    conversion: countHits(text, keywordGroups.conversion),
    sport: countHits(text, keywordGroups.sport),
  };
  const riskHits = countHits(text, riskyWords);
  const weakHits = countHits(text, weakSignals);
  const mechanisms = detectMechanisms(text);

  let relevance = 0;
  relevance += Math.min(28, hits.tennis * 14);
  relevance += Math.min(28, hits.parents * 9);
  relevance += Math.min(24, hits.decision * 8);
  relevance += Math.min(16, hits.graphic * 5);
  relevance += Math.min(6, hits.local * 2);
  relevance += Math.min(8, hits.conversion * 2);
  relevance += Math.min(12, hits.sport * 3);
  if (!hits.tennis && hits.sport && hits.parents && hits.decision) relevance += 14;
  if (hits.parents && hits.graphic) relevance += 8;
  if (mechanisms.includes("比较决策") || mechanisms.includes("真实场景")) relevance += 8;
  if (mechanisms.includes("收藏型信息")) relevance += 10;
  relevance -= Math.min(24, riskHits * 8);
  relevance -= Math.min(18, weakHits * 6);
  relevance = Math.max(0, Math.min(100, relevance));

  const hotness = metricsScore(item.metrics || {});
  const adaptability = Math.max(0, Math.min(100, Math.round(relevance * 0.7 + mechanisms.length * 7 - riskHits * 10)));
  const total = Math.round(hotness * 0.38 + relevance * 0.42 + adaptability * 0.2);

  const reasons = [];
  if (hotness >= 70) reasons.push("互动数据强");
  if (hits.parents) reasons.push("贴近家长/孩子场景");
  if (hits.tennis) reasons.push("直接关联网球");
  else if (hits.sport) reasons.push("可迁移到运动选择内容");
  if (hits.decision) reasons.push("有家长决策问题");
  if (hits.graphic) reasons.push("适合小红书图文拆解");
  if (hits.local) reasons.push("有本地/门店线索，但不作为主要判断");
  if (hits.conversion) reasons.push("可轻承接体验/活动转化");
  if (mechanisms.length) reasons.push(`结构：${mechanisms.join("、")}`);
  if (riskHits) reasons.push("存在营销/违规表达风险，需要谨慎改写");
  if (weakHits) reasons.push("内容方向偏泛，需要过滤");

  let tier = "not_recommended";
  if (total >= 72 && relevance >= 58 && riskHits <= 1) tier = "worth_analyzing";
  else if (total >= 58 && relevance >= 42 && riskHits <= 2) tier = "adaptable";
  else if (hotness >= 62 && relevance >= 25) tier = "hook_only";

  return { hotness, relevance, adaptability, total, tier, mechanisms, reasons, hits, riskHits };
}

function toSuggestion(item, score) {
  const title = String(item.title || item.content || "").slice(0, 80);
  if (score.tier === "worth_analyzing") {
    return `优先拆解：把「${title}」的家长决策钩子和图文结构改成少儿网球内容。`;
  }
  if (score.tier === "adaptable") {
    return `可改写：保留图文结构，不复制原文，转成家长决策或少儿网球认知内容。`;
  }
  if (score.tier === "hook_only") {
    return `只参考钩子：数据可能不错，但业务适配一般，不能直接进入选题库。`;
  }
  return "不建议使用：要么不贴合业务，要么风险/噪音较高。";
}

async function main() {
  const raw = await readFile(libraryPath, "utf8");
  const library = JSON.parse(raw);
  const items = Array.isArray(library.items) ? library.items : [];
  const ranked = items.map((item) => {
    const score = scoreFit(item);
    return {
      id: item.id,
      platform: item.platform,
      sourceType: sourceTypeOf(item),
      title: item.title,
      url: item.url,
      videoUrl: item.videoUrl || "",
      coverUrl: item.coverUrl || item.raw?.cover || "",
      author: item.author,
      metrics: item.metrics,
      score,
      suggestion: toSuggestion(item, score),
    };
  }).sort((a, b) => b.score.total - a.score.total);

  const summary = {
    total: ranked.length,
    worthAnalyzing: ranked.filter((item) => item.score.tier === "worth_analyzing").length,
    adaptable: ranked.filter((item) => item.score.tier === "adaptable").length,
    hookOnly: ranked.filter((item) => item.score.tier === "hook_only").length,
    notRecommended: ranked.filter((item) => item.score.tier === "not_recommended").length,
  };

  await writeFile(rankingPath, `${JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), summary, items: ranked }, null, 2)}\n`, "utf8");
  console.log(`已完成爆款适配筛选：${rankingPath}`);
  console.table(ranked.slice(0, 10).map((item) => ({
    tier: item.score.tier,
    total: item.score.total,
    hot: item.score.hotness,
    fit: item.score.relevance,
    title: String(item.title || "").slice(0, 24),
  })));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
