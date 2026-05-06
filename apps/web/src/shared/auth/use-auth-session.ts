import { useEffect, useState } from "react";
import { AUTH_CHANGED_EVENT, authStore, type SessionData } from "./auth-store";

export function useAuthSession(): SessionData | null {
  const [session, setSession] = useState<SessionData | null>(() => authStore.get());

  useEffect(() => {
    const onChange = () => setSession(authStore.get());
    window.addEventListener(AUTH_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, onChange);
  }, []);

  return session;
}
