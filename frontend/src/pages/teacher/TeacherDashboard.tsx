import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getTeacherClasses, teacherLogout, startSession } from "../../services/teacher";
import { useNotify } from "../../components/common/Notify";
import type { TeacherClass } from "../../types";

const DIAS_ORDER = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO"];
const DIAS_ES: Record<string, string> = {
  LUNES: "Lunes", MARTES: "Martes", MIERCOLES: "Miércoles",
  JUEVES: "Jueves", VIERNES: "Viernes", SABADO: "Sábado", DOMINGO: "Domingo",
};

export default function TeacherDashboard() {
  const [teacher, setTeacher] = useState<{ idProfesor: string; nombre: string; apellido: string } | null>(null);
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [dayName, setDayName] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const navigate = useNavigate();
  const notify = useNotify();

  useEffect(() => {
    getTeacherClasses()
      .then((data) => {
        setTeacher(data.teacher);
        setClasses(data.classes);
        setDayName(data.dayName);
        setDate(data.date);
      })
      .catch((err: any) => {
        if (err.message?.includes("401") || err.message?.includes("No autenticado")) {
          navigate("/teacher/login");
        }
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  const handleStartSession = async (cls: TeacherClass) => {
    setStarting(`${cls.idAsignacion}-${cls.schedule.idHorario}`);
    try {
      const session = await startSession({
        idAsignacion: cls.idAsignacion,
        idHorario: cls.schedule.idHorario,
      });
      navigate(`/teacher/session/${session.id}`);
    } catch (err: any) {
      notify.error(err.message || "Error al iniciar sesión");
    } finally {
      setStarting(null);
    }
  };

  const handleLogout = async () => {
    await teacherLogout();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-surface-50 dark:bg-surface-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const grouped = classes.reduce((acc, cls) => {
    const day = cls.schedule.diaSemana;
    (acc[day] = acc[day] || []).push(cls);
    return acc;
  }, {} as Record<string, TeacherClass[]>);

  const sortedDays = DIAS_ORDER.filter((d) => grouped[d]);
  const sortedDaysReordered = [
    ...sortedDays.filter((d) => d === dayName),
    ...sortedDays.filter((d) => d !== dayName),
  ];

  return (
    <div className="min-h-screen min-h-[100dvh] bg-surface-50 dark:bg-surface-950">
      <header className="bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-display font-bold text-surface-900 dark:text-surface-100">
              {teacher?.nombre} {teacher?.apellido}
            </h1>
            <p className="text-xs text-surface-500">Hoy es {DIAS_ES[dayName] || dayName} · {date}</p>
          </div>
          <button onClick={handleLogout} className="px-3 py-2 -mr-2 text-sm text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800">
            Salir
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {classes.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-surface-500">No tienes asignaciones registradas.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {sortedDaysReordered.map((day) => {
              const isToday = day === dayName;
              return (
                <div key={day}>
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className={`text-sm font-bold ${isToday ? "text-brand-600" : "text-surface-600 dark:text-surface-400"}`}>
                      {DIAS_ES[day] || day}
                    </h3>
                    {isToday && (
                      <span className="px-2 py-0.5 bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300 text-xs font-medium rounded-full">
                        Hoy
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {grouped[day].map((cls) => {
                      const key = `${cls.idAsignacion}-${cls.schedule.idHorario}`;
                      const startingKey = starting === key;
                      return (
                        <div key={key} className={`card p-4 ${isToday ? "ring-2 ring-brand-200 dark:ring-brand-800" : ""}`}>
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-surface-900 dark:text-surface-100">
                                {cls.discipline.nombre}
                              </p>
                              <p className="text-sm text-surface-500 mt-0.5">
                                Grado {cls.grade.nombre} · {cls.schedule.horaInicio} - {cls.schedule.horaFin}
                                {cls.schedule.aula && ` · ${cls.schedule.aula}`}
                              </p>
                              <p className="text-xs text-surface-400 mt-1">
                                {cls.enrolledCount} inscritos
                                {cls.sessionEstado === "finalizada" && cls.attendanceCount > 0 && (
                                  <span className="ml-2 text-green-600">· {cls.attendanceCount} asistencias</span>
                                )}
                              </p>
                            </div>

                            <div className="sm:ml-4 shrink-0 sm:self-start w-full sm:w-auto">
                              {cls.sessionEstado === "finalizada" ? (
                                <span className="inline-flex items-center text-xs text-green-600 font-medium py-2">
                                  Finalizada
                                </span>
                              ) : cls.sessionId ? (
                                <button
                                  onClick={() => navigate(`/teacher/session/${cls.sessionId}`)}
                                  className="w-full sm:w-auto px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-xl hover:bg-amber-600"
                                >
                                  Continuar
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleStartSession(cls)}
                                  disabled={starting !== null}
                                  className={`w-full sm:w-auto px-4 py-2 text-white text-sm font-medium rounded-xl disabled:opacity-50 ${
                                    isToday
                                      ? "bg-brand-600 hover:bg-brand-700"
                                      : "bg-surface-500 hover:bg-surface-600"
                                  }`}
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
          </div>
        )}
      </main>
    </div>
  );
}
