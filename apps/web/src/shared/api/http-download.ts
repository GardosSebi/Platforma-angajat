import { authStore, isAccessTokenExpired } from "../auth/auth-store";
import { handleSessionExpired } from "../auth/session-expired";
import { getApiBaseUrl } from "./api-base";

function fileNameFromDisposition(disposition: string | null): string | undefined {
  if (!disposition) return undefined;
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }
  const quotedMatch = disposition.match(/filename="([^"]+)"/i);
  if (quotedMatch?.[1]) {
    return quotedMatch[1];
  }
  const plainMatch = disposition.match(/filename=([^;]+)/i);
  return plainMatch?.[1]?.trim();
}

export async function downloadWithAuth(path: string, fallbackFilename: string) {
  const session = authStore.get();
  if (session?.accessToken && isAccessTokenExpired(session.accessToken)) {
    handleSessionExpired();
    throw new Error("Sesiunea a expirat. Autentificați-vă din nou.");
  }
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    headers: {
      ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...(session?.tenantId ? { "x-tenant-id": session.tenantId } : {})
    }
  });

  if (!response.ok) {
    if (response.status === 401) {
      handleSessionExpired();
    }
    let details = "";
    try {
      details = await response.text();
    } catch {
      // ignore parse failure
    }
    throw new Error(`Download failed (${response.status}). ${details}`.trim());
  }

  const blob = await response.blob();
  const contentDisposition = response.headers.get("content-disposition");
  const filename = fileNameFromDisposition(contentDisposition) ?? fallbackFilename;
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}
