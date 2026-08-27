import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getAttendanceList, saveAttendance } from "../../services/teacher";
import { useNotify } from "../../components/common/Notify";
import type { AttendanceStudent as Student, Schedule, Assignment } from "../../types";

export default function TeacherAttendance() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const notify = useNotify();

  useEffect(() => {
    if (!sessionId) return;
    getAttendanceList(sessionId)
      .then((data) => {
        setAssignment(data.assignment);
        setSchedule(data.schedule);
        setStudents(data.students);
      })
      .catch((err) => {
        notify.error(err.message || "Error al cargar asistencia");
        navigate("/teacher/dashboard");
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
      await saveAttendance(sessionId, records);
      navigate("/teacher/dashboard");
    } catch (err: any) {
      notify.error(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const markAll = (estado: string) => {
    setStudents((prev) => prev.map((s) => ({ ...s, estado })));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 dark:bg-surface-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const presentCount = students.filter((s) => s.estado === "presente").length;
  const absentCount = students.filter((s) => s.estado === "ausente").length;
  const justifiedCount = students.filter((s) => s.estado === "justificado").length;
  const pendingCount = students.filter((s) => s.estado === "pendiente").length;

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
      <header className="bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <button onClick={() => navigate("/teacher/dashboard")} className="text-xs text-brand-600 hover:text-brand-700 mb-1">
              ← Volver
            </button>
            <h1 className="text-lg font-display font-bold text-surface-900 dark:text-surface-100">
              {assignment?.discipline?.nombre} — {assignment?.grade?.nombre}
            </h1>
            <p className="text-xs text-surface-500">
              {schedule?.diaSemana} {schedule?.horaInicio} - {schedule?.horaFin}
            </p>
          </div>
          <div className="text-right text-xs text-surface-500">
            <p>{presentCount} presentes</p>
            <p>{absentCount} ausentes</p>
            {justifiedCount > 0 && <p>{justifiedCount} justificados</p>}
            {pendingCount > 0 && <p className="text-amber-600">{pendingCount} pendientes</p>}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex gap-2 mb-4">
          <button onClick={() => markAll("presente")} className="px-3 py-1.5 text-xs font-medium bg-green-100 text-green-700 rounded-lg hover:bg-green-200">
            Todos presentes
          </button>
          <button onClick={() => markAll("ausente")} className="px-3 py-1.5 text-xs font-medium bg-red-100 text-red-700 rounded-lg hover:bg-red-200">
            Todos ausentes
          </button>
          <button onClick={() => markAll("pendiente")} className="px-3 py-1.5 text-xs font-medium bg-surface-100 text-surface-600 rounded-lg hover:bg-surface-200">
            Limpiar
          </button>
        </div>

        <div className="space-y-1">
          {students.map((student, i) => (
            <div
              key={student.codigoEstudiante}
              className={`card px-4 py-3 flex items-center justify-between ${
                student.estado === "presente"
                  ? "border-l-4 border-l-green-500"
                  : student.estado === "ausente"
                  ? "border-l-4 border-l-red-500"
                  : student.estado === "justificado"
                  ? "border-l-4 border-l-amber-500"
                  : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xs text-surface-400 w-6 text-right">{i + 1}</span>
                <div>
                  <p className="text-sm font-medium text-surface-900 dark:text-surface-100">
                    {student.nombre} {student.apellido}
                  </p>
                  <p className="text-xs text-surface-500">{student.codigoEstudiante} · {student.grupo || "—"}</p>
                </div>
              </div>

              <div className="flex gap-1">
                <button
                  onClick={() => toggleAttendance(student.codigoEstudiante, "presente")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    student.estado === "presente"
                      ? "bg-green-600 text-white"
                      : "bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-green-100"
                  }`}
                >
                  P
                </button>
                <button
                  onClick={() => toggleAttendance(student.codigoEstudiante, "ausente")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    student.estado === "ausente"
                      ? "bg-red-600 text-white"
                      : "bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-red-100"
                  }`}
                >
                  A
                </button>
                <button
                  onClick={() => toggleAttendance(student.codigoEstudiante, "justificado")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    student.estado === "justificado"
                      ? "bg-amber-500 text-white"
                      : "bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-amber-100"
                  }`}
                >
                  J
                </button>
              </div>
            </div>
          ))}
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
