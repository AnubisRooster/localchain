const {
  sanitizeString,
  sanitizeObject,
  stripControlChars,
  stripZeroWidth,
  stripBidiOverrides,
  normalizeWhitespace,
} = require("../middleware/sanitization");

describe("stripControlChars", () => {
  it("removes null bytes", () => {
    expect(stripControlChars("hello\x00world")).toBe("helloworld");
  });

  it("removes bell character", () => {
    expect(stripControlChars("hello\x07world")).toBe("helloworld");
  });

  it("removes delete character", () => {
    expect(stripControlChars("hello\x7Fworld")).toBe("helloworld");
  });

  it("removes multiple control characters", () => {
    expect(stripControlChars("\x00\x01\x02test\x1F\x7F")).toBe("test");
  });

  it("preserves normal text", () => {
    expect(stripControlChars("normal text")).toBe("normal text");
  });

  it("preserves newlines and tabs", () => {
    expect(stripControlChars("line1\nline2\ttab")).toBe("line1\nline2\ttab");
  });

  it("removes surrogate characters", () => {
    const surrogate = "\uD800";
    expect(stripControlChars(`hello${surrogate}world`)).toBe("helloworld");
  });
});

describe("stripZeroWidth", () => {
  it("removes zero-width space", () => {
    expect(stripZeroWidth("hello\u200Bworld")).toBe("helloworld");
  });

  it("removes zero-width non-joiner", () => {
    expect(stripZeroWidth("hello\u200Cworld")).toBe("helloworld");
  });

  it("removes zero-width joiner", () => {
    expect(stripZeroWidth("hello\u200Dworld")).toBe("helloworld");
  });

  it("removes BOM", () => {
    expect(stripZeroWidth("\uFEFFhello")).toBe("hello");
  });

  it("removes line/paragraph separators", () => {
    expect(stripZeroWidth("hello\u2028world")).toBe("helloworld");
  });
});

describe("stripBidiOverrides", () => {
  it("removes bidi override characters", () => {
    expect(stripBidiOverrides("hello\u202Aworld")).toBe("helloworld");
  });

  it("removes right-to-left override", () => {
    expect(stripBidiOverrides("hello\u202Eworld")).toBe("helloworld");
  });
});

describe("normalizeWhitespace", () => {
  it("collapses multiple spaces", () => {
    expect(normalizeWhitespace("hello    world")).toBe("hello world");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalizeWhitespace("  hello world  ")).toBe("hello world");
  });

  it("preserves single spaces", () => {
    expect(normalizeWhitespace("hello world")).toBe("hello world");
  });
});

describe("sanitizeString", () => {
  it("applies all sanitization steps", () => {
    const input = "\x00hello\u200B  world\u202E  \x7F";
    const result = sanitizeString(input);
    expect(result).toBe("hello world");
  });

  it("returns non-string values unchanged", () => {
    expect(sanitizeString(42)).toBe(42);
    expect(sanitizeString(null)).toBe(null);
    expect(sanitizeString(undefined)).toBe(undefined);
  });

  it("handles empty string", () => {
    expect(sanitizeString("")).toBe("");
  });

  it("handles string with only control chars", () => {
    expect(sanitizeString("\x00\x01\x02")).toBe("");
  });
});

describe("sanitizeObject", () => {
  it("sanitizes string values in object", () => {
    const input = { name: "hello\x00world", desc: "test\u200Bdata" };
    const result = sanitizeObject(input);
    expect(result.name).toBe("helloworld");
    expect(result.desc).toBe("testdata");
  });

  it("sanitizes string keys in object", () => {
    const input = { ["key\x00name"]: "value" };
    const result = sanitizeObject(input);
    expect(result.keyname).toBe("value");
  });

  it("sanitizes strings in arrays", () => {
    const input = ["hello\x00", "world\u200B"];
    const result = sanitizeObject(input);
    expect(result).toEqual(["hello", "world"]);
  });

  it("handles nested objects", () => {
    const input = { outer: { inner: "text\x00\x01" } };
    const result = sanitizeObject(input);
    expect(result.outer.inner).toBe("text");
  });

  it("preserves non-string values", () => {
    const input = { count: 42, active: true, data: null };
    const result = sanitizeObject(input);
    expect(result.count).toBe(42);
    expect(result.active).toBe(true);
    expect(result.data).toBe(null);
  });

  it("returns non-objects unchanged", () => {
    expect(sanitizeObject("string")).toBe("string");
    expect(sanitizeObject(42)).toBe(42);
    expect(sanitizeObject(null)).toBe(null);
  });
});
