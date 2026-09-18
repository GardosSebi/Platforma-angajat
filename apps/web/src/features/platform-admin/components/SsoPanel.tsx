import { FormEvent, useEffect, useState } from "react";
import { PasswordToggleButton } from "../../../shared/components/PasswordToggleButton";
import { mutationErrorMessage } from "../../master-data/master-data-shared";
import { useSsoConfig, useUpdateSsoConfig } from "../hooks/usePlatformAdmin";

type FormState = {
  azureEnabled: boolean;
  azureTenantId: string;
  azureClientId: string;
  azureClientSecret: string;
  azureRedirectUri: string;
  ldapEnabled: boolean;
  ldapUrl: string;
  ldapBaseDn: string;
  ldapBindDn: string;
  ldapBindPassword: string;
  ldapSearchFilter: string;
};

const EMPTY: FormState = {
  azureEnabled: false,
  azureTenantId: "",
  azureClientId: "",
  azureClientSecret: "",
  azureRedirectUri: "",
  ldapEnabled: false,
  ldapUrl: "",
  ldapBaseDn: "",
  ldapBindDn: "",
  ldapBindPassword: "",
  ldapSearchFilter: "(mail={{username}})"
};

export function SsoPanel() {
  const configQuery = useSsoConfig();
  const updateConfig = useUpdateSsoConfig();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [showAzureSecret, setShowAzureSecret] = useState(false);
  const [showLdapPassword, setShowLdapPassword] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    const data = configQuery.data;
    if (!data) return;
    setForm({
      azureEnabled: data.azureEnabled,
      azureTenantId: data.azureTenantId,
      azureClientId: data.azureClientId,
      azureClientSecret: "",
      azureRedirectUri: data.azureRedirectUri,
      ldapEnabled: data.ldapEnabled,
      ldapUrl: data.ldapUrl,
      ldapBaseDn: data.ldapBaseDn,
      ldapBindDn: data.ldapBindDn,
      ldapBindPassword: "",
      ldapSearchFilter: data.ldapSearchFilter || "(mail={{username}})"
    });
  }, [configQuery.data]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    updateConfig.mutate(
      {
        azureEnabled: form.azureEnabled,
        azureTenantId: form.azureTenantId,
        azureClientId: form.azureClientId,
        azureClientSecret: form.azureClientSecret.trim() || undefined,
        azureRedirectUri: form.azureRedirectUri,
        ldapEnabled: form.ldapEnabled,
        ldapUrl: form.ldapUrl,
        ldapBaseDn: form.ldapBaseDn,
        ldapBindDn: form.ldapBindDn,
        ldapBindPassword: form.ldapBindPassword.trim() || undefined,
        ldapSearchFilter: form.ldapSearchFilter
      },
      {
        onSuccess: () => {
          setForm((prev) => ({ ...prev, azureClientSecret: "", ldapBindPassword: "" }));
          setFeedback({ type: "success", message: "Configurația SSO a fost salvată." });
        },
        onError: (error) => setFeedback({ type: "error", message: mutationErrorMessage(error) })
      }
    );
  };

  return (
    <form className="form-stack" onSubmit={onSubmit}>
      <section className="card form-stack">
        <h2 className="card-title">Autentificare Azure AD / LDAP</h2>
        <p className="page-lead">
          Secretul aplicației și parola de bind nu sunt afișate după salvare. Lasă câmpul gol ca să păstrezi valoarea
          actuală.
        </p>
        {configQuery.isLoading ? <p className="field-hint">Se încarcă configurația…</p> : null}
        {configQuery.isError ? <p className="feedback error">{mutationErrorMessage(configQuery.error)}</p> : null}
      </section>

      <section className="card form-stack">
        <h3 className="card-title">Microsoft Azure AD</h3>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={form.azureEnabled}
            onChange={(event) => setForm((prev) => ({ ...prev, azureEnabled: event.target.checked }))}
          />
          Activează conectarea cu Microsoft
        </label>
        <div className="field">
          <label htmlFor="azure-tenant">Directory (tenant) ID</label>
          <input
            id="azure-tenant"
            value={form.azureTenantId}
            onChange={(event) => setForm((prev) => ({ ...prev, azureTenantId: event.target.value }))}
          />
        </div>
        <div className="field">
          <label htmlFor="azure-client">Application (client) ID</label>
          <input
            id="azure-client"
            value={form.azureClientId}
            onChange={(event) => setForm((prev) => ({ ...prev, azureClientId: event.target.value }))}
          />
        </div>
        <div className="field">
          <label htmlFor="azure-secret">Client secret</label>
          <div className="password-field-row">
            <input
              id="azure-secret"
              type={showAzureSecret ? "text" : "password"}
              autoComplete="new-password"
              placeholder={configQuery.data?.azureClientSecretSet ? "Păstrat — completează doar ca să-l schimbi" : ""}
              value={form.azureClientSecret}
              onChange={(event) => setForm((prev) => ({ ...prev, azureClientSecret: event.target.value }))}
            />
            <PasswordToggleButton visible={showAzureSecret} onToggle={() => setShowAzureSecret((v) => !v)} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="azure-redirect">Redirect URI</label>
          <input
            id="azure-redirect"
            value={form.azureRedirectUri}
            placeholder="http://localhost:5173/login"
            onChange={(event) => setForm((prev) => ({ ...prev, azureRedirectUri: event.target.value }))}
          />
          <p className="field-hint">Trebuie să coincidă cu URI-ul înregistrat în Azure App Registration.</p>
        </div>
      </section>

      <section className="card form-stack">
        <h3 className="card-title">LDAP</h3>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={form.ldapEnabled}
            onChange={(event) => setForm((prev) => ({ ...prev, ldapEnabled: event.target.checked }))}
          />
          Activează autentificarea LDAP
        </label>
        <div className="field">
          <label htmlFor="ldap-url">URL server</label>
          <input
            id="ldap-url"
            value={form.ldapUrl}
            placeholder="ldaps://ldap.companie.local:636"
            onChange={(event) => setForm((prev) => ({ ...prev, ldapUrl: event.target.value }))}
          />
        </div>
        <div className="field">
          <label htmlFor="ldap-base">Base DN</label>
          <input
            id="ldap-base"
            value={form.ldapBaseDn}
            placeholder="dc=companie,dc=local"
            onChange={(event) => setForm((prev) => ({ ...prev, ldapBaseDn: event.target.value }))}
          />
        </div>
        <div className="field">
          <label htmlFor="ldap-bind">Bind DN</label>
          <input
            id="ldap-bind"
            value={form.ldapBindDn}
            onChange={(event) => setForm((prev) => ({ ...prev, ldapBindDn: event.target.value }))}
          />
        </div>
        <div className="field">
          <label htmlFor="ldap-pass">Parolă bind</label>
          <div className="password-field-row">
            <input
              id="ldap-pass"
              type={showLdapPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder={configQuery.data?.ldapBindPasswordSet ? "Păstrată — completează doar ca să o schimbi" : ""}
              value={form.ldapBindPassword}
              onChange={(event) => setForm((prev) => ({ ...prev, ldapBindPassword: event.target.value }))}
            />
            <PasswordToggleButton visible={showLdapPassword} onToggle={() => setShowLdapPassword((v) => !v)} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="ldap-filter">Filtru căutare</label>
          <input
            id="ldap-filter"
            value={form.ldapSearchFilter}
            onChange={(event) => setForm((prev) => ({ ...prev, ldapSearchFilter: event.target.value }))}
          />
          <p className="field-hint">Folosește {"{{username}}"} pentru valoarea introdusă la login.</p>
        </div>
      </section>

      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={updateConfig.isPending || configQuery.isLoading}>
          {updateConfig.isPending ? "Se salvează…" : "Salvează SSO"}
        </button>
      </div>
      {feedback ? <p className={`feedback ${feedback.type}`}>{feedback.message}</p> : null}
    </form>
  );
}
