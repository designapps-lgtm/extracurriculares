import { useState, useEffect } from "react";
import { getAdminUsers, createAdminUser, updateAdminUser, resetAdminPassword, deleteAdminUser, type AdminUserEntry } from "../../services/admin";
import { useNotify } from "../../components/common/Notify";

export default function AdminUsers() {
  const [admins, setAdmins] = useState<AdminUserEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showReset, setShowReset] = useState<string | null>(null);

  const [formEmail, setFormEmail] = useState("");
  const [formNombre, setFormNombre] = useState("");
  const [formApellido, setFormApellido] = useState("");
  const [formPassword, setFormPassword] = useState("");

  const notify = useNotify();

  const load = () => {
    setLoading(true);
    getAdminUsers()
      .then((res) => setAdmins(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!formEmail) return notify.info("El email es requerido");
    try {
      await createAdminUser({ email: formEmail, nombre: formNombre, apellido: formApellido, password: formPassword || undefined });
      setShowCreate(false);
      setFormEmail(""); setFormNombre(""); setFormApellido(""); setFormPassword("");
      load();
    } catch (err: any) { notify.error(err.message); }
  };

  const handleToggle = async (admin: AdminUserEntry) => {
    const newStatus = admin.estado === "activo" ? "inactivo" : "activo";
    try {
      await updateAdminUser(admin.id, { estado: newStatus });
      load();
    } catch (err: any) { notify.error(err.message); }
  };

  const handleReset = async () => {
    if (!showReset) return;
    if (!formPassword || formPassword.length < 6) return notify.info("Mínimo 6 caracteres");
    try {
      await resetAdminPassword(showReset, formPassword);
      setShowReset(null);
      setFormPassword("");
    } catch (err: any) { notify.error(err.message); }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await notify.confirm("Eliminar admin", "¿Eliminar este admin permanentemente?", { confirmLabel: "Eliminar", variant: "danger" });
    if (!confirmed) return;
    try {
      await deleteAdminUser(id);
      load();
    } catch (err: any) { notify.error(err.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-surface-900 dark:text-surface-100">Administradores</h1>
          <p className="text-sm text-surface-500 mt-1">Gestiona los correos con acceso al panel</p>
        </div>
        <button onClick={() => { setShowCreate(true); setFormEmail(""); setFormNombre(""); setFormApellido(""); setFormPassword(""); }} className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-700">
          + Agregar admin
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-100 dark:border-surface-800">
                  <th className="text-left px-4 py-3 text-xs font-medium text-surface-500 uppercase">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-surface-500 uppercase">Nombre</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-surface-500 uppercase">Estado</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-surface-500 uppercase">Creado</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-surface-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50 dark:divide-surface-800">
                {admins.map((a) => (
                  <tr key={a.id} className="hover:bg-surface-50 dark:hover:bg-surface-800">
                    <td className="px-4 py-3 font-medium text-surface-900 dark:text-surface-100">{a.email}</td>
                    <td className="px-4 py-3 text-surface-700 dark:text-surface-300">{a.nombre} {a.apellido}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${a.estado === "activo" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                        {a.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-surface-500">{new Date(a.createdAt).toLocaleDateString("es-CO")}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => { setShowReset(a.id); setFormPassword(""); }} className="text-brand-600 hover:text-brand-700 text-sm font-medium">
                          Reset pass
                        </button>
                        <button onClick={() => handleToggle(a)} className="text-surface-600 hover:text-surface-700 text-sm font-medium">
                          {a.estado === "activo" ? "Desactivar" : "Activar"}
                        </button>
                        <button onClick={() => handleDelete(a.id)} className="text-red-600 hover:text-red-700 text-sm font-medium">
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white dark:bg-surface-900 rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-display font-bold text-surface-900 dark:text-surface-100 mb-4">Agregar administrador</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1">Email *</label>
                <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="correo@ejemplo.com" className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">Nombre</label>
                  <input type="text" value={formNombre} onChange={(e) => setFormNombre(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">Apellido</label>
                  <input type="text" value={formApellido} onChange={(e) => setFormApellido(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1">Contraseña (dejar vacío = admin123)</label>
                <input type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2.5 border border-surface-200 dark:border-surface-700 rounded-xl text-sm font-medium hover:bg-surface-50">Cancelar</button>
              <button onClick={handleCreate} className="flex-1 px-4 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700">Crear</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset password modal */}
      {showReset && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowReset(null)}>
          <div className="bg-white dark:bg-surface-900 rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-display font-bold text-surface-900 dark:text-surface-100 mb-1">Restablecer contraseña</h2>
            <p className="text-sm text-surface-500 mb-4">Admin: {admins.find((a) => a.id === showReset)?.email}</p>
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1">Nueva contraseña</label>
              <input type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm" />
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowReset(null)} className="flex-1 px-4 py-2.5 border border-surface-200 dark:border-surface-700 rounded-xl text-sm font-medium hover:bg-surface-50">Cancelar</button>
              <button onClick={handleReset} className="flex-1 px-4 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
