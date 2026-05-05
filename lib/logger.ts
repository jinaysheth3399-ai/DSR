import "server-only"

const PII_PATTERNS: ReadonlyArray<RegExp> = [
  /\+?91[6-9]\d{9}/g,
  /\b\d{6}\b/g,
]

function redact(input: string): string {
  return PII_PATTERNS.reduce((acc, re) => acc.replace(re, "[redacted]"), input)
}

function safeStringify(value: unknown): string {
  if (typeof value === "string") return redact(value)
  try {
    return redact(JSON.stringify(value))
  } catch {
    return "[unserializable]"
  }
}

function emit(level: "info" | "warn" | "error", msg: string, meta?: unknown) {
  const safeMsg = redact(msg)
  const tail = meta !== undefined ? " " + safeStringify(meta) : ""
  const line = `[${level}] ${safeMsg}${tail}`
  if (level === "error") console.error(line)
  else if (level === "warn") console.warn(line)
  else console.log(line)
}

export const logger = {
  info: (msg: string, meta?: unknown) => emit("info", msg, meta),
  warn: (msg: string, meta?: unknown) => emit("warn", msg, meta),
  error: (msg: string, meta?: unknown) => emit("error", msg, meta),
}
