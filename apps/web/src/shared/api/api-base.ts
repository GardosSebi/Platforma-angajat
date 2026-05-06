/**
 * API base URL for JSON requests.
 * - If `VITE_API_URL` is set (and not a mistaken dev-server URL), it wins.
 * - In dev, defaults to Nest on port 3000 (API has CORS enabled). Avoids Vite proxy edge cases.
 * - In production builds without env, falls back to localhost (set VITE_API_URL in real deployments).
 */
export function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_URL;
  if (typeof fromEnv === "string" && fromEnv.trim().length > 0) {
    const trimmed = fromEnv.trim().replace(/\/$/, "");
    // Misconfiguration: pointing at the Vite dev/preview host causes 404 "Cannot POST /api/v1/..."
    if (import.meta.env.DEV && /:(5173|4173)(\/|$)/.test(trimmed)) {
      console.warn(
        "[web] VITE_API_URL points at the Vite port (5173/4173). Using http://localhost:3000/api/v1 instead."
      );
      return "http://localhost:3000/api/v1";
    }
    return trimmed;
  }
  if (import.meta.env.DEV) {
    return "http://localhost:3000/api/v1";
  }
  return "http://localhost:3000/api/v1";
}
