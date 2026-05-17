const {
  calculateEntropy,
  detectCategory,
  analyzeContent,
  detectDuplication,
  CONTENT_CATEGORIES,
  ENTROPY_THRESHOLD,
} = require("../services/content-analyzer");

describe("calculateEntropy", () => {
  it("returns 0 for empty string", () => {
    expect(calculateEntropy("")).toBe(0);
  });

  it("returns 0 for null/undefined", () => {
    expect(calculateEntropy(null)).toBe(0);
    expect(calculateEntropy(undefined)).toBe(0);
  });

  it("returns 0 for single repeated character", () => {
    expect(calculateEntropy("aaaa")).toBe(0);
  });

  it("returns higher entropy for varied text", () => {
    const entropy = calculateEntropy("The quick brown fox jumps over the lazy dog");
    expect(entropy).toBeGreaterThan(3);
  });

  it("returns high entropy for random-looking strings", () => {
    const entropy = calculateEntropy("aB3$xK9!mP2@qR7&");
    expect(entropy).toBeGreaterThan(3.5);
  });

  it("returns consistent results for same input", () => {
    const text = "hello world";
    expect(calculateEntropy(text)).toBe(calculateEntropy(text));
  });
});

describe("detectCategory", () => {
  it("detects plain text", () => {
    expect(detectCategory("This is a normal sentence about finance")).toBe(CONTENT_CATEGORIES.TEXT_PLAIN);
  });

  it("detects code", () => {
    expect(detectCategory("function test() { return true; }")).toBe(CONTENT_CATEGORIES.CODE);
  });

  it("detects Python code", () => {
    expect(detectCategory("def hello():\n    print('world')")).toBe(CONTENT_CATEGORIES.CODE);
  });

  it("detects data structures", () => {
    expect(detectCategory('{"key": "value", "count": 42}')).toBe(CONTENT_CATEGORIES.DATA_STRUCTURE);
  });

  it("detects markup", () => {
    expect(detectCategory("<div class='container'>Hello</div>")).toBe(CONTENT_CATEGORIES.MARKUP);
  });

  it("detects config files", () => {
    expect(detectCategory("database_url = postgres://localhost/db")).toBe(CONTENT_CATEGORIES.CONFIG);
  });

  it("detects log entries", () => {
    expect(detectCategory("2024-01-15 10:30:00 INFO Server started")).toBe(CONTENT_CATEGORIES.LOG);
  });

  it("detects encoded content", () => {
    expect(detectCategory("SGVsbG8gV29ybGQ=")).toBe(CONTENT_CATEGORIES.ENCODED);
  });

  it("handles empty string", () => {
    expect(detectCategory("")).toBe(CONTENT_CATEGORIES.TEXT_PLAIN);
  });

  it("handles null", () => {
    expect(detectCategory(null)).toBe(CONTENT_CATEGORIES.TEXT_PLAIN);
  });
});

describe("analyzeContent", () => {
  it("returns full analysis for text", () => {
    const text = "Hello world this is a test sentence";
    const result = analyzeContent(text);
    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.length).toBe(text.length);
    expect(result.entropy).toBeGreaterThan(0);
    expect(result.wordCount).toBe(7);
    expect(result.lineCount).toBe(1);
    expect(result.uniqueWords).toBeGreaterThan(0);
    expect(result.lexicalDiversity).toBeGreaterThan(0);
    expect(result.lexicalDiversity).toBeLessThanOrEqual(1);
  });

  it("detects high entropy content", () => {
    const randomish = "aB3$xK9!mP2@qR7&nL5*wT8#yF1@hJ4%cV6^bN0dS2gA7kM3pQ9rU5xZ8".repeat(4);
    const result = analyzeContent(randomish);
    expect(result.isHighEntropy).toBe(true);
  });

  it("detects low entropy content", () => {
    const result = analyzeContent("aaaaa aaaaa aaaaa");
    expect(result.isHighEntropy).toBe(false);
  });

  it("handles multiline text", () => {
    const result = analyzeContent("line1\nline2\nline3");
    expect(result.lineCount).toBe(3);
  });

  it("handles empty input", () => {
    const result = analyzeContent("");
    expect(result.hash).toBeNull();
    expect(result.length).toBe(0);
    expect(result.entropy).toBe(0);
    expect(result.wordCount).toBe(0);
  });

  it("handles null input", () => {
    const result = analyzeContent(null);
    expect(result.hash).toBeNull();
    expect(result.length).toBe(0);
  });

  it("calculates lexical diversity correctly", () => {
    const result = analyzeContent("the the the cat cat dog");
    expect(result.uniqueWords).toBe(3);
    expect(result.wordCount).toBe(6);
    expect(result.lexicalDiversity).toBeCloseTo(0.5, 1);
  });
});

describe("detectDuplication", () => {
  it("detects exact duplicates", () => {
    const hashes = new Set();
    const content = "exact same content";
    const hash1 = require("crypto").createHash("sha256").update(content).digest("hex");
    hashes.add(hash1);

    const result = detectDuplication(content, hashes);
    expect(result.isDuplicate).toBe(true);
    expect(result.similarity).toBe(1.0);
  });

  it("returns not duplicate for new content", () => {
    const hashes = new Set(["someotherhash"]);
    const result = detectDuplication("unique content", hashes);
    expect(result.isDuplicate).toBe(false);
    expect(result.similarity).toBe(0);
  });

  it("returns hash for content", () => {
    const result = detectDuplication("test");
    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("CONTENT_CATEGORIES", () => {
  it("has all expected categories", () => {
    expect(CONTENT_CATEGORIES.TEXT_PLAIN).toBe("text_plain");
    expect(CONTENT_CATEGORIES.CODE).toBe("code");
    expect(CONTENT_CATEGORIES.DATA_STRUCTURE).toBe("data_structure");
    expect(CONTENT_CATEGORIES.MARKUP).toBe("markup");
    expect(CONTENT_CATEGORIES.CONFIG).toBe("config");
    expect(CONTENT_CATEGORIES.LOG).toBe("log");
    expect(CONTENT_CATEGORIES.ENCODED).toBe("encoded");
    expect(CONTENT_CATEGORIES.SUSPICIOUS).toBe("suspicious");
  });
});

describe("ENTROPY_THRESHOLD", () => {
  it("is set to 5.5", () => {
    expect(ENTROPY_THRESHOLD).toBe(5.5);
  });
});
