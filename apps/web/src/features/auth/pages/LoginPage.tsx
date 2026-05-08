import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getApiBaseUrl } from "../../../shared/api/api-base";
import { loginRequest } from "../api/auth.api";
import { authStore } from "../../../shared/auth/auth-store";

export function LoginPage() {
  const navigate = useNavigate();
  const [tenantId, setTenantId] = useState("e01");
  const [email, setEmail] = useState("admin@company.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const data = await loginRequest(tenantId.trim(), email.trim(), password);
      authStore.set({ accessToken: data.accessToken, tenantId: data.user.tenantId });
      navigate("/ssm", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
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
            <h1 className="login-title">Sign in</h1>
            <p className="login-sub">Employee Platform — use your tenant, email, and password.</p>
          </div>
        </div>
        <form onSubmit={onSubmit} className="form-stack">
          <div className="field">
            <label htmlFor="tenant-id">Tenant ID</label>
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
            <label htmlFor="email">Email</label>
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
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {error ? (
            <p className="feedback error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="login-back">
          <Link to="/ssm">Back to app</Link>
        </p>
      </div>
    </div>
  );
}
