# agentNews — 테스트 가이드

> 일어나서 폰으로 직접 만져보는 절차. 1인 self-test (echo bot 페어링 자동).

---

## 1. 폰 준비 (1회)

1. **iOS** 앱스토어 / **Android** Play 스토어에서 **Expo Go** 설치
2. 폰을 **같은 WiFi** 에 연결 (Mac 과 동일)

---

## 2. 서비스 시작

대부분의 경우 이미 부팅되어 있어요 (작업 종료 시점에 살아있게 둠). 만약 종료됐다면:

```bash
cd /Users/whatsupjuno/WTF/agentNews
./scripts/start-all.sh
```

성공 시 출력 마지막에:
```
📱 폰의 Expo Go 앱에서 다음 URL 입력 (또는 QR 스캔):
    exp://192.168.0.49:8081
```

---

## 3. 폰에서 앱 실행

1. **Expo Go** 앱 열기
2. 상단 "**Enter URL manually**" 또는 카메라 QR 스캐너로 위 URL 입력
3. 잠시 번들 다운로드 (8.7MB) 후 **DailyNews** 로고가 보이는 로그인 화면 진입

---

## 4. 회원가입 → 채팅 모드 진입 (★ 핵심 시나리오)

### 4-1. 회원가입
1. 로그인 화면 우측 빨간 **"회원가입"** 핀 탭
2. 아무 이메일 (예: `juno@local.dev`) + ID (`juno_test`) + 비밀번호 8자 이상
3. **계정 만들기** → 자동 로그인 → 뉴스 피드 진입

### 4-2. 회원가입 시 자동 처리 (백엔드 데모 모드)
- 잠금 코드 `[5, 3, 1, 7]` 자동 등록
- 전용 **에코봇** 자동 페어링 (PAIRED 상태)
- 첫 댓글 2개 자동 시드 (봇이 인사)

### 4-3. 워드마크 ARM (위장 진입)
1. 뉴스 피드 상단의 큰 **"DailyNews"** 워드마크 탭
2. **외관 변화 0** — 토스트 / 애니 / 소리 / 진동 모두 없음 (위장 원칙)
3. 내부적으로 ARM 모드 활성 (8초 카운트다운)

### 4-4. 5 → 3 → 1 → 7 시퀀스
1. ARM 후 8초 안에 카드 차례로 탭:
   - **5번 카드**: "도시 재생 프로젝트..."
   - **3번 카드**: "신형 전기차 배터리..."
   - **1번 카드 (hero)**: "기후 정상회담..."
   - **7번 카드**: "AI 윤리 가이드라인..."
2. 4번째 탭 (7번) 즉시 **기사 상세 화면** 으로 이동
3. 화면이 자동으로 **채팅 모드 (기사 토론)** 으로 swap — 헤더 타이틀 변화

### 4-5. 채팅
1. 봇의 시드 댓글 2개 보임
2. 하단 "댓글 입력" 에 아무 텍스트 입력 → ↑ 버튼
3. 0.8초 후 봇이 자동 응답 (WebSocket 실시간)

---

## 5. 위장 원칙 검증 (수동)

| 항목 | 기대 동작 |
|---|---|
| 워드마크 탭 | 외관 변화 0 (silent) |
| ARM 8초 경과 (auto-disarm) | 외관 변화 0 |
| 잘못된 카드 탭 (예: 5→2) | 시퀀스 reset (silent). 위장 동작 = 평범한 기사 열람 X (armed 상태) |
| 워드마크 두 번째 탭 | ARM 해제 (silent) |
| 시퀀스 완성 | 4번째 탭 직후 채팅 swap = 유일한 외부 신호 |
| 채팅 모드에서 홈 버튼 (백그라운드) | iOS: blur overlay / Android: FLAG_SECURE 활성 |
| 채팅 모드 → 5초+ 백그라운드 → 복귀 | 자동 disarm + 뉴스 피드로 돌아옴 |
| 채팅 모드 → 홈 버튼 1초 후 복귀 | 채팅 유지 (5초 미만) |

---

## 6. 설정 + 데이터 삭제

1. 우상단 아바타 또는 하단 탭바 "설정" 진입
2. **프로필 편집** → 닉네임 변경 + 저장
3. 하단 빨간 "**데이터 삭제**" → 풀스크린 확인 모달
4. "삭제" 입력 → 빨간 CTA 활성화 → 데이터 삭제
5. 자동 로그아웃 → 로그인 화면 복귀

---

## 7. 문제 발생 시

### "Expo Go 가 연결 못함"
- 폰과 Mac 이 **같은 WiFi** 인지 확인
- LAN IP 확인:
  ```bash
  ipconfig getifaddr en0  # 또는 en1
  ```
- Expo dev server 재시작:
  ```bash
  cd /Users/whatsupjuno/WTF/agentNews
  ./scripts/stop-all.sh
  ./scripts/start-all.sh
  ```

### "백엔드 응답 없음"
```bash
curl http://localhost:3000/api/v1/health  # 200 응답이어야
tail -f /tmp/agentnews-backend.log
```

### "회원가입 후 채팅 안 됨"
- 시퀀스가 등록됐는지 DB 확인:
  ```bash
  docker exec agentnews-postgres psql -U agentnews -d agentnews \
    -c "SELECT a.email, s.status FROM agents a JOIN agent_secret_sequences s ON s.agent_id = a.id;"
  ```
- 페어링 확인:
  ```bash
  docker exec agentnews-postgres psql -U agentnews -d agentnews \
    -c "SELECT requester_agent_id, recipient_agent_id, status FROM pairings;"
  ```

### "DB 리셋" (테스트 데이터 다 지우고 싶을 때)
```bash
docker exec agentnews-postgres psql -U agentnews -d agentnews -c "
  DELETE FROM messages;
  DELETE FROM pairings;
  DELETE FROM agent_secret_sequences;
  DELETE FROM refresh_tokens;
  DELETE FROM unlock_sessions;
  DELETE FROM agents;
"
```

### "Expo bundle 에러"
```bash
cd /Users/whatsupjuno/WTF/agentNews/apps/mobile
rm -rf .expo node_modules/.cache
cd ../..
pnpm install
cd apps/mobile
npx expo start --lan --clear
```

---

## 8. 알려진 한계 (Phase 1 / MVP)

- **iOS 시뮬레이터**: macOS 의 `xcrun simctl` 권한 문제로 시뮬레이터 부팅 X. 실기기 Expo Go 만 동작
- **첨부 업로드**: UI placeholder 만 (M4 추후 구현). MinIO 백엔드는 부팅 됨
- **위장 푸시 (FCM)**: Firebase 자격증명 미설정 → 백엔드 worker queue 만 동작. 실제 푸시 X
- **외부 뉴스 API**: GNews API key 미설정 → mock 풀 7개 기사 정적 노출
- **사용자 간 페어링**: Phase 1 deferred. 데모는 echo bot 자동 페어링. 두 명 친구가 서로 대화하려면 DB 직접 pairings INSERT 필요

---

## 9. 위장 검수 자동 grep

```bash
./scripts/disguise-grep.sh
```

외부 노출 문자열에서 "채팅 / 비밀 / 메시지 / 에이전트 / Chat / Secret" 검사. 통과해야 머지 가능.

---

작성: 2026-05-25 / agentNews MVP Phase 1
