import { authStore, isAccessTokenExpired } from "../auth/auth-store";
import { handleSessionExpired } from "../auth/session-expired";
import { getApiBaseUrl } from "./api-base";
import { HttpError, httpErrorFromResponse } from "./http-error";

export async function httpClient<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = authStore.get();
  const base = getApiBaseUrl();
  const isFormData = init.body instanceof FormData;

  if (session?.accessToken && isAccessTokenExpired(session.accessToken)) {
    handleSessionExpired();
    throw new HttpError("Sesiunea a expirat. Autentificați-vă din nou.", 401);
  }

  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
        ...(session?.tenantId ? { "x-tenant-id": session.tenantId } : {}),
        ...(init.headers ?? {})
      }
    });
  } catch {
    const hint = import.meta.env.DEV
      ? " Pornește API-ul pe portul 3000: pnpm --filter @apps/api dev (sau pnpm dev)."
      : " Verifică dacă serverul rulează și dacă adresa API este corectă.";
    throw new Error(`API-ul nu poate fi contactat (${base}).${hint}`);
  }

  if (!response.ok) {
    if (response.status === 401) {
      handleSessionExpired();
    }
    throw await httpErrorFromResponse(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
