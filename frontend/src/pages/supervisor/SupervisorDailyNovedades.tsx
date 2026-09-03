import { useEffect, useState } from "react";
import { roleApis, type RoleKind, type DailyNovedad } from "../../services/roles";
import { Loading } from "../../components/common/States";
import { useNotify } from "../../components/common/Notify";

function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
}

function formatDate(value: string | null): string {
  if (!value) return "Sin hora registrada";
  return new Date(value).toLocaleString("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Bogota",
  });
}

export default function SupervisorDailyNovedades({ role = "supervisor" }: { role?: RoleKind }) {
  const api = roleApis[role];
  const [fecha, setFecha] = useState(today);
  const [grado, setGrado] = useState("");
  const [grados, setGrados] = useState<string[]>([]);
  const [items, setItems] = useState<DailyNovedad[]>([]);
  const [loading, setLoading] = useState(true);
  const notify = useNotify();

  const load = () => {
    setLoading(true);
    api.getNovedadesDiarias({ fecha, grado })
      .then(setItems)
      .catch((error: any) => notify.error(error.message || "No se pudieron cargar las novedades"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    api.getFilters().then((data) => setGrados(data.grados)).catch(() => notify.error("No se pudieron cargar los grados"));
  }, [api, notify]);

  useEffect(() => { load(); }, [api]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      <div>
        <p className="text-sm text-surface-500">Seguimiento de estudiantes</p>
        <h1 className="text-2xl font-display font-bold text-surface-900 dark:text-surface-100">Novedades diarias</h1>
      </div>

      <div className="card p-4 flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1">
          <label className="block text-xs font-medium text-surface-500 mb-1">Fecha</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm" />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-surface-500 mb-1">Grado</label>
          <select value={grado} onChange={(e) => setGrado(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm">
            <option value="">Todos los grados</option>
            {grados.map((g) => <option key={g} value={g}>Grado {g}</option>)}
          </select>
        </div>
        <button onClick={load} className="px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700">Filtrar</button>
      </div>

      {loading ? <Loading /> : items.length === 0 ? (
        <div className="card p-10 text-center text-sm text-surface-500">No hay novedades para los filtros seleccionados.</div>
      ) : (
        <div className="space-y-3">
          {items.map(({ estudiante, novedad }) => (
            <article key={novedad.id} className="card p-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div>
                  <h2 className="font-display font-semibold text-surface-900 dark:text-surface-100">{estudiante.nombre} {estudiante.apellido}</h2>
                  <p className="text-xs text-surface-500">Código: {estudiante.codigoEstudiante} · Grado {estudiante.grado || "sin grado"}{estudiante.grupo ? ` · ${estudiante.grupo}` : ""}</p>
                </div>
                <span className="text-xs text-surface-400">{formatDate(novedad.fechaNovedad || novedad.fechaHora || novedad.fechaCreacion)}</span>
              </div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {novedad.descripcion && <div><span className="text-xs text-surface-400 block">Detalle</span><span className="text-surface-800 dark:text-surface-200">{novedad.descripcion}</span></div>}
                {(novedad.seAusentaCon || novedad.seAusentaConOtro) && <div><span className="text-xs text-surface-400 block">Se ausenta con</span><span className="text-surface-800 dark:text-surface-200">{novedad.seAusentaCon || novedad.seAusentaConOtro}</span></div>}
                {novedad.tipoNovedad && <div><span className="text-xs text-surface-400 block">Tipo</span><span className="text-surface-800 dark:text-surface-200">{novedad.tipoNovedad}</span></div>}
                <div><span className="text-xs text-surface-400 block">Regreso</span><span className="text-surface-800 dark:text-surface-200">{novedad.regresaAlColegio ? "Sí regresa" : "No regresa"}{novedad.horaEstimadaRegreso ? ` · ${novedad.horaEstimadaRegreso}` : ""}</span></div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
