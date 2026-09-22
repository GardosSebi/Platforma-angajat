import { useState } from "react";
import type { SurveyQuestion, SurveyQuestionType } from "@repo/shared-types/surveys";
import {
  SURVEY_QUESTION_TYPE_LABELS,
  SURVEY_QUESTION_TYPES,
  surveyQuestionNeedsOptions,
  surveyQuestionNeedsRange
} from "@repo/shared-types/surveys";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { surveysApi } from "../api/surveys.api";
import type { QuestionFormState } from "../survey-question-factory";
import { SurveyOptionImage } from "./SurveyOptionImage";

type Props = {
  questionForm: QuestionFormState;
  onQuestionChange: (patch: Partial<QuestionFormState>) => void;
  onUpdateOption: (index: number, label: string) => void;
  onUpdateOptionImageUrl: (index: number, imageUrl: string) => void;
  onAddOption: () => void;
  onRemoveOption: (index: number) => void;
};

export function SurveyQuestionEditor({
  questionForm,
  onQuestionChange,
  onUpdateOption,
  onUpdateOptionImageUrl,
  onAddOption,
  onRemoveOption
}: Props) {
  const needsOptions = surveyQuestionNeedsOptions(questionForm.type);
  const needsRange = surveyQuestionNeedsRange(questionForm.type);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const uploadOptionImage = async (index: number, file: File | undefined) => {
    if (!file) return;
    setUploadError(null);
    setUploadingIndex(index);
    try {
      const uploaded = await surveysApi.uploadOptionImage(file);
      onUpdateOptionImageUrl(index, uploaded.path);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Încărcarea imaginii a eșuat.");
    } finally {
      setUploadingIndex(null);
    }
  };

  return (
    <div className="survey-q-editor">
      <div className="comms-form-row">
        <FieldSelect
          id={`question-type-${questionForm.id}`}
          label="Tip întrebare"
          value={questionForm.type}
          onChange={(type) => onQuestionChange({ type: type as SurveyQuestionType })}
          options={SURVEY_QUESTION_TYPES.map((type) => ({
            value: type,
            label: SURVEY_QUESTION_TYPE_LABELS[type]
          }))}
        />
        <div className="field">
          <label htmlFor={`question-title-${questionForm.id}`}>Text întrebare</label>
          <input
            id={`question-title-${questionForm.id}`}
            value={questionForm.title}
            onChange={(event) => onQuestionChange({ title: event.target.value })}
            placeholder="Scrie întrebarea..."
          />
        </div>
        <div className="field">
          <label htmlFor={`question-title-en-${questionForm.id}`}>Traducere EN</label>
          <input
            id={`question-title-en-${questionForm.id}`}
            value={questionForm.titleEn}
            onChange={(event) => onQuestionChange({ titleEn: event.target.value })}
            placeholder="Question title in English..."
          />
        </div>
      </div>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={questionForm.required}
          onChange={(event) => onQuestionChange({ required: event.target.checked })}
        />
        <span>Întrebare obligatorie</span>
      </label>
      {needsRange ? (
        <div className="comms-form-row">
          <div className="field">
            <label htmlFor={`question-min-${questionForm.id}`}>
              {questionForm.type === "RATING_NPS" ? "Minim NPS" : "Minim"}
            </label>
            <input
              id={`question-min-${questionForm.id}`}
              type="number"
              value={questionForm.min}
              onChange={(event) => onQuestionChange({ min: Number(event.target.value) })}
            />
          </div>
          <div className="field">
            <label htmlFor={`question-max-${questionForm.id}`}>
              {questionForm.type === "RATING_NPS" ? "Maxim NPS" : "Maxim"}
            </label>
            <input
              id={`question-max-${questionForm.id}`}
              type="number"
              value={questionForm.max}
              onChange={(event) => onQuestionChange({ max: Number(event.target.value) })}
            />
          </div>
        </div>
      ) : null}
      {questionForm.type === "MULTI_TEXT" ? (
        <div className="field">
          <label htmlFor={`question-multi-text-${questionForm.id}`}>Număr casete text</label>
          <input
            id={`question-multi-text-${questionForm.id}`}
            type="number"
            min={1}
            max={20}
            value={questionForm.multiTextCount}
            onChange={(event) =>
              onQuestionChange({ multiTextCount: Math.max(1, Number(event.target.value) || 1) })
            }
          />
        </div>
      ) : null}
      {needsOptions ? (
        <div className="field">
          <span className="field-label">Opțiuni de răspuns</span>
          <div className="survey-option-list">
            {questionForm.options.map((option, index) => (
              <div className="survey-option-row" key={`${questionForm.id}-option-${index}`}>
                <div className="survey-option-fields">
                  <input
                    aria-label={`Opțiunea ${index + 1}`}
                    value={option.label}
                    onChange={(event) => onUpdateOption(index, event.target.value)}
                    placeholder={`Opțiunea ${index + 1}`}
                  />
                  {questionForm.type === "IMAGE_SELECT" ? (
                    <div className="survey-option-image-editor">
                      <SurveyOptionImage
                        imageUrl={option.imageUrl}
                        alt={option.label || `Opțiunea ${index + 1}`}
                        className="survey-option-image-thumb"
                      />
                      <label className="btn-secondary btn-sm survey-option-upload">
                        {uploadingIndex === index ? "Se încarcă…" : option.imageUrl ? "Schimbă imaginea" : "Încarcă imagine"}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/webp"
                          hidden
                          disabled={uploadingIndex !== null}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.target.value = "";
                            void uploadOptionImage(index, file);
                          }}
                        />
                      </label>
                      {option.imageUrl ? (
                        <button
                          type="button"
                          className="btn-text btn-sm"
                          onClick={() => onUpdateOptionImageUrl(index, "")}
                        >
                          Scoate imaginea
                        </button>
                      ) : null}
                      <input
                        aria-label={`URL imagine opțiunea ${index + 1}`}
                        value={option.imageUrl ?? ""}
                        onChange={(event) => onUpdateOptionImageUrl(index, event.target.value)}
                        placeholder="sau lipește un URL"
                      />
                    </div>
                  ) : null}
                </div>
                <button type="button" className="btn-secondary btn-sm" onClick={() => onRemoveOption(index)}>
                  Șterge
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn-secondary survey-add-option" onClick={onAddOption}>
            + Opțiune
          </button>
          {questionForm.type === "IMAGE_SELECT" ? (
            <p className="field-hint">Încarcă JPEG, PNG, GIF sau WebP (max. 8 MB) pentru fiecare variantă.</p>
          ) : null}
          {uploadError ? <p className="feedback error">{uploadError}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export function SurveyQuestionMiniPreview({ question }: { question: SurveyQuestion }) {
  const options = question.options ?? [];
  if (question.type === "LONG_TEXT") {
    return <textarea disabled rows={2} placeholder="Răspuns lung..." />;
  }
  if (question.type === "TEXT" || question.type === "NUMBER" || question.type === "DATE") {
    return <input disabled placeholder={question.type === "DATE" ? "zz.ll.aaaa" : "Răspuns..."} />;
  }
  if (question.type === "BOOLEAN") {
    return (
      <div className="survey-mini-options">
        <label>
          <input type="radio" disabled /> Da
        </label>
        <label>
          <input type="radio" disabled /> Nu
        </label>
      </div>
    );
  }
  if (question.type === "SCALE" || question.type === "RATING_NPS") {
    const min = question.min ?? 0;
    const max = question.max ?? 5;
    const count = Math.max(2, Math.min(11, max - min + 1));
    return (
      <div className="survey-mini-scale">
        {Array.from({ length: count }, (_, index) => (
          <span key={index}>{min + index}</span>
        ))}
      </div>
    );
  }
  if (question.type === "FILE_UPLOAD") {
    return <button type="button" className="btn-secondary btn-sm" disabled>Încarcă fișier</button>;
  }
  if (question.type === "IMAGE_SELECT" && options.length) {
    return (
      <div className="survey-mini-images">
        {options.slice(0, 4).map((option) => (
          <span key={option.value} className="survey-mini-image">
            {option.imageUrl ? (
              <SurveyOptionImage imageUrl={option.imageUrl} alt={option.label} className="survey-option-image-thumb" />
            ) : null}
            <span>{option.label}</span>
          </span>
        ))}
      </div>
    );
  }
  if (options.length) {
    const inputType = question.type === "MULTIPLE_CHOICE" ? "checkbox" : "radio";
    return (
      <div className="survey-mini-options">
        {options.slice(0, 4).map((option) => (
          <label key={option.value}>
            <input type={inputType} disabled /> {option.label}
          </label>
        ))}
      </div>
    );
  }
  return <p className="field-hint">{SURVEY_QUESTION_TYPE_LABELS[question.type]}</p>;
}
