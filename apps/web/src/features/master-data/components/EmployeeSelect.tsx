import { useEmployeeOptions } from "../hooks/useMasterData";

type Props = {
  id: string;
  label?: string;
  value: string;
  onChange: (employeeId: string) => void;
  required?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
  disabled?: boolean;
};

export function EmployeeSelect({
  id,
  label = "Angajat",
  value,
  onChange,
  required = false,
  allowEmpty = false,
  emptyLabel = "Selectează angajat",
  disabled = false
}: Props) {
  const employeesQuery = useEmployeeOptions();
  const options = employeesQuery.data?.items ?? [];

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value}
        required={required}
        disabled={disabled || employeesQuery.isLoading}
        onChange={(e) => onChange(e.target.value)}
      >
        {allowEmpty ? <option value="">{emptyLabel}</option> : null}
        {options.map((emp) => (
          <option key={emp.id} value={emp.id}>
            {emp.fullName} ({emp.email})
          </option>
        ))}
      </select>
      {employeesQuery.isError ? (
        <p className="feedback error">{employeesQuery.error instanceof Error ? employeesQuery.error.message : "Eroare"}</p>
      ) : null}
    </div>
  );
}
