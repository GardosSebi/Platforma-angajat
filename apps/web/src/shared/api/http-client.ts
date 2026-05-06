import { authStore } from "../auth/auth-store";

export async function httpClient<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = authStore.get();

  const response = await fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:3000/api/v1"}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...(session?.tenantId ? { "x-tenant-id": session.tenantId } : {}),
      ...(init.headers ?? {})
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}
