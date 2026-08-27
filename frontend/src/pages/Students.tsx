import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { getStudents } from "../services/students";
import { getDisciplines as getDisciplineList } from "../services/disciplines";
import { getGrades } from "../services/grades";
import { useDebounce } from "../hooks";
import { Loading, ErrorMessage, EmptyState } from "../components/common/States";
import type { Student, Discipline, GradeWithCount } from "../types";

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

export default function Students() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  const [students, setStudents] = useState<Student[]>([]);
  const [meta, setMeta] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [grado, setGrado] = useState("");
  const [disciplina, setDisciplina] = useState("");
  const [inscrito, setInscrito] = useState("");
  const [page, setPage] = useState(1);

  const [grades, setGrades] = useState<GradeWithCount[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);

  useEffect(() => {
    getGrades({ limit: 50 })
      .then((r) => setGrades(r.data))
      .catch(() => {});
    getDisciplineList({ limit: 50 })
      .then((r) => setDisciplines(r.data))
      .catch(() => {});
  }, []);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getStudents({
        page,
        limit: 20,
        search: debouncedSearch || undefined,
        grado: grado || undefined,
        disciplina: disciplina || undefined,
        inscrito: inscrito || undefined,
      });
      setStudents(res.data);
      setMeta(res.meta);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Error al cargar estudiantes",
      );
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, grado, disciplina, inscrito]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, grado, disciplina, inscrito]);

  return (
    <div className="space-y-6">
      {/* Mini branded header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-50 via-brand-50/80 to-terracotta-50/50 dark:from-brand-950 dark:via-brand-950/80 dark:to-terracotta-950/50 border border-brand-100 dark:border-brand-900 px-6 sm:px-8 py-8">
        <div className="absolute top-3 right-4 grid grid-cols-2 gap-1 opacity-20 dark:opacity-15">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-brand-400 dark:bg-brand-500"
            />
          ))}
        </div>
        <div className="relative">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-surface-900 dark:text-surface-50">
            Estudiantes
          </h1>
          <p className="text-surface-600 dark:text-surface-400 text-sm mt-1.5">
            {meta.total} estudiantes registrados en el sistema
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 border-l-[3px] border-l-brand-400 dark:border-l-brand-500 p-5 shadow-card">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label
              htmlFor="student-search"
              className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5"
            >
              Buscar
            </label>
            <input
              id="student-search"
              type="text"
              placeholder="Código, nombre o apellido"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label
              htmlFor="filter-grado"
              className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5"
            >
              Grado
            </label>
            <select
              id="filter-grado"
              value={grado}
              onChange={(e) => setGrado(e.target.value)}
              className="input"
            >
              <option value="">Todos</option>
              {grades.map((g) => (
                <option key={g.idGrado} value={g.nombre}>
                  {g.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="filter-disciplina"
              className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5"
            >
              Disciplina
            </label>
            <select
              id="filter-disciplina"
              value={disciplina}
              onChange={(e) => setDisciplina(e.target.value)}
              className="input"
            >
              <option value="">Todas</option>
              {disciplines.map((d) => (
                <option key={d.codigoDisciplina} value={d.codigoDisciplina}>
                  {d.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="filter-inscrito"
              className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5"
            >
              Estado
            </label>
            <select
              id="filter-inscrito"
              value={inscrito}
              onChange={(e) => setInscrito(e.target.value)}
              className="input"
            >
              <option value="">Todos</option>
              <option value="true">Inscritos</option>
              <option value="false">No inscritos</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorMessage message={error} onRetry={loadStudents} />
      ) : students.length === 0 ? (
        <EmptyState message="No se encontraron estudiantes con esos criterios." />
      ) : (
        <>
          <div className="space-y-2">
            {students.map((student) => {
              const enrolled = student.studentSchedules.length > 0;
              return (
                <Link
                  key={student.codigoEstudiante}
                  to={`${isAdmin ? "/admin/students" : "/students"}/${student.codigoEstudiante}`}
                  className={`group block bg-white dark:bg-surface-900 rounded-xl border transition-all duration-200 overflow-hidden ${
                    enrolled
                      ? "border-surface-200 dark:border-surface-800 hover:border-brand-300 dark:hover:border-brand-700 hover:shadow-card-hover"
                      : "border-surface-100 dark:border-surface-800/50 hover:border-surface-300 dark:hover:border-surface-700 hover:shadow-card"
                  }`}
                >
                  <div className="flex items-center gap-4 px-5 py-4">
                    {/* Avatar */}
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-semibold text-sm ${getAvatarColor(student.codigoEstudiante)} ${
                        enrolled ? "ring-2 ring-brand-100 dark:ring-brand-900" : ""
                      }`}
                    >
                      {student.nombre.charAt(0)}
                      {student.apellido.charAt(0)}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-surface-900 dark:text-surface-100 text-sm group-hover:text-brand-700 dark:group-hover:text-brand-400 transition-colors">
                        {student.nombre} {student.apellido}
                      </p>
                      <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                        {student.codigoEstudiante} · {student.grupo || student.grade.nombre}
                      </p>
                    </div>

                    {/* Badge */}
                    <div className="shrink-0 flex items-center gap-3">
                      {enrolled ? (
                        <span className="badge-success">
                          {student.studentSchedules.length}{" "}
                          {student.studentSchedules.length === 1
                            ? "actividad"
                            : "actividades"}
                        </span>
                      ) : (
                        <span className="badge-neutral">Sin asignar</span>
                      )}
                      <svg
                        className="w-4 h-4 text-surface-300 dark:text-surface-600 group-hover:text-brand-400 dark:group-hover:text-brand-500 transition-colors"
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
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Pagination */}
          {meta.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary"
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
                Anterior
              </button>
              <span className="text-sm text-surface-500 dark:text-surface-400 font-medium tabular-nums">
                {meta.page} / {meta.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                disabled={page === meta.totalPages}
                className="btn-secondary"
              >
                Siguiente
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
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
