import { FormEvent, useState } from "react";
import type { AssignTrainingRequest } from "@repo/shared-types/ssm";
import { useAssignTraining } from "../hooks/useAssignTraining";

export function TrainingAssignForm() {
  const [form, setForm] = useState<AssignTrainingRequest>({
    employeeId: "",
    trainingCode: "",
    dueDate: new Date().toISOString()
  });
  const mutation = useAssignTraining();

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate(form);
  };

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 8, maxWidth: 360 }}>
      <input
        placeholder="Employee ID"
        value={form.employeeId}
        onChange={(event) => setForm((current) => ({ ...current, employeeId: event.target.value }))}
      />
      <input
        placeholder="Training code"
        value={form.trainingCode}
        onChange={(event) => setForm((current) => ({ ...current, trainingCode: event.target.value }))}
      />
      <input
        type="datetime-local"
        onChange={(event) =>
          setForm((current) => ({
            ...current,
            dueDate: new Date(event.target.value).toISOString()
          }))
        }
      />
      <button type="submit" disabled={mutation.isPending}>
        Assign training
      </button>
      {mutation.isSuccess ? <small>Assigned: {mutation.data.assignmentId}</small> : null}
      {mutation.isError ? <small>Request failed</small> : null}
    </form>
  );
}
