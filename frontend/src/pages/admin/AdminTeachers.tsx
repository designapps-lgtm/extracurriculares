import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAdminTeachers,
  createAdminTeacher,
  updateAdminTeacher,
  getAdminAssignments,
  createAdminAssignment,
  updateAdminAssignment,
  deleteAdminAssignment,
  getAdminDisciplines,
  getAdminGrades,
  getAdminSchedules,
  resetTeacherPassword,
} from "../../services/admin";
import { useNotify } from "../../components/common/Notify";
import { createPortal } from "react-dom";

interface Teacher {
  idProfesor: string;
  nombre: string;
  apellido: string;
  correo: string | null;
  fotoUrl: string | null;
  estado: string;
  _count: { assignments: number };
}

interface Assignment {
  idAsignacion: string;
  codigoDisciplina: string;
  idGrado: number;
  esPrincipal: boolean;
  estado: string;
  discipline: { codigoDisciplina: string; nombre: string };
  grade: { idGrado: number; nombre: string };
  schedules: {
    schedule: {
      idHorario: string;
      diaSemana: string;
      horaInicio: string;
      horaFin: string;
    };
  }[];
}

interface Discipline {
  codigoDisciplina: string;
  nombre: string;
}

interface Grade {
  idGrado: number;
  nombre: string;
  nivel: string | null;
}

interface Schedule {
  idHorario: string;
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
}

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

