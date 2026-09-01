import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getSupervisorAttendanceList,
  supervisorSaveAttendance,
  getSupervisorNovedadesBatch,
} from "../../services/supervisor";
import { useNotify } from "../../components/common/Notify";
import Logo from "../../components/common/Logo";
import { Avatar } from "../../components/common/Avatar";
import type { AttendanceStudent as Student, Schedule, Assignment, Novedad, AttendanceResponse } from "../../types";

function todayBogotaStr(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default function SupervisorAttendance() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [teacher, setTeacher] = useState<{ nombre: string; apellido: string } | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [novedadesMap, setNovedadesMap] = useState<Record<string, Novedad[]>>({});
  const [transfers, setTransfers] = useState<NonNullable<AttendanceResponse["transfers"]>>([]);
  const transferCount = transfers.length;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const notify = useNotify();

  useEffect(() => {
    if (!sessionId) return;
    getSupervisorAttendanceList(sessionId)
      .then(async (data) => {
        setAssignment(data.assignment);
        setSchedule(data.schedule);
        setTeacher(data.teacher ?? null);
        setStudents(data.students);
        setTransfers(data.transfers ?? []);
        const codigos = data.students.map((s) => s.codigoEstudiante);
        if (codigos.length === 0) return;
        const novedades = await getSupervisorNovedadesBatch(codigos, todayBogotaStr());
        setNovedadesMap(
          novedades.reduce((acc, item) => {
            if (item.novedades.length > 0) acc[item.codigoEstudiante] = item.novedades;
            return acc;
          }, {} as Record<string, Novedad[]>)
        );
      })
      .catch((err) => {
        notify.error(err.message || "Error al cargar asistencia");
        navigate("/supervisor/classes");
      })
      .finally(() => setLoading(false));
  }, [sessionId, navigate]);

  const toggleAttendance = (codigoEstudiante: string, newEstado: string) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.codigoEstudiante === codigoEstudiante ? { ...s, estado: s.estado === newEstado ? "pendiente" : newEstado } : s
      )
    );
  };

  const handleSave = async () => {
    if (!sessionId) return;
    setSaving(true);
    try {
      const records = students
        .filter((s) => s.estado !== "pendiente")
        .map((s) => ({ codigoEstudiante: s.codigoEstudiante, estado: s.estado }));
      await supervisorSaveAttendance(sessionId, records);
      notify.success("Asistencia guardada");
      navigate("/supervisor/classes");
    } catch (err: any) {
      notify.error(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const markAll = (estado: string) => {
    setStudents((prev) => prev.map((s) => ({ ...s, estado })));
  };

  const openNovedad = (student: Student) => {
    navigate(`/supervisor/novedad/${student.codigoEstudiante}`, {
      state: {
        sessionId,
        codigoEstudiante: student.codigoEstudiante,
        nombre: student.nombre,
        apellido: student.apellido,
        grupo: student.grupo,
        novedades: novedadesMap[student.codigoEstudiante] || [],
      },
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-surface-50 dark:bg-surface-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const presentCount = students.filter((s) => s.estado === "presente").length;
  const absentCount = students.filter((s) => s.estado === "ausente").length;
  const justifiedCount = students.filter((s) => s.estado === "justificado").length;
  const pendingCount = students.filter((s) => s.estado === "pendiente").length;

  return (
    <div className="min-h-screen min-h-[100dvh] bg-surface-50 dark:bg-surface-950">
      <header className="bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800">
        <div className="max-w-3xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Logo chip alt="Extracurriculares" className="h-9 w-auto shrink-0" />
            <div className="min-w-0">
              <button onClick={() => navigate("/supervisor/classes")} className="text-xs text-brand-600 hover:text-brand-700 mb-1">
                ← Volver
              </button>
              <h1 className="text-lg font-display font-bold text-surface-900 dark:text-surface-100 break-words">
                {assignment?.discipline?.codigoDisciplina}
                <span className="ml-2 text-sm font-normal text-surface-500">{assignment?.discipline?.nombre}</span>
                {assignment?.grades && assignment.grades.length > 0
                  ? ` — Grados ${assignment.grades.map((g) => g.nombre).join(", ")}`
                  : ` — ${assignment?.grade?.nombre}`}
              </h1>
              <p className="text-xs text-surface-500">
                {teacher?.nombre} {teacher?.apellido} · {schedule?.diaSemana} {schedule?.horaInicio} - {schedule?.horaFin}
              </p>
            </div>
          </div>
          <div className="text-right text-xs text-surface-500 shrink-0">
            <p>{presentCount} presentes</p>
            <p>{absentCount} ausentes</p>
            {justifiedCount > 0 && <p>{justifiedCount} justificados</p>}
            {pendingCount > 0 && <p className="text-amber-600">{pendingCount} pendientes</p>}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={() => markAll("presente")} className="px-3 py-2 text-xs font-medium bg-green-100 text-green-700 rounded-lg hover:bg-green-200">
            Todos presentes
          </button>
          <button onClick={() => markAll("ausente")} className="px-3 py-2 text-xs font-medium bg-red-100 text-red-700 rounded-lg hover:bg-red-200">
            Todos ausentes
          </button>
          <button onClick={() => markAll("pendiente")} className="px-3 py-2 text-xs font-medium bg-surface-100 text-surface-600 rounded-lg hover:bg-surface-200">
            Limpiar
          </button>
        </div>

        {(() => {
          const allNovedades = Object.entries(novedadesMap).flatMap(([codigo, list]) =>
            list.map((n) => ({ codigo, novedad: n })),
          );
          if (allNovedades.length === 0) return null;
          return (
            <section className="card p-5 mb-6">
              <h2 className="font-display font-semibold text-surface-900 dark:text-surface-100 text-base mb-3">
                Novedades del día
              </h2>
              <div className="space-y-2">
                {allNovedades.map(({ codigo, novedad }) => {
                  const st = students.find((s) => s.codigoEstudiante === codigo);
                  return (
                    <div key={novedad.id} className="rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs">
                      {st && (
                        <p className="text-amber-900 dark:text-amber-200 font-semibold">
                          {st.nombre} {st.apellido} {st.grupo ? `· ${st.grupo}` : ""}
                        </p>
                      )}
                      {novedad.descripcion && (
                        <p className="text-amber-800 dark:text-amber-300 font-medium">{novedad.descripcion}</p>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-amber-700 dark:text-amber-400">
                        {novedad.seAusentaCon && <span>Se ausenta con: {novedad.seAusentaCon}</span>}
                        <span>
                          {novedad.regresaAlColegio ? "Sí regresa" : "No regresa"}
                          {novedad.horaEstimadaRegreso ? ` · ${novedad.horaEstimadaRegreso}` : ""}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })()}

        <section className="card p-5 mb-6">
          <h2 className="font-display font-semibold text-surface-900 dark:text-surface-100 text-base mb-3">
            Cambios de disciplina del día
          </h2>
          {transferCount === 0 ? (
            <p className="text-sm text-surface-500">No hay cambios de disciplina registrados para este día.</p>
          ) : (
            <div className="space-y-2">
              {transfers.map((t) => (
                <div key={t.id} className="rounded-lg bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-800 px-3 py-2 text-xs">
                  <p className="text-violet-900 dark:text-violet-200 font-semibold">
                    {t.student.nombre} {t.student.apellido} {t.student.grupo ? `· ${t.student.grupo}` : ""}
                  </p>
                  <p className="text-violet-700 dark:text-violet-400 mt-0.5">
                    {t.origen.nombre || t.origen.codigoDisciplina || "Clase de origen"} → {t.destino.nombre || t.destino.codigoDisciplina || "Clase de destino"}
                  </p>
                  {t.motivo && <p className="text-violet-600 dark:text-violet-300 mt-0.5 italic">“{t.motivo}”</p>}
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="space-y-1">
          {students.map((student, i) => {
            const novedades = novedadesMap[student.codigoEstudiante] || [];
            return (
              <div
                key={student.codigoEstudiante}
                className={`card px-4 py-3 ${
                  student.estado === "presente"
                    ? "border-l-4 border-l-green-500"
                    : student.estado === "ausente"
                    ? "border-l-4 border-l-red-500"
                    : student.estado === "justificado"
                    ? "border-l-4 border-l-amber-500"
                    : ""
                }`}
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs text-surface-400 w-6 text-right shrink-0">{i + 1}</span>
                    {student.fotoUrl ? (
                      <img
                        src={student.fotoUrl}
                        alt={`${student.nombre} ${student.apellido}`}
                        className="h-11 w-11 rounded-xl object-cover shrink-0"
                      />
                    ) : (
                      <Avatar seed={student.codigoEstudiante} className="h-11 w-11 rounded-xl text-sm shrink-0">
                        {student.nombre.charAt(0)}
                        {student.apellido.charAt(0)}
                      </Avatar>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-surface-900 dark:text-surface-100 break-words">
                        {student.nombre} {student.apellido}
                      </p>
                      <p className="text-xs text-surface-500">
                        {student.codigoEstudiante} · {student.gradoNombre ? `Grado ${student.gradoNombre} · ` : ""}{student.grupo || "—"}
                        {student.origen === "quedado" && <span className="ml-1 text-brand-600">· Se queda</span>}
                        {student.origen === "trasladado" && (
                          <span className="ml-1 text-violet-600">· Trasladado desde {student.origenDisciplina || "otra clase"}</span>
                        )}
                      </p>
                      {novedades.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          {novedades.map((n) => (
                            <div key={n.id} className="rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs">
                              {n.descripcion && (
                                <p className="text-amber-800 dark:text-amber-300 font-medium">{n.descripcion}</p>
                              )}
                              <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-amber-700 dark:text-amber-400">
                                {n.seAusentaCon && <span>Se ausenta con: {n.seAusentaCon}</span>}
                                <span>
                                  {n.regresaAlColegio ? "Sí regresa" : "No regresa"}
                                  {n.horaEstimadaRegreso ? ` · ${n.horaEstimadaRegreso}` : ""}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {novedades.length > 0 && (
                        <button
                          onClick={() => openNovedad(student)}
                          className="mt-2 inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/60"
                        >
                          Novedades
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => toggleAttendance(student.codigoEstudiante, "presente")}
                      aria-label="Marcar presente"
                      className={`min-w-[44px] min-h-[44px] px-3 rounded-lg text-sm font-semibold transition-colors ${
                        student.estado === "presente"
                          ? "bg-green-600 text-white"
                          : "bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-green-100"
                      }`}
                    >
                      P
                    </button>
                    <button
                      onClick={() => toggleAttendance(student.codigoEstudiante, "ausente")}
                      aria-label="Marcar ausente"
                      className={`min-w-[44px] min-h-[44px] px-3 rounded-lg text-sm font-semibold transition-colors ${
                        student.estado === "ausente"
                          ? "bg-red-600 text-white"
                          : "bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-red-100"
                      }`}
                    >
                      A
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6">
          <button
            onClick={handleSave}
            disabled={saving || pendingCount > 0}
            className="w-full px-4 py-3 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? "Guardando..." : pendingCount > 0 ? `Faltan ${pendingCount} por marcar` : "Guardar asistencia"}
          </button>
        </div>
      </main>
    </div>
  );
}
