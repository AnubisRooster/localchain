# Graph Report - localchain  (2026-09-07)

## Corpus Check
- 56 files · ~62,325 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 315 nodes · 436 edges · 25 communities (15 shown, 6 thin omitted)
- Extraction: 86% EXTRACTED · 14% INFERRED · 0% AMBIGUOUS · INFERRED: 60 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- server.js
- frontend/package.json
- useApi()
- backend/package.json
- reputation.js
- supertest
- watchdog.js
- audit-logger.js
- quarantine.js
- content-analyzer.js
- injection-scanner.js
- sanitization.js
- watchdog/package.json
- security.jsx
- Layout.jsx
- jest.config.js
- config.js
- watchdog.test.js
- next.config.js
- graphify_pipeline.py
- start.sh script

## God Nodes (most connected - your core abstractions)
1. `useApi()` - 10 edges
2. `sanitizeString()` - 9 edges
3. `getDb()` - 8 edges
4. `react` - 8 edges
5. `scanContent()` - 7 edges
6. `supertest` - 7 edges
7. `getDb()` - 7 edges
8. `getReputation()` - 7 edges
9. `getDb()` - 6 edges
10. `analyzeContent()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `Dashboard()` --calls--> `useApi()`  [EXTRACTED]
  dashboard/frontend/pages/index.jsx → dashboard/frontend/components/useApi.js
- `Nodes()` --calls--> `useApi()`  [EXTRACTED]
  dashboard/frontend/pages/nodes.jsx → dashboard/frontend/components/useApi.js
- `Explorer()` --calls--> `useApi()`  [EXTRACTED]
  dashboard/frontend/pages/explorer.jsx → dashboard/frontend/components/useApi.js
- `Transactions()` --calls--> `useApi()`  [EXTRACTED]
  dashboard/frontend/pages/transactions.jsx → dashboard/frontend/components/useApi.js

## Import Cycles
- None detected.

## Communities (25 total, 6 thin omitted)

### Community 0 - "server.js"
Cohesion: 0.05
Nodes (39): apiRequestLimiter, createAddressBasedLimiter(), createRateLimiter(), getRateLimitStatus(), rateLimit, recordSubmissionLimiter, txQueryLimiter, ALLOWED_CONTENT_TYPES (+31 more)

### Community 1 - "frontend/package.json"
Cohesion: 0.06
Nodes (31): dependencies, axios, next, react, react-dom, recharts, devDependencies, autoprefixer (+23 more)

### Community 2 - "useApi()"
Cohesion: 0.15
Nodes (12): StatCard(), api, useApi(), Explorer(), Dashboard(), Nodes(), ExpandedContent(), Transactions() (+4 more)

### Community 3 - "backend/package.json"
Cohesion: 0.08
Nodes (24): dependencies, axios, better-sqlite3, cors, express, express-rate-limit, helmet, zod (+16 more)

### Community 4 - "reputation.js"
Cohesion: 0.16
Nodes (17): addFlag(), Database, fs, getDb(), getFlaggedAddresses(), getLevel(), getReputation(), getTopAddresses() (+9 more)

### Community 5 - "supertest"
Cohesion: 0.10
Nodes (14): request, axios, request, axios, request, SAMPLE_RECORDS, axios, fs (+6 more)

### Community 6 - "watchdog.js"
Cohesion: 0.14
Nodes (16): canRestart(), CHECK_MAP, checkRpcHealth(), checkStaleBlocks(), { exec, execSync }, fs, http, httpGet() (+8 more)

### Community 7 - "audit-logger.js"
Cohesion: 0.15
Nodes (16): auditMiddleware(), crypto, Database, fs, getAuditStats(), getDb(), hashContent(), logSecurityEvent() (+8 more)

### Community 8 - "quarantine.js"
Cohesion: 0.16
Nodes (15): Database, deleteEntry(), fs, getDb(), getQuarantineCount(), getQuarantineStats(), path, quarantineEntry() (+7 more)

### Community 9 - "content-analyzer.js"
Cohesion: 0.19
Nodes (14): analyzeContent(), calculateEntropy(), CODE_PATTERNS, CONFIG_PATTERNS, CONTENT_CATEGORIES, contentAnalysisMiddleware(), crypto, DATA_PATTERNS (+6 more)

### Community 10 - "injection-scanner.js"
Cohesion: 0.42
Nodes (9): calculateRiskScore(), getHighestSeverity(), INJECTION_PATTERNS, POISONING_INDICATORS, scanContent(), scanForInjections(), scanForPoisoning(), scanRecord() (+1 more)

### Community 11 - "sanitization.js"
Cohesion: 0.44
Nodes (9): normalizeWhitespace(), sanitizeObject(), sanitizeQuery(), sanitizeRecord(), sanitizeString(), stripBidiOverrides(), stripControlChars(), stripZeroWidth() (+1 more)

### Community 12 - "watchdog/package.json"
Cohesion: 0.18
Nodes (10): description, devDependencies, jest, jest, main, name, scripts, start (+2 more)

### Community 15 - "jest.config.js"
Cohesion: 0.40
Nodes (3): createJestConfig, customConfig, nextJest

### Community 17 - "watchdog.test.js"
Cohesion: 0.50
Nodes (3): { execSync }, http, os

## Knowledge Gaps
- **145 isolated node(s):** `fs`, `path`, `os`, `TEST_DB`, `request` (+140 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 178 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `better-sqlite3` connect `audit-logger.js` to `quarantine.js`, `backend/package.json`, `reputation.js`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `react` connect `useApi()` to `frontend/package.json`, `security.jsx`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **What connects `fs`, `path`, `os` to the rest of the system?**
  _145 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `server.js` be split into smaller, more focused modules?**
  _Cohesion score 0.05272895467160037 - nodes in this community are weakly interconnected._
- **Should `frontend/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._
- **Should `useApi()` be split into smaller, more focused modules?**
  _Cohesion score 0.1476923076923077 - nodes in this community are weakly interconnected._
- **Should `backend/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._