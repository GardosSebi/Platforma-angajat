import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { EmployeeStaticPageRow, TenantUserSummary, UserScopedRoleRow } from "@repo/shared-types";
import { useWorksites } from "../../master-data/hooks/useMasterData";
import { masterDataApi, type EmployeeGroupItem } from "../../master-data/api/master-data.api";
import {
  platformAdminApi,
  type CreateScopedRolePayload,
  type CreateStaticPagePayload,
  type CreateTenantUserPayload
} from "../api/platform-admin.api";
import { useAuthSession } from "../../../shared/auth/use-auth-session";
import { AdminOrganizationTab } from "../components/AdminOrganizationTab";

const ALL_SYSTEM_ROLES = [
  "PLATFORM_ADMIN",
  "TENANT_ADMIN",
  "SSM_ADMIN",
  "SSM_ENTITY_RESPONSIBLE",
  "DEPARTMENT_MANAGER",
  "EMPLOYEE"
] as const;

const ROLE_LABELS_RO: Record<string, string> = {
  PLATFORM_ADMIN: "Administrator platformă (toate tenanturile)",
  TENANT_ADMIN: "Administrator organizație (tenant) — acces complet",
  SSM_ADMIN: "Administrator SSM — toate entitățile SSM, configurare modul, rapoarte globale",
  SSM_ENTITY_RESPONSIBLE: "Responsabil SSM pe entitate — administrare completă (documente, instruiri, EIP, accidente, calendar)",
  DEPARTMENT_MANAGER: "Manager / șef departament — vizualizare echipă, aprobare instruiri, alerte neconformități",
  EMPLOYEE: "Angajat — documente și instruiri proprii, e-learning, dosar personal"
};

type Tab = "users" | "organization" | "static" | "usage";

