import { useMemo } from "react";
import { EmployeeSelect } from "../../master-data/components/EmployeeSelect";
import { useEmployeeOptions } from "../../master-data/hooks/useMasterData";

type TrainerFields = {
  trainerEmployeeId?: string;
  trainerName?: string;
  trainerFunction?: string;
};

type Props<T extends TrainerFields> = {
  idPrefix: string;
  value: T;
  onChange: (next: T) => void;
};

export function TrainingInstructorFields<T extends TrainerFields>({ idPrefix, value, onChange }: Props<T>) {
  const employeesQuery = useEmployeeOptions();
  const employees = employeesQuery.data?.items ?? [];
  const hint = useMemo(() => {
    if (value.trainerEmployeeId) {
      const emp = employees.find((item) => item.id === value.trainerEmployeeId);
      return emp ? `Instructor selectat: ${emp.fullName}` : undefined;
    }
    return "Poți selecta un angajat sau completa manual numele, ca la fișa colectivă / poartă.";
  }, [employees, value.trainerEmployeeId]);

  return (
    <>
      <EmployeeSelect
        id={`${idPrefix}-trainer`}
        label="Instructor"
        value={value.trainerEmployeeId ?? ""}
        allowEmpty
        emptyLabel="Selectează instructor (opțional)"
        onChange={(trainerEmployeeId) => {
          const emp = employees.find((item) => item.id === trainerEmployeeId);
          onChange({
            ...value,
            trainerEmployeeId,
            trainerName: emp?.fullName || value.trainerName || ""
          });
        }}
      />
      <div className="field">
        <label htmlFor={`${idPrefix}-trainer-name`}>Numele instructorului</label>
        <input
          id={`${idPrefix}-trainer-name`}
          value={value.trainerName ?? ""}
          onChange={(event) => onChange({ ...value, trainerName: event.target.value })}
          placeholder="ex. Ion Popescu"
        />
        <p className="field-hint">{hint}</p>
      </div>
      <div className="field">
        <label htmlFor={`${idPrefix}-trainer-function`}>Funcția instructorului</label>
        <input
          id={`${idPrefix}-trainer-function`}
          value={value.trainerFunction ?? ""}
          onChange={(event) => onChange({ ...value, trainerFunction: event.target.value })}
          placeholder="lucrător desemnat / responsabil SSM"
        />
      </div>
    </>
  );
}
