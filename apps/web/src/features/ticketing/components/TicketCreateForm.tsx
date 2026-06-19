import { FormEvent } from "react";
import type { CreateHelpdeskTicketRequest, HelpdeskTicketPriority, HelpdeskTicketSource } from "@repo/shared-types/ticketing";
import { HELPDESK_TICKET_PRIORITIES, HELPDESK_TICKET_SOURCES } from "@repo/shared-types/ticketing";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { mapToOptions } from "../../../shared/components/field-select-options";
import { PRIORITY_LABELS, SOURCE_LABELS, TICKET_CATEGORIES } from "../ticketing-shared";

type EmployeeOption = { id: string; fullName: string };

type Props = {
  form: CreateHelpdeskTicketRequest;
  employees: EmployeeOption[];
  isPending: boolean;
  feedback: { type: "success" | "error"; message: string } | null;
  onChange: (patch: Partial<CreateHelpdeskTicketRequest>) => void;
  onReporterChange: (employeeId: string) => void;
  onSubmit: (event: FormEvent) => void;
  onCancel: () => void;
};

export function TicketCreateForm({
  form,
  employees,
  isPending,
  feedback,
  onChange,
  onReporterChange,
  onSubmit,
  onCancel
}: Props) {
  return (
    <form className="card form-stack comms-panel ticket-create-form" onSubmit={onSubmit}>
      <div className="comms-compose-head">
        <div>
          <h2 className="card-title">Tichet nou</h2>
          <p className="comms-toolbar-hint">Descrie solicitarea, alege prioritatea și salvează.</p>
        </div>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Înapoi la board
        </button>
      </div>

      <fieldset className="comms-fieldset">
        <legend>1. Solicitare</legend>
        <div className="field">
          <label htmlFor="ticket-title">Titlu *</label>
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
            placeholder="Detalii: perioada, motiv, date de contact..."
            rows={4}
            required
          />
        </div>
        <div className="comms-form-row">
          <div className="field">
            <label htmlFor="ticket-category">Categorie</label>
            <input
              id="ticket-category"
              list="ticket-category-options"
              value={form.category ?? ""}
              onChange={(event) => onChange({ category: event.target.value })}
              placeholder="HR, IT, CONCEDIU..."
            />
            <datalist id="ticket-category-options">
              {TICKET_CATEGORIES.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
          </div>
          <FieldSelect
            id="ticket-priority"
            label="Prioritate"
            value={form.priority ?? "MEDIUM"}
            onChange={(priority) => onChange({ priority: priority as HelpdeskTicketPriority })}
            options={HELPDESK_TICKET_PRIORITIES.map((priority) => ({
              value: priority,
              label: PRIORITY_LABELS[priority]
            }))}
          />
        </div>
      </fieldset>

      <fieldset className="comms-fieldset">
        <legend>2. Detalii opționale</legend>
        <div className="comms-form-row">
          <FieldSelect
            id="ticket-source"
            label="Sursă"
            value={form.source ?? "PORTAL"}
            onChange={(source) => onChange({ source: source as HelpdeskTicketSource })}
            options={HELPDESK_TICKET_SOURCES.map((source) => ({
              value: source,
              label: SOURCE_LABELS[source]
            }))}
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
        <div className="comms-form-row">
          <FieldSelect
            id="ticket-reporter"
            label="Solicitant angajat"
            value={form.reporterEmployeeId ?? ""}
            onChange={onReporterChange}
            allowEmpty
            emptyLabel="Fără angajat"
            options={mapToOptions(
              employees,
              (employee) => employee.id,
              (employee) => employee.fullName
            )}
          />
          <div className="field">
            <label htmlFor="ticket-assignee">Operator ID</label>
            <input
              id="ticket-assignee"
              value={form.assignedToUserId ?? ""}
              onChange={(event) => onChange({ assignedToUserId: event.target.value })}
              placeholder="userId opțional"
            />
          </div>
        </div>
        <details className="comms-advanced">
          <summary>Câmpuri avansate</summary>
          <div className="field">
            <label htmlFor="ticket-survey-response">Răspuns sondaj sursă</label>
            <input
              id="ticket-survey-response"
              value={form.sourceSurveyResponseId ?? ""}
              onChange={(event) =>
                onChange({
                  sourceSurveyResponseId: event.target.value,
                  source: event.target.value ? "SURVEY" : form.source
                })
              }
              placeholder="surveyResponseId opțional"
            />
          </div>
        </details>
      </fieldset>

      <div className="comms-compose-actions">
        <button className="btn-primary" type="submit" disabled={isPending}>
          {isPending ? "Se salvează..." : "Creează tichet"}
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