function toDateInput(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function fromDateInput(value: string) {
  if (!value) return undefined;
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

const NEW_USER_EMPTY = {
  email: "",
  password: "",
  fullName: "",
  roles: ["EMPLOYEE"] as string[]
};

export function AdminPage() {
  const queryClient = useQueryClient();
  const session = useAuthSession();
  const [tab, setTab] = useState<Tab>("users");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [roleDraft, setRoleDraft] = useState<string[]>([]);
  const [usageFrom, setUsageFrom] = useState("");
  const [usageTo, setUsageTo] = useState(toDateInput(new Date().toISOString()));

  const [newUserForm, setNewUserForm] = useState(NEW_USER_EMPTY);

  const assignableRolesForCreate = useMemo(
    () =>
      session?.roles?.includes("PLATFORM_ADMIN")
        ? [...ALL_SYSTEM_ROLES]
        : ALL_SYSTEM_ROLES.filter((r) => r !== "PLATFORM_ADMIN"),
    [session?.roles]
  );

  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: platformAdminApi.listUsers,
    enabled: tab === "users"
  });

  const selectedUser = useMemo(
    () => (usersQuery.data ?? []).find((u) => u.id === selectedUserId) ?? null,
    [usersQuery.data, selectedUserId]
  );

  useEffect(() => {
    if (selectedUser) {
      setRoleDraft([...selectedUser.roles]);
    }
  }, [selectedUser]);

  const scopedQuery = useQuery({
    queryKey: ["admin", "scoped-roles", selectedUserId],
    queryFn: () => platformAdminApi.listScopedRoles(selectedUserId!),
    enabled: tab === "users" && !!selectedUserId
  });

  const staticQuery = useQuery({
    queryKey: ["admin", "static-pages"],
    queryFn: platformAdminApi.listStaticPages,
    enabled: tab === "static"
  });

  const worksitesQuery = useWorksites({ enabled: tab === "users" });

  const groupsQuery = useQuery({
    queryKey: ["master-data", "groups"],
    queryFn: masterDataApi.listGroups
  });

  const [scopedForm, setScopedForm] = useState<{
    role: string;
    scope: "WORKSITE" | "EMPLOYEE_GROUP";
    worksiteId: string;
    employeeGroupId: string;
  }>({ role: "DEPARTMENT_MANAGER", scope: "WORKSITE", worksiteId: "", employeeGroupId: "" });

  const [staticForm, setStaticForm] = useState<CreateStaticPagePayload>({
    slug: "",
    title: "",
    bodyMarkdown: "",
    audienceType: "ALL",
    audienceRefId: "",
    published: false,
    sortOrder: 0
  });

  const patchUser = useMutation({
    mutationFn: ({ id, roles }: { id: string; roles: string[] }) => platformAdminApi.patchUser(id, { roles }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    }
  });

  const createUser = useMutation({
    mutationFn: (payload: CreateTenantUserPayload) => platformAdminApi.createUser(payload),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      setNewUserForm({ email: "", password: "", fullName: "", roles: ["EMPLOYEE"] });
      setSelectedUserId(created.id);
    }
  });

  const createScoped = useMutation({
    mutationFn: (payload: CreateScopedRolePayload) => platformAdminApi.createScopedRole(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "scoped-roles", selectedUserId] });
    }
  });

  const deleteScoped = useMutation({
    mutationFn: (id: string) => platformAdminApi.deleteScopedRole(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "scoped-roles", selectedUserId] });
    }
  });

  const createPage = useMutation({
    mutationFn: (payload: CreateStaticPagePayload) => platformAdminApi.createStaticPage(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "static-pages"] });
    }
  });

  const deletePage = useMutation({
    mutationFn: (id: string) => platformAdminApi.deleteStaticPage(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "static-pages"] });
    }
  });

  const togglePublished = useMutation({
    mutationFn: (row: EmployeeStaticPageRow) =>
      platformAdminApi.updateStaticPage(row.id, { published: !row.published }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "static-pages"] });
    }
  });

  const usageQuery = useQuery({
    queryKey: ["admin", "usage", usageFrom, usageTo],
    queryFn: () =>
      platformAdminApi.usageSummary(
        usageFrom ? fromDateInput(usageFrom) : undefined,
        usageTo ? fromDateInput(usageTo) : undefined
      ),
    enabled: tab === "usage"
  });

  const onCreateUser = (event: FormEvent) => {
    event.preventDefault();
    createUser.mutate({
      email: newUserForm.email.trim(),
      password: newUserForm.password,
      fullName: newUserForm.fullName.trim() || undefined,
      roles: newUserForm.roles.length > 0 ? newUserForm.roles : undefined
    });
  };

  const onSaveRoles = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedUserId) return;
    patchUser.mutate({ id: selectedUserId, roles: roleDraft });
  };

  const onAddScoped = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedUserId) return;
    const payload: CreateScopedRolePayload = {
      userId: selectedUserId,
      role: scopedForm.role,
      scope: scopedForm.scope,
      worksiteId: scopedForm.scope === "WORKSITE" ? scopedForm.worksiteId : undefined,
      employeeGroupId: scopedForm.scope === "EMPLOYEE_GROUP" ? scopedForm.employeeGroupId : undefined
    };
    createScoped.mutate(payload);
  };

  const onCreateStatic = (event: FormEvent) => {
    event.preventDefault();
    const payload: CreateStaticPagePayload = {
      ...staticForm,
      audienceRefId:
        staticForm.audienceType === "ALL" ? null : staticForm.audienceRefId?.trim() || undefined
    };
    createPage.mutate(payload, {
      onSuccess: () =>
        setStaticForm({
          slug: "",
          title: "",
          bodyMarkdown: "",
          audienceType: "ALL",
          audienceRefId: "",
          published: false,
          sortOrder: 0
        })
    });
  };

  const err =
    (usersQuery.error ??
      scopedQuery.error ??
      staticQuery.error ??
      usageQuery.error ??
      createUser.error ??
      worksitesQuery.error) instanceof Error
      ? (usersQuery.error ??
          scopedQuery.error ??
          staticQuery.error ??
          usageQuery.error ??
          createUser.error ??
          worksitesQuery.error) as Error
      : null;

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1>Administrare platformă</h1>
        <p className="page-lead">
          Roluri și drepturi, structură organizațională (puncte de lucru, departamente, posturi, angajați), pagini
          statice pentru angajați, statistici de utilizare.
        </p>
      </header>

      <div className="tabs-row" role="tablist" aria-label="Secțiuni administrare">
        {(
          [
            ["users", "Utilizatori & roluri"],
            ["organization", "Puncte de lucru & organizație"],
            ["static", "Conținut static"],
            ["usage", "Statistici"]
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "tab active" : "tab"}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {err ? (
        <p className="feedback error" role="alert">
          {err.message}
        </p>
      ) : null}

      {tab === "users" ? (
        <>
          <section className="card">
            <h2>Utilizator nou</h2>
            <p className="text-muted small">
              Creează un cont de autentificare pentru tenantul curent. Parola: minim 8 caractere. Rolul
              PLATFORM_ADMIN poate fi atribuit doar de un utilizator care are deja acest rol.
            </p>
            <form onSubmit={onCreateUser} className="form-stack">
              <div className="field">
                <label htmlFor="new-user-email">E-mail</label>
                <input
                  id="new-user-email"
                  type="email"
                  autoComplete="off"
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm((f) => ({ ...f, email: e.target.value }))}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="new-user-password">Parolă</label>
                <input
                  id="new-user-password"
                  type="password"
                  autoComplete="new-password"
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm((f) => ({ ...f, password: e.target.value }))}
                  minLength={8}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="new-user-name">Nume afișat (opțional)</label>
                <input
                  id="new-user-name"
                  value={newUserForm.fullName}
                  onChange={(e) => setNewUserForm((f) => ({ ...f, fullName: e.target.value }))}
                />
              </div>
              <fieldset className="role-fieldset-create">
                <legend>Roluri la creare</legend>
                <p className="text-muted small role-fieldset-hint">
                  Bifează unul sau mai multe roluri. Implicit, dacă la trimitere nu e bifat niciunul, se folosește
                  EMPLOYEE.
                </p>
                <div className="checkbox-grid--stacked-roles" role="group" aria-label="Roluri utilizator nou">
                  {assignableRolesForCreate.map((r) => (
                    <label key={r} className="checkbox-label checkbox-label--role-row">
                      <input
                        type="checkbox"
                        checked={newUserForm.roles.includes(r)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewUserForm((f) => ({ ...f, roles: [...new Set([...f.roles, r])] }));
                          } else {
                            setNewUserForm((f) => ({ ...f, roles: f.roles.filter((x) => x !== r) }));
                          }
                        }}
                      />
                      <span className="role-row-text">
                        <span className="role-code">{r}</span>
                        <span className="role-desc">{ROLE_LABELS_RO[r] ?? r}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <button type="submit" className="btn-primary" disabled={createUser.isPending}>
                {createUser.isPending ? "Se creează…" : "Creează utilizator"}
              </button>
            </form>
          </section>

          <div className="admin-grid">
          <section className="card">
            <h2>Utilizatori</h2>
            {usersQuery.isLoading ? <p>Se încarcă…</p> : null}
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Roluri</th>
                    <th>Activ</th>
                  </tr>
                </thead>
                <tbody>
                  {(usersQuery.data ?? []).map((u: TenantUserSummary) => (
                    <tr
                      key={u.id}
                      className={u.id === selectedUserId ? "selected" : undefined}
                      onClick={() => setSelectedUserId(u.id)}
                      style={{ cursor: "pointer" }}
                    >
                      <td>{u.email}</td>
                      <td>{u.roles.join(", ") || "—"}</td>
                      <td>{u.active ? "da" : "nu"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <h2>Detaliu utilizator</h2>
            {!selectedUser ? (
              <p className="text-muted">Selectează un utilizator din listă.</p>
            ) : (
              <>
                <p>
                  <strong>{selectedUser.email}</strong>
                </p>
                <form onSubmit={onSaveRoles} className="form-stack">
                  <fieldset>
                    <legend>Roluri globale (JWT)</legend>
                    <div className="checkbox-grid--stacked-roles">
                      {ALL_SYSTEM_ROLES.map((r) => (
                        <label key={r} className="checkbox-label checkbox-label--role-row">
                          <input
                            type="checkbox"
                            checked={roleDraft.includes(r)}
                            onChange={(e) => {
                              if (e.target.checked) setRoleDraft((d) => [...new Set([...d, r])]);
                              else setRoleDraft((d) => d.filter((x) => x !== r));
                            }}
                          />
                          <span className="role-row-text">
                            <span className="role-code">{r}</span>
                            <span className="role-desc">{ROLE_LABELS_RO[r] ?? r}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <button type="submit" className="btn-primary" disabled={patchUser.isPending}>
                    Salvează roluri
                  </button>
                </form>

                <hr className="section-rule" />

                <h3>Roluri pe companie / grup</h3>
                <p className="text-muted small">
                  Complementar față de rolurile globale: același rol poate fi limitat la un worksite sau la un grup de
                  angajați (date pentru rapoarte și UI viitoare).
                </p>
                {scopedQuery.isLoading ? <p>Se încarcă…</p> : null}
                <ul className="scoped-list">
                  {(scopedQuery.data ?? []).map((row: UserScopedRoleRow) => (
                    <li key={row.id}>
                      <span>
                        {row.role} · {row.scope}
                        {row.worksite ? ` · ${row.worksite.name}` : ""}
                        {row.employeeGroup ? ` · ${row.employeeGroup.name}` : ""}
                      </span>
                      <button
                        type="button"
                        className="btn-text danger"
                        onClick={() => deleteScoped.mutate(row.id)}
                        disabled={deleteScoped.isPending}
                      >
                        Șterge
                      </button>
                    </li>
                  ))}
                </ul>

                <form onSubmit={onAddScoped} className="form-stack">
                  <div className="field">
                    <label>Rol</label>
                    <select
                      value={scopedForm.role}
                      onChange={(e) => setScopedForm((f) => ({ ...f, role: e.target.value }))}
                    >
                      {ALL_SYSTEM_ROLES.filter((r) => r !== "PLATFORM_ADMIN").map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Tip domeniu</label>
                    <select
                      value={scopedForm.scope}
                      onChange={(e) =>
                        setScopedForm((f) => ({
                          ...f,
                          scope: e.target.value as "WORKSITE" | "EMPLOYEE_GROUP"
                        }))
                      }
                    >
                      <option value="WORKSITE">Worksite (companie / locație)</option>
                      <option value="EMPLOYEE_GROUP">Grup angajați</option>
                    </select>
                  </div>
                  {scopedForm.scope === "WORKSITE" ? (
                    <div className="field">
                      <label>Worksite</label>
                      <select
                        value={scopedForm.worksiteId}
                        onChange={(e) => setScopedForm((f) => ({ ...f, worksiteId: e.target.value }))}
                      >
                        <option value="">—</option>
                        {(worksitesQuery.data ?? []).map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="field">
                      <label>Grup</label>
                      <select
                        value={scopedForm.employeeGroupId}
                        onChange={(e) => setScopedForm((f) => ({ ...f, employeeGroupId: e.target.value }))}
                      >
                        <option value="">—</option>
                        {(groupsQuery.data ?? []).map((g: EmployeeGroupItem) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <button type="submit" className="btn-secondary" disabled={createScoped.isPending}>
                    Adaugă asignare
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
        </>
      ) : null}

      {tab === "organization" ? <AdminOrganizationTab /> : null}

      {tab === "static" ? (
        <div className="admin-static">
          <section className="card">
            <h2>Pagini statice / documente</h2>
            <form onSubmit={onCreateStatic} className="form-stack">
              <div className="field">
                <label>Slug (URL)</label>
                <input
                  value={staticForm.slug}
                  onChange={(e) => setStaticForm((f) => ({ ...f, slug: e.target.value }))}
                  placeholder="ex: regulament-intern"
                  required
                />
              </div>
              <div className="field">
                <label>Titlu</label>
                <input
                  value={staticForm.title}
                  onChange={(e) => setStaticForm((f) => ({ ...f, title: e.target.value }))}
                  required
                />
              </div>
              <div className="field">
                <label>Conținut (Markdown simplu)</label>
                <textarea
                  rows={6}
                  value={staticForm.bodyMarkdown}
                  onChange={(e) => setStaticForm((f) => ({ ...f, bodyMarkdown: e.target.value }))}
                  required
                />
              </div>
              <div className="field">
                <label>Audiență</label>
                <select
                  value={staticForm.audienceType}
                  onChange={(e) =>
                    setStaticForm((f) => ({
                      ...f,
                      audienceType: e.target.value as CreateStaticPagePayload["audienceType"]
                    }))
                  }
                >
                  <option value="ALL">Toți angajații</option>
                  <option value="WORKSITE">Un worksite</option>
                  <option value="EMPLOYEE_GROUP">Un grup</option>
                </select>
              </div>
              {staticForm.audienceType !== "ALL" ? (
                <div className="field">
                  <label>ID referință (worksite sau grup)</label>
                  <input
                    value={staticForm.audienceRefId ?? ""}
                    onChange={(e) => setStaticForm((f) => ({ ...f, audienceRefId: e.target.value }))}
                    placeholder="ID din Master Data"
                    required
                  />
                </div>
              ) : null}
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={staticForm.published}
                  onChange={(e) => setStaticForm((f) => ({ ...f, published: e.target.checked }))}
                />
                Publicat (vizibil angajaților)
              </label>
              <button type="submit" className="btn-primary" disabled={createPage.isPending}>
                Creează pagină
              </button>
            </form>
          </section>

          <section className="card">
            <h2>Lista paginilor</h2>
            {staticQuery.isLoading ? <p>Se încarcă…</p> : null}
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Slug</th>
                    <th>Titlu</th>
                    <th>Audiență</th>
                    <th>Publicat</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {(staticQuery.data ?? []).map((p) => (
                    <tr key={p.id}>
                      <td>{p.slug}</td>
                      <td>{p.title}</td>
                      <td>
                        {p.audienceType}
                        {p.audienceRefId ? ` (${p.audienceRefId})` : ""}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-text"
                          onClick={() => togglePublished.mutate(p)}
                          disabled={togglePublished.isPending}
                        >
                          {p.published ? "Da" : "Nu"}
                        </button>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-text danger"
                          onClick={() => deletePage.mutate(p.id)}
                          disabled={deletePage.isPending}
                        >
                          Șterge
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}

      {tab === "usage" ? (
        <section className="card">
          <h2>Raport utilizare</h2>
          <form
            className="form-inline"
            onSubmit={(e) => {
              e.preventDefault();
              void usageQuery.refetch();
            }}
          >
            <div className="field">
              <label htmlFor="usage-from">De la</label>
              <input id="usage-from" type="date" value={usageFrom} onChange={(e) => setUsageFrom(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="usage-to">Până la</label>
              <input id="usage-to" type="date" value={usageTo} onChange={(e) => setUsageTo(e.target.value)} />
            </div>
            <button type="submit" className="btn-secondary">
              Actualizează
            </button>
          </form>
          {usageQuery.isLoading ? <p>Se încarcă…</p> : null}
          {usageQuery.data ? (
            <div className="usage-summary">
              <p>
                Perioadă: {usageQuery.data.period.from} → {usageQuery.data.period.to}
              </p>
              <h3>Totaluri</h3>
              <ul>
                <li>Utilizatori (conturi): {usageQuery.data.totals.users}</li>
                <li>Angajați: {usageQuery.data.totals.employees}</li>
                <li>Tichete helpdesk (în perioadă): {usageQuery.data.totals.helpdeskTicketsCreatedInPeriod}</li>
                <li>Răspunsuri sondaje (în perioadă): {usageQuery.data.totals.surveyResponsesInPeriod}</li>
                <li>Utilizatori cu acțiuni în audit (distinct): {usageQuery.data.distinctUsersWithAuditActions}</li>
              </ul>
              <h3>Evenimente audit pe modul</h3>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Modul</th>
                      <th>Evenimente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usageQuery.data.auditEventsByModule.map((row) => (
                      <tr key={row.module}>
                        <td>{row.module}</td>
                        <td>{row.events}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
