export type RiskBand = "low" | "medium" | "high" | "critical";

export function riskScore(probability: number, severity: number): number {
  return probability * severity;
}

export function riskBand(score: number): RiskBand {
  if (score <= 4) return "low";
  if (score <= 9) return "medium";
  if (score <= 16) return "high";
  return "critical";
}

const PROBABILITY_LABELS: Record<number, string> = {
  5: "Foarte probabil",
  4: "Probabil",
  3: "Moderat",
  2: "Puțin probabil",
  1: "Improbabil"
};

const SEVERITY_LABELS: Record<number, string> = {
  1: "Neglijabil",
  2: "Minor",
  3: "Moderat",
  4: "Major",
  5: "Catastrofal"
};

const LEGEND: Array<{ band: RiskBand; label: string; range: string }> = [
  { band: "low", label: "Scăzut", range: "1–4" },
  { band: "medium", label: "Mediu", range: "5–9" },
  { band: "high", label: "Ridicat", range: "10–16" },
  { band: "critical", label: "Critic", range: "17–25" }
];

export interface RiskMatrixPickerProps {
  probability: number;
  severity: number;
  onChange: (probability: number, severity: number, riskLevel: number) => void;
  id?: string;
}

export function RiskMatrixPicker({ probability, severity, onChange, id = "risk-matrix" }: RiskMatrixPickerProps) {
  const selectedScore = riskScore(probability, severity);

  return (
    <div className="ssm-risk-matrix" role="group" aria-labelledby={`${id}-legend`}>
      <div className="ssm-risk-matrix-header">
        <span id={`${id}-legend`} className="ssm-risk-matrix-title">
          Matrice probabilitate × severitate
        </span>
        <span className="ssm-risk-matrix-selected">
          Selectat: P{probability} × S{severity} = <strong>{selectedScore}</strong>
        </span>
      </div>

      <div className="ssm-risk-matrix-wrap">
        <table className="ssm-risk-matrix-grid" aria-label="Matrice de evaluare a riscului 5×5">
          <thead>
            <tr>
              <th scope="col" className="ssm-risk-matrix-corner" aria-hidden="true" />
              {[1, 2, 3, 4, 5].map((s) => (
                <th key={s} scope="col" className="ssm-risk-matrix-col-head">
                  <span className="ssm-risk-matrix-axis-num">S{s}</span>
                  <span className="ssm-risk-matrix-axis-label">{SEVERITY_LABELS[s]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[5, 4, 3, 2, 1].map((p) => (
              <tr key={p}>
                <th scope="row" className="ssm-risk-matrix-row-head">
                  <span className="ssm-risk-matrix-axis-num">P{p}</span>
                  <span className="ssm-risk-matrix-axis-label">{PROBABILITY_LABELS[p]}</span>
                </th>
                {[1, 2, 3, 4, 5].map((s) => {
                  const score = riskScore(p, s);
                  const band = riskBand(score);
                  const isSelected = probability === p && severity === s;
                  return (
                    <td key={s} className="ssm-risk-matrix-cell-wrap">
                      <button
                        type="button"
                        className={`ssm-risk-matrix-cell ssm-risk-matrix-cell--${band}${isSelected ? " is-selected" : ""}`}
                        aria-pressed={isSelected}
                        aria-label={`Probabilitate ${p}, severitate ${s}, nivel risc ${score}`}
                        onClick={() => onChange(p, s, score)}
                      >
                        {score}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="ssm-risk-matrix-legend" aria-label="Legendă nivel risc">
        {LEGEND.map((item) => (
          <li key={item.band} className={`ssm-risk-matrix-legend-item ssm-risk-matrix-legend-item--${item.band}`}>
            <span className="ssm-risk-matrix-legend-swatch" aria-hidden="true" />
            <span>
              {item.label} ({item.range})
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
