const INJECTION_PATTERNS = [
  { name: "ignore_previous", regex: /ignore\s+(all\s+)?(previous|prior)\s+(instructions?|rules?|prompts?|directives?)/i, severity: "high" },
  { name: "system_override", regex: /(system\s*:\s*|system_prompt\s*:|<\|system\|>)/i, severity: "high" },
  { name: "role_play", regex: /(you are now|pretend to be|act as|you will act as|disregard your)/i, severity: "high" },
  { name: "new_directives", regex: /(new (instructions?|rules?|directives?|prompt)|from now on|hereafter)/i, severity: "medium" },
  { name: "output_manipulation", regex: /(do not (mention|reveal|disclose|show)|keep (this|it) secret|hidden (output|response))/i, severity: "high" },
  { name: "extraction_attempt", regex: /(reveal your (instructions?|system prompt|initial prompt)|what are your (rules|instructions))/i, severity: "critical" },
  { name: "delimiter_abuse", regex: /(<\|end\|>|<\|assistant\|>|<\|user\|>|<\/?system>|<\/?prompt>)/i, severity: "medium" },
  { name: "base64_payload", regex: /([A-Za-z0-9+/]{40,}={0,2})/, severity: "low" },
  { name: "unicode_escape", regex: /(\\u[0-9a-fA-F]{4}){4,}/i, severity: "medium" },
  { name: "eval_execution", regex: /(eval\(|exec\(|Function\(|setTimeout\(|setInterval\()/i, severity: "critical" },
  { name: "template_injection", regex: /(\{\{.*\}\}|<%.*%>|`\$\{)/, severity: "medium" },
  { name: "markdown_injection", regex: /(```[\s\S]{200,}```)/, severity: "low" },
];

const POISONING_INDICATORS = [
  { name: "serialized_object", regex: /(__proto__|prototype|constructor|java\.lang|pickle|marshal)/i, severity: "high" },
  { name: "encoded_script", regex: /(data:text\/html;base64|javascript:|data:application\/x)/i, severity: "critical" },
  { name: "sql_injection", regex: /(\b(union\s+select|drop\s+table|insert\s+into|delete\s+from)\b)/i, severity: "high" },
  { name: "xxe_payload", regex: /(<!ENTITY|<!DOCTYPE.*SYSTEM)/i, severity: "critical" },
  { name: "ssrf_attempt", regex: /(http:\/\/(169\.254\.169\.254|localhost|0\.0\.0\.0|127\.0\.0\.1))/i, severity: "high" },
  { name: "repeated_pattern", regex: /(.)\1{50,}/, severity: "medium" },
  { name: "nested_structure", regex: /(\[|\{)(\s*(\[|\{)){10,}/, severity: "medium" },
];

function scanForInjections(text) {
  const findings = [];

  for (const pattern of INJECTION_PATTERNS) {
    const matches = text.match(pattern.regex);
    if (matches) {
      findings.push({
        type: "injection",
        pattern: pattern.name,
        severity: pattern.severity,
        matched: matches[0],
        index: matches.index,
      });
    }
  }

  return findings;
}

function scanForPoisoning(text) {
  const findings = [];

  for (const indicator of POISONING_INDICATORS) {
    const matches = text.match(indicator.regex);
    if (matches) {
      findings.push({
        type: "poisoning",
        indicator: indicator.name,
        severity: indicator.severity,
        matched: matches[0],
        index: matches.index,
      });
    }
  }

  return findings;
}

function calculateRiskScore(findings) {
  const severityWeights = { critical: 10, high: 5, medium: 2, low: 1 };
  let score = 0;
  for (const finding of findings) {
    score += severityWeights[finding.severity] || 1;
  }
  return score;
}

function getHighestSeverity(findings) {
  const order = ["critical", "high", "medium", "low"];
  for (const level of order) {
    if (findings.some((f) => f.severity === level)) {
      return level;
    }
  }
  return "none";
}

function scanContent(text) {
  if (typeof text !== "string") {
    return { findings: [], riskScore: 0, highestSeverity: "none", blocked: false };
  }

  const injectionFindings = scanForInjections(text);
  const poisoningFindings = scanForPoisoning(text);
  const allFindings = [...injectionFindings, ...poisoningFindings];
  const riskScore = calculateRiskScore(allFindings);
  const highestSeverity = getHighestSeverity(allFindings);

  return {
    findings: allFindings,
    riskScore,
    highestSeverity,
    blocked: highestSeverity === "critical" || riskScore >= 10,
  };
}

function scanRecord(req, res, next) {
  if (!req.sanitizedBody) {
    return next();
  }

  const body = req.sanitizedBody;
  const fieldsToScan = [
    { field: "summary", text: body.summary },
    { field: "content", text: body.content },
    { field: "fileName", text: body.fileName || "" },
  ];

  for (const tag of body.tags || []) {
    fieldsToScan.push({ field: "tags", text: tag });
  }

  for (const [key, value] of Object.entries(body.labels || {})) {
    fieldsToScan.push({ field: `labels.${key}`, text: String(value) });
  }

  const allFindings = [];
  let maxRiskScore = 0;

  for (const { field, text } of fieldsToScan) {
    const result = scanContent(text);
    for (const finding of result.findings) {
      finding.field = field;
      allFindings.push(finding);
    }
    if (result.riskScore > maxRiskScore) {
      maxRiskScore = result.riskScore;
    }
  }

  req.scanResults = {
    findings: allFindings,
    riskScore: maxRiskScore,
    highestSeverity: getHighestSeverity(allFindings),
    blocked: maxRiskScore >= 10 || allFindings.some((f) => f.severity === "critical"),
  };

  if (req.scanResults.blocked) {
    return res.status(403).json({
      error: "Content blocked by security scanner",
      reason: `Detected ${req.scanResults.highestSeverity} severity threat(s)`,
      findings: req.scanResults.findings.map((f) => ({
        type: f.type,
        pattern: f.pattern || f.indicator,
        severity: f.severity,
        field: f.field,
      })),
    });
  }

  next();
}

module.exports = {
  INJECTION_PATTERNS,
  POISONING_INDICATORS,
  scanForInjections,
  scanForPoisoning,
  scanContent,
  scanRecord,
  calculateRiskScore,
  getHighestSeverity,
};
