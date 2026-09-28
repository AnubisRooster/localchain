# Graph Report - localchain  (2026-09-28)

## Corpus Check
- 56 files · ~67,205 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: (none) 1, .css 1, .jsonl 1)

## Summary
- 340 nodes · 536 edges · 25 communities (19 shown, 6 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 60 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- frontend/package.json
- quarantine.js
- backend/package.json
- watchdog.js
- server.js
- reputation.js
- audit-logger.js
- content-analyzer.js
- rate-limiter.js
- supertest
- graphify_pipeline.py
- validation.js
- jest.config.js
- injection-scanner.js
- sanitization.js
- watchdog/package.json
- devDependencies
- security.jsx
- dependencies
- next.config.js
- start.sh script

## God Nodes (most connected - your core abstractions)
1. `useApi()` - 10 edges
2. `sanitizeString()` - 9 edges
3. `getDb()` - 8 edges
4. `getDb()` - 8 edges
5. `getReputation()` - 8 edges
6. `react` - 8 edges
7. `scanContent()` - 7 edges
8. `supertest` - 7 edges
9. `getDb()` - 6 edges
10. `sanitizeObject()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `App()` --calls--> `Layout()`  [EXTRACTED]
  dashboard/frontend/pages/_app.jsx → dashboard/frontend/components/Layout.jsx
- `Dashboard()` --calls--> `StatCard()`  [EXTRACTED]
  dashboard/frontend/pages/index.jsx → dashboard/frontend/components/StatCard.jsx
- `Nodes()` --calls--> `StatCard()`  [EXTRACTED]
  dashboard/frontend/pages/nodes.jsx → dashboard/frontend/components/StatCard.jsx
- `Explorer()` --calls--> `useApi()`  [EXTRACTED]
  dashboard/frontend/pages/explorer.jsx → dashboard/frontend/components/useApi.js
- `Dashboard()` --calls--> `useApi()`  [EXTRACTED]
  dashboard/frontend/pages/index.jsx → dashboard/frontend/components/useApi.js

## Import Cycles
- None detected.

## Communities (25 total, 6 thin omitted)

### Community 0 - "frontend/package.json"
Cohesion: 0.08
Nodes (34): StatCard(), api, useApi(), axios, jest, name, private, scripts (+26 more)

### Community 1 - "quarantine.js"
Cohesion: 0.11
Nodes (24): closeDb(), Database, deleteEntry(), fs, getDb(), getQuarantineCount(), getQuarantineStats(), path (+16 more)

### Community 2 - "backend/package.json"
Cohesion: 0.07
Nodes (26): dependencies, axios, better-sqlite3, cors, express, express-rate-limit, helmet, zod (+18 more)

### Community 3 - "watchdog.js"
Cohesion: 0.10
Nodes (22): ref_child_process, ref_http, ref_os, { execSync }, http, os, canRestart(), CHECK_MAP (+14 more)

### Community 4 - "server.js"
Cohesion: 0.09
Nodes (20): addressLimiter, app, { auditMiddleware, queryAuditLog, getAuditStats }, axios, config, { contentAnalysisMiddleware }, cors, cosmos (+12 more)

### Community 5 - "reputation.js"
Cohesion: 0.21
Nodes (18): addFlag(), closeDb(), Database, fs, getDb(), getFlaggedAddresses(), getLevel(), getReputation() (+10 more)

### Community 6 - "audit-logger.js"
Cohesion: 0.20
Nodes (16): auditMiddleware(), closeDb(), crypto, Database, fs, getAuditStats(), getDb(), hashContent() (+8 more)

### Community 7 - "content-analyzer.js"
Cohesion: 0.16
Nodes (16): analyzeContent(), calculateEntropy(), CODE_PATTERNS, CONFIG_PATTERNS, CONTENT_CATEGORIES, contentAnalysisMiddleware(), crypto, DATA_PATTERNS (+8 more)

### Community 8 - "rate-limiter.js"
Cohesion: 0.17
Nodes (12): apiRequestLimiter, createAddressBasedLimiter(), createRateLimiter(), dashboard_backend_middleware_rate_limiter_default_max_api_requests, dashboard_backend_middleware_rate_limiter_default_max_record_submissions, dashboard_backend_middleware_rate_limiter_default_max_tx_queries, dashboard_backend_middleware_rate_limiter_default_window_ms, getRateLimitStatus() (+4 more)

### Community 9 - "supertest"
Cohesion: 0.13
Nodes (10): request, axios, request, axios, request, SAMPLE_RECORDS, axios, request (+2 more)

### Community 10 - "graphify_pipeline.py"
Cohesion: 0.13
Nodes (13): graphify_analyze, graphify_build, graphify_cluster, graphify_detect, graphify_export, graphify_extract, graphify_llm, graphify_report (+5 more)

### Community 11 - "validation.js"
Cohesion: 0.17
Nodes (10): ALLOWED_CONTENT_TYPES, blockQuerySchema, recordSchema, recordsQuerySchema, txQuerySchema, validateRecord(), validateRecordsQuery(), validateTxQuery() (+2 more)

### Community 12 - "jest.config.js"
Cohesion: 0.20
Nodes (8): Layout(), NAV_ITEMS, createJestConfig, customConfig, nextJest, App(), dashboard_frontend_styles_globals, next

### Community 13 - "injection-scanner.js"
Cohesion: 0.42
Nodes (9): calculateRiskScore(), getHighestSeverity(), INJECTION_PATTERNS, POISONING_INDICATORS, scanContent(), scanForInjections(), scanForPoisoning(), scanRecord() (+1 more)

### Community 14 - "sanitization.js"
Cohesion: 0.44
Nodes (9): normalizeWhitespace(), sanitizeObject(), sanitizeQuery(), sanitizeRecord(), sanitizeString(), stripBidiOverrides(), stripControlChars(), stripZeroWidth() (+1 more)

### Community 15 - "watchdog/package.json"
Cohesion: 0.18
Nodes (10): description, devDependencies, jest, jest, main, name, scripts, start (+2 more)

### Community 16 - "devDependencies"
Cohesion: 0.25
Nodes (8): devDependencies, autoprefixer, jest, jest-environment-jsdom, postcss, tailwindcss, @testing-library/jest-dom, @testing-library/react

### Community 17 - "security.jsx"
Cohesion: 0.46
Nodes (7): EntryDetail(), Security(), StatCard(), STATUS_COLORS, StatusBadge(), THREAT_COLORS, ThreatBadge()

### Community 18 - "dependencies"
Cohesion: 0.33
Nodes (6): dependencies, axios, next, react, react-dom, recharts

## Knowledge Gaps
- **144 isolated node(s):** `fs`, `path`, `os`, `TEST_DB`, `request` (+139 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 181 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `frontend/package.json` to `security.jsx`?**
  _High betweenness centrality (0.172) - this node is a cross-community bridge._
- **Why does `next` connect `jest.config.js` to `frontend/package.json`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **What connects `fs`, `path`, `os` to the rest of the system?**
  _144 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `frontend/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.0824524312896406 - nodes in this community are weakly interconnected._
- **Should `quarantine.js` be split into smaller, more focused modules?**
  _Cohesion score 0.11330049261083744 - nodes in this community are weakly interconnected._
- **Should `backend/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.07407407407407407 - nodes in this community are weakly interconnected._
- **Should `watchdog.js` be split into smaller, more focused modules?**
  _Cohesion score 0.09971509971509972 - nodes in this community are weakly interconnected._