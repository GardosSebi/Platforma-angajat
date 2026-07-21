import { FormEvent, useEffect, useMemo, useState } from "react";
import type { CreateEmployeePayload, EmployeeItem, UpdateEmployeePayload, UpdatePlacementPayload } from "../api/master-data.api";
import { PaginationBar, paginationFromResult } from "../../../shared/components/PaginationBar";
import { OptionCardRadioGroup } from "../../../shared/components/OptionCardRadioGroup";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { mapToOptions } from "../../../shared/components/field-select-options";
import { PasswordToggleButton } from "../../../shared/components/PasswordToggleButton";
import { usePagination } from "../../../shared/hooks/use-pagination";
import { useAuthSession } from "../../../shared/auth/use-auth-session";
import {
  assignableSystemRoles,
  SYSTEM_ROLE_CARD_OPTIONS,
  type SystemRoleCode
} from "../../../shared/constants/system-roles";
import {
  useCreateTenantUserFromMasterData,
  useDepartmentsLookup,
  useEmployee,
  useEmployees,
  useJobPositionsLookup,
  usePatchTenantUserRole,
  useUpdateEmployee,
  useUpdateEmployeePlacement,
  useWorksitesLookup
} from "../hooks/useMasterData";
import {
  ACTIVE_STATUS_CARD_OPTIONS,
  MASTER_DATA_ADD_LABELS,
  PLACEMENT_CHANGE_REASONS,
  activeLabel,
  activeTone,
  formatDate,
  mutationErrorMessage
} from "../master-data-shared";
import { MasterDataCreateModal } from "./MasterDataCreateModal";

const EMPTY_FORM: CreateEmployeePayload = {
  email: "",
  fullName: "",
  cnp: "",
  worksiteId: "",
  departmentId: "",
  jobPositionId: "",
  hireDate: "",
  leaveDate: "",
  active: true
};

function orgLabel(item?: { code: string; name: string } | null): string {
  if (!item) return "—";
  return `${item.code} — ${item.name}`;
}

