import type { FieldSelectOption } from "./FieldSelect";

export function stringOptions(values: readonly string[], label?: (value: string) => string): FieldSelectOption[] {
  return values.map((value) => ({
    value,
    label: label ? label(value) : value
  }));
}

export function mapToOptions<T>(
  items: readonly T[],
  valueFn: (item: T) => string,
  labelFn: (item: T) => string
): FieldSelectOption[] {
  return items.map((item) => ({
    value: valueFn(item),
    label: labelFn(item)
  }));
}
