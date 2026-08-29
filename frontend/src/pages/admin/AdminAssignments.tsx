import { useState, useEffect } from "react";
import {
  getAdminAssignments,
  createAdminAssignment,
  updateAdminAssignment,
  deleteAdminAssignment,
  createAdminSchedule,
  getAdminDisciplines,
  getAdminTeachers,
  getAdminGrades,
  getAdminSchedules,
} from "../../services/admin";
import { useNotify } from "../../components/common/Notify";
import { Pagination } from "../../components/common/Pagination";
import { Loading } from "../../components/common/States";
import { createPortal } from "react-dom";
import type { Assignment, Schedule } from "../../types";

const DIAS_CORTO: Record<string, string> = {
  LUNES: "Lun",
  MARTES: "Mar",
  MIERCOLES: "Mié",
  JUEVES: "Jue",
  VIERNES: "Vie",
  SABADO: "Sáb",
  DOMINGO: "Dom",
};

const DIAS_ORDEN = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO"];

export default function AdminAssignments() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [meta, setMeta] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Assignment | null>(null);

  const [disciplines, setDisciplines] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  const [formDiscipline, setFormDiscipline] = useState("");
  const [formGrade, setFormGrade] = useState(0);
  const [formTeacher, setFormTeacher] = useState("");
  const [formSchedules, setFormSchedules] = useState<string[]>([]);
  const [esPrincipal, setEsPrincipal] = useState(false);

  // Nuevo horario inline
  const [showNewSchedule, setShowNewSchedule] = useState(false);
  const [nsDia, setNsDia] = useState("LUNES");
  const [nsInicio, setNsInicio] = useState("15:15");
  const [nsFin, setNsFin] = useState("17:15");
  const [nsAula, setNsAula] = useState("");
  const [creatingSchedule, setCreatingSchedule] = useState(false);

  const notify = useNotify();

  const load = (page = 1) => {
    setLoading(true);
    getAdminAssignments({ page: String(page), limit: "20" })
      .then((res) => {
        setAssignments(res.data);
        setMeta(res.meta);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    Promise.all([
      getAdminDisciplines({ limit: "100" }),
      getAdminTeachers({ limit: "100" }),
      getAdminGrades(),
      getAdminSchedules({ limit: "100" }),
    ]).then(([d, t, g, s]) => {
      setDisciplines(d.data);
      setTeachers(t.data);
      setGrades(g.data);
      setSchedules(s.data);
    });
  }, []);

  const openCreate = () => {
    setEditing(null);
    setFormDiscipline("");
    setFormGrade(0);
    setFormTeacher("");
    setFormSchedules([]);
    setEsPrincipal(false);
    setShowNewSchedule(false);
    setShowModal(true);
  };

  const openEdit = (a: Assignment) => {
    setEditing(a);
    setFormDiscipline(a.discipline.codigoDisciplina);
    setFormGrade(a.grade.idGrado);
    setFormTeacher(a.teacher.idProfesor);
    setFormSchedules(a.schedules.map((s) => s.schedule.idHorario));
    setEsPrincipal(a.esPrincipal);
    setShowNewSchedule(false);
    setShowModal(true);
  };

  const toggleSchedule = (id: string) => {
    if (formSchedules.includes(id)) setFormSchedules(formSchedules.filter((s) => s !== id));
    else setFormSchedules([...formSchedules, id]);
  };

  const handleCreateSchedule = async () => {
    if (!nsDia || !nsInicio) return notify.info("Día y hora de inicio son requeridos");
    setCreatingSchedule(true);
    try {
      const res = await createAdminSchedule({
        diaSemana: nsDia,
        horaInicio: nsInicio,
        horaFin: nsFin || null,
        aula: nsAula || null,
      });
      const created = res.data;
      if (!schedules.some((s) => s.idHorario === created.idHorario)) {
        setSchedules([...schedules, created]);
      }
      if (!formSchedules.includes(created.idHorario)) {
        setFormSchedules([...formSchedules, created.idHorario]);
      }
      setShowNewSchedule(false);
      notify.success(res.created ? "Horario creado y seleccionado" : "Horario ya existía, seleccionado");
    } catch (err: any) {
      notify.error(err.message);
    } finally {
      setCreatingSchedule(false);
    }
  };

  const handleSubmit = async () => {
    if (!formDiscipline || !formGrade || !formTeacher)
      return notify.info("Disciplina, grado y profesor son requeridos");
    try {
      if (editing) {
        await updateAdminAssignment(editing.idAsignacion, {
          esPrincipal,
          schedules: formSchedules.map((id) => ({ idHorario: id })),
        });
        notify.success("Asignación actualizada");
      } else {
        await createAdminAssignment({
          codigoDisciplina: formDiscipline,
          idGrado: formGrade,
          idProfesor: formTeacher,
          esPrincipal,
          schedules: formSchedules.map((id) => ({ idHorario: id })),
        });
        notify.success("Asignación creada");
      }
      setShowModal(false);
      load(meta.page);
    } catch (err: any) {
      notify.error(err.message);
    }
  };

  const handleActivate = async (a: Assignment) => {
    try {
      await updateAdminAssignment(a.idAsignacion, { estado: "activo" });
      load(meta.page);
    } catch (err: any) {
      notify.error(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await notify.confirm(
      "Eliminar asignación",
      "¿Está seguro de eliminar esta asignación?",
      { confirmLabel: "Eliminar", variant: "danger" },
    );
    if (!confirmed) return;
    try {
      await deleteAdminAssignment(id);
      load(meta.page);
    } catch (err: any) {
      notify.error(err.message);
    }
  };

  const schedulesByDay = (schedules: Assignment["schedules"]) => {
    const grouped: Record<string, string[]> = {};
    for (const s of schedules) {
      const day = s.schedule.diaSemana;
      const time = `${s.schedule.horaInicio || "?"}–${s.schedule.horaFin || "?"}`;
      (grouped[day] = grouped[day] || []).push(time);
    }
    return grouped;
  };

  const sortedSchedules = [...schedules].sort(
    (a, b) => DIAS_ORDEN.indexOf(a.diaSemana) - DIAS_ORDEN.indexOf(b.diaSemana),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-display font-bold text-surface-900 dark:text-surface-100">
          Oferta Extracurricular
        </h1>
        <button
          onClick={openCreate}
          className="self-start sm:self-auto px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-700"
        >
          + Nueva asignación
        </button>
      </div>
      {/* Cards */}
      <div className="card overflow-hidden">
        {loading ? (
          <Loading />
        ) : (
          <div className="divide-y divide-surface-100 dark:divide-surface-800">
            {assignments.map((a) => {
              const schedByDay = schedulesByDay(a.schedules);
              return (
                <div
                  key={a.idAsignacion}
                  className="p-5 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-surface-900 dark:text-surface-100">
                          {a.discipline.nombre}
                        </p>
                        <span className="badge-neutral text-xs">
                          {a.grade.nombre}
                        </span>
                        {a.esPrincipal && (
                          <span className="px-2 py-0.5 bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300 text-xs font-medium rounded-full">
                            Principal
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            a.estado === "activo"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {a.estado}
                        </span>
                      </div>
                      <p className="text-sm text-surface-500 mt-1">
                        {a.teacher.nombre} {a.teacher.apellido}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {Object.entries(schedByDay).map(([day, times]) => (
                          <span
                            key={day}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-surface-100 dark:bg-surface-800 rounded-lg text-xs text-surface-600 dark:text-surface-400"
                          >
                            <span className="font-medium">
                              {DIAS_CORTO[day] || day}
                            </span>
                            {times.map((t, i) => (
                              <span key={i}>{t}</span>
                            ))}
                          </span>
                        ))}
                        {a.schedules.length === 0 && (
                          <span className="text-xs text-surface-400 italic">
                            Sin horarios asignados
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap shrink-0">
                      <button
                        onClick={() => openEdit(a)}
                        className="px-2.5 py-1.5 text-brand-600 hover:text-brand-700 hover:bg-brand-50 dark:hover:bg-brand-950 rounded-lg text-sm font-medium"
                      >
                        Editar
                      </button>
                      {a.estado === "inactivo" && (
                        <button
                          onClick={() => handleActivate(a)}
                          className="px-2.5 py-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950 rounded-lg text-sm font-medium"
                        >
                          Activar
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(a.idAsignacion)}
                        className="px-2.5 py-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg text-sm font-medium"
                      >
                        {a.estado === "activo" ? "Desactivar" : "Eliminar"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {assignments.length === 0 && (
              <div className="p-8 text-center text-surface-500">
                No hay asignaciones registradas.
              </div>
            )}
          </div>
        )}

        <Pagination
          page={meta.page}
          totalPages={meta.totalPages}
          total={meta.total}
          onPageChange={load}
        />
      </div>

      {/* Create/Edit modal */}
      {showModal &&
        createPortal(
          <div
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setShowModal(false)}
          >
            <div
              className="bg-white dark:bg-surface-900 rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-display font-bold text-surface-900 dark:text-surface-100 mb-4">
                {editing ? "Editar asignación" : "Nueva asignación"}
              </h2>
              {editing && (
                <div className="mb-4 px-3 py-2 bg-surface-100 dark:bg-surface-800 rounded-xl text-sm text-surface-600 dark:text-surface-400">
                  {editing.discipline.nombre} · {editing.grade.nombre} ·{" "}
                  {editing.teacher.nombre} {editing.teacher.apellido}
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">
                    Disciplina *
                  </label>
                  <select
                    value={formDiscipline}
                    onChange={(e) => setFormDiscipline(e.target.value)}
                    disabled={!!editing}
                    className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm disabled:opacity-60"
                  >
                    <option value="">Seleccionar disciplina</option>
                    {disciplines.map((d: any) => (
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
                  <label className="block text-xs font-medium text-surface-500 mb-1">
                    Grado *
                  </label>
                  <select
                    value={formGrade || ""}
                    onChange={(e) => setFormGrade(Number(e.target.value))}
                    disabled={!!editing}
                    className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm disabled:opacity-60"
                  >
                    <option value="">Seleccionar grado</option>
                    {grades.map((g: any) => (
                      <option key={g.idGrado} value={g.idGrado}>
                        {g.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">
                    Profesor *
                  </label>
                  <select
                    value={formTeacher}
                    onChange={(e) => setFormTeacher(e.target.value)}
                    disabled={!!editing}
                    className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm disabled:opacity-60"
                  >
                    <option value="">Seleccionar profesor</option>
                    {teachers.map((t: any) => (
                      <option key={t.idProfesor} value={t.idProfesor}>
                        {t.nombre} {t.apellido}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-medium text-surface-500 mb-1">
                      Horarios
                    </label>
                    {!showNewSchedule && (
                      <button
                        onClick={() => setShowNewSchedule(true)}
                        className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                      >
                        + Crear horario nuevo
                      </button>
                    )}
                  </div>

                  {showNewSchedule && (
                    <div className="mb-3 p-3 border border-dashed border-surface-300 dark:border-surface-600 rounded-xl space-y-3 bg-surface-50 dark:bg-surface-800/40">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-surface-500 mb-1">
                            Día
                          </label>
                          <select
                            value={nsDia}
                            onChange={(e) => setNsDia(e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm"
                          >
                            {DIAS_ORDEN.map((d) => (
                              <option key={d} value={d}>
                                {DIAS_CORTO[d] || d}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-surface-500 mb-1">
                            Aula (opcional)
                          </label>
                          <input
                            type="text"
                            value={nsAula}
                            onChange={(e) => setNsAula(e.target.value)}
                            placeholder="Ej: Salón 3"
                            className="w-full px-2 py-1.5 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-surface-500 mb-1">
                            Hora inicio
                          </label>
                          <input
                            type="time"
                            value={nsInicio}
                            onChange={(e) => setNsInicio(e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-surface-500 mb-1">
                            Hora fin
                          </label>
                          <input
                            type="time"
                            value={nsFin}
                            onChange={(e) => setNsFin(e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleCreateSchedule}
                          disabled={creatingSchedule}
                          className="flex-1 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
                        >
                          {creatingSchedule ? "Creando..." : "Agregar horario"}
                        </button>
                        <button
                          onClick={() => setShowNewSchedule(false)}
                          className="px-3 py-1.5 border border-surface-200 dark:border-surface-700 rounded-lg text-sm hover:bg-surface-50"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {sortedSchedules.map((s) => (
                      <label
                        key={s.idHorario}
                        className="flex items-center gap-2 text-sm text-surface-700 dark:text-surface-300"
                      >
                        <input
                          type="checkbox"
                          checked={formSchedules.includes(s.idHorario)}
                          onChange={() => toggleSchedule(s.idHorario)}
                          className="rounded border-surface-300"
                        />
                        {s.diaSemana} {s.horaInicio || "NULL"}–
                        {s.horaFin || "NULL"} {s.aula ? `(${s.aula})` : ""}
                      </label>
                    ))}
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm text-surface-700 dark:text-surface-300">
                  <input
                    type="checkbox"
                    checked={esPrincipal}
                    onChange={(e) => setEsPrincipal(e.target.checked)}
                    className="rounded border-surface-300"
                  />
                  Principal
                </label>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 border border-surface-200 dark:border-surface-700 rounded-xl text-sm font-medium hover:bg-surface-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmit}
                  className="flex-1 px-4 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700"
                >
                  {editing ? "Guardar cambios" : "Crear"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}