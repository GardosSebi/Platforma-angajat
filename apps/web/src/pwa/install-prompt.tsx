import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const DISMISS_KEY = "pwa-install-dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaInstallBanner() {
  const { t } = useTranslation();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === "1");
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  if (dismissed || hidden || !deferredPrompt) {
    return null;
  }

  const onInstall = async () => {
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (choice.outcome === "accepted") {
      setHidden(true);
    }
  };

  const onLater = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
    setDeferredPrompt(null);
  };

  return (
    <div className="pwa-install-banner" role="region" aria-label={t("pwa.install")}>
      <p className="pwa-install-banner-text">{t("pwa.install")}</p>
      <div className="pwa-install-banner-actions">
        <button type="button" className="btn-primary" onClick={onInstall}>
          {t("pwa.installAction")}
        </button>
        <button type="button" className="btn-secondary" onClick={onLater}>
          {t("pwa.later")}
        </button>
      </div>
    </div>
  );
}
