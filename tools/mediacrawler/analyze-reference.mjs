import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..", "..");
const libraryPath = path.join(rootDir, "data", "hot-references.json");
const rankingPath = path.join(rootDir, "data", "hot-reference-rankings.json");

function score(item) {
  const metrics = item.metrics || {};
  return (metrics.likes || 0) + (metrics.collects || 0) * 2 + (metrics.comments || 0) * 3 + (metrics.shares || 0) * 2;
}

async function loadRanking() {
  try {
    const raw = await readFile(rankingPath, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
}

function buildPrompt(item) {
  return [
    "请拆解这条小红书/抖音参考内容，但不要照抄它。",
    "目标：帮助一个广州网球场学习爆款结构，转化为自己的少儿网球/亲子运动/开业引流内容。",
    "",
    "请输出：",
    "1. 这条内容吸引停留的核心原因",
    "2. 标题/封面钩子拆解",
    "3. 内容结构拆解",
    "4. 评论或收藏动机",
    "5. 哪些地方不适合我们照搬",
    "6. 可以改造成的 5 个网球场选题",
    "7. 最推荐的一条本地化内容方案",
    "",
    `平台：${item.platform}`,
    `标题：${item.title}`,
    `正文：${item.content}`,
    `数据：点赞 ${item.metrics?.likes || 0}，收藏 ${item.metrics?.collects || 0}，评论 ${item.metrics?.comments || 0}，分享 ${item.metrics?.shares || 0}`,
    `标签：${(item.tags || []).join("、")}`,
  ].join("\n");
}

async function main() {
  const raw = await readFile(libraryPath, "utf8");
  const library = JSON.parse(raw);
  const items = Array.isArray(library.items) ? library.items : [];
  if (!items.length) throw new Error("参考库为空，请先运行 import-mediacrawler.mjs。");

  const ranking = await loadRanking();
  const bestRanked = ranking.find((item) => item.score?.tier === "worth_analyzing")
    || ranking.find((item) => item.score?.tier === "adaptable")
    || ranking[0];
  const target = process.argv[2]
    ? items.find((item) => item.id === process.argv[2] || item.sourceId === process.argv[2])
    : (items.find((item) => item.id === bestRanked?.id) || [...items].sort((a, b) => score(b) - score(a))[0]);
  if (!target) throw new Error("找不到指定参考内容。");
  const targetRanking = ranking.find((item) => item.id === target.id);

  const baseUrl = process.env.SUPER_TENNIS_URL || "http://127.0.0.1:5173";
  const token = process.env.ACCESS_TOKEN || "";
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/agent/free-chat`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      message: buildPrompt(target),
      context: {
        source: "mediacrawler-reference",
        referenceId: target.id,
        ranking: targetRanking?.score || null,
        rankingSuggestion: targetRanking?.suggestion || "",
      },
      history: [],
      attachments: [],
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "拆解请求失败");

  const nextItems = items.map((item) => item.id === target.id
    ? { ...item, analysis: data.reply || "", analyzedAt: new Date().toISOString(), aiMeta: data.aiMeta || null }
    : item);
  await writeFile(libraryPath, `${JSON.stringify({ ...library, updatedAt: new Date().toISOString(), items: nextItems }, null, 2)}\n`, "utf8");
  console.log(data.reply || "拆解完成");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
