import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { googleLogin, me, logout, homePathForRole, type AuthSession } from "../services/auth";
import Logo from "../components/common/Logo";

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: { client_id: string; callback: (resp: { credential: string }) => void }) => void;
          renderButton: (parent: HTMLElement, options: { theme: string; size: string; shape: string; width?: number }) => void;
          cancel: () => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.GOOGLE_CLIENT_ID || import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

export default function Login() {
  const [error, setError] = useState("");
  const [existing, setExisting] = useState<AuthSession | null>(null);
  const googleRendered = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    me()
      .then((s) => setExisting(s))
      .catch(() => setExisting(null));

    if (!GOOGLE_CLIENT_ID) {
      if (import.meta.env.DEV) console.warn("[login] GOOGLE_CLIENT_ID no está definido — sin botón de Google");
      return;
    }

    let cancelled = false;

    const renderGoogleButton = () => {
      if (cancelled || googleRendered.current) return;
      const gid = window.google?.accounts?.id;
      const node = document.getElementById("google-signin-btn");
      if (!gid || !node) return;

      const width = Math.max(200, Math.min(320, node.clientWidth - 16));

      googleRendered.current = true;
      gid.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (resp) => handleGoogleCredential(resp.credential),
      });
      gid.renderButton(node, { theme: "outline", size: "large", shape: "rectangular", width });
    };

    renderGoogleButton();
    const interval = window.setInterval(renderGoogleButton, 150);
    const timeout = window.setTimeout(() => window.clearInterval(interval), 6000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSessionContinue = () => {
    if (existing) navigate(homePathForRole(existing.role));
  };

  const handleSessionLogout = async () => {
    await logout();
    setExisting(null);
  };

  const handleGoogleCredential = async (credential: string) => {
    if (!credential) return setError("No se recibió la credencial de Google");
    setError("");
    try {
      const session = await googleLogin(credential);
      navigate(homePathForRole(session.role));
    } catch (err: any) {
      setError(err.message || "No se pudo iniciar sesión con Google");
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-surface-50 dark:bg-surface-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo chip alt="Extracurriculares" className="h-16 w-auto" />
          </div>
          <h1 className="text-2xl font-display font-bold text-surface-900 dark:text-surface-100">
            Extracurriculares
          </h1>
          <p className="text-surface-500 text-sm mt-1">Iniciá sesión con tu cuenta institucional</p>
        </div>

        {existing && (
          <div className="card p-4 mb-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-100 dark:bg-brand-900 rounded-full flex items-center justify-center text-brand-700 dark:text-brand-300 font-bold">
                {existing.user.nombre[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">
                  {existing.user.nombre} {existing.user.apellido}
                </p>
                <p className="text-xs text-surface-500">Sesión activa</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSessionContinue}
                className="flex-1 px-3 py-2 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-700"
              >
                Continuar
              </button>
              <button
                onClick={handleSessionLogout}
                className="flex-1 px-3 py-2 border border-surface-200 dark:border-surface-700 text-sm font-medium rounded-xl hover:bg-surface-50 text-surface-700 dark:text-surface-300"
              >
                Usar otra cuenta
              </button>
            </div>
          </div>
        )}

        {GOOGLE_CLIENT_ID ? (
          <div className="card p-6 space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
                {error}
              </div>
            )}
            <div id="google-signin-btn" className="flex justify-center" />
            <p className="text-xs text-surface-400 text-center leading-relaxed">
              El sistema detectará tu rol con el correo y te llevará a tu panel.
            </p>
          </div>
        ) : (
          <div className="card p-6 space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
                {error}
              </div>
            )}
            <p className="text-sm text-surface-500 text-center">
              El inicio con Google no está configurado en este entorno.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
