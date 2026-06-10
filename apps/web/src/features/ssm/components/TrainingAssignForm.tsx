import { FormEvent, useEffect, useMemo, useState } from "react";
import type { AssignTrainingRequest } from "@repo/shared-types/ssm";
import { trainingCategoryLabel } from "@repo/shared-types/ssm-training-catalog";
import { EmployeeSelect } from "../../master-data/components/EmployeeSelect";
import { useEmployeeOptions } from "../../master-data/hooks/useMasterData";
import { useAssignTraining } from "../hooks/useAssignTraining";
import { useTrainingTypes } from "../hooks/useSsmTrainingSuite";

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
    <section className="card" aria-labelledby="assign-training-title">
      <h2 id="assign-training-title" className="card-title">
        Alocare instruire
      </h2>
      <form onSubmit={onSubmit} className="form-stack">
        <EmployeeSelect
          id="assign-employee"
          value={form.employeeId}
          required
          onChange={(employeeId) => setForm((current) => ({ ...current, employeeId }))}
        />

        <div className="field">
          <label htmlFor="training-code">Tip instruire (din catalog)</label>
          {typesQuery.isLoading ? (
            <p className="field-hint">Se încarcă tipurile de instruire…</p>
          ) : typesQuery.isError ? (
            <p className="feedback error" role="alert">
              {typesQuery.error instanceof Error ? typesQuery.error.message : "Nu s-au putut încărca tipurile."}
            </p>
          ) : trainingTypes.length === 0 ? (
            <p className="field-hint">
              Nu există tipuri active în catalog. Adaugă un tip din secțiunea „Instruire și conformitate”.
            </p>
          ) : (
            <>
              <select
                id="training-code"
                name="trainingCode"
                required
                value={form.trainingCode}
                onChange={(event) => setForm((current) => ({ ...current, trainingCode: event.target.value }))}
              >
                <option value="">Selectează instruirea</option>
                {trainingTypes.map((type) => (
                  <option key={type.id} value={type.code}>
                    {type.code} — {type.name} ({trainingCategoryLabel(type.category)})
                  </option>
                ))}
              </select>
              {selectedType ? (
                <p className="field-hint">
                  Cod: <strong>{selectedType.code}</strong>
                  {selectedType.recurrenceDays ? ` · recurență ${selectedType.recurrenceDays} zile` : ""}
                </p>
              ) : null}
            </>
          )}
        </div>

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
    </section>
  );
}
