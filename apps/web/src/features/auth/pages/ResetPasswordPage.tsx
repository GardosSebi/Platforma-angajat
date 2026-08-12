import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { resetPasswordRequest } from "../api/auth.api";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get("token")?.trim() ?? "", [searchParams]);
  const [tenantId, setTenantId] = useState(searchParams.get("tenantId")?.trim() || "e01");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Parola trebuie să aibă cel puțin 8 caractere.");
      return;
    }
    if (password !== confirm) {
      setError("Parolele nu coincid.");
      return;
    }
    if (!token) {
      setError("Link invalid — lipsește tokenul.");
      return;
    }
    setPending(true);
    try {
      await resetPasswordRequest(tenantId.trim(), token, password);
      navigate("/login?reset=1", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Resetarea a eșuat.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="login-page">
      <aside className="login-panel" style={{ margin: "auto" }}>
        <div className="login-card">
          <header className="login-brand">
            <div>
              <h2 className="login-title">Parolă nouă</h2>
              <p className="login-sub">Alegeți o parolă nouă pentru contul local.</p>
            </div>
          </header>
          <form onSubmit={onSubmit} className="login-form">
            <div className="field">
              <label htmlFor="rp-tenant">Organizație</label>
              <input
                id="rp-tenant"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                autoComplete="organization"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="rp-password">Parolă nouă</label>
              <input
                id="rp-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
              />
            </div>
            <div className="field">
              <label htmlFor="rp-confirm">Confirmare parolă</label>
              <input
                id="rp-confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
              />
            </div>
            {error ? (
              <p className="login-alert error" role="alert">
                {error}
              </p>
            ) : null}
            <button type="submit" className="btn-primary login-submit" disabled={pending || !token}>
              {pending ? "Se salvează…" : "Salvează parola"}
            </button>
          </form>
          <p className="login-hint" style={{ marginTop: "1rem" }}>
            <Link to="/login">Înapoi la autentificare</Link>
          </p>
        </div>
      </aside>
    </div>
  );
}
