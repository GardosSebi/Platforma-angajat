import { FormEvent } from "react";
import type {
  CreateSurveyRequest,
  SurveyAudienceType,
  SurveyQuestion,
  SurveyQuestionOption,
  SurveyQuestionType,
  SurveyType
} from "@repo/shared-types/surveys";
import {
  SURVEY_QUESTION_TYPE_LABELS,
  SURVEY_QUESTION_TYPES,
  SURVEY_TYPE_LABELS,
  SURVEY_TYPES,
  surveyQuestionNeedsOptions
} from "@repo/shared-types/surveys";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { mapToOptions } from "../../../shared/components/field-select-options";
import { AUDIENCE_LABELS, AUDIENCE_TYPES } from "../surveys-shared";

export type SurveyFormState = Omit<CreateSurveyRequest, "questionSchema" | "conditionalLogic" | "targetEmployeeIds"> & {
  targetEmployeeIdsCsv: string;
  closesAtInput: string;
};

export type QuestionFormState = {
  id: string;
  type: SurveyQuestionType;
  title: string;
  required: boolean;
  options: SurveyQuestionOption[];
  min: number;
  max: number;
};

type AudienceOption = { id: string; label: string };

type Props = {
  surveyForm: SurveyFormState;
  questionForm: QuestionFormState;
  questions: SurveyQuestion[];
  audienceOptions: AudienceOption[];
  canSave: boolean;
  isPending: boolean;
  feedback: { type: "success" | "error"; message: string } | null;
  onSurveyChange: (patch: Partial<SurveyFormState>) => void;
  onQuestionChange: (patch: Partial<QuestionFormState>) => void;
  onAudienceRefChange: (value: string) => void;
  onAddQuestion: () => void;
  onUpdateOption: (index: number, label: string) => void;
  onAddOption: () => void;
  onRemoveOption: (index: number) => void;
  onSubmit: (event: FormEvent) => void;
  onCancel: () => void;
};

export function SurveyCreateForm({
  surveyForm,
  questionForm,
  questions,
  audienceOptions,
  canSave,
  isPending,
  feedback,
  onSurveyChange,
  onQuestionChange,
  onAudienceRefChange,
  onAddQuestion,
  onUpdateOption,
  onAddOption,
  onRemoveOption,
  onSubmit,
  onCancel
}: Props) {
  const needsOptions = surveyQuestionNeedsOptions(questionForm.type);

  return (
    <form className="card form-stack comms-panel survey-create-form" onSubmit={onSubmit}>
      <div className="comms-compose-head">
        <div>
          <h2 className="card-title">Sondaj nou</h2>
          <p className="comms-toolbar-hint">Completează datele, adaugă întrebări, apoi salvează ca ciornă.</p>
        </div>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Înapoi la listă
        </button>
      </div>

      <fieldset className="comms-fieldset survey-section">
        <legend>1. Date sondaj</legend>
        <div className="field">
          <label htmlFor="survey-title">Titlu *</label>
          <input
            id="survey-title"
            value={surveyForm.title}
            onChange={(event) => onSurveyChange({ title: event.target.value })}
            placeholder="Ex: Sondaj satisfacție angajați Q2"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="survey-description">Descriere</label>
          <textarea
            id="survey-description"
            value={surveyForm.description ?? ""}
            onChange={(event) => onSurveyChange({ description: event.target.value })}
            placeholder="Scurtă descriere pentru participanți..."
            rows={3}
          />
        </div>
        <div className="comms-form-row">
          <FieldSelect
            id="survey-type"
            label="Tip sondaj"
            value={surveyForm.surveyType ?? "ENGAGEMENT"}
            onChange={(surveyType) => onSurveyChange({ surveyType: surveyType as SurveyType })}
            options={SURVEY_TYPES.map((type) => ({
              value: type,
              label: SURVEY_TYPE_LABELS[type]
            }))}
          />
          <div className="field">
            <label htmlFor="survey-closes">Închidere automată</label>
            <input
              id="survey-closes"
              type="date"
              value={surveyForm.closesAtInput}
              onChange={(event) => onSurveyChange({ closesAtInput: event.target.value })}
            />
          </div>
        </div>
        <div className="comms-form-row">
          <FieldSelect
            id="survey-audience"
            label="Destinatari"
            value={surveyForm.audienceType ?? "ALL"}
            onChange={(audienceType) =>
              onSurveyChange({
                audienceType: audienceType as SurveyAudienceType,
                audienceRefId: "",
                audienceLabel: ""
              })
            }
            options={AUDIENCE_TYPES.map((type) => ({
              value: type,
              label: AUDIENCE_LABELS[type]
            }))}
          />
          {audienceOptions.length > 0 ? (
            <FieldSelect
              id="survey-audience-ref"
              label="Segment"
              value={surveyForm.audienceRefId ?? ""}
              onChange={onAudienceRefChange}
              allowEmpty
              emptyLabel="Selectează segmentul"
              options={mapToOptions(
                audienceOptions,
                (option) => option.id,
                (option) => option.label
              )}
            />
          ) : null}
        </div>
        {surveyForm.audienceType === "CUSTOM" ? (
          <div className="field">
            <label htmlFor="survey-custom-employees">ID-uri angajați</label>
            <textarea
              id="survey-custom-employees"
              value={surveyForm.targetEmployeeIdsCsv}
              onChange={(event) => onSurveyChange({ targetEmployeeIdsCsv: event.target.value })}
              placeholder="idAngajat1, idAngajat2"
              rows={2}
            />
          </div>
        ) : null}
      </fieldset>

      <fieldset className="comms-fieldset survey-section">
        <legend>2. Întrebări ({questions.length} adăugate)</legend>
        <div className="comms-form-row">
          <FieldSelect
            id="question-type"
            label="Tip întrebare"
            value={questionForm.type}
            onChange={(type) => onQuestionChange({ type: type as SurveyQuestionType })}
            options={SURVEY_QUESTION_TYPES.map((type) => ({
              value: type,
              label: SURVEY_QUESTION_TYPE_LABELS[type]
            }))}
          />
          <div className="field">
            <label htmlFor="question-title">Întrebare</label>
            <input
              id="question-title"
              value={questionForm.title}
              onChange={(event) => onQuestionChange({ title: event.target.value })}
              placeholder="Scrie întrebarea..."
            />
          </div>
        </div>
        {needsOptions ? (
          <div className="field">
            <span className="field-label">Opțiuni de răspuns</span>
            <div className="survey-option-list">
              {questionForm.options.map((option, index) => (
                <div className="survey-option-row" key={`option-${index}`}>
                  <input
                    aria-label={`Opțiunea ${index + 1}`}
                    value={option.label}
                    onChange={(event) => onUpdateOption(index, event.target.value)}
                    placeholder={`Opțiunea ${index + 1}`}
                  />
                  <button type="button" className="btn-secondary btn-sm" onClick={() => onRemoveOption(index)}>
                    Șterge
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="btn-secondary survey-add-option" onClick={onAddOption}>
              + Opțiune
            </button>
          </div>
        ) : null}
        <button type="button" className="btn-secondary survey-add-question" onClick={onAddQuestion}>
          Adaugă întrebarea la listă
        </button>
        {questions.length > 0 ? (
          <ul className="survey-question-preview">
            {questions.map((question, index) => (
              <li key={question.id}>
                <strong>{index + 1}. {question.title}</strong>
                <span>{SURVEY_QUESTION_TYPE_LABELS[question.type]}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="field-hint">Poți salva direct cu întrebarea completată sau adaugă mai multe întrebări.</p>
        )}
      </fieldset>

      <div className="comms-compose-actions">
        <button className="btn-primary" type="submit" disabled={isPending || !canSave}>
          {isPending ? "Se salvează..." : "Salvează sondaj"}
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
