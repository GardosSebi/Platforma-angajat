import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export type FieldSelectOption = {
  value: string;
  label: string;
};

type Props = {
  id: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: FieldSelectOption[];
  required?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
  disabled?: boolean;
  placeholder?: string;
  hint?: ReactNode;
  error?: ReactNode;
  /** `inline` — fără wrapper `.field` (filtre, paginare) */
  variant?: "field" | "inline";
  className?: string;
};

export function FieldSelect({
  id,
  label,
  value,
  onChange,
  options,
  required = false,
  allowEmpty = false,
  emptyLabel = "Selectează",
  disabled = false,
  placeholder,
  hint,
  error,
  variant = "field",
  className
}: Props) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const menuOptions = useMemo(() => {
    if (allowEmpty) {
      return [{ value: "", label: emptyLabel }, ...options];
    }
    return options;
  }, [allowEmpty, emptyLabel, options]);

  const selectedOption = useMemo(
    () => menuOptions.find((option) => option.value === value),
    [menuOptions, value]
  );

  const displayLabel = selectedOption?.label || placeholder || emptyLabel;

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setActiveIndex(-1);
      return;
    }
    const selectedIndex = menuOptions.findIndex((option) => option.value === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [open, menuOptions, value]);

  const selectOption = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) {
      return;
    }

    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(menuOptions.length - 1);
    }
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, menuOptions.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const option = menuOptions[activeIndex];
      if (option) {
        selectOption(option.value);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  };

  const selectControl = (
    <div ref={rootRef} className={`field-select ${open ? "open" : ""} ${disabled ? "disabled" : ""}`}>
      <button
        type="button"
        id={id}
        className="field-select-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-required={required || undefined}
        aria-label={variant === "inline" && !label ? placeholder || emptyLabel : undefined}
        onClick={() => {
          if (!disabled) {
            setOpen((current) => !current);
          }
        }}
        onKeyDown={onTriggerKeyDown}
      >
        <span className={`field-select-value ${selectedOption ? "" : "placeholder"}`}>{displayLabel}</span>
        <span className="field-select-chevron" aria-hidden />
      </button>
      {open ? (
        <ul
          id={listboxId}
          className="field-select-menu"
          role="listbox"
          aria-labelledby={label ? id : undefined}
          onKeyDown={onMenuKeyDown}
          tabIndex={-1}
        >
          {menuOptions.map((option, index) => {
            const isSelected = option.value === value;
            const isActive = index === activeIndex;
            return (
              <li key={option.value || "__empty"} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`field-select-option ${isSelected ? "selected" : ""} ${isActive ? "active" : ""}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectOption(option.value)}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );

  if (variant === "inline") {
    return (
      <div className={className}>
        {selectControl}
      </div>
    );
  }

  return (
    <div className={className ? `field ${className}` : "field"}>
      {label ? <label htmlFor={id}>{label}</label> : null}
      {selectControl}
      {hint ? <p className="field-hint">{hint}</p> : null}
      {error ? <p className="feedback error">{error}</p> : null}
    </div>
  );
}
