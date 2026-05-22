# @agentnews/backend

NestJS 10 + TypeScript + TypeORM 백엔드. Clean Architecture 4계층.

## 구조

```
src/
├─ presentation/       # HTTP / WS 진입점
│  ├─ controllers/     # REST Controller (@Controller)
│  ├─ gateways/        # WebSocket Gateway
│  ├─ dto/             # Request / Response DTO (class-validator)
│  ├─ guards/          # JwtAuthGuard, UnlockTokenGuard, IdempotencyGuard
│  ├─ filters/         # DisguiseExceptionFilter (위장 응답 변환)
│  ├─ interceptors/    # ResponseFormatInterceptor, AuditLogInterceptor
│  └─ decorators/      # @DisguiseOnError() 등
├─ application/
│  ├─ use-cases/       # SendMessageUseCase, RequestPairingUseCase ...
│  ├─ commands/        # CQS 명령 객체
│  └─ services/        # 도메인 간 조정
├─ domain/             # 순수 도메인 (외부 의존 0)
│  ├─ entities/        # Agent, Pairing, Message, Attachment
│  ├─ value-objects/   # ExternalId, SequenceHash, EncryptedBody
│  ├─ policies/        # PairingSlotPolicy, MessageRetentionPolicy
│  └─ events/          # PairingDisconnected ...
└─ infrastructure/     # 외부 시스템 어댑터
   ├─ repositories/    # TypeORM Repository 구현
   ├─ database/        # DataSource / Config / Migrations
   ├─ storage/         # MinIO 클라이언트
   ├─ push/            # firebase-admin
   ├─ news/            # 외부 뉴스 API
   ├─ mail/            # SMTP
   └─ crypto/          # AES-GCM / bcrypt / HMAC
```

**의존성 방향**: presentation → application → domain ← infrastructure.

## 명령어

```bash
pnpm install                 # (루트에서)
pnpm --filter @agentnews/backend dev
pnpm --filter @agentnews/backend build
pnpm --filter @agentnews/backend test
pnpm --filter @agentnews/backend typecheck
pnpm --filter @agentnews/backend migration:generate -- src/infrastructure/database/migrations/NAME
pnpm --filter @agentnews/backend migration:run
```

## 환경 변수

루트의 `.env` (또는 `apps/backend/.env`) 사용. `.env.example` 참조.

## 다음 작업

1. `infra/docker-compose.yml` 로 PostgreSQL 부팅 + ddl.sql 자동 적재
2. `domain/entities/agent.entity.ts` 부터 14 테이블 매핑 (TypeORM `@Entity` decorator)
3. `auth` 도메인 (REQ-001~003) 구현 → `presentation/controllers/auth.controller.ts`
4. `secret_unlock` → `pairing` → `chat` → `message` → `attachment` 순으로 진행
