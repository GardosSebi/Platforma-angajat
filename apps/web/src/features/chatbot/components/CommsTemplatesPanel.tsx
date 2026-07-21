import { FormEvent } from "react";
import type {
  CommunicationContentType,
  CommunicationTemplateItem,
  CreateCommunicationTemplateRequest
} from "@repo/shared-types/communications";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { CONTENT_TYPE_LABELS, CONTENT_TYPES } from "../comms-shared";

type Props = {
  templates: CommunicationTemplateItem[];
  form: CreateCommunicationTemplateRequest;
  isPending: boolean;
  feedback: { type: "success" | "error"; message: string } | null;
  onChange: (patch: Partial<CreateCommunicationTemplateRequest>) => void;
  onSubmit: (event: FormEvent) => void;
  editingId: string | null;
  onEdit: (template: CommunicationTemplateItem) => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
};

export function CommsTemplatesPanel({
  templates,
  form,
  isPending,
  feedback,
  onChange,
  onSubmit,
  editingId,
  onEdit,
  onCancelEdit,
  onDelete
}: Props) {
  return (
    <div className="form-stack">
      <div className="card form-stack comms-panel">
        <h2 className="card-title">Șabloane reutilizabile</h2>
        <p className="comms-toolbar-hint">
          {templates.length === 0
            ? "Nu există șabloane. Salvează mesaje frecvente pentru a le aplica rapid la anunțuri noi."
            : `${templates.length} șablon${templates.length === 1 ? "" : "e"} salvate. Editează sau șterge din listă.`}
        </p>

        {templates.length > 0 ? (
          <ul className="list-plain">
            {templates.map((template) => (
              <li key={template.id} className="list-row">
                <div>
                  <strong>{template.name}</strong>
                  <span className="muted"> — {template.title}</span>
                </div>
                <div className="comms-row-actions">
                  <button type="button" className="btn-secondary btn-sm" onClick={() => onEdit(template)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-sm btn-danger"
                    onClick={() => onDelete(template.id)}
                    disabled={isPending}
                  >
                    Șterge
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <form className="card form-stack comms-panel" onSubmit={onSubmit}>
        <div className="comms-compose-head">
          <h3 className="card-title">{editingId ? "Editează șablon" : "Șablon nou"}</h3>
          {editingId ? (
            <button type="button" className="btn-secondary" onClick={onCancelEdit}>
              Anulează editarea
            </button>
          ) : null}
        </div>

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
          {isPending ? "Se salvează..." : editingId ? "Salvează modificările" : "Salvează șablon"}
        </button>
        {feedback ? (
          <div className={`feedback ${feedback.type}`} role={feedback.type === "error" ? "alert" : "status"}>
            {feedback.message}
          </div>
        ) : null}
      </form>
    </div>
  );
}
