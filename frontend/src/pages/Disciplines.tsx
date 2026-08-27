import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { getDisciplines } from "../services/disciplines";
import { useDebounce } from "../hooks";
import { Loading, ErrorMessage, EmptyState } from "../components/common/States";
import type { Discipline } from "../types";

export default function Disciplines() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [meta, setMeta] = useState({ total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);

  const load = () => {
    setLoading(true);
    setError(null);
    getDisciplines({ search: debouncedSearch || undefined, limit: 50 })
      .then((res) => {
        setDisciplines(res.data);
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
        <h1 className="page-title">Disciplinas</h1>
        <p className="page-subtitle">
          {meta.total} disciplinas disponibles
        </p>
      </div>

      <div className="max-w-md relative">
        <label htmlFor="disc-search" className="sr-only">
          Buscar disciplina
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
          id="disc-search"
          type="text"
          placeholder="Buscar por nombre o código..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input pl-9"
        />
      </div>

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorMessage message={error} onRetry={load} />
      ) : disciplines.length === 0 ? (
        <EmptyState message="No se encontraron disciplinas." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {disciplines.map((d) => (
            <Link
              key={d.codigoDisciplina}
              to={`${isAdmin ? "/admin/disciplines" : "/disciplines"}/${d.codigoDisciplina}`}
              className="card-interactive px-5 py-5 group"
            >
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
                  {d.descripcion && (
                    <p className="text-sm text-surface-600 dark:text-surface-400 mt-2 line-clamp-2">
                      {d.descripcion}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
