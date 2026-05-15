import { FormEvent, useState } from "react";
import type {
  CreateDepartmentPayload,
  CreateJobPositionPayload,
  CreateWorksitePayload
} from "../api/master-data.api";
import {
  useCreateDepartment,
  useCreateJobPosition,
  useCreateWorksite,
  useDepartments,
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

function mutationErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "A apărut o eroare neașteptată.";
}

export function MasterDataPage() {
  const worksitesQuery = useWorksites();
  const departmentsQuery = useDepartments();
  const positionsQuery = useJobPositions();

  const createWorksite = useCreateWorksite();
  const createDepartment = useCreateDepartment();
  const createJobPosition = useCreateJobPosition();

  const [worksiteForm, setWorksiteForm] = useState<CreateWorksitePayload>(EMPTY_WORKSITE);
  const [departmentForm, setDepartmentForm] = useState<CreateDepartmentPayload>(EMPTY_DEPARTMENT);
  const [jobForm, setJobForm] = useState<CreateJobPositionPayload>(EMPTY_JOB);

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

  return (
    <>
      <h1 className="page-title">Master Data</h1>
      <p className="page-lead">Configurează structura organizațională: puncte de lucru, departamente și posturi.</p>

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
      </div>
    </>
  );
}
