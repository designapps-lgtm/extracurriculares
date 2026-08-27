import { useParams, Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { getStudentProfile } from "../services/students";
import { Loading, ErrorMessage } from "../components/common/States";
import type { StudentProfile as StudentProfileType } from "../types";

const DAY_ORDER = [
  "LUNES",
  "MARTES",
  "MIERCOLES",
  "JUEVES",
  "VIERNES",
  "SABADO",
];

const DAY_LABELS: Record<string, string> = {
  LUNES: "Lunes",
  MARTES: "Martes",
  MIERCOLES: "Miércoles",
  JUEVES: "Jueves",
  VIERNES: "Viernes",
  SABADO: "Sábado",
};

export default function StudentProfile() {
  const { codigo } = useParams<{ codigo: string }>();
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  const [profile, setProfile] = useState<StudentProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    if (!codigo) return;
    setLoading(true);
    setError(null);
    getStudentProfile(codigo)
      .then((res) => {
        setProfile(res.data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "No se encontró el estudiante");
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
  }, [codigo]);

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} onRetry={load} />;
  if (!profile) return null;

  const { student, extracurricular } = profile;

  const sortedSchedule = extracurricular
    ? [...extracurricular].sort(
        (a, b) => DAY_ORDER.indexOf(a.dia) - DAY_ORDER.indexOf(b.dia),
      )
    : [];

  const groupedByDay = DAY_ORDER.filter((day) =>
    sortedSchedule.some((e) => e.dia === day),
  ).map((day) => ({
    day,
    entries: sortedSchedule.filter((e) => e.dia === day),
  }));

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        to={isAdmin ? "/admin/students" : "/students"}
        className="inline-flex items-center gap-1.5 text-sm text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 transition-colors"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Volver a estudiantes
      </Link>

      {/* Student info card */}
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-br from-brand-600 to-brand-700 px-6 py-8">
          <div className="flex items-start gap-5">
            {student.fotoUrl ? (
              <img
                src={student.fotoUrl}
                alt={`${student.nombre} ${student.apellido}`}
                className="w-20 h-20 rounded-2xl object-cover ring-4 ring-white/20"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 ring-4 ring-white/10">
                <span className="text-white font-display font-bold text-2xl">
                  {student.nombre.charAt(0)}
                  {student.apellido.charAt(0)}
                </span>
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-2xl font-display font-bold text-white">
                {student.nombre} {student.apellido}
              </h1>
              <p className="text-brand-100 text-sm mt-1.5 font-medium">
                Código: {student.codigoEstudiante}
              </p>
              <p className="text-brand-200 text-sm">
                {student.grupo || student.grade.nombre} · {student.grade.nivel || "Secundaria"}
              </p>
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 divide-x divide-surface-100 dark:divide-surface-800">
          <div className="px-4 py-3 text-center">
            <p className="text-lg font-display font-bold text-surface-900 dark:text-surface-100">
              {extracurricular?.length || 0}
            </p>
            <p className="text-xs text-surface-500 dark:text-surface-400">
              Actividades
            </p>
          </div>
          <div className="px-4 py-3 text-center">
            <p className="text-lg font-display font-bold text-surface-900 dark:text-surface-100">
              {groupedByDay.length}
            </p>
            <p className="text-xs text-surface-500 dark:text-surface-400">
              Días ocupados
            </p>
          </div>
          <div className="px-4 py-3 text-center">
            <p className="text-lg font-display font-bold text-surface-900 dark:text-surface-100">
              {student.grade.nombre}
            </p>
            <p className="text-xs text-surface-500 dark:text-surface-400">
              Grado
            </p>
          </div>
        </div>
      </div>

      {/* Schedule grouped by day */}
      <div className="card p-6">
        <h2 className="font-display font-semibold text-surface-900 dark:text-surface-100 text-lg mb-5">
          Horario extracurricular
        </h2>

        {groupedByDay.length > 0 ? (
          <div className="space-y-5">
            {groupedByDay.map(({ day, entries }) => (
              <div key={day}>
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="w-2 h-2 rounded-full bg-brand-500" />
                  <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 uppercase tracking-wide">
                    {DAY_LABELS[day] || day}
                  </h3>
                </div>
                <div className="space-y-2 ml-4">
                  {entries.map((entry, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 bg-surface-50 dark:bg-surface-800 rounded-xl px-4 py-3 border border-surface-100 dark:border-surface-700"
                    >
                      <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-950 flex items-center justify-center shrink-0">
                        <svg
                          className="w-4 h-4 text-brand-600 dark:text-brand-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5"
                          />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">
                          {entry.disciplina.nombre}
                        </p>
                        <p className="text-xs text-surface-500 dark:text-surface-400">
                          {entry.disciplina.codigo}
                        </p>
                        {entry.oferta && (
                          <p className="text-xs text-brand-600 dark:text-brand-400 mt-0.5">
                            {entry.oferta.profesor} · {entry.oferta.horaInicio ?? "—"}–{entry.oferta.horaFin ?? "—"}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-surface-100 dark:bg-surface-800 flex items-center justify-center mx-auto mb-3">
              <svg
                className="w-6 h-6 text-surface-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-surface-500 dark:text-surface-400 text-sm">
              No está inscrito en una actividad extracurricular.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
