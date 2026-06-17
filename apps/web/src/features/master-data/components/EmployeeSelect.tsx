import { useMemo } from "react";
import { FieldSelect } from "../../../shared/components/FieldSelect";
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
  const options = useMemo(
    () =>
      (employeesQuery.data?.items ?? []).map((emp) => ({
        value: emp.id,
        label: `${emp.fullName} (${emp.email})`
      })),
    [employeesQuery.data?.items]
  );

  return (
    <FieldSelect
      id={id}
      label={label}
      value={value}
      onChange={onChange}
      options={options}
      required={required}
      allowEmpty={allowEmpty}
      emptyLabel={emptyLabel}
      disabled={disabled || employeesQuery.isLoading}
      error={
        employeesQuery.isError
          ? employeesQuery.error instanceof Error
            ? employeesQuery.error.message
            : "Eroare"
          : undefined
      }
    />
  );
}
