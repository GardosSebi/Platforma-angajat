import { FormEvent, useEffect, useMemo, useState } from "react";
import type { AssignTrainingRequest } from "@repo/shared-types/ssm";
import { EmployeeSelect } from "../../master-data/components/EmployeeSelect";
import { useEmployeeOptions } from "../../master-data/hooks/useMasterData";
import { useAssignTraining } from "../hooks/useAssignTraining";
import { useTrainingTypes } from "../hooks/useSsmTrainingSuite";
import { TrainingTypeSelect } from "./TrainingTypeSelect";

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
  const typesQuery = useTrainingTypes();
  const [form, setForm] = useState<AssignTrainingRequest>({
    employeeId: "",
    trainingCode: "",
    dueDate: new Date().toISOString()
  });
  const mutation = useAssignTraining();

  const employeeOptions = employeesQuery.data?.items ?? [];
  const trainingTypes = useMemo(
    () => (typesQuery.data ?? []).filter((type) => type.active),
    [typesQuery.data]
  );

  useEffect(() => {
    if (!form.employeeId && employeeOptions[0]?.id) {
      setForm((current) => ({ ...current, employeeId: employeeOptions[0]!.id }));
    }
  }, [employeeOptions, form.employeeId]);

  useEffect(() => {
    if (!form.trainingCode && trainingTypes[0]?.code) {
      setForm((current) => ({ ...current, trainingCode: trainingTypes[0]!.code }));
    }
  }, [trainingTypes, form.trainingCode]);

  const dueLocal = useMemo(() => toDatetimeLocalValue(form.dueDate), [form.dueDate]);

  const selectedType = useMemo(
    () => trainingTypes.find((type) => type.code === form.trainingCode),
    [trainingTypes, form.trainingCode]
  );

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.employeeId || !form.trainingCode) return;
    mutation.mutate(form);
  };

  return (
    <form className="card form-stack ssm-doc-card" onSubmit={onSubmit} aria-labelledby="assign-training-title">
      <h2 id="assign-training-title" className="card-title">
        Alocare instruire
      </h2>

      <EmployeeSelect
        id="assign-employee"
        value={form.employeeId}
        required
        onChange={(employeeId) => setForm((current) => ({ ...current, employeeId }))}
      />

      <TrainingTypeSelect
        id="training-code"
        label="Tip instruire (din catalog)"
        value={form.trainingCode}
        required
        onChange={(trainingCode) => setForm((current) => ({ ...current, trainingCode }))}
        hint={
          selectedType ? (
            <>
              Cod: <strong>{selectedType.code}</strong>
              {selectedType.recurrenceDays ? ` · recurență ${selectedType.recurrenceDays} zile` : ""}
            </>
          ) : undefined
        }
      />

      <div className="field">
        <label htmlFor="due-date">Data scadenței</label>
        <input
          id="due-date"
          name="dueDate"
          type="datetime-local"
          value={dueLocal}
          onChange={(event) => {
            const v = event.target.value;
            if (!v) {
              return;
            }
            setForm((current) => ({
              ...current,
              dueDate: new Date(v).toISOString()
            }));
          }}
        />
      </div>
      <button
        type="submit"
        className="btn-primary"
        disabled={mutation.isPending || !form.employeeId || !form.trainingCode || trainingTypes.length === 0}
      >
        {mutation.isPending ? "Se alocă..." : "Alocă instruire"}
      </button>
      {mutation.isSuccess ? (
        <p className="feedback success" role="status">
          Instruirea a fost alocată. ID alocare: <strong>{mutation.data.assignmentId}</strong>
        </p>
      ) : null}
      {mutation.isError ? (
        <p className="feedback error" role="alert">
          {mutation.error instanceof Error ? mutation.error.message : "Eroare neașteptată"}
        </p>
      ) : null}
    </form>
  );
}
