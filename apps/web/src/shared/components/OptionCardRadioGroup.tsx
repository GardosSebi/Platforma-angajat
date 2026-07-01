export type OptionCardChoice = {
  value: string;
  title: string;
  description?: string;
  /** Folosește font monospace (ex. coduri rol) */
  monospaceTitle?: boolean;
};

type OptionCardRadioGroupProps = {
  name: string;
  legend: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  options: OptionCardChoice[];
  ariaLabel?: string;
  className?: string;
};

export function OptionCardRadioGroup({
  name,
  legend,
  hint,
  value,
  onChange,
  options,
  ariaLabel,
  className
}: OptionCardRadioGroupProps) {
  return (
    <fieldset className={className ? `role-fieldset-create ${className}` : "role-fieldset-create"}>
      <legend>{legend}</legend>
      {hint ? <p className="text-muted small role-fieldset-hint">{hint}</p> : null}
      <div className="checkbox-grid--stacked-roles" role="radiogroup" aria-label={ariaLabel ?? legend}>
        {options.map((option) => (
          <label key={option.value} className="checkbox-label checkbox-label--role-row">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span className="role-row-text">
              <span className={option.monospaceTitle ? "role-code" : "option-card-title"}>{option.title}</span>
              {option.description ? <span className="role-desc">{option.description}</span> : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
