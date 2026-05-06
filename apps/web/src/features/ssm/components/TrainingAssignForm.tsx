import { FormEvent, useMemo, useState } from "react";
import type { AssignTrainingRequest } from "@repo/shared-types/ssm";
import { useAssignTraining } from "../hooks/useAssignTraining";

const DEMO_EMPLOYEE_ID = import.meta.env.VITE_DEMO_EMPLOYEE_ID ?? "seed-demo-employee-e01";

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TrainingAssignForm() {
  const [form, setForm] = useState<AssignTrainingRequest>({
    employeeId: DEMO_EMPLOYEE_ID,
    trainingCode: "SSM-INTRO-2025",
    dueDate: new Date().toISOString()
  });
  const mutation = useAssignTraining();

  const dueLocal = useMemo(() => toDatetimeLocalValue(form.dueDate), [form.dueDate]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate(form);
  };

  return (
    <section className="card" aria-labelledby="assign-training-title">
      <h2 id="assign-training-title" className="card-title">
        Assign training
      </h2>
      <form onSubmit={onSubmit} className="form-stack">
        <div className="field">
          <label htmlFor="employee-id">Employee ID</label>
          <input
            id="employee-id"
            name="employeeId"
            autoComplete="off"
            placeholder={DEMO_EMPLOYEE_ID}
            value={form.employeeId}
            onChange={(event) => setForm((current) => ({ ...current, employeeId: event.target.value }))}
          />
          <p className="field-hint">
            Use a real employee ID for your tenant. After <code>pnpm --filter @apps/api prisma:seed</code>, demo ID is{" "}
            <code>{DEMO_EMPLOYEE_ID}</code> on <code>e01</code>.
          </p>
        </div>
        <div className="field">
          <label htmlFor="training-code">Training code</label>
          <input
            id="training-code"
            name="trainingCode"
            autoComplete="off"
            placeholder="e.g. SSM-INTRO-2025"
            value={form.trainingCode}
            onChange={(event) => setForm((current) => ({ ...current, trainingCode: event.target.value }))}
          />
        </div>
        <div className="field">
          <label htmlFor="due-date">Due date</label>
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
        <button type="submit" className="btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? "Assigning…" : "Assign training"}
        </button>
        {mutation.isSuccess ? (
          <p className="feedback success" role="status">
            Training assigned. Assignment ID: <strong>{mutation.data.assignmentId}</strong>
          </p>
        ) : null}
        {mutation.isError ? (
          <p className="feedback error" role="alert">
            {mutation.error instanceof Error ? mutation.error.message : "Unexpected error"}
          </p>
        ) : null}
      </form>
    </section>
  );
}
