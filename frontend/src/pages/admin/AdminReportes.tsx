import { useState, useEffect } from "react";
import { getAdminReports, adminUpdateReportEstado } from "../../services/adminOperations";
import { useNotify } from "../../components/common/Notify";
import { Loading } from "../../components/common/States";
import type { AppReport, ReportCategoria, ReportEstado } from "../../types";

const ESTADO_OPTIONS: { value: ReportEstado | ""; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "nuevo", label: "Nuevos" },
  { value: "en_progreso", label: "En progreso" },
  { value: "resuelto", label: "Resueltos" },
];

const ESTADO_STYLES: Record<ReportEstado, string> = {
  nuevo: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  en_progreso: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  resuelto: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
};

const ESTADO_LABELS: Record<ReportEstado, string> = {
  nuevo: "Nuevo",
  en_progreso: "En progreso",
  resuelto: "Resuelto",
};

const CATEGORIA_LABELS: Record<ReportCategoria, string> = {
  problema: "Problema / error",
  sugerencia: "Sugerencia",
  otro: "Otro",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("es-CO")} ${d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function AdminReportes() {
  const [reports, setReports] = useState<AppReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [estado, setEstado] = useState<ReportEstado | "">("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const notify = useNotify();

  const load = () => {
    setLoading(true);
    getAdminReports(estado || undefined)
      .then((res) => setReports(res))
      .catch((err: any) => notify.error(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [estado]);

  const nextAction = (r: AppReport): { label: string; to: ReportEstado } =>
    r.estado === "nuevo" ? { label: "Tomar", to: "en_progreso" }
    : r.estado === "en_progreso" ? { label: "Resolver", to: "resuelto" }
    : { label: "Reabrir", to: "nuevo" };

  const handleStatus = async (r: AppReport) => {
    const { to } = nextAction(r);
    setUpdatingId(r.id);
    try {
      await adminUpdateReportEstado(r.id, to);
      notify.success("Estado actualizado");
      load();
      window.dispatchEvent(new CustomEvent("reportes:actualizados"));
    } catch (err: any) {
      notify.error(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-surface-900 dark:text-surface-100">Reportes de problemas</h1>
          <p className="text-sm text-surface-500 mt-1">Mensajes enviados desde las vistas de usuarios</p>
        </div>
        <div className="flex items-center gap-1 p-1 bg-surface-100 dark:bg-surface-800 rounded-xl self-start sm:self-auto">
          {ESTADO_OPTIONS.map((opt) => (
            <button
              key={opt.value || "todos"}
              onClick={() => setEstado(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${estado === opt.value ? "bg-white dark:bg-surface-900 text-brand-600 shadow-sm" : "text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        {loading ? (
          <Loading />
        ) : reports.length === 0 ? (
          <p className="p-6 text-center text-sm text-surface-500">No hay reportes {estado ? `en estado "${ESTADO_LABELS[estado]}"` : ""}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-100 dark:border-surface-800">
                  <th className="text-left px-4 py-3 text-xs font-medium text-surface-500 uppercase">Categoría</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-surface-500 uppercase">Descripción</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-surface-500 uppercase">Página</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-surface-500 uppercase">Usuario</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-surface-500 uppercase">Enviado</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-surface-500 uppercase">Estado</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-surface-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50 dark:divide-surface-800">
                {reports.map((r) => {
                  const action = nextAction(r);
                  return (
                    <tr key={r.id} className="hover:bg-surface-50 dark:hover:bg-surface-800">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-300">
                          {CATEGORIA_LABELS[r.categoria]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-surface-700 dark:text-surface-300 max-w-md">
                        <p className="line-clamp-2">{r.descripcion}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-surface-500">{r.pagina}</td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-surface-500 capitalize">{r.tipoUsuario}</p>
                        <p className="text-xs text-surface-400 truncate max-w-40">{r.correo}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-surface-500 whitespace-nowrap">{formatDate(r.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_STYLES[r.estado]}`}>
                          {ESTADO_LABELS[r.estado]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleStatus(r)}
                          disabled={updatingId === r.id}
                          className="px-1.5 py-1 text-brand-600 hover:text-brand-700 hover:bg-brand-50 dark:hover:bg-brand-950 text-sm font-medium rounded-lg disabled:opacity-50"
                        >
                          {updatingId === r.id ? "..." : action.label}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}