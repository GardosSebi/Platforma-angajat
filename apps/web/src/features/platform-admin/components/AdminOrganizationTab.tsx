import { FormEvent, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  useDepartments,
  useEmployees,
  useJobPositions,
  useUpdateDepartment,
  useUpdateEmployee,
  useUpdateJobPosition,
  useUpdateWorksite,
  useWorksites
} from "../../master-data/hooks/useMasterData";
import type { EmployeeItem, UpdateEmployeePayload } from "../../master-data/api/master-data.api";

function isoToDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function dateInputToIsoUtc(date: string): string | undefined {
  if (!date.trim()) return undefined;
  return new Date(`${date}T00:00:00.000Z`).toISOString();
}

type OrgEdit =
  | null
  | { kind: "worksite"; id: string; code: string; name: string; address: string; active: boolean }
  | { kind: "department"; id: string; code: string; name: string; worksiteId: string; active: boolean }
  | {
      kind: "job";
      id: string;
      code: string;
      name: string;
      departmentId: string;
      corCode: string;
      description: string;
      active: boolean;
    }
  | {
      kind: "employee";
      id: string;
      email: string;
      fullName: string;
      cnp: string;
      worksiteId: string;
      departmentId: string;
      jobPositionId: string;
      hireDate: string;
      leaveDate: string;
      active: boolean;
    };

