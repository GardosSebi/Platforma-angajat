import type { SsmTrainingTestQuestionInput } from "@repo/shared-types/ssm";

type Props = {
  value: SsmTrainingTestQuestionInput[];
  onChange: (next: SsmTrainingTestQuestionInput[]) => void;
};

function emptyQuestion(index: number): SsmTrainingTestQuestionInput {
  return {
    id: `CUSTOM-${Date.now()}-${index}`,
    text: "",
    options: ["", "", "", ""],
    correctIndex: 0
  };
}

export function TrainingTestQuestionsEditor({ value, onChange }: Props) {
  const questions = value.length ? value : [];

  const updateQuestion = (index: number, patch: Partial<SsmTrainingTestQuestionInput>) => {
    onChange(questions.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  };

  const updateOption = (questionIndex: number, optionIndex: number, text: string) => {
    onChange(
      questions.map((q, i) => {
        if (i !== questionIndex) return q;
        const options = [...q.options];
        options[optionIndex] = text;
        return { ...q, options };
      })
    );
  };

  return (
    <div className="ssm-test-editor">
      <div className="ssm-inline-actions">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => onChange([...questions, emptyQuestion(questions.length + 1)])}
        >
          Adaugă întrebare
        </button>
        {questions.length ? (
          <button type="button" className="btn-text-link" onClick={() => onChange([])}>
            Șterge toate (folosește banca default)
          </button>
        ) : null}
      </div>
      {!questions.length ? (
        <p className="field-hint">Fără întrebări personalizate — se folosesc întrebările implicite pe categorie.</p>
      ) : null}
      {questions.map((question, qIndex) => (
        <div key={question.id} className="ssm-test-editor-item">
          <div className="field">
            <label htmlFor={`tq-text-${qIndex}`}>Întrebarea {qIndex + 1}</label>
            <input
              id={`tq-text-${qIndex}`}
              value={question.text}
              onChange={(e) => updateQuestion(qIndex, { text: e.target.value })}
              placeholder="Textul întrebării"
            />
          </div>
          {question.options.map((option, oIndex) => (
            <div key={`${question.id}-opt-${oIndex}`} className="field ssm-test-option-row">
              <label>
                <input
                  type="radio"
                  name={`tq-correct-${question.id}`}
                  checked={question.correctIndex === oIndex}
                  onChange={() => updateQuestion(qIndex, { correctIndex: oIndex })}
                />{" "}
                Răspuns corect
              </label>
              <input
                value={option}
                onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                placeholder={`Varianta ${oIndex + 1}`}
              />
            </div>
          ))}
          <button
            type="button"
            className="btn-text-link"
            onClick={() => onChange(questions.filter((_, i) => i !== qIndex))}
          >
            Elimină întrebarea
          </button>
        </div>
      ))}
    </div>
  );
}
