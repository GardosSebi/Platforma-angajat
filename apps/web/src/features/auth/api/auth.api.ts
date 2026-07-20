import type { LdapLoginRequest, TenantSsoStatusResponse } from "@repo/shared-types/auth-push";
import { getApiBaseUrl } from "../../../shared/api/api-base";
import { httpErrorFromResponse } from "../../../shared/api/http-error";

export interface LoginResponse {
  accessToken: string;
  expiresIn: string;
  linkedEmployeeId?: string | null;
  user: {
    id: string;
    email: string;
    tenantId: string;
    roles: string[];
  };
}

export async function loginRequest(tenantId: string, email: string, password: string): Promise<LoginResponse> {
  const base = getApiBaseUrl();
  let response: Response;
  try {
    response = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tenant-id": tenantId
      },
      body: JSON.stringify({ email, password })
    });
  } catch {
    const hint =
      import.meta.env.DEV
        ? " Start Nest on port 3000 (pnpm --filter @apps/api dev or pnpm dev). Test: http://localhost:3000/api/v1/health/live"
        : " Check that the backend is running and VITE_API_URL is correct.";
    throw new Error(`Cannot reach the API (${base}).${hint}`);
  }

  if (!response.ok) {
    throw await httpErrorFromResponse(response);
  }

  return response.json() as Promise<LoginResponse>;
}

async function authFetch(tenantId: string, path: string, init?: RequestInit): Promise<Response> {
  const base = getApiBaseUrl();
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "x-tenant-id": tenantId,
        ...(init?.headers ?? {})
      }
    });
  } catch {
    const hint =
      import.meta.env.DEV
        ? " Start Nest on port 3000 (pnpm --filter @apps/api dev or pnpm dev)."
        : " Check that the backend is running and VITE_API_URL is correct.";
    throw new Error(`Cannot reach the API (${base}).${hint}`);
  }
  if (!response.ok) {
    throw await httpErrorFromResponse(response);
  }
  return response;
}

export async function getSsoStatus(tenantId: string): Promise<TenantSsoStatusResponse> {
  const response = await authFetch(tenantId, "/auth/sso/status");
  return response.json() as Promise<TenantSsoStatusResponse>;
}

export async function loginLdap(tenantId: string, username: string, password: string): Promise<LoginResponse> {
  const payload: LdapLoginRequest = { username, password };
  const response = await authFetch(tenantId, "/auth/sso/ldap", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  return response.json() as Promise<LoginResponse>;
}

export async function loginAzureCallback(tenantId: string, code: string): Promise<LoginResponse> {
  const response = await authFetch(tenantId, "/auth/sso/azure/callback", {
    method: "POST",
    body: JSON.stringify({ code })
  });
  return response.json() as Promise<LoginResponse>;
}
