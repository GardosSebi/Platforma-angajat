import { type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { LOCALE_STORAGE_KEY } from "../../i18n";

const LOCALES = [
  { value: "ro", label: "RO" },
  { value: "en", label: "EN" }
] as const;

export function LocaleSwitcher() {
  const { i18n, t } = useTranslation();

  const onChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value;
    void i18n.changeLanguage(next);
    localStorage.setItem(LOCALE_STORAGE_KEY, next);
  };

  return (
    <label className="locale-switcher">
      <span className="locale-switcher-label">{t("locale.label")}</span>
      <select
        className="locale-switcher-select"
        value={i18n.language.startsWith("en") ? "en" : "ro"}
        onChange={onChange}
        aria-label={t("locale.label")}
      >
        {LOCALES.map((locale) => (
          <option key={locale.value} value={locale.value}>
            {locale.label}
          </option>
        ))}
      </select>
    </label>
  );
}
