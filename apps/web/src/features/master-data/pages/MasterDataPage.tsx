import { FormEvent, useMemo, useState } from "react";
import type {
  CreateDepartmentPayload,
  CreateEmployeePayload,
  CreateJobPositionPayload,
  CreateWorksitePayload
} from "../api/master-data.api";
import {
  useCreateDepartment,
  useCreateEmployee,
  useCreateJobPosition,
  useCreateWorksite,
  useDepartments,
  useEmployees,
  useJobPositions,
  useWorksites
} from "../hooks/useMasterData";

const EMPTY_WORKSITE: CreateWorksitePayload = {
  code: "",
  name: "",
  address: "",
  active: true
};

const EMPTY_DEPARTMENT: CreateDepartmentPayload = {
  code: "",
  name: "",
  worksiteId: "",
  active: true
};

const EMPTY_JOB: CreateJobPositionPayload = {
  code: "",
  name: "",
  departmentId: "",
  corCode: "",
  description: "",
  active: true
};

const EMPTY_EMPLOYEE: CreateEmployeePayload = {
  email: "",
  fullName: "",
  cnp: "",
  worksiteId: "",
  departmentId: "",
  jobPositionId: "",
  hireDate: "",
  active: true
};

function mutationErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "A apărut o eroare neașteptată.";
}

