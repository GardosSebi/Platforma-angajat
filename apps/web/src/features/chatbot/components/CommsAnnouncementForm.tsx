import { FormEvent } from "react";
import type {
  CommunicationAudienceType,
  CommunicationCategory,
  CommunicationContentType,
  CreateCommunicationAnnouncementRequest
} from "@repo/shared-types/communications";
import { COMMUNICATION_CATEGORIES, COMMUNICATION_CATEGORY_LABELS } from "@repo/shared-types/communications";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { mapToOptions } from "../../../shared/components/field-select-options";
import { AUDIENCE_LABELS, CONTENT_TYPE_LABELS, CONTENT_TYPES } from "../comms-shared";

export type AnnouncementFormState = CreateCommunicationAnnouncementRequest & {
  targetEmployeeIdsCsv: string;
};

type AudienceOption = { id: string; label: string };

type TemplateOption = { id: string; name: string };

type Props = {
  form: AnnouncementFormState;
  templates: TemplateOption[];
  audienceTypes: CommunicationAudienceType[];
  audienceOptions: AudienceOption[];
  employeeNameHint: string;
  isPending: boolean;
  feedback: { type: "success" | "error"; message: string } | null;
  selectedTemplateId: string;
  onTemplateSelect: (templateId: string) => void;
  onChange: (patch: Partial<AnnouncementFormState>) => void;
  onAudienceRefChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onCancel: () => void;
};

export function CommsAnnouncementForm({
  form,
  templates,
  audienceTypes,
  audienceOptions,
  employeeNameHint,
  isPending,
  feedback,
  selectedTemplateId,
  onTemplateSelect,
  onChange,
  onAudienceRefChange,
  onSubmit,
  onCancel
}: Props) {
  const needsSegment = audienceOptions.length > 0;
  const needsCustomList = form.audienceType === "CUSTOM";
  const showLinkField = form.contentType === "LINK" || form.contentType === "DOCUMENT" || Boolean(form.contentUrl);

  return (
    <form className="card form-stack comms-panel comms-compose" onSubmit={onSubmit}>
      <div className="comms-compose-head">
        <div>
          <h2 className="card-title">Anunț nou</h2>
          <p className="comms-toolbar-hint">Completează mesajul, alege destinatarii, apoi salvează sau publică.</p>
        </div>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Înapoi la listă
        </button>
      </div>

      {templates.length > 0 ? (
        <FieldSelect
          id="template-select"
          label="Pornește de la un șablon (opțional)"
          value={selectedTemplateId}
          onChange={onTemplateSelect}
          allowEmpty
          emptyLabel="Anunț gol"
          options={mapToOptions(
            templates,
            (template) => template.id,
            (template) => template.name
          )}
        />
      ) : null}

      <fieldset className="comms-fieldset">
        <legend>1. Mesajul</legend>
        <FieldSelect
          id="announcement-category"
          label="Categorie"
          value={form.category ?? "GENERAL"}
          onChange={(category) => onChange({ category: category as CommunicationCategory })}
          options={COMMUNICATION_CATEGORIES.map((cat) => ({
            value: cat,
            label: COMMUNICATION_CATEGORY_LABELS[cat]
          }))}
        />
        <div className="field">
          <label htmlFor="announcement-title">Titlu *</label>
          <input
            id="announcement-title"
            value={form.title}
            onChange={(event) => onChange({ title: event.target.value })}
            placeholder="Ex: Instruire PSI — program aprilie"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="announcement-body">Mesaj *</label>
          <textarea
            id="announcement-body"
            value={form.body}
            onChange={(event) => onChange({ body: event.target.value })}
            placeholder="Scrie mesajul pe care îl vor vedea angajații..."
            rows={5}
            required
          />
        </div>
        <FieldSelect
          id="content-type"
          label="Tip conținut"
          value={form.contentType ?? "TEXT"}
          onChange={(contentType) => onChange({ contentType: contentType as CommunicationContentType })}
          options={CONTENT_TYPES.map((type) => ({
            value: type,
            label: CONTENT_TYPE_LABELS[type]
          }))}
        />
        {showLinkField ? (
          <div className="field">
            <label htmlFor="content-url">Link sau document</label>
            <input
              id="content-url"
              value={form.contentUrl ?? ""}
              onChange={(event) => onChange({ contentUrl: event.target.value })}
              placeholder="https://..."
            />
          </div>
        ) : null}
      </fieldset>

      <fieldset className="comms-fieldset">
        <legend>2. Cine primește</legend>
        <FieldSelect
          id="audience-type"
          label="Destinatari"
          value={form.audienceType ?? "ALL"}
          onChange={(audienceType) =>
            onChange({
              audienceType: audienceType as CommunicationAudienceType,
              audienceRefId: "",
              audienceLabel: ""
            })
          }
          options={audienceTypes.map((type) => ({
            value: type,
            label: AUDIENCE_LABELS[type]
          }))}
        />
        {needsSegment ? (
          <FieldSelect
            id="audience-ref"
            label="Selectează segmentul"
            value={form.audienceRefId ?? ""}
            onChange={onAudienceRefChange}
            allowEmpty
            emptyLabel="Alege din listă"
            options={mapToOptions(
              audienceOptions,
              (option) => option.id,
              (option) => option.label
            )}
          />
        ) : null}
        {needsCustomList ? (
          <div className="field">
            <label htmlFor="custom-employees">ID-uri angajați (separate prin virgulă)</label>
            <textarea
              id="custom-employees"
              value={form.targetEmployeeIdsCsv}
              onChange={(event) => onChange({ targetEmployeeIdsCsv: event.target.value })}
              placeholder="id1, id2, id3"
              rows={2}
            />
            {employeeNameHint ? <p className="field-hint">Exemple: {employeeNameHint}</p> : null}
          </div>
        ) : null}
      </fieldset>

      <details className="comms-advanced">
        <summary>3. Programare și publicare (opțional)</summary>
        <div className="comms-advanced-body">
          <FieldSelect
            id="announcement-status"
            label="La salvare"
            value={form.status ?? "DRAFT"}
            onChange={(status) => onChange({ status: status as "DRAFT" | "PUBLISHED" })}
            options={[
              { value: "DRAFT", label: "Salvează ca ciornă" },
              { value: "PUBLISHED", label: "Publică imediat" }
            ]}
          />
          <div className="comms-form-row">
            <div className="field">
              <label htmlFor="publish-at">Programează publicarea</label>
              <input
                id="publish-at"
                type="datetime-local"
                value={form.publishAt ?? ""}
                onChange={(event) => onChange({ publishAt: event.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="expires-at">Expiră la</label>
              <input
                id="expires-at"
                type="datetime-local"
                value={form.expiresAt ?? ""}
                onChange={(event) => onChange({ expiresAt: event.target.value })}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="reminder-at">Memento pentru necititori</label>
            <input
              id="reminder-at"
              type="datetime-local"
              value={form.reminderAt ?? ""}
              onChange={(event) => onChange({ reminderAt: event.target.value })}
            />
          </div>
        </div>
      </details>

      <div className="comms-form-actions">
        <button className="btn-primary" type="submit" disabled={isPending}>
          {isPending ? "Se salvează..." : form.status === "PUBLISHED" ? "Salvează și publică" : "Salvează anunț"}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Anulează
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
