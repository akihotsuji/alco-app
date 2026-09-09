/** Workers Logs 用。写真・Base64・Cookie は残さない */
export function summarizeAiError(error: unknown): string {
  if (error instanceof Error) {
    return sanitize(`${error.name}:${error.message} ${readExtras(error)}`.trim());
  }
  if (typeof error === "object" && error !== null) {
    return sanitize(readExtras(error));
  }
  if (typeof error === "string") {
    return sanitize(error);
  }
  return "unknown";
}

function readExtras(error: object): string {
  const parts: string[] = [];
  collect(error, parts, 0);
  return parts.join(" ");
}

function collect(error: object, parts: string[], depth: number) {
  if (depth > 2) {
    return;
  }
  const status = Reflect.get(error, "status") ?? Reflect.get(error, "statusCode");
  const code = Reflect.get(error, "code");
  const message = Reflect.get(error, "message");
  const nested = Reflect.get(error, "error");
  const cause = Reflect.get(error, "cause");
  if (typeof status === "number") {
    parts.push(`status=${status}`);
  }
  if (typeof code === "string" || typeof code === "number") {
    parts.push(`code=${code}`);
  }
  if (typeof message === "string") {
    parts.push(message);
  }
  if (typeof nested === "string") {
    parts.push(nested);
  } else if (typeof nested === "object" && nested !== null) {
    collect(nested, parts, depth + 1);
  }
  if (typeof cause === "string") {
    parts.push(cause);
  } else if (typeof cause === "object" && cause !== null) {
    collect(cause, parts, depth + 1);
  }
}

function sanitize(text: string): string {
  const stripped = text
    .replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi, "[image]")
    .replace(/[A-Za-z0-9+/]{80,}={0,2}/g, "[b64]")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.slice(0, 160) || "unknown";
}
