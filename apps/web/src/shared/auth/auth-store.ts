export interface SessionData {
  accessToken: string;
  tenantId: string;
}

const TOKEN_KEY = "access_token";
const TENANT_KEY = "tenant_id";
export const AUTH_CHANGED_EVENT = "employee-platform-auth-changed";

function notifyAuthChanged() {
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export const authStore = {
  get(): SessionData | null {
    const accessToken = localStorage.getItem(TOKEN_KEY);
    const tenantId = localStorage.getItem(TENANT_KEY);
    if (!accessToken || !tenantId) return null;
    return { accessToken, tenantId };
  },
  set(session: SessionData) {
    localStorage.setItem(TOKEN_KEY, session.accessToken);
    localStorage.setItem(TENANT_KEY, session.tenantId);
    notifyAuthChanged();
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TENANT_KEY);
    notifyAuthChanged();
  }
};
