#!/usr/bin/env bash
#
# agentNews — 위장 검수 grep (handoff §12 / §5)
# 외부 노출 문자열에 위장 위배 단어 포함 검수.
#
# 정책:
# - "비밀번호" / "상태 메시지" 같은 합법적 변형은 OK
# - import / type 식별자는 OK (코드 내부, 사용자 노출 X)
# - 위배 = UI 텍스트로 그대로 노출되는 단독 위장 어휘
#
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TARGET_DIRS=(
  "apps/mobile/src/screens"
)

violations=0

check() {
  local word="$1"
  local description="$2"
  for dir in "${TARGET_DIRS[@]}"; do
    matches=$(grep -rn -E "['\"\>][^'\"\<]*${word}" "$dir" 2>/dev/null \
      | grep -v "^[^:]*:[0-9]*:import" \
      | grep -v "비밀번호" \
      | grep -v "상태 메시지" \
      | grep -v "ChatMessage" \
      | grep -v "useChat" \
      || true)
    if [ -n "$matches" ]; then
      echo "✗ '$word' 노출 ($description):"
      echo "$matches"
      echo
      violations=$((violations + 1))
    fi
  done
}

check "채팅" "외부 어휘 위배 — '기사 토론'으로 대체"
check "비밀(?!번호)" "외부 어휘 위배"
check "메시지" "외부 어휘 위배 — '댓글'로 대체"
check "에이전트" "외부 어휘 위배"
check "[^A-Za-z]Chat[A-Z]" "Chat 식별자 노출"
check "[^A-Za-z]Secret[A-Z]" "Secret 식별자 노출"

if [ $violations -eq 0 ]; then
  echo "✓ 위장 grep PASS — 외부 노출 문자열에 금지 단어 0건"
  echo ""
  echo "수동 검수 체크리스트 (handoff §12):"
  echo "  [ ] 워드마크 탭 시 외관 변화 0 (토스트/애니/소리/진동 모두 X)"
  echo "  [ ] 카드 오탭 reset 시 시각 피드백 0"
  echo "  [ ] auto-disarm (8초) silent"
  echo "  [ ] 채팅 모드 헤더 = '기사 토론'"
  echo "  [ ] 채팅 입력 placeholder = '댓글 입력'"
  echo "  [ ] App Switcher 백그라운드 시 채팅 → blur swap"
  echo "  [ ] 푸시 payload 에 data 필드 없음 (notification only)"
  exit 0
else
  echo "✗ 위장 검수 실패 — $violations 종 위반"
  exit 1
fi
