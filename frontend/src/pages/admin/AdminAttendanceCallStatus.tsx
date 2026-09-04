import { useCallback, useEffect, useMemo, useState } from "react";
import {
  adminStartSession,
  exportAdminAttendance,
  exportAdminSession,
  getAdminAttendanceList,
  getAdminClasses,
} from "../../services/adminOperations";
import { useNotify } from "../../components/common/Notify";
import { Loading } from "../../components/common/States";
import type { AttendanceResponse, SupervisorCallableClass, SupervisorClassesResponse } from "../../types";

type DisplayCallStatus = "no_llamada" | "llamada";

const STATUS_CONFIG: Record<DisplayCallStatus, { label: string; className: string; dotClass: string }> = {
  no_llamada: {
    label: "No llamada",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    dotClass: "bg-red-500",
  },
  llamada: {
    label: "Llamada",
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    dotClass: "bg-green-500",
  },
};

const CALLER_LABEL: Record<string, string> = {
  teacher: "Profesor",
  supervisor: "Supervisora",
  admin: "Administrador",
  historico: "Registro histórico",
};

const ATTENDANCE_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  presente: { label: "Presente", className: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
  ausente: { label: "Ausente", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  justificado: { label: "Justificado", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  pendiente: { label: "Pendiente", className: "bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-300" },
};

function displayCallStatus(cls: SupervisorCallableClass): DisplayCallStatus {
  return cls.callStatus === "no_llamada" ? "no_llamada" : "llamada";
}

function formatCallDate(value: string | null): string {
  if (!value) return "Sin hora registrada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Hora no disponible";
  return date.toLocaleString("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Bogota",
  });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function className(cls: SupervisorCallableClass): string {
  const grades = cls.grades?.length ? cls.grades.map((grade) => grade.nombre).join(", ") : cls.grade?.nombre || "Sin grado";
  return `${cls.discipline.nombre} · ${grades}`;
}

function sortClasses(classes: SupervisorCallableClass[]): SupervisorCallableClass[] {
  return [...classes].sort((a, b) => {
    const time = (a.schedule.horaInicio || "").localeCompare(b.schedule.horaInicio || "");
    if (time !== 0) return time;
    const teacher = `${a.teacher.apellido} ${a.teacher.nombre}`.localeCompare(`${b.teacher.apellido} ${b.teacher.nombre}`);
    return teacher || a.discipline.nombre.localeCompare(b.discipline.nombre);
  });
}

export default function AdminAttendanceCallStatus() {
  const [data, setData] = useState<SupervisorClassesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attendanceBySession, setAttendanceBySession] = useState<Record<string, AttendanceResponse>>({});
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [attendanceLoadingId, setAttendanceLoadingId] = useState<string | null>(null);
  const [startingKey, setStartingKey] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportingSessionId, setExportingSessionId] = useState<string | null>(null);
  const notify = useNotify();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAdminClasses(true);
      setData(result);
    } catch (err: any) {
      const message = err?.message || "No se pudo cargar el estado de las llamadas.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loadAttendance = async (sessionId: string): Promise<AttendanceResponse | null> => {
    setExpandedSessionId(sessionId);
    const cached = attendanceBySession[sessionId];
    if (cached) return cached;

    setAttendanceLoadingId(sessionId);
    try {
      const attendance = await getAdminAttendanceList(sessionId);
      setAttendanceBySession((current) => ({ ...current, [sessionId]: attendance }));
      return attendance;
    } catch (err: any) {
      setExpandedSessionId(null);
      notify.error(err.message || "No se pudo cargar la lista de asistencia.");
      return null;
    } finally {
      setAttendanceLoadingId(null);
    }
  };

  const handleViewList = async (cls: SupervisorCallableClass) => {
    if (!cls.sessionId) return;
    if (expandedSessionId === cls.sessionId) {
      setExpandedSessionId(null);
      return;
    }
    await loadAttendance(cls.sessionId);
  };

  const handleStartSession = async (cls: SupervisorCallableClass) => {
    const key = `${cls.idAsignacion}-${cls.schedule.idHorario}`;
    setStartingKey(key);
    try {
      const session = await adminStartSession({
        idAsignacion: cls.idAsignacion,
        idHorario: cls.schedule.idHorario,
      });
      await loadAttendance(session.id);
      await load();
    } catch (err: any) {
      notify.error(err.message || "No se pudo iniciar la llamada.");
    } finally {
      setStartingKey(null);
    }
  };

  const handleExportAll = async () => {
    setExporting(true);
    try {
      const blob = await exportAdminAttendance();
      downloadBlob(blob, `asistencias_${data?.date || "hoy"}.xlsx`);
      notify.success("Excel generado");
    } catch (err: any) {
      notify.error(err.message || "No se pudieron exportar las asistencias.");
    } finally {
      setExporting(false);
    }
  };

  const handleExportSession = async (sessionId: string) => {
    setExportingSessionId(sessionId);
    try {
      const blob = await exportAdminSession(sessionId);
      downloadBlob(blob, `asistencia_${sessionId}.xlsx`);
      notify.success("Excel generado");
    } catch (err: any) {
      notify.error(err.message || "No se pudo exportar la asistencia.");
    } finally {
      setExportingSessionId(null);
    }
  };

  const classes = useMemo(() => sortClasses(data?.classes || []), [data?.classes]);
  const totals = useMemo(() => classes.reduce((result, cls) => {
    result.total += 1;
    result[displayCallStatus(cls)] += 1;
    return result;
  }, { total: 0, no_llamada: 0, llamada: 0 }), [classes]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-brand-600 dark:text-brand-400">Operación diaria</p>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-surface-900 dark:text-surface-100">Estado de llamadas</h1>
          <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">
            Consulta qué clases de hoy ya iniciaron la asistencia y quién la llamó.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start">
          <button
            type="button"
            onClick={handleExportAll}
            disabled={exporting || !data}
            className="px-4 py-2 rounded-xl border border-brand-600 text-sm font-medium text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950 disabled:opacity-50"
          >
            {exporting ? "Generando..." : "Exportar a Excel"}
          </button>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="px-4 py-2 rounded-xl border border-surface-200 dark:border-surface-700 text-sm font-medium text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 disabled:opacity-50"
          >
            {loading ? "Actualizando..." : "Actualizar"}
          </button>
        </div>
      </header>

      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          <SummaryCard label="Clases programadas" value={totals.total} className="text-surface-900 dark:text-surface-100" />
          <SummaryCard label="Llamadas" value={totals.llamada} className="text-green-600 dark:text-green-400" />
          <SummaryCard label="No llamadas" value={totals.no_llamada} className="text-red-600 dark:text-red-400" />
        </div>
      )}

      {loading && !data && <Loading />}

      {error && !data && (
        <div className="card p-6 text-center">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <button type="button" onClick={load} className="mt-4 px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700">
            Reintentar
          </button>
        </div>
      )}

      {data && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100">Clases de hoy</h2>
              <p className="text-sm text-surface-500 dark:text-surface-400">{data.dayName} · {data.date}</p>
            </div>
            {loading && <span className="text-xs text-surface-500">Actualizando...</span>}
          </div>

          {classes.length === 0 ? (
            <div className="card p-8 text-center text-sm text-surface-500">No hay clases programadas para hoy.</div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {classes.map((cls) => (
                <CallStatusCard
                  key={`${cls.idAsignacion}-${cls.schedule.idHorario}`}
                  cls={cls}
                  attendance={cls.sessionId ? attendanceBySession[cls.sessionId] : undefined}
                  expanded={cls.sessionId === expandedSessionId}
                  attendanceLoading={cls.sessionId === attendanceLoadingId}
                  actionLoading={startingKey === `${cls.idAsignacion}-${cls.schedule.idHorario}`}
                  exporting={cls.sessionId === exportingSessionId}
                  onCall={() => handleStartSession(cls)}
                  onViewList={() => handleViewList(cls)}
                  onExport={() => cls.sessionId && handleExportSession(cls.sessionId)}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function SummaryCard({ label, value, className: valueClass }: { label: string; value: number; className: string }) {
  return (
    <div className="card p-4 sm:p-5">
      <p className="text-xs sm:text-sm text-surface-500 dark:text-surface-400">{label}</p>
      <p className={`mt-1 text-2xl sm:text-3xl font-display font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}

function CallStatusCard({
  cls,
  attendance,
  expanded,
  attendanceLoading,
  actionLoading,
  exporting,
  onCall,
  onViewList,
  onExport,
}: {
  cls: SupervisorCallableClass;
  attendance?: AttendanceResponse;
  expanded: boolean;
  attendanceLoading: boolean;
  actionLoading: boolean;
  exporting: boolean;
  onCall: () => void;
  onViewList: () => void;
  onExport: () => void;
}) {
  const displayStatus = displayCallStatus(cls);
  const status = STATUS_CONFIG[displayStatus];
  const caller = cls.calledBy;
  const callerName = caller ? `${caller.nombre} ${caller.apellido}`.trim() : "Nadie ha llamado la asistencia";

  return (
    <article className="card p-4 sm:p-5">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-surface-900 dark:text-surface-100 break-words">{cls.discipline.codigoDisciplina}</p>
            <p className="text-sm text-surface-500 dark:text-surface-400 break-words">{className(cls)}</p>
          </div>
          <span className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${status.className}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status.dotClass}`} />
            {status.label}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-surface-500 dark:text-surface-400">Profesor asignado</p>
            <p className="mt-0.5 text-surface-800 dark:text-surface-200">{cls.teacher.nombre} {cls.teacher.apellido}</p>
          </div>
          <div>
            <p className="text-xs text-surface-500 dark:text-surface-400">Horario</p>
            <p className="mt-0.5 text-surface-800 dark:text-surface-200">
              {cls.schedule.horaInicio || "Sin hora"} - {cls.schedule.horaFin || "Sin hora"}
              {cls.schedule.aula ? ` · ${cls.schedule.aula}` : ""}
            </p>
          </div>
          <div>
            <p className="text-xs text-surface-500 dark:text-surface-400">Hora de llamada</p>
            <p className="mt-0.5 text-surface-800 dark:text-surface-200">{formatCallDate(cls.llamadaAt)}</p>
          </div>
          <div>
            <p className="text-xs text-surface-500 dark:text-surface-400">Llamó</p>
            <p className="mt-0.5 text-surface-800 dark:text-surface-200">
              {caller ? `${CALLER_LABEL[caller.type] || "Usuario"}: ${callerName}` : "Nadie ha llamado la asistencia"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1 border-t border-surface-100 dark:border-surface-800">
          {displayStatus === "no_llamada" ? (
            <button
              type="button"
              onClick={onCall}
              disabled={actionLoading}
              className="px-3 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
            >
              {actionLoading ? "Iniciando..." : "Llamar lista"}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onViewList}
                disabled={attendanceLoading}
                className="px-3 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
              >
                {attendanceLoading ? "Cargando lista..." : expanded ? "Ocultar lista" : "Ver lista"}
              </button>
              <button
                type="button"
                onClick={onExport}
                disabled={exporting}
                className="px-3 py-2 rounded-lg border border-brand-600 text-brand-600 dark:text-brand-400 text-sm font-medium hover:bg-brand-50 dark:hover:bg-brand-950 disabled:opacity-50"
              >
                {exporting ? "Generando..." : "Excel"}
              </button>
            </>
          )}
        </div>

        {expanded && (
          <div className="border-t border-surface-100 dark:border-surface-800 pt-3">
            {attendanceLoading ? (
              <p className="text-sm text-surface-500">Cargando lista de asistencia...</p>
            ) : attendance ? (
              <AttendanceList attendance={attendance} />
            ) : null}
          </div>
        )}
      </div>
    </article>
  );
}

function AttendanceList({ attendance }: { attendance: AttendanceResponse }) {
  const counts = attendance.students.reduce(
    (result, student) => {
      if (student.estado === "presente") result.presente += 1;
      else if (student.estado === "ausente") result.ausente += 1;
      else if (student.estado === "justificado") result.justificado += 1;
      else result.pendiente += 1;
      return result;
    },
    { presente: 0, ausente: 0, justificado: 0, pendiente: 0 },
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-surface-900 dark:text-surface-100">Lista de asistencia</p>
          <p className="text-xs text-surface-500">{attendance.students.length} estudiantes</p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">P: {counts.presente}</span>
          <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">A: {counts.ausente}</span>
          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">J: {counts.justificado}</span>
          {counts.pendiente > 0 && <span className="px-2 py-0.5 rounded-full bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-300">Pendientes: {counts.pendiente}</span>}
        </div>
      </div>

      {attendance.students.length === 0 ? (
        <p className="text-sm text-surface-500">No hay estudiantes en esta lista.</p>
      ) : (
        <ul className="max-h-72 overflow-y-auto divide-y divide-surface-100 dark:divide-surface-800 rounded-lg border border-surface-200 dark:border-surface-700">
          {attendance.students.map((student) => {
            const status = ATTENDANCE_STATUS_CONFIG[student.estado] || {
              label: student.estado,
              className: "bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-300",
            };
            return (
              <li key={student.codigoEstudiante} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">
                    {student.nombre} {student.apellido}
                  </p>
                  <p className="text-xs text-surface-500 truncate">
                    {student.codigoEstudiante}{student.grupo ? ` · ${student.grupo}` : ""}
                  </p>
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${status.className}`}>
                  {status.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
