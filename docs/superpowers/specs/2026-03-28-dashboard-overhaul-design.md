# 바톤 대시보드 전면 개편 — Phase 1~4 설계 스펙

## 개요

현재 단일 페이지 읽기 전용 대시보드를 완전한 에이전트 오케스트레이션 대시보드로 개편한다.

**현재 상태**: App.tsx 1개 + StatCard/AgentList/IssueList 3개 컴포넌트 + 4개 읽기 전용 API 라우트
**목표 상태**: 멀티 페이지, 회사/프로젝트 네비게이션, 이슈 CRUD + 칸반, 프롬프트 모니터링, 이슈 라이프사이클 타임라인

**아키텍처**: 대시보드 자체 API (Hono, :3200) → PostgreSQL 직접 접근 (Drizzle ORM) ← 바톤 코어와 같은 DB 공유
**UI 방향**: 바톤 본 UI 기반 + 모니터링/분석에 최적화된 개선 디자인

## 의존성

- Phase 0 (에이전트 지시문 DB 마이그레이션) 완료 필수 ✅
- react-router-dom 패키지 추가 필요

---

## Phase 1: 기반 구축

### P1-1: React Router + 레이아웃 셸

**목표**: 단일 페이지 → 멀티 페이지 구조 전환, 사이드바+메인 레이아웃

**변경 사항**:
- react-router-dom 설치
- App.tsx를 Router + Layout 래핑으로 변경
- 기존 App.tsx 내용을 pages/DashboardHome.tsx로 이동

**신규 파일**:
- `apps/web/src/components/Layout.tsx` — 사이드바 + 메인 영역 레이아웃
- `apps/web/src/components/Sidebar.tsx` — 좌측 네비게이션 (회사 선택, 메뉴)
- `apps/web/src/context/CompanyContext.tsx` — 선택된 회사 상태 관리
- `apps/web/src/pages/DashboardHome.tsx` — 기존 대시보드 내용

**라우트 구조**:
```
/                     → DashboardHome (기존 내용)
/projects             → ProjectList
/projects/:id         → ProjectDetail (칸반 + 타임라인)
/agents               → AgentList
/agents/:id           → AgentDetail (프롬프트 + 실행 로그)
/issues               → 전체 이슈 리스트
/issues/:id           → IssueDetail (상세 + 타임라인)
/monitoring           → 통합 모니터링 대시보드
```

### P1-2: 회사/프로젝트 API + 사이드바 네비게이션

**목표**: 사이드바에서 회사 선택 → 프로젝트/에이전트/이슈 탐색

**신규 API**:
- `GET /api/companies` — 회사 목록

**API 수정**:
- `GET /api/projects?companyId=` — 회사별 필터
- `GET /api/agents?companyId=` — 회사별 필터
- `GET /api/issues?companyId=` — 회사별 필터 추가

**사이드바 구조**:
```
🏏 Baton Dashboard
─── [회사 드롭다운]
├── 📊 대시보드
├── 📋 이슈
├── 📁 프로젝트
│   ├── baton-dashboard
│   └── scorpio
├── 🤖 에이전트
└── 📈 모니터링
```

### P1-3: 프로젝트 목록 + 에이전트 목록 페이지

**신규 파일**:
- `apps/web/src/pages/ProjectList.tsx` — 프로젝트 카드 그리드
- `apps/web/src/pages/AgentListPage.tsx` — 에이전트 카드 그리드 (기존 AgentList 컴포넌트 재사용)

---

## Phase 2: 이슈 트래킹

### P2-1: 프로젝트 상세 + 칸반 보드

**목표**: 프로젝트 페이지에서 해당 프로젝트의 이슈를 칸반 보드로 표시

**칸반 컬럼**: backlog → todo → in_progress → in_review → done

**신규 파일**:
- `apps/web/src/pages/ProjectDetail.tsx` — 프로젝트 정보 + 탭 (이슈/에이전트)
- `apps/web/src/components/KanbanBoard.tsx` — 칸반 보드 컨테이너
- `apps/web/src/components/KanbanColumn.tsx` — 상태별 컬럼
- `apps/web/src/components/IssueCard.tsx` — 칸반 카드 (우선순위, 배정 에이전트, 식별자)

### P2-2: 이슈 생성 폼

**목표**: 대시보드에서 이슈 생성 + 에이전트 배정 가능

**폼 필드**:
- 제목 (필수)
- 설명 (마크다운)
- 우선순위 (low/medium/high/urgent)
- 프로젝트 선택
- 에이전트 배정 (선택 — 배정하면 바톤 heartbeat이 자동 픽업)
- 상태 (기본: backlog)

