import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSecretaryFilters, getSecretaryStudents } from "../../services/secretary";
import { useNotify } from "../../components/common/Notify";
import { Pagination } from "../../components/common/Pagination";
import { Loading } from "../../components/common/States";
import type { Student } from "../../types";

const DAY_LABELS: Record<string, string> = {
  LUNES: "Lun",
  MARTES: "Mar",
  MIERCOLES: "Mié",
  JUEVES: "Jue",
  VIERNES: "Vie",
  SABADO: "Sáb",
};

function enrollmentLabel(student: Student): string {
  if (student.studentSchedules.length === 0) return "No inscrito";
  return student.studentSchedules
    .map((schedule) => `${schedule.discipline?.nombre || schedule.codigoDisciplina} (${DAY_LABELS[schedule.diaSemana] || schedule.diaSemana})`)
    .join(", ");
}

export default function SecretaryStudents() {
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<string[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterGrado, setFilterGrado] = useState("");
  const [filterInscrito, setFilterInscrito] = useState("");
  const [loading, setLoading] = useState(true);
  const notify = useNotify();
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = (page = 1, overrides?: { search?: string; grado?: string; inscrito?: string }) => {
    setLoading(true);
    const params: Record<string, string> = { page: String(page), limit: "20" };
    const searchValue = overrides?.search ?? debouncedSearch;
    const gradoValue = overrides?.grado ?? filterGrado;
    const inscritoValue = overrides?.inscrito ?? filterInscrito;
    if (searchValue) params.search = searchValue;
    if (gradoValue) params.grado = gradoValue;
    if (inscritoValue) params.inscrito = inscritoValue;

    getSecretaryStudents(params)
      .then((response) => {
        setStudents(response.data);
        setMeta(response.meta);
      })
      .catch((error) => notify.error(error.message || "No se pudieron cargar los estudiantes"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    getSecretaryFilters()
      .then((response) => setGrades(response.grados))
      .catch((error) => notify.error(error.message || "No se pudieron cargar los grados"));
  }, []);

  useEffect(() => {
    load(1);
  }, [debouncedSearch, filterGrado, filterInscrito]);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-surface-900 dark:text-surface-100">
          Estudiantes
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Consulta de estudiantes e inscripciones. Esta vista es únicamente de lectura.
        </p>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por código, nombre o apellido..."
            className="flex-1 min-w-[220px] px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <select
            value={filterGrado}
            onChange={(event) => setFilterGrado(event.target.value)}
            className="px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 text-sm"
          >
            <option value="">Todos los grados</option>
            {grades.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
          </select>
          <select
            value={filterInscrito}
            onChange={(event) => setFilterInscrito(event.target.value)}
            className="px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 text-sm"
          >
            <option value="">Todos</option>
            <option value="true">Inscritos</option>
            <option value="false">No inscritos</option>
          </select>
          <button
            type="button"
            onClick={() => load(1)}
            disabled={loading}
            className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Buscando..." : "Buscar"}
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <Loading />
        ) : students.length === 0 ? (
          <div className="text-center py-12 text-surface-500">No se encontraron estudiantes</div>
        ) : (
          <>
            <div className="md:hidden divide-y divide-surface-100 dark:divide-surface-800">
              {students.map((student) => (
                <button
                  type="button"
                  key={student.codigoEstudiante}
                  onClick={() => navigate(`/secretary/students/${student.codigoEstudiante}`)}
                  className="w-full text-left p-4 hover:bg-brand-50/60 dark:hover:bg-brand-950/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-surface-900 dark:text-surface-100 break-words">
                        {student.nombre} {student.apellido}
                      </p>
                      <p className="text-xs font-mono text-surface-500 mt-0.5">
                        {student.codigoEstudiante} · Grado {student.grade.nombre}
                      </p>
                    </div>
                    <span className="text-surface-300 dark:text-surface-600">›</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${student.estado === "activo" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {student.estado}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${student.studentSchedules.length > 0 ? "bg-blue-100 text-blue-800" : "bg-surface-100 text-surface-600"}`}>
                      {student.studentSchedules.length > 0 ? "Inscrito" : "No inscrito"}
                    </span>
                  </div>
                  <p className="text-xs text-surface-500 mt-2 break-words">
                    {enrollmentLabel(student)}
                  </p>
                </button>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-100 dark:border-surface-800">
                    <th className="text-left px-4 py-3 text-xs font-medium text-surface-500 uppercase">Código</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-surface-500 uppercase">Nombre</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-surface-500 uppercase">Grado</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-surface-500 uppercase">Estado</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-surface-500 uppercase">Inscrito en</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-50 dark:divide-surface-800">
                  {students.map((student) => (
                    <tr
                      key={student.codigoEstudiante}
                      onClick={() => navigate(`/secretary/students/${student.codigoEstudiante}`)}
                      className="cursor-pointer hover:bg-brand-50/60 dark:hover:bg-brand-950/40 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-surface-600 dark:text-surface-400">{student.codigoEstudiante}</td>
                      <td className="px-4 py-3 font-medium text-surface-900 dark:text-surface-100">{student.nombre} {student.apellido}</td>
                      <td className="px-4 py-3"><span className="badge-neutral">{student.grade.nombre}</span></td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${student.estado === "activo" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                          {student.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-surface-600 dark:text-surface-300 max-w-md">
                        {enrollmentLabel(student)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <Pagination
          page={meta.page}
          totalPages={meta.totalPages}
          total={meta.total}
          onPageChange={load}
        />
      </div>
    </div>
  );
}
