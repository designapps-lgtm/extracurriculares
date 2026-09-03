import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { roleApis, type RoleKind, type RoleUser } from "../../services/roles";
import { useNotify } from "../../components/common/Notify";
import { Loading } from "../../components/common/States";
import Logo from "../../components/common/Logo";
import type {
  SupervisorTeacherSchedule,
  SupervisorAssignmentHistory,
  SupervisorEnrolledStudent,
  Schedule,
} from "../../types";

const DIAS_CORTO: Record<string, string> = {
  LUNES: "Lun",
  MARTES: "Mar",
  MIERCOLES: "Mié",
  JUEVES: "Jue",
  VIERNES: "Vie",
  SABADO: "Sáb",
  DOMINGO: "Dom",
};

const DIAS_ORDEN = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO"];

function diaDeFecha(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "America/Bogota" })
    .format(d)
    .toUpperCase();
}

function hoyInput(): string {
  const t = new Date();
  const mm = String(t.getMonth() + 1).padStart(2, "0");
  const dd = String(t.getDate()).padStart(2, "0");
  return `${t.getFullYear()}-${mm}-${dd}`;
}

function formatFecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric", timeZone: "America/Bogota" });
}

function SessionRow({ session, onView }: { session: { id: string; fecha: string; estado: string; counts: { total: number; presente: number; ausente: number; justificado: number } }; onView: () => void }) {
  const llamoLista = session.estado === "finalizada";
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-surface-200 dark:border-surface-800 px-3 py-2.5 bg-white dark:bg-surface-950">
      <div className="min-w-0">
        <p className="text-sm font-medium text-surface-900 dark:text-surface-100">
          {formatFecha(session.fecha)}
        </p>
        <div className="mt-1">
          {llamoLista ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400">
              Llamó a lista
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-400">
              Sin registro
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {llamoLista && (
          <p className="text-xs text-surface-500 tabular-nums hidden sm:block">
            {session.counts.presente} pres · {session.counts.ausente} aus
          </p>
        )}
        {llamoLista ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onView();
            }}
            className="px-3 py-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 hover:bg-brand-50 dark:hover:bg-brand-950 rounded-lg"
          >
            Ver lista →
          </button>
        ) : (
          <span className="text-xs text-surface-300">—</span>
        )}
      </div>
    </li>
  );
}

