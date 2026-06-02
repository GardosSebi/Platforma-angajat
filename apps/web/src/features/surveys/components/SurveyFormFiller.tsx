import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  SurveyAnswerValue,
  SurveyConditionalRule,
  SurveyQuestion,
  SurveyQuestionType
} from "@repo/shared-types/surveys";
import { SurveyThankYou } from "./SurveyThankYou";

const TYPE_LABELS: Record<SurveyQuestionType, string> = {
  SINGLE_CHOICE: "Alegere unică",
  MULTIPLE_CHOICE: "Alegere multiplă",
  SCALE: "Scală",
  TEXT: "Text scurt",
  LONG_TEXT: "Text lung",
  DATE: "Dată",
  BOOLEAN: "Da / Nu"
};

function equalsAnswer(answer: SurveyAnswerValue, value: SurveyAnswerValue): boolean {
  if (Array.isArray(answer) && !Array.isArray(value)) {
    return answer.length === 1 && answer[0] === value;
  }
  if (Array.isArray(answer) && Array.isArray(value)) {
    const a = [...answer].map(String).sort().join("\0");
    const b = [...value].map(String).sort().join("\0");
    return a === b;
  }
  return answer === value;
}

function ruleMatches(operator: SurveyConditionalRule["operator"], answer: SurveyAnswerValue | undefined, value: SurveyAnswerValue): boolean {
  if (answer === undefined || answer === null) return false;
  switch (operator) {
    case "EQUALS":
      return equalsAnswer(answer, value);
    case "NOT_EQUALS":
      return !equalsAnswer(answer, value);
    case "INCLUDES": {
      const needle = String(value);
      if (Array.isArray(answer)) return answer.map(String).includes(needle);
      if (typeof answer === "string") return answer.includes(needle);
      return false;
    }
    case "GREATER_THAN":
      return typeof answer === "number" && typeof value === "number" && answer > value;
    case "LESS_THAN":
      return typeof answer === "number" && typeof value === "number" && answer < value;
    default:
      return false;
  }
}

function visibleQuestionIds(questions: SurveyQuestion[], rules: SurveyConditionalRule[] | null | undefined, answers: Record<string, SurveyAnswerValue>): Set<string> {
  const ids = new Set(questions.map((q) => q.id));
  const conditionalTargets = new Set<string>();
  for (const rule of rules ?? []) {
    if (ids.has(rule.showQuestionId)) conditionalTargets.add(rule.showQuestionId);
  }
  const visible = new Set<string>();
  for (const q of questions) {
    if (!conditionalTargets.has(q.id)) visible.add(q.id);
  }
  for (const rule of rules ?? []) {
    if (!ids.has(rule.questionId) || !ids.has(rule.showQuestionId)) continue;
    if (ruleMatches(rule.operator, answers[rule.questionId], rule.value)) {
      visible.add(rule.showQuestionId);
    }
  }
  return visible;
}

function isAnswerEmpty(value: SurveyAnswerValue | undefined): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export interface SurveyFormFillerProps {
  title: string;
  description?: string | null;
  questions: SurveyQuestion[];
  conditionalLogic?: SurveyConditionalRule[] | null;
  onSubmit: (answers: Record<string, SurveyAnswerValue>) => Promise<void>;
  submitLabel?: string;
  thanksFooter?: ReactNode;
}