export function MasterDataPage() {
  const worksitesQuery = useWorksites();
  const departmentsQuery = useDepartments();
  const positionsQuery = useJobPositions();
  const employeesQuery = useEmployees();

  const createWorksite = useCreateWorksite();
  const createDepartment = useCreateDepartment();
  const createJobPosition = useCreateJobPosition();
  const createEmployee = useCreateEmployee();

  const [worksiteForm, setWorksiteForm] = useState<CreateWorksitePayload>(EMPTY_WORKSITE);
  const [departmentForm, setDepartmentForm] = useState<CreateDepartmentPayload>(EMPTY_DEPARTMENT);
  const [jobForm, setJobForm] = useState<CreateJobPositionPayload>(EMPTY_JOB);
  const [employeeForm, setEmployeeForm] = useState<CreateEmployeePayload>(EMPTY_EMPLOYEE);

  const filteredDepartments = useMemo(
    () =>
      (departmentsQuery.data ?? []).filter((dep) =>
        employeeForm.worksiteId
          ? (worksitesQuery.data ?? []).find((w) => w.id === dep.worksiteId)?.id === employeeForm.worksiteId
          : true
      ),
    [departmentsQuery.data, employeeForm.worksiteId, worksitesQuery.data]
  );

  const filteredPositions = useMemo(
    () =>
      (positionsQuery.data ?? []).filter((pos) =>
        employeeForm.departmentId ? pos.departmentId === employeeForm.departmentId : true
      ),
    [positionsQuery.data, employeeForm.departmentId]
  );

  const onCreateWorksite = (event: FormEvent) => {
    event.preventDefault();
    createWorksite.mutate(worksiteForm, {
      onSuccess: () => setWorksiteForm(EMPTY_WORKSITE)
    });
  };

  const onCreateDepartment = (event: FormEvent) => {
    event.preventDefault();
    createDepartment.mutate(
      {
        ...departmentForm,
        worksiteId: departmentForm.worksiteId || undefined
      },
      {
        onSuccess: () => setDepartmentForm(EMPTY_DEPARTMENT)
      }
    );
  };

  const onCreateJobPosition = (event: FormEvent) => {
    event.preventDefault();
    createJobPosition.mutate(
      {
        ...jobForm,
        departmentId: jobForm.departmentId || undefined
      },
      {
        onSuccess: () => setJobForm(EMPTY_JOB)
      }
    );
  };

  const onCreateEmployee = (event: FormEvent) => {
    event.preventDefault();
    createEmployee.mutate(
      {
        ...employeeForm,
        cnp: employeeForm.cnp || undefined,
        worksiteId: employeeForm.worksiteId || undefined,
        departmentId: employeeForm.departmentId || undefined,
        jobPositionId: employeeForm.jobPositionId || undefined,
        hireDate: employeeForm.hireDate || undefined
      },
      {
        onSuccess: () => setEmployeeForm(EMPTY_EMPLOYEE)
      }
    );
  };

  return (
    <>
      <h1 className="page-title">Master Data</h1>
      <p className="page-lead">Configurează structura organizațională: puncte de lucru, departamente, posturi și angajați.</p>

      <div className="ssm-doc-grid">
        <form className="card form-stack ssm-doc-card" onSubmit={onCreateWorksite}>
          <h2 className="card-title">Punct de lucru</h2>
          <div className="field">
            <label htmlFor="md-worksite-code">Cod</label>
            <input
              id="md-worksite-code"
              value={worksiteForm.code}
              onChange={(event) => setWorksiteForm((prev) => ({ ...prev, code: event.target.value }))}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="md-worksite-name">Denumire</label>
            <input
              id="md-worksite-name"
              value={worksiteForm.name}
              onChange={(event) => setWorksiteForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="md-worksite-address">Adresă</label>
            <input
              id="md-worksite-address"
              value={worksiteForm.address ?? ""}
              onChange={(event) => setWorksiteForm((prev) => ({ ...prev, address: event.target.value }))}
            />
          </div>
          <button className="btn-primary" type="submit" disabled={createWorksite.isPending}>
            {createWorksite.isPending ? "Se salvează..." : "Adaugă punct de lucru"}
          </button>
          {createWorksite.isSuccess ? <p className="feedback success">Punctul de lucru a fost adăugat.</p> : null}
          {createWorksite.isError ? <p className="feedback error">{mutationErrorMessage(createWorksite.error)}</p> : null}
          <p className="field-hint">Total: {worksitesQuery.data?.length ?? 0}</p>
        </form>

        <form className="card form-stack ssm-doc-card" onSubmit={onCreateDepartment}>
          <h2 className="card-title">Departament</h2>
          <div className="field">
            <label htmlFor="md-department-code">Cod</label>
            <input
              id="md-department-code"
              value={departmentForm.code}
              onChange={(event) => setDepartmentForm((prev) => ({ ...prev, code: event.target.value }))}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="md-department-name">Denumire</label>
            <input
              id="md-department-name"
              value={departmentForm.name}
              onChange={(event) => setDepartmentForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="md-department-worksite">Punct de lucru (opțional)</label>
            <select
              id="md-department-worksite"
              value={departmentForm.worksiteId ?? ""}
              onChange={(event) => setDepartmentForm((prev) => ({ ...prev, worksiteId: event.target.value }))}
            >
              <option value="">Neselectat</option>
              {(worksitesQuery.data ?? []).map((worksite) => (
                <option key={worksite.id} value={worksite.id}>
                  {worksite.code} - {worksite.name}
                </option>
              ))}
            </select>
          </div>
          <button className="btn-primary" type="submit" disabled={createDepartment.isPending}>
            {createDepartment.isPending ? "Se salvează..." : "Adaugă departament"}
          </button>
          {createDepartment.isSuccess ? <p className="feedback success">Departamentul a fost adăugat.</p> : null}
          {createDepartment.isError ? <p className="feedback error">{mutationErrorMessage(createDepartment.error)}</p> : null}
          <p className="field-hint">Total: {departmentsQuery.data?.length ?? 0}</p>
        </form>
      </div>

      <div className="ssm-doc-grid second">
        <form className="card form-stack ssm-doc-card" onSubmit={onCreateJobPosition}>
          <h2 className="card-title">Post</h2>
          <div className="field">
            <label htmlFor="md-job-code">Cod</label>
            <input
              id="md-job-code"
              value={jobForm.code}
              onChange={(event) => setJobForm((prev) => ({ ...prev, code: event.target.value }))}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="md-job-name">Denumire</label>
            <input
              id="md-job-name"
              value={jobForm.name}
              onChange={(event) => setJobForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="md-job-department">Departament (opțional)</label>
            <select
              id="md-job-department"
              value={jobForm.departmentId ?? ""}
              onChange={(event) => setJobForm((prev) => ({ ...prev, departmentId: event.target.value }))}
            >
              <option value="">Neselectat</option>
              {(departmentsQuery.data ?? []).map((department) => (
                <option key={department.id} value={department.id}>
                  {department.code} - {department.name}
                </option>
              ))}
            </select>
          </div>
          <button className="btn-primary" type="submit" disabled={createJobPosition.isPending}>
            {createJobPosition.isPending ? "Se salvează..." : "Adaugă post"}
          </button>
          {createJobPosition.isSuccess ? <p className="feedback success">Postul a fost adăugat.</p> : null}
          {createJobPosition.isError ? <p className="feedback error">{mutationErrorMessage(createJobPosition.error)}</p> : null}
          <p className="field-hint">Total: {positionsQuery.data?.length ?? 0}</p>
        </form>

        <form className="card form-stack ssm-doc-card" onSubmit={onCreateEmployee}>
          <h2 className="card-title">Angajat</h2>
          <div className="field">
            <label htmlFor="md-employee-email">Email</label>
            <input
              id="md-employee-email"
              type="email"
              value={employeeForm.email}
              onChange={(event) => setEmployeeForm((prev) => ({ ...prev, email: event.target.value }))}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="md-employee-name">Nume complet</label>
            <input
              id="md-employee-name"
              value={employeeForm.fullName}
              onChange={(event) => setEmployeeForm((prev) => ({ ...prev, fullName: event.target.value }))}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="md-employee-cnp">CNP (opțional)</label>
            <input
              id="md-employee-cnp"
              value={employeeForm.cnp ?? ""}
              onChange={(event) => setEmployeeForm((prev) => ({ ...prev, cnp: event.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="md-employee-worksite">Punct de lucru</label>
            <select
              id="md-employee-worksite"
              value={employeeForm.worksiteId ?? ""}
              onChange={(event) => setEmployeeForm((prev) => ({ ...prev, worksiteId: event.target.value }))}
            >
              <option value="">Neselectat</option>
              {(worksitesQuery.data ?? []).map((worksite) => (
                <option key={worksite.id} value={worksite.id}>
                  {worksite.code} - {worksite.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="md-employee-department">Departament</label>
            <select
              id="md-employee-department"
              value={employeeForm.departmentId ?? ""}
              onChange={(event) => setEmployeeForm((prev) => ({ ...prev, departmentId: event.target.value }))}
            >
              <option value="">Neselectat</option>
              {filteredDepartments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.code} - {department.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="md-employee-position">Post</label>
            <select
              id="md-employee-position"
              value={employeeForm.jobPositionId ?? ""}
              onChange={(event) => setEmployeeForm((prev) => ({ ...prev, jobPositionId: event.target.value }))}
            >
              <option value="">Neselectat</option>
              {filteredPositions.map((position) => (
                <option key={position.id} value={position.id}>
                  {position.code} - {position.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="md-employee-hire-date">Data angajare (ISO)</label>
            <input
              id="md-employee-hire-date"
              placeholder="2026-05-08T09:00:00.000Z"
              value={employeeForm.hireDate ?? ""}
              onChange={(event) => setEmployeeForm((prev) => ({ ...prev, hireDate: event.target.value }))}
            />
          </div>
          <button className="btn-primary" type="submit" disabled={createEmployee.isPending}>
            {createEmployee.isPending ? "Se salvează..." : "Adaugă angajat"}
          </button>
          {createEmployee.isSuccess ? <p className="feedback success">Angajatul a fost adăugat.</p> : null}
          {createEmployee.isError ? <p className="feedback error">{mutationErrorMessage(createEmployee.error)}</p> : null}
        </form>
      </div>

      <section className="card ssm-doc-card ssm-documents">
        <h2 className="card-title">Angajați existenți</h2>
        <div className="ssm-history-list">
          {(employeesQuery.data ?? []).slice(0, 30).map((employee) => (
            <div key={employee.id} className="ssm-history-item">
              <div>
                <strong>{employee.fullName}</strong>
                <div className="field-hint">
                  {employee.email} | {employee.active ? "activ" : "inactiv"} | id: {employee.id}
                </div>
              </div>
              <span className={employee.active ? "badge-good" : "badge-bad"}>{employee.active ? "Activ" : "Inactiv"}</span>
            </div>
          ))}
        </div>
        {!employeesQuery.data?.length ? <p className="field-hint">Nu există angajați în tenantul curent.</p> : null}
      </section>
    </>
  );
}
