import { FormEvent } from "react";
import type { CreateHelpdeskTicketFromEmailRequest } from "@repo/shared-types/ticketing";

type Props = {
  form: CreateHelpdeskTicketFromEmailRequest;
  isPending: boolean;
  feedback: { type: "success" | "error"; message: string } | null;
  onChange: (patch: Partial<CreateHelpdeskTicketFromEmailRequest>) => void;
  onSubmit: (event: FormEvent) => void;
};

export function TicketEmailForm({ form, isPending, feedback, onChange, onSubmit }: Props) {
  return (
    <form className="form-stack ticket-create-form" onSubmit={onSubmit}>
      <p className="comms-toolbar-hint">Creează un tichet pe baza unui mesaj email primit.</p>

      <fieldset className="comms-fieldset">
        <legend>Email</legend>
        <div className="comms-form-row">
          <div className="field">
            <label htmlFor="email-from">De la (email) *</label>
            <input
              id="email-from"
              type="email"
              value={form.fromEmail}
              onChange={(event) => onChange({ fromEmail: event.target.value })}
              placeholder="ex: angajat@companie.ro"
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="email-from-name">Nume expeditor</label>
            <input
              id="email-from-name"
              value={form.fromName ?? ""}
              onChange={(event) => onChange({ fromName: event.target.value })}
              placeholder="Nume afișat"
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="email-subject">Subiect *</label>
          <input
            id="email-subject"
            value={form.subject}
            onChange={(event) => onChange({ subject: event.target.value })}
            placeholder="Subiectul mesajului"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="email-body">Conținut *</label>
          <textarea
            id="email-body"
            value={form.body}
            onChange={(event) => onChange({ body: event.target.value })}
            placeholder="Corpul mesajului email..."
            rows={4}
            required
          />
        </div>
      </fieldset>

      <div className="comms-compose-actions">
        <button className="btn-primary" type="submit" disabled={isPending}>
          {isPending ? "Se înregistrează..." : "Înregistrează din email"}
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
