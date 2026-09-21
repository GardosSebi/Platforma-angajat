import { useState, type DragEvent } from "react";
import type { SurveyConditionalRule, SurveyQuestion, SurveyQuestionType } from "@repo/shared-types/surveys";
import { SURVEY_QUESTION_TYPE_LABELS } from "@repo/shared-types/surveys";
import { PALETTE_GROUPS } from "../survey-question-factory";
import type { QuestionFormState } from "./SurveyCreateForm";
import { SurveyFormFiller } from "./SurveyFormFiller";
import { SurveyQuestionEditor, SurveyQuestionMiniPreview } from "./SurveyQuestionEditor";

const PALETTE_MIME = "application/x-survey-palette";
const REORDER_MIME = "application/x-survey-reorder";

type Props = {
  surveyTitle: string;
  surveyDescription?: string | null;
  questions: SurveyQuestion[];
  questionForm: QuestionFormState;
  editingQuestionId: string | null;
  conditionalLogic: SurveyConditionalRule[];
  onInsertQuestion: (type: SurveyQuestionType, index?: number) => void;
  onReorderQuestions: (fromIndex: number, toIndex: number) => void;
  onSelectQuestion: (id: string) => void;
  onRemoveQuestion: (id: string) => void;
  onCancelQuestionEdit: () => void;
  onQuestionChange: (patch: Partial<QuestionFormState>) => void;
  onUpdateOption: (index: number, label: string) => void;
  onUpdateOptionImageUrl: (index: number, imageUrl: string) => void;
  onAddOption: () => void;
  onRemoveOption: (index: number) => void;
};

