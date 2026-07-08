import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..", "..");
const outputPath = path.join(rootDir, "data", "hot-references.json");

function asArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    return value.split(/[,\s#，、]+/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function numberFrom(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = String(value).trim();
  if (!text) return 0;
  const multiplier = /万/.test(text) ? 10000 : 1;
  const matched = text.match(/[\d.]+/);
  return matched ? Math.round(Number(matched[0]) * multiplier) : 0;
}

function first(...values) {
  for (const value of values) {
    if (value === 0) return value;
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
  }
  return "";
}

function guessPlatform(item = {}, filePath = "") {
  const text = `${filePath} ${item.platform || ""} ${item.source || ""} ${item.note_id || ""} ${item.aweme_id || ""}`.toLowerCase();
  if (/xhs|xiaohongshu|小红书|note/.test(text)) return "xhs";
  if (/douyin|抖音|aweme/.test(text)) return "douyin";
  return "unknown";
}

function normalizeSourceType(value) {
  const text = String(value || "").trim().toLowerCase();
  if (["video", "视频"].includes(text)) return "video";
  if (["normal", "image", "images", "note", "graphic", "图文"].includes(text)) return "image";
  return "unknown";
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === "\"" && inQuotes && next === "\"") {
      current += "\"";
      index += 1;
      continue;
    }
    if (char === "\"") {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  values.push(current);
  return values;
}

function parseCsv(raw, filePath) {
  const text = raw.replace(/^\uFEFF/, "");
  const rows = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === "\"" && inQuotes && next === "\"") {
      current += "\"\"";
      index += 1;
      continue;
    }
    if (char === "\"") inQuotes = !inQuotes;
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (current.trim()) rows.push(current);
      current = "";
      if (char === "\r" && next === "\n") index += 1;
      continue;
    }
    current += char;
  }
  if (current.trim()) rows.push(current);
  if (rows.length < 2) return [];
  const headers = parseCsvLine(rows[0]).map((header) => header.replace(/^\uFEFF/, "").trim());
  return rows.slice(1).map((row, rowIndex) => {
    const values = parseCsvLine(row);
    const item = {};
    headers.forEach((header, index) => {
      item[header] = values[index] ?? "";
    });
    item.__rowIndex = rowIndex + 2;
    item.__sourceFormat = "csv";
    return item;
  }).filter((item) => Object.values(item).some((value) => String(value || "").trim()));
}

function normalizeOne(item, filePath, index) {
  const platform = guessPlatform(item, filePath);
  const sourceId = first(item.note_id, item.noteId, item.noteIdStr, item.aweme_id, item.awemeId, item.video_id, item.id, item.item_id);
  const title = first(item.title, item.desc, item.description, item.content, item.share_info?.title);
  const content = first(item.content, item.desc, item.description, item.note_content, item.text);
  const author = first(item.nickname, item.nick_name, item.user?.nickname, item.author?.nickname, item.user_name);
  const url = first(item.url, item.note_url, item.share_url, item.web_url, item.video_url);
  const videoUrl = first(item.video_url, item.videoUrl, item.video?.url);
  const coverUrl = first(item.cover, item.cover_url, item.image_url, item.image_list);
  const sourceType = normalizeSourceType(first(item.type, item.note_type, item.media_type));
  const tags = [
    ...asArray(item.tags),
    ...asArray(item.tag_list),
    ...asArray(item.hashtags),
    ...asArray(item.hash_tag),
  ].slice(0, 20);
  const metrics = {
    likes: numberFrom(first(item.liked_count, item.like_count, item.digg_count, item.likes)),
    collects: numberFrom(first(item.collected_count, item.collect_count, item.collects)),
    comments: numberFrom(first(item.comment_count, item.comments)),
    shares: numberFrom(first(item.share_count, item.shares)),
  };
  const idSource = sourceId || `${path.basename(filePath)}-${index}`;
  const safeId = `${platform}-${idSource}`.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-");

  return {
    id: safeId,
    platform,
    sourceId,
    url,
    videoUrl,
    coverUrl,
    sourceType,
    title,
    content,
    author,
    tags,
    metrics,
    importedAt: new Date().toISOString(),
    sourceFile: path.basename(filePath),
    raw: {
      createTime: first(item.create_time, item.time, item.publish_time),
      type: first(item.type, item.note_type, item.media_type),
      cover: coverUrl,
    },
  };
}

function parseJsonLike(raw, filePath) {
  const text = raw.trim();
  if (!text) return [];
  if (/\.csv$/i.test(filePath)) return parseCsv(raw, filePath);
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.data)) return parsed.data;
    if (Array.isArray(parsed.items)) return parsed.items;
    if (Array.isArray(parsed.notes)) return parsed.notes;
    return [parsed];
  } catch {
    return text.split(/\n+/).map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`${filePath} 第 ${index + 1} 行不是合法 JSON：${error.message}`);
      }
    });
  }
}

async function loadExisting() {
  try {
    const raw = await readFile(outputPath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch {
    return [];
  }
}

async function main() {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error("请传入 MediaCrawler 导出的 JSON / JSONL / CSV 文件路径。");
    console.error("示例：node tools/mediacrawler/import-mediacrawler.mjs ~/MediaCrawler/data/xhs/csv/creator_contents_2026-01-19.csv");
    process.exit(1);
  }

  const imported = [];
  for (const file of files) {
    const filePath = path.resolve(file.replace(/^~/, process.env.HOME || "~"));
    const raw = await readFile(filePath, "utf8");
    parseJsonLike(raw, filePath).forEach((item, index) => {
      const normalized = normalizeOne(item, filePath, index);
      if (normalized.title || normalized.content) imported.push(normalized);
    });
  }

  const existing = await loadExisting();
  const byId = new Map(existing.map((item) => [item.id, item]));
  imported.forEach((item) => byId.set(item.id, { ...(byId.get(item.id) || {}), ...item }));
  const items = Array.from(byId.values()).sort((a, b) => {
    const aScore = (a.metrics?.likes || 0) + (a.metrics?.collects || 0) * 2 + (a.metrics?.comments || 0) * 3;
    const bScore = (b.metrics?.likes || 0) + (b.metrics?.collects || 0) * 2 + (b.metrics?.comments || 0) * 3;
    return bScore - aScore;
  });

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), items }, null, 2)}\n`, "utf8");
  console.log(`已导入 ${imported.length} 条，参考库现有 ${items.length} 条：${outputPath}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
