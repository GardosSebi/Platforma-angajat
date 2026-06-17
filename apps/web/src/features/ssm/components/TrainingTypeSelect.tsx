import { useMemo, type ReactNode } from "react";
import { trainingCategoryLabel } from "@repo/shared-types/ssm-training-catalog";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { useTrainingTypes } from "../hooks/useSsmTrainingSuite";

type Props = {
  id: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  valueField?: "code" | "id";
  required?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
  activeOnly?: boolean;
  disabled?: boolean;
  hint?: ReactNode;
};

export function TrainingTypeSelect({
  id,
  label = "Tip instruire",
  value,
  onChange,
  valueField = "code",
  required = false,
  allowEmpty = false,
  emptyLabel = "Selectează tip",
  activeOnly = true,
  disabled = false,
  hint
}: Props) {
  const typesQuery = useTrainingTypes();
  const options = useMemo(() => {
    const types = typesQuery.data ?? [];
    const filtered = activeOnly ? types.filter((type) => type.active) : types;
    return filtered.map((type) => ({
      value: valueField === "id" ? type.id : type.code,
      label: `${type.code} — ${type.name} (${trainingCategoryLabel(type.category)})`
    }));
  }, [typesQuery.data, activeOnly, valueField]);

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
      disabled={disabled || typesQuery.isLoading || options.length === 0}
      hint={
        hint ??
        (!typesQuery.isLoading && !typesQuery.isError && options.length === 0
          ? "Nu există tipuri active în catalog. Adaugă un tip din secțiunea „Instruire și conformitate”."
          : undefined)
      }
      error={
        typesQuery.isError
          ? typesQuery.error instanceof Error
            ? typesQuery.error.message
            : "Nu s-au putut încărca tipurile."
          : undefined
      }
      placeholder={
        !typesQuery.isLoading && !typesQuery.isError && options.length === 0
          ? "Nu există tipuri active în catalog"
          : undefined
      }
    />
  );
}
