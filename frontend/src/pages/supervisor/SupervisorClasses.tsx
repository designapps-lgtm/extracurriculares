import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { roleApis, type RoleKind, type RoleUser } from "../../services/roles";
import { useNotify } from "../../components/common/Notify";
import { Loading } from "../../components/common/States";
import Logo from "../../components/common/Logo";
import type { SupervisorCallableClass, SupervisorClassesResponse } from "../../types";
import { NIVELES, nivelDeGrado, nivelLabel, type Nivel } from "../../utils/niveles";

const DIAS_CORTO: Record<string, string> = {
  LUNES: "Lun", MARTES: "Mar", MIERCOLES: "Mié", JUEVES: "Jue",
  VIERNES: "Vie", SABADO: "Sáb", DOMINGO: "Dom",
};

const DIAS_ORDEN = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO"];

export interface PageProps {
  role?: RoleKind;
}

export default function SupervisorClasses({ role = "supervisor" }: PageProps) {
  const api = roleApis[role];
  const basePath = role === "secretary" ? "/secretary" : role === "admin" ? "/admin" : "/supervisor";
  const [user, setUser] = useState<RoleUser | null>(null);
  const [data, setData] = useState<SupervisorClassesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [niveles, setNiveles] = useState<Nivel[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const navigate = useNavigate();
  const notify = useNotify();

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    api.getClasses(true)
      .then((result) => {
        if (!result || !Array.isArray(result.classes)) {
          throw new Error("La respuesta de clases no tiene un formato válido");
        }
        setData(result);
      })
      .catch((err: any) => {
        if (err.status === 401 || err.message?.includes("401") || err.message?.includes("No autenticado")) {
          navigate("/");
        } else {
          setLoadError(err.message || "No se pudieron cargar las clases");
          notify.error(err.message || "Error al cargar las clases");
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

  const loadAll = async () => {
    setLoading(true);
    try {
      const all = await api.getClasses(false);
      setData(all);
    } catch (err: any) {
      notify.error(err.message || "Error al cargar las clases");
    } finally {
      setLoading(false);
    }
  };

  const handleStartSession = async (cls: SupervisorCallableClass) => {
    if (!api.canCallList || !api.startSession) return;
    setStarting(`${cls.idAsignacion}-${cls.schedule.idHorario}`);
    try {
      const session = await api.startSession({
        idAsignacion: cls.idAsignacion,
        idHorario: cls.schedule.idHorario,
      });
      navigate(`${basePath}/session-attendance/${session.id}`);
    } catch (err: any) {
      notify.error(err.message || "Error al iniciar sesión");
    } finally {
      setStarting(null);
    }
  };

  const handleViewClass = (cls: SupervisorCallableClass) => {
    navigate(`${basePath}/classes/${cls.idAsignacion}/${cls.schedule.idHorario}/students`);
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

  const visible = showAll
    ? (data?.classes ?? [])
    : (data?.classes ?? []).filter((c) => c.isToday);

  const visibleByNivel = useMemo(() => {
    if (niveles.length === 0) return visible;
    return visible.filter((cls) => {
      const grades = cls.grades?.length ? cls.grades : [cls.grade];
      return grades.some((grade) => {
        const nivel = nivelDeGrado(grade.nombre);
        return nivel !== null && niveles.includes(nivel);
      });
    });
  }, [niveles, visible]);

  if (loading && !data) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-surface-50 dark:bg-surface-950 flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-surface-50 dark:bg-surface-950 flex items-center justify-center px-4">
        <div className="card p-8 text-center max-w-md">
          <p className="text-sm text-red-600 dark:text-red-400">{loadError || "No se pudieron cargar las clases."}</p>
          <button type="button" onClick={load} className="mt-4 px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const toggleNivel = (nivel: Nivel) => {
    setNiveles((current) => current.includes(nivel) ? current.filter((item) => item !== nivel) : [...current, nivel]);
  };

  const grouped = visibleByNivel
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
                {user?.nombre} {user?.apellido}
              </h1>
              <p className="text-xs text-surface-500">
                {showAll ? "Todas las Clases Extracurriculares de todos los profesores" : `Clases Extracurriculares de hoy (${data?.dayName ?? ""})`}
                {role !== "supervisor" && " · solo lectura"}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {!showAll && (
          <button
            onClick={toggleAll}
            className="w-full px-4 py-2.5 border border-dashed border-brand-300 dark:border-brand-700 text-brand-600 dark:text-brand-400 text-sm font-medium rounded-xl hover:bg-brand-50 dark:hover:bg-brand-900/20"
          >
            Ver todas las listas de Extracurriculares →
          </button>
        )}

        {loading && <Loading />}

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

        {!loading && visibleByNivel.length === 0 && (
          <div className="card p-10 text-center text-sm text-surface-500">
            {showAll
              ? "No hay Clases Extracurriculares registradas."
              : "No hay Clases Extracurriculares programadas para hoy."}
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
                            <p className="font-semibold text-surface-900 dark:text-surface-100">
                              {cls.discipline.codigoDisciplina}
                            </p>
                            <span className="text-sm text-surface-400 font-normal">{cls.discipline.nombre}</span>
                            {cls.grades && cls.grades.length > 0 ? (
                              <span className="badge-neutral text-xs">
                                {cls.grades.map((g) => g.nombre).join(", ")}
                              </span>
                            ) : (
                              <span className="badge-neutral text-xs">{cls.grade.nombre}°</span>
                            )}
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
                          {!api.canCallList ? (
                            <button
                              onClick={() => handleViewClass(cls)}
                              className="w-full sm:w-auto px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl"
                            >
                              Ver estudiantes Extracurriculares
                            </button>
                          ) : cls.sessionId ? (
                            <button
                              onClick={() => navigate(`${basePath}/session-attendance/${cls.sessionId}`)}
                              className="w-full sm:w-auto px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-xl hover:bg-amber-600"
                            >
                              Llamar lista
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
