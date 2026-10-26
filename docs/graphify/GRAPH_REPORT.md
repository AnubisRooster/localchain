# Graph Report - localchain  (2026-10-26)

## Corpus Check
- 56 files · ~50,091 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: (none) 1, .css 1, .jsonl 1)

## Summary
- 300 nodes · 507 edges · 23 communities (16 shown, 7 thin omitted)
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 60 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- server.js
- frontend/package.json
- backend/package.json
- useApi()
- watchdog.js
- content-analyzer.js
- reputation.js
- rate-limiter.js
- audit-logger.js
- Layout.jsx
- rules
- scrape_configs
- watchdog/package.json
- injection-scanner.js
- sanitization.js
- security.jsx
- next.config.js
- start.sh script

## God Nodes (most connected - your core abstractions)
1. `useApi()` - 10 edges
2. `sanitizeString()` - 9 edges
3. `react` - 9 edges
4. `supertest` - 8 edges
5. `getReputation()` - 8 edges
6. `scanContent()` - 7 edges
7. `getDb()` - 7 edges
8. `sanitizeObject()` - 6 edges
9. `getDb()` - 6 edges
10. `StatCard()` - 6 edges

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

## Communities (23 total, 7 thin omitted)

### Community 0 - "server.js"
Cohesion: 0.09
Nodes (25): ALLOWED_CONTENT_TYPES, blockQuerySchema, recordSchema, recordsQuerySchema, txQuerySchema, validateRecord(), validateRecordsQuery(), validateTxQuery() (+17 more)

### Community 1 - "frontend/package.json"
Cohesion: 0.08
Nodes (31): dependencies, axios@^1.7.0, react@^18.3.0, react-dom@^18.3.0, recharts@^2.12.0, devDependencies, autoprefixer@^10.4.0, jest@^30.3.0 (+23 more)

### Community 2 - "backend/package.json"
Cohesion: 0.09
Nodes (27): dependencies, axios@^1.7.0, better-sqlite3@^12.10.0, cors@^2.8.5, express@^4.21.0, express-rate-limit@^8.5.2, helmet@^8.1.0, zod@^4.4.3 (+19 more)

### Community 3 - "useApi()"
Cohesion: 0.19
Nodes (15): StatCard(), api, useApi(), DetailRow(), Explorer(), Dashboard(), Nodes(), Row() (+7 more)

### Community 4 - "watchdog.js"
Cohesion: 0.16
Nodes (11): canRestart(), CHECK_MAP, checkRpcHealth(), checkStaleBlocks(), httpGet(), lastHeightChangeTime, log(), performAction() (+3 more)

### Community 5 - "content-analyzer.js"
Cohesion: 0.19
Nodes (12): analyzeContent(), calculateEntropy(), CODE_PATTERNS, CONFIG_PATTERNS, CONTENT_CATEGORIES, contentAnalysisMiddleware(), DATA_PATTERNS, detectCategory() (+4 more)

### Community 7 - "reputation.js"
Cohesion: 0.33
Nodes (11): addFlag(), getDb(), getFlaggedAddresses(), getLevel(), getReputation(), getTopAddresses(), isBlocked(), reputationMiddleware() (+3 more)

### Community 8 - "rate-limiter.js"
Cohesion: 0.19
Nodes (6): apiRequestLimiter, createAddressBasedLimiter(), createRateLimiter(), getRateLimitStatus(), recordSubmissionLimiter, txQueryLimiter

### Community 9 - "audit-logger.js"
Cohesion: 0.35
Nodes (8): auditMiddleware(), getAuditStats(), getDb(), hashContent(), logSecurityEvent(), logTransaction(), queryAuditLog(), TEST_DB

### Community 10 - "Layout.jsx"
Cohesion: 0.20
Nodes (7): Layout(), NAV_ITEMS, createJestConfig, customConfig, next@^14.2.0, App(), next

### Community 11 - "rules"
Cohesion: 0.17
Nodes (11): description, summary, groups, name, rules, severity, alert, annotations (+3 more)

### Community 12 - "scrape_configs"
Cohesion: 0.18
Nodes (10): global, evaluation_interval, scrape_interval, rule_files, scrape_configs, job_name, metrics_path, scrape_interval (+2 more)

### Community 13 - "watchdog/package.json"
Cohesion: 0.20
Nodes (10): description, devDependencies, jest@^30.3.0, jest, main, name, scripts, start (+2 more)

### Community 14 - "injection-scanner.js"
Cohesion: 0.49
Nodes (8): calculateRiskScore(), getHighestSeverity(), INJECTION_PATTERNS, POISONING_INDICATORS, scanContent(), scanForInjections(), scanForPoisoning(), scanRecord()

### Community 15 - "sanitization.js"
Cohesion: 0.51
Nodes (8): normalizeWhitespace(), sanitizeObject(), sanitizeQuery(), sanitizeRecord(), sanitizeString(), stripBidiOverrides(), stripControlChars(), stripZeroWidth()

### Community 16 - "security.jsx"
Cohesion: 0.46
Nodes (7): EntryDetail(), Security(), StatCard(), STATUS_COLORS, StatusBadge(), THREAT_COLORS, ThreatBadge()

## Knowledge Gaps
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `useApi()` to `security.jsx`, `frontend/package.json`?**
  _High betweenness centrality (0.161) - this node is a cross-community bridge._
- **Should `server.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08637873754152824 - nodes in this community are weakly interconnected._
- **Why does `@testing-library/react` connect `frontend/package.json` to `useApi()`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Should `frontend/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.08266129032258064 - nodes in this community are weakly interconnected._
- **Why does `next` connect `Layout.jsx` to `frontend/package.json`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Should `backend/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.09259259259259259 - nodes in this community are weakly interconnected._
- **Should `graphify_pipeline.py` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._