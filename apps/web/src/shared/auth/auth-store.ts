export interface SessionData {
  accessToken: string;
  tenantId: string;
  roles?: string[];
}

const TOKEN_KEY = "access_token";
const TENANT_KEY = "tenant_id";
const ROLES_KEY = "auth_roles";
export const AUTH_CHANGED_EVENT = "employee-platform-auth-changed";

function notifyAuthChanged() {
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export const authStore = {
  get(): SessionData | null {
    const accessToken = localStorage.getItem(TOKEN_KEY);
    const tenantId = localStorage.getItem(TENANT_KEY);
    if (!accessToken || !tenantId) return null;
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
    return { accessToken, tenantId, roles };
  },
  set(session: SessionData) {
    localStorage.setItem(TOKEN_KEY, session.accessToken);
    localStorage.setItem(TENANT_KEY, session.tenantId);
    if (session.roles?.length) {
      localStorage.setItem(ROLES_KEY, JSON.stringify(session.roles));
    } else {
      localStorage.removeItem(ROLES_KEY);
    }
    notifyAuthChanged();
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TENANT_KEY);
    localStorage.removeItem(ROLES_KEY);
    notifyAuthChanged();
  }
};
