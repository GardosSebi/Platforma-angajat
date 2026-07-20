import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { LocaleSwitcher } from "../../../shared/components/LocaleSwitcher";
import { getSsoStatus, loginAzureCallback, loginLdap, loginRequest } from "../api/auth.api";
import { authStore, getStoredExpiresInLabel, type SessionData } from "../../../shared/auth/auth-store";
import { clearUserScopedQueryCache } from "../../../shared/auth/clear-user-query-cache";
import { getAppHomePath } from "../../../shared/auth/roles";
import type { TenantSsoStatusResponse } from "@repo/shared-types/auth-push";

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

function parseAzureState(state: string | null): string | null {
  if (!state) return null;
  try {
    const padded = state + "=".repeat((4 - (state.length % 4)) % 4);
    const json = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
    const parsed = JSON.parse(json) as { tenantId?: string };
    return parsed.tenantId?.trim() || null;
  } catch {
    return null;
  }
}

function applyLoginSession(data: Awaited<ReturnType<typeof loginRequest>>): SessionData {
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
  return session;
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = useMemo(() => safeReturnPath(searchParams.get("returnUrl")), [searchParams]);
  const sessionExpired = searchParams.get("expired") === "1";
  const azureCallbackHandled = useRef(false);

  const [tenantId, setTenantId] = useState("e01");
  const [debouncedTenantId, setDebouncedTenantId] = useState("e01");
  const [email, setEmail] = useState("admin@company.local");
  const [password, setPassword] = useState("");
  const [ldapUsername, setLdapUsername] = useState("");
  const [ldapPassword, setLdapPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [ssoStatus, setSsoStatus] = useState<TenantSsoStatusResponse | null>(null);
  const [ssoLoading, setSsoLoading] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedTenantId(tenantId.trim()), 400);
    return () => window.clearTimeout(timer);
  }, [tenantId]);

  useEffect(() => {
    if (!debouncedTenantId) {
      setSsoStatus(null);
      return;
    }

    let cancelled = false;
    setSsoLoading(true);
    void getSsoStatus(debouncedTenantId)
      .then((status) => {
        if (!cancelled) setSsoStatus(status);
      })
      .catch(() => {
        if (!cancelled) setSsoStatus(null);
      })
      .finally(() => {
        if (!cancelled) setSsoLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedTenantId]);

  useEffect(() => {
    if (azureCallbackHandled.current) return;

    const code = searchParams.get("code");
    const stateTenantId = parseAzureState(searchParams.get("state"));
    if (!code) return;

    azureCallbackHandled.current = true;
    const tenantForCallback = stateTenantId || tenantId.trim();
    if (!tenantForCallback) {
      setError("Autentificarea Azure AD a eșuat: lipsește organizația.");
      return;
    }

    setPending(true);
    setError(null);
    void loginAzureCallback(tenantForCallback, code)
      .then((data) => {
        const session = applyLoginSession(data);
        navigate(returnUrl ?? getAppHomePath(session), { replace: true });
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Autentificarea Azure AD a eșuat.");
      })
      .finally(() => {
        setPending(false);
      });
  }, [navigate, returnUrl, searchParams, tenantId]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const data = await loginRequest(tenantId.trim(), email.trim(), password);
      const session = applyLoginSession(data);
      navigate(returnUrl ?? getAppHomePath(session), { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Autentificarea a eșuat.");
    } finally {
      setPending(false);
    }
  };

  const onLdapSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const data = await loginLdap(tenantId.trim(), ldapUsername.trim(), ldapPassword);
      const session = applyLoginSession(data);
      navigate(returnUrl ?? getAppHomePath(session), { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Autentificarea LDAP a eșuat.");
    } finally {
      setPending(false);
    }
  };

  const onAzureLogin = () => {
    if (!ssoStatus?.azureAuthorizeUrl) return;
    window.location.assign(ssoStatus.azureAuthorizeUrl);
  };

  const showAzure = Boolean(ssoStatus?.azureEnabled && ssoStatus.azureAuthorizeUrl);
  const showLdap = Boolean(ssoStatus?.ldapEnabled);

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
          <div className="login-locale-row">
            <LocaleSwitcher />
          </div>
          <header className="login-brand">
            <span className="login-brand-mark" aria-hidden>
              EP
            </span>
            <div>
              <h2 className="login-title">{t("auth.login")}</h2>
              <p className="login-sub">Introduceți organizația, e-mailul și parola contului.</p>
            </div>
          </header>

          <form onSubmit={onSubmit} className="login-form">
            <div className="field">
              <label htmlFor="tenant-id">{t("auth.tenant")}</label>
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
              <label htmlFor="email">{t("auth.email")}</label>
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
              <label htmlFor="password">{t("auth.password")}</label>
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
              {pending ? "Se conectează…" : t("auth.submit")}
            </button>
          </form>

          {ssoLoading ? <p className="login-hint">Se verifică opțiunile SSO...</p> : null}

          {showAzure ? (
            <div className="login-sso-block">
              <button type="button" className="btn-secondary login-sso-btn" disabled={pending} onClick={onAzureLogin}>
                Conectare cu Microsoft (Azure AD)
              </button>
              <p className="login-hint">{t("auth.ssoAzure")}</p>
            </div>
          ) : null}

          {showLdap ? (
            <form className="login-form login-sso-block" onSubmit={onLdapSubmit}>
              <h3 className="login-sso-title">Autentificare LDAP</h3>
              <div className="field">
                <label htmlFor="ldap-username">Utilizator LDAP</label>
                <input
                  id="ldap-username"
                  name="ldapUsername"
                  autoComplete="username"
                  value={ldapUsername}
                  onChange={(event) => setLdapUsername(event.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="ldap-password">Parolă LDAP</label>
                <input
                  id="ldap-password"
                  name="ldapPassword"
                  type="password"
                  autoComplete="current-password"
                  value={ldapPassword}
                  onChange={(event) => setLdapPassword(event.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn-secondary login-submit" disabled={pending}>
                {pending ? "Se conectează…" : t("auth.ssoLdap")}
              </button>
            </form>
          ) : null}

          <p className="login-hint">
            Cont demo: <code>e01</code> · <code>admin@company.local</code>
          </p>
        </div>
      </aside>
    </div>
  );
}
