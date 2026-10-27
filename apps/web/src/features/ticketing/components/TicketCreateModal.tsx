import { useEffect, useState, type ReactNode } from "react";

type CreateMode = "manual" | "email";

type Props = {
  manualForm: ReactNode;
  emailForm: ReactNode;
  onClose: () => void;
};

export function TicketCreateModal({ manualForm, emailForm, onClose }: Props) {
  const [mode, setMode] = useState<CreateMode>("manual");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="ticket-detail-backdrop" role="presentation" onClick={onClose}>
      <div
        className="ticket-detail-modal comms-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ticket-create-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="comms-compose-head">
          <div>
            <h2 id="ticket-create-title" className="card-title">
              Adaugă tichet
            </h2>
          </div>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Închide
          </button>
        </div>

        <nav className="comms-tabs" aria-label="Tip înregistrare">
          <button
            type="button"
            className={`comms-tab${mode === "manual" ? " active" : ""}`}
            onClick={() => setMode("manual")}
          >
            Solicitare
          </button>
          <button
            type="button"
            className={`comms-tab${mode === "email" ? " active" : ""}`}
            onClick={() => setMode("email")}
          >
            Din email
          </button>
        </nav>

        {mode === "manual" ? manualForm : emailForm}
      </div>
    </div>
  );
}
