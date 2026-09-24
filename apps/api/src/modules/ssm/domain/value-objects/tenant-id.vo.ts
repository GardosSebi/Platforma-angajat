export class TenantId {
  private constructor(public readonly value: string) {}

  static create(value: string): TenantId {
    if (!value || value.trim().length < 2) {
      throw new Error("Identificator de tenant nevalid.");
    }
    return new TenantId(value);
  }
}