**신규 API**:
- `POST /api/issues` — 이슈 생성
  - DB에 직접 INSERT
  - companies.issueCounter 증가시켜서 identifier 자동 생성 (예: DOB-44)
  - assigneeAgentId 설정 시 바톤 서버 heartbeat이 자동 픽업

**신규 파일**:
- `apps/web/src/components/CreateIssueDialog.tsx` — 모달 폼

### P2-3: 이슈 상세 페이지 + 라이프사이클 타임라인

**목표**: 이슈의 전체 과정을 시간순 타임라인으로 표시, 각 실행의 프롬프트 스냅샷 확인

**탭 구조**: 상세 | 코멘트 | 타임라인 | 서브태스크

**타임라인 이벤트 종류**:
- 이슈 생성/수정/상태 변경 — `activity_log` 테이블 (action: issue.*)
- 에이전트 실행 (heartbeat run) — `heartbeat_runs` 테이블 (issueId로 필터)
- 실행 내 이벤트 — `heartbeat_run_events` 테이블
- 프롬프트 스냅샷 — `agent_instructions` + `project_conventions` + `heartbeat_runs.contextSnapshot`
- 승인 — `approvals` 테이블 (issueId 연결, issue_approvals 조인)
- 코멘트 — `issue_comments` 테이블
- 토큰/비용 — `cost_events` 테이블 (issueId)

**타임라인 각 실행 클릭 시**:
- 5계층 프롬프트 스냅샷 펼쳐짐
  - ① agent_instructions (DB) — 해당 에이전트의 지시문
  - ② Baton Skill — 고정 텍스트 (요약)
  - ③ project_conventions — 해당 프로젝트의 컨벤션
  - ④ Wake Context — heartbeat_runs.contextSnapshot (issueId, wakeReason 등)
  - ⑤ Prompt Template — adapterConfig.promptTemplate
- 각 레이어별 토큰 수 (글자 수 / 4 근사값)
- 실행 결과 요약 (API 호출 목록, 변경 파일 등)

**신규 API**:
- `GET /api/issues/:id/timeline` — 타임라인 이벤트 병합 (activity_log + heartbeat_runs + approvals + comments)
- `GET /api/runs/:id/prompt-snapshot` — 특정 실행의 프롬프트 스냅샷 조합
- `GET /api/runs/:id/events` — 실행 내 이벤트 목록

**신규 파일**:
- `apps/web/src/pages/IssueDetail.tsx` — 이슈 상세 + 탭
- `apps/web/src/components/IssueTimeline.tsx` — 타임라인 컨테이너
- `apps/web/src/components/TimelineEvent.tsx` — 개별 이벤트 렌더러
- `apps/web/src/components/PromptSnapshot.tsx` — 프롬프트 스냅샷 (접기/펼치기)

### P2-4: 이슈 수정 + 리스트/보드 토글

**목표**: 상태/우선순위 인라인 변경, 리스트 뷰와 칸반 뷰 토글

**신규 API**:
- `PATCH /api/issues/:id` — 이슈 수정 (status, priority, assigneeAgentId 등)
- `GET /api/issues/:id/comments` — 코멘트 목록
- `POST /api/issues/:id/comments` — 코멘트 작성

**변경 파일**:
- `apps/web/src/components/IssueList.tsx` — 클릭 시 이슈 상세 이동 + 인라인 상태 변경
- `apps/web/src/components/CommentThread.tsx` — 코멘트 스레드 (신규)

---

## Phase 3: 에이전트 프롬프트 모니터링

### P3-1: 에이전트 상세 페이지

**목표**: 에이전트 정보 + 탭 구조 (개요 / 프롬프트 / 실행기록 / 비용)

**신규 API**:
- `GET /api/agents/:id/instructions` — agent_instructions 테이블에서 해당 에이전트의 지시문
- `GET /api/agents/:id/runs` — heartbeat_runs 목록 (에이전트별)
- `GET /api/agents/:id/costs` — cost_events 집계 (에이전트별)

**신규 파일**:
- `apps/web/src/pages/AgentDetail.tsx` — 탭: Overview, Prompts, Runs, Costs

### P3-2: 프롬프트 스택 뷰어

**목표**: 에이전트의 현재 프롬프트 5계층을 시각화

**표시 내용 (각 레이어별)**:
- 레이어 번호 + 이름
- 내용 미리보기 (접기/펼치기)
- 글자 수 + 예상 토큰 수
- 소스 표시 (DB managed / external sync / 고정 / DB conventions)

**신규 API**:
- `GET /api/agents/:id/prompt-stack` — 5계층 조합
  - Layer 1: agent_instructions (agentId)
  - Layer 2: Baton Skill 요약 (서버에서 고정 텍스트 반환)
  - Layer 3: project_conventions (에이전트가 배정된 프로젝트의)
  - Layer 4: Wake Context 예시 (최근 실행의 contextSnapshot)
  - Layer 5: adapterConfig.promptTemplate

**신규 파일**:
- `apps/web/src/components/PromptStackViewer.tsx` — 스택 전체 뷰
- `apps/web/src/components/PromptLayer.tsx` — 개별 레이어 (접기/펼치기)

### P3-3: 실행 로그 타임라인

**목표**: 에이전트별 heartbeat_runs 목록 + 각 run의 이벤트

**신규 파일**:
- `apps/web/src/components/RunTimeline.tsx` — 실행 목록 (시간순)
- `apps/web/src/components/RunEventList.tsx` — 개별 run의 이벤트 상세

### P3-4: 토큰 사용량 + 비용 표시

**신규 파일**:
- `apps/web/src/components/AgentCostSummary.tsx` — 에이전트별 비용/토큰 요약 카드

---

## Phase 4: 통합 모니터링 & 분석

### P4-1: 모니터링 대시보드 페이지

**목표**: 전체 에이전트 상태 요약, 최근 실행, 에러율

**신규 API**:
- `GET /api/monitoring/overview` — 전체 에이전트 상태, 최근 24h 실행 수, 에러율, 활성 이슈 수

**신규 파일**:
- `apps/web/src/pages/Monitoring.tsx`

### P4-2: 에이전트 비교 뷰

**목표**: 2개 이상 에이전트의 프롬프트 diff, 성능 비교

**신규 API**:
- `GET /api/agents/compare?ids=id1,id2` — 지시문 diff + 실행 메트릭 비교

**신규 파일**:
- `apps/web/src/components/AgentCompare.tsx` — 비교 레이아웃
- `apps/web/src/components/PromptDiff.tsx` — 프롬프트 텍스트 diff 뷰

### P4-3: 실행 성공률 + 비용 차트

**목표**: 시간별 성공/실패 추이, 비용 누적 차트

**신규 API**:
- `GET /api/monitoring/metrics?range=7d` — 일별 실행 수, 성공률, 비용 집계

**신규 파일**:
- `apps/web/src/components/RunSuccessChart.tsx`
- `apps/web/src/components/CostChart.tsx`

**차트 라이브러리**: recharts 또는 lightweight 대안 (번들 크기 고려)

---

## 이슈 분할 요약

| Phase | 이슈 | 설명 |
|-------|------|------|
| P1 | P1-1 | React Router + 레이아웃 셸 |
| P1 | P1-2 | 회사/프로젝트 API + 사이드바 |
| P1 | P1-3 | 프로젝트/에이전트 목록 페이지 |
| P2 | P2-1 | 프로젝트 상세 + 칸반 보드 |
| P2 | P2-2 | 이슈 생성 폼 + POST API |
| P2 | P2-3 | 이슈 상세 + 라이프사이클 타임라인 |
| P2 | P2-4 | 이슈 수정 + 리스트/보드 토글 |
| P3 | P3-1 | 에이전트 상세 페이지 |
| P3 | P3-2 | 프롬프트 스택 뷰어 |
| P3 | P3-3 | 실행 로그 타임라인 |
| P3 | P3-4 | 토큰 사용량 + 비용 |
| P4 | P4-1 | 모니터링 대시보드 |
| P4 | P4-2 | 에이전트 비교 뷰 |
| P4 | P4-3 | 성공률 + 비용 차트 |

**총 14개 이슈**

---

## 신규 API 라우트 목록

### Phase 1
- `GET /api/companies`

### Phase 2
- `POST /api/issues`
- `PATCH /api/issues/:id`
- `GET /api/issues/:id/comments`
- `POST /api/issues/:id/comments`
- `GET /api/issues/:id/timeline`
- `GET /api/runs/:id/prompt-snapshot`
- `GET /api/runs/:id/events`

### Phase 3
- `GET /api/agents/:id/instructions`
- `GET /api/agents/:id/runs`
- `GET /api/agents/:id/costs`
- `GET /api/agents/:id/prompt-stack`

### Phase 4
- `GET /api/monitoring/overview`
- `GET /api/agents/compare?ids=`
- `GET /api/monitoring/metrics?range=`

---

## 기존 API 수정

- `GET /api/issues` — companyId 필터 추가
- `GET /api/agents` — companyId 필터 추가
- `GET /api/projects` — companyId 필터 추가 (이미 있을 수 있음)
