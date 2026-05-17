const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const QUARANTINE_DB_PATH = process.env.QUARANTINE_DB_PATH || path.join(__dirname, "..", "..", "..", "data", "quarantine.db");

let db = null;

function getDb() {
  if (db) return db;

  const dbDir = path.dirname(QUARANTINE_DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(QUARANTINE_DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS quarantine (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      source_ip TEXT,
      signer_address TEXT,
      content_summary TEXT,
      content_hash TEXT,
      risk_score INTEGER NOT NULL,
      threat_level TEXT NOT NULL,
      findings TEXT NOT NULL,
      raw_content TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      reviewed_by TEXT,
      reviewed_at TEXT,
      review_notes TEXT,
      endpoint TEXT,
      method TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_quarantine_timestamp ON quarantine(timestamp);
    CREATE INDEX IF NOT EXISTS idx_quarantine_threat ON quarantine(threat_level);
    CREATE INDEX IF NOT EXISTS idx_quarantine_status ON quarantine(status);
    CREATE INDEX IF NOT EXISTS idx_quarantine_risk ON quarantine(risk_score);
  `);

  return db;
}

function quarantineEntry(entry) {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT INTO quarantine (
      timestamp, source_ip, signer_address, content_summary,
      content_hash, risk_score, threat_level, findings,
      raw_content, endpoint, method
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();

  stmt.run(
    now,
    entry.sourceIp || null,
    entry.signerAddress || null,
    entry.contentSummary || null,
    entry.contentHash || null,
    entry.riskScore || 0,
    entry.threatLevel || "medium",
    JSON.stringify(entry.findings || []),
    entry.rawContent ? entry.rawContent.slice(0, 5000) : null,
    entry.endpoint || null,
    entry.method || null
  );
}

function queryQuarantine(filters = {}) {
  const database = getDb();
  let query = "SELECT * FROM quarantine WHERE 1=1";
  const params = [];

  if (filters.threatLevel) {
    query += " AND threat_level = ?";
    params.push(filters.threatLevel);
  }
  if (filters.status) {
    query += " AND status = ?";
    params.push(filters.status);
  }
  if (filters.sourceIp) {
    query += " AND source_ip = ?";
    params.push(filters.sourceIp);
  }
  if (filters.minRiskScore) {
    query += " AND risk_score >= ?";
    params.push(filters.minRiskScore);
  }
  if (filters.pattern) {
    query += " AND findings LIKE ?";
    params.push(`%"pattern":"${filters.pattern}"%`);
  }
  if (filters.startDate) {
    query += " AND timestamp >= ?";
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    query += " AND timestamp <= ?";
    params.push(filters.endDate);
  }

  query += " ORDER BY timestamp DESC";
  if (filters.limit) {
    query += " LIMIT ?";
    params.push(filters.limit);
  }
  if (filters.offset) {
    query += " OFFSET ?";
    params.push(filters.offset);
  }

  const rows = database.prepare(query).all(...params);
  return rows.map((row) => ({
    ...row,
    findings: JSON.parse(row.findings),
  }));
}

function getQuarantineCount(filters = {}) {
  const database = getDb();
  let query = "SELECT COUNT(*) as count FROM quarantine WHERE 1=1";
  const params = [];

  if (filters.threatLevel) {
    query += " AND threat_level = ?";
    params.push(filters.threatLevel);
  }
  if (filters.status) {
    query += " AND status = ?";
    params.push(filters.status);
  }
  if (filters.minRiskScore) {
    query += " AND risk_score >= ?";
    params.push(filters.minRiskScore);
  }

  return database.prepare(query).get(...params).count;
}

function reviewEntry(id, status, reviewedBy, notes = "") {
  const database = getDb();
  const now = new Date().toISOString();

  const stmt = database.prepare(`
    UPDATE quarantine
    SET status = ?, reviewed_by = ?, reviewed_at = ?, review_notes = ?
    WHERE id = ?
  `);

  const result = stmt.run(status, reviewedBy, now, notes, id);
  return result.changes > 0;
}

function deleteEntry(id) {
  const database = getDb();
  const result = database.prepare("DELETE FROM quarantine WHERE id = ?").run(id);
  return result.changes > 0;
}

function getQuarantineStats() {
  const database = getDb();

  const total = database.prepare("SELECT COUNT(*) as count FROM quarantine").get();
  const pending = database.prepare("SELECT COUNT(*) as count FROM quarantine WHERE status = 'pending'").get();
  const reviewed = database.prepare("SELECT COUNT(*) as count FROM quarantine WHERE status = 'reviewed'").get();
  const dismissed = database.prepare("SELECT COUNT(*) as count FROM quarantine WHERE status = 'dismissed'").get();
  const byThreat = database.prepare("SELECT threat_level, COUNT(*) as count FROM quarantine GROUP BY threat_level ORDER BY count DESC").all();
  const byPattern = database.prepare(`
    SELECT findings, COUNT(*) as count
    FROM quarantine
    GROUP BY findings
    ORDER BY count DESC
    LIMIT 10
  `).all();
  const recent24h = database.prepare("SELECT COUNT(*) as count FROM quarantine WHERE timestamp >= datetime('now', '-24 hours')").get();
  const topIps = database.prepare("SELECT source_ip, COUNT(*) as count FROM quarantine WHERE source_ip IS NOT NULL GROUP BY source_ip ORDER BY count DESC LIMIT 5").all();

  return {
    totalEntries: total.count,
    pendingCount: pending.count,
    reviewedCount: reviewed.count,
    dismissedCount: dismissed.count,
    last24Hours: recent24h.count,
    byThreatLevel: byThreat,
    topSourceIps: topIps,
    topPatterns: byPattern.map((row) => {
      try {
        const findings = JSON.parse(row.findings);
        return {
          pattern: findings[0]?.pattern || findings[0]?.indicator || "unknown",
          type: findings[0]?.type || "unknown",
          count: row.count,
        };
      } catch {
        return { pattern: "unknown", type: "unknown", count: row.count };
      }
    }),
  };
}

function quarantineMiddleware(req, res, next) {
  const originalJson = res.json.bind(res);

  res.json = function (body) {
    if (res.statusCode === 403 && req.scanResults && req.scanResults.blocked) {
      quarantineEntry({
        sourceIp: req.ip || req.connection.remoteAddress,
        signerAddress: req.body?.creator || null,
        contentSummary: req.body?.summary?.slice(0, 200) || null,
        contentHash: req.body?.content ? require("crypto").createHash("sha256").update(req.body.content).digest("hex") : null,
        riskScore: req.scanResults.riskScore || 0,
        threatLevel: req.scanResults.highestSeverity || "medium",
        findings: req.scanResults.findings || [],
        rawContent: req.body?.content?.slice(0, 2000) || null,
        endpoint: req.path,
        method: req.method,
      });
    }

    return originalJson(body);
  };

  next();
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  getDb,
  quarantineEntry,
  queryQuarantine,
  getQuarantineCount,
  reviewEntry,
  deleteEntry,
  getQuarantineStats,
  quarantineMiddleware,
  closeDb,
  QUARANTINE_DB_PATH,
};
