import { useParams, Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  getDisciplineByCodigo,
  getDisciplineStudents,
} from "../services/disciplines";
import { Loading, ErrorMessage, EmptyState } from "../components/common/States";
import { Avatar } from "../components/common/Avatar";
import type { DisciplineDetail, Student } from "../types";

export default function DisciplineDetail() {
  const { codigo } = useParams<{ codigo: string }>();
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  const [discipline, setDiscipline] = useState<DisciplineDetail | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const backTo = isAdmin ? "/admin/disciplines" : "/disciplines";
  const studentProfileBase = isAdmin ? "/admin/students" : "/students";

  const load = () => {
    if (!codigo) return;
    setLoading(true);
    setError(null);

    Promise.all([
      getDisciplineByCodigo(codigo),
      getDisciplineStudents(codigo, { limit: 50 }),
    ])
      .then(([discRes, studRes]) => {
        setDiscipline(discRes.data);
        setStudents(studRes.data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
  }, [codigo]);

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} onRetry={load} />;
  if (!discipline) return null;

  const teachers = discipline.assignments.reduce<
    { id: string; nombre: string; apellido: string }[]
  >((acc, a) => {
    if (!acc.find((t) => t.id === a.teacher.idProfesor)) {
      acc.push({
        id: a.teacher.idProfesor,
        nombre: a.teacher.nombre,
        apellido: a.teacher.apellido,
      });
    }
    return acc;
  }, []);

  const gradeNames = [
    ...new Set(discipline.assignments.map((a) => a.grade.nombre)),
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        to={backTo}
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
        Volver a disciplinas
      </Link>

      {/* Header card */}
      <div className="card p-5 sm:p-6">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-terracotta-50 dark:bg-terracotta-950 flex items-center justify-center shrink-0">
            <svg
              className="w-5 h-5 sm:w-6 sm:h-6 text-terracotta-600 dark:text-terracotta-400"
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
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl font-display font-bold text-surface-900 dark:text-surface-50 break-words">
              {discipline.nombre}
            </h1>
            <p className="text-sm text-surface-500 dark:text-surface-400 mt-0.5">
              {discipline.codigoDisciplina}
            </p>
            {discipline.descripcion && (
              <p className="text-sm text-surface-600 dark:text-surface-400 mt-2">
                {discipline.descripcion}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-3">
              <span className="badge-success">
                {discipline._count.studentSchedules} estudiantes inscritos
              </span>
              <span className="badge-neutral">
                {discipline.assignments.length} asignaciones
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Teachers */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-3 font-display">
            Profesores
          </h2>
          {teachers.length > 0 ? (
            <ul className="space-y-2.5">
              {teachers.map((t) => (
                  <li key={t.id}>
                    <Link
                      to={isAdmin ? `/admin/teachers-view/${t.id}` : `/teachers/${t.id}`}
                      className="flex items-center gap-3 p-2 -m-2 rounded-xl hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors group"
                    >
                      <Avatar
                        seed={t.id}
                        className="w-8 h-8 rounded-lg text-xs"
                      >
                        {t.nombre.charAt(0)}
                        {t.apellido.charAt(0)}
                      </Avatar>
                      <span className="text-sm text-surface-700 dark:text-surface-300 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                        {t.nombre} {t.apellido}
                      </span>
                    </Link>
                  </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-surface-400 dark:text-surface-500">
              Sin profesores asignados
            </p>
          )}
        </div>

        {/* Grades */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-3 font-display">
            Grados
          </h2>
          {gradeNames.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {gradeNames.map((g) => (
                <span key={g} className="badge-neutral">
                  {g}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-surface-400 dark:text-surface-500">
              Sin grados asignados
            </p>
          )}
        </div>
      </div>

      {/* Schedules - visual table */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-4 font-display">
          Horarios
        </h2>
        {discipline.assignments.some((a) => a.schedules.length > 0) ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-100 dark:border-surface-800">
                  <th className="text-left py-2.5 pr-4 text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wide">
                    Docente
                  </th>
                  <th className="text-left py-2.5 pr-4 text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wide">
                    Grado
                  </th>
                  <th className="text-left py-2.5 pr-4 text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wide">
                    Día
                  </th>
                  <th className="text-left py-2.5 pr-4 text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wide">
                    Horario
                  </th>
                  <th className="text-left py-2.5 text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wide">
                    Aula
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50 dark:divide-surface-800">
                {discipline.assignments
                  .flatMap((a) =>
                    a.schedules.map((s) => ({
                      key: `${a.teacher.idProfesor}-${a.grade.idGrado}-${s.schedule.diaSemana}`,
                      teacher: a.teacher,
                      grade: a.grade,
                      schedule: s.schedule,
                    }))
                  )
                  .map((row) => (
                    <tr
                      key={row.key}
                      className="hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
                    >
                      <td className="py-3 pr-4 font-medium text-surface-900 dark:text-surface-100">
                        {row.teacher.nombre} {row.teacher.apellido}
                      </td>
                      <td className="py-3 pr-4">
                        <span className="badge-neutral">{row.grade.nombre}</span>
                      </td>
                      <td className="py-3 pr-4 text-surface-600 dark:text-surface-400">
                        {row.schedule.diaSemana}
                      </td>
                      <td className="py-3 pr-4 text-surface-600 dark:text-surface-400 tabular-nums">
                        {row.schedule.horaInicio ?? "—"} – {row.schedule.horaFin ?? "—"}
                      </td>
                      <td className="py-3 text-surface-500 dark:text-surface-400 text-xs">
                        {row.schedule.aula || "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-surface-400 dark:text-surface-500">
            Sin horarios configurados
          </p>
        )}
      </div>

      {/* Students */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-4 font-display">
          Estudiantes inscritos ({students.length})
        </h2>
        {students.length === 0 ? (
          <EmptyState message="No hay estudiantes inscritos en esta disciplina." />
        ) : (
          <div className="space-y-1">
            {students.map((s) => (
              <Link
                key={s.codigoEstudiante}
                to={`${studentProfileBase}/${s.codigoEstudiante}`}
                state={{ from: "discipline", disciplina: codigo }}
                className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors group"
              >
                <div>
                  <p className="text-sm font-medium text-surface-900 dark:text-surface-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                    {s.nombre} {s.apellido}
                  </p>
                  <p className="text-xs text-surface-500 dark:text-surface-400">
                    {s.codigoEstudiante} · {s.grupo || s.grade.nombre}
                  </p>
                </div>
                <svg
                  className="w-4 h-4 text-surface-300 dark:text-surface-600 group-hover:text-brand-400 transition-colors"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
