import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { EmployeeStaticPageRow, TenantUserSummary } from "@repo/shared-types";
import {
  useCreateEmployee,
  useDepartmentsLookup,
  useEmployee,
  useEmployeeOptions,
  useJobPositionsLookup,
  useUpdateEmployee,
  useWorksitesLookup
} from "../../master-data/hooks/useMasterData";
import { PaginationBar, paginationFromResult } from "../../../shared/components/PaginationBar";
import { usePagination } from "../../../shared/hooks/use-pagination";
import type { UpdateEmployeePayload } from "../../master-data/api/master-data.api";
import {
  platformAdminApi,
  type CreateStaticPagePayload,
  type CreateTenantUserPayload
} from "../api/platform-admin.api";
import { useAuthSession } from "../../../shared/auth/use-auth-session";
import { AdminOrganizationTab } from "../components/AdminOrganizationTab";

/** 3.12 — Roluri SSM (singurele roluri de sistem). */
const ALL_SYSTEM_ROLES = [
  "SSM_ADMIN",
  "SSM_ENTITY_RESPONSIBLE",
  "DEPARTMENT_MANAGER",
  "EMPLOYEE"
] as const;

const ROLE_LABELS_RO: Record<string, string> = {
  SSM_ADMIN: "Administrator SSM — acces complet la toate entitățile; configurare modul; rapoarte globale",
  SSM_ENTITY_RESPONSIBLE:
    "Responsabil SSM (per entitate) — administrare completă pentru entitatea sa: documente, instruiri, EIP, accidente, calendar",
  DEPARTMENT_MANAGER:
    "Manager / șef de departament — vizualizare situație echipă proprie; aprobare instruiri la locul de muncă; alertă la neconformități",
  EMPLOYEE:
    "Angajat — acces la propriile documente și fișe de instruire; parcurgere instruiri online; vizualizare dosar personal"
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

function dateInputToIsoUtc(date: string): string | undefined {
  if (!date.trim()) return undefined;
  return new Date(`${date}T00:00:00.000Z`).toISOString();
}

function mutationErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "A apărut o eroare neașteptată.";
}

type OrgOption = { id: string; code: string; name: string };

function orgOptionsWithSaved(
  items: OrgOption[],
  selectedId: string | null | undefined,
  allItems: OrgOption[],
  savedFallback?: OrgOption | null
): OrgOption[] {
  if (!selectedId) return items;
  if (items.some((i) => i.id === selectedId)) return items;
  const fromCatalog = allItems.find((i) => i.id === selectedId);
  if (fromCatalog) return [...items, fromCatalog];
  if (savedFallback) return [...items, savedFallback];
  return [...items, { id: selectedId, code: "—", name: "Valoare salvată" }];
}

const NEW_USER_EMPTY = {
  email: "",
  password: "",
  fullName: "",
  role: "EMPLOYEE",
  cnp: "",
  worksiteId: "",
  departmentId: "",
  jobPositionId: "",
  hireDate: ""
};

const EMPTY_EMPLOYEE_DRAFT = {
  cnp: "",
  worksiteId: "",
  departmentId: "",
  jobPositionId: "",
  hireDate: ""
};

