export const SYSTEM_CRON_ACTOR = "system-cron";

export function isCronEnabled(): boolean {
  return process.env.CRON_ENABLED === "true";
}

export function dataRetentionYears(): number {
  const parsed = Number(process.env.DATA_RETENTION_YEARS ?? "5");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
}
