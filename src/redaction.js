const SECRET_PATTERNS = [
  /AIza[0-9A-Za-z_-]{30,}/g,
  /sk-(?:proj-)?[0-9A-Za-z_-]{20,}/g,
  /sk-ant-[0-9A-Za-z_-]{20,}/g,
  /gh[pousr]_[0-9A-Za-z]{20,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s:/]+:[^\s@/]+@/gi,
];

const ASSIGNMENT_PATTERN = /\b(api[_-]?key|access[_-]?token|auth(?:orization)?|client[_-]?secret|password)\b(\s*[:=]\s*)([^\s,;"']+)/gi;
const SENSITIVE_KEY = /^(?:api[_-]?key|access[_-]?token|refresh[_-]?token|auth(?:orization)?|client[_-]?secret|password|passwd|private[_-]?key|secret)$/i;

function redactString(value) {
  let output = String(value);
  for (const pattern of SECRET_PATTERNS) output = output.replace(pattern, '[REDACTED]');
  return output.replace(ASSIGNMENT_PATTERN, '$1$2[REDACTED]');
}

function redactValue(value, seen = new WeakSet()) {
  if (typeof value === 'string') return redactString(value);
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);
  if (Array.isArray(value)) return value.map(item => redactValue(item, seen));
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, SENSITIVE_KEY.test(key) ? '[REDACTED]' : redactValue(item, seen)]));
}

module.exports = { redactString, redactValue };
