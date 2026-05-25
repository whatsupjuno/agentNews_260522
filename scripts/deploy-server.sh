#!/usr/bin/env bash
#
# agentNews — server deploy script
# 실행 위치: /opt/apps/agentnews/scripts/deploy-server.sh (cafe24 서버)
# 호출자: GitHub Actions deploy.yml 또는 수동 ssh
#
set -euo pipefail

APP_DIR=/opt/apps/agentnews
cd "$APP_DIR"

echo "🟦 [1/5] git pull"
git fetch origin main
git reset --hard origin/main

echo "🟦 [2/5] pnpm install"
pnpm install --frozen-lockfile --prod=false

echo "🟦 [3/5] backend build"
cd "$APP_DIR/apps/backend"
rm -rf dist
npx tsc --noEmit false --outDir ./dist --rootDir ./src \
  --module commonjs --moduleResolution node --target ES2022 \
  --experimentalDecorators --emitDecoratorMetadata \
  --esModuleInterop --skipLibCheck src/main.ts

echo "🟦 [4/5] restart systemd unit"
systemctl restart agentnews-backend
sleep 5

echo "🟦 [5/5] health check"
if curl -fs http://localhost:3000/api/v1/health > /dev/null; then
  echo "✓ deploy ok"
else
  echo "✗ health check failed — see /var/log/agentnews-backend.log"
  tail -30 /var/log/agentnews-backend.log
  exit 1
fi
