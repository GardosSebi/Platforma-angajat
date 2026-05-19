/** Durata sesiunii JWT — suprascrie cu JWT_EXPIRES_IN în .env (ex. `8h`, `1d`). */
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "8h";
