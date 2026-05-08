import { authStore } from "../auth/auth-store";
import { getApiBaseUrl } from "./api-base";
import { httpErrorFromResponse } from "./http-error";

export async function httpClient<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = authStore.get();
  const base = getApiBaseUrl();
  const isFormData = init.body instanceof FormData;

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
    const hint =
      import.meta.env.DEV
        ? " Start Nest on port 3000: pnpm --filter @apps/api dev (or pnpm dev). Test: http://localhost:3000/api/v1/health/live"
        : " Check that the backend is running and VITE_API_URL is correct.";
    throw new Error(`Cannot reach the API (${base}).${hint}`);
  }

  if (!response.ok) {
    throw await httpErrorFromResponse(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
