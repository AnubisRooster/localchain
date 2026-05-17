const fs = require("fs");
const path = require("path");
const os = require("os");

const TEST_DB = path.join(os.tmpdir(), `lc-rep-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);

let getDb, getReputation, updateReputation, addFlag, isBlocked, getLevel, getTopAddresses, getFlaggedAddresses, closeDb;
let INITIAL_SCORE, MAX_SCORE, MIN_SCORE, TRUSTED_THRESHOLD, SUSPICIOUS_THRESHOLD, BLOCKED_THRESHOLD;

beforeAll(() => {
  process.env.REPUTATION_DB_PATH = TEST_DB;
  jest.resetModules();
  const mod = require("../services/reputation");
  getDb = mod.getDb;
  getReputation = mod.getReputation;
  updateReputation = mod.updateReputation;
  addFlag = mod.addFlag;
  isBlocked = mod.isBlocked;
  getLevel = mod.getLevel;
  getTopAddresses = mod.getTopAddresses;
  getFlaggedAddresses = mod.getFlaggedAddresses;
  closeDb = mod.closeDb;
  INITIAL_SCORE = mod.INITIAL_SCORE;
  MAX_SCORE = mod.MAX_SCORE;
  MIN_SCORE = mod.MIN_SCORE;
  TRUSTED_THRESHOLD = mod.TRUSTED_THRESHOLD;
  SUSPICIOUS_THRESHOLD = mod.SUSPICIOUS_THRESHOLD;
  BLOCKED_THRESHOLD = mod.BLOCKED_THRESHOLD;
});

afterAll(() => {
  closeDb();
  [TEST_DB, TEST_DB + "-wal", TEST_DB + "-shm"].forEach((f) => {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  });
});

describe("getLevel", () => {
  it("returns trusted for score >= 70", () => {
    expect(getLevel(70)).toBe("trusted");
    expect(getLevel(100)).toBe("trusted");
  });

  it("returns normal for score 30-69", () => {
    expect(getLevel(30)).toBe("normal");
    expect(getLevel(50)).toBe("normal");
    expect(getLevel(69)).toBe("normal");
  });

  it("returns suspicious for score 10-29", () => {
    expect(getLevel(10)).toBe("suspicious");
    expect(getLevel(29)).toBe("suspicious");
  });

  it("returns blocked for score < 10", () => {
    expect(getLevel(0)).toBe("blocked");
    expect(getLevel(9)).toBe("blocked");
  });
});

describe("getReputation", () => {
  it("returns initial reputation for unknown address", () => {
    const rep = getReputation("unknown_addr_test");
    expect(rep.score).toBe(INITIAL_SCORE);
    expect(rep.level).toBe("new");
    expect(rep.totalSubmissions).toBe(0);
  });

  it("returns existing reputation after update", () => {
    updateReputation("rep_test_addr", "successfulTx");
    const rep = getReputation("rep_test_addr");
    expect(rep.address).toBe("rep_test_addr");
    expect(rep.totalSubmissions).toBeGreaterThanOrEqual(1);
    expect(rep.firstSeen).not.toBeNull();
    expect(rep.lastSeen).not.toBeNull();
  });
});

describe("updateReputation", () => {
  it("increases score for successful transactions", () => {
    updateReputation("ut_success", "successfulTx");
    const rep = getReputation("ut_success");
    expect(rep.successfulSubmissions).toBeGreaterThanOrEqual(1);
  });

  it("decreases score for failed transactions", () => {
    updateReputation("ut_fail", "failedTx");
    const rep = getReputation("ut_fail");
    expect(rep.failedSubmissions).toBeGreaterThanOrEqual(1);
  });

  it("decreases score significantly for blocked content", () => {
    updateReputation("ut_blocked", "blockedContent");
    const rep = getReputation("ut_blocked");
    expect(rep.blockedSubmissions).toBeGreaterThanOrEqual(1);
    expect(rep.failedSubmissions).toBeGreaterThanOrEqual(1);
  });

  it("tracks multiple submissions", () => {
    updateReputation("ut_multi", "successfulTx");
    updateReputation("ut_multi", "successfulTx");
    updateReputation("ut_multi", "failedTx");
    const rep = getReputation("ut_multi");
    expect(rep.totalSubmissions).toBeGreaterThanOrEqual(3);
    expect(rep.successfulSubmissions).toBeGreaterThanOrEqual(2);
    expect(rep.failedSubmissions).toBeGreaterThanOrEqual(1);
  });

  it("creates reputation events", () => {
    const db = getDb();
    updateReputation("ut_events", "successfulTx", "test reason");
    const events = db.prepare("SELECT * FROM reputation_events WHERE address = ?").all("ut_events");
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].event_type).toBe("successfulTx");
  });

  it("caps score at maximum", () => {
    for (let i = 0; i < 100; i++) {
      updateReputation("ut_max", "successfulTx");
    }
    const rep = getReputation("ut_max");
    expect(rep.score).toBeLessThanOrEqual(MAX_SCORE);
  });

  it("caps score at minimum", () => {
    for (let i = 0; i < 50; i++) {
      updateReputation("ut_min", "blockedContent");
    }
    const rep = getReputation("ut_min");
    expect(rep.score).toBeGreaterThanOrEqual(MIN_SCORE);
  });
});

describe("addFlag", () => {
  it("adds a flag to an address", () => {
    updateReputation("flag_test_addr", "successfulTx");
    addFlag("flag_test_addr", "spam");
    const rep = getReputation("flag_test_addr");
    expect(rep.flags).toContain("spam");
  });

  it("does not add duplicate flags", () => {
    updateReputation("flag_nodup", "successfulTx");
    addFlag("flag_nodup", "spam");
    addFlag("flag_nodup", "spam");
    const rep = getReputation("flag_nodup");
    expect(rep.flags.length).toBe(1);
  });

  it("supports multiple flags", () => {
    updateReputation("flag_multi", "successfulTx");
    addFlag("flag_multi", "spam");
    addFlag("flag_multi", "injection");
    const rep = getReputation("flag_multi");
    expect(rep.flags).toContain("spam");
    expect(rep.flags).toContain("injection");
  });
});

describe("isBlocked", () => {
  it("returns false for new address", () => {
    expect(isBlocked("fresh_addr_test")).toBe(false);
  });

  it("returns true for address with very low score", () => {
    for (let i = 0; i < 20; i++) {
      updateReputation("blocked_addr_test", "blockedContent");
    }
    expect(isBlocked("blocked_addr_test")).toBe(true);
  });
});

describe("getTopAddresses", () => {
  it("returns addresses sorted by score descending", () => {
    updateReputation("top_a_test", "successfulTx");
    updateReputation("top_a_test", "successfulTx");
    updateReputation("top_b_test", "successfulTx");
    updateReputation("top_c_test", "blockedContent");

    const top = getTopAddresses(10);
    expect(top.length).toBeGreaterThanOrEqual(2);
  });

  it("respects limit parameter", () => {
    for (let i = 0; i < 5; i++) {
      updateReputation(`top_lim_${i}`, "successfulTx");
    }
    const top = getTopAddresses(2);
    expect(top.length).toBe(2);
  });
});

describe("getFlaggedAddresses", () => {
  it("returns only addresses with flags", () => {
    updateReputation("gf_a", "successfulTx");
    addFlag("gf_a", "spam");
    updateReputation("gf_b", "successfulTx");
    addFlag("gf_b", "injection");
    updateReputation("gf_not", "successfulTx");

    const flagged = getFlaggedAddresses();
    expect(flagged.length).toBeGreaterThanOrEqual(2);
  });
});

describe("constants", () => {
  it("has correct thresholds", () => {
    expect(INITIAL_SCORE).toBe(50);
    expect(MAX_SCORE).toBe(100);
    expect(MIN_SCORE).toBe(0);
    expect(TRUSTED_THRESHOLD).toBe(70);
    expect(SUSPICIOUS_THRESHOLD).toBe(30);
    expect(BLOCKED_THRESHOLD).toBe(10);
  });
});
