const CONTROL_CHAR_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
const ZERO_WIDTH_RE = /[\u200B-\u200F\u2028-\u202E\uFEFF]/g;
const BIDI_OVERRIDE_RE = /[\u202A-\u202E]/g;
const SURROGATE_RE = /[\uD800-\uDFFF]/g;
const MULTIPLE_SPACES = /  +/g;

function stripControlChars(str) {
  return str.replace(CONTROL_CHAR_RE, "").replace(SURROGATE_RE, "");
}

function stripZeroWidth(str) {
  return str.replace(ZERO_WIDTH_RE, "");
}

function stripBidiOverrides(str) {
  return str.replace(BIDI_OVERRIDE_RE, "");
}

function normalizeWhitespace(str) {
  return str.replace(MULTIPLE_SPACES, " ").trim();
}

function sanitizeString(str) {
  if (typeof str !== "string") return str;
  let result = stripControlChars(str);
  result = stripZeroWidth(result);
  result = stripBidiOverrides(result);
  result = normalizeWhitespace(result);
  return result;
}

function sanitizeObject(obj) {
  if (typeof obj !== "object" || obj === null) return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => (typeof item === "string" ? sanitizeString(item) : item));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    const cleanKey = sanitizeString(key);
    if (typeof value === "string") {
      sanitized[cleanKey] = sanitizeString(value);
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      sanitized[cleanKey] = sanitizeObject(value);
    } else {
      sanitized[cleanKey] = value;
    }
  }
  return sanitized;
}

function sanitizeRecord(req, res, next) {
  if (!req.body || !req.validatedBody) {
    return next();
  }

  const body = req.validatedBody;
  body.summary = sanitizeString(body.summary);
  body.content = sanitizeString(body.content);
  body.fileName = body.fileName ? sanitizeString(body.fileName) : null;
  body.tags = body.tags.map(sanitizeString).filter(Boolean);
  body.labels = sanitizeObject(body.labels);

  req.sanitizedBody = body;
  next();
}

function sanitizeQuery(req, res, next) {
  if (!req.query) return next();

  const sanitized = {};
  for (const [key, value] of Object.entries(req.query)) {
    sanitized[sanitizeString(key)] = typeof value === "string" ? sanitizeString(value) : value;
  }
  req.sanitizedQuery = sanitized;
  next();
}

module.exports = {
  sanitizeString,
  sanitizeObject,
  sanitizeRecord,
  sanitizeQuery,
  stripControlChars,
  stripZeroWidth,
  stripBidiOverrides,
  normalizeWhitespace,
};
