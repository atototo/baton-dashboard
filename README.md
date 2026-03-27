# Baton Dashboard

Baton 팀 대시보드 — 에이전트, 이슈, 프로젝트 현황을 한눈에 파악하는 웹 대시보드.

Baton 서버와 같은 PostgreSQL DB를 공유하여 실시간 데이터를 조회합니다.

## 구조

```
baton-dashboard/
├── apps/
│   ├── api/          # Hono + Drizzle ORM (port 3200)
│   └── web/          # React + Vite + Tailwind CSS (port 5173)
├── package.json
└── pnpm-workspace.yaml
```

## 사전 요구사항

- Node.js 20+
- pnpm 10+
- Docker (PostgreSQL 컨테이너)
- [Baton](https://github.com/atototo/baton) 서버

## 설정

### 1. 의존성 설치

```bash
pnpm install
```

### 2. 환경변수

```bash
cat > apps/api/.env << 'EOF'
DATABASE_URL=postgres://baton:baton@localhost:5432/baton
PORT=3200
EOF
```

### 3. PostgreSQL 실행

Baton 레포의 Docker Compose로 PostgreSQL을 띄웁니다:

```bash
cd ~/easy-work/baton
docker compose up -d db
```

### 4. Baton 서버 실행

```bash
cd ~/easy-work/baton
pnpm --filter @atototo/server dev
# → http://localhost:3100
```

## 실행

```bash
# API + Web 동시 실행
pnpm dev

# 개별 실행
pnpm dev:api   # API만 (http://localhost:3200)
pnpm dev:web   # Web만 (http://localhost:5173)
```

## 실행 순서

```
Docker PG (5432) → Baton 서버 (3100) → pnpm dev (API 3200 + Web 5173)
```

## API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET | `/health` | 헬스체크 |
| GET | `/api/issues` | 이슈 목록 (필터: `?status=`, `?projectId=`, `?limit=`) |
| GET | `/api/issues/:id` | 이슈 상세 |
| GET | `/api/agents` | 에이전트 목록 |
| GET | `/api/agents/:id` | 에이전트 상세 |
| GET | `/api/projects` | 프로젝트 목록 |
| GET | `/api/projects/:id` | 프로젝트 상세 |
| GET | `/api/stats/overview` | 전체 현황 요약 |

## 기술 스택

- **API**: [Hono](https://hono.dev/) + [Drizzle ORM](https://orm.drizzle.team/) + postgres.js
- **Web**: React 19 + Vite + Tailwind CSS v4
- **DB**: PostgreSQL 17 (Baton과 공유)
