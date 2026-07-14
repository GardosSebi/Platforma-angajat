import { FormEvent, useEffect, useMemo, useState } from "react";
import { EmployeeSelect } from "../../master-data/components/EmployeeSelect";
import { useEmployeeOptions, useGroups } from "../../master-data/hooks/useMasterData";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { useCreateTrainingPlan, useCreateTrainingPlanGroup } from "../hooks/useSsmTrainingSuite";
import { TrainingTypeSelect } from "./TrainingTypeSelect";

type AssignMode = "individual" | "group";

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TrainingAssignForm() {
  const employeesQuery = useEmployeeOptions();
  const groupsQuery = useGroups({ page: 1, pageSize: 100 });
  const [mode, setMode] = useState<AssignMode>("individual");
  const [employeeId, setEmployeeId] = useState("");
  const [employeeGroupId, setEmployeeGroupId] = useState("");
  const [trainingTypeId, setTrainingTypeId] = useState("");
  const [scheduledAt, setScheduledAt] = useState(() => new Date().toISOString());
  const [dueAt, setDueAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString();
  });

  const createPlan = useCreateTrainingPlan();
  const createGroupPlans = useCreateTrainingPlanGroup();

  const employeeOptions = employeesQuery.data?.items ?? [];
  const groupOptions = useMemo(
    () =>
      (groupsQuery.data?.items ?? [])
        .filter((group) => group.active)
        .map((group) => ({ value: group.id, label: group.name })),
    [groupsQuery.data?.items]
  );

  useEffect(() => {
    if (!employeeId && employeeOptions[0]?.id) {
      setEmployeeId(employeeOptions[0].id);
    }
  }, [employeeOptions, employeeId]);

  useEffect(() => {
    if (!employeeGroupId && groupOptions[0]?.value) {
      setEmployeeGroupId(groupOptions[0].value);
    }
  }, [groupOptions, employeeGroupId]);

  const pending = createPlan.isPending || createGroupPlans.isPending;
  const successMessage =
    createGroupPlans.data && mode === "group"
      ? `Instruire alocată pentru ${createGroupPlans.data.createdCount} angajați din grupul „${createGroupPlans.data.groupName}”.`
      : createPlan.data
        ? `Instruire planificată. ID plan: ${createPlan.data.id}`
        : null;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!trainingTypeId) return;

    const payload = {
      trainingTypeId,
      scheduledAt,
      dueAt
    };

    if (mode === "group") {
      if (!employeeGroupId) return;
      createGroupPlans.mutate({ ...payload, employeeGroupId });
      return;
    }

    if (!employeeId) return;
    createPlan.mutate({ ...payload, employeeId });
  };

  return (
    <form className="card form-stack ssm-doc-card" onSubmit={onSubmit} aria-labelledby="assign-training-title">
      <h2 id="assign-training-title" className="card-title">
        Alocare instruire
      </h2>
      <p className="page-lead">
        Planifică instruiri prin modulul de conformitate (notificări in-app și email). Poți aloca individual sau pe
        grup.
      </p>

      <FieldSelect
        id="assign-mode"
        label="Mod alocare"
        value={mode}
        onChange={(value) => setMode(value as AssignMode)}
        options={[
          { value: "individual", label: "Angajat individual" },
          { value: "group", label: "Grup de instruire" }
        ]}
        required
      />

      {mode === "individual" ? (
        <EmployeeSelect
          id="assign-employee"
          value={employeeId}
          required
          onChange={setEmployeeId}
        />
      ) : (
        <FieldSelect
          id="assign-group"
          label="Grup de instruire"
          value={employeeGroupId}
          onChange={setEmployeeGroupId}
          options={groupOptions}
          required
          allowEmpty
          emptyLabel="Selectează grup"
          hint={
            groupOptions.length === 0
              ? "Nu există grupuri active. Creează grupuri din Master Data."
              : undefined
          }
        />
      )}

      <TrainingTypeSelect
        id="training-type"
        label="Tip instruire (din catalog)"
        value={trainingTypeId}
        valueField="id"
        required
        onChange={setTrainingTypeId}
      />

      <div className="field">
        <label htmlFor="scheduled-at">Programată la</label>
        <input
          id="scheduled-at"
          name="scheduledAt"
          type="datetime-local"
          value={toDatetimeLocalValue(scheduledAt)}
          onChange={(event) => {
            const v = event.target.value;
            if (!v) return;
            setScheduledAt(new Date(v).toISOString());
          }}
        />
      </div>

      <div className="field">
        <label htmlFor="due-date">Data scadenței</label>
        <input
          id="due-date"
          name="dueDate"
          type="datetime-local"
          value={toDatetimeLocalValue(dueAt)}
          onChange={(event) => {
            const v = event.target.value;
            if (!v) return;
            setDueAt(new Date(v).toISOString());
          }}
        />
      </div>

      <button
        type="submit"
        className="btn-primary"
        disabled={
          pending ||
          !trainingTypeId ||
          (mode === "individual" ? !employeeId : !employeeGroupId)
        }
      >
        {pending ? "Se alocă..." : mode === "group" ? "Alocă pe grup" : "Alocă instruire"}
      </button>

      {successMessage ? (
        <p className="feedback success" role="status">
          {successMessage}
        </p>
      ) : null}

      {createPlan.isError || createGroupPlans.isError ? (
        <p className="feedback error" role="alert">
          {createPlan.error instanceof Error
            ? createPlan.error.message
            : createGroupPlans.error instanceof Error
              ? createGroupPlans.error.message
              : "Eroare neașteptată"}
        </p>
      ) : null}
    </form>
  );
}
