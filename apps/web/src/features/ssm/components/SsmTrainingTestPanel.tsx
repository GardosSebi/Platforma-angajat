import { FormEvent, useEffect, useState } from "react";
import type { SsmTrainingTestQuestionPublic } from "@repo/shared-types/ssm-training-test";
import { SSM_TRAINING_PASS_THRESHOLD_PERCENT } from "@repo/shared-types/ssm-training-test";

type Props = {
  questions: SsmTrainingTestQuestionPublic[];
  passThresholdPercent?: number;
  disabled?: boolean;
  isSubmitting?: boolean;
  result?: { score: number; passed: boolean; correctCount: number; totalCount: number } | null;
  onSubmit: (answers: Record<string, number>) => void;
};

export function SsmTrainingTestPanel({
  questions,
  passThresholdPercent = SSM_TRAINING_PASS_THRESHOLD_PERCENT,
  disabled = false,
  isSubmitting = false,
  result,
  onSubmit
}: Props) {
  const [answers, setAnswers] = useState<Record<string, number>>({});

  useEffect(() => {
    setAnswers({});
  }, [questions]);

  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.id] != null);

  const onFormSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!allAnswered || disabled) return;
    onSubmit(answers);
  };

  if (!questions.length) {
    return <p className="field-hint">Se încarcă întrebările testului…</p>;
  }

  if (result) {
    return (
      <div className={`feedback ${result.passed ? "success" : "error"}`} role="status">
        <p>
          Scor: <strong>{result.score}%</strong> ({result.correctCount}/{result.totalCount} corecte). Prag promovare:{" "}
          {passThresholdPercent}%.
        </p>
        <p>{result.passed ? "Ai trecut testul. Poți continua cu semnătura." : "Nu ai atins pragul. Contactează responsabilul SSM."}</p>
      </div>
    );
  }

  return (
    <form className="form-stack employee-test-form" onSubmit={onFormSubmit}>
      <p className="field-hint">
        Răspunde la toate întrebările. Promovarea necesită minimum {passThresholdPercent}% răspunsuri corecte.
      </p>
      <ol className="ssm-test-questions">
        {questions.map((question, index) => (
          <li key={question.id} className="ssm-test-question">
            <fieldset>
              <legend>
                {index + 1}. {question.text}
              </legend>
              {question.options.map((option, optionIndex) => (
                <label key={`${question.id}-${optionIndex}`} className="inline-check ssm-test-option">
                  <input
                    type="radio"
                    name={question.id}
                    value={optionIndex}
                    checked={answers[question.id] === optionIndex}
                    disabled={disabled || isSubmitting}
                    onChange={() => setAnswers((prev) => ({ ...prev, [question.id]: optionIndex }))}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </fieldset>
          </li>
        ))}
      </ol>
      <button type="submit" className="btn-primary" disabled={!allAnswered || disabled || isSubmitting}>
        {isSubmitting ? "Se evaluează testul…" : "Trimite răspunsurile"}
      </button>
    </form>
  );
}
