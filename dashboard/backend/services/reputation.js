const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const REPUTATION_DB_PATH = process.env.REPUTATION_DB_PATH || path.join(__dirname, "..", "..", "..", "data", "reputation.db");

let db = null;

const INITIAL_SCORE = 50;
const MAX_SCORE = 100;
const MIN_SCORE = 0;
const TRUSTED_THRESHOLD = 70;
const SUSPICIOUS_THRESHOLD = 30;
const BLOCKED_THRESHOLD = 10;

const SCORE_ADJUSTMENTS = {
  successfulTx: 2,
  failedTx: -3,
  blockedContent: -10,
  highRiskContent: -5,
  mediumRiskContent: -2,
  dailyActiveBonus: 1,
  spamDetected: -15,
  ageBonus: 1,
};

function getDb() {
  if (db) return db;

  const dbDir = path.dirname(REPUTATION_DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(REPUTATION_DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS address_reputation (
      address TEXT PRIMARY KEY,
      score INTEGER NOT NULL DEFAULT 50,
      total_submissions INTEGER NOT NULL DEFAULT 0,
      successful_submissions INTEGER NOT NULL DEFAULT 0,
      failed_submissions INTEGER NOT NULL DEFAULT 0,
      blocked_submissions INTEGER NOT NULL DEFAULT 0,
      first_seen TEXT NOT NULL,
      last_seen TEXT NOT NULL,
      flags TEXT DEFAULT '[]',
      metadata TEXT DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS reputation_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      address TEXT NOT NULL,
      event_type TEXT NOT NULL,
      score_change INTEGER NOT NULL,
      timestamp TEXT NOT NULL,
      reason TEXT,
      FOREIGN KEY (address) REFERENCES address_reputation(address)
    );

    CREATE INDEX IF NOT EXISTS idx_reputation_score ON address_reputation(score);
    CREATE INDEX IF NOT EXISTS idx_reputation_events_address ON reputation_events(address);
  `);

  return db;
}

function getReputation(address) {
  const database = getDb();
  const row = database.prepare("SELECT * FROM address_reputation WHERE address = ?").get(address);

  if (!row) {
    return {
      address,
      score: INITIAL_SCORE,
      totalSubmissions: 0,
      successfulSubmissions: 0,
      failedSubmissions: 0,
      blockedSubmissions: 0,
      firstSeen: null,
      lastSeen: null,
      flags: [],
      metadata: {},
      level: "new",
    };
  }

  return {
    address: row.address,
    score: row.score,
    totalSubmissions: row.total_submissions,
    successfulSubmissions: row.successful_submissions,
    failedSubmissions: row.failed_submissions,
    blockedSubmissions: row.blocked_submissions,
    firstSeen: row.first_seen,
    lastSeen: row.last_seen,
    flags: JSON.parse(row.flags),
    metadata: JSON.parse(row.metadata),
    level: getLevel(row.score),
  };
}

function getLevel(score) {
  if (score >= TRUSTED_THRESHOLD) return "trusted";
  if (score >= SUSPICIOUS_THRESHOLD) return "normal";
  if (score >= BLOCKED_THRESHOLD) return "suspicious";
  return "blocked";
}

function updateReputation(address, eventType, reason = "") {
  const database = getDb();
  const now = new Date().toISOString();
  const adjustment = SCORE_ADJUSTMENTS[eventType] || 0;

  const insertRep = database.prepare(`
    INSERT INTO address_reputation (address, score, total_submissions, first_seen, last_seen)
    VALUES (?, ?, 1, ?, ?)
    ON CONFLICT(address) DO UPDATE SET
      score = MAX(${MIN_SCORE}, MIN(${MAX_SCORE}, score + ?)),
      total_submissions = total_submissions + 1,
      last_seen = ?
  `);

  insertRep.run(
    address,
    INITIAL_SCORE + adjustment,
    now,
    now,
    adjustment,
    now
  );

  if (eventType === "successfulTx") {
    database.prepare("UPDATE address_reputation SET successful_submissions = successful_submissions + 1 WHERE address = ?").run(address);
  } else if (eventType === "failedTx" || eventType === "blockedContent" || eventType === "highRiskContent") {
    database.prepare("UPDATE address_reputation SET failed_submissions = failed_submissions + 1 WHERE address = ?").run(address);
    if (eventType === "blockedContent") {
      database.prepare("UPDATE address_reputation SET blocked_submissions = blocked_submissions + 1 WHERE address = ?").run(address);
    }
  }

  database.prepare(`
    INSERT INTO reputation_events (address, event_type, score_change, timestamp, reason)
    VALUES (?, ?, ?, ?, ?)
  `).run(address, eventType, adjustment, now, reason);

  return getReputation(address);
}

function addFlag(address, flag) {
  const database = getDb();
  const row = database.prepare("SELECT flags FROM address_reputation WHERE address = ?").get(address);
  const flags = row ? JSON.parse(row.flags) : [];

  if (!flags.includes(flag)) {
    flags.push(flag);
    database.prepare("UPDATE address_reputation SET flags = ? WHERE address = ?").run(JSON.stringify(flags), address);
  }

  return flags;
}

function isBlocked(address) {
  const rep = getReputation(address);
  return rep.level === "blocked";
}

function getTopAddresses(limit = 10) {
  const database = getDb();
  return database.prepare("SELECT * FROM address_reputation ORDER BY score DESC LIMIT ?").all(limit);
}

function getFlaggedAddresses() {
  const database = getDb();
  return database.prepare("SELECT * FROM address_reputation WHERE json_array_length(flags) > 0").all();
}

function reputationMiddleware(req, res, next) {
  const address = req.body?.creator || req.ip || null;

  if (!address) {
    return next();
  }

  if (isBlocked(address)) {
    return res.status(403).json({
      error: "Access denied",
      reason: "Address has been blocked due to suspicious activity",
      address,
    });
  }

  req.addressReputation = getReputation(address);
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
  getReputation,
  updateReputation,
  addFlag,
  isBlocked,
  getTopAddresses,
  getFlaggedAddresses,
  reputationMiddleware,
  getLevel,
  closeDb,
  INITIAL_SCORE,
  MAX_SCORE,
  MIN_SCORE,
  TRUSTED_THRESHOLD,
  SUSPICIOUS_THRESHOLD,
  BLOCKED_THRESHOLD,
  SCORE_ADJUSTMENTS,
};
