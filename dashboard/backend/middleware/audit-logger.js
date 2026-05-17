const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const AUDIT_DB_PATH = process.env.AUDIT_DB_PATH || path.join(__dirname, "..", "..", "..", "data", "audit.db");

let db = null;

function getDb() {
  if (db) return db;

  const dbDir = path.dirname(AUDIT_DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(AUDIT_DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      action TEXT NOT NULL,
      source_ip TEXT,
      signer_address TEXT,
      content_hash TEXT,
      endpoint TEXT,
      method TEXT,
      status_code INTEGER,
      risk_score INTEGER DEFAULT 0,
      threat_level TEXT DEFAULT 'none',
      findings TEXT DEFAULT '[]',
      tx_hash TEXT,
      chain_height TEXT,
      metadata TEXT DEFAULT '{}'
    );

    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
    CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
    CREATE INDEX IF NOT EXISTS idx_audit_signer ON audit_log(signer_address);
    CREATE INDEX IF NOT EXISTS idx_audit_tx_hash ON audit_log(tx_hash);
  `);

  return db;
}

function hashContent(data) {
  return crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

function logTransaction(entry) {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT INTO audit_log (
      timestamp, action, source_ip, signer_address, content_hash,
      endpoint, method, status_code, risk_score, threat_level,
      findings, tx_hash, chain_height, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  const contentHash = entry.content ? hashContent(entry.content) : null;

  stmt.run(
    now,
    entry.action || "transaction_submit",
    entry.sourceIp || null,
    entry.signerAddress || null,
    contentHash,
    entry.endpoint || "/api/records",
    entry.method || "POST",
    entry.statusCode || 0,
    entry.riskScore || 0,
    entry.threatLevel || "none",
    JSON.stringify(entry.findings || []),
    entry.txHash || null,
    entry.chainHeight || null,
    JSON.stringify(entry.metadata || {})
  );
}

function logSecurityEvent(entry) {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT INTO audit_log (
      timestamp, action, source_ip, signer_address, content_hash,
      endpoint, method, status_code, risk_score, threat_level,
      findings, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();

  stmt.run(
    now,
    entry.action || "security_event",
    entry.sourceIp || null,
    entry.signerAddress || null,
    entry.contentHash || null,
    entry.endpoint || null,
    entry.method || null,
    entry.statusCode || 0,
    entry.riskScore || 0,
    entry.threatLevel || "medium",
    JSON.stringify(entry.findings || []),
    JSON.stringify(entry.metadata || {})
  );
}

function queryAuditLog(filters = {}) {
  const database = getDb();
  let query = "SELECT * FROM audit_log WHERE 1=1";
  const params = [];

  if (filters.action) {
    query += " AND action = ?";
    params.push(filters.action);
  }
  if (filters.signerAddress) {
    query += " AND signer_address = ?";
    params.push(filters.signerAddress);
  }
  if (filters.threatLevel) {
    query += " AND threat_level = ?";
    params.push(filters.threatLevel);
  }
  if (filters.startDate) {
    query += " AND timestamp >= ?";
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    query += " AND timestamp <= ?";
    params.push(filters.endDate);
  }
  if (filters.txHash) {
    query += " AND tx_hash = ?";
    params.push(filters.txHash);
  }
  if (filters.minRiskScore) {
    query += " AND risk_score >= ?";
    params.push(filters.minRiskScore);
  }

  query += " ORDER BY timestamp DESC";
  if (filters.limit) {
    query += " LIMIT ?";
    params.push(filters.limit);
  }

  const rows = database.prepare(query).all(...params);
  return rows.map((row) => ({
    ...row,
    findings: JSON.parse(row.findings),
    metadata: JSON.parse(row.metadata),
  }));
}

function getAuditStats() {
  const database = getDb();

  const total = database.prepare("SELECT COUNT(*) as count FROM audit_log").get();
  const byAction = database.prepare("SELECT action, COUNT(*) as count FROM audit_log GROUP BY action").all();
  const byThreat = database.prepare("SELECT threat_level, COUNT(*) as count FROM audit_log GROUP BY threat_level").all();
  const recent = database.prepare("SELECT COUNT(*) as count FROM audit_log WHERE timestamp >= datetime('now', '-24 hours')").get();
  const blocked = database.prepare("SELECT COUNT(*) as count FROM audit_log WHERE threat_level IN ('critical', 'high')").get();

  return {
    totalEntries: total.count,
    last24Hours: recent.count,
    blockedTransactions: blocked.count,
    byAction,
    byThreatLevel: byThreat,
  };
}

function auditMiddleware(req, res, next) {
  const originalJson = res.json.bind(res);
  const startTime = Date.now();

  res.json = function (body) {
    const statusCode = res.statusCode;
    const duration = Date.now() - startTime;

    if (req.method === "POST" && req.path === "/api/records") {
      const scanResults = req.scanResults || {};
      logTransaction({
        action: "record_submission",
        sourceIp: req.ip || req.connection.remoteAddress,
        signerAddress: req.body?.creator || null,
        content: { summary: req.body?.summary, contentType: req.body?.contentType },
        endpoint: req.path,
        method: req.method,
        statusCode,
        riskScore: scanResults.riskScore || 0,
        threatLevel: scanResults.highestSeverity || "none",
        findings: scanResults.findings || [],
        txHash: body?.txHash || null,
        chainHeight: body?.height || null,
        metadata: { duration, contentLength: req.body?.content?.length || 0 },
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
  logTransaction,
  logSecurityEvent,
  queryAuditLog,
  getAuditStats,
  auditMiddleware,
  hashContent,
  closeDb,
  AUDIT_DB_PATH,
};
