import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "extracurriculares-install-dismissed-until";
const DISMISS_FOR_MS = 7 * 24 * 60 * 60 * 1000;

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
    || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches
    || ("standalone" in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone));
}

function wasDismissedRecently() {
  try {
    return Number(window.localStorage.getItem(DISMISS_KEY) || 0) > Date.now();
  } catch {
    return false;
  }
}

function dismissForLater() {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_FOR_MS));
  } catch {
    // El aviso puede cerrarse aunque el navegador no permita localStorage.
  }
}

export default function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (isStandalone() || wasDismissedRecently()) return;

    setIos(isIosDevice());
    const showIosPrompt = window.setTimeout(() => {
      if (isIosDevice() && !isStandalone()) setVisible(true);
    }, 1200);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const handleInstalled = () => {
      setVisible(false);
      setInstallEvent(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.clearTimeout(showIosPrompt);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const close = () => {
    dismissForLater();
    setVisible(false);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    setInstallEvent(null);
    if (choice.outcome === "accepted") setVisible(false);
  };

  if (!visible) return null;

  return (
    <aside
      role="dialog"
      aria-label="Instalar Extracurriculares"
      className="fixed left-3 right-3 z-[70] max-w-lg mx-auto rounded-2xl border border-brand-200 dark:border-brand-800 bg-white dark:bg-surface-900 shadow-2xl p-4 sm:p-5"
      style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-start gap-3">
        <img src="/icon.svg" alt="" className="w-12 h-12 rounded-xl shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="font-display font-bold text-surface-900 dark:text-surface-100">Accede más rápido</h2>
          <p className="mt-1 text-sm leading-5 text-surface-600 dark:text-surface-300">
            Crea un acceso directo de Extracurriculares en la pantalla de inicio de tu dispositivo.
          </p>
          {ios && !installEvent && (
            <p className="mt-2 text-xs leading-5 text-surface-500 dark:text-surface-400">
              En Safari: toca <strong>Compartir</strong> y luego <strong>Agregar a pantalla de inicio</strong>.
            </p>
          )}
        </div>
        <button type="button" onClick={close} aria-label="Cerrar aviso" className="p-1 text-surface-400 hover:text-surface-700 dark:hover:text-surface-200">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      <div className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <button type="button" onClick={close} className="btn-secondary w-full sm:w-auto">Ahora no</button>
        {installEvent && <button type="button" onClick={install} className="btn-primary w-full sm:w-auto">Instalar aplicación</button>}
      </div>
    </aside>
  );
}
