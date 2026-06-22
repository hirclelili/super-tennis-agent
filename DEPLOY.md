# 部署与日常更新指南

这套系统是一个常驻运行的 Node 服务（`server.js` 同时提供 API 和前端页面），
团队通过 `http://服务器IP:端口` 访问，所有数据存在服务器本地 `data/` 目录里，天然共享。

---

## 一、数据是怎么分的（重要）

| 文件 | 是否进 Git | 说明 |
| --- | --- | --- |
| `server.js` / `app.js` / `index.html` / `styles.css` | ✅ 进 | 代码 |
| `data/junior-topic-angle-framework.json` | ✅ 进 | 框架配置，代码依赖它 |
| `data/venue-profile.json` | ❌ 不进 | 球场档案（运营数据） |
| `data/topic-library.json` | ❌ 不进 | 选题库（运营数据） |
| `data/finished-content.json` | ❌ 不进 | 成品库（运营数据） |
| `data/weekly-plan.json` | ❌ 不进 | 一周计划（运营数据） |
| `data/ai-settings.local.json` | ❌ 不进 | **含 API 密钥，绝不入库** |

原因：运营数据在服务器上由团队不断积累。如果它们进 Git，每次 `git pull` 都会和服务器上的最新数据冲突/被覆盖。
所以约定：**代码走 Git 同步；运营数据只在服务器本地，首次部署时手动拷一次。**

---

## 二、首次部署（一次性）

### 1. 本地：把代码推到 GitHub

在本机项目目录执行（仓库还没初始化时）：

```bash
git init
git add .
git commit -m "init: super tennis agent"
git branch -M main
git remote add origin git@github.com:你的用户名/super-tennis-agent.git   # 或 https 地址
git push -u origin main
```

> 因为 `.gitignore` 的存在，`data/` 里的运营数据和密钥不会被推上去，这是对的。

### 2. 服务器：装环境 + 拉代码

SSH 登录腾讯云服务器后：

```bash
# 装 Node 18+（以 Ubuntu 为例，用 nvm 最省心）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 18

# 拉代码
cd ~
git clone git@github.com:你的用户名/super-tennis-agent.git
cd super-tennis-agent
```

### 3. 服务器：把运营数据和密钥放上去（关键，只做一次）

代码里不含这几个文件，需要你手动放到服务器的 `data/` 目录。

**方式 A：从本机一次性上传（推荐）**

在**本机**项目目录执行（把数据拷到服务器）：

```bash
scp data/venue-profile.json data/topic-library.json data/ai-settings.local.json \
    用户名@服务器IP:~/super-tennis-agent/data/
```

`finished-content.json` / `weekly-plan.json` 如果本地有就一起拷，没有会在运行时自动生成。

**方式 B：在服务器上重新配置**

直接启动服务后，用网页里的「球场档案」「AI 设置」表单重新填一遍即可（选题库会从空开始）。

### 4. 服务器：常驻运行

```bash
npm i -g pm2
cd ~/super-tennis-agent
PORT=80 pm2 start server.js --name tennis-agent
pm2 save
pm2 startup        # 按提示再执行它输出的那条命令，实现开机自启
```

### 5. 放行端口

在腾讯云控制台 → 安全组 → 入站规则，放行你用的端口（上面用的是 80）。
然后团队浏览器访问 `http://服务器IP`（80 端口可省略端口号）。

---

## 三、日常更新（以后每次改完代码）

1. 我在本地帮你改好代码后，你在**本机**执行：

```bash
git add .
git commit -m "本次改动说明"
git push
```

2. 在**服务器**执行：

```bash
cd ~/super-tennis-agent
git pull
pm2 restart tennis-agent
```

几秒生效。`git pull` 只更新代码，**不会动 `data/` 里的运营数据**，团队积累的选题/成品/档案都安全。

---

## 四、常用运维命令

```bash
pm2 status                 # 看运行状态
pm2 logs tennis-agent      # 看实时日志（排查问题）
pm2 restart tennis-agent   # 重启
pm2 stop tennis-agent      # 停止
```

---

## 五、备份建议

运营数据只在服务器本地，建议定期备份 `data/` 目录（除已忽略的密钥外）：

```bash
cd ~/super-tennis-agent
tar czf ~/tennis-data-backup-$(date +%Y%m%d).tgz data/
```
