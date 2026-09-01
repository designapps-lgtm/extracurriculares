import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  getSupervisorClasses,
  supervisorStartSession,
  supervisorMe,
} from "../../services/supervisor";
import { logout } from "../../services/auth";
import { useNotify } from "../../components/common/Notify";
import { Loading } from "../../components/common/States";
import Logo from "../../components/common/Logo";
import type { Supervisor, SupervisorCallableClass, SupervisorClassesResponse } from "../../types";

const DIAS_CORTO: Record<string, string> = {
  LUNES: "Lun", MARTES: "Mar", MIERCOLES: "Mié", JUEVES: "Jue",
  VIERNES: "Vie", SABADO: "Sáb", DOMINGO: "Dom",
};

const DIAS_ORDEN = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO"];

export default function SupervisorClasses() {
  const [supervisor, setSupervisor] = useState<Supervisor | null>(null);
  const [data, setData] = useState<SupervisorClassesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const navigate = useNavigate();
  const notify = useNotify();

  const load = useCallback(() => {
    setLoading(true);
    getSupervisorClasses(true)
      .then(setData)
      .catch((err: any) => {
        if (err.message?.includes("401") || err.message?.includes("No autenticado")) {
          navigate("/");
        } else {
          notify.error(err.message || "Error al cargar las clases");
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

  const loadAll = async () => {
    setLoading(true);
    try {
      const all = await getSupervisorClasses(false);
      setData(all);
    } catch (err: any) {
      notify.error(err.message || "Error al cargar las clases");
    } finally {
      setLoading(false);
    }
  };

  const handleStartSession = async (cls: SupervisorCallableClass) => {
    setStarting(`${cls.idAsignacion}-${cls.schedule.idHorario}`);
    try {
      const session = await supervisorStartSession({
        idAsignacion: cls.idAsignacion,
        idHorario: cls.schedule.idHorario,
      });
      navigate(`/supervisor/session-attendance/${session.id}`);
    } catch (err: any) {
      notify.error(err.message || "Error al iniciar sesión");
    } finally {
      setStarting(null);
    }
  };

  const toggleAll = () => {
    if (!showAll) {
      loadAll();
      setShowAll(true);
    } else {
      load();
      setShowAll(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-surface-50 dark:bg-surface-950 flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  const visible = showAll
    ? data!.classes
    : data!.classes.filter((c) => c.isToday);

  const grouped = visible
    .sort(
      (a, b) =>
        DIAS_ORDEN.indexOf(a.schedule.diaSemana) - DIAS_ORDEN.indexOf(b.schedule.diaSemana) ||
        (a.schedule.horaInicio ?? "").localeCompare(b.schedule.horaInicio ?? ""),
    )
    .reduce((acc, cls) => {
      const day = cls.schedule.diaSemana;
      (acc[day] = acc[day] || []).push(cls);
      return acc;
    }, {} as Record<string, SupervisorCallableClass[]>);

  const days = showAll
    ? DIAS_ORDEN.filter((d) => grouped[d])
    : [data!.dayName];

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
              <p className="text-xs text-surface-500">
                {showAll ? "Todas las clases de todos los profesores" : `Clases de hoy (${data?.dayName ?? ""})`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => navigate("/supervisor/dashboard")}
              className="px-3 py-2 text-sm text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800"
            >
              Asistencias
            </button>
            <button
              onClick={() => navigate("/supervisor/schedules")}
              className="px-3 py-2 text-sm text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800"
            >
              Ver horarios
            </button>
            <button
              onClick={() => navigate("/supervisor/stays")}
              className="px-3 py-2 text-sm text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800"
            >
              Niños que se quedan
            </button>
            <button
              onClick={toggleAll}
              className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-700"
            >
              {showAll ? "Ver solo hoy" : "Ver todas las listas"}
            </button>
            <button onClick={handleLogout} className="px-3 py-2 -mr-2 text-sm text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800">
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {!showAll && (
          <button
            onClick={toggleAll}
            className="w-full px-4 py-2.5 border border-dashed border-brand-300 dark:border-brand-700 text-brand-600 dark:text-brand-400 text-sm font-medium rounded-xl hover:bg-brand-50 dark:hover:bg-brand-900/20"
          >
            Ver todas las listas de todos los profesores →
          </button>
        )}

        {loading && <Loading />}

        {!loading && visible.length === 0 && (
          <div className="card p-10 text-center text-sm text-surface-500">
            {showAll
              ? "No hay clases registradas."
              : "No hay clases programadas para hoy."}
          </div>
        )}

        {days.map((day) => {
          const classes = grouped[day] || [];
          if (classes.length === 0) return null;
          return (
            <div key={day}>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-bold text-surface-600 dark:text-surface-400">
                  {DIAS_CORTO[day] || day}
                </h3>
                {day === data?.dayName && (
                  <span className="px-2 py-0.5 bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300 text-xs font-medium rounded-full">
                    Hoy
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {classes.map((cls) => {
                  const key = `${cls.idAsignacion}-${cls.schedule.idHorario}`;
                  const startingKey = starting === key;
                  return (
                    <div key={key} className="card p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-surface-900 dark:text-surface-100">
                              {cls.discipline.nombre}
                            </p>
                            <span className="badge-neutral text-xs">{cls.grade.nombre}°</span>
                          </div>
                          <p className="text-sm text-surface-500 mt-0.5">
                            {cls.teacher.nombre} {cls.teacher.apellido} · {DIAS_CORTO[cls.schedule.diaSemana] || cls.schedule.diaSemana} {cls.schedule.horaInicio} - {cls.schedule.horaFin}
                            {cls.schedule.aula && ` · ${cls.schedule.aula}`}
                          </p>
                          <p className="text-xs text-surface-400 mt-1">
                            {cls.enrolledCount} inscritos
                            {cls.attendanceCount > 0 && (
                              <span className="ml-2 text-green-600">· {cls.attendanceCount} asistencias</span>
                            )}
                          </p>
                        </div>

                        <div className="sm:ml-4 shrink-0 sm:self-center w-full sm:w-auto">
                          {cls.sessionId ? (
                            <button
                              onClick={() => navigate(`/supervisor/session-attendance/${cls.sessionId}`)}
                              className="w-full sm:w-auto px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-xl hover:bg-amber-600"
                            >
                              {cls.sessionEstado === "finalizada" ? "Reabrir lista" : "Continuar"}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleStartSession(cls)}
                              disabled={starting !== null}
                              className="w-full sm:w-auto px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl disabled:opacity-50"
                            >
                              {startingKey ? "Iniciando..." : "Llamar lista"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}
