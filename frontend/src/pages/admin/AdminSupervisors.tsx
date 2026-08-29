import { useState, useEffect } from "react";
import { getAdminSupervisors, createAdminSupervisor, updateAdminSupervisor, deleteAdminSupervisor } from "../../services/admin";
import { useNotify } from "../../components/common/Notify";
import { Pagination } from "../../components/common/Pagination";
import { Loading } from "../../components/common/States";
import { Avatar } from "../../components/common/Avatar";
import type { Supervisor } from "../../types";

export default function AdminSupervisors() {
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Supervisor | null>(null);
  const [form, setForm] = useState({ nombre: "", apellido: "", correo: "" });

  const notify = useNotify();

  const load = (page = 1) => {
    setLoading(true);
    const params: Record<string, string> = { page: String(page), limit: "20" };
    if (search) params.search = search;

    getAdminSupervisors(params)
      .then((res) => {
        setSupervisors(res.data);
        setMeta(res.meta);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.nombre || !form.apellido) return notify.info("Nombre y apellido requeridos");
    try {
      await createAdminSupervisor(form);
      setShowCreate(false);
      setForm({ nombre: "", apellido: "", correo: "" });
      load();
    } catch (err: any) { notify.error(err.message); }
  };

  const handleEdit = async () => {
    if (!editing) return;
    try {
      await updateAdminSupervisor(editing.idSupervisor, form);
      setEditing(null);
      load(meta.page);
    } catch (err: any) { notify.error(err.message); }
  };

  const handleToggleStatus = async (s: Supervisor) => {
    const newStatus = s.estado === "activo" ? "inactivo" : "activo";
    try {
      await updateAdminSupervisor(s.idSupervisor, { estado: newStatus });
      load(meta.page);
    } catch (err: any) { notify.error(err.message); }
  };

  const handleDelete = async (s: Supervisor) => {
    const confirmed = await notify.confirm(
      "Eliminar supervisora",
      `¿Eliminar a ${s.nombre} ${s.apellido}?`,
      { confirmLabel: "Eliminar", variant: "danger" },
    );
    if (!confirmed) return;
    try {
      await deleteAdminSupervisor(s.idSupervisor);
      load(meta.page);
    } catch (err: any) { notify.error(err.message); }
  };

  const openEdit = (s: Supervisor) => {
    setEditing(s);
    setForm({ nombre: s.nombre, apellido: s.apellido, correo: s.correo || "" });
  };

  const resetForm = () => setForm({ nombre: "", apellido: "", correo: "" });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-surface-900 dark:text-surface-100">Supervisoras</h1>
          <p className="text-sm text-surface-500 mt-1">Gestiona los correos con acceso al panel de supervisión</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); resetForm(); }}
          className="self-start sm:self-auto px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-700"
        >
          + Nueva supervisora
        </button>
      </div>

      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(1)}
            placeholder="Buscar por nombre o correo..."
            className="flex-1 min-w-[0] px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button onClick={() => load(1)} className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-700">
            Buscar
          </button>
        </div>
      </div>

      <div className="card overflow-hidden p-4">
        {loading ? (
          <Loading />
        ) : supervisors.length === 0 ? (
          <div className="text-center py-12 text-sm text-surface-500">No se encontraron supervisoras.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {supervisors.map((s) => (
              <div key={s.idSupervisor} className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 p-5">
                <div className="flex items-center gap-4">
                  <Avatar seed={s.idSupervisor} className={`w-11 h-11 rounded-xl ${s.estado === "inactivo" ? "opacity-50" : ""}`}>
                    {s.nombre.charAt(0)}{s.apellido.charAt(0)}
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-surface-900 dark:text-surface-100 text-sm truncate">
                      {s.nombre} {s.apellido}
                    </p>
                    <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5 truncate">{s.correo || "Sin correo"}</p>
                  </div>
                  <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.estado === "activo" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                    {s.estado}
                  </span>
                </div>
                <div className="mt-4 flex items-center gap-2 flex-wrap">
                  <button onClick={() => openEdit(s)} className="px-2.5 py-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-950">
                    Editar
                  </button>
                  <button
                    onClick={() => handleToggleStatus(s)}
                    className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-surface-100 ${s.estado === "activo" ? "text-red-600 hover:text-red-700" : "text-green-600 hover:text-green-700"}`}
                  >
                    {s.estado === "activo" ? "Desactivar" : "Activar"}
                  </button>
                  <button onClick={() => handleDelete(s)} className="px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:text-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-950">
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={load} />
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white dark:bg-surface-900 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-display font-bold text-surface-900 dark:text-surface-100 mb-4">Nueva supervisora</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">Nombre *</label>
                  <input type="text" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">Apellido *</label>
                  <input type="text" value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1">Correo</label>
                <input type="email" value={form.correo} onChange={(e) => setForm({ ...form, correo: e.target.value })} placeholder="supervisora@colegio.edu.co" className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2.5 border border-surface-200 dark:border-surface-700 rounded-xl text-sm font-medium hover:bg-surface-50">Cancelar</button>
              <button onClick={handleCreate} className="flex-1 px-4 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700">Crear</button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white dark:bg-surface-900 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-display font-bold text-surface-900 dark:text-surface-100 mb-4">Editar supervisora</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">Nombre *</label>
                  <input type="text" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">Apellido *</label>
                  <input type="text" value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1">Correo</label>
                <input type="email" value={form.correo} onChange={(e) => setForm({ ...form, correo: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditing(null)} className="flex-1 px-4 py-2.5 border border-surface-200 dark:border-surface-700 rounded-xl text-sm font-medium hover:bg-surface-50">Cancelar</button>
              <button onClick={handleEdit} className="flex-1 px-4 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}