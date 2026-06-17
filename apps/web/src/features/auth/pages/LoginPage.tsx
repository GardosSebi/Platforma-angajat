import { FormEvent, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { loginRequest } from "../api/auth.api";
import { authStore, getStoredExpiresInLabel, type SessionData } from "../../../shared/auth/auth-store";
import { clearUserScopedQueryCache } from "../../../shared/auth/clear-user-query-cache";
import { hasSsmBackofficeAccess, isEmployeePortalUser, isItmInspectorUser } from "../../../shared/auth/roles";

const HERO_FEATURES = [
  "Instruiri SSM și semnături digitale",
  "Anunțuri și sondaje pentru echipă",
  "Solicitări HR și helpdesk intern"
] as const;

function safeReturnPath(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/")) return null;
  if (raw.startsWith("//")) return null;
  if (raw.includes("://")) return null;
  return raw;
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <path d="M1 1l22 22" />
        <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = useMemo(() => safeReturnPath(searchParams.get("returnUrl")), [searchParams]);
  const sessionExpired = searchParams.get("expired") === "1";
  const [tenantId, setTenantId] = useState("e01");
  const [email, setEmail] = useState("admin@company.local");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const data = await loginRequest(tenantId.trim(), email.trim(), password);
      clearUserScopedQueryCache();
      const session: SessionData = {
        accessToken: data.accessToken,
        tenantId: data.user.tenantId,
        userId: data.user.id,
        roles: data.user.roles,
        expiresInLabel: data.expiresIn,
        linkedEmployeeId: data.linkedEmployeeId ?? null
      };
      authStore.set(session);
      const home = isEmployeePortalUser(session)
        ? "/portal"
        : isItmInspectorUser(session)
          ? "/itm"
          : hasSsmBackofficeAccess(session)
            ? "/ssm"
            : "/portal";
      navigate(returnUrl ?? home, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Autentificarea a eșuat.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="login-page">
      <section className="login-hero" aria-label="Prezentare platformă">
        <div className="login-hero-bg" aria-hidden>
          <span className="login-hero-orb login-hero-orb--1" />
          <span className="login-hero-orb login-hero-orb--2" />
        </div>

        <div className="login-hero-inner">
          <span className="login-hero-mark" aria-hidden>
            EP
          </span>
          <h1>Platformă internă pentru angajați</h1>
          <p className="login-hero-lead">
            SSM, instruiri, comunicări, sondaje și solicitări — totul într-un singur loc, organizat pe roluri.
          </p>
          <ul className="login-hero-features">
            {HERO_FEATURES.map((feature) => (
              <li key={feature}>
                <span className="login-hero-check" aria-hidden>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M2.5 6l2.5 2.5 4.5-5"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <aside className="login-panel" aria-label="Autentificare">
        <div className="login-card">
          <header className="login-brand">
            <span className="login-brand-mark" aria-hidden>
              EP
            </span>
            <div>
              <h2 className="login-title">Autentificare</h2>
              <p className="login-sub">Introduceți organizația, e-mailul și parola contului.</p>
            </div>
          </header>

          <form onSubmit={onSubmit} className="login-form">
            <div className="field">
              <label htmlFor="tenant-id">Organizație (ID tenant)</label>
              <input
                id="tenant-id"
                name="tenantId"
                autoComplete="organization"
                placeholder="ex: e01"
                value={tenantId}
                onChange={(event) => setTenantId(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="email">E-mail</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder="nume@companie.ro"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="password">Parolă</label>
              <div className="password-field-row">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Ascunde parola" : "Afișează parola"}
                  title={showPassword ? "Ascunde parola" : "Afișează parola"}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>

            {sessionExpired && !error ? (
              <p className="login-alert error" role="status">
                Sesiunea a expirat ({getStoredExpiresInLabel()}). Autentificați-vă din nou.
              </p>
            ) : null}
            {error ? (
              <p className="login-alert error" role="alert">
                {error}
              </p>
            ) : null}

            <button type="submit" className="btn-primary login-submit" disabled={pending}>
              {pending ? "Se conectează…" : "Conectare"}
            </button>
          </form>

          <p className="login-hint">
            Cont demo: <code>e01</code> · <code>admin@company.local</code>
          </p>
        </div>
      </aside>
    </div>
  );
}
