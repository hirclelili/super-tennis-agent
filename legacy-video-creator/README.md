# Super Tennis Agent

广州 Super 超级网球俱乐部专属宣发 Agent 副本，基于 `video-creator` 复制而来。后续会改成围绕网球场开业预热、日常招生、小红书图文、短视频脚本、素材识别和自动成片的专属工作台。

一个面向商家营销短视频的 Web MVP 原型，核心体验是：

- 输入店铺/产品背景和视频目标
- 生成 3 个策划主题方向
- 选择主题后生成可编辑分镜脚本
- 上传素材并管理预览
- 生成模拟剪辑结构和手机竖版预览
- 导出当前视频方案 JSON

## 本地运行

先创建 `.env`：

```bash
cp .env.example .env
```

然后把 DeepSeek API Key 填进去：

```env
DEEPSEEK_API_KEY=你的key
DEEPSEEK_MODEL=deepseek-v4-flash
ARK_API_KEY=你的火山方舟key
ARK_VISION_MODEL=doubao-seed-1-6-vision-250815
ARK_BASE_URL=https://ark.cn-beijing.volces.com
HOST=127.0.0.1
PORT=5173
```

启动本地服务：

```bash
npm run dev
```

然后访问：

```text
http://localhost:5173
```

如果没有配置 `DEEPSEEK_API_KEY`，页面仍可打开，但 AI 主题/脚本接口会提示缺少 key，并回退到本地 demo 模板。

## 本地目录和运行限制

运行时会自动创建这些本地目录：

- `uploads/`：保存用户上传的图片和视频素材
- `outputs/`：预留给后续真实视频导出结果
- `data/projects/current.json`：保存当前本地项目草稿

这些运行时目录已在 `.gitignore` 中忽略，不会把真实素材、导出视频和本地草稿提交进版本库。

可在 `.env` 中调整上传和渲染限制：

```env
UPLOADS_DIR=uploads
OUTPUTS_DIR=outputs
DATA_DIR=data
MAX_UPLOAD_FILES=20
MAX_ASSET_SIZE_MB=80
MAX_RENDER_SEGMENTS=12
MAX_RENDER_DURATION_SECONDS=180
MAX_RENDER_SEGMENT_SECONDS=30
MAX_RENDER_TEXT_LENGTH=220
```

当前支持上传：PNG、JPG、WebP、GIF、MP4、MOV、WebM。

渲染接口会在启动 FFmpeg 前检查镜头数量、视频总时长、单段时长和单段文字长度，避免异常脚本或过长视频让本地导出卡住。

## 素材识别和匹配

当前素材上传后会先生成本地基础画像，包括素材类型、横竖版、画质、疑似场景标签、使用建议和识别置信度。若配置了 `ARK_API_KEY`，图片素材会进一步调用火山方舟豆包视觉模型生成视觉画像。剪辑匹配会优先读取素材画像，再和每个脚本段的素材需求做评分匹配。

视觉模型结果会写入同一个 `profile` 结构，并把 `source` 标记为 `vision_model`。当前图片会直接识别，视频会先用 FFmpeg 抽取关键帧，再复用同一视觉识别接口生成素材画像。

## 后续可接入

- 多模态素材分析：识别图片/视频里的产品、场景、人物、可用镜头
- LLM Agent：当前已预留 DeepSeek API 后端代理，根据 brief 生成主题、脚本、修改建议
- 剪辑引擎：当前已接入项目内置 `ffmpeg-static` 生成 MP4，后续可继续升级 Remotion 模板
- TTS/字幕：旁白生成、字幕排版、平台规格导出
