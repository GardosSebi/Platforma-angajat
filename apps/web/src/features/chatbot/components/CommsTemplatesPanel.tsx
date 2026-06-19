import { FormEvent } from "react";
import type { CommunicationContentType, CreateCommunicationTemplateRequest } from "@repo/shared-types/communications";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { CONTENT_TYPE_LABELS, CONTENT_TYPES } from "../comms-shared";

type Props = {
  form: CreateCommunicationTemplateRequest;
  templateCount: number;
  isPending: boolean;
  feedback: { type: "success" | "error"; message: string } | null;
  onChange: (patch: Partial<CreateCommunicationTemplateRequest>) => void;
  onSubmit: (event: FormEvent) => void;
};

export function CommsTemplatesPanel({ form, templateCount, isPending, feedback, onChange, onSubmit }: Props) {
  return (
    <form className="card form-stack comms-panel" onSubmit={onSubmit}>
      <h2 className="card-title">Șabloane reutilizabile</h2>
      <p className="comms-toolbar-hint">
        Salvează mesaje frecvente ca șabloane. Le poți aplica rapid la crearea unui anunț nou. ({templateCount}{" "}
        salvate)
      </p>

      <div className="comms-form-row">
        <div className="field">
          <label htmlFor="template-name">Nume șablon *</label>
          <input
            id="template-name"
            value={form.name}
            onChange={(event) => onChange({ name: event.target.value })}
            placeholder="Ex: Document nou SSM"
            required
          />
        </div>
        <FieldSelect
          id="template-content-type"
          label="Tip conținut"
          value={form.contentType ?? "TEXT"}
          onChange={(contentType) => onChange({ contentType: contentType as CommunicationContentType })}
          options={CONTENT_TYPES.map((type) => ({
            value: type,
            label: CONTENT_TYPE_LABELS[type]
          }))}
        />
      </div>
      <div className="field">
        <label htmlFor="template-title">Titlu implicit *</label>
        <input
          id="template-title"
          value={form.title}
          onChange={(event) => onChange({ title: event.target.value })}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="template-body">Mesaj implicit *</label>
        <textarea
          id="template-body"
          value={form.body}
          onChange={(event) => onChange({ body: event.target.value })}
          rows={4}
          required
        />
      </div>
      <button className="btn-primary" type="submit" disabled={isPending}>
        {isPending ? "Se salvează..." : "Salvează șablon"}
      </button>
      {feedback ? (
        <div className={`feedback ${feedback.type}`} role={feedback.type === "error" ? "alert" : "status"}>
          {feedback.message}
        </div>
      ) : null}
    </form>
  );
}