export function MasterDataEmployeesPanel() {
  const session = useAuthSession();
  const pagination = usePagination();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"" | "true" | "false">("");
  const [worksiteFilter, setWorksiteFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [jobFilter, setJobFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateEmployeePayload>(EMPTY_FORM);
  const [createPassword, setCreatePassword] = useState("");
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [createRole, setCreateRole] = useState<SystemRoleCode>("EMPLOYEE");
  const [editRole, setEditRole] = useState<SystemRoleCode>("EMPLOYEE");
  const [editForm, setEditForm] = useState<UpdateEmployeePayload>({});
  const [placementForm, setPlacementForm] = useState<UpdatePlacementPayload>({
    changeReason: "Transfer"
  });
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const listParams = useMemo(
    () => ({
      ...pagination.params,
      search: search.trim() || undefined,
      active: activeFilter === "" ? undefined : activeFilter === "true",
      worksiteId: worksiteFilter || undefined,
      departmentId: departmentFilter || undefined,
      jobPositionId: jobFilter || undefined
    }),
    [pagination.params, search, activeFilter, worksiteFilter, departmentFilter, jobFilter]
  );

  const query = useEmployees(listParams);
  const detailQuery = useEmployee(selectedId ?? undefined, { enabled: Boolean(selectedId) });
  const worksitesLookup = useWorksitesLookup();
  const departmentsLookup = useDepartmentsLookup();
  const jobsLookup = useJobPositionsLookup();
  const createTenantUser = useCreateTenantUserFromMasterData();
  const patchUserRole = usePatchTenantUserRole();
  const updateEmployee = useUpdateEmployee();
  const updatePlacement = useUpdateEmployeePlacement();

  const roleCardOptions = useMemo(() => {
    const allowed = new Set(assignableSystemRoles(session?.roles));
    return SYSTEM_ROLE_CARD_OPTIONS.filter((option) => allowed.has(option.value as SystemRoleCode));
  }, [session?.roles]);

  useEffect(() => {
    const primaryRole = detailQuery.data?.linkedUser?.roles?.[0];
    setEditRole((primaryRole as SystemRoleCode) ?? "EMPLOYEE");
  }, [detailQuery.data?.linkedUser]);

  const paged = paginationFromResult(query.data, pagination.page, pagination.pageSize);

  const openDetail = (item: EmployeeItem) => {
    setFeedback(null);
    setSelectedId(item.id);
    setEditForm({
      email: item.email,
      fullName: item.fullName,
      cnp: item.cnp ?? "",
      worksiteId: item.worksiteId ?? "",
      departmentId: item.departmentId ?? "",
      jobPositionId: item.jobPositionId ?? "",
      hireDate: item.hireDate ? item.hireDate.slice(0, 10) : "",
      leaveDate: item.leaveDate ? item.leaveDate.slice(0, 10) : "",
      active: item.active
    });
    setPlacementForm({
      worksiteId: item.worksiteId ?? "",
      departmentId: item.departmentId ?? "",
      jobPositionId: item.jobPositionId ?? "",
      changeReason: "Transfer"
    });
  };

  const onCreate = (event: FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    if (createPassword.trim().length < 8) {
      setFeedback({ type: "error", message: "Parola trebuie să aibă cel puțin 8 caractere." });
      return;
    }
    createTenantUser.mutate(
      {
        email: form.email.trim(),
        password: createPassword,
        fullName: form.fullName.trim(),
        roles: [createRole],
        cnp: form.cnp?.trim() || undefined,
        worksiteId: form.worksiteId || undefined,
        departmentId: form.departmentId || undefined,
        jobPositionId: form.jobPositionId || undefined,
        hireDate: form.hireDate || undefined
      },
      {
        onSuccess: () => {
          setForm(EMPTY_FORM);
          setCreatePassword("");
          setShowCreatePassword(false);
          setCreateRole("EMPLOYEE");
          setShowForm(false);
          setFeedback({ type: "success", message: "Angajatul și contul de autentificare au fost create." });
        },
        onError: (error) => setFeedback({ type: "error", message: mutationErrorMessage(error) })
      }
    );
  };

  const onSaveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedId) return;
    setFeedback(null);
    try {
      await updateEmployee.mutateAsync({
        id: selectedId,
        payload: {
          ...editForm,
          email: editForm.email?.trim(),
          fullName: editForm.fullName?.trim(),
          cnp: editForm.cnp?.trim() || undefined,
          worksiteId: editForm.worksiteId || undefined,
          departmentId: editForm.departmentId || undefined,
          jobPositionId: editForm.jobPositionId || undefined,
          hireDate: editForm.hireDate || undefined,
          leaveDate: editForm.leaveDate || undefined
        }
      });
      const linkedUser = detailQuery.data?.linkedUser;
      if (linkedUser && (linkedUser.roles[0] ?? "EMPLOYEE") !== editRole) {
        await patchUserRole.mutateAsync({ userId: linkedUser.id, roles: [editRole] });
      }
      setFeedback({ type: "success", message: "Profilul angajatului a fost actualizat." });
    } catch (error) {
      setFeedback({ type: "error", message: mutationErrorMessage(error) });
    }
  };

  const onSavePlacement = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedId) return;
    setFeedback(null);
    updatePlacement.mutate(
      {
        id: selectedId,
        payload: {
          worksiteId: placementForm.worksiteId || null,
          departmentId: placementForm.departmentId || null,
          jobPositionId: placementForm.jobPositionId || null,
          changeReason: placementForm.changeReason.trim()
        }
      },
      {
        onSuccess: () => setFeedback({ type: "success", message: "Plasamentul a fost actualizat (istoric salvat)." }),
        onError: (error) => setFeedback({ type: "error", message: mutationErrorMessage(error) })
      }
    );
  };

  const history = detailQuery.data?.placementHistory ?? [];

  return (
    <>
      <section className="card comms-panel">
        <div className="comms-toolbar">
          <div className="comms-toolbar-start">
            <h2 className="card-title">Angajați</h2>
            <p className="comms-toolbar-hint">{paged.total} în total</p>
          </div>
          <button
            type="button"
            className="btn-primary comms-toolbar-cta"
            onClick={() => {
              setFeedback(null);
              setShowForm(true);
            }}
          >
            {MASTER_DATA_ADD_LABELS.employees}
          </button>
        </div>

        <div className="comms-filters">
          <div className="field comms-search-field">
            <label htmlFor="md-emp-search">Caută</label>
            <input
              id="md-emp-search"
              type="search"
              placeholder="Nume sau e-mail..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                pagination.setPage(1);
              }}
            />
          </div>
          <FieldSelect
            id="md-emp-active"
            label="Status"
            value={activeFilter}
            onChange={(value) => {
              setActiveFilter(value as "" | "true" | "false");
              pagination.setPage(1);
            }}
            allowEmpty
            emptyLabel="Toți"
            options={[
              { value: "true", label: "Activi" },
              { value: "false", label: "Inactivi" }
            ]}
          />
          <FieldSelect
            id="md-emp-worksite"
            label="Punct de lucru"
            value={worksiteFilter}
            onChange={(value) => {
              setWorksiteFilter(value);
              pagination.setPage(1);
            }}
            allowEmpty
            emptyLabel="Toate"
            options={mapToOptions(
              worksitesLookup.data?.items ?? [],
              (w) => w.id,
              (w) => `${w.code} — ${w.name}`
            )}
          />
          <FieldSelect
            id="md-emp-department"
            label="Departament"
            value={departmentFilter}
            onChange={(value) => {
              setDepartmentFilter(value);
              pagination.setPage(1);
            }}
            allowEmpty
            emptyLabel="Toate"
            options={mapToOptions(
              departmentsLookup.data?.items ?? [],
              (d) => d.id,
              (d) => `${d.code} — ${d.name}`
            )}
          />
          <FieldSelect
            id="md-emp-job"
            label="Post / funcție"
            value={jobFilter}
            onChange={(value) => {
              setJobFilter(value);
              pagination.setPage(1);
            }}
            allowEmpty
            emptyLabel="Toate"
            options={mapToOptions(
              jobsLookup.data?.items ?? [],
              (j) => j.id,
              (j) => `${j.code} — ${j.name}`
            )}
          />
        </div>

        {feedback && !showForm && !selectedId ? (
          <div className={`feedback ${feedback.type}`} role={feedback.type === "error" ? "alert" : "status"}>
            {feedback.message}
          </div>
        ) : null}

        <div className="table-wrap">
          <table className="data-table comms-table">
            <thead>
              <tr>
                <th>Nume</th>
                <th>E-mail</th>
                <th>Funcție</th>
                <th>Departament</th>
                <th>Punct de lucru</th>
                <th>Angajare</th>
                <th>Stare</th>
                <th aria-label="Acțiuni" />
              </tr>
            </thead>
            <tbody>
              {query.isLoading ? (
                <tr>
                  <td colSpan={8} className="text-muted">
                    Se încarcă...
                  </td>
                </tr>
              ) : null}
              {!query.isLoading && paged.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="comms-empty-cell">
                    <p>Nu am găsit angajați pentru filtrele selectate.</p>
                  </td>
                </tr>
              ) : null}
              {paged.items.map((item) => (
                <tr key={item.id} className={selectedId === item.id ? "comms-row-selected" : undefined}>
                  <td className="comms-title-cell">{item.fullName}</td>
                  <td>{item.email}</td>
                  <td>{item.jobPosition ? `${item.jobPosition.code} — ${item.jobPosition.name}` : "—"}</td>
                  <td>{orgLabel(item.department)}</td>
                  <td>{orgLabel(item.worksite)}</td>
                  <td>{formatDate(item.hireDate)}</td>
                  <td>
                    <span className={`comms-status comms-status--${activeTone(item.active)}`}>
                      {activeLabel(item.active)}
                    </span>
                  </td>
                  <td className="comms-actions-cell">
                    <div className="comms-row-actions">
                      <button type="button" className="btn-secondary btn-sm" onClick={() => openDetail(item)}>
                        Detalii
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <PaginationBar
          page={paged.page}
          pageSize={paged.pageSize}
          total={paged.total}
          totalPages={paged.totalPages}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
          disabled={query.isFetching}
        />
      </section>

      {showForm ? (
        <MasterDataCreateModal
          title="Angajat nou"
          titleId="md-employee-create-title"
          onClose={() => setShowForm(false)}
          size="wide"
        >
          <form className="form-stack" onSubmit={onCreate}>
            <div className="comms-form-row">
              <div className="field">
                <label htmlFor="md-emp-name">Nume complet *</label>
                <input
                  id="md-emp-name"
                  value={form.fullName}
                  onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="md-emp-email">E-mail *</label>
                <input
                  id="md-emp-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="comms-form-row">
              <div className="field">
                <label htmlFor="md-emp-cnp">CNP</label>
                <input id="md-emp-cnp" value={form.cnp ?? ""} onChange={(e) => setForm((p) => ({ ...p, cnp: e.target.value }))} />
              </div>
              <div className="field">
                <label htmlFor="md-emp-hire">Dată angajare</label>
                <input
                  id="md-emp-hire"
                  type="date"
                  value={form.hireDate ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, hireDate: e.target.value }))}
                />
              </div>
            </div>
            <FieldSelect
              id="md-emp-create-worksite"
              label="Punct de lucru"
              value={form.worksiteId ?? ""}
              onChange={(worksiteId) => setForm((p) => ({ ...p, worksiteId }))}
              allowEmpty
              emptyLabel="Neselectat"
              options={mapToOptions(
                worksitesLookup.data?.items ?? [],
                (w) => w.id,
                (w) => `${w.code} — ${w.name}`
              )}
            />
            <FieldSelect
              id="md-emp-create-dep"
              label="Departament"
              value={form.departmentId ?? ""}
              onChange={(departmentId) => setForm((p) => ({ ...p, departmentId }))}
              allowEmpty
              emptyLabel="Neselectat"
              options={mapToOptions(
                departmentsLookup.data?.items ?? [],
                (d) => d.id,
                (d) => `${d.code} — ${d.name}`
              )}
            />
            <FieldSelect
              id="md-emp-create-job"
              label="Post / funcție"
              value={form.jobPositionId ?? ""}
              onChange={(jobPositionId) => setForm((p) => ({ ...p, jobPositionId }))}
              allowEmpty
              emptyLabel="Neselectat"
              options={mapToOptions(
                jobsLookup.data?.items ?? [],
                (j) => j.id,
                (j) => `${j.code} — ${j.name}`
              )}
            />
            <div className="field">
              <label htmlFor="md-emp-create-password">Parolă cont autentificare *</label>
              <div className="password-field-row">
                <input
                  id="md-emp-create-password"
                  type={showCreatePassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={8}
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  placeholder="Minim 8 caractere"
                  required
                />
                <PasswordToggleButton
                  visible={showCreatePassword}
                  onToggle={() => setShowCreatePassword((value) => !value)}
                />
              </div>
            </div>
            <OptionCardRadioGroup
              name="md-emp-create-role"
              legend="Rol la creare"
              hint="Alege un singur rol pentru contul de autentificare al angajatului."
              value={createRole}
              onChange={(role) => setCreateRole(role as SystemRoleCode)}
              options={roleCardOptions}
            />
            <div className="comms-compose-actions">
              <button className="btn-primary" type="submit" disabled={createTenantUser.isPending}>
                {createTenantUser.isPending ? "Se salvează..." : "Salvează"}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                Anulează
              </button>
            </div>
            {feedback ? (
              <div className={`feedback ${feedback.type}`} role={feedback.type === "error" ? "alert" : "status"}>
                {feedback.message}
              </div>
            ) : null}
          </form>
        </MasterDataCreateModal>
      ) : null}

      {selectedId ? (
        <section className="card comms-panel md-detail-panel">
          <div className="comms-toolbar">
            <h3 className="card-title">{detailQuery.data?.fullName ?? "Detalii angajat"}</h3>
            <button type="button" className="btn-secondary" onClick={() => setSelectedId(null)}>
              Închide
            </button>
          </div>

          {feedback ? (
            <div className={`feedback ${feedback.type}`} role={feedback.type === "error" ? "alert" : "status"}>
              {feedback.message}
            </div>
          ) : null}

          <form className="form-stack" onSubmit={onSaveProfile}>
            <h4>Profil</h4>
            <div className="comms-form-row">
              <div className="field">
                <label htmlFor="md-emp-edit-name">Nume</label>
                <input
                  id="md-emp-edit-name"
                  value={editForm.fullName ?? ""}
                  onChange={(e) => setEditForm((p) => ({ ...p, fullName: e.target.value }))}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="md-emp-edit-email">E-mail</label>
                <input
                  id="md-emp-edit-email"
                  type="email"
                  value={editForm.email ?? ""}
                  onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="md-emp-edit-cnp">CNP</label>
              <input
                id="md-emp-edit-cnp"
                value={editForm.cnp ?? ""}
                onChange={(e) => setEditForm((p) => ({ ...p, cnp: e.target.value }))}
              />
            </div>
            <OptionCardRadioGroup
              name="md-emp-edit-status"
              legend="Status"
              hint="Alege dacă angajatul este activ sau inactiv în structura organizațională."
              value={editForm.active === false ? "false" : "true"}
              onChange={(next) => setEditForm((p) => ({ ...p, active: next === "true" }))}
              options={[...ACTIVE_STATUS_CARD_OPTIONS]}
            />
            {detailQuery.data?.linkedUser ? (
              <OptionCardRadioGroup
                name="md-emp-edit-role"
                legend="Rol utilizator"
                hint="Rolul contului de autentificare asociat acestui angajat (același e-mail)."
                value={editRole}
                onChange={(role) => setEditRole(role as SystemRoleCode)}
                options={roleCardOptions}
              />
            ) : (
              <p className="text-muted small">
                Nu există cont de autentificare pentru acest e-mail. Rolul se setează la crearea angajatului.
              </p>
            )}
            <div className="comms-form-row">
              <div className="field">
                <label htmlFor="md-emp-edit-hire">Dată angajare</label>
                <input
                  id="md-emp-edit-hire"
                  type="date"
                  value={editForm.hireDate ?? ""}
                  onChange={(e) => setEditForm((p) => ({ ...p, hireDate: e.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="md-emp-edit-leave">Dată plecare</label>
                <input
                  id="md-emp-edit-leave"
                  type="date"
                  value={editForm.leaveDate ?? ""}
                  onChange={(e) => setEditForm((p) => ({ ...p, leaveDate: e.target.value }))}
                />
              </div>
            </div>
            <button
              className="btn-primary"
              type="submit"
              disabled={updateEmployee.isPending || patchUserRole.isPending}
            >
              Salvează profil
            </button>
          </form>

          <form className="form-stack md-placement-form" onSubmit={onSavePlacement}>
            <h4>Schimbare plasament (post / punct de lucru)</h4>
            <p className="text-muted">
              Modificările de plasament sunt înregistrate în istoric; datele anterioare nu se șterg.
            </p>
            <FieldSelect
              id="md-emp-place-worksite"
              label="Punct de lucru"
              value={placementForm.worksiteId ?? ""}
              onChange={(worksiteId) => setPlacementForm((p) => ({ ...p, worksiteId }))}
              allowEmpty
              emptyLabel="Neselectat"
              options={mapToOptions(
                worksitesLookup.data?.items ?? [],
                (w) => w.id,
                (w) => `${w.code} — ${w.name}`
              )}
            />
            <FieldSelect
              id="md-emp-place-dep"
              label="Departament"
              value={placementForm.departmentId ?? ""}
              onChange={(departmentId) => setPlacementForm((p) => ({ ...p, departmentId }))}
              allowEmpty
              emptyLabel="Neselectat"
              options={mapToOptions(
                departmentsLookup.data?.items ?? [],
                (d) => d.id,
                (d) => `${d.code} — ${d.name}`
              )}
            />
            <FieldSelect
              id="md-emp-place-job"
              label="Post"
              value={placementForm.jobPositionId ?? ""}
              onChange={(jobPositionId) => setPlacementForm((p) => ({ ...p, jobPositionId }))}
              allowEmpty
              emptyLabel="Neselectat"
              options={mapToOptions(
                jobsLookup.data?.items ?? [],
                (j) => j.id,
                (j) => `${j.code} — ${j.name}`
              )}
            />
            <FieldSelect
              id="md-emp-place-reason"
              label="Motiv modificare *"
              value={placementForm.changeReason}
              onChange={(changeReason) => setPlacementForm((p) => ({ ...p, changeReason }))}
              options={PLACEMENT_CHANGE_REASONS.map((r) => ({ value: r, label: r }))}
            />
            <button className="btn-primary" type="submit" disabled={updatePlacement.isPending}>
              Aplică schimbarea plasamentului
            </button>
          </form>

          <div className="md-history-block">
            <h4>Istoric plasament</h4>
            <div className="table-wrap">
              <table className="data-table comms-table">
                <thead>
                  <tr>
                    <th>De la</th>
                    <th>Până la</th>
                    <th>Post</th>
                    <th>Punct de lucru</th>
                    <th>Motiv</th>
                  </tr>
                </thead>
                <tbody>
                  {detailQuery.isLoading ? (
                    <tr>
                      <td colSpan={5} className="text-muted">
                        Se încarcă istoricul...
                      </td>
                    </tr>
                  ) : null}
                  {!detailQuery.isLoading && history.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-muted">
                        Nu există înregistrări în istoric.
                      </td>
                    </tr>
                  ) : null}
                  {history.map((row) => (
                    <tr key={row.id}>
                      <td>{formatDate(row.effectiveFrom)}</td>
                      <td>{row.effectiveTo ? formatDate(row.effectiveTo) : "Curent"}</td>
                      <td>{orgLabel(row.jobPosition)}</td>
                      <td>{orgLabel(row.worksite)}</td>
                      <td>{row.changeReason || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
