import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { getTeachers } from "../services/teachers";
import { useDebounce } from "../hooks";
import { Loading, ErrorMessage, EmptyState } from "../components/common/States";
import { Avatar } from "../components/common/Avatar";
import type { TeacherWithCount } from "../types";

export default function Teachers() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  const [teachers, setTeachers] = useState<TeacherWithCount[]>([]);
  const [meta, setMeta] = useState({ total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);

  const load = () => {
    setLoading(true);
    setError(null);
    getTeachers({ search: debouncedSearch || undefined, limit: 50 })
      .then((res) => {
        setTeachers(res.data);
        setMeta({ total: res.meta.total });
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
  }, [debouncedSearch]);

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Profesores</h1>
        <p className="page-subtitle">{meta.total} profesores</p>
      </div>

      <div className="max-w-md relative">
        <label htmlFor="teacher-search" className="sr-only">
          Buscar profesor
        </label>
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg
            className="h-4 w-4 text-surface-400"
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
        <input
          id="teacher-search"
          type="text"
          placeholder="Buscar por nombre o apellido..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input pl-9"
        />
      </div>

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorMessage message={error} onRetry={load} />
      ) : teachers.length === 0 ? (
        <EmptyState message="No se encontraron profesores." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teachers.map((t) => (
            <Link
              key={t.idProfesor}
              to={`${isAdmin ? "/admin/teachers-view" : "/teachers"}/${t.idProfesor}`}
              className="card-interactive px-5 py-4 group"
            >
              <div className="flex items-center gap-3.5">
                {t.fotoUrl ? (
                  <img
                    src={t.fotoUrl}
                    alt={`${t.nombre} ${t.apellido}`}
                    className="w-11 h-11 rounded-xl object-cover shrink-0"
                  />
                ) : (
                  <Avatar
                    seed={t.idProfesor}
                    className="w-11 h-11 rounded-xl"
                  >
                    {t.nombre.charAt(0)}
                    {t.apellido.charAt(0)}
                  </Avatar>
                )}
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
      )}
    </div>
  );
}
