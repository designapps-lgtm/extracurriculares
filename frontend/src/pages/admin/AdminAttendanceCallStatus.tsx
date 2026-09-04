import { useCallback, useEffect, useMemo, useState } from "react";
import { getAdminClasses } from "../../services/adminOperations";
import { Loading } from "../../components/common/States";
import type { AttendanceCallStatus, SupervisorCallableClass, SupervisorClassesResponse } from "../../types";

const STATUS_CONFIG: Record<AttendanceCallStatus, { label: string; className: string; dotClass: string }> = {
  no_llamada: {
    label: "No llamada",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    dotClass: "bg-red-500",
  },
  en_curso: {
    label: "En curso",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    dotClass: "bg-amber-500",
  },
  finalizada: {
    label: "Finalizada",
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

  const classes = useMemo(() => sortClasses(data?.classes || []), [data?.classes]);
  const totals = useMemo(() => classes.reduce((result, cls) => {
    result.total += 1;
    result[cls.callStatus] += 1;
    return result;
  }, { total: 0, no_llamada: 0, en_curso: 0, finalizada: 0 }), [classes]);

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
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="self-start px-4 py-2 rounded-xl border border-surface-200 dark:border-surface-700 text-sm font-medium text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 disabled:opacity-50"
        >
          {loading ? "Actualizando..." : "Actualizar"}
        </button>
      </header>

      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <SummaryCard label="Clases programadas" value={totals.total} className="text-surface-900 dark:text-surface-100" />
          <SummaryCard label="Llamadas" value={totals.en_curso + totals.finalizada} className="text-brand-600 dark:text-brand-400" />
          <SummaryCard label="No llamadas" value={totals.no_llamada} className="text-red-600 dark:text-red-400" />
          <SummaryCard label="En curso" value={totals.en_curso} className="text-amber-600 dark:text-amber-400" />
          <SummaryCard label="Finalizadas" value={totals.finalizada} className="text-green-600 dark:text-green-400" />
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
              {classes.map((cls) => <CallStatusCard key={`${cls.idAsignacion}-${cls.schedule.idHorario}`} cls={cls} />)}
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

function CallStatusCard({ cls }: { cls: SupervisorCallableClass }) {
  const status = STATUS_CONFIG[cls.callStatus] || STATUS_CONFIG.no_llamada;
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
      </div>
    </article>
  );
}
