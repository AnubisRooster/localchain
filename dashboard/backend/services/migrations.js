// ─────────────────────────────────────────────────────────────
// LocalChain – Database Migration System
// Simple versioned migrations for SQLite databases.
//
// Usage:
//   const { runMigrations } = require("./services/migrations");
//   runMigrations(db, migrations);
// ─────────────────────────────────────────────────────────────

const CURRENT_VERSION = 1;

function ensureMigrationTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function getCurrentVersion(db) {
  const row = db.prepare("SELECT MAX(version) as version FROM _migrations").get();
  return row?.version || 0;
}

function runMigrations(db, migrations) {
  ensureMigrationTable(db);

  const currentVersion = getCurrentVersion(db);
  const pending = migrations.filter((m) => m.version > currentVersion);

  if (pending.length === 0) {
    return { applied: 0, currentVersion };
  }

  const applied = [];
  const transaction = db.transaction(() => {
    for (const migration of pending) {
      migration.up(db);
      db.prepare("INSERT INTO _migrations (version, name) VALUES (?, ?)").run(
        migration.version,
        migration.name
      );
      applied.push(migration.name);
    }
  });

  transaction();

  return {
    applied: applied.length,
    migrations: applied,
    currentVersion: pending[pending.length - 1].version,
  };
}

// ── Auth DB Migrations ──────────────────────────────────────
const AUTH_MIGRATIONS = [
  {
    version: 1,
    name: "initial_auth_schema",
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS api_keys (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key_hash TEXT UNIQUE NOT NULL,
          key_prefix TEXT NOT NULL,
          label TEXT NOT NULL,
          created_by TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          last_used_at TEXT,
          expires_at TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          rate_limit INTEGER DEFAULT 1000,
          rate_window INTEGER DEFAULT 3600,
          permissions TEXT NOT NULL DEFAULT '["read","write"]'
        );

        CREATE INDEX IF NOT EXISTS idx_api_key_hash ON api_keys(key_hash);
        CREATE INDEX IF NOT EXISTS idx_api_key_status ON api_keys(status);

        CREATE TABLE IF NOT EXISTS api_usage (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key_id INTEGER NOT NULL,
          endpoint TEXT NOT NULL,
          method TEXT NOT NULL,
          ip TEXT,
          timestamp TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (key_id) REFERENCES api_keys(id)
        );

        CREATE INDEX IF NOT EXISTS idx_api_usage_key ON api_usage(key_id);
        CREATE INDEX IF NOT EXISTS idx_api_usage_time ON api_usage(timestamp);
      `);
    },
  },
];

// ── Registry DB Migrations ──────────────────────────────────
const REGISTRY_MIGRATIONS = [
  {
    version: 1,
    name: "initial_registry_schema",
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS nodes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          node_id TEXT UNIQUE NOT NULL,
          moniker TEXT NOT NULL,
          public_endpoint TEXT NOT NULL,
          rpc_port INTEGER DEFAULT 26657,
          rest_port INTEGER DEFAULT 1317,
          p2p_port INTEGER DEFAULT 26656,
          status TEXT NOT NULL DEFAULT 'offline',
          block_height INTEGER DEFAULT 0,
          catching_up INTEGER DEFAULT 0,
          latency_ms INTEGER DEFAULT 0,
          version TEXT,
          network TEXT,
          registered_at TEXT NOT NULL DEFAULT (datetime('now')),
          last_seen TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_node_id ON nodes(node_id);
        CREATE INDEX IF NOT EXISTS idx_node_status ON nodes(status);
      `);
    },
  },
];

// ── Tenant DB Migrations ────────────────────────────────────
const TENANT_MIGRATIONS = [
  {
    version: 1,
    name: "initial_tenant_schema",
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS tenants (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tenant_id TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          status TEXT NOT NULL DEFAULT 'active',
          max_nodes INTEGER DEFAULT 10,
          max_api_keys INTEGER DEFAULT 20,
          rate_limit INTEGER DEFAULT 1000,
          rate_window INTEGER DEFAULT 3600,
          metadata TEXT DEFAULT '{}'
        );

        CREATE INDEX IF NOT EXISTS idx_tenant_id ON tenants(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_tenant_status ON tenants(status);

        CREATE TABLE IF NOT EXISTS tenant_api_keys (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tenant_id TEXT NOT NULL,
          key_hash TEXT UNIQUE NOT NULL,
          key_prefix TEXT NOT NULL,
          label TEXT NOT NULL,
          created_by TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          last_used_at TEXT,
          expires_at TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          rate_limit INTEGER DEFAULT 1000,
          rate_window INTEGER DEFAULT 3600,
          permissions TEXT NOT NULL DEFAULT '["read","write"]',
          FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
        );

        CREATE INDEX IF NOT EXISTS idx_tenant_key_hash ON tenant_api_keys(key_hash);
        CREATE INDEX IF NOT EXISTS idx_tenant_key_tenant ON tenant_api_keys(tenant_id);

        CREATE TABLE IF NOT EXISTS tenant_usage (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tenant_id TEXT NOT NULL,
          key_id INTEGER,
          endpoint TEXT NOT NULL,
          method TEXT NOT NULL,
          ip TEXT,
          timestamp TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
        );

        CREATE INDEX IF NOT EXISTS idx_tenant_usage_tenant ON tenant_usage(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_tenant_usage_time ON tenant_usage(timestamp);
      `);
    },
  },
];

// ── Reputation DB Migrations ────────────────────────────────
const REPUTATION_MIGRATIONS = [
  {
    version: 1,
    name: "initial_reputation_schema",
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS reputation (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          address TEXT UNIQUE NOT NULL,
          score INTEGER DEFAULT 50,
          successful_tx INTEGER DEFAULT 0,
          failed_tx INTEGER DEFAULT 0,
          blocked_tx INTEGER DEFAULT 0,
          last_updated TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_reputation_address ON reputation(address);
      `);
    },
  },
];

// ── Audit DB Migrations ─────────────────────────────────────
const AUDIT_MIGRATIONS = [
  {
    version: 1,
    name: "initial_audit_schema",
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS audit_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tx_hash TEXT,
          signer_address TEXT,
          action TEXT NOT NULL,
          risk_score INTEGER DEFAULT 0,
          threat_level TEXT DEFAULT 'none',
          details TEXT,
          ip TEXT,
          timestamp TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_audit_tx_hash ON audit_log(tx_hash);
        CREATE INDEX IF NOT EXISTS idx_audit_signer ON audit_log(signer_address);
        CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
      `);
    },
  },
];

// ── Quarantine DB Migrations ────────────────────────────────
const QUARANTINE_MIGRATIONS = [
  {
    version: 1,
    name: "initial_quarantine_schema",
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS quarantine (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tx_hash TEXT,
          signer_address TEXT,
          threat_level TEXT NOT NULL,
          risk_score INTEGER DEFAULT 0,
          pattern TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          source_ip TEXT,
          reviewed_by TEXT,
          reviewed_at TEXT,
          notes TEXT,
          timestamp TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_quarantine_status ON quarantine(status);
        CREATE INDEX IF NOT EXISTS idx_quarantine_threat ON quarantine(threat_level);
        CREATE INDEX IF NOT EXISTS idx_quarantine_timestamp ON quarantine(timestamp);
      `);
    },
  },
];

module.exports = {
  runMigrations,
  getCurrentVersion,
  AUTH_MIGRATIONS,
  REGISTRY_MIGRATIONS,
  TENANT_MIGRATIONS,
  REPUTATION_MIGRATIONS,
  AUDIT_MIGRATIONS,
  QUARANTINE_MIGRATIONS,
};
