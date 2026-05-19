export interface SessionData {
  accessToken: string;
  tenantId: string;
  userId: string;
  roles?: string[];
  /** Employee row matched by login email (same tenant); used for SSM self-service UI. */
  linkedEmployeeId?: string | null;
}

const TOKEN_KEY = "access_token";
export const SESSION_EXPIRED_FLAG_KEY = "auth_session_expired";
const TENANT_KEY = "tenant_id";
const USER_ID_KEY = "auth_user_id";
const ROLES_KEY = "auth_roles";
const LINKED_EMPLOYEE_KEY = "auth_linked_employee_id";
export const AUTH_CHANGED_EVENT = "employee-platform-auth-changed";

function notifyAuthChanged() {
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

/** `true` dacă JWT-ul are `exp` în trecut (skew 30s pentru ceasuri decalate). */
export function isAccessTokenExpired(accessToken: string, skewMs = 30_000): boolean {
  const expMs = getAccessTokenExpiryMs(accessToken);
  if (expMs === null) return false;
  return Date.now() >= expMs - skewMs;
}

export function getAccessTokenExpiryMs(accessToken: string): number | null {
  try {
    const segment = accessToken.split(".")[1];
    if (!segment) return null;
    const payload = JSON.parse(atob(segment.replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
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
    notifyAuthChanged();
  }
};

/** JWT `sub` — used when older sessions lack stored userId. */
export function parseAccessTokenUserId(accessToken: string): string | null {
  try {
    const segment = accessToken.split(".")[1];
    if (!segment) return null;
    const payload = JSON.parse(atob(segment.replace(/-/g, "+").replace(/_/g, "/"))) as { sub?: unknown };
    return typeof payload.sub === "string" && payload.sub.length > 0 ? payload.sub : null;
  } catch {
    return null;
  }
}
