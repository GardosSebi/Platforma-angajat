import { useEffect, useRef } from "react";

const PLACEHOLDERS: Array<{ key: string; label: string }> = [
  { key: "angajat", label: "Angajat" },
  { key: "post", label: "Post" },
  { key: "departament", label: "Departament" },
  { key: "entitate", label: "Entitate" },
  { key: "punctLucru", label: "Punct de lucru" },
  { key: "data", label: "Data" },
  { key: "titlu", label: "Titlu" }
];

type Props = {
  title: string;
  initialHtml: string;
  isPending: boolean;
  error?: string | null;
  onSave: (html: string) => void;
  onCancel: () => void;
};

function exec(command: string, value?: string) {
  document.execCommand(command, false, value);
}

export function WordTemplateEditor({ title, initialHtml, isPending, error, onSave, onCancel }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = initialHtml || "<p></p>";
    }
  }, [initialHtml]);

  const insertPlaceholder = (key: string) => {
    const token = `{{${key}}}`;
    editorRef.current?.focus();
    exec("insertText", token);
  };

  return (
    <div className="ssm-word-editor card form-stack">
      <div className="ssm-inline-actions" style={{ justifyContent: "space-between" }}>
        <div>
          <h4 className="card-title" style={{ margin: 0 }}>
            Editor Word — {title}
          </h4>
          <p className="field-hint" style={{ margin: "0.25rem 0 0" }}>
            Editează șablonul în platformă. Salvarea generează un fișier Word (.docx) cu versiune.
          </p>
        </div>
        <button type="button" className="btn-text" onClick={onCancel}>
          Închide
        </button>
      </div>

      <div className="ssm-word-toolbar" role="toolbar" aria-label="Formatare șablon Word">
        <button type="button" className="btn-secondary btn-sm" onClick={() => exec("bold")}>
          Bold
        </button>
        <button type="button" className="btn-secondary btn-sm" onClick={() => exec("italic")}>
          Italic
        </button>
        <button type="button" className="btn-secondary btn-sm" onClick={() => exec("underline")}>
          Subliniat
        </button>
        <button type="button" className="btn-secondary btn-sm" onClick={() => exec("formatBlock", "H1")}>
          H1
        </button>
        <button type="button" className="btn-secondary btn-sm" onClick={() => exec("formatBlock", "H2")}>
          H2
        </button>
        <button type="button" className="btn-secondary btn-sm" onClick={() => exec("formatBlock", "P")}>
          Paragraf
        </button>
        <button type="button" className="btn-secondary btn-sm" onClick={() => exec("insertUnorderedList")}>
          Listă
        </button>
        <label className="ssm-word-placeholder-select">
          <span className="visually-hidden">Inserează câmp</span>
          <select
            defaultValue=""
            onChange={(event) => {
              if (event.target.value) insertPlaceholder(event.target.value);
              event.target.value = "";
            }}
          >
            <option value="">Câmp dinamic…</option>
            {PLACEHOLDERS.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label} ({`{{${item.key}}}`})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        ref={editorRef}
        className="ssm-word-canvas"
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label="Conținut șablon Word"
        suppressContentEditableWarning
      />

      {error ? (
        <p className="feedback error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="ssm-inline-actions">
        <button
          type="button"
          className="btn-primary"
          disabled={isPending}
          onClick={() => onSave(editorRef.current?.innerHTML ?? "")}
        >
          {isPending ? "Se salvează…" : "Salvează Word"}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={isPending}>
          Anulează
        </button>
      </div>
    </div>
  );
}