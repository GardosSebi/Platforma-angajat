import type { ReactNode } from "react";

export function SurveyThankYou({ footer }: { footer?: ReactNode }) {
  return (
    <div className="survey-fill-thanks card" role="status">
      <h2 className="card-title">Mulțumim</h2>
      <p className="field-hint">Vă mulțumim pentru că ați completat chestionarul.</p>
      {footer}
    </div>
  );
}
