import { FormEvent, useState } from "react";
import type {
  CommunicationAudienceType,
  CommunicationCategory,
  CommunicationContentType
} from "@repo/shared-types/communications";
import { COMMUNICATION_CATEGORIES, COMMUNICATION_CATEGORY_LABELS } from "@repo/shared-types/communications";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { mapToOptions } from "../../../shared/components/field-select-options";
import { chatbotApi } from "../api/chatbot.api";
import {
  AUDIENCE_LABELS,
  CONTENT_TYPE_LABELS,
  CONTENT_TYPES,
  MESSAGE_TYPE_LABELS,
  MESSAGE_TYPES,
  type AnnouncementFormFields
} from "../comms-shared";

export type AnnouncementFormState = AnnouncementFormFields;

type AudienceOption = { id: string; label: string };

type TemplateOption = { id: string; name: string };

type Props = {
  mode: "create" | "edit";
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
  surveyOptions?: Array<{ id: string; title: string }>;
  onSubmit: (event: FormEvent) => void;
  onCancel: () => void;
  onDelete?: () => void;
  canDelete?: boolean;
};

export function CommsAnnouncementForm({
  mode,
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
  onCancel,
  surveyOptions = [],
  onDelete,
  canDelete = false
}: Props) {
  const [uploadPending, setUploadPending] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const needsSegment = audienceOptions.length > 0;
  const needsCustomList = form.audienceType === "CUSTOM";
  const showLinkField =
    form.contentType === "LINK" ||
    form.contentType === "DOCUMENT" ||
    form.contentType === "IMAGE" ||
    form.contentType === "VIDEO" ||
    form.contentType === "SLIDE" ||
    Boolean(form.contentUrl);
  const showButtonFields = form.contentType === "BUTTON";
  const showSurveyLink = form.contentType === "SURVEY";
  const showMediaUpload =
    form.contentType === "DOCUMENT" ||
    form.contentType === "IMAGE" ||
    form.contentType === "VIDEO" ||
    form.contentType === "SLIDE";

  const onUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploadPending(true);
    setUploadError(null);
    try {
      const uploaded = await chatbotApi.uploadMedia(file);
      onChange({ contentUrl: uploaded.contentUrl });
    } catch (error: unknown) {
      setUploadError(error instanceof Error ? error.message : "Upload eșuat.");
    } finally {
      setUploadPending(false);
    }
  };

  return (
    <form className="card form-stack comms-panel comms-compose" onSubmit={onSubmit}>
      <div className="comms-compose-head">
        <div>
          <h2 className="card-title">{mode === "edit" ? "Editează anunț" : "Anunț nou"}</h2>
          <p className="comms-toolbar-hint">
            {mode === "edit"
              ? "Modifică mesajul sau destinatarii, apoi salvează."
              : "Completează mesajul, alege destinatarii, apoi salvează sau publică."}
          </p>
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
        <FieldSelect
          id="message-type"
          label="Tip mesaj"
          value={form.messageType ?? "ANNOUNCEMENT"}
          onChange={(messageType) =>
            onChange({
              messageType: messageType as AnnouncementFormState["messageType"],
              requireReadConfirmation: messageType === "READ_CONFIRMATION"
            })
          }
          options={MESSAGE_TYPES.map((type) => ({
            value: type,
            label: MESSAGE_TYPE_LABELS[type]
          }))}
        />
        {form.messageType === "QUESTION" ? (
          <p className="field-hint">
            Angajații vor putea trimite un răspuns text. Răspunsurile apar în detaliile anunțului.
          </p>
        ) : null}
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
        {form.contentType === "RICH_TEXT" ? (
          <div className="field">
            <label>Previzualizare text formatat</label>
            <div className="comms-rich-preview" dangerouslySetInnerHTML={{ __html: form.body.replace(/\n/g, "<br/>") }} />
          </div>
        ) : null}
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
        {showMediaUpload ? (
          <div className="field">
            <label htmlFor="content-file">Încarcă fișier (imagine, video, document, slide)</label>
            <input
              id="content-file"
              type="file"
              accept={
                form.contentType === "IMAGE"
                  ? "image/*"
                  : form.contentType === "VIDEO"
                    ? "video/*"
                    : form.contentType === "SLIDE"
                      ? ".pdf,.ppt,.pptx,application/pdf"
                      : undefined
              }
              disabled={uploadPending || isPending}
              onChange={(event) => {
                const file = event.target.files?.[0];
                void onUpload(file);
                event.target.value = "";
              }}
            />
            {uploadPending ? <p className="field-hint">Se încarcă…</p> : null}
            {uploadError ? <p className="feedback error">{uploadError}</p> : null}
            {form.contentUrl && !/^https?:\/\//i.test(form.contentUrl) ? (
              <p className="field-hint">Fișier încărcat: {form.contentUrl.split("/").pop()}</p>
            ) : null}
          </div>
        ) : null}
        {showLinkField ? (
          <div className="field">
            <label htmlFor="content-url">URL conținut (sau lasă gol dacă ai încărcat fișier)</label>
            <input
              id="content-url"
              value={form.contentUrl ?? ""}
              onChange={(event) => onChange({ contentUrl: event.target.value })}
              placeholder="https://... sau cale fișier încărcat"
            />
          </div>
        ) : null}
        {showButtonFields ? (
          <div className="comms-form-row">
            <div className="field">
              <label htmlFor="button-label">Etichetă buton</label>
              <input
                id="button-label"
                value={form.buttonLabel ?? ""}
                onChange={(event) => onChange({ buttonLabel: event.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="button-url">URL buton</label>
              <input
                id="button-url"
                value={form.buttonUrl ?? ""}
                onChange={(event) => onChange({ buttonUrl: event.target.value })}
              />
            </div>
          </div>
        ) : null}
        {showSurveyLink ? (
          <FieldSelect
            id="linked-survey"
            label="Sondaj integrat"
            value={form.linkedSurveyId ?? ""}
            onChange={(linkedSurveyId) => onChange({ linkedSurveyId: linkedSurveyId || undefined })}
            allowEmpty
            emptyLabel="Fără sondaj legat"
            options={mapToOptions(
              surveyOptions,
              (s) => s.id,
              (s) => s.title
            )}
          />
        ) : null}
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={form.reactionsEnabled ?? false}
            onChange={(e) => onChange({ reactionsEnabled: e.target.checked })}
          />
          Permite reacții (👍 ❤️ 👏 ✅)
        </label>
      </fieldset>

      <fieldset className="comms-fieldset">
        <legend>Traduceri (opțional)</legend>
        <p className="field-hint">
          Titlul și mesajul de mai sus sunt limba principală. Traducerile RO/EN sunt afișate angajaților după limba
          browserului; dacă lipsește o traducere, se folosește textul principal.
        </p>
        <div className="comms-form-row">
          <div className="field">
            <label htmlFor="tr-ro-title">Titlu RO</label>
            <input
              id="tr-ro-title"
              value={form.translationRoTitle}
              onChange={(event) => onChange({ translationRoTitle: event.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="tr-en-title">Titlu EN</label>
            <input
              id="tr-en-title"
              value={form.translationEnTitle}
              onChange={(event) => onChange({ translationEnTitle: event.target.value })}
            />
          </div>
        </div>
        <div className="comms-form-row">
          <div className="field">
            <label htmlFor="tr-ro-body">Mesaj RO</label>
            <textarea
              id="tr-ro-body"
              rows={2}
              value={form.translationRoBody}
              onChange={(event) => onChange({ translationRoBody: event.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="tr-en-body">Mesaj EN</label>
            <textarea
              id="tr-en-body"
              rows={2}
              value={form.translationEnBody}
              onChange={(event) => onChange({ translationEnBody: event.target.value })}
            />
          </div>
        </div>
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
              { value: "READY_TO_SEND", label: "Marchează gata de trimis" },
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
        <button className="btn-primary" type="submit" disabled={isPending || uploadPending}>
          {isPending
            ? "Se salvează..."
            : mode === "edit"
              ? "Salvează modificările"
              : form.status === "PUBLISHED"
                ? "Salvează și publică"
                : "Salvează anunț"}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Anulează
        </button>
        {mode === "edit" && canDelete && onDelete ? (
          <button type="button" className="btn-secondary comms-btn-danger" onClick={onDelete}>
            Șterge ciorna
          </button>
        ) : null}
      </div>

      {feedback ? (
        <div className={`feedback ${feedback.type}`} role={feedback.type === "error" ? "alert" : "status"}>
          {feedback.message}
        </div>
      ) : null}
    </form>
  );
}
