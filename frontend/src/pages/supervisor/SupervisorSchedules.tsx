import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  getSupervisorTeacherSchedules,
  getSupervisorAssignmentHistory,
  supervisorMe,
  supervisorLogout,
} from "../../services/supervisor";
import { useNotify } from "../../components/common/Notify";
import { Loading } from "../../components/common/States";
import Logo from "../../components/common/Logo";
import type {
  Supervisor,
  SupervisorTeacherSchedule,
  SupervisorAssignmentHistory,
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

function formatFecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
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

function ScheduleBlock({
  schedule,
  sessions,
  onViewSession,
}: {
  schedule: Schedule;
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
      </div>
      <div className="px-3 py-2.5">
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

export default function SupervisorSchedules() {
  const [supervisor, setSupervisor] = useState<Supervisor | null>(null);
  const [assignments, setAssignments] = useState<SupervisorTeacherSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedAsignacion, setSelectedAsignacion] = useState<string | null>(null);
  const [history, setHistory] = useState<SupervisorAssignmentHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const navigate = useNavigate();
  const notify = useNotify();

  const load = useCallback(() => {
    setLoading(true);
    getSupervisorTeacherSchedules()
      .then(setAssignments)
      .catch((err: any) => {
        if (err.message?.includes("401") || err.message?.includes("No autenticado")) {
          navigate("/");
        } else {
          notify.error(err.message || "Error al cargar los horarios");
        }
      })
      .finally(() => setLoading(false));
  }, [navigate, notify]);

  useEffect(() => {
    supervisorMe()
      .then(setSupervisor)
      .catch(() => navigate("/"));
  }, [navigate]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openHistory = (a: SupervisorTeacherSchedule) => {
    setSelectedAsignacion(a.idAsignacion);
    setHistory(null);
    setHistoryLoading(true);
    getSupervisorAssignmentHistory(a.idAsignacion)
      .then(setHistory)
      .catch((err: any) => notify.error(err.message || "Error al cargar el historial"))
      .finally(() => setHistoryLoading(false));
  };

  const closeHistory = () => setSelectedAsignacion(null);

  const handleLogout = async () => {
    await supervisorLogout();
    navigate("/");
  };

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

  return (
    <div className="min-h-screen min-h-[100dvh] bg-surface-50 dark:bg-surface-950">
      <header className="bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Logo chip alt="Extracurriculares" className="h-9 w-auto" />
            <div className="min-w-0">
              <h1 className="text-lg font-display font-bold text-surface-900 dark:text-surface-100 truncate">
                {supervisor?.nombre} {supervisor?.apellido}
              </h1>
              <p className="text-xs text-surface-500">Horarios de todos los profesores</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => navigate("/supervisor/dashboard")}
              className="px-3 py-2 text-sm text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800"
            >
              Asistencias
            </button>
            <button onClick={handleLogout} className="px-3 py-2 -mr-2 text-sm text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800">
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-display font-bold text-surface-900 dark:text-surface-100">
            Horarios de los profesores
          </h1>
          {!loading && (
            <span className="text-xs text-surface-400">
              Toca una clase para ver sus registros de asistencia
            </span>
          )}
        </div>

        <div className="card overflow-hidden">
          {loading ? (
            <Loading />
          ) : assignments.length === 0 ? (
            <div className="text-center py-12 text-sm text-surface-500">
              No hay horarios registrados.
            </div>
          ) : (
            <div className="divide-y divide-surface-100 dark:divide-surface-800">
              {assignments.map((a) => (
                <button
                  key={a.idAsignacion}
                  onClick={() => openHistory(a)}
                  className="w-full text-left p-5 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors focus:outline-none focus:bg-surface-50 dark:focus:bg-surface-800/50"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-surface-900 dark:text-surface-100">
                          {a.discipline.nombre}
                        </p>
                        <span className="badge-neutral text-xs">{a.grade.nombre}°</span>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {renderSchedules(a)}
                      </div>
                    </div>
                    <div className="sm:flex items-center gap-3 shrink-0">
                      <span className="text-sm text-surface-500">
                        {a.teacher.nombre} {a.teacher.apellido}
                      </span>
                      <span className="text-sm text-brand-600 dark:text-brand-400 font-medium">
                        Ver registros →
                      </span>
                    </div>
                  </div>
                </button>
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

            <div className="px-5 py-4 max-h-[65vh] overflow-y-auto space-y-3">
              {historyLoading ? (
                <Loading />
              ) : !history ? (
                <p className="text-sm text-surface-500">No se pudo cargar el historial.</p>
              ) : (
                orderedHistorySchedules(history).map((h) => (
                  <ScheduleBlock
                    key={h.schedule.idHorario}
                    schedule={h.schedule}
                    sessions={h.sessions}
                    onViewSession={(sessionId) => navigate(`/supervisor/session/${sessionId}`)}
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
