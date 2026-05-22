import { useEffect, useState } from "react";
import { AUTH_CHANGED_EVENT, authStore, type SessionData } from "./auth-store";

const EXPIRY_CHECK_MS = 60_000;

export function useAuthSession(): SessionData | null {
  const [session, setSession] = useState<SessionData | null>(() => authStore.get());

  useEffect(() => {
    const onChange = () => setSession(authStore.get());
    window.addEventListener(AUTH_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, onChange);
  }, []);

  useEffect(() => {
    const refresh = () => setSession(authStore.get());
    const id = window.setInterval(refresh, EXPIRY_CHECK_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };
    window.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, []);

  return session;
}
