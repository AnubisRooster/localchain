const crypto = require("crypto");

const CONTENT_CATEGORIES = {
  TEXT_PLAIN: "text_plain",
  CODE: "code",
  DATA_STRUCTURE: "data_structure",
  MARKUP: "markup",
  CONFIG: "config",
  LOG: "log",
  ENCODED: "encoded",
  SUSPICIOUS: "suspicious",
};

const CODE_PATTERNS = [
  /\b(function|const|let|var|class|import|export|require|return|if|else|for|while)\b/,
  /\b(def|async|await|yield|lambda|self|print)\b/,
  /\b(func|package|struct|interface|go)\b/,
];

const DATA_PATTERNS = [
  /^\s*[\{\[]/,
  /^\s*"[^"]+"\s*:/,
  /^\s*\d+\s*,/,
];

const MARKUP_PATTERNS = [
  /<[a-z][\s\S]*>/i,
  /<\/?[a-z][^>]*>/i,
  /&[a-z]+;/i,
];

const CONFIG_PATTERNS = [
  /^\s*[a-z_]+\s*[=:]/im,
  /^\s*\[[a-z_]+\]/im,
  /^\s*---\s*$/m,
];

const LOG_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}/,
  /\b(INFO|WARN|ERROR|DEBUG|TRACE)\b/,
  /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/,
];

const ENCODED_PATTERNS = [
  /^[A-Za-z0-9+/]+=*$/,
  /%[0-9A-Fa-f]{2}/,
  /\\x[0-9a-fA-F]{2}/,
  /\\u[0-9a-fA-F]{4}/,
];

const ENTROPY_THRESHOLD = 5.5;

function calculateEntropy(str) {
  if (!str || str.length === 0) return 0;

  const freq = {};
  for (const char of str) {
    freq[char] = (freq[char] || 0) + 1;
  }

  const len = str.length;
  let entropy = 0;
  for (const count of Object.values(freq)) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }

  return entropy;
}

function detectCategory(text) {
  if (!text || typeof text !== "string") return CONTENT_CATEGORIES.TEXT_PLAIN;

  const trimmed = text.trim();
  if (!trimmed) return CONTENT_CATEGORIES.TEXT_PLAIN;

  let matches = {};

  for (const pattern of CODE_PATTERNS) {
    if (pattern.test(trimmed)) {
      matches[CONTENT_CATEGORIES.CODE] = (matches[CONTENT_CATEGORIES.CODE] || 0) + 1;
    }
  }

  for (const pattern of DATA_PATTERNS) {
    if (pattern.test(trimmed)) {
      matches[CONTENT_CATEGORIES.DATA_STRUCTURE] = (matches[CONTENT_CATEGORIES.DATA_STRUCTURE] || 0) + 1;
    }
  }

  for (const pattern of MARKUP_PATTERNS) {
    if (pattern.test(trimmed)) {
      matches[CONTENT_CATEGORIES.MARKUP] = (matches[CONTENT_CATEGORIES.MARKUP] || 0) + 1;
    }
  }

  for (const pattern of CONFIG_PATTERNS) {
    if (pattern.test(trimmed)) {
      matches[CONTENT_CATEGORIES.CONFIG] = (matches[CONTENT_CATEGORIES.CONFIG] || 0) + 1;
    }
  }

  for (const pattern of LOG_PATTERNS) {
    if (pattern.test(trimmed)) {
      matches[CONTENT_CATEGORIES.LOG] = (matches[CONTENT_CATEGORIES.LOG] || 0) + 1;
    }
  }

  for (const pattern of ENCODED_PATTERNS) {
    if (pattern.test(trimmed)) {
      matches[CONTENT_CATEGORIES.ENCODED] = (matches[CONTENT_CATEGORIES.ENCODED] || 0) + 1;
    }
  }

  const maxCategory = Object.entries(matches).sort((a, b) => b[1] - a[1])[0];
  return maxCategory ? maxCategory[0] : CONTENT_CATEGORIES.TEXT_PLAIN;
}

function analyzeContent(text) {
  if (!text || typeof text !== "string") {
    return {
      hash: null,
      length: 0,
      entropy: 0,
      category: CONTENT_CATEGORIES.TEXT_PLAIN,
      isHighEntropy: false,
      wordCount: 0,
      lineCount: 0,
      uniqueWords: 0,
      lexicalDiversity: 0,
    };
  }

  const hash = crypto.createHash("sha256").update(text).digest("hex");
  const length = text.length;
  const entropy = calculateEntropy(text);
  const category = detectCategory(text);
  const isHighEntropy = entropy > ENTROPY_THRESHOLD;

  const words = text.toLowerCase().match(/\b\w+\b/g) || [];
  const wordCount = words.length;
  const uniqueWords = new Set(words).size;
  const lexicalDiversity = wordCount > 0 ? uniqueWords / wordCount : 0;
  const lineCount = text.split("\n").length;

  return {
    hash,
    length,
    entropy: parseFloat(entropy.toFixed(4)),
    category,
    isHighEntropy,
    wordCount,
    lineCount,
    uniqueWords,
    lexicalDiversity: parseFloat(lexicalDiversity.toFixed(4)),
  };
}

function detectDuplication(content, existingHashes = new Set()) {
  const hash = crypto.createHash("sha256").update(content).digest("hex");
  const isDuplicate = existingHashes.has(hash);

  return {
    hash,
    isDuplicate,
    similarity: isDuplicate ? 1.0 : 0,
  };
}

function contentAnalysisMiddleware(req, res, next) {
  if (!req.sanitizedBody) {
    return next();
  }

  const body = req.sanitizedBody;
  const contentAnalysis = analyzeContent(body.content);
  const summaryAnalysis = analyzeContent(body.summary);

  req.contentAnalysis = {
    content: contentAnalysis,
    summary: summaryAnalysis,
  };

  if (contentAnalysis.isHighEntropy && contentAnalysis.length > 100) {
    req.highEntropyWarning = true;
  }

  next();
}

module.exports = {
  CONTENT_CATEGORIES,
  calculateEntropy,
  detectCategory,
  analyzeContent,
  detectDuplication,
  contentAnalysisMiddleware,
  ENTROPY_THRESHOLD,
};
