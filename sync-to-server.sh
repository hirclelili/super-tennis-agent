#!/bin/bash
# 一键把本机 main 分支推到 GitHub，再用 rsync 同步到服务器、重启服务。
#
# 为什么用 rsync 而不是服务器 git pull？
#   服务器 clone 用的是 git@github.com，若没配 GitHub SSH 公钥会报 Permission denied。
#   rsync 只走「本机 → 服务器」SSH，不依赖服务器访问 GitHub。
#
# 用法：./sync-to-server.sh "本次改动说明"（可选）
# 配置：export SERVER="ubuntu@你的公网IP"  可覆盖默认服务器地址

set -e

# 配置（按需改，或用环境变量 SERVER 覆盖）
SERVER="${SERVER:-ubuntu@1.14.186.152}"
REMOTE_DIR="~/super-tennis-agent"
BRANCH="main"

cd "$(dirname "$0")"

current_branch=$(git branch --show-current)
if [ "$current_branch" != "$BRANCH" ]; then
  echo "⚠️  当前在 $current_branch 分支，不在 $BRANCH。"
  echo "   继续吗？(y/n)"
  read -r ans
  [ "$ans" = "y" ] || exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  msg="${1:-chore: sync from $(hostname) at $(date '+%Y-%m-%d %H:%M:%S')}"
  echo "→ 提交改动：$msg"
  git add .
  git commit -m "$msg"
fi

echo "→ 推送到 GitHub ($BRANCH)..."
git push origin "$BRANCH"

echo "→ rsync 同步代码到服务器（不覆盖服务器上的运营数据）..."
rsync -avz \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude 'legacy-video-creator' \
  --exclude '.env' \
  --exclude '.DS_Store' \
  --exclude 'data/ai-settings.local.json' \
  --exclude 'data/venue-profile.json' \
  --exclude 'data/topic-library.json' \
  --exclude 'data/finished-content.json' \
  --exclude 'data/weekly-plan.json' \
  --exclude 'data/weekly-plans.json' \
  --exclude 'data/community-plans.json' \
  --exclude 'data/campaign-plans.json' \
  ./ "$SERVER:$REMOTE_DIR/"

echo "→ 重启服务..."
ssh "$SERVER" "cd $REMOTE_DIR && pm2 restart tennis-agent"

echo "→ 服务器最新日志..."
ssh "$SERVER" "pm2 logs tennis-agent --lines 8 --nostream --raw 2>&1 | tail -10"

echo ""
echo "✅ 完成。浏览器访问 http://${SERVER#*@}:8080/ 看效果（硬刷新 Cmd+Shift+R）。"
echo ""
echo "提示：若每次都要输服务器密码，可在本机执行 ssh-copy-id $SERVER 配置免密登录。"
