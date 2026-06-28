#!/bin/bash
# 一键把本机 main 分支推到 GitHub，再让服务器拉代码、重启服务。
# 用法：./sync-to-server.sh "本次改动说明"（可选）
#
# 第一次运行时会问服务器 SSH 密码。配过 SSH 密钥后不用再输。

set -e

# 配置（按需改）
SERVER="ubuntu@1.14.186.152"
REMOTE_DIR="~/super-tennis-agent"
BRANCH="main"

# 进入项目根
cd "$(dirname "$0")"

# 检查分支
current_branch=$(git branch --show-current)
if [ "$current_branch" != "$BRANCH" ]; then
  echo "⚠️  当前在 $current_branch 分支，不在 $BRANCH。"
  echo "   继续吗？(y/n)"
  read -r ans
  [ "$ans" = "y" ] || exit 1
fi

# 检查工作区
if [ -n "$(git status --porcelain)" ]; then
  # 有未提交改动 → 自动 commit（用传入的消息或自动消息）
  msg="${1:-chore: sync from $(hostname) at $(date '+%Y-%m-%d %H:%M:%S')}"
  echo "→ 提交改动：$msg"
  git add .
  git commit -m "$msg"
fi

# 推 GitHub
echo "→ 推送到 GitHub ($BRANCH)..."
git push origin "$BRANCH"

# 服务器拉 + 重启
echo "→ 通知服务器拉代码..."
ssh "$SERVER" "cd $REMOTE_DIR && git pull && pm2 restart tennis-agent"

# 看启动日志
echo "→ 服务器最新日志（5 秒）..."
ssh "$SERVER" "pm2 logs tennis-agent --lines 8 --nostream --raw 2>&1 | tail -10"

echo ""
echo "✅ 完成。浏览器访问 http://1.14.186.152:8080/ 看效果。"