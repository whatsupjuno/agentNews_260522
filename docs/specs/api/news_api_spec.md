# news API 명세서 v1.0

---

## 1. 개요

news API 는 외부 뉴스 API 와 연동된 캐시된 기사 피드를 제공한다. 본 도메인은 위장 SaaS 의 *겉면* 이므로 외부에서 일반 뉴스 앱과 구분 불가해야 한다.

| 사용자 유형 | 인증 방식 |
|---|---|
| 에이전트 (agent) | JWT access token |

**공통 규칙**:
- 캐시 TTL 10분 (REQ-004). 캐시 hit 시 외부 API 호출 안 함
- 외부 API 호출 실패 시 *직전* 캐시 batch 반환 (빈 피드 절대 표시 안 함 — REQ-004 acceptance)
- 응답 모드: **일반** (이 도메인은 노출이 정상이므로 위장 변환 불필요). 단, 형식·필드는 일반 뉴스 API 와 구별 불가하도록 표준적
- 미인증 / 토큰 만료도 동일 형식 응답 (위장 유지: `news/feed` 만 401 응답해도 외부에서는 평범한 미인증 API 처럼 보임). access token 만료 시 401 + `AUTH_TOKEN_EXPIRED` 반환 — 모바일이 refresh 후 재시도
- 기사의 노출 순서 인덱스 (`displayOrder`) 는 응답에 포함 (시퀀스 검증 진입점), **단** 클라이언트는 UI 에서 표시하지 않음 (REQ-005 acceptance)

---

## 2. 엔드포인트 목록

| # | 메서드 | URL | 설명 | 인증 |
|---|---|---|---|---|
| 1 | GET | `/api/v1/news/feed` | 뉴스 피드 목록 (캐시 우선) | 필요 |
| 2 | GET | `/api/v1/news/articles/:articleId` | 단일 기사 상세 조회 (in-app webview 또는 메타 표시) | 필요 |
| 3 | POST | `/api/v1/news/feed/refresh` | 강제 새로고침 (외부 API 즉시 호출, rate-limited) | 필요 |

---

## 3. 공통 응답 포맷

development_conventions §4-2 (일반) 사용.

---

## 4. 엔드포인트 상세

### 4-1. 뉴스 피드 목록

**메서드 + URL**: `GET /api/v1/news/feed`

**설명**: 캐시된 뉴스 기사 배치(batch)의 노출 순서대로 목록을 반환한다. 캐시 TTL 10분. 캐시가 비어있거나 만료된 경우 외부 API 호출 → 신규 batch 적재 후 반환. 외부 API 실패 시 직전 유효 batch fallback (REQ-004).

**인증**: 필요

**권한**: agent (permission_policy §4-1-1, news_articles_cache "조회 — 모두")

**Request Headers**:
- `Authorization: Bearer <access>` (필수)

**Query Parameters**:
- `size`: int (1..50, default 20) — 반환 기사 수

**Request Body**: 없음

**처리 흐름**:
1. JwtAuthGuard
2. 현재 활성 batch 조회: `news_articles_cache WHERE fetched_at > now() - INTERVAL '10 minutes' ORDER BY fetched_at DESC LIMIT 1` 의 batch_id
3. 활성 batch 있으면 → `SELECT ... FROM news_articles_cache WHERE batch_id=? ORDER BY display_order ASC LIMIT ?`
4. 없으면 외부 뉴스 API 호출 (NEWS_API_PROVIDER 분기: GNews / MediaStack / NewsAPI.org)
   - 트랜잭션: 신규 batch_id 생성 → INSERT N rows (display_order 1..N)
   - 새 batch 반환
5. 외부 API 실패 (4xx/5xx/timeout) → 직전 batch (TTL 무관 가장 최신) fallback. 그래도 0 rows 면 `NEWS_API_UNAVAILABLE`
6. 응답

**응답 (200 OK)**:
```json
{
  "success": true,
  "data": {
    "batchId": "uuid",
    "fetchedAt": "2026-05-19T11:55:00.000Z",
    "articles": [
      {
        "articleId": "uuid (= news_articles_cache 의 안전 id, internal 노출 안 함)",
        "displayOrder": 1,
        "title": "기사 제목",
        "summary": "요약 200자 이내",
        "thumbnailUrl": "https://...",
        "source": "Yonhap News",
        "publishedAt": "2026-05-19T10:00:00.000Z"
      }
    ]
  },
  "meta": { "timestamp": "...", "traceId": "..." }
}
```

**`articleId` 포맷**: `news_articles_cache.batch_id + ':' + display_order` 의 base64 인코딩 또는 별도 external_id 컬럼 (v1.1 추가 검토). v1 는 `<batch_id>:<display_order>` 문자열을 base64url 인코딩하여 1회용 id 로 사용.

**에러**:
| 코드 | HTTP | 발생 조건 |
|---|---|---|
| `AUTH_TOKEN_EXPIRED` | 401 | access 만료 |
| `AUTH_TOKEN_INVALID` | 401 | - |
| `NEWS_VALIDATION_ERROR` | 400 | size 파라미터 범위 위반 |
| `NEWS_API_UNAVAILABLE` | 503 | 외부 API + 캐시 모두 실패 |
| `INTERNAL_ERROR` | 500 | - |

**부수효과**:
- 외부 API 호출 시: news_articles_cache 신규 batch 적재
- audit 미기록 (빈번 조회)

---

### 4-2. 단일 기사 상세 조회

**메서드 + URL**: `GET /api/v1/news/articles/:articleId`

**설명**: 피드 목록에서 선택한 기사의 메타 정보 (title / summary / url / thumbnail / source / publishedAt) 를 반환한다. RN 측은 응답의 `url` 을 in-app webview 또는 OS browser 로 띄운다.

**인증**: 필요

**권한**: agent (permission_policy §4-1-1, news_articles_cache "조회")

**Request Headers**:
- `Authorization: Bearer <access>` (필수)

**Path Parameters**:
- `articleId`: string (필수, base64url 인코딩 `<batch_id>:<display_order>`)

**Request Body**: 없음

**처리 흐름**:
1. JwtAuthGuard
2. articleId base64url 디코드 → `(batch_id, display_order)`. 형식 위반 시 `NEWS_ARTICLE_NOT_FOUND` (status 404)
3. `news_articles_cache WHERE batch_id=? AND display_order=?` 조회
4. 미존재 → `NEWS_ARTICLE_NOT_FOUND` 404
5. **단, 이 endpoint 가 시퀀스 검증의 진입점이기도 함** — RN 측은 응답을 단순 표시할 뿐, 시퀀스 검증은 별도 unlock API 호출 (`/api/v1/unlock/attempt`) 를 RN 이 백그라운드로 발사. news API 자체는 시퀀스 로직과 무관
6. 응답

**응답 (200 OK)**:
```json
{
  "success": true,
  "data": {
    "articleId": "base64url",
    "displayOrder": 5,
    "title": "기사 제목",
    "summary": "요약 본문 (해당 시)",
    "url": "https://...",
    "thumbnailUrl": "https://...",
    "source": "Yonhap News",
    "publishedAt": "..."
  },
  "meta": { "timestamp": "...", "traceId": "..." }
}
```

**에러**:
| 코드 | HTTP | 발생 조건 |
|---|---|---|
| `AUTH_TOKEN_EXPIRED` / `AUTH_TOKEN_INVALID` | 401 | - |
| `NEWS_ARTICLE_NOT_FOUND` | 404 | articleId 형식 위반 / batch 만료 / row 미존재 |
| `INTERNAL_ERROR` | 500 | - |

**부수효과**: 없음 (audit 미기록).

**중요**: 본 endpoint 의 `NEWS_ARTICLE_NOT_FOUND` 응답 형식은 위장 도메인 (`/pairings`, `/messages`, `/attachments`, `/unlock/attempt`) 의 위장 응답과 *동일* 하다 (dev_conventions §4-3). 따라서 외부에서 두 케이스를 식별할 수 없다 (SEC-006).

---

### 4-3. 강제 새로고침

**메서드 + URL**: `POST /api/v1/news/feed/refresh`

**설명**: 캐시 TTL 무시하고 외부 뉴스 API 를 즉시 호출하여 신규 batch 를 적재한다. rate limit 적용 — 동일 agent 가 60초 내 재호출 시 가장 최근 batch 만 반환.

**인증**: 필요

**권한**: agent (permission_policy §4-1-1)

**Request Headers**:
- `Authorization: Bearer <access>` (필수)
- `Idempotency-Key: <uuid>` (필수)

**Request Body**: 없음

**처리 흐름**:
1. JwtAuthGuard
2. rate limit 체크 (Redis or in-memory): 동일 agent_id 60초 쿨다운. 위반 시 `NEWS_REFRESH_COOLDOWN` (또는 최근 batch 반환 — 운영 결정. 권장: 최근 batch 반환 + 응답 헤더 `X-Cached: true`)
3. 외부 뉴스 API 호출. 실패 시 직전 batch fallback (응답 본문은 일반 피드와 동일 형식)
4. 신규 batch 적재 트랜잭션 (4-1 과 동일)
5. 응답 (피드 4-1 과 동일 본문 구조)

**응답 (200 OK)**: 4-1 과 동일.

**에러**:
| 코드 | HTTP | 발생 조건 |
|---|---|---|
| `AUTH_TOKEN_EXPIRED` / `AUTH_TOKEN_INVALID` | 401 | - |
| `NEWS_REFRESH_COOLDOWN` | 429 | 60초 내 재호출 (옵션 — 운영은 최근 batch 반환 권장) |
| `NEWS_API_UNAVAILABLE` | 503 | 외부 API + 캐시 모두 실패 |
| `IDEMPOTENCY_KEY_MISSING` | 400 | - |
| `IDEMPOTENCY_KEY_CONFLICT` | 409 | - |

**부수효과**:
- news_articles_cache 신규 batch (성공 시)
- audit 미기록

---

## 5. 권한 정합 (G3)

| 엔드포인트 | permission_policy 항목 | 일치 |
|---|---|---|
| GET /news/feed | news_articles_cache 조회 — 모두 (agent 인증) | ✓ |
| GET /news/articles/:articleId | 위와 동일 | ✓ |
| POST /news/feed/refresh | 위와 동일 + 60초 쿨다운 | ✓ |

---

## 6. DB 매핑 (G4)

| 엔드포인트 | 읽기 / 쓰기 |
|---|---|
| GET /news/feed | R: news_articles_cache. W: 외부 호출 시 INSERT batch |
| GET /news/articles/:articleId | R: news_articles_cache |
| POST /news/feed/refresh | R: news_articles_cache. W: 외부 호출 시 INSERT batch |

컬럼은 db_design §4-12 정의 따름.

---

## 7. 외부 API 어댑터 (infrastructure/news)

### 7-1. 어댑터 인터페이스

```typescript
interface NewsProvider {
  fetchTopHeadlines(language: 'ko'): Promise<NewsArticle[]>;
}
```

### 7-2. 구현체 (환경변수 `NEWS_API_PROVIDER` 분기)

- `gnews`: GNews.io (무료 100req/day)
- `mediastack`: mediastack.com (무료 500req/month)
- `newsapi`: NewsAPI.org (무료 100req/day, 개발용)

선정 기준: 한국어 지원 + 무료 tier + thumbnail URL 제공. 최종 선정은 운영 시점 환경 변수.

### 7-3. 응답 매핑

각 provider 의 응답을 `NewsArticle` DTO 로 정규화:

```typescript
type NewsArticle = {
  title: string;          // ≤ 300
  url: string;            // 외부 원본 URL
  thumbnailUrl?: string;
  summary?: string;       // ≤ 500
  source?: string;        // 발행처
  publishedAt?: Date;
};
```

순서: 외부 API 가 반환한 순서 그대로 `display_order` 1..N 부여. 어떠한 정렬 변경도 금지 (시퀀스 검증의 정합성).

### 7-4. 호출 정책

- timeout 5초
- 1회 재시도 (지수 백오프)
- 실패 시 fallback (직전 batch 반환)
- API key 는 `NEWS_API_KEY` 환경변수

---

## 8. 위장 / 보안 고려사항

1. **응답 형식이 일반 뉴스 API 와 구분 불가**: 필드명 / status code / 헤더 모두 RESTful 표준
2. **404 NEWS_ARTICLE_NOT_FOUND 형식이 위장 도메인의 응답과 동일** — 외부에서 보면 두 케이스가 같은 응답 (SEC-006)
3. **displayOrder 노출하되 UI 미표시**: 클라이언트가 시퀀스 검증을 위해 필요하지만 (5-3-1-7 의 숫자가 display_order 임), UI 에는 표시하지 않음 (REQ-005 acceptance)
4. **외부 API 키 직접 노출 금지**: 클라이언트가 외부 API 직접 호출 X. 백엔드 경유만
5. **캐시 폭주 방지**: 동일 batch_id 의 중복 적재 차단 (트랜잭션 advisory lock)
6. **외부 API 응답 신뢰**: 외부 응답의 HTML / 스크립트는 sanitize. summary 는 plain text 만

---

## 전제 / 우선순위 적용

- **응답 모드 = 일반**: 본 도메인은 외부 노출이 정상. 위장 변환 불필요
- **displayOrder = 시퀀스 검증 기준**: 외부 API 순서 변경 시 시퀀스가 깨지므로, 캐시 batch 동안 안정성 보장 (10분 TTL 동안 displayOrder 불변)
- **fallback 정책**: 외부 API 실패 시 직전 batch 반환. 빈 피드 표시 절대 금지 (REQ-004)
- **PUT 미사용**: refresh 는 POST (의미적으로 idempotent 가 아니므로)
- **우선순위**: Juno 지시 > brief > intake > 매뉴얼 > skill > 메모리

---

_작성: WA-Arch (Claude Opus 4.7) — PLAN-003-DOC-API-NEWS_
