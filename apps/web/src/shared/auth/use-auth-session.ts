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
    const id = window.setInterval(() => setSession(authStore.get()), EXPIRY_CHECK_MS);
    return () => window.clearInterval(id);
  }, []);

  return session;
}
