import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  title: string;
  titleId: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  /** Wider dialog for denser forms (e.g. employees). */
  size?: "default" | "wide";
};

export function MasterDataCreateModal({
  title,
  titleId,
  description,
  onClose,
  children,
  size = "default"
}: Props) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div className="md-create-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className={`md-create-modal card form-stack comms-panel${size === "wide" ? " md-create-modal--wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="md-create-modal-head">
          <div>
            <h2 id={titleId} className="card-title">
              {title}
            </h2>
            {description ? <p className="comms-toolbar-hint">{description}</p> : null}
          </div>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Închide
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