export function SurveyVisualCanvas({
  surveyTitle,
  surveyDescription,
  questions,
  questionForm,
  editingQuestionId,
  conditionalLogic,
  onInsertQuestion,
  onReorderQuestions,
  onSelectQuestion,
  onRemoveQuestion,
  onCancelQuestionEdit,
  onQuestionChange,
  onUpdateOption,
  onUpdateOptionImageUrl,
  onAddOption,
  onRemoveOption
}: Props) {
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const handlePaletteDragStart = (event: DragEvent<HTMLButtonElement>, type: SurveyQuestionType) => {
    event.dataTransfer.setData(PALETTE_MIME, type);
    event.dataTransfer.setData("text/plain", `palette:${type}`);
    event.dataTransfer.effectAllowed = "copy";
  };

  const handleCardDragStart = (event: DragEvent<HTMLElement>, id: string, index: number) => {
    event.dataTransfer.setData(REORDER_MIME, String(index));
    event.dataTransfer.setData("text/plain", `reorder:${index}`);
    event.dataTransfer.effectAllowed = "move";
    setDraggingId(id);
  };

  const parseDrop = (event: DragEvent) => {
    const customPalette = event.dataTransfer.getData(PALETTE_MIME);
    const customReorder = event.dataTransfer.getData(REORDER_MIME);
    const plain = event.dataTransfer.getData("text/plain");
    const paletteRaw = customPalette || (plain.startsWith("palette:") ? plain.slice("palette:".length) : "");
    if (paletteRaw) {
      return { kind: "palette" as const, type: paletteRaw as SurveyQuestionType };
    }
    const reorderRaw = customReorder || (plain.startsWith("reorder:") ? plain.slice("reorder:".length) : "");
    if (reorderRaw !== "") {
      return { kind: "reorder" as const, from: Number(reorderRaw) };
    }
    return null;
  };

  const onSlotDragOver = (event: DragEvent<HTMLElement>, index: number) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = draggingId ? "move" : "copy";
    setDropIndex(index);
  };

  const onSlotDrop = (event: DragEvent<HTMLElement>, index: number) => {
    event.preventDefault();
    const payload = parseDrop(event);
    setDropIndex(null);
    setDraggingId(null);
    if (!payload) return;
    if (payload.kind === "palette" && payload.type) {
      onInsertQuestion(payload.type, index);
      return;
    }
    if (payload.kind === "reorder" && Number.isFinite(payload.from)) {
      const from = payload.from;
      const to = from < index ? index - 1 : index;
      onReorderQuestions(from, to);
    }
  };

  const canvasEmpty = questions.length === 0;

  return (
    <div className="survey-visual-builder">
      <aside className="survey-palette" aria-label="Paletă tipuri de întrebări">
        <h3>Paletă</h3>
        <p className="field-hint">Trage pe canvas sau apasă pentru a adăuga.</p>
        {PALETTE_GROUPS.map((group) => (
          <div key={group.title} className="survey-palette-group">
            <p className="survey-palette-title">{group.title}</p>
            {group.types.map((type) => (
              <button
                key={type}
                type="button"
                className="survey-palette-item"
                draggable
                onDragStart={(event) => handlePaletteDragStart(event, type)}
                onClick={() => onInsertQuestion(type)}
              >
                {SURVEY_QUESTION_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        ))}
      </aside>

      <section className="survey-canvas" aria-label="Canvas chestionar">
        <div className="survey-canvas-head">
          <h3>Canvas</h3>
          <span className="field-hint">{questions.length} întrebări · drag pentru reordonare</span>
        </div>
        <div
          className={`survey-drop-slot${dropIndex === 0 ? " active" : ""}`}
          onDragOver={(event) => onSlotDragOver(event, 0)}
          onDragLeave={() => setDropIndex(null)}
          onDrop={(event) => onSlotDrop(event, 0)}
        />
        {canvasEmpty ? (
          <div
            className="survey-canvas-empty"
            onDragOver={(event) => onSlotDragOver(event, 0)}
            onDrop={(event) => onSlotDrop(event, 0)}
          >
            Trage un tip de întrebare aici pentru a începe chestionarul.
          </div>
        ) : null}
        {questions.map((question, index) => {
          const selected = editingQuestionId === question.id;
          return (
            <div key={question.id}>
              <article
                className={`survey-q-card${selected ? " selected" : ""}${draggingId === question.id ? " dragging" : ""}`}
                draggable
                onDragStart={(event) => handleCardDragStart(event, question.id, index)}
                onDragEnd={() => setDraggingId(null)}
              >
                <header className="survey-q-card-head">
                  <button
                    type="button"
                    className="survey-q-drag"
                    aria-label="Mută întrebarea"
                    title="Trage pentru reordonare"
                  >
                    ⋮⋮
                  </button>
                  <button
                    type="button"
                    className="survey-q-select"
                    onClick={() => onSelectQuestion(question.id)}
                  >
                    <strong>
                      {index + 1}. {question.title}
                      {question.required ? " *" : ""}
                    </strong>
                    <span>{SURVEY_QUESTION_TYPE_LABELS[question.type]}</span>
                  </button>
                  <div className="survey-question-actions">
                    <button type="button" className="btn-secondary btn-sm" onClick={() => onSelectQuestion(question.id)}>
                      {selected ? "Editează" : "Deschide"}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      disabled={index === 0}
                      onClick={() => onReorderQuestions(index, index - 1)}
                    >
                      Sus
                    </button>
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      disabled={index === questions.length - 1}
                      onClick={() => onReorderQuestions(index, index + 1)}
                    >
                      Jos
                    </button>
                    <button type="button" className="btn-secondary btn-sm" onClick={() => onRemoveQuestion(question.id)}>
                      Șterge
                    </button>
                  </div>
                </header>
                <div className="survey-q-card-preview">
                  <SurveyQuestionMiniPreview question={question} />
                </div>
                {selected ? (
                  <div className="survey-q-card-editor">
                    <SurveyQuestionEditor
                      questionForm={questionForm}
                      onQuestionChange={onQuestionChange}
                      onUpdateOption={onUpdateOption}
                      onUpdateOptionImageUrl={onUpdateOptionImageUrl}
                      onAddOption={onAddOption}
                      onRemoveOption={onRemoveOption}
                    />
                    <button type="button" className="btn-text" onClick={onCancelQuestionEdit}>
                      Închide editorul
                    </button>
                  </div>
                ) : null}
              </article>
              <div
                className={`survey-drop-slot${dropIndex === index + 1 ? " active" : ""}`}
                onDragOver={(event) => onSlotDragOver(event, index + 1)}
                onDragLeave={() => setDropIndex(null)}
                onDrop={(event) => onSlotDrop(event, index + 1)}
              />
            </div>
          );
        })}
      </section>

      <aside className="survey-live-preview" aria-label="Previzualizare live">
        <h3>Previzualizare</h3>
        <p className="field-hint">Cum vede respondentul formularul. Nimic nu se salvează.</p>
        {questions.length ? (
          <SurveyFormFiller
            title={surveyTitle.trim() || "Sondaj fără titlu"}
            description={surveyDescription}
            questions={questions}
            conditionalLogic={conditionalLogic}
            onSubmit={async () => undefined}
            previewMode
          />
        ) : (
          <p className="field-hint">Adaugă întrebări pe canvas pentru previzualizare.</p>
        )}
      </aside>
    </div>
  );
}