export function SurveyFormFiller({
  title,
  description,
  questions,
  conditionalLogic,
  onSubmit,
  submitLabel = "Trimite răspunsurile",
  thanksFooter
}: SurveyFormFillerProps) {
  const [answers, setAnswers] = useState<Record<string, SurveyAnswerValue>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setAnswers((prev) => {
      const next = { ...prev };
      for (const q of questions) {
        if (q.type === "SCALE" && next[q.id] === undefined) {
          next[q.id] = q.min ?? 1;
        }
      }
      return next;
    });
  }, [questions]);

  const visible = useMemo(() => visibleQuestionIds(questions, conditionalLogic, answers), [questions, conditionalLogic, answers]);

  const setAnswer = (id: string, value: SurveyAnswerValue) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const toggleMulti = (id: string, optionValue: string, checked: boolean) => {
    setAnswers((prev) => {
      const current = Array.isArray(prev[id]) ? [...(prev[id] as string[])] : [];
      const next = checked ? [...current, optionValue] : current.filter((v) => v !== optionValue);
      return { ...prev, [id]: next };
    });
  };

  const validate = (): string | null => {
    for (const q of questions) {
      if (!visible.has(q.id)) continue;
      if (!q.required) continue;
      if (isAnswerEmpty(answers[q.id])) {
        return `Completați întrebarea obligatorie: „${q.title}”.`;
      }
    }
    return null;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    const payload: Record<string, SurveyAnswerValue> = {};
    for (const q of questions) {
      if (!visible.has(q.id)) continue;
      const value = answers[q.id];
      if (!isAnswerEmpty(value)) payload[q.id] = value as SurveyAnswerValue;
    }
    setPending(true);
    try {
      await onSubmit(payload);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Trimiterea a eșuat.");
    } finally {
      setPending(false);
    }
  };

  if (done) {
    return <SurveyThankYou footer={thanksFooter} />;
  }

  return (
    <form className="card form-stack survey-fill-form" onSubmit={(e) => void handleSubmit(e)}>
      <header className="survey-fill-header">
        <h1 className="survey-fill-title">{title}</h1>
        {description ? (
          <p className="survey-fill-desc" style={{ whiteSpace: "pre-wrap" }}>
            {description}
          </p>
        ) : null}
      </header>

      {questions.map((q) => {
        if (!visible.has(q.id)) return null;
        const minScale = q.min ?? 1;
        const maxScale = q.max ?? 5;

        return (
          <fieldset key={q.id} className="survey-question-fieldset">
            <legend className="survey-question-legend">
              {q.title}
              {q.required ? <span className="survey-required"> *</span> : null}
              <span className="survey-type-hint">{TYPE_LABELS[q.type]}</span>
            </legend>

            {q.type === "SINGLE_CHOICE" && q.options ? (
              <div className="survey-options-vertical">
                {q.options.map((opt) => (
                  <label key={opt.value} className="survey-option-label">
                    <input
                      type="radio"
                      name={q.id}
                      value={opt.value}
                      checked={answers[q.id] === opt.value}
                      onChange={() => setAnswer(q.id, opt.value)}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            ) : null}

            {q.type === "MULTIPLE_CHOICE" && q.options ? (
              <div className="survey-options-vertical">
                {q.options.map((opt) => {
                  const selected = Array.isArray(answers[q.id]) && (answers[q.id] as string[]).includes(opt.value);
                  return (
                    <label key={opt.value} className="survey-option-label">
                      <input type="checkbox" checked={selected} onChange={(ev) => toggleMulti(q.id, opt.value, ev.target.checked)} />
                      <span>{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            ) : null}

            {q.type === "BOOLEAN" ? (
              <div className="survey-options-vertical">
                <label className="survey-option-label">
                  <input type="radio" name={q.id} checked={answers[q.id] === true} onChange={() => setAnswer(q.id, true)} />
                  <span>Da</span>
                </label>
                <label className="survey-option-label">
                  <input type="radio" name={q.id} checked={answers[q.id] === false} onChange={() => setAnswer(q.id, false)} />
                  <span>Nu</span>
                </label>
              </div>
            ) : null}

            {q.type === "SCALE" ? (
              <div className="field">
                <input
                  type="range"
                  min={minScale}
                  max={maxScale}
                  step={1}
                  value={typeof answers[q.id] === "number" ? (answers[q.id] as number) : minScale}
                  onChange={(ev) => setAnswer(q.id, Number(ev.target.value))}
                />
                <div className="field-hint">
                  Valoare: {typeof answers[q.id] === "number" ? answers[q.id] : minScale} ({minScale}–{maxScale})
                </div>
              </div>
            ) : null}

            {q.type === "TEXT" ? (
              <input className="survey-text-input" type="text" value={typeof answers[q.id] === "string" ? (answers[q.id] as string) : ""} onChange={(ev) => setAnswer(q.id, ev.target.value)} />
            ) : null}

            {q.type === "LONG_TEXT" ? (
              <textarea className="survey-textarea" rows={4} value={typeof answers[q.id] === "string" ? (answers[q.id] as string) : ""} onChange={(ev) => setAnswer(q.id, ev.target.value)} />
            ) : null}

            {q.type === "DATE" ? (
              <input type="date" value={typeof answers[q.id] === "string" ? (answers[q.id] as string) : ""} onChange={(ev) => setAnswer(q.id, ev.target.value)} />
            ) : null}
          </fieldset>
        );
      })}

      {error ? (
        <p className="feedback error" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Se trimite…" : submitLabel}
      </button>
    </form>
  );
}
