export class HttpError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.body = body;
  }
}

function nestMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const m = (body as { message?: unknown }).message;
  if (typeof m === "string") {
    return m;
  }
  if (Array.isArray(m) && m.every((x) => typeof x === "string")) {
    return m.join("; ");
  }
  return null;
}

export async function httpErrorFromResponse(response: Response): Promise<HttpError> {
  const contentType = response.headers.get("content-type") ?? "";
  let body: unknown;

  if (contentType.includes("application/json")) {
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
  } else {
    try {
      const text = await response.text();
      body = text || undefined;
    } catch {
      body = undefined;
    }
  }

  const fromNest = nestMessage(body);
  const fromText =
    typeof body === "string" && body.length > 0 && body.length < 400 && !body.trim().startsWith("<")
      ? body.trim()
      : null;

  const fallback =
    response.status === 401
      ? "Not signed in or session expired. Sign in with tenant e01 and try again."
      : response.status === 403
        ? "You do not have permission for this action."
        : response.status === 404
          ? "API route not found. Restart the API (pnpm --filter @apps/api dev) and open http://localhost:3000/api/v1/health/live in the browser."
          : `Request failed (${response.status}).`;

  const message = fromNest ?? fromText ?? fallback;

  return new HttpError(message, response.status, body);
}