function PasswordToggleButton({
  visible,
  onToggle
}: {
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="password-toggle-btn"
      onClick={onToggle}
      aria-label={visible ? "Ascunde parola" : "Afișează parola"}
      title={visible ? "Ascunde parola" : "Afișează parola"}
    >
      {visible ? (
        <svg className="password-toggle-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
          <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
      ) : (
        <svg className="password-toggle-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  );
}

export function AdminPage() {
  const queryClient = useQueryClient();
  const session = useAuthSession();
  const [tab, setTab] = useState<Tab>("users");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState("EMPLOYEE");
  const [editFullName, setEditFullName] = useState("");
  const [usageFrom, setUsageFrom] = useState("");
  const [usageTo, setUsageTo] = useState(toDateInput(new Date().toISOString()));

  const [newUserForm, setNewUserForm] = useState(NEW_USER_EMPTY);
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);
  const [employeeDraft, setEmployeeDraft] = useState(EMPTY_EMPLOYEE_DRAFT);

  const assignableRoles = useMemo(
    () =>
      session?.roles?.includes("SSM_ADMIN")
        ? [...ALL_SYSTEM_ROLES]
        : ALL_SYSTEM_ROLES.filter((r) => r !== "SSM_ADMIN"),
    [session?.roles]
  );

  const usersPage = usePagination();
  const staticPage = usePagination();

  const usersQuery = useQuery({
    queryKey: ["admin", "users", usersPage.page, usersPage.pageSize],
    queryFn: () => platformAdminApi.listUsers(usersPage.params),
    enabled: tab === "users"
  });

  const usersPaged = paginationFromResult(usersQuery.data, usersPage.page, usersPage.pageSize);

  const selectedUser = useMemo(
    () => usersPaged.items.find((u) => u.id === selectedUserId) ?? null,
    [usersPaged.items, selectedUserId]
  );

  const worksitesLookup = useWorksitesLookup({ enabled: tab === "users" });
  const departmentsLookup = useDepartmentsLookup({ enabled: tab === "users" });
  const positionsLookup = useJobPositionsLookup({ enabled: tab === "users" });
  const employeeSearch = selectedUser?.email ?? "";
  const employeesOptionsQuery = useEmployeeOptions(employeeSearch, {
    enabled: tab === "users" && Boolean(employeeSearch)
  });

  const matchedEmployeeOption = useMemo(() => {
    if (!selectedUser) return null;
    const email = selectedUser.email.toLowerCase();
    return (employeesOptionsQuery.data?.items ?? []).find((e) => e.email.toLowerCase() === email) ?? null;
  }, [selectedUser, employeesOptionsQuery.data?.items]);

  const selectedEmployeeQuery = useEmployee(matchedEmployeeOption?.id, {
    enabled: tab === "users" && Boolean(matchedEmployeeOption?.id)
  });

  const selectedEmployee = selectedEmployeeQuery.data ?? null;

  const filteredDepartmentsForNewUser = useMemo(() => {
    const deps = departmentsLookup.data?.items ?? [];
    if (!newUserForm.worksiteId) return deps;
    return deps.filter((d) => d.worksiteId === newUserForm.worksiteId || !d.worksiteId);
  }, [departmentsLookup.data?.items, newUserForm.worksiteId]);

  const filteredPositionsForNewUser = useMemo(() => {
    const positions = positionsLookup.data?.items ?? [];
    if (!newUserForm.departmentId) return positions;
    return positions.filter((p) => p.departmentId === newUserForm.departmentId || !p.departmentId);
  }, [positionsLookup.data?.items, newUserForm.departmentId]);

  const detailWorksiteId =
    employeeDraft.worksiteId || selectedEmployee?.worksiteId || "";

  const detailDepartmentId =
    employeeDraft.departmentId || selectedEmployee?.departmentId || "";

  const savedOrgFromEmployee = useMemo(() => {
    if (!selectedEmployee) return { worksite: null, department: null, position: null };
    const toOption = (row?: { id: string; code: string; name: string } | null): OrgOption | null =>
      row ? { id: row.id, code: row.code, name: row.name } : null;
    return {
      worksite: toOption(selectedEmployee.worksite ?? null),
      department: toOption(selectedEmployee.department ?? null),
      position: toOption(selectedEmployee.jobPosition ?? null)
    };
  }, [selectedEmployee]);

  const detailWorksites = useMemo(() => {
    const all = worksitesLookup.data?.items ?? [];
    const savedId = employeeDraft.worksiteId || selectedEmployee?.worksiteId;
    return orgOptionsWithSaved(all, savedId, all, savedOrgFromEmployee.worksite);
  }, [
    worksitesLookup.data?.items,
    employeeDraft.worksiteId,
    selectedEmployee?.worksiteId,
    savedOrgFromEmployee.worksite
  ]);

  const detailDepartments = useMemo(() => {
    const all = departmentsLookup.data?.items ?? [];
    const filtered = detailWorksiteId
      ? all.filter((d) => !d.worksiteId || d.worksiteId === detailWorksiteId)
      : all;
    const savedId = employeeDraft.departmentId || selectedEmployee?.departmentId;
    return orgOptionsWithSaved(filtered, savedId, all, savedOrgFromEmployee.department);
  }, [
    departmentsLookup.data?.items,
    detailWorksiteId,
    employeeDraft.departmentId,
    selectedEmployee?.departmentId,
    savedOrgFromEmployee.department
  ]);

  const detailPositions = useMemo(() => {
    const all = positionsLookup.data?.items ?? [];
    const filtered = detailDepartmentId
      ? all.filter((p) => !p.departmentId || p.departmentId === detailDepartmentId)
      : all;
    const savedId = employeeDraft.jobPositionId || selectedEmployee?.jobPositionId;
    return orgOptionsWithSaved(filtered, savedId, all, savedOrgFromEmployee.position);
  }, [
    positionsLookup.data?.items,
    detailDepartmentId,
    employeeDraft.jobPositionId,
    selectedEmployee?.jobPositionId,
    savedOrgFromEmployee.position
  ]);

  const detailFormLoading =
    Boolean(selectedUser) &&
    ((employeesOptionsQuery.isLoading && !employeesOptionsQuery.data) ||
      (Boolean(matchedEmployeeOption) && selectedEmployeeQuery.isLoading && !selectedEmployeeQuery.data));

  useEffect(() => {
    if (!selectedUser) {
      setEditRole("EMPLOYEE");
      setEditFullName("");
      setEmployeeDraft(EMPTY_EMPLOYEE_DRAFT);
      return;
    }
    setEditRole(selectedUser.roles[0] ?? "EMPLOYEE");
    setEditFullName(selectedUser.fullName ?? "");

    if (employeesOptionsQuery.isLoading && !employeesOptionsQuery.data) {
      return;
    }
    if (matchedEmployeeOption && selectedEmployeeQuery.isLoading && !selectedEmployeeQuery.data) {
      return;
    }

    if (selectedEmployee) {
      setEmployeeDraft({
        cnp: selectedEmployee.cnp === "***" ? "" : (selectedEmployee.cnp ?? ""),
        worksiteId: selectedEmployee.worksiteId ?? "",
        departmentId: selectedEmployee.departmentId ?? "",
        jobPositionId: selectedEmployee.jobPositionId ?? "",
        hireDate: selectedEmployee.hireDate ? toDateInput(selectedEmployee.hireDate) : ""
      });
      if (selectedEmployee.fullName?.trim()) {
        setEditFullName(selectedEmployee.fullName);
      }
    } else {
      setEmployeeDraft(EMPTY_EMPLOYEE_DRAFT);
    }
  }, [
    selectedUser,
    selectedEmployee,
    matchedEmployeeOption,
    employeesOptionsQuery.isLoading,
    employeesOptionsQuery.data,
    selectedEmployeeQuery.isLoading,
    selectedEmployeeQuery.data
  ]);

  const staticQuery = useQuery({
    queryKey: ["admin", "static-pages", staticPage.page, staticPage.pageSize],
    queryFn: () => platformAdminApi.listStaticPages(staticPage.params),
    enabled: tab === "static"
  });

  const staticPaged = paginationFromResult(staticQuery.data, staticPage.page, staticPage.pageSize);

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

  const updateEmployee = useUpdateEmployee();
  const createEmployee = useCreateEmployee();

  const createUser = useMutation({
    mutationFn: (payload: CreateTenantUserPayload) => platformAdminApi.createUser(payload),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      await queryClient.invalidateQueries({ queryKey: ["master-data", "employees"] });
      setNewUserForm({ ...NEW_USER_EMPTY });
      setShowNewUserPassword(false);
      setSelectedUserId(created.id);
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

  const buildEmployeePayload = (): UpdateEmployeePayload => {
    const payload: UpdateEmployeePayload = {
      worksiteId: employeeDraft.worksiteId || undefined,
      departmentId: employeeDraft.departmentId || undefined,
      jobPositionId: employeeDraft.jobPositionId || undefined,
      hireDate: dateInputToIsoUtc(employeeDraft.hireDate)
    };
    if (employeeDraft.cnp.trim() && employeeDraft.cnp !== "***") {
      payload.cnp = employeeDraft.cnp.trim();
    }
    return payload;
  };

  const onCreateUser = (event: FormEvent) => {
    event.preventDefault();
    createUser.mutate({
      email: newUserForm.email.trim(),
      password: newUserForm.password,
      fullName: newUserForm.fullName.trim(),
      roles: [newUserForm.role],
      cnp: newUserForm.cnp.trim() || undefined,
      worksiteId: newUserForm.worksiteId || undefined,
      departmentId: newUserForm.departmentId || undefined,
      jobPositionId: newUserForm.jobPositionId || undefined,
      hireDate: dateInputToIsoUtc(newUserForm.hireDate)
    });
  };

  const onSaveUserDetail = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedUserId || !selectedUser) return;
    try {
      await patchUser.mutateAsync({ id: selectedUserId, roles: [editRole] });
      const empPayload = buildEmployeePayload();
      const displayName = editFullName.trim() || selectedUser.email;
      if (selectedEmployee) {
        await updateEmployee.mutateAsync({
          id: selectedEmployee.id,
          payload: {
            ...empPayload,
            fullName: displayName,
            email: selectedUser.email
          }
        });
      } else {
        await createEmployee.mutateAsync({
          email: selectedUser.email,
          fullName: displayName,
          ...empPayload,
          active: true
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["master-data", "employees"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    } catch {
      /* erori afișate de mutații */
    }
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
      staticQuery.error ??
      usageQuery.error ??
      createUser.error) instanceof Error
      ? (usersQuery.error ??
          staticQuery.error ??
          usageQuery.error ??
          createUser.error) as Error
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
              Creează un cont de autentificare pentru tenantul curent. Parola: minim 8 caractere. Rolul SSM_ADMIN poate fi
              atribuit doar de un administrator SSM.
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
                <div className="password-field-row">
                  <input
                    id="new-user-password"
                    type={showNewUserPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={newUserForm.password}
                    onChange={(e) => setNewUserForm((f) => ({ ...f, password: e.target.value }))}
                    minLength={8}
                    required
                  />
                  <PasswordToggleButton visible={showNewUserPassword} onToggle={() => setShowNewUserPassword((v) => !v)} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="new-user-name">Nume afișat</label>
                <input
                  id="new-user-name"
                  value={newUserForm.fullName}
                  onChange={(e) => setNewUserForm((f) => ({ ...f, fullName: e.target.value }))}
                  maxLength={200}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="new-user-cnp">CNP (opțional)</label>
                <input
                  id="new-user-cnp"
                  value={newUserForm.cnp}
                  onChange={(e) => setNewUserForm((f) => ({ ...f, cnp: e.target.value }))}
                  autoComplete="off"
                />
              </div>
              <div className="field">
                <label htmlFor="new-user-worksite">Punct de lucru</label>
                <select
                  id="new-user-worksite"
                  value={newUserForm.worksiteId}
                  onChange={(e) =>
                    setNewUserForm((f) => ({
                      ...f,
                      worksiteId: e.target.value,
                      departmentId: "",
                      jobPositionId: ""
                    }))
                  }
                >
                  <option value="">— Neselectat —</option>
                  {(worksitesLookup.data?.items ?? []).map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.code} — {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="new-user-department">Departament</label>
                <select
                  id="new-user-department"
                  value={newUserForm.departmentId}
                  onChange={(e) =>
                    setNewUserForm((f) => ({
                      ...f,
                      departmentId: e.target.value,
                      jobPositionId: ""
                    }))
                  }
                >
                  <option value="">— Neselectat —</option>
                  {filteredDepartmentsForNewUser.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} — {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="new-user-position">Post</label>
                <select
                  id="new-user-position"
                  value={newUserForm.jobPositionId}
                  onChange={(e) => setNewUserForm((f) => ({ ...f, jobPositionId: e.target.value }))}
                >
                  <option value="">— Neselectat —</option>
                  {filteredPositionsForNewUser.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="new-user-hire-date">Data angajării</label>
                <input
                  id="new-user-hire-date"
                  type="date"
                  value={newUserForm.hireDate}
                  onChange={(e) => setNewUserForm((f) => ({ ...f, hireDate: e.target.value }))}
                />
              </div>
              <fieldset className="role-fieldset-create">
                <legend>Rol la creare</legend>
                <p className="text-muted small role-fieldset-hint">Alege un singur rol pentru utilizatorul nou.</p>
                <div className="checkbox-grid--stacked-roles" role="radiogroup" aria-label="Rol utilizator nou">
                  {assignableRoles.map((r) => (
                    <label key={r} className="checkbox-label checkbox-label--role-row">
                      <input
                        type="radio"
                        name="new-user-role"
                        value={r}
                        checked={newUserForm.role === r}
                        onChange={() => setNewUserForm((f) => ({ ...f, role: r }))}
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
              {createUser.isError ? (
                <p className="feedback error" role="alert">
                  {mutationErrorMessage(createUser.error)}
                </p>
              ) : null}
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
                  {usersPaged.items.map((u: TenantUserSummary) => (
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
            <PaginationBar
              page={usersPaged.page}
              pageSize={usersPaged.pageSize}
              total={usersPaged.total}
              totalPages={usersPaged.totalPages}
              onPageChange={usersPage.setPage}
              onPageSizeChange={usersPage.setPageSize}
              disabled={usersQuery.isFetching}
            />
          </section>

          <section className="card">
            <h2>Detaliu utilizator</h2>
            {!selectedUser ? (
              <p className="text-muted">Selectează un utilizator din listă.</p>
            ) : detailFormLoading ? (
              <p className="text-muted">Se încarcă datele salvate…</p>
            ) : (
              <>
                {!selectedEmployee ? (
                  <p className="text-muted small">
                    Nu există încă fișă de angajat pentru acest e-mail. La salvare se creează automat.
                  </p>
                ) : null}
                <form
                  key={selectedUserId ?? undefined}
                  onSubmit={onSaveUserDetail}
                  className="form-stack"
                >
                  <fieldset>
                    <legend>Cont utilizator</legend>
                    <div className="field">
                      <label htmlFor="detail-user-email">E-mail</label>
                      <input id="detail-user-email" type="email" value={selectedUser.email} readOnly />
                    </div>
                    <div className="field">
                      <label htmlFor="detail-user-fullname">Nume afișat</label>
                      <input
                        id="detail-user-fullname"
                        value={editFullName}
                        onChange={(e) => setEditFullName(e.target.value)}
                        required
                        autoComplete="name"
                      />
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend>Date angajat</legend>
                    <div className="field">
                      <label htmlFor="detail-user-cnp">CNP (opțional)</label>
                      <input
                        id="detail-user-cnp"
                        value={employeeDraft.cnp}
                        onChange={(e) => setEmployeeDraft((d) => ({ ...d, cnp: e.target.value }))}
                        placeholder={selectedEmployee?.cnp === "***" ? "Lăsați gol pentru a păstra valoarea" : undefined}
                        autoComplete="off"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="detail-user-worksite">Punct de lucru</label>
                      <select
                        id="detail-user-worksite"
                        value={detailWorksiteId}
                        onChange={(e) =>
                          setEmployeeDraft((d) => ({
                            ...d,
                            worksiteId: e.target.value,
                            departmentId: "",
                            jobPositionId: ""
                          }))
                        }
                      >
                        <option value="">— Neselectat —</option>
                        {detailWorksites.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.code} — {w.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="detail-user-department">Departament</label>
                      <select
                        id="detail-user-department"
                        value={detailDepartmentId}
                        onChange={(e) =>
                          setEmployeeDraft((d) => ({
                            ...d,
                            departmentId: e.target.value,
                            jobPositionId: ""
                          }))
                        }
                      >
                        <option value="">— Neselectat —</option>
                        {detailDepartments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.code} — {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="detail-user-position">Post</label>
                      <select
                        id="detail-user-position"
                        value={employeeDraft.jobPositionId || selectedEmployee?.jobPositionId || ""}
                        onChange={(e) => setEmployeeDraft((d) => ({ ...d, jobPositionId: e.target.value }))}
                      >
                        <option value="">— Neselectat —</option>
                        {detailPositions.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.code} — {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="detail-user-hire-date">Data angajării</label>
                      <input
                        id="detail-user-hire-date"
                        type="date"
                        value={employeeDraft.hireDate}
                        onChange={(e) => setEmployeeDraft((d) => ({ ...d, hireDate: e.target.value }))}
                      />
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend>Rol</legend>
                    <div className="checkbox-grid--stacked-roles" role="radiogroup" aria-label="Rol utilizator">
                      {assignableRoles.map((r) => (
                        <label key={r} className="checkbox-label checkbox-label--role-row">
                          <input
                            type="radio"
                            name="edit-user-role"
                            value={r}
                            checked={editRole === r}
                            onChange={() => setEditRole(r)}
                          />
                          <span className="role-row-text">
                            <span className="role-code">{r}</span>
                            <span className="role-desc">{ROLE_LABELS_RO[r] ?? r}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={patchUser.isPending || updateEmployee.isPending || createEmployee.isPending}
                  >
                    {patchUser.isPending || updateEmployee.isPending || createEmployee.isPending
                      ? "Se salvează…"
                      : "Salvează"}
                  </button>
                  {patchUser.isError || updateEmployee.isError || createEmployee.isError ? (
                    <p className="feedback error" role="alert">
                      {mutationErrorMessage(patchUser.error ?? updateEmployee.error ?? createEmployee.error)}
                    </p>
                  ) : null}
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
                  {staticPaged.items.map((p) => (
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
            <PaginationBar
              page={staticPaged.page}
              pageSize={staticPaged.pageSize}
              total={staticPaged.total}
              totalPages={staticPaged.totalPages}
              onPageChange={staticPage.setPage}
              onPageSizeChange={staticPage.setPageSize}
              disabled={staticQuery.isFetching}
            />
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
