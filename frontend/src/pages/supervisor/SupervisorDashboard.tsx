import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { roleApis, type RoleKind, type RoleUser, type RoleFilters } from "../../services/roles";
import { useNotify } from "../../components/common/Notify";
import { Loading } from "../../components/common/States";
import { Pagination } from "../../components/common/Pagination";
import Logo from "../../components/common/Logo";
import type { SupervisorSessionItem } from "../../types";
import { NIVELES, nivelDeGrado, nivelLabel, type Nivel } from "../../utils/niveles";

function todayBogota(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
}

function formatFecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric", timeZone: "America/Bogota" });
}

const ESTADO_LABEL: Record<string, { label: string; className: string }> = {
  presente: { label: "Presente", className: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400" },
  ausente: { label: "Ausente", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400" },
  justificado: { label: "Justificado", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400" },
};

type AttendanceFilters = {
  fecha: string;
  grado: string;
  disciplina: string;
  profesor: string;
};

const EMPTY_FILTERS: AttendanceFilters = { fecha: todayBogota(), grado: "", disciplina: "", profesor: "" };

function toQueryParams(filters: AttendanceFilters, role: RoleKind): Record<string, string> {
  const params: Record<string, string> = { fecha: filters.fecha || todayBogota() };
  if ((role === "secretary" || role === "admin") && filters.grado) params.grado = filters.grado;
  if (filters.disciplina) params.disciplina = filters.disciplina;
  if (filters.profesor) params.profesor = filters.profesor;
  return params;
}

export interface PageProps {
  role?: RoleKind;
}

export default function SupervisorDashboard({ role = "supervisor" }: PageProps) {
  const api = roleApis[role];
  const basePath = role === "secretary" ? "/secretary" : role === "admin" ? "/admin" : "/supervisor";
  const [user, setUser] = useState<RoleUser | null>(null);
  const [sessions, setSessions] = useState<SupervisorSessionItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [filterData, setFilterData] = useState<RoleFilters | null>(null);
  const [draftFilters, setDraftFilters] = useState<AttendanceFilters>({ ...EMPTY_FILTERS });
  const [appliedFilters, setAppliedFilters] = useState<AttendanceFilters>({ ...EMPTY_FILTERS });
  const [niveles, setNiveles] = useState<Nivel[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const navigate = useNavigate();
  const notify = useNotify();

  const load = useCallback(
    (page: number, filters: AttendanceFilters) => {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      setListError(null);
      const params: Record<string, string> = {
        ...toQueryParams(filters, role),
        page: String(page),
        limit: "20",
      };

      api.getSessions(params)
        .then((res) => {
          if (requestId !== requestIdRef.current) return;
          setSessions(res.data);
          setMeta(res.meta);
        })
        .catch((err: any) => {
          if (requestId !== requestIdRef.current) return;
          if (err.message?.includes("401") || err.message?.includes("No autenticado")) {
            navigate("/");
          } else {
            setListError(err.message || "No se pudieron cargar la Asistencia Extracurriculares.");
          }
        })
        .finally(() => {
          if (requestId === requestIdRef.current) setLoading(false);
        });
    },
    [api, navigate, role],
  );

  useEffect(() => {
    api.me()
      .then(setUser)
      .catch(() => navigate("/"));
  }, [api, navigate]);

  useEffect(() => {
    load(1, EMPTY_FILTERS);
  }, [load]);

  useEffect(() => {
    setCatalogLoading(true);
    setCatalogError(null);
    api.getFilters()
      .then(setFilterData)
      .catch(() => setCatalogError("No se pudieron cargar los filtros. Puedes consultar y recargar para intentarlo de nuevo."))
      .finally(() => setCatalogLoading(false));
  }, [api]);

  const handleApplyFilters = () => {
    const nextFilters = {
      ...draftFilters,
      grado: (role === "secretary" || role === "admin") ? draftFilters.grado : "",
    };
    setAppliedFilters(nextFilters);
    load(1, nextFilters);
  };

  const handleToday = () => {
    const nextFilters = {
      ...draftFilters,
      fecha: todayBogota(),
      grado: (role === "secretary" || role === "admin") ? draftFilters.grado : "",
    };
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    load(1, nextFilters);
  };

  const handleClearFilters = () => {
    const emptyFilters = { ...EMPTY_FILTERS };
    setDraftFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setNiveles([]);
    load(1, emptyFilters);
  };

  const handlePageChange = (page: number) => {
    load(page, appliedFilters);
  };

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    const filters = appliedFilters;
    try {
      const blob = await api.exportAttendance(toQueryParams(filters, role));
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `asistencias_${filters.fecha || "todas"}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      notify.success("Excel generado");
    } catch (err: any) {
      setExportError(err.message || "No se pudieron exportar las asistencias.");
    } finally {
      setExporting(false);
    }
  };

  const updateDraft = (key: keyof AttendanceFilters, value: string) => {
    setDraftFilters((current) => ({ ...current, [key]: value }));
  };

  const toggleNivel = (nivel: Nivel) => {
    setNiveles((current) => current.includes(nivel) ? current.filter((item) => item !== nivel) : [...current, nivel]);
  };

  const visibleSessions = useMemo(() => {
    if (niveles.length === 0) return sessions;
    return sessions.filter((session) => {
      const nivel = nivelDeGrado(session.assignment.grade.nombre);
      return nivel !== null && niveles.includes(nivel);
    });
  }, [niveles, sessions]);

  return (
    <div className="min-h-screen min-h-[100dvh] bg-surface-50 dark:bg-surface-950">
      <header className="bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Logo chip alt="Extracurriculares" className="h-9 w-auto" />
            <div className="min-w-0">
              <h1 className="text-lg font-display font-bold text-surface-900 dark:text-surface-100 truncate">
                {user?.nombre} {user?.apellido}
              </h1>
              <p className="text-xs text-surface-500">Asistencia Extracurriculares registrada por los profesores</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <div className="card p-4">
          {catalogLoading && (
            <p className="mb-3 text-sm text-surface-500" role="status" aria-live="polite">
              Cargando filtros...
            </p>
          )}
          {catalogError && (
            <p className="mb-3 text-sm text-red-600 dark:text-red-400" role="alert" aria-live="assertive">
              {catalogError}
            </p>
          )}
          <div className={`grid gap-3 ${role === "secretary" ? "grid-cols-1 sm:grid-cols-4" : "grid-cols-1 sm:grid-cols-3"}`}>
            <div>
              <label htmlFor="attendance-fecha" className="block text-xs font-medium text-surface-500 mb-1">Fecha</label>
              <div className="flex gap-2">
                <input
                  id="attendance-fecha"
                  type="date"
                  value={draftFilters.fecha}
                  readOnly
                  disabled
                  className="min-w-0 flex-1 px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-100 dark:bg-surface-800 text-sm opacity-80"
                />
                <button
                  type="button"
                  onClick={handleToday}
                  className="px-3 py-2 rounded-xl border border-brand-600 text-brand-600 dark:text-brand-400 text-sm font-medium hover:bg-brand-50 dark:hover:bg-brand-900/20"
                >
                  Hoy
                </button>
              </div>
            </div>
            {role === "secretary" && (
              <div>
                <label htmlFor="attendance-grado" className="block text-xs font-medium text-surface-500 mb-1">Grado</label>
                <select
                  id="attendance-grado"
                  value={draftFilters.grado}
                  onChange={(e) => updateDraft("grado", e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Todos los grados</option>
                  {(filterData?.grados ?? []).map((grado) => (
                    <option key={grado} value={grado}>{grado}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label htmlFor="attendance-disciplina" className="block text-xs font-medium text-surface-500 mb-1">Disciplina</label>
              <select
                id="attendance-disciplina"
                value={draftFilters.disciplina}
                onChange={(e) => updateDraft("disciplina", e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Todas las disciplinas</option>
                {(filterData?.disciplinas ?? []).map((d) => (
                  <option key={d.codigoDisciplina} value={d.codigoDisciplina}>
                    {d.grados.length > 0 ? `${d.nombre} — ${d.grados.length > 1 ? "Grados " : "Grado "}${d.grados.join(", ")}` : d.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="attendance-profesor" className="block text-xs font-medium text-surface-500 mb-1">Profesor</label>
              <select
                id="attendance-profesor"
                value={draftFilters.profesor}
                onChange={(e) => updateDraft("profesor", e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Todos los profesores</option>
                {(filterData?.profesores ?? []).map((t) => (
                  <option key={t.idProfesor} value={t.idProfesor}>
                    {t.nombre} {t.apellido}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <button
              type="button"
              onClick={handleApplyFilters}
              className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-700"
            >
              Aplicar filtros
            </button>
            <button
              type="button"
              onClick={handleClearFilters}
              className="px-4 py-2 border border-surface-300 dark:border-surface-600 text-surface-700 dark:text-surface-200 text-sm font-medium rounded-xl hover:bg-surface-50 dark:hover:bg-surface-800"
            >
              Limpiar filtros
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="px-4 py-2 border border-brand-600 text-brand-600 dark:text-brand-400 text-sm font-medium rounded-xl hover:bg-brand-50 dark:hover:bg-brand-900/20 disabled:opacity-50"
            >
              {exporting ? "Generando..." : "Exportar a Excel"}
            </button>
          </div>
          {exportError && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert" aria-live="assertive">
              {exportError}
            </p>
          )}
        </div>

        {role === "secretary" && (
          <div className="card p-4">
            <p className="text-xs font-medium text-surface-500 mb-2">Filtrar por nivel</p>
            <div className="flex flex-wrap gap-4">
              {NIVELES.map((nivel) => (
                <label key={nivel} className="inline-flex items-center gap-2 text-sm text-surface-700 dark:text-surface-300 cursor-pointer">
                  <input type="checkbox" checked={niveles.includes(nivel)} onChange={() => toggleNivel(nivel)} className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500" />
                  {nivelLabel(nivel)}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="card overflow-hidden p-4">
          <div aria-live="polite" aria-busy={loading}>
            {loading ? (
              <div className="py-8">
                <Loading />
                <p className="mt-2 text-center text-sm text-surface-500">Cargando Asistencia Extracurriculares...</p>
              </div>
            ) : listError ? (
              <div className="text-center py-12 text-sm text-red-600 dark:text-red-400" role="alert">
                {listError}
              </div>
            ) : visibleSessions.length === 0 ? (
              <div className="text-center py-12 text-sm text-surface-500" role="status">
                No hay registros de Asistencia Extracurriculares con los filtros actuales.
              </div>
            ) : (
              <div className="space-y-3">
                {visibleSessions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => navigate(`${basePath}/session/${s.id}`)}
                    className="w-full text-left block bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 hover:border-brand-300 dark:hover:border-brand-700 transition-colors p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-surface-900 dark:text-surface-100 truncate">
                          {s.assignment.discipline.nombre}
                          <span className="ml-2 text-xs text-surface-500">Grado {s.assignment.grade.nombre}</span>
                        </p>
                        <p className="text-sm text-surface-500 mt-0.5">
                          {s.teacher.nombre} {s.teacher.apellido} · {s.schedule.diaSemana} {s.schedule.horaInicio} - {s.schedule.horaFin}
                        </p>
                        <p className="text-xs text-surface-400 mt-1">{formatFecha(s.fecha)}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {(["presente", "ausente", "justificado"] as const).map((est) => (
                            <span key={est} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_LABEL[est].className}`}>
                              {ESTADO_LABEL[est].label}: {s.counts[est]}
                            </span>
                          ))}
                        </div>
                      </div>
                      <span className="text-sm text-brand-600 dark:text-brand-400 font-medium shrink-0">
                        Ver Asistencia Extracurriculares →
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            onPageChange={handlePageChange}
            alwaysRender={role === "secretary"}
          />
        </div>
      </main>
    </div>
  );
}
