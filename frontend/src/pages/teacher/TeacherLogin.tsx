import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { teacherLogin, teacherMe, teacherLogout, teacherGoogleLogin } from "../../services/teacher";
import Logo from "../../components/common/Logo";

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

export default function TeacherLogin() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [existing, setExisting] = useState<{ nombre: string; apellido: string } | null>(null);
  const googleRendered = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    teacherMe()
      .then((t) => setExisting(t))
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

      // El iframe de GIS no debe exceder el ancho de la tarjeta (responsive en pantallas chicas).
      const width = Math.max(200, Math.min(320, node.clientWidth - 16));

      googleRendered.current = true;
      gid.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (resp) => handleGoogleCredential(resp.credential),
      });
      gid.renderButton(node, { theme: "outline", size: "large", shape: "rectangular", width });
    };

    // El script vive en index.html; pueden cargar antes o después del mount.
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

  const handleSessionContinue = () => navigate("/teacher/dashboard");
  const handleSessionLogout = async () => {
    await teacherLogout();
    setExisting(null);
  };

  const handleGoogleCredential = async (credential: string) => {
    if (!credential) return setError("No se recibió la credencial de Google");
    setLoading(true);
    setError("");
    try {
      await teacherGoogleLogin(credential);
      navigate("/teacher/dashboard");
    } catch (err: any) {
      setError(err.message || "No se pudo iniciar sesión con Google");
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return setError("Ingresa tu correo");
    setLoading(true);
    setError("");
    try {
      await teacherLogin(email);
      navigate("/teacher/dashboard");
    } catch (err: any) {
      setError(err.message || "Correo no registrado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-surface-50 dark:bg-surface-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo chip alt="Extracurriculares" className="h-16 w-auto" />
          </div>
          <h1 className="text-2xl font-display font-bold text-surface-900 dark:text-surface-100">Extracurriculares</h1>
          <p className="text-surface-500 text-sm mt-1">Portal del profesor</p>
        </div>

        {existing && (
          <div className="card p-4 mb-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-100 dark:bg-brand-900 rounded-full flex items-center justify-center text-brand-700 dark:text-brand-300 font-bold">
                {existing.nombre[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">
                  {existing.nombre} {existing.apellido}
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
            <div className="relative text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-surface-200 dark:border-surface-800" />
              </div>
              <span className="relative px-3 bg-white dark:bg-surface-900 text-xs text-surface-400">o con tu correo</span>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1">Correo</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="w-full px-3 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="tu@gi.edu.co"
                  autoComplete="email"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
              >
                {loading ? "Verificando..." : "Ingresar"}
              </button>
            </form>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card p-6 space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
                {error}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1">Correo</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="tu@gi.edu.co"
                autoComplete="email"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
            >
              {loading ? "Verificando..." : "Ingresar"}
            </button>
            <p className="text-xs text-surface-400 text-center">
              El sistema validará tu correo y te mostrará tus clases.
            </p>
          </form>
        )}

        <p className="text-center text-xs text-surface-400 mt-6">
          ¿Sos administrador?{" "}
          <Link to="/admin/login" className="text-brand-600 dark:text-brand-400 font-medium hover:underline">
            Panel administrativo
          </Link>{" "}
          · ¿Supervisás?{" "}
          <Link to="/supervisor/login" className="text-brand-600 dark:text-brand-400 font-medium hover:underline">
            Portal de supervisión
          </Link>
        </p>
      </div>
    </div>
  );
}
