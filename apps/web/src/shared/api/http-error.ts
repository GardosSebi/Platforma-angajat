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
      ? "Nu ești autentificat sau sesiunea a expirat. Autentifică-te din nou."
      : response.status === 403
        ? "Nu ai permisiune pentru această acțiune."
        : response.status === 404
          ? "Resursa nu a fost găsită."
          : `Cererea a eșuat (${response.status}).`;

  const message = fromNest ?? fromText ?? fallback;

  return new HttpError(message, response.status, body);
}
