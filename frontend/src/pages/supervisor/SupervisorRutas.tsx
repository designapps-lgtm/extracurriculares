import { useEffect, useMemo, useState } from "react";
import { getRutas } from "../../services/rutas";
import { Loading, ErrorMessage, EmptyState } from "../../components/common/States";
import type { RutaSlot, RutasReport } from "../../types";

const DAY_LABELS: Record<string, string> = {
  LUNES: "Lunes",
  MARTES: "Martes",
  MIERCOLES: "Miércoles",
  JUEVES: "Jueves",
  VIERNES: "Viernes",
  SABADO: "Sábado",
};

function countInSlot(report: RutasReport, slot: RutaSlot): number {
  return report.estudiantes.filter((s) => s.ruta.some((r) => r.columnKey === slot.columnKey)).length;
}

/** Quiénes se van en ruta, por día y hora, según las columnas de Demograficos. */
export default function SupervisorRutas() {
  const [report, setReport] = useState<RutasReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterDia, setFilterDia] = useState("");
  const [filterHora, setFilterHora] = useState("");
  const [search, setSearch] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    getRutas()
      .then(setReport)
      .catch((err) => setError(err.message || "No se pudo cargar la información de rutas"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const horasPorDia = useMemo(() => {
    if (!report || !filterDia) return [];
    return report.slots.filter((s) => s.diaSemana === filterDia);
  }, [report, filterDia]);

  const dias = useMemo(() => {
    if (!report) return [];
    const seen = new Set<string>();
    return report.slots.filter((s) => {
      if (seen.has(s.diaSemana)) return false;
      seen.add(s.diaSemana);
      return true;
    });
  }, [report]);

  const filtered = useMemo(() => {
    if (!report) return [];
    const query = search.trim().toLowerCase();
    return report.estudiantes
      .filter((student) => {
        if (filterDia) {
          const slotsDelDia = student.ruta.filter((r) => r.diaSemana === filterDia);
          if (slotsDelDia.length === 0) return false;
          if (filterHora && !slotsDelDia.some((r) => r.hora === filterHora)) return false;
        } else if (filterHora) {
          return student.ruta.some((r) => r.hora === filterHora);
        }
        if (!query) return true;
        return (
          student.nombre.toLowerCase().includes(query) ||
          student.codigo.includes(query) ||
          (student.grupo ?? "").toLowerCase().includes(query)
        );
      })
      .sort((a, b) => (a.nombre < b.nombre ? -1 : a.nombre > b.nombre ? 1 : 0));
  }, [report, filterDia, filterHora, search]);

  if (loading) return <Loading message="Cargando rutas..." />;
  if (!report) return <ErrorMessage message={error} onRetry={load} />;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-surface-900 dark:text-surface-100">Rutas de transporte</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Estudiantes que se van en ruta según las columnas de día y hora de Demograficos.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="card p-4 flex items-center justify-between">
          <span className="text-sm text-surface-500 dark:text-surface-400">Estudiantes en ruta</span>
          <span className="text-2xl font-display font-bold text-brand-600">{report.estudiantes.length}</span>
        </div>
        <div className="card p-4 flex items-center justify-between">
          <span className="text-sm text-surface-500 dark:text-surface-400">Salidas programadas (día/hora)</span>
          <span className="text-2xl font-display font-bold text-surface-900 dark:text-surface-100">{report.slots.length}</span>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre, código o grupo..."
            className="flex-1 min-w-[220px] px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <select
            value={filterDia}
            onChange={(event) => { setFilterDia(event.target.value); setFilterHora(""); }}
            className="px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 text-sm"
            aria-label="Filtrar por día"
          >
            <option value="">Todos los días</option>
            {dias.map((slot) => (
              <option key={slot.diaSemana} value={slot.diaSemana}>{DAY_LABELS[slot.diaSemana] || slot.diaSemana}</option>
            ))}
          </select>
          <select
            value={filterHora}
            onChange={(event) => setFilterHora(event.target.value)}
            className="px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 text-sm"
            aria-label="Filtrar por hora"
          >
            <option value="">Todas las horas</option>
            {(filterDia ? horasPorDia : report.slots).map((slot, index) => (
              <option key={`${slot.columnKey}-${index}`} value={slot.hora}>{slot.hora}</option>
            ))}
          </select>
          {(filterDia || filterHora || search) && (
            <button
              type="button"
              onClick={() => { setFilterDia(""); setFilterHora(""); setSearch(""); }}
              className="px-4 py-2 rounded-xl text-sm font-medium text-brand-600 hover:bg-brand-50 dark:hover:bg-surface-800"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {filterDia === "" && (
          <div className="mt-4 flex flex-wrap gap-2">
            {report.slots.map((slot) => (
              <button
                key={slot.columnKey}
                type="button"
                onClick={() => { setFilterDia(slot.diaSemana); setFilterHora(slot.hora); }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-xs font-medium text-surface-600 dark:text-surface-300 hover:border-brand-400 hover:text-brand-600"
              >
                {DAY_LABELS[slot.diaSemana] || slot.diaSemana} · {slot.hora}
                <span className="px-1.5 rounded-full bg-brand-50 dark:bg-surface-900 text-brand-600 dark:text-brand-400">
                  {countInSlot(report, slot)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState message={report.estudiantes.length === 0 ? "Aún no hay estudiantes marcados en ruta." : "Ningún estudiante coincide con los filtros."} />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-surface-400 dark:text-surface-500 border-b border-surface-200 dark:border-surface-800">
                  <th className="px-4 py-3 font-semibold">Estudiante</th>
                  <th className="px-4 py-3 font-semibold">Código</th>
                  <th className="px-4 py-3 font-semibold">Grupo</th>
                  <th className="px-4 py-3 font-semibold">Ruta (día y hora)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                {filtered.map((student) => (
                  <tr key={student.codigo} className="text-surface-700 dark:text-surface-200">
                    <td className="px-4 py-3 font-medium">{student.nombre || "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs">{student.codigo}</td>
                    <td className="px-4 py-3 text-xs">{student.grupo || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {student.ruta.map((slot) => (
                          <span
                            key={slot.columnKey}
                            className="inline-flex items-center px-2.5 py-1 rounded-full bg-brand-50 dark:bg-surface-900 text-xs font-medium text-brand-700 dark:text-brand-400"
                          >
                            {(DAY_LABELS[slot.diaSemana] || slot.diaSemana).toUpperCase()} · {slot.hora}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-surface-100 dark:border-surface-800 text-xs text-surface-400 dark:text-surface-500">
            {filtered.length} de {report.estudiantes.length} estudiantes en ruta
          </div>
        </div>
      )}
    </div>
  );
}