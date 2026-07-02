import { FormEvent } from "react";
import type { CreateHelpdeskTicketRequest, HelpdeskTicketPriority } from "@repo/shared-types/ticketing";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { mapToOptions } from "../../../shared/components/field-select-options";
import {
  CREATE_FORM_PRIORITIES,
  PRIORITY_LABELS,
  TICKET_CATEGORIES,
  TICKET_CATEGORY_LABELS,
  type TicketOperatorOption
} from "../ticketing-shared";

type EmployeeOption = { id: string; fullName: string };

type Props = {
  form: CreateHelpdeskTicketRequest;
  employees: EmployeeOption[];
  operators: TicketOperatorOption[];
  isPending: boolean;
  feedback: { type: "success" | "error"; message: string } | null;
  onChange: (patch: Partial<CreateHelpdeskTicketRequest>) => void;
  onReporterChange: (employeeId: string) => void;
  onOperatorChange: (operatorId: string) => void;
  onSubmit: (event: FormEvent) => void;
  onCancel: () => void;
};

export function TicketCreateForm({
  form,
  employees,
  operators,
  isPending,
  feedback,
  onChange,
  onReporterChange,
  onOperatorChange,
  onSubmit,
  onCancel
}: Props) {
  return (
    <form className="card form-stack comms-panel ticket-create-form" onSubmit={onSubmit}>
      <div className="comms-compose-head">
        <div>
          <h2 className="card-title">Înregistrare manuală</h2>
          <p className="comms-toolbar-hint">Înregistrează o solicitare primită telefonic, pe email sau la birou.</p>
        </div>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Înapoi la board
        </button>
      </div>

      <fieldset className="comms-fieldset">
        <legend>Solicitare</legend>
        <div className="field">
          <label htmlFor="ticket-title">Subiect *</label>
          <input
            id="ticket-title"
            value={form.title}
            onChange={(event) => onChange({ title: event.target.value })}
            placeholder="Ex: Cerere concediu aprilie"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="ticket-description">Descriere *</label>
          <textarea
            id="ticket-description"
            value={form.description}
            onChange={(event) => onChange({ description: event.target.value })}
            placeholder="Detalii: perioada, motiv, context..."
            rows={4}
            required
          />
        </div>
        <div className="comms-form-row">
          <FieldSelect
            id="ticket-category"
            label="Destinatar *"
            value={form.category ?? "HR"}
            onChange={(category) => onChange({ category })}
            options={TICKET_CATEGORIES.map((category) => ({
              value: category,
              label: TICKET_CATEGORY_LABELS[category]
            }))}
          />
          <FieldSelect
            id="ticket-priority"
            label="Prioritate"
            value={form.priority ?? "MEDIUM"}
            onChange={(priority) => onChange({ priority: priority as HelpdeskTicketPriority })}
            options={CREATE_FORM_PRIORITIES.map((priority) => ({
              value: priority,
              label: PRIORITY_LABELS[priority]
            }))}
          />
        </div>
      </fieldset>

      <details className="comms-advanced ticket-create-optional">
        <summary>Detalii opționale</summary>
        <div className="comms-form-row">
          <FieldSelect
            id="ticket-reporter"
            label="Solicitant (angajat)"
            value={form.reporterEmployeeId ?? ""}
            onChange={onReporterChange}
            allowEmpty
            emptyLabel="Nespecificat"
            options={mapToOptions(
              employees,
              (employee) => employee.id,
              (employee) => employee.fullName
            )}
          />
          <FieldSelect
            id="ticket-assignee"
            label="Operator"
            value={form.assignedToUserId ?? ""}
            onChange={onOperatorChange}
            allowEmpty
            emptyLabel="Neasignat — preia de pe board"
            options={mapToOptions(
              operators,
              (operator) => operator.id,
              (operator) => operator.name
            )}
          />
          <div className="field">
            <label htmlFor="ticket-due">Scadență</label>
            <input
              id="ticket-due"
              type="datetime-local"
              value={form.dueAt ?? ""}
              onChange={(event) => onChange({ dueAt: event.target.value })}
            />
          </div>
        </div>
      </details>

      <div className="comms-compose-actions">
        <button className="btn-primary" type="submit" disabled={isPending}>
          {isPending ? "Se înregistrează..." : "Înregistrează tichet"}
        </button>
      </div>

      {feedback ? (
        <div className={`feedback ${feedback.type}`} role={feedback.type === "error" ? "alert" : "status"}>
          {feedback.message}
        </div>
      ) : null}
    </form>
  );
}
