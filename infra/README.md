# infra

로컬 / 단일 서버 self-host 용 Docker compose.

## 구성

- **postgres** (16-alpine, port 5432) — 첫 부팅 시 `postgres/init/01_schema.sql` 자동 적재 (DDL 533행)
- **minio** (S3 호환, port 9000 API / 9001 콘솔) — 첨부 저장소
- **minio-bootstrap** — 1회 실행 후 종료. `agentnews-attachments` 버킷 자동 생성

## 사용

```bash
# 루트의 .env 가 infra 변수 (POSTGRES_*, MINIO_*) 를 제공하므로 .env 를 먼저 준비
cp ../.env.example ../.env

pnpm infra:up        # docker compose -f infra/docker-compose.yml up -d
pnpm infra:logs      # 로그 따라가기
pnpm infra:down      # 정지 (볼륨 유지)

# DDL 변경 후 스키마 재적재 시:
docker compose -f infra/docker-compose.yml down -v   # 볼륨 삭제
pnpm infra:up                                        # 새로 적재
```

## DDL 갱신 절차

1. `docs/specs/spec/ddl.sql` 수정 (spec 우선)
2. `cp docs/specs/spec/ddl.sql infra/postgres/init/01_schema.sql`
3. 운영은 TypeORM migration 으로 진행. `01_schema.sql` 은 dev 부팅 편의용

## 접속

- Postgres: `postgresql://agentnews:agentnews_dev@localhost:5432/agentnews`
- MinIO 콘솔: http://localhost:9001 (id `agentnews` / pw `agentnews_dev`)
- MinIO S3 endpoint: http://localhost:9000

## fake_headlines 시드

`docs/specs/base/requirements_spec.md` REQ-021: 한국어 50개+. 별도 seed 파일 미작성 — 운영 진입 시 `infra/postgres/init/02_seed.sql` 로 추가 권장.