export function AdminOrganizationTab() {
  const worksitesQuery = useWorksites();
  const departmentsQuery = useDepartments();
  const jobPositionsQuery = useJobPositions();
  const employeesQuery = useEmployees();

  const updateWorksite = useUpdateWorksite();
  const updateDepartment = useUpdateDepartment();
  const updateJob = useUpdateJobPosition();
  const updateEmployee = useUpdateEmployee();

  const [orgEdit, setOrgEdit] = useState<OrgEdit>(null);

  const worksiteLabelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of worksitesQuery.data ?? []) {
      m.set(w.id, w.name);
    }
    return m;
  }, [worksitesQuery.data]);

  const departmentLabelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of departmentsQuery.data ?? []) {
      m.set(d.id, d.name);
    }
    return m;
  }, [departmentsQuery.data]);

  const jobPositionLabelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const j of jobPositionsQuery.data ?? []) {
      m.set(j.id, j.name);
    }
    return m;
  }, [jobPositionsQuery.data]);

  const filteredDepartmentsForEmployee = useMemo(() => {
    if (orgEdit?.kind !== "employee") return [];
    return (departmentsQuery.data ?? []).filter((dep) =>
      orgEdit.worksiteId ? dep.worksiteId === orgEdit.worksiteId : true
    );
  }, [departmentsQuery.data, orgEdit]);

  const filteredPositionsForEmployee = useMemo(() => {
    if (orgEdit?.kind !== "employee") return [];
    return (jobPositionsQuery.data ?? []).filter((pos) =>
      orgEdit.departmentId ? pos.departmentId === orgEdit.departmentId : true
    );
  }, [jobPositionsQuery.data, orgEdit]);

  const orgLoading =
    worksitesQuery.isLoading ||
    departmentsQuery.isLoading ||
    jobPositionsQuery.isLoading ||
    employeesQuery.isLoading;

  const mutationPending =
    updateWorksite.isPending ||
    updateDepartment.isPending ||
    updateJob.isPending ||
    updateEmployee.isPending;

  const mutationErr =
    (updateWorksite.error ?? updateDepartment.error ?? updateJob.error ?? updateEmployee.error) instanceof Error
      ? (updateWorksite.error ?? updateDepartment.error ?? updateJob.error ?? updateEmployee.error) as Error
      : null;

  const onSubmitOrgEdit = (event: FormEvent) => {
    event.preventDefault();
    if (!orgEdit) return;

    if (orgEdit.kind === "worksite") {
      updateWorksite.mutate(
        {
          id: orgEdit.id,
          payload: {
            code: orgEdit.code.trim(),
            name: orgEdit.name.trim(),
            address: orgEdit.address,
            active: orgEdit.active
          }
        },
        { onSuccess: () => setOrgEdit(null) }
      );
      return;
    }

    if (orgEdit.kind === "department") {
      updateDepartment.mutate(
        {
          id: orgEdit.id,
          payload: {
            code: orgEdit.code.trim(),
            name: orgEdit.name.trim(),
            worksiteId: orgEdit.worksiteId || "",
            active: orgEdit.active
          }
        },
        { onSuccess: () => setOrgEdit(null) }
      );
      return;
    }

    if (orgEdit.kind === "job") {
      updateJob.mutate(
        {
          id: orgEdit.id,
          payload: {
            code: orgEdit.code.trim(),
            name: orgEdit.name.trim(),
            departmentId: orgEdit.departmentId || "",
            corCode: orgEdit.corCode || undefined,
            description: orgEdit.description || undefined,
            active: orgEdit.active
          }
        },
        { onSuccess: () => setOrgEdit(null) }
      );
      return;
    }

    const payload: UpdateEmployeePayload = {
      email: orgEdit.email.trim(),
      fullName: orgEdit.fullName.trim(),
      active: orgEdit.active,
      worksiteId: orgEdit.worksiteId || undefined,
      departmentId: orgEdit.departmentId || undefined,
      jobPositionId: orgEdit.jobPositionId || undefined,
      hireDate: dateInputToIsoUtc(orgEdit.hireDate),
      leaveDate: dateInputToIsoUtc(orgEdit.leaveDate)
    };
    if (orgEdit.cnp && orgEdit.cnp !== "***") {
      payload.cnp = orgEdit.cnp.trim() || undefined;
    }

    updateEmployee.mutate({ id: orgEdit.id, payload }, { onSuccess: () => setOrgEdit(null) });
  };

  return (
    <div className="admin-org-overview">
      <p className="text-muted small">
        Apasă pe un rând din tabel pentru a edita. Adăugări noi și fluxul complet rămân în{" "}
        <NavLink to="/master-data">Master Data</NavLink>.
      </p>

      {orgLoading ? <p>Se încarcă…</p> : null}

      {orgEdit ? (
        <section className="card">
          <h2>Editează înregistrarea</h2>
          <form onSubmit={onSubmitOrgEdit} className="form-stack">
            {orgEdit.kind === "worksite" ? (
              <>
                <div className="field">
                  <label htmlFor="org-ws-code">Cod</label>
                  <input
                    id="org-ws-code"
                    value={orgEdit.code}
                    onChange={(e) => setOrgEdit({ ...orgEdit, code: e.target.value })}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="org-ws-name">Nume</label>
                  <input
                    id="org-ws-name"
                    value={orgEdit.name}
                    onChange={(e) => setOrgEdit({ ...orgEdit, name: e.target.value })}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="org-ws-addr">Adresă</label>
                  <input
                    id="org-ws-addr"
                    value={orgEdit.address}
                    onChange={(e) => setOrgEdit({ ...orgEdit, address: e.target.value })}
                  />
                </div>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={orgEdit.active}
                    onChange={(e) => setOrgEdit({ ...orgEdit, active: e.target.checked })}
                  />
                  Activ
                </label>
              </>
            ) : null}

            {orgEdit.kind === "department" ? (
              <>
                <div className="field">
                  <label htmlFor="org-dep-code">Cod</label>
                  <input
                    id="org-dep-code"
                    value={orgEdit.code}
                    onChange={(e) => setOrgEdit({ ...orgEdit, code: e.target.value })}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="org-dep-name">Nume</label>
                  <input
                    id="org-dep-name"
                    value={orgEdit.name}
                    onChange={(e) => setOrgEdit({ ...orgEdit, name: e.target.value })}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="org-dep-ws">Punct de lucru</label>
                  <select
                    id="org-dep-ws"
                    value={orgEdit.worksiteId}
                    onChange={(e) => setOrgEdit({ ...orgEdit, worksiteId: e.target.value })}
                  >
                    <option value="">— (fără punct de lucru)</option>
                    {(worksitesQuery.data ?? []).map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={orgEdit.active}
                    onChange={(e) => setOrgEdit({ ...orgEdit, active: e.target.checked })}
                  />
                  Activ
                </label>
              </>
            ) : null}

            {orgEdit.kind === "job" ? (
              <>
                <div className="field">
                  <label htmlFor="org-job-code">Cod</label>
                  <input
                    id="org-job-code"
                    value={orgEdit.code}
                    onChange={(e) => setOrgEdit({ ...orgEdit, code: e.target.value })}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="org-job-name">Nume</label>
                  <input
                    id="org-job-name"
                    value={orgEdit.name}
                    onChange={(e) => setOrgEdit({ ...orgEdit, name: e.target.value })}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="org-job-dep">Departament</label>
                  <select
                    id="org-job-dep"
                    value={orgEdit.departmentId}
                    onChange={(e) => setOrgEdit({ ...orgEdit, departmentId: e.target.value })}
                  >
                    <option value="">— (fără departament)</option>
                    {(departmentsQuery.data ?? []).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code} — {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="org-job-cor">Cod COR</label>
                  <input
                    id="org-job-cor"
                    value={orgEdit.corCode}
                    onChange={(e) => setOrgEdit({ ...orgEdit, corCode: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="org-job-desc">Descriere</label>
                  <textarea
                    id="org-job-desc"
                    rows={3}
                    value={orgEdit.description}
                    onChange={(e) => setOrgEdit({ ...orgEdit, description: e.target.value })}
                  />
                </div>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={orgEdit.active}
                    onChange={(e) => setOrgEdit({ ...orgEdit, active: e.target.checked })}
                  />
                  Activ
                </label>
              </>
            ) : null}

            {orgEdit.kind === "employee" ? (
              <>
                <div className="field">
                  <label htmlFor="org-em-name">Nume complet</label>
                  <input
                    id="org-em-name"
                    value={orgEdit.fullName}
                    onChange={(e) => setOrgEdit({ ...orgEdit, fullName: e.target.value })}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="org-em-email">E-mail</label>
                  <input
                    id="org-em-email"
                    type="email"
                    value={orgEdit.email}
                    onChange={(e) => setOrgEdit({ ...orgEdit, email: e.target.value })}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="org-em-cnp">CNP</label>
                  <input
                    id="org-em-cnp"
                    value={orgEdit.cnp}
                    onChange={(e) => setOrgEdit({ ...orgEdit, cnp: e.target.value })}
                    placeholder={orgEdit.cnp === "***" ? " mascat — introduceți valoarea nouă pentru a schimba" : ""}
                  />
                </div>
                <div className="field">
                  <label htmlFor="org-em-ws">Punct de lucru</label>
                  <select
                    id="org-em-ws"
                    value={orgEdit.worksiteId}
                    onChange={(e) =>
                      setOrgEdit({
                        ...orgEdit,
                        worksiteId: e.target.value,
                        departmentId: "",
                        jobPositionId: ""
                      })
                    }
                  >
                    <option value="">—</option>
                    {(worksitesQuery.data ?? []).map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="org-em-dep">Departament</label>
                  <select
                    id="org-em-dep"
                    value={orgEdit.departmentId}
                    onChange={(e) =>
                      setOrgEdit({
                        ...orgEdit,
                        departmentId: e.target.value,
                        jobPositionId: ""
                      })
                    }
                  >
                    <option value="">—</option>
                    {filteredDepartmentsForEmployee.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code} — {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="org-em-job">Post</label>
                  <select
                    id="org-em-job"
                    value={orgEdit.jobPositionId}
                    onChange={(e) => setOrgEdit({ ...orgEdit, jobPositionId: e.target.value })}
                  >
                    <option value="">—</option>
                    {filteredPositionsForEmployee.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.code} — {j.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="org-em-hire">Data angajării</label>
                  <input
                    id="org-em-hire"
                    type="date"
                    value={orgEdit.hireDate}
                    onChange={(e) => setOrgEdit({ ...orgEdit, hireDate: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="org-em-leave">Data încetării</label>
                  <input
                    id="org-em-leave"
                    type="date"
                    value={orgEdit.leaveDate}
                    onChange={(e) => setOrgEdit({ ...orgEdit, leaveDate: e.target.value })}
                  />
                </div>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={orgEdit.active}
                    onChange={(e) => setOrgEdit({ ...orgEdit, active: e.target.checked })}
                  />
                  Activ
                </label>
              </>
            ) : null}

            {mutationErr ? (
              <p className="feedback error" role="alert">
                {mutationErr.message}
              </p>
            ) : null}

            <div className="form-inline" style={{ alignItems: "center", marginBottom: 0 }}>
              <button type="submit" className="btn-primary" disabled={mutationPending}>
                {mutationPending ? "Se salvează…" : "Salvează"}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setOrgEdit(null)} disabled={mutationPending}>
                Anulează
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="card">
        <h2>Puncte de lucru</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Cod</th>
                <th>Nume</th>
                <th>Adresă</th>
                <th>Activ</th>
              </tr>
            </thead>
            <tbody>
              {(worksitesQuery.data ?? []).map((w) => (
                <tr
                  key={w.id}
                  className={orgEdit?.kind === "worksite" && orgEdit.id === w.id ? "selected" : undefined}
                  style={{ cursor: "pointer" }}
                  onClick={() =>
                    setOrgEdit({
                      kind: "worksite",
                      id: w.id,
                      code: w.code,
                      name: w.name,
                      address: w.address ?? "",
                      active: w.active
                    })
                  }
                >
                  <td>{w.code}</td>
                  <td>{w.name}</td>
                  <td>{w.address?.trim() ? w.address : "—"}</td>
                  <td>{w.active ? "da" : "nu"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Departamente</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Cod</th>
                <th>Nume</th>
                <th>Punct de lucru</th>
                <th>Activ</th>
              </tr>
            </thead>
            <tbody>
              {(departmentsQuery.data ?? []).map((d) => (
                <tr
                  key={d.id}
                  className={orgEdit?.kind === "department" && orgEdit.id === d.id ? "selected" : undefined}
                  style={{ cursor: "pointer" }}
                  onClick={() =>
                    setOrgEdit({
                      kind: "department",
                      id: d.id,
                      code: d.code,
                      name: d.name,
                      worksiteId: d.worksiteId ?? "",
                      active: d.active
                    })
                  }
                >
                  <td>{d.code}</td>
                  <td>{d.name}</td>
                  <td>{d.worksiteId ? (worksiteLabelById.get(d.worksiteId) ?? d.worksiteId) : "—"}</td>
                  <td>{d.active ? "da" : "nu"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Posturi / funcții</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Cod</th>
                <th>Nume</th>
                <th>Departament</th>
                <th>COR</th>
                <th>Activ</th>
              </tr>
            </thead>
            <tbody>
              {(jobPositionsQuery.data ?? []).map((j) => (
                <tr
                  key={j.id}
                  className={orgEdit?.kind === "job" && orgEdit.id === j.id ? "selected" : undefined}
                  style={{ cursor: "pointer" }}
                  onClick={() =>
                    setOrgEdit({
                      kind: "job",
                      id: j.id,
                      code: j.code,
                      name: j.name,
                      departmentId: j.departmentId ?? "",
                      corCode: j.corCode ?? "",
                      description: j.description ?? "",
                      active: j.active
                    })
                  }
                >
                  <td>{j.code}</td>
                  <td>{j.name}</td>
                  <td>
                    {j.departmentId ? (departmentLabelById.get(j.departmentId) ?? j.departmentId) : "—"}
                  </td>
                  <td>{j.corCode?.trim() ? j.corCode : "—"}</td>
                  <td>{j.active ? "da" : "nu"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Angajați</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nume</th>
                <th>E-mail</th>
                <th>Punct de lucru</th>
                <th>Departament</th>
                <th>Post</th>
                <th>Activ</th>
              </tr>
            </thead>
            <tbody>
              {(employeesQuery.data ?? []).map((e: EmployeeItem) => (
                <tr
                  key={e.id}
                  className={orgEdit?.kind === "employee" && orgEdit.id === e.id ? "selected" : undefined}
                  style={{ cursor: "pointer" }}
                  onClick={() =>
                    setOrgEdit({
                      kind: "employee",
                      id: e.id,
                      email: e.email,
                      fullName: e.fullName,
                      cnp: e.cnp ?? "",
                      worksiteId: e.worksiteId ?? "",
                      departmentId: e.departmentId ?? "",
                      jobPositionId: e.jobPositionId ?? "",
                      hireDate: isoToDateInput(e.hireDate ?? undefined),
                      leaveDate: isoToDateInput(e.leaveDate ?? undefined),
                      active: e.active
                    })
                  }
                >
                  <td>{e.fullName}</td>
                  <td>{e.email}</td>
                  <td>{e.worksiteId ? (worksiteLabelById.get(e.worksiteId) ?? e.worksiteId) : "—"}</td>
                  <td>{e.departmentId ? (departmentLabelById.get(e.departmentId) ?? e.departmentId) : "—"}</td>
                  <td>{e.jobPositionId ? (jobPositionLabelById.get(e.jobPositionId) ?? e.jobPositionId) : "—"}</td>
                  <td>{e.active ? "da" : "nu"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
