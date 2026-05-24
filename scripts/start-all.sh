#!/usr/bin/env bash
#
# agentNews — 통합 부팅 스크립트
# 사용: ./scripts/start-all.sh
#   1. Docker (PostgreSQL + MinIO) 부팅
#   2. 백엔드 빌드 + 실행 (port 3000)
#   3. Expo dev server 부팅 (LAN, port 8081)
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "🟦 [1/4] Docker — PostgreSQL + MinIO..."
docker compose -f infra/docker-compose.yml up -d
sleep 5

echo "🟦 [2/4] Backend — build + start..."
cd "$ROOT/apps/backend"
# 기존 백엔드 죽이기
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
sleep 1
# 직접 tsc 빌드 (nest build 가 일부 환경에서 silent fail 함)
npx tsc --noEmit false --outDir ./dist --rootDir ./src \
  --module commonjs --moduleResolution node --target ES2022 \
  --experimentalDecorators --emitDecoratorMetadata \
  --esModuleInterop --skipLibCheck src/main.ts >/dev/null
nohup node dist/main.js > /tmp/agentnews-backend.log 2>&1 &
sleep 6
if curl -sf http://localhost:3000/api/v1/health >/dev/null; then
  echo "   ✓ backend up — http://localhost:3000/api/v1/health"
else
  echo "   ✗ backend failed — check /tmp/agentnews-backend.log"
  tail -20 /tmp/agentnews-backend.log
  exit 1
fi

echo "🟦 [3/4] Expo — LAN dev server..."
cd "$ROOT/apps/mobile"
pkill -f "expo start" 2>/dev/null || true
pkill -f "metro" 2>/dev/null || true
sleep 2
nohup npx expo start --lan > /tmp/agentnews-expo.log 2>&1 &
sleep 10
LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "192.168.0.49")
if curl -sf "http://${LAN_IP}:8081" >/dev/null; then
  echo "   ✓ expo up — http://${LAN_IP}:8081"
else
  echo "   ✗ expo failed — check /tmp/agentnews-expo.log"
  tail -20 /tmp/agentnews-expo.log
  exit 1
fi

echo "🟦 [4/4] 준비 완료"
echo ""
echo "================================================================"
echo "📱 폰의 Expo Go 앱에서 다음 URL 입력 (또는 QR 스캔):"
echo "    exp://${LAN_IP}:8081"
echo ""
echo "🔧 API URL (참고):   http://${LAN_IP}:3000/api/v1"
echo "🔧 MinIO 콘솔:       http://localhost:9001  (id: agentnews / pw: agentnews_dev)"
echo "🔧 Postgres:         postgresql://agentnews:agentnews_dev@localhost:5432/agentnews"
echo "================================================================"
echo ""
echo "로그 보기:"
echo "  tail -f /tmp/agentnews-backend.log"
echo "  tail -f /tmp/agentnews-expo.log"
echo ""
echo "종료:"
echo "  ./scripts/stop-all.sh"
