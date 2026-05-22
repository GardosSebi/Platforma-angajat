export interface SessionData {
  accessToken: string;
  tenantId: string;
  userId: string;
  roles?: string[];
  /** Durata sesiunii la ultimul login (ex. `8h`), din răspunsul API. */
  expiresInLabel?: string;
  /** Employee row matched by login email (same tenant); used for SSM self-service UI. */
  linkedEmployeeId?: string | null;
}

const TOKEN_KEY = "access_token";
export const SESSION_EXPIRED_FLAG_KEY = "auth_session_expired";
const EXPIRES_IN_LABEL_KEY = "auth_expires_in_label";
const TENANT_KEY = "tenant_id";
const USER_ID_KEY = "auth_user_id";
const ROLES_KEY = "auth_roles";
const LINKED_EMPLOYEE_KEY = "auth_linked_employee_id";
export const AUTH_CHANGED_EVENT = "employee-platform-auth-changed";

function notifyAuthChanged() {
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

function decodeJwtPayload(accessToken: string): Record<string, unknown> | null {
  try {
    const segment = accessToken.split(".")[1];
    if (!segment) return null;
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** `true` dacă JWT-ul are `exp` în trecut (skew 30s pentru ceasuri decalate). */
export function isAccessTokenExpired(accessToken: string, skewMs = 30_000): boolean {
  const expMs = getAccessTokenExpiryMs(accessToken);
  // Fără `exp` valid: nu acceptăm token vechi/necunoscut ca sesiune activă.
  if (expMs === null) return true;
  return Date.now() >= expMs - skewMs;
}

export function getAccessTokenExpiryMs(accessToken: string): number | null {
  const payload = decodeJwtPayload(accessToken);
  if (!payload) return null;
  const exp = payload.exp;
  if (typeof exp === "number" && Number.isFinite(exp)) {
    return exp * 1000;
  }
  if (typeof exp === "string" && /^\d+$/.test(exp)) {
    return Number.parseInt(exp, 10) * 1000;
  }
  return null;
}

export function getStoredExpiresInLabel(): string {
  return localStorage.getItem(EXPIRES_IN_LABEL_KEY)?.trim() || "8h";
}

export const authStore = {
  get(): SessionData | null {
    const accessToken = localStorage.getItem(TOKEN_KEY);
    const tenantId = localStorage.getItem(TENANT_KEY);
    if (!accessToken || !tenantId) return null;
    if (isAccessTokenExpired(accessToken)) {
      sessionStorage.setItem(SESSION_EXPIRED_FLAG_KEY, "1");
      this.clear();
      return null;
    }
    const rolesRaw = localStorage.getItem(ROLES_KEY);
    let roles: string[] | undefined;
    if (rolesRaw) {
      try {
        const parsed = JSON.parse(rolesRaw) as unknown;
        if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
          roles = parsed;
        }
      } catch {
        roles = undefined;
      }
    }
    const linkedRaw = localStorage.getItem(LINKED_EMPLOYEE_KEY);
    let linkedEmployeeId: string | null | undefined;
    if (linkedRaw === "") {
      linkedEmployeeId = null;
    } else if (linkedRaw) {
      linkedEmployeeId = linkedRaw;
    }
    const userId = localStorage.getItem(USER_ID_KEY) ?? parseAccessTokenUserId(accessToken);
    if (!userId) return null;
    return { accessToken, tenantId, userId, roles, linkedEmployeeId };
  },
  set(session: SessionData) {
    localStorage.setItem(TOKEN_KEY, session.accessToken);
    localStorage.setItem(TENANT_KEY, session.tenantId);
    localStorage.setItem(USER_ID_KEY, session.userId);
    if (session.expiresInLabel?.trim()) {
      localStorage.setItem(EXPIRES_IN_LABEL_KEY, session.expiresInLabel.trim());
    }
    if (session.roles?.length) {
      localStorage.setItem(ROLES_KEY, JSON.stringify(session.roles));
    } else {
      localStorage.removeItem(ROLES_KEY);
    }
    if (session.linkedEmployeeId !== undefined) {
      if (session.linkedEmployeeId === null || session.linkedEmployeeId === "") {
        localStorage.removeItem(LINKED_EMPLOYEE_KEY);
      } else {
        localStorage.setItem(LINKED_EMPLOYEE_KEY, session.linkedEmployeeId);
      }
    }
    notifyAuthChanged();
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TENANT_KEY);
    localStorage.removeItem(USER_ID_KEY);
    localStorage.removeItem(ROLES_KEY);
    localStorage.removeItem(LINKED_EMPLOYEE_KEY);
    localStorage.removeItem(EXPIRES_IN_LABEL_KEY);
    notifyAuthChanged();
  }
};

/** JWT `sub` — used when older sessions lack stored userId. */
export function parseAccessTokenUserId(accessToken: string): string | null {
  const payload = decodeJwtPayload(accessToken);
  const sub = payload?.sub;
  return typeof sub === "string" && sub.length > 0 ? sub : null;
}
