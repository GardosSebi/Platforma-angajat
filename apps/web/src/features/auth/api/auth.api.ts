import { getApiBaseUrl } from "../../../shared/api/api-base";
import { httpErrorFromResponse } from "../../../shared/api/http-error";

export interface LoginResponse {
  accessToken: string;
  expiresIn: string;
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
