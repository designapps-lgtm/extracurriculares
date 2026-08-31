import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getSupervisorTeacherSchedules, supervisorMe, supervisorLogout } from "../../services/supervisor";
import { useNotify } from "../../components/common/Notify";
import { Loading } from "../../components/common/States";
import Logo from "../../components/common/Logo";
import type { Supervisor, SupervisorTeacherSchedule, Schedule } from "../../types";

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

interface Clase {
  discipline: SupervisorTeacherSchedule["discipline"];
  grade: SupervisorTeacherSchedule["grade"];
  schedule: Schedule;
}

interface TeacherGrid {
  idProfesor: string;
  nombre: string;
  apellido: string;
  byDay: Record<string, Clase[]>;
}

function buildGrid(items: SupervisorTeacherSchedule[]): TeacherGrid[] {
  const teachers = new Map<string, TeacherGrid>();
  for (const item of items) {
    let t = teachers.get(item.teacher.idProfesor);
    if (!t) {
      t = { idProfesor: item.teacher.idProfesor, nombre: item.teacher.nombre, apellido: item.teacher.apellido, byDay: {} };
      teachers.set(t.idProfesor, t);
    }
    for (const schedule of item.schedules) {
      const day = schedule.diaSemana;
      const list = (t.byDay[day] ??= []);
      list.push({ discipline: item.discipline, grade: item.grade, schedule });
    }
  }
  const sorted = [...teachers.values()];
  sorted.sort((a, b) => a.apellido.localeCompare(b.apellido) || a.nombre.localeCompare(b.nombre));
  for (const t of sorted) {
    for (const day of DIAS_ORDEN) {
      (t.byDay[day] ?? []).sort((a, b) => (a.schedule.horaInicio ?? "").localeCompare(b.schedule.horaInicio ?? ""));
    }
  }
  return sorted;
}

function ClasesCell({ clases }: { clases: Clase[] }) {
  if (clases.length === 0) return null;
  return (
    <div className="space-y-2">
      {clases.map((c, i) => (
        <div
          key={`${c.discipline.codigoDisciplina}-${i}`}
          className="rounded-lg border border-brand-100 dark:border-brand-900/40 bg-brand-50/60 dark:bg-brand-900/20 px-2 py-1.5"
        >
          <p className="text-xs font-medium text-surface-900 dark:text-surface-100 leading-tight">
            {c.discipline.nombre}
            <span className="ml-1 text-[10px] font-medium text-surface-500">{c.grade.nombre}°</span>
          </p>
          <p className="text-[11px] text-surface-600 dark:text-surface-300 tabular-nums leading-tight mt-0.5">
            {c.schedule.horaInicio || "?"}–{c.schedule.horaFin || "?"}
            {c.schedule.aula ? <span className="text-surface-400"> · {c.schedule.aula}</span> : null}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function SupervisorSchedules() {
  const [supervisor, setSupervisor] = useState<Supervisor | null>(null);
  const [teachers, setTeachers] = useState<TeacherGrid[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const notify = useNotify();

  const load = useCallback(() => {
    setLoading(true);
    getSupervisorTeacherSchedules()
      .then((data) => setTeachers(buildGrid(data)))
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

  const handleLogout = async () => {
    await supervisorLogout();
    navigate("/");
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-surface-50 dark:bg-surface-950">
      <header className="bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
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

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-surface-700 dark:text-surface-200">
            Distribución semanal por profesor
          </h2>
          {!loading && (
            <span className="text-xs text-surface-400">
              {teachers.length} profesor{teachers.length === 1 ? "" : "es"}
            </span>
          )}
        </div>

        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-4">
              <Loading />
            </div>
          ) : teachers.length === 0 ? (
            <div className="text-center py-12 text-sm text-surface-500">No hay horarios registrados.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-surface-200 dark:border-surface-800">
                    <th className="sticky left-0 z-10 bg-white dark:bg-surface-900 text-left py-2.5 pr-4 text-xs font-medium uppercase tracking-wide text-surface-400 w-16">
                      Día
                    </th>
                    {teachers.map((t) => (
                      <th
                        key={t.idProfesor}
                        className="text-left py-2.5 px-3 text-xs font-semibold text-surface-700 dark:text-surface-200 whitespace-nowrap"
                      >
                        {t.nombre} {t.apellido}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-50 dark:divide-surface-800/60">
                  {DIAS_ORDEN.map((day) => (
                    <tr key={day} className="align-top">
                      <td className="sticky left-0 z-10 bg-white dark:bg-surface-900 py-3 pr-4 text-xs font-semibold text-surface-500 uppercase whitespace-nowrap">
                        {DIAS_CORTO[day] || day}
                      </td>
                      {teachers.map((t) => (
                        <td key={t.idProfesor} className="py-2.5 px-3">
                          <ClasesCell clases={t.byDay[day] ?? []} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
