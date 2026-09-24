export const SYSTEM_CRON_ACTOR = "system-cron";

/** Pornit implicit. Oprește cu CRON_ENABLED=false. */
export function isCronEnabled(): boolean {
  const raw = process.env.CRON_ENABLED?.trim().toLowerCase();
  if (!raw) return true;
  return raw !== "false" && raw !== "0" && raw !== "no" && raw !== "off";
}

export function dataRetentionYears(): number {
  const parsed = Number(process.env.DATA_RETENTION_YEARS ?? "5");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
}
