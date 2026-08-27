import { useState, useEffect } from "react";
import { getAdminStudents, updateAdminStudent, getAdminGrades } from "../../services/admin";
import { useNotify } from "../../components/common/Notify";
import { Pagination } from "../../components/common/Pagination";
import { Loading } from "../../components/common/States";
import type { Student, Grade } from "../../types";

export default function AdminStudents() {
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [search, setSearch] = useState("");
  const [filterGrado, setFilterGrado] = useState("");
  const [filterInscrito, setFilterInscrito] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Student | null>(null);
  const [editForm, setEditForm] = useState<Partial<Student>>({});

  const notify = useNotify();

  const load = (page = 1, overrides?: { search?: string; filtroGrado?: string; filtroInscrito?: string }) => {
    setLoading(true);
    const params: Record<string, string> = { page: String(page), limit: "20" };
    const searchValue = overrides?.search ?? search;
    const gradoValue = overrides?.filtroGrado ?? filterGrado;
    const inscritoValue = overrides?.filtroInscrito ?? filterInscrito;
    if (searchValue) params.search = searchValue;
    if (gradoValue) params.grado = gradoValue;
    if (inscritoValue) params.inscrito = inscritoValue;

    getAdminStudents(params)
      .then((res) => {
        setStudents(res.data);
        setMeta(res.meta);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    getAdminGrades().then((res) => setGrades(res.data)).catch(console.error);
  }, []);

  const handleSearch = () => load(1);

  const handleEdit = (student: Student) => {
    setEditing(student);
    setEditForm({
      nombre: student.nombre,
      apellido: student.apellido,
      idGrado: student.idGrado,
      grupo: student.grupo,
      correo: student.correo,
      estado: student.estado,
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    try {
      await updateAdminStudent(editing.codigoEstudiante, editForm);
      setEditing(null);
      load(meta.page);
    } catch (err: any) {
      notify.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold text-surface-900 dark:text-surface-100">
        Estudiantes
      </h1>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Buscar por código, nombre o apellido..."
            className="flex-1 min-w-[200px] px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <select
            value={filterGrado}
            onChange={(e) => { const v = e.target.value; setFilterGrado(v); load(1, { filtroGrado: v }); }}
            className="px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 text-sm"
          >
            <option value="">Todos los grados</option>
            {grades.map((g) => (
              <option key={g.idGrado} value={g.nombre}>{g.nombre}</option>
            ))}
          </select>
          <select
            value={filterInscrito}
            onChange={(e) => { const v = e.target.value; setFilterInscrito(v); load(1, { filtroInscrito: v }); }}
            className="px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 text-sm"
          >
            <option value="">Todos</option>
            <option value="true">Inscritos</option>
            <option value="false">No inscritos</option>
          </select>
          <button onClick={handleSearch} className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-700 transition-colors">
            Buscar
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <Loading />
        ) : students.length === 0 ? (
          <div className="text-center py-12 text-surface-500">No se encontraron estudiantes</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-100 dark:border-surface-800">
                  <th className="text-left px-4 py-3 text-xs font-medium text-surface-500 uppercase">Código</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-surface-500 uppercase">Nombre</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-surface-500 uppercase">Grado</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-surface-500 uppercase">Estado</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-surface-500 uppercase">Inscrito</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-surface-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50 dark:divide-surface-800">
                {students.map((s) => (
                  <tr key={s.codigoEstudiante} className="hover:bg-surface-50 dark:hover:bg-surface-800">
                    <td className="px-4 py-3 font-mono text-xs text-surface-600 dark:text-surface-400">{s.codigoEstudiante}</td>
                    <td className="px-4 py-3 font-medium text-surface-900 dark:text-surface-100">{s.nombre} {s.apellido}</td>
                    <td className="px-4 py-3"><span className="badge-neutral">{s.grade.nombre}</span></td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.estado === "activo" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                        {s.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.studentSchedules.length > 0 ? "bg-blue-100 text-blue-800" : "bg-surface-100 text-surface-600"}`}>
                        {s.studentSchedules.length > 0 ? "Inscrito" : "No inscrito"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleEdit(s)} className="text-brand-600 hover:text-brand-700 text-sm font-medium">
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <Pagination
          page={meta.page}
          totalPages={meta.totalPages}
          total={meta.total}
          onPageChange={load}
        />
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white dark:bg-surface-900 rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-display font-bold text-surface-900 dark:text-surface-100 mb-4">
              Editar estudiante
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1">Nombre</label>
                <input
                  value={editForm.nombre || ""}
                  onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1">Apellido</label>
                <input
                  value={editForm.apellido || ""}
                  onChange={(e) => setEditForm({ ...editForm, apellido: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1">Grupo</label>
                <input
                  value={editForm.grupo || ""}
                  onChange={(e) => setEditForm({ ...editForm, grupo: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1">Correo</label>
                <input
                  value={editForm.correo || ""}
                  onChange={(e) => setEditForm({ ...editForm, correo: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1">Estado</label>
                <select
                  value={editForm.estado || "activo"}
                  onChange={(e) => setEditForm({ ...editForm, estado: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm"
                >
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditing(null)} className="flex-1 px-4 py-2.5 border border-surface-200 dark:border-surface-700 rounded-xl text-sm font-medium hover:bg-surface-50 dark:hover:bg-surface-800">
                Cancelar
              </button>
              <button onClick={handleSave} className="flex-1 px-4 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