export default function AdminTeachers() {
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [meta, setMeta] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    correo: "",
    fotoUrl: "",
  });

  // Assignments modal
  const [showAssignments, setShowAssignments] = useState<Teacher | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [showAddAssignment, setShowAddAssignment] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(
    null,
  );
  const [assignForm, setAssignForm] = useState({
    codigoDisciplina: "",
    idGrado: 0,
    esPrincipal: false,
    schedules: [] as string[],
  });
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [allSchedules, setAllSchedules] = useState<Schedule[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);

  const notify = useNotify();

  const load = (page = 1) => {
    setLoading(true);
    const params: Record<string, string> = { page: String(page), limit: "20" };
    if (search) params.search = search;

    getAdminTeachers(params)
      .then((res) => {
        setTeachers(res.data);
        setMeta(res.meta);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const loadAssignments = async (teacherId: string) => {
    setAssignmentsLoading(true);
    try {
      const res = await getAdminAssignments({
        profesor: teacherId,
        limit: "100",
      });
      setAssignments(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setAssignmentsLoading(false);
    }
  };

  const loadFormData = async () => {
    try {
      const [dRes, gRes, sRes] = await Promise.all([
        getAdminDisciplines({ limit: "200" }),
        getAdminGrades(),
        getAdminSchedules({ limit: "200" }),
      ]);
      setDisciplines(dRes.data);
      setGrades(gRes.data);
      setAllSchedules(sRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  const openAssignments = (teacher: Teacher) => {
    setShowAssignments(teacher);
    loadAssignments(teacher.idProfesor);
    loadFormData();
  };

  const openAddAssignment = () => {
    setEditingAssignment(null);
    setAssignForm({
      codigoDisciplina: "",
      idGrado: 0,
      esPrincipal: false,
      schedules: [],
    });
    setShowAddAssignment(true);
  };

  const openEditAssignment = (a: Assignment) => {
    setEditingAssignment(a);
    setAssignForm({
      codigoDisciplina: a.codigoDisciplina,
      idGrado: a.idGrado,
      esPrincipal: a.esPrincipal,
      schedules: a.schedules.map((s) => s.schedule.idHorario),
    });
    setShowAddAssignment(true);
  };

  const handleSaveAssignment = async () => {
    if (!showAssignments) return;
    if (!assignForm.codigoDisciplina || !assignForm.idGrado)
      return notify.info("Disciplina y grado son requeridos");

    setAssignLoading(true);
    try {
      const payload = {
        codigoDisciplina: assignForm.codigoDisciplina,
        idGrado: assignForm.idGrado,
        idProfesor: showAssignments.idProfesor,
        esPrincipal: assignForm.esPrincipal,
        schedules: assignForm.schedules.map((idHorario) => ({ idHorario })),
      };

      if (editingAssignment) {
        await updateAdminAssignment(editingAssignment.idAsignacion, {
          esPrincipal: assignForm.esPrincipal,
          schedules: payload.schedules,
        });
      } else {
        await createAdminAssignment(payload);
      }

      setShowAddAssignment(false);
      loadAssignments(showAssignments.idProfesor);
      load(meta.page);
    } catch (err: any) {
      notify.error(err.message || "Error al guardar asignación");
    } finally {
      setAssignLoading(false);
    }
  };

  const handleDeleteAssignment = async (a: Assignment) => {
    if (!showAssignments) return;
    const confirmed = await notify.confirm(
      "Eliminar asignación",
      `¿Eliminar la asignación ${a.discipline.nombre} - ${a.grade.nombre}?`,
      { confirmLabel: "Eliminar", variant: "danger" },
    );
    if (!confirmed) return;

    try {
      await deleteAdminAssignment(a.idAsignacion);
      loadAssignments(showAssignments.idProfesor);
      load(meta.page);
    } catch (err: any) {
      notify.error(err.message || "Error al eliminar asignación");
    }
  };

  const handleCreate = async () => {
    if (!form.nombre || !form.apellido)
      return notify.info("Nombre y apellido requeridos");
    try {
      await createAdminTeacher(form);
      setShowCreate(false);
      setForm({ nombre: "", apellido: "", correo: "", fotoUrl: "" });
      load();
    } catch (err: any) {
      notify.error(err.message);
    }
  };

  const handleEdit = async () => {
    if (!editing) return;
    try {
      await updateAdminTeacher(editing.idProfesor, form);
      setEditing(null);
      load(meta.page);
    } catch (err: any) {
      notify.error(err.message);
    }
  };

  const handleToggleStatus = async (teacher: Teacher) => {
    const newStatus = teacher.estado === "activo" ? "inactivo" : "activo";
    try {
      await updateAdminTeacher(teacher.idProfesor, { estado: newStatus });
      load(meta.page);
    } catch (err: any) {
      notify.error(err.message);
    }
  };

  const openEdit = (teacher: Teacher) => {
    setEditing(teacher);
    setForm({
      nombre: teacher.nombre,
      apellido: teacher.apellido,
      correo: teacher.correo || "",
      fotoUrl: teacher.fotoUrl || "",
    });
  };

  const handleResetPassword = async (teacher: Teacher) => {
    const pwd = await notify.prompt(
      "Restablecer contraseña",
      `Nueva contraseña para ${teacher.nombre} ${teacher.apellido}:`,
      { inputType: "password", inputPlaceholder: "Mínimo 6 caracteres" },
    );
    if (pwd === null) return;
    if (pwd.length < 6) {
      notify.info("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    try {
      await resetTeacherPassword(teacher.idProfesor, pwd);
      notify.success("Contraseña actualizada");
    } catch (err: any) {
      notify.error(err.message || "Error al actualizar contraseña");
    }
  };

  const toggleSchedule = (idHorario: string) => {
    setAssignForm((prev) => ({
      ...prev,
      schedules: prev.schedules.includes(idHorario)
        ? prev.schedules.filter((s) => s !== idHorario)
        : [...prev.schedules, idHorario],
    }));
  };

  const schedulesByDay = allSchedules.reduce(
    (acc, s) => {
      (acc[s.diaSemana] = acc[s.diaSemana] || []).push(s);
      return acc;
    },
    {} as Record<string, Schedule[]>,
  );

  const TeacherForm = ({
    onSave,
    onCancel,
  }: {
    onSave: () => void;
    onCancel: () => void;
  }) => (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-surface-500 mb-1">
          Nombre *
        </label>
        <input
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-surface-500 mb-1">
          Apellido *
        </label>
        <input
          value={form.apellido}
          onChange={(e) => setForm({ ...form, apellido: e.target.value })}
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
          Foto (URL)
        </label>
        <input
          value={form.fotoUrl}
          onChange={(e) => setForm({ ...form, fotoUrl: e.target.value })}
          placeholder="https://..."
          className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm"
        />
      </div>
      <div className="flex gap-3 mt-4">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2.5 border border-surface-200 dark:border-surface-700 rounded-xl text-sm font-medium hover:bg-surface-50"
        >
          Cancelar
        </button>
        <button
          onClick={onSave}
          className="flex-1 px-4 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700"
        >
          Guardar
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold text-surface-900 dark:text-surface-100">
          Profesores
        </h1>
        <button
          onClick={() => {
            setShowCreate(true);
            setForm({ nombre: "", apellido: "", correo: "", fotoUrl: "" });
          }}
          className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-700"
        >
          + Nuevo profesor
        </button>
      </div>
      {/* Search */}
      <div className="card p-4">
        <div className="flex gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(1)}
            placeholder="Buscar por nombre o correo..."
            className="flex-1 px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            onClick={() => load(1)}
            className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-700"
          >
            Buscar
          </button>
        </div>
      </div>
      {/* Cards */}
      <div className="card overflow-hidden p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full" />
          </div>
        ) : teachers.length === 0 ? (
          <div className="text-center py-12 text-sm text-surface-500">
            No se encontraron profesores.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {teachers.map((t) => (
              <div
                key={t.idProfesor}
                onClick={() =>
                  navigate(`/admin/teachers/${t.idProfesor}`)
                }
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    navigate(`/admin/teachers/${t.idProfesor}`);
                  }
                }}
                className="group block bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 transition-all duration-200 overflow-hidden cursor-pointer hover:border-brand-300 dark:hover:border-brand-700 hover:shadow-card-hover"
              >
                <div className="flex items-center gap-4 px-5 py-4">
                  {t.fotoUrl ? (
                    <img
                      src={t.fotoUrl}
                      alt={`${t.nombre} ${t.apellido}`}
                      className={`w-11 h-11 rounded-xl object-cover shrink-0 ${t.estado === "inactivo" ? "opacity-50 grayscale" : ""}`}
                    />
                  ) : (
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 font-semibold text-sm ${getAvatarColor(t.idProfesor)} ${t.estado === "inactivo" ? "opacity-50" : ""}`}
                    >
                      {t.nombre.charAt(0)}
                      {t.apellido.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-surface-900 dark:text-surface-100 text-sm truncate group-hover:text-brand-700 dark:group-hover:text-brand-400 transition-colors">
                      {t.nombre} {t.apellido}
                    </p>
                    <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5 truncate">
                      {t.correo || "Sin correo"}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${t.estado === "activo" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
                  >
                    {t.estado}
                  </span>
                </div>
                <div className="px-5 py-2.5 border-t border-surface-100 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-800/50 flex items-center justify-between gap-2">
                  <span className="text-xs text-surface-500 dark:text-surface-400">
                    {t._count.assignments}{" "}
                    {t._count.assignments === 1 ? "asignación" : "asignaciones"}
                  </span>
                  <div
                    className="flex items-center gap-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => openAssignments(t)}
                      className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
                    >
                      Asignaciones
                    </button>
                    <button
                      onClick={() => openEdit(t)}
                      className="text-xs font-medium text-surface-600 hover:text-surface-800 dark:text-surface-400 dark:hover:text-surface-200"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleResetPassword(t)}
                      className="text-xs font-medium text-amber-600 hover:text-amber-700"
                    >
                      Contraseña
                    </button>
                    <button
                      onClick={() => handleToggleStatus(t)}
                      className={`text-xs font-medium ${t.estado === "activo" ? "text-red-600 hover:text-red-700" : "text-green-600 hover:text-green-700"}`}
                    >
                      {t.estado === "activo" ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {meta.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-surface-100 dark:border-surface-800 flex items-center justify-between text-sm">
            <span className="text-surface-500">
              {meta.total} resultados · Página {meta.page} de {meta.totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => load(meta.page - 1)}
                disabled={meta.page <= 1}
                className="px-3 py-1 rounded-lg border border-surface-200 dark:border-surface-700 disabled:opacity-50 text-sm"
              >
                Anterior
              </button>
              <button
                onClick={() => load(meta.page + 1)}
                disabled={meta.page >= meta.totalPages}
                className="px-3 py-1 rounded-lg border border-surface-200 dark:border-surface-700 disabled:opacity-50 text-sm"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
      {/* Create modal Teaches */}
      {showCreate &&
        createPortal(
          <div
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setShowCreate(false)}
          >
            <div
              className="bg-white dark:bg-surface-900 rounded-2xl p-6 w-full max-w-md shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-display font-bold text-surface-900 dark:text-surface-100 mb-4">
                Nuevo profesor
              </h2>
              <TeacherForm
                onSave={handleCreate}
                onCancel={() => setShowCreate(false)}
              />
            </div>
          </div>,
        document.body
        )}
      {/* Edit modal */}
      {editing && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setEditing(null)}
        >
          <div
            className="bg-white dark:bg-surface-900 rounded-2xl p-6 w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-display font-bold text-surface-900 dark:text-surface-100 mb-4">
              Editar profesor
            </h2>
            <TeacherForm
              onSave={handleEdit}
              onCancel={() => setEditing(null)}
            />
          </div>
        </div>
      )}
      {/* Assignments modal */}
      {showAssignments &&
        createPortal(
          <div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center"
            onClick={() => setShowAssignments(null)}
          >
            <div
              className="bg-white dark:bg-surface-900 rounded-2xl p-8 w-full max-w-5xl max-h-[92vh] overflow-y-auto shadow-2xl mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-display font-bold text-surface-900 dark:text-surface-100">
                    Asignaciones
                  </h2>
                  <p className="text-base text-surface-500 mt-1">
                    {showAssignments.nombre} {showAssignments.apellido}
                  </p>
                </div>
                <button
                  onClick={() => setShowAssignments(null)}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-surface-400 hover:text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {assignmentsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
                </div>
              ) : (
                <>
                  {assignments.length === 0 ? (
                    <p className="text-surface-500 text-base text-center py-12">
                      Este profesor no tiene asignaciones.
                    </p>
                  ) : (
                    <div className="space-y-3 mb-6">
                      {assignments.map((a) => (
                        <div
                          key={a.idAsignacion}
                          className="flex items-center justify-between p-5 rounded-xl border border-surface-200 dark:border-surface-700 hover:border-brand-300 dark:hover:border-brand-700 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-base font-semibold text-surface-900 dark:text-surface-100">
                              {a.discipline.nombre}
                              {a.esPrincipal && (
                                <span className="ml-2 text-sm bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">
                                  Principal
                                </span>
                              )}
                            </p>
                            <p className="text-sm text-surface-500 mt-1">
                              Grado {a.grade.nombre}
                            </p>
                            <p className="text-sm text-surface-400 mt-0.5">
                              {a.schedules.length > 0
                                ? a.schedules
                                    .map(
                                      (s) =>
                                        `${s.schedule.diaSemana} ${s.schedule.horaInicio}-${s.schedule.horaFin}`,
                                    )
                                    .join(", ")
                                : "Sin horario"}
                            </p>
                          </div>
                          <div className="flex gap-3 ml-4">
                            <button
                              onClick={() => openEditAssignment(a)}
                              className="px-3 py-1.5 text-sm font-medium text-brand-600 hover:text-brand-700 hover:bg-brand-50 dark:hover:bg-brand-950 rounded-lg transition-colors"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDeleteAssignment(a)}
                              className="px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors"
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={openAddAssignment}
                    className="w-full px-5 py-3.5 border-2 border-dashed border-surface-300 dark:border-surface-600 rounded-xl text-base font-medium text-surface-600 dark:text-surface-400 hover:border-brand-400 hover:text-brand-600 transition-colors"
                  >
                    + Agregar asignación
                  </button>
                </>
              )}

              {/* Add/Edit assignment form */}
              {showAddAssignment && (
                <div className="mt-6 p-6 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800">
                  <h3 className="text-lg font-bold text-surface-900 dark:text-surface-100 mb-5">
                    {editingAssignment
                      ? "Editar asignación"
                      : "Nueva asignación"}
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-surface-500 mb-2">
                        Disciplina *
                      </label>
                      <select
                        value={assignForm.codigoDisciplina}
                        onChange={(e) =>
                          setAssignForm({
                            ...assignForm,
                            codigoDisciplina: e.target.value,
                          })
                        }
                        className="w-full px-4 py-3 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-base"
                      >
                        <option value="">Seleccionar disciplina</option>
                        {disciplines.map((d) => (
                          <option
                            key={d.codigoDisciplina}
                            value={d.codigoDisciplina}
                          >
                            {d.nombre} ({d.codigoDisciplina})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-surface-500 mb-2">
                        Grado *
                      </label>
                      <select
                        value={assignForm.idGrado || ""}
                        onChange={(e) =>
                          setAssignForm({
                            ...assignForm,
                            idGrado: Number(e.target.value),
                          })
                        }
                        className="w-full px-4 py-3 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-base"
                      >
                        <option value="">Seleccionar grado</option>
                        {grades.map((g) => (
                          <option key={g.idGrado} value={g.idGrado}>
                            {g.nombre}
                            {g.nivel ? ` · ${g.nivel}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-5">
                    <input
                      type="checkbox"
                      checked={assignForm.esPrincipal}
                      onChange={(e) =>
                        setAssignForm({
                          ...assignForm,
                          esPrincipal: e.target.checked,
                        })
                      }
                      className="rounded border-surface-300 w-4 h-4"
                    />
                    <label className="text-base text-surface-700 dark:text-surface-300">
                      Es principal
                    </label>
                  </div>

                  <div className="mt-5">
                    <label className="block text-sm font-medium text-surface-500 mb-3">
                      Horarios
                    </label>
                    <div className="space-y-3 max-h-56 overflow-y-auto">
                      {Object.entries(schedulesByDay).map(
                        ([day, schedules]) => (
                          <div key={day}>
                            <p className="text-sm font-semibold text-surface-600 dark:text-surface-400 mb-2">
                              {day}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {schedules.map((s) => (
                                <button
                                  key={s.idHorario}
                                  onClick={() => toggleSchedule(s.idHorario)}
                                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    assignForm.schedules.includes(s.idHorario)
                                      ? "bg-brand-600 text-white"
                                      : "bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-200"
                                  }`}
                                >
                                  {s.horaInicio}-{s.horaFin}
                                </button>
                              ))}
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </div>

                  <div className="flex gap-4 mt-6">
                    <button
                      onClick={() => setShowAddAssignment(false)}
                      className="flex-1 px-5 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-base font-medium hover:bg-surface-50 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSaveAssignment}
                      disabled={assignLoading}
                      className="flex-1 px-5 py-3 bg-brand-600 text-white rounded-xl text-base font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
                    >
                      {assignLoading
                        ? "Guardando..."
                        : editingAssignment
                          ? "Actualizar"
                          : "Crear"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
