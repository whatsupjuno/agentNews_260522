#!/usr/bin/env bash
#
# agentNews — 모든 서비스 종료
#
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "🟥 백엔드 종료..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

echo "🟥 Expo dev server 종료..."
pkill -f "expo start" 2>/dev/null || true
pkill -f "metro" 2>/dev/null || true

echo "🟥 Docker 종료..."
docker compose -f "$ROOT/infra/docker-compose.yml" down

echo "✓ 모든 서비스 종료"
