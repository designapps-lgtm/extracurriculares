import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getStudents } from "../services/students";
import { getDisciplines } from "../services/disciplines";
import { getTeachers } from "../services/teachers";
import { useDebounce } from "../hooks";
import { Loading, ErrorMessage } from "../components/common/States";
import { Avatar } from "../components/common/Avatar";
import type { Student, Discipline, TeacherWithCount } from "../types";

export default function Dashboard() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [inscrito, setInscrito] = useState<"" | "true" | "false">("");
  const [results, setResults] = useState<Student[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [stats, setStats] = useState<{
    students: number;
    disciplines: number;
    teachers: number;
    enrolled: number;
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [teachersList, setTeachersList] = useState<TeacherWithCount[]>([]);

  useEffect(() => {
    Promise.all([
      getStudents({ limit: 1 }),
      getDisciplines({ limit: 50 }),
      getTeachers({ limit: 50 }),
      getStudents({ inscrito: "true", limit: 1 }),
    ])
      .then(([studentsRes, disciplinesRes, teachersRes, enrolledRes]) => {
        setStats({
          students: studentsRes.meta.total,
          disciplines: disciplinesRes.meta.total,
          teachers: teachersRes.meta.total,
          enrolled: enrolledRes.meta.total,
        });
        setDisciplines(disciplinesRes.data);
        setTeachersList(teachersRes.data);
        setStatsLoading(false);
      })
      .catch(() => setStatsLoading(false));
  }, []);

  useEffect(() => {
    if (!debouncedSearch.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    setSearchError(null);

    getStudents({
      search: debouncedSearch,
      limit: 8,
      inscrito: inscrito || undefined,
    })
      .then((res) => {
        setResults(res.data);
        setSearching(false);
      })
      .catch((err) => {
        setSearchError(err.message);
        setSearching(false);
      });
  }, [debouncedSearch, inscrito]);

  const handleResultClick = useCallback(
    (codigo: string) => {
      navigate(`/admin/students/${codigo}`);
    },
    [navigate],
  );

  return (
    <div className="space-y-12">
      {/* Hero — warm branded background, asymmetric */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-50 via-brand-50/80 to-terracotta-50 dark:from-brand-950 dark:via-brand-950/80 dark:to-terracotta-950 border border-brand-100 dark:border-brand-900 px-6 sm:px-10 py-10 sm:py-12">
        {/* Decorative dots */}
        <div className="absolute top-4 right-4 sm:top-6 sm:right-8 grid grid-cols-3 gap-1.5 opacity-30 dark:opacity-20">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-brand-400 dark:bg-brand-500"
            />
          ))}
        </div>
        <div className="absolute bottom-6 right-12 sm:bottom-8 sm:right-20 w-24 h-24 rounded-full bg-terracotta-200/30 dark:bg-terracotta-800/20 blur-2xl" />

        <div className="relative max-w-2xl">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <svg
                className="w-4.5 h-4.5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5"
                />
              </svg>
            </div>
            <span className="text-xs font-medium text-brand-700 dark:text-brand-300 uppercase tracking-wider">
              Panel de control
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-surface-900 dark:text-surface-50 leading-tight">
            Extracurriculares
          </h1>
          <p className="text-surface-600 dark:text-surface-400 text-sm sm:text-base mt-2 max-w-lg leading-relaxed">
            Consulta actividades extracurriculares, estudiantes, profesores y
            horarios.
          </p>
        </div>

        {/* Search + enrollment filter */}
        <div className="relative mt-8 max-w-xl">
          <label htmlFor="dashboard-search" className="sr-only">
            Buscar estudiante
          </label>
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg
              className="h-5 w-5 text-brand-400 dark:text-brand-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <div className="flex flex-col xs:flex-row gap-2 sm:gap-2.5">
            <input
              id="dashboard-search"
              type="text"
              placeholder="Buscar por código, nombre o apellido..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 pl-11 pr-4 py-3 bg-white dark:bg-surface-900 border border-brand-200 dark:border-brand-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent shadow-sm placeholder:text-surface-400"
            />
            <select
              aria-label="Filtrar por inscripción"
              value={inscrito}
              onChange={(e) => setInscrito(e.target.value as "" | "true" | "false")}
              className="px-3 py-3 bg-white dark:bg-surface-900 border border-brand-200 dark:border-brand-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent shadow-sm text-surface-700 dark:text-surface-300"
            >
              <option value="">Todos</option>
              <option value="true">Inscritos</option>
              <option value="false">No inscritos</option>
            </select>
          </div>
          {searching && (
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
              <svg
                className="animate-spin h-4 w-4 text-brand-500"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            </div>
          )}
        </div>

        {/* Search results dropdown */}
        {debouncedSearch.trim() && (
          <div className="relative mt-3 max-w-xl">
            {searchError && <ErrorMessage message={searchError} />}
            {!searching && results.length === 0 && !searchError && (
              <p className="text-surface-400 dark:text-surface-500 text-sm">
                No se encontraron estudiantes
              </p>
            )}
            {results.length > 0 && (
              <div className="bg-white dark:bg-surface-900 border border-brand-200 dark:border-brand-800 rounded-xl shadow-lg overflow-hidden divide-y divide-surface-100 dark:divide-surface-800">
                {results.map((student) => (
                  <button
                    key={student.codigoEstudiante}
                    onClick={() => handleResultClick(student.codigoEstudiante)}
                    className="w-full px-4 py-3 text-left hover:bg-brand-50 dark:hover:bg-brand-950 transition-colors flex items-center justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-surface-900 dark:text-surface-100 text-sm truncate">
                        {student.nombre} {student.apellido}
                      </p>
                      <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                        {student.codigoEstudiante} · {student.grupo || student.grade.nombre}
                      </p>
                    </div>
                    <div className="shrink-0 ml-3">
                      {student.studentSchedules.length > 0 ? (
                        <span className="badge-success">
                          {student.studentSchedules.length}{" "}
                          {student.studentSchedules.length === 1
                            ? "actividad"
                            : "actividades"}
                        </span>
                      ) : (
                        <span className="badge-neutral">Sin asignar</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats — varied cards with left border accent */}
      {statsLoading ? (
        <Loading />
      ) : (
        stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Estudiantes"
              value={stats.students}
              accent="brand"
              to="/admin/students"
            />
            <StatCard
              label="Inscritos"
              value={stats.enrolled}
              accent="terracotta"
              to="/admin/students?inscrito=true"
            />
            <StatCard
              label="No inscritos"
              value={stats.students - stats.enrolled}
              accent="surface"
              to="/admin/students?inscrito=false"
            />
            <StatCard
              label="Disciplinas"
              value={stats.disciplines}
              accent="surface"
              to="/admin/disciplines"
            />
          </div>
        )
      )}

      {/* Quick links — asymmetric feature cards */}
      <div>
        <h2 className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-4">
          Accesos rápidos
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <QuickLink
            to="/admin/students"
            title="Estudiantes"
            description="Consulta y busca estudiantes inscritos por nombre, código o grado"
            icon="students"
            featured
          />
          <QuickLink
            to="/admin/disciplines"
            title="Disciplinas"
            description="Explora las actividades disponibles"
            icon="disciplines"
          />
          <QuickLink
            to="/admin/teachers-view"
            title="Profesores"
            description="Consulta profesores y sus asignaciones"
            icon="teachers"
          />
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-surface-200 dark:border-surface-800" />

      {/* Disciplines overview */}
      {disciplines.length > 0 && (
        <div className="pt-2">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-display font-semibold text-surface-900 dark:text-surface-50 text-lg">
                Disciplinas
              </h2>
              <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                Actividades extracurriculares disponibles
              </p>
            </div>
            <Link
              to="/admin/disciplines"
              className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors inline-flex items-center gap-1"
            >
              Ver todas
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
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {disciplines.slice(0, 6).map((d, i) => (
              <Link
                key={d.codigoDisciplina}
                to={`/admin/disciplines/${d.codigoDisciplina}`}
                className={`group relative bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 shadow-card hover:shadow-card-hover hover:border-brand-300 dark:hover:border-brand-700 transition-all duration-200 px-5 py-5 overflow-hidden ${
                  i === 0 ? "sm:col-span-2 lg:col-span-1" : ""
                }`}
              >
                {/* Top accent bar */}
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-terracotta-400 to-terracotta-300 dark:from-terracotta-600 dark:to-terracotta-700 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-terracotta-50 dark:bg-terracotta-950 flex items-center justify-center shrink-0 group-hover:bg-terracotta-100 dark:group-hover:bg-terracotta-900 transition-colors">
                    <svg
                      className="w-5 h-5 text-terracotta-600 dark:text-terracotta-400"
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
                    <p className="font-medium text-surface-900 dark:text-surface-100">
                      {d.nombre}
                    </p>
                    <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                      {d.codigoDisciplina}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Divider */}
      {disciplines.length > 0 && teachersList.length > 0 && (
      <div className="border-t border-surface-200 dark:border-surface-800 pt-2" />
      )}

      {/* Teachers overview */}
      {teachersList.length > 0 && (
        <div className="pt-10">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-display font-semibold text-surface-900 dark:text-surface-50 text-lg">
                Profesores
              </h2>
              <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                Equipo docente asignado
              </p>
            </div>
            <Link
              to="/admin/teachers-view"
              className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors inline-flex items-center gap-1"
            >
              Ver todos
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
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {teachersList.slice(0, 6).map((t) => (
              <Link
                key={t.idProfesor}
                to={`/admin/teachers-view/${t.idProfesor}`}
                className="card-interactive px-5 py-4 group"
              >
                <div className="flex items-center gap-3.5">
                  <Avatar
                    seed={t.idProfesor}
                  >
                    {t.nombre.charAt(0)}
                    {t.apellido.charAt(0)}
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-medium text-surface-900 dark:text-surface-100 text-sm truncate">
                      {t.nombre} {t.apellido}
                    </p>
                    <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                      {t._count.assignments}{" "}
                      {t._count.assignments === 1
                        ? "asignación"
                        : "asignaciones"}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const STAT_ACCENTS = {
  brand: {
    border: "border-l-brand-500 dark:border-l-brand-400",
    bg: "bg-brand-50/60 dark:bg-brand-950/40",
    value: "text-brand-700 dark:text-brand-300",
    icon: (
      <svg
        className="w-5 h-5 text-brand-600 dark:text-brand-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
        />
      </svg>
    ),
  },
  terracotta: {
    border: "border-l-terracotta-500 dark:border-l-terracotta-400",
    bg: "bg-terracotta-50/60 dark:bg-terracotta-950/40",
    value: "text-terracotta-700 dark:text-terracotta-300",
    icon: (
      <svg
        className="w-5 h-5 text-terracotta-600 dark:text-terracotta-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  surface: {
    border: "border-l-surface-400 dark:border-l-surface-500",
    bg: "bg-surface-50 dark:bg-surface-900",
    value: "text-surface-700 dark:text-surface-200",
    icon: (
      <svg
        className="w-5 h-5 text-surface-500 dark:text-surface-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z"
        />
      </svg>
    ),
  },
} as const;

function StatCard({
  label,
  value,
  accent,
  to,
}: {
  label: string;
  value: number;
  accent: keyof typeof STAT_ACCENTS;
  to?: string;
}) {
  const a = STAT_ACCENTS[accent];
  const inner = (
    <>
      <div className="flex items-center justify-between mb-3">
        <div>{a.icon}</div>
      </div>
      <p className={`text-3xl font-display font-bold ${a.value}`}>
        {value.toLocaleString()}
      </p>
      <p className="text-sm text-surface-500 dark:text-surface-400 mt-1 font-medium">
        {label}
      </p>
    </>
  );
  const className = `bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 border-l-[3px] ${a.border} ${a.bg} px-5 py-5 shadow-card ${
    to ? "transition-all duration-200 hover:shadow-card-hover hover:border-brand-300 dark:hover:border-brand-700 group" : ""
  }`;
  if (to) {
    return <Link to={to} className={className}>{inner}</Link>;
  }
  return <div className={className}>{inner}</div>;
}

function QuickLink({
  to,
  title,
  description,
  icon,
  featured = false,
}: {
  to: string;
  title: string;
  description: string;
  icon: "students" | "disciplines" | "teachers";
  featured?: boolean;
}) {
  const iconConfig = {
    students: {
      bg: "bg-brand-50 dark:bg-brand-950",
      iconBg: "bg-brand-100 dark:bg-brand-900",
      text: "text-brand-600 dark:text-brand-400",
      hoverBorder: "hover:border-brand-300 dark:hover:border-brand-700",
      arrow: "text-brand-400 dark:text-brand-600 group-hover:text-brand-600 dark:group-hover:text-brand-400",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      ),
    },
    disciplines: {
      bg: "bg-terracotta-50 dark:bg-terracotta-950",
      iconBg: "bg-terracotta-100 dark:bg-terracotta-900",
      text: "text-terracotta-600 dark:text-terracotta-400",
      hoverBorder: "hover:border-terracotta-300 dark:hover:border-terracotta-700",
      arrow: "text-terracotta-400 dark:text-terracotta-600 group-hover:text-terracotta-600 dark:group-hover:text-terracotta-400",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
        </svg>
      ),
    },
    teachers: {
      bg: "bg-surface-50 dark:bg-surface-900",
      iconBg: "bg-surface-100 dark:bg-surface-800",
      text: "text-surface-600 dark:text-surface-400",
      hoverBorder: "hover:border-surface-300 dark:hover:border-surface-600",
      arrow: "text-surface-300 dark:text-surface-600 group-hover:text-surface-600 dark:group-hover:text-surface-400",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
        </svg>
      ),
    },
  };

  const c = iconConfig[icon];

  if (featured) {
    return (
      <Link
        to={to}
        className={`group relative bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 ${c.hoverBorder} shadow-card hover:shadow-card-hover transition-all duration-200 overflow-hidden sm:col-span-2 lg:col-span-1`}
      >
        <div className={`px-6 py-6`}>
          <div
            className={`w-12 h-12 rounded-xl ${c.iconBg} flex items-center justify-center mb-4 ${c.text}`}
          >
            {c.icon}
          </div>
          <p className="font-display font-semibold text-surface-900 dark:text-surface-50 text-lg">
            {title}
          </p>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1.5 leading-relaxed">
            {description}
          </p>
          <div className="flex items-center gap-1.5 mt-4 text-sm font-medium text-brand-600 dark:text-brand-400">
            Explorar
            <svg
              className={`w-4 h-4 transition-transform group-hover:translate-x-0.5 ${c.arrow}`}
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
  }

  return (
    <Link
      to={to}
      className={`group relative bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 ${c.hoverBorder} shadow-card hover:shadow-card-hover transition-all duration-200 px-5 py-5 overflow-hidden`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`w-10 h-10 rounded-xl ${c.iconBg} flex items-center justify-center shrink-0 ${c.text}`}
        >
          {c.icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-surface-900 dark:text-surface-100">
            {title}
          </p>
          <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">
            {description}
          </p>
        </div>
        <svg
          className={`w-5 h-5 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-all ${c.arrow}`}
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
    </Link>
  );
}