function StudentRow({ student }: { student: SupervisorEnrolledStudent }) {
  const inicial = (student.nombre[0] ?? "?").toUpperCase();
  return (
    <li className="flex items-center gap-3 py-2">
      {student.fotoUrl ? (
        <img src={student.fotoUrl} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
      ) : (
        <div className="h-9 w-9 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 flex items-center justify-center text-xs font-semibold shrink-0">
          {inicial}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">
          {student.nombre} {student.apellido}
        </p>
        <p className="text-xs text-surface-500 truncate">
          {student.codigoEstudiante}
          {student.grupo ? ` · ${student.grupo}` : ""}
        </p>
      </div>
      <span className="text-xs text-surface-400 shrink-0">Grado {student.gradoNombre || student.idGrado}</span>
    </li>
  );
}

function ScheduleBlock({
  schedule,
  students,
  sessions,
  onViewSession,
}: {
  schedule: Schedule;
  students: SupervisorEnrolledStudent[];
  sessions: SupervisorAssignmentHistory["schedules"][number]["sessions"];
  onViewSession: (sessionId: string) => void;
}) {
  return (
    <div className="rounded-xl border border-surface-200 dark:border-surface-800 overflow-hidden">
      <div className="px-3 py-2 bg-surface-50 dark:bg-surface-800/60 flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-surface-900 dark:text-surface-100">
          {DIAS_CORTO[schedule.diaSemana] || schedule.diaSemana}
        </span>
        <span className="text-xs text-surface-500 tabular-nums">
          {schedule.horaInicio ?? "?"}–{schedule.horaFin ?? "?"}
        </span>
        {schedule.aula && <span className="text-xs text-surface-400">· {schedule.aula}</span>}
        <span className="ml-auto text-xs text-surface-400">
          {students.length} estudiante{students.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="px-3 py-2.5">
        <p className="text-xs font-medium uppercase tracking-wide text-surface-400 mb-1">
          Estudiantes
        </p>
        {students.length === 0 ? (
          <p className="text-sm text-surface-500">Sin estudiantes matriculados en este horario.</p>
        ) : (
          <ul className="divide-y divide-surface-50 dark:divide-surface-800/60 max-h-48 overflow-y-auto">
            {students.map((st) => (
              <StudentRow key={st.codigoEstudiante} student={st} />
            ))}
          </ul>
        )}

        <p className="text-xs font-medium uppercase tracking-wide text-surface-400 mb-1 mt-4">
          Registros de Asistencia Extracurriculares
        </p>
        {sessions.length === 0 ? (
          <p className="text-sm text-surface-500">
            Todavía no se registró asistencia para este horario.
          </p>
        ) : (
          <ul className="space-y-2">
            {sessions.map((s) => (
              <SessionRow key={s.id} session={s} onView={() => onViewSession(s.id)} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export interface PageProps {
  role?: RoleKind;
}

export default function SupervisorSchedules({ role = "supervisor" }: PageProps) {
  const api = roleApis[role];
  const basePath = role === "secretary" ? "/secretary" : role === "admin" ? "/admin" : "/supervisor";
  const [user, setUser] = useState<RoleUser | null>(null);
  const [assignments, setAssignments] = useState<SupervisorTeacherSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  const [profesor, setProfesor] = useState("");
  const [profesorQuery, setProfesorQuery] = useState("");
  const [grado, setGrado] = useState("");
  const [fecha, setFecha] = useState("");

  const [selectedAsignacion, setSelectedAsignacion] = useState<string | null>(null);
  const [history, setHistory] = useState<SupervisorAssignmentHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [startingKey, setStartingKey] = useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = `${location.pathname}${location.search}`;
  const notify = useNotify();

  const load = useCallback(() => {
    setLoading(true);
    api.getTeacherSchedules()
      .then(setAssignments)
      .catch((err: any) => {
        if (err.message?.includes("401") || err.message?.includes("No autenticado")) {
          navigate("/");
        } else {
          notify.error(err.message || "Error al cargar los horarios");
        }
      })
      .finally(() => setLoading(false));
  }, [api, navigate, notify]);

  useEffect(() => {
    api.me()
      .then(setUser)
      .catch(() => navigate("/"));
  }, [api, navigate]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openHistory = (a: SupervisorTeacherSchedule) => {
    setSelectedAsignacion(a.idAsignacion);
    setHistory(null);
    setHistoryLoading(true);
    api.getAssignmentHistory(a.idAsignacion)
      .then(setHistory)
      .catch((err: any) => notify.error(err.message || "Error al cargar el historial"))
      .finally(() => setHistoryLoading(false));
  };

  const callList = async (a: SupervisorTeacherSchedule, idHorario: string) => {
    if (!api.canCallList || !api.startSession) return;
    const key = `${a.idAsignacion}-${idHorario}`;
    setStartingKey(key);
    try {
      const session = await api.startSession({ idAsignacion: a.idAsignacion, idHorario });
      navigate(`${basePath}/session-attendance/${session.id}`, { state: { returnTo } });
    } catch (err: any) {
      notify.error(err.message || "Error al iniciar la sesión");
    } finally {
      setStartingKey(null);
    }
  };

  const closeHistory = () => setSelectedAsignacion(null);

  const profesores = useMemo(() => {
    const map = new Map<string, { idProfesor: string; nombre: string; apellido: string }>();
    for (const a of assignments) map.set(a.teacher.idProfesor, a.teacher);
    return [...map.values()].sort(
      (x, y) => x.apellido.localeCompare(y.apellido) || x.nombre.localeCompare(y.nombre),
    );
  }, [assignments]);

  const gradosDisponibles = useMemo(() => {
    const set = new Map<number, string>();
    for (const a of assignments) set.set(a.grade.idGrado, a.grade.nombre);
    return [...set.entries()]
      .sort((x, y) => x[0] - y[0])
      .map(([idGrado, nombre]) => ({ idGrado, nombre }));
  }, [assignments]);

  const filtered = useMemo(() => {
    let list = assignments;
    if (profesor) list = list.filter((a) => a.teacher.idProfesor === profesor);
    if (profesorQuery.trim()) {
      const q = profesorQuery.trim().toLowerCase();
      list = list.filter(
        (a) =>
          a.teacher.nombre.toLowerCase().includes(q) ||
          a.teacher.apellido.toLowerCase().includes(q) ||
          `${a.teacher.nombre} ${a.teacher.apellido}`.toLowerCase().includes(q),
      );
    }
    if (grado) list = list.filter((a) => String(a.grade.idGrado) === grado);
    if (fecha) {
      const d = diaDeFecha(fecha);
      list = list.filter((a) => a.schedules.some((sc) => sc.diaSemana === d));
    }
    return list;
  }, [assignments, profesor, profesorQuery, grado, fecha]);

  const renderSchedules = (a: SupervisorTeacherSchedule) =>
    [...a.schedules]
      .sort(
        (x, y) =>
          DIAS_ORDEN.indexOf(x.diaSemana) - DIAS_ORDEN.indexOf(y.diaSemana) ||
          (x.horaInicio ?? "").localeCompare(y.horaInicio ?? ""),
      )
      .map((sch) => (
        <span
          key={sch.idHorario}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-surface-600 dark:text-surface-400 bg-surface-100 dark:bg-surface-800"
        >
          <span className="font-medium">{DIAS_CORTO[sch.diaSemana] || sch.diaSemana}</span>
          <span className="tabular-nums">{sch.horaInicio ?? "?"}–{sch.horaFin ?? "?"}</span>
        </span>
      ));

  const orderedHistorySchedules = (historyArg: SupervisorAssignmentHistory) =>
    [...historyArg.schedules].sort(
      (x, y) =>
        DIAS_ORDEN.indexOf(x.schedule.diaSemana) - DIAS_ORDEN.indexOf(y.schedule.diaSemana) ||
        (x.schedule.horaInicio ?? "").localeCompare(y.schedule.horaInicio ?? ""),
    );

  const hasActiveFilters = profesor !== "" || profesorQuery !== "" || grado !== "" || fecha !== "";

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
              <p className="text-xs text-surface-500">Horarios Extracurriculares de todos los profesores</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-display font-bold text-surface-900 dark:text-surface-100">
            Horarios Extracurriculares de los profesores
          </h1>
          {!loading && (
            <span className="text-xs text-surface-400 shrink-0">
              {filtered.length} de {assignments.length} clase{assignments.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        <div className="card p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1">Buscar profesor</label>
              <input
                type="text"
                value={profesorQuery}
                onChange={(e) => setProfesorQuery(e.target.value)}
                placeholder="Nombre o apellido…"
                className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1">Profesor</label>
              <select
                value={profesor}
                onChange={(e) => setProfesor(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Todos</option>
                {profesores.map((t) => (
                  <option key={t.idProfesor} value={t.idProfesor}>
                    {t.nombre} {t.apellido}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1">Grado</label>
              <select
                value={grado}
                onChange={(e) => setGrado(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Todos</option>
                {gradosDisponibles.map((g) => (
                  <option key={g.idGrado} value={g.idGrado}>
                    {g.nombre}°
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1">Día</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  onClick={() => setFecha(hoyInput())}
                  className="px-3 py-2 shrink-0 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-700"
                >
                  Hoy
                </button>
              </div>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="flex items-center gap-3">
              <p className="text-xs text-surface-400">
                {fecha
                  ? `Mostrando las clases del ${DIAS_CORTO[diaDeFecha(fecha)] || diaDeFecha(fecha)} (${fecha}).`
                  : "Aplicando filtros de las clases."}
              </p>
              <button
                onClick={() => {
                  setProfesor("");
                  setProfesorQuery("");
                  setGrado("");
                  setFecha("");
                }}
                className="text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </div>

        <div className="card overflow-hidden">
          {loading ? (
            <Loading />
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-surface-500">
              No hay clases que coincidan con los filtros actuales.
            </div>
          ) : (
            <div className="divide-y divide-surface-100 dark:divide-surface-800">
              {filtered.map((a) => (
                <div
                  key={a.idAsignacion}
                  className="p-5 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <button
                      onClick={() => openHistory(a)}
                      className="flex-1 min-w-0 text-left focus:outline-none"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-surface-900 dark:text-surface-100">
                          {a.discipline.nombre}
                        </p>
                        <span className="badge-neutral text-xs">{a.grade.nombre}°</span>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {renderSchedules(a)}
                      </div>
                    </button>
                      <div className="sm:flex sm:flex-col sm:items-end gap-2 shrink-0">
                      {api.canCallList && role !== "admin" && (
                        <div className="flex flex-wrap gap-2">
                          {a.schedules.map((sch) => (
                            <button
                              key={`call-${sch.idHorario}`}
                              onClick={() => callList(a, sch.idHorario)}
                              disabled={startingKey !== null}
                              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
                            >
                              {startingKey === `${a.idAsignacion}-${sch.idHorario}` ? "Iniciando..." : `Llamar lista · ${DIAS_CORTO[sch.diaSemana] || sch.diaSemana}`}
                            </button>
                          ))}
                        </div>
                      )}
                      <span className="text-sm text-brand-600 dark:text-brand-400 font-medium">
                        {a.teacher.nombre} {a.teacher.apellido} · Ver estudiantes Extracurriculares →
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {selectedAsignacion && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={closeHistory}
        >
          <div
            className="bg-white dark:bg-surface-900 w-full max-w-lg rounded-2xl shadow-xl overflow-hidden border border-surface-200 dark:border-surface-800"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="px-5 py-4 border-b border-surface-200 dark:border-surface-800 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display font-bold text-surface-900 dark:text-surface-100 truncate">
                  {history?.assignment.discipline.nombre ?? "Clase"}
                  <span className="ml-2 text-sm text-surface-500">Grado {history?.assignment.grade.nombre ?? ""}</span>
                </h2>
                <p className="text-sm text-surface-500 mt-1">
                  {history ? `${history.assignment.teacher.nombre} ${history.assignment.teacher.apellido}` : "Cargando…"}
                </p>
              </div>
              <button
                onClick={closeHistory}
                className="px-2.5 py-1 text-surface-500 hover:text-surface-700 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg text-sm shrink-0"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            <div className="px-5 py-4 max-h-[70vh] overflow-y-auto space-y-3">
              {historyLoading ? (
                <Loading />
              ) : !history ? (
                <p className="text-sm text-surface-500">No se pudo cargar el historial.</p>
              ) : (
                orderedHistorySchedules(history).map((h) => (
                  <ScheduleBlock
                    key={h.schedule.idHorario}
                    schedule={h.schedule}
                    students={h.students}
                    sessions={h.sessions}
                    onViewSession={(sessionId) => navigate(`${basePath}/session/${sessionId}`, { state: { returnTo } })}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
