import type { SurveyQuestion, SurveyQuestionType } from "@repo/shared-types/surveys";
import {
  SURVEY_QUESTION_TYPE_LABELS,
  SURVEY_QUESTION_TYPES,
  surveyQuestionNeedsOptions,
  surveyQuestionNeedsRange
} from "@repo/shared-types/surveys";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import type { QuestionFormState } from "../survey-question-factory";

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
                    <input
                      aria-label={`URL imagine opțiunea ${index + 1}`}
                      value={option.imageUrl ?? ""}
                      onChange={(event) => onUpdateOptionImageUrl(index, event.target.value)}
                      placeholder="URL imagine"
                    />
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
