const DEFAULT_SECONDS = 8 * 60 * 60;

/** Parsează JWT_EXPIRES_IN: secunde (`28800`) sau sufixe `8h`, `1d`. */
export function parseExpiresInSeconds(raw: string | undefined): number {
  if (!raw?.trim()) {
    return DEFAULT_SECONDS;
  }
  const trimmed = raw.trim();
  const asNumber = Number.parseInt(trimmed, 10);
  if (Number.isFinite(asNumber) && asNumber > 0 && /^\d+$/.test(trimmed)) {
    return asNumber;
  }
  const hours = /^(\d+)\s*h$/i.exec(trimmed);
  if (hours) {
    return Number.parseInt(hours[1], 10) * 60 * 60;
  }
  const days = /^(\d+)\s*d$/i.exec(trimmed);
  if (days) {
    return Number.parseInt(days[1], 10) * 24 * 60 * 60;
  }
  return DEFAULT_SECONDS;
}

/** Durata tokenului în secunde (implicit 8 ore). */
export const JWT_EXPIRES_IN_SECONDS = parseExpiresInSeconds(process.env.JWT_EXPIRES_IN);

/** Valoare afișată la login (din env sau derivată). */
export const JWT_EXPIRES_IN_LABEL = process.env.JWT_EXPIRES_IN?.trim() || "8h";
