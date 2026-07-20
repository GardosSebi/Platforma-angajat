import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ro from "./locales/ro.json";

export const LOCALE_STORAGE_KEY = "app-locale";

const storedLocale = localStorage.getItem(LOCALE_STORAGE_KEY);
const initialLocale = storedLocale === "en" || storedLocale === "ro" ? storedLocale : "ro";

void i18n.use(initReactI18next).init({
  resources: {
    ro: { translation: ro },
    en: { translation: en }
  },
  lng: initialLocale,
  fallbackLng: "ro",
  interpolation: {
    escapeValue: false
  }
});

export default i18n;
