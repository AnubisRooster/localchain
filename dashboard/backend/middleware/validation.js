const { z } = require("zod");

const MAX_SUMMARY_LENGTH = 500;
const MAX_CONTENT_LENGTH = 50000;
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 100;
const MAX_LABELS = 50;
const MAX_LABEL_KEY_LENGTH = 100;
const MAX_LABEL_VALUE_LENGTH = 500;
const ALLOWED_CONTENT_TYPES = ["text", "json", "csv", "xml", "html", "markdown", "log", "config"];

const recordSchema = z.object({
  summary: z
    .string()
    .min(1, "Summary is required")
    .max(MAX_SUMMARY_LENGTH, `Summary must be under ${MAX_SUMMARY_LENGTH} characters`)
    .trim(),
  content: z
    .string()
    .min(1, "Content is required")
    .max(MAX_CONTENT_LENGTH, `Content must be under ${MAX_CONTENT_LENGTH} characters`),
  contentType: z
    .enum(ALLOWED_CONTENT_TYPES)
    .optional()
    .default("text"),
  fileName: z
    .string()
    .max(255, "File name must be under 255 characters")
    .optional()
    .nullable(),
  tags: z
    .array(z.string().max(MAX_TAG_LENGTH, `Each tag must be under ${MAX_TAG_LENGTH} characters`))
    .max(MAX_TAGS, `Maximum ${MAX_TAGS} tags allowed`)
    .optional()
    .default([]),
  labels: z
    .record(
      z.string().max(MAX_LABEL_KEY_LENGTH, `Label key must be under ${MAX_LABEL_KEY_LENGTH} characters`),
      z.string().max(MAX_LABEL_VALUE_LENGTH, `Label value must be under ${MAX_LABEL_VALUE_LENGTH} characters`)
    )
    .refine((obj) => Object.keys(obj).length <= MAX_LABELS, `Maximum ${MAX_LABELS} labels allowed`)
    .optional()
    .default({}),
});

const blockQuerySchema = z.object({
  height: z.string().regex(/^\d+$/, "Height must be a positive integer").optional(),
});

const txQuerySchema = z.object({
  hash: z.string().regex(/^[A-Fa-f0-9]{64}$/, "Transaction hash must be a 64-character hex string").optional(),
  query: z.string().max(1000, "Query must be under 1000 characters").optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  per_page: z.coerce.number().int().min(1).max(100).optional().default(30),
});

const recordsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  search: z.string().max(500, "Search term must be under 500 characters").optional(),
  tag: z.string().max(MAX_TAG_LENGTH, `Tag must be under ${MAX_TAG_LENGTH} characters`).optional(),
});

function validateRecord(req, res, next) {
  const result = recordSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: result.error.issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    });
  }
  req.validatedBody = result.data;
  next();
}

function validateBlockQuery(req, res, next) {
  const result = blockQuerySchema.safeParse(req.params);
  if (!result.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: result.error.issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    });
  }
  next();
}

function validateTxQuery(req, res, next) {
  const result = txQuerySchema.safeParse({ ...req.params, ...req.query });
  if (!result.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: result.error.issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    });
  }
  req.validatedTxQuery = result.data;
  next();
}

function validateRecordsQuery(req, res, next) {
  const result = recordsQuerySchema.safeParse(req.query);
  if (!result.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: result.error.issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    });
  }
  req.validatedQuery = result.data;
  next();
}

module.exports = {
  recordSchema,
  blockQuerySchema,
  txQuerySchema,
  recordsQuerySchema,
  validateRecord,
  validateBlockQuery,
  validateTxQuery,
  validateRecordsQuery,
  MAX_SUMMARY_LENGTH,
  MAX_CONTENT_LENGTH,
  MAX_TAGS,
  MAX_TAG_LENGTH,
  MAX_LABELS,
  ALLOWED_CONTENT_TYPES,
};
