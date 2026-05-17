const fs = require("fs");
const path = require("path");
const os = require("os");

const TEST_DB = path.join(os.tmpdir(), `lc-audit-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);

let logTransaction, logSecurityEvent, queryAuditLog, getAuditStats, hashContent, closeDb;

beforeAll(() => {
  process.env.AUDIT_DB_PATH = TEST_DB;
  jest.resetModules();
  const mod = require("../middleware/audit-logger");
  logTransaction = mod.logTransaction;
  logSecurityEvent = mod.logSecurityEvent;
  queryAuditLog = mod.queryAuditLog;
  getAuditStats = mod.getAuditStats;
  hashContent = mod.hashContent;
  closeDb = mod.closeDb;
});

afterAll(() => {
  closeDb();
  [TEST_DB, TEST_DB + "-wal", TEST_DB + "-shm"].forEach((f) => {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  });
});

describe("hashContent", () => {
  it("produces consistent hashes for same input", () => {
    const data = { summary: "test", content: "data" };
    expect(hashContent(data)).toBe(hashContent(data));
  });

  it("produces different hashes for different input", () => {
    expect(hashContent({ summary: "a" })).not.toBe(hashContent({ summary: "b" }));
  });

  it("produces 64-character hex string", () => {
    const hash = hashContent({ test: true });
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("logTransaction", () => {
  it("inserts a transaction record", () => {
    logTransaction({
      action: "record_submission",
      sourceIp: "127.0.0.1",
      signerAddress: "addr1",
      content: { summary: "test" },
      endpoint: "/api/records",
      method: "POST",
      statusCode: 200,
      riskScore: 0,
      threatLevel: "none",
      txHash: "abc123",
      chainHeight: "42",
    });

    const entries = queryAuditLog();
    expect(entries.length).toBe(1);
    expect(entries[0].action).toBe("record_submission");
    expect(entries[0].source_ip).toBe("127.0.0.1");
    expect(entries[0].tx_hash).toBe("abc123");
    expect(entries[0].content_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("stores findings as parsed JSON", () => {
    logTransaction({
      action: "test_findings",
      findings: [{ type: "injection", pattern: "test", severity: "high" }],
      riskScore: 5,
      threatLevel: "high",
    });

    const entries = queryAuditLog({ action: "test_findings" });
    expect(entries.length).toBe(1);
    expect(entries[0].findings).toEqual([{ type: "injection", pattern: "test", severity: "high" }]);
  });

  it("stores metadata as parsed JSON", () => {
    logTransaction({
      action: "test_metadata",
      metadata: { duration: 150, contentLength: 200 },
    });

    const entries = queryAuditLog({ action: "test_metadata" });
    expect(entries.length).toBe(1);
    expect(entries[0].metadata).toEqual({ duration: 150, contentLength: 200 });
  });

  it("handles null content hash when no content provided", () => {
    logTransaction({ action: "health_check_test" });
    const entries = queryAuditLog({ action: "health_check_test" });
    expect(entries.length).toBe(1);
    expect(entries[0].content_hash).toBeNull();
  });
});

describe("logSecurityEvent", () => {
  it("inserts a security event", () => {
    logSecurityEvent({
      action: "injection_blocked_test",
      sourceIp: "10.0.0.1",
      riskScore: 15,
      threatLevel: "critical",
      findings: [{ type: "injection", pattern: "eval_execution" }],
    });

    const entries = queryAuditLog({ action: "injection_blocked_test" });
    expect(entries.length).toBe(1);
    expect(entries[0].threat_level).toBe("critical");
  });
});

describe("queryAuditLog", () => {
  beforeAll(() => {
    logTransaction({ action: "query_test_submission", signerAddress: "qaddr1", riskScore: 0, threatLevel: "none" });
    logTransaction({ action: "query_test_submission", signerAddress: "qaddr2", riskScore: 5, threatLevel: "high" });
    logTransaction({ action: "query_test_health", riskScore: 0, threatLevel: "none" });
  });

  it("filters by action", () => {
    const entries = queryAuditLog({ action: "query_test_submission" });
    expect(entries.length).toBe(2);
  });

  it("filters by signerAddress", () => {
    const entries = queryAuditLog({ signerAddress: "qaddr1" });
    expect(entries.length).toBe(1);
    expect(entries[0].signer_address).toBe("qaddr1");
  });

  it("filters by threatLevel", () => {
    const entries = queryAuditLog({ threatLevel: "high" });
    expect(entries.length).toBeGreaterThanOrEqual(1);
  });

  it("filters by minRiskScore", () => {
    const entries = queryAuditLog({ minRiskScore: 5 });
    expect(entries.length).toBeGreaterThanOrEqual(1);
  });

  it("limits results", () => {
    const entries = queryAuditLog({ limit: 2 });
    expect(entries.length).toBeLessThanOrEqual(2);
  });
});

describe("getAuditStats", () => {
  it("returns statistics object with expected keys", () => {
    const stats = getAuditStats();
    expect(stats).toHaveProperty("totalEntries");
    expect(stats).toHaveProperty("last24Hours");
    expect(stats).toHaveProperty("blockedTransactions");
    expect(stats).toHaveProperty("byAction");
    expect(stats).toHaveProperty("byThreatLevel");
  });

  it("totalEntries is greater than 0", () => {
    const stats = getAuditStats();
    expect(stats.totalEntries).toBeGreaterThan(0);
  });
});
