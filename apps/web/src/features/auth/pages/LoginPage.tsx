import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { getApiBaseUrl } from "../../../shared/api/api-base";
import { loginRequest } from "../api/auth.api";
import { authStore } from "../../../shared/auth/auth-store";
import { clearUserScopedQueryCache } from "../../../shared/auth/clear-user-query-cache";

function safeReturnPath(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/")) return null;
  if (raw.startsWith("//")) return null;
  if (raw.includes("://")) return null;
  return raw;
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
      authStore.set({
        accessToken: data.accessToken,
        tenantId: data.user.tenantId,
        userId: data.user.id,
        roles: data.user.roles,
        linkedEmployeeId: data.linkedEmployeeId ?? null
      });
      navigate(returnUrl ?? "/ssm", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Autentificarea a eșuat.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card card">
        <div className="login-brand">
          <span className="app-brand-mark" aria-hidden>
            EP
          </span>
          <div>
            <h1 className="login-title">Autentificare</h1>
            <p className="login-sub">Platformă angajați — introduceți ID-ul tenant, adresa de e-mail și parola.</p>
          </div>
        </div>
        <form onSubmit={onSubmit} className="form-stack">
          <div className="field">
            <label htmlFor="tenant-id">ID tenant</label>
            <input
              id="tenant-id"
              name="tenantId"
              autoComplete="off"
              placeholder="e01"
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
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="password">Parolă</label>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Ascunde parola" : "Afișează parola"}
                title={showPassword ? "Ascunde parola" : "Afișează parola"}
                style={{ padding: "0.58rem 0.75rem", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff" }}
              >
                👁
              </button>
            </div>
          </div>
          {sessionExpired && !error ? (
            <p className="feedback error" role="status">
              Sesiunea a expirat (8 ore). Autentificați-vă din nou.
            </p>
          ) : null}
          {error ? (
            <p className="feedback error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Se conectează…" : "Conectare"}
          </button>
        </form>
        <p className="login-back">
          <Link to="/ssm">Înapoi la aplicație</Link>
        </p>
      </div>
    </div>
  );
}
