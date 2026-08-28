import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { getSupervisorSession, exportSupervisorSession } from "../../services/supervisor";
import { useNotify } from "../../components/common/Notify";
import { Loading } from "../../components/common/States";
import type { SupervisorSessionDetail } from "../../types";

function formatFecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
}

const ESTADO_LABEL: Record<string, { label: string; className: string }> = {
  presente: { label: "Presente", className: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400" },
  ausente: { label: "Ausente", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400" },
  justificado: { label: "Justificado", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400" },
};

export default function SupervisorSession() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [data, setData] = useState<SupervisorSessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const navigate = useNavigate();
  const notify = useNotify();

  useEffect(() => {
    if (!sessionId) return;
    getSupervisorSession(sessionId)
      .then(setData)
      .catch((err: any) => {
        if (err.message?.includes("401") || err.message?.includes("No autenticado")) {
          navigate("/supervisor/login");
        }
      })
      .finally(() => setLoading(false));
  }, [sessionId, navigate]);

  const handleExport = async () => {
    if (!sessionId || exporting) return;
    setExporting(true);
    try {
      const blob = await exportSupervisorSession(sessionId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "asistencia.xlsx";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      notify.success("Excel generado");
    } catch (err: any) {
      notify.error(err.message || "Error al exportar");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 dark:bg-surface-950 flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-surface-50 dark:bg-surface-950 flex items-center justify-center">
        <div className="card p-8 text-center text-surface-500 text-sm">Sesión no encontrada</div>
      </div>
    );
  }

  const counts = data.records.reduce(
    (acc, r) => {
      acc[r.estado] = (acc[r.estado] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
      <header className="bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/supervisor/dashboard" className="text-sm text-brand-600 dark:text-brand-400 font-medium hover:underline">
            ← Volver
          </Link>
          <h1 className="text-lg font-display font-bold text-surface-900 dark:text-surface-100 truncate">Asistencia</h1>
          <button onClick={() => navigate("/supervisor/dashboard")} className="text-sm text-surface-500 hover:text-surface-700 dark:hover:text-surface-300">
            Salir
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <div className="card p-5">
          <h2 className="text-xl font-display font-bold text-surface-900 dark:text-surface-100">
            {data.assignment.discipline.nombre}
          </h2>
          <p className="text-sm text-surface-500 mt-1">
            Grado {data.assignment.grade.nombre} · {data.schedule.diaSemana} {data.schedule.horaInicio} - {data.schedule.horaFin}
          </p>
          <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">
            Profesor: {data.teacher.nombre} {data.teacher.apellido}
          </p>
          <p className="text-xs text-surface-400 mt-1">{formatFecha(data.fecha)}</p>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="mt-3 px-4 py-2 border border-brand-600 text-brand-600 dark:text-brand-400 text-sm font-medium rounded-xl hover:bg-brand-50 dark:hover:bg-brand-900/20 disabled:opacity-50"
          >
            {exporting ? "Generando..." : "Exportar a Excel"}
          </button>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400">
              Presentes: {counts.presente || 0}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400">
              Ausentes: {counts.ausente || 0}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400">
              Justificados: {counts.justificado || 0}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-400">
              Total: {data.records.length}
            </span>
          </div>
        </div>

        <div className="card overflow-hidden">
          {data.records.length === 0 ? (
            <div className="text-center py-12 text-sm text-surface-500">
              Esta sesión no tiene registros de asistencia.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-surface-100 dark:bg-surface-800">
              {data.records.map((r) => (
                <div key={r.codigoEstudiante} className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-surface-900">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">
                      {r.apellido}, {r.nombre}
                    </p>
                    <p className="text-xs text-surface-500">{r.codigoEstudiante}{r.grupo ? ` · ${r.grupo}` : ""}</p>
                  </div>
                  <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_LABEL[r.estado]?.className || ""}`}>
                    {ESTADO_LABEL[r.estado]?.label || r.estado}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}