# MediaCrawler 接入说明

这个目录用于把 MediaCrawler 采集到的小红书 / 抖音参考内容，清洗成 Super Tennis Agent 可以读取的「爆款参考库」。

先采用松耦合方式：

1. MediaCrawler 负责采集公开参考内容。
2. `import-mediacrawler.mjs` 负责把采集结果标准化。
3. 标准化结果写入 `data/hot-references.json`。
4. 后续爆款拆解 Agent 读取这个库，再生成「可借鉴结构」「不适合照搬点」「网球场本地化方向」。

这样做的好处是：爬虫登录、风控、平台规则变化，不会影响主应用的内容生产功能。

## 安装 MediaCrawler

建议把 MediaCrawler 放在项目外部，避免把大量爬虫依赖和登录缓存混进当前产品仓库。

```bash
cd ~
git clone https://github.com/NanmiCoder/MediaCrawler.git
cd MediaCrawler
```

按 MediaCrawler 自己的 README 配置 Python、Playwright、登录方式和采集平台。

## 推荐采集关键词

先不要追求大而全，先围绕网球场真实业务采集 30-100 条：

- 广州 少儿网球
- 孩子 学网球
- 少儿运动 怎么选
- 网球体验课
- 亲子运动 广州
- 儿童专注力 运动
- 第一次学网球

平台建议先从小红书开始，再扩展抖音。

## 导入采集结果

把 MediaCrawler 导出的 JSON / JSONL 文件路径传给导入脚本：

```bash
node tools/mediacrawler/import-mediacrawler.mjs ~/MediaCrawler/data/xhs_notes.json
```

也可以一次导入多个文件：

```bash
node tools/mediacrawler/import-mediacrawler.mjs ~/MediaCrawler/data/xhs.json ~/MediaCrawler/data/douyin.json
```

导入后会生成或更新：

```text
data/hot-references.json
```

## 自动筛选“适合我们的爆款”

导入后先跑一遍筛选：

```bash
node tools/mediacrawler/rank-hot-references.mjs
```

它会输出：

```text
data/hot-reference-rankings.json
```

筛选不是只看点赞，而是综合：

- 热度分：点赞、收藏、评论、分享
- 业务适配分：是否贴近网球、家长、孩子、少儿运动、体验课、本地门店
- 可改写分：是否能安全改成 Super 超极网球自己的选题
- 风险扣分：是否有过度营销、导流、绝对承诺、无关泛内容

结果会分成：

- `worth_analyzing`：优先拆解
- `adaptable`：可改写
- `hook_only`：只参考钩子
- `not_recommended`：不建议使用

## 拆解某条参考

先筛选，再让 Agent 拆解最值得看的那条：

```bash
SUPER_TENNIS_URL=http://127.0.0.1:5202 node tools/mediacrawler/analyze-reference.mjs
```

也可以指定某条：

```bash
SUPER_TENNIS_URL=http://127.0.0.1:5202 node tools/mediacrawler/analyze-reference.mjs xhs-xxxx
```

## 打开爆款参考库页面

本地服务启动后，可以打开：

```text
http://127.0.0.1:5202/tools/mediacrawler/hot-reference-board.html
```

这个页面会读取：

- `data/hot-references.json`
- `data/hot-reference-rankings.json`

如果没有先运行 `rank-hot-references.mjs`，页面也会在浏览器里临时计算分层，方便快速预览。

## 使用边界

这个库只用于「学习结构与运营思路」，不要复制别人原文、封面、图片或未经确认的数据。

拆解时要重点输出：

- 为什么它可能吸引家长停留
- 选题钩子是什么
- 内容结构是什么
- 评论或收藏动机是什么
- 哪些表达不适合我们照搬
- 如何改成本地网球场可用的版本
