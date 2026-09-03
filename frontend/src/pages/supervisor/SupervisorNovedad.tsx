import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { roleApis, type RoleKind } from "../../services/roles";
import Logo from "../../components/common/Logo";
import type { Novedad } from "../../types";

interface State {
  sessionId: string;
  codigoEstudiante: string;
  nombre: string;
  apellido: string;
  grupo: string | null;
  novedades: Novedad[];
}

function formatLocal(value: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString("es-CO", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export interface PageProps {
  role?: RoleKind;
}

export default function SupervisorNovedad({ role = "supervisor" }: PageProps) {
  const api = roleApis[role];
  const basePath = role === "secretary" ? "/secretary" : role === "admin" ? "/admin" : "/supervisor";
  const { codigoEstudiante } = useParams<{ codigoEstudiante: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as State | null;

  const [novedades, setNovedades] = useState<Novedad[]>(state?.novedades || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!codigoEstudiante) return;
    if (state?.novedades && state.novedades.length > 0) return;
    setLoading(true);
    setError(null);
    api.getNovedadesBatch([codigoEstudiante])
      .then((res) => {
        const item = res.find((i) => i.codigoEstudiante === codigoEstudiante);
        setNovedades(item?.novedades || []);
      })
      .catch(() => {
        setError("No se pudieron cargar las novedades.");
      })
      .finally(() => setLoading(false));
  }, [codigoEstudiante, state]);

  // La secretaría no tiene flujo de llamar lista: vuelve a la sesión leída o al dashboard.
  const backTo = state?.sessionId
    ? role === "secretary"
      ? `${basePath}/session/${state.sessionId}`
      : `${basePath}/session-attendance/${state.sessionId}`
    : role === "secretary"
      ? `${basePath}/dashboard`
      : `${basePath}/classes`;
  const nombre = state?.nombre;
  const apellido = state?.apellido;
  const grupo = state?.grupo;

  return (
    <div className="min-h-screen min-h-[100dvh] bg-surface-50 dark:bg-surface-950 pb-10">
      <header className="bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Logo chip alt="Extracurriculares" className="h-8 w-auto shrink-0" />
            <button
              onClick={() => navigate(backTo)}
              className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Volver a la asistencia
            </button>
          </div>
          {loading && <span className="text-xs text-surface-400">Cargando...</span>}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl px-6 py-8">
          <div className="flex items-start gap-4 sm:gap-5">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 ring-4 ring-white/10">
              <span className="text-white font-display font-bold text-xl sm:text-2xl">
                {nombre ? nombre.charAt(0) : "?"}
                {apellido ? apellido.charAt(0) : ""}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-display font-bold text-white break-words">
                {nombre || "Estudiante"} {apellido || ""}
              </h1>
              <p className="text-amber-100 text-sm mt-1.5 font-medium break-words">
                Código: {codigoEstudiante}
              </p>
              {(nombre && grupo) && (
                <p className="text-amber-200 text-sm break-words">{grupo}</p>
              )}
              <div className="flex items-center gap-2 mt-3">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white">
                  Novedad activa
                </span>
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <div className="card p-8 text-center space-y-3">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            <button
              onClick={() => navigate(backTo)}
              className="inline-flex items-center px-4 py-2 rounded-xl bg-surface-900 text-white text-sm font-medium"
            >
              Volver
            </button>
          </div>
        ) : novedades.length === 0 && !loading ? (
          <div className="card p-8 text-center">
            <p className="text-surface-500 text-sm">No hay novedades activas para este estudiante.</p>
          </div>
        ) : (
          novedades.map((n) => (
            <div key={n.id} className="card overflow-hidden">
              <div className="px-6 py-4 border-b border-surface-100 dark:border-surface-800 flex items-center gap-2">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-amber-500">
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                <h2 className="font-display font-semibold text-surface-900 dark:text-surface-100 text-base">
                  Novedad de salida
                </h2>
              </div>

              <div className="px-6 py-5 space-y-4">
                {n.descripcion && (
                  <div>
                    <p className="text-xs font-medium text-surface-400 uppercase tracking-wide mb-1">Detalle</p>
                    <p className="text-surface-800 dark:text-surface-200 font-medium">{n.descripcion}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(n.seAusentaCon || n.seAusentaConOtro) && (
                    <div className="rounded-xl bg-surface-50 dark:bg-surface-800 px-4 py-3 border border-surface-100 dark:border-surface-700">
                      <p className="text-xs font-medium text-surface-400 mb-0.5">Se ausenta con</p>
                      <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
                        {n.seAusentaCon || n.seAusentaConOtro}
                      </p>
                    </div>
                  )}

                  <div className="rounded-xl bg-surface-50 dark:bg-surface-800 px-4 py-3 border border-surface-100 dark:border-surface-700">
                    <p className="text-xs font-medium text-surface-400 mb-0.5">Regreso</p>
                    <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
                      {n.regresaAlColegio ? "Sí regresa" : "No regresa"}
                      {n.horaEstimadaRegreso ? ` · ${n.horaEstimadaRegreso}` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-surface-500">
                  {n.fechaHora && (
                    <span>Salida: {formatLocal(n.fechaHora)}</span>
                  )}
                  {n.registradoPor && (
                    <span>Registrado por {n.registradoPor}</span>
                  )}
                  {n.fechaCreacion && (
                    <span>Registrado el {formatLocal(n.fechaCreacion)}</span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
