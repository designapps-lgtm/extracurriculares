import { useParams, Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { getTeacherById, getTeacherAssignments } from "../services/teachers";
import { Loading, ErrorMessage } from "../components/common/States";
import type { Teacher, TeacherAssignment } from "../types";

const AVATAR_COLORS = [
  "bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300",
  "bg-terracotta-100 text-terracotta-700 dark:bg-terracotta-900 dark:text-terracotta-300",
  "bg-surface-200 text-surface-700 dark:bg-surface-700 dark:text-surface-200",
];

function getAvatarColor(id: string) {
  const index =
    id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) %
    AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

function formatGradeSpan(names: string[]) {
  const numbers = names
    .map((name) => Number.parseInt(name, 10))
    .filter((n) => Number.isFinite(n));

  if (numbers.length === names.length && numbers.length > 1) {
    const sorted = [...new Set(numbers)].sort((a, b) => a - b);
    const contiguous = sorted.every((n, i) => i === 0 || n === sorted[i - 1] + 1);
    if (contiguous) return `${sorted[0]} a ${sorted[sorted.length - 1]}`;
  }

  return names.join(", ");
}

export default function TeacherDetail() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    Promise.all([getTeacherById(id), getTeacherAssignments(id)])
      .then(([teacherRes, assignRes]) => {
        setTeacher(teacherRes.data);
        setAssignments(assignRes.data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
  }, [id]);

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} onRetry={load} />;
  if (!teacher) return null;

  const disciplines = [
    ...new Set(assignments.map((a) => a.discipline.nombre)),
  ];
  const grades = [...new Set(assignments.map((a) => a.grade.nombre))];
  const compactGrades =
    grades.length > 1 &&
    grades.every((g) => Number.isFinite(Number.parseInt(g, 10))) &&
    (() => {
      const sorted = [...new Set(grades.map((g) => Number.parseInt(g, 10)))].sort((a, b) => a - b);
      return sorted.every((n, i) => i === 0 || n === sorted[i - 1] + 1);
    })();
  const gradeSummary = grades.length > 0 ? formatGradeSpan(grades) : "";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        to={isAdmin ? "/admin/teachers" : "/teachers"}
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
        Volver a Profesores Extracurriculares
      </Link>

      {/* Header card */}
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-br from-brand-600 to-brand-700 px-6 py-8">
          <div className="flex items-start gap-5">
            {teacher.fotoUrl ? (
              <img
                src={teacher.fotoUrl}
                alt={`${teacher.nombre} ${teacher.apellido}`}
                className="w-20 h-20 rounded-2xl object-cover ring-4 ring-white/20 shrink-0"
              />
            ) : (
              <div
                className={`w-20 h-20 rounded-2xl flex items-center justify-center shrink-0 font-display font-bold text-2xl bg-white/20 ring-4 ring-white/10 ${getAvatarColor(id || "")}`}
              >
                <span className="text-white">
                  {teacher.nombre.charAt(0)}
                  {teacher.apellido.charAt(0)}
                </span>
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-2xl font-display font-bold text-white">
                {teacher.nombre} {teacher.apellido}
              </h1>
              {teacher.codigoProfesor && (
                <p className="text-brand-100 text-sm mt-1.5 font-medium">
                  Código: {teacher.codigoProfesor}
                </p>
              )}
              {teacher.correo && (
                <a
                  href={`mailto:${teacher.correo}`}
                  className="text-brand-200 text-sm mt-0.5 inline-flex items-center gap-1.5 hover:text-white transition-colors"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                    />
                  </svg>
                  {teacher.correo}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Disciplines */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-3 font-display">
Disciplinas Extracurriculares          </h2>
          {disciplines.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {disciplines.map((d) => (
                <span key={d} className="badge-success">
                  {d}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-surface-400 dark:text-surface-500">
              Sin disciplinas asignadas
            </p>
          )}
        </div>

        {/* Grades */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-3 font-display">
            Grados
          </h2>
          {grades.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {compactGrades ? (
                <span className="badge-neutral">{gradeSummary}</span>
              ) : (
                grades.map((g) => (
                  <span key={g} className="badge-neutral">
                    {g}
                  </span>
                ))
              )}
            </div>
          ) : (
            <p className="text-sm text-surface-400 dark:text-surface-500">
              Sin grados asignados
            </p>
          )}
        </div>
      </div>

      {/* Assignments */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-4 font-display">
Asignaciones Extracurriculares        </h2>
        {assignments.length === 0 ? (
          <p className="text-sm text-surface-400 dark:text-surface-500">
            Sin asignaciones
          </p>
        ) : (
          <div className="space-y-2">
            {assignments.map((a, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-3 px-4 rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-100 dark:border-surface-700"
              >
                <div className="flex items-center gap-3 min-w-0">
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
                    <p className="text-sm font-medium text-surface-900 dark:text-surface-100">
                      {a.discipline.nombre}
                    </p>
                    <p className="text-xs text-surface-500 dark:text-surface-400">
                      {a.grade.nombre} · {a.discipline.codigoDisciplina}
                    </p>
                  </div>
                </div>
                {a.schedules.length > 0 && (
                  <div className="shrink-0 ml-4 text-right">
                    {a.schedules.map((s, i) => (
                      <div key={i}>
                        <p className="text-sm font-medium text-surface-700 dark:text-surface-300 tabular-nums">
                          {s.schedule.horaInicio ?? "—"}–{s.schedule.horaFin ?? "—"}
                        </p>
                        <p className="text-xs text-surface-500 dark:text-surface-400">
                          {s.schedule.diaSemana}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
