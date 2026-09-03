import { useParams, Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { getStudentProfile } from "../services/students";
import { getSecretaryStudentProfile } from "../services/secretary";
import { updateAdminStudent } from "../services/admin";
import { useNotify } from "../components/common/Notify";
import { Loading, ErrorMessage } from "../components/common/States";
import type { StudentProfile as StudentProfileType } from "../types";

const DAY_ORDER = [
  "LUNES",
  "MARTES",
  "MIERCOLES",
  "JUEVES",
  "VIERNES",
  "SABADO",
];

const DAY_LABELS: Record<string, string> = {
  LUNES: "Lunes",
  MARTES: "Martes",
  MIERCOLES: "Miércoles",
  JUEVES: "Jueves",
  VIERNES: "Viernes",
  SABADO: "Sábado",
};

export default function StudentProfile() {
  const { codigo } = useParams<{ codigo: string }>();
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  const isSecretary = location.pathname.startsWith("/secretary");
  const from = location.state as { from?: string; disciplina?: string } | null;

  const backTo = from?.from === "discipline" && from.disciplina
    ? `${isAdmin ? "/admin" : isSecretary ? "/secretary" : ""}/disciplines/${from.disciplina}`
    : isAdmin ? "/admin/students" : isSecretary ? "/secretary/students" : "/students";

  const [profile, setProfile] = useState<StudentProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const notify = useNotify();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    grupo: "",
    correo: "",
    estado: "activo",
    fotoUrl: "",
  });

  const openEdit = () => {
    if (!profile) return;
    setForm({
      nombre: profile.student.nombre,
      apellido: profile.student.apellido,
      grupo: profile.student.grupo || "",
      correo: profile.student.correo || "",
      estado: profile.student.estado,
      fotoUrl: profile.student.fotoUrl || "",
    });
    setEditing(true);
  };

  const handleSave = async () => {
    if (!codigo) return;
    setSaving(true);
    try {
      await updateAdminStudent(codigo, {
        nombre: form.nombre,
        apellido: form.apellido,
        grupo: form.grupo || undefined,
        correo: form.correo || undefined,
        estado: form.estado,
        fotoUrl: form.fotoUrl || undefined,
      });
      setEditing(false);
      notify.success("Estudiante actualizado");
      setProfile(null);
      setLoading(true);
      load();
    } catch (err: any) {
      notify.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const load = () => {
    if (!codigo) return;
    setLoading(true);
    setError(null);
    const request = isSecretary
      ? getSecretaryStudentProfile(codigo)
      : getStudentProfile(codigo);
    request
      .then((res) => {
        setProfile(res.data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "No se encontró el estudiante");
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
  }, [codigo]);

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} onRetry={load} />;
  if (!profile) return null;

  const { student, extracurricular } = profile;

  const sortedSchedule = extracurricular
    ? [...extracurricular].sort(
        (a, b) => DAY_ORDER.indexOf(a.dia) - DAY_ORDER.indexOf(b.dia),
      )
    : [];

  const groupedByDay = DAY_ORDER.filter((day) =>
    sortedSchedule.some((e) => e.dia === day),
  ).map((day) => ({
    day,
    entries: sortedSchedule.filter((e) => e.dia === day),
  }));

  return (
    <div className="max-w-2xl mx-auto space-y-6">
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
        Volver a {from?.from === "discipline" ? "la disciplina" : "estudiantes"}
      </Link>

      {/* Student info card */}
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-br from-brand-600 to-brand-700 px-6 py-8">
          <div className="flex items-start gap-4 sm:gap-5">
            {student.fotoUrl ? (
              <img
                src={student.fotoUrl}
                alt={`${student.nombre} ${student.apellido}`}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover ring-4 ring-white/20 shrink-0"
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 ring-4 ring-white/10">
                <span className="text-white font-display font-bold text-xl sm:text-2xl">
                  {student.nombre.charAt(0)}
                  {student.apellido.charAt(0)}
                </span>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-display font-bold text-white break-words">
                {student.nombre} {student.apellido}
              </h1>
              <p className="text-brand-100 text-sm mt-1.5 font-medium break-words">
                Código: {student.codigoEstudiante}
              </p>
              <p className="text-brand-200 text-sm break-words">
                {student.grupo || student.grade.nombre} · {student.grade.nivel || "Secundaria"}
              </p>
              <div className="flex items-center gap-2 mt-3">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    student.estado === "activo"
                      ? "bg-green-500/20 text-green-100"
                      : "bg-red-500/20 text-red-100"
                  }`}
                >
                  {student.estado}
                </span>
                {student.correo && (
                  <a
                    href={`mailto:${student.correo}`}
                    className="inline-flex items-center gap-1 text-xs text-brand-100/90 hover:text-white transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                    {student.correo}
                  </a>
                )}
              </div>
            </div>
            {isAdmin && (
              <button
                onClick={openEdit}
                className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 bg-white/15 hover:bg-white/25 text-white text-sm font-medium rounded-xl transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
                Editar
              </button>
            )}
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 divide-x divide-surface-100 dark:divide-surface-800">
          <div className="px-2 sm:px-4 py-3 text-center min-w-0">
            <p className="text-lg font-display font-bold text-surface-900 dark:text-surface-100 truncate">
              {extracurricular?.length || 0}
            </p>
            <p className="text-xs text-surface-500 dark:text-surface-400">
              Actividades
            </p>
          </div>
          <div className="px-2 sm:px-4 py-3 text-center min-w-0">
            <p className="text-lg font-display font-bold text-surface-900 dark:text-surface-100 truncate">
              {groupedByDay.length}
            </p>
            <p className="text-xs text-surface-500 dark:text-surface-400">
              Días ocupados
            </p>
          </div>
          <div className="px-2 sm:px-4 py-3 text-center min-w-0">
            <p className="text-lg font-display font-bold text-surface-900 dark:text-surface-100 truncate">
              {student.grade.nombre}
            </p>
            <p className="text-xs text-surface-500 dark:text-surface-400">
              Grado
            </p>
          </div>
        </div>
      </div>

      {/* Schedule grouped by day */}
      <div className="card p-6">
        <h2 className="font-display font-semibold text-surface-900 dark:text-surface-100 text-lg mb-5">
          Horario Extracurricular
        </h2>

        {groupedByDay.length > 0 ? (
          <div className="space-y-5">
            {groupedByDay.map(({ day, entries }) => (
              <div key={day}>
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="w-2 h-2 rounded-full bg-brand-500" />
                  <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 uppercase tracking-wide">
                    {DAY_LABELS[day] || day}
                  </h3>
                </div>
                <div className="space-y-2 ml-4">
                  {entries.map((entry, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 bg-surface-50 dark:bg-surface-800 rounded-xl px-4 py-3 border border-surface-100 dark:border-surface-700"
                    >
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
                        <p className="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">
                          {entry.disciplina.nombre}
                        </p>
                        <p className="text-xs text-surface-500 dark:text-surface-400">
                          {entry.disciplina.codigo}
                        </p>
                        {entry.oferta && (
                          <p className="text-xs text-brand-600 dark:text-brand-400 mt-0.5">
                            {entry.oferta.profesor} · {entry.oferta.horaInicio ?? "—"}–{entry.oferta.horaFin ?? "—"}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-surface-100 dark:bg-surface-800 flex items-center justify-center mx-auto mb-3">
              <svg
                className="w-6 h-6 text-surface-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-surface-500 dark:text-surface-400 text-sm">
              No está inscrito en una actividad extracurricular.
            </p>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editing && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setEditing(false)}
        >
          <div
            className="bg-white dark:bg-surface-900 rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-display font-bold text-surface-900 dark:text-surface-100 mb-4">
              Editar estudiante
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1">
                  Nombre
                </label>
                <input
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1">
                  Apellido
                </label>
                <input
                  value={form.apellido}
                  onChange={(e) => setForm({ ...form, apellido: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1">
                  Grupo
                </label>
                <input
                  value={form.grupo}
                  onChange={(e) => setForm({ ...form, grupo: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1">
                  Correo
                </label>
                <input
                  value={form.correo}
                  onChange={(e) => setForm({ ...form, correo: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1">
                  Estado
                </label>
                <select
                  value={form.estado}
                  onChange={(e) => setForm({ ...form, estado: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm"
                >
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1">
                  Foto (URL)
                </label>
                <input
                  value={form.fotoUrl}
                  onChange={(e) => setForm({ ...form, fotoUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm"
                />
                {form.fotoUrl && (
                  <div className="mt-2">
                    <img
                      src={form.fotoUrl}
                      alt="Vista previa"
                      className="w-16 h-16 rounded-xl object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.opacity = "0.3";
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setEditing(false)}
                disabled={saving}
                className="flex-1 px-4 py-2.5 border border-surface-200 dark:border-surface-700 rounded-xl text-sm font-medium hover:bg-surface-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
