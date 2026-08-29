import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { teacherLogin, teacherMe, teacherLogout } from "../../services/teacher";

export default function TeacherLogin() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [existing, setExisting] = useState<{ nombre: string; apellido: string } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    teacherMe()
      .then((t) => setExisting(t))
      .catch(() => setExisting(null));
  }, []);

  const handleSessionContinue = () => navigate("/teacher/dashboard");
  const handleSessionLogout = async () => {
    await teacherLogout();
    setExisting(null);
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
          <div className="w-16 h-16 bg-brand-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
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
              placeholder="tu@colegio.edu.co"
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
