import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { type SecretaryClassStudentsData } from "../../services/secretary";
import { roleApis, type RoleKind } from "../../services/roles";
import { useNotify } from "../../components/common/Notify";
import { Loading } from "../../components/common/States";
import Logo from "../../components/common/Logo";
import { Avatar } from "../../components/common/Avatar";

export default function SecretaryClassStudents({ role = "secretary" }: { role?: RoleKind }) {
  const api = roleApis[role];
  const basePath = role === "admin" ? "/admin" : "/secretary";
  const navigate = useNavigate();
  const [data, setData] = useState<SecretaryClassStudentsData | null>(null);
  const [loading, setLoading] = useState(true);
  const { asignacionId, horarioId } = useParams<{ asignacionId: string; horarioId: string }>();
  const notify = useNotify();

  useEffect(() => {
    if (!asignacionId || !horarioId || !api.getClassStudents) return;
    api.getClassStudents(asignacionId, horarioId)
      .then(setData)
      .catch((err) => {
        notify.error(err.message || "Error al cargar los estudiantes");
        navigate(`${basePath}/classes`);
      })
      .finally(() => setLoading(false));
  }, [api, asignacionId, horarioId, basePath, navigate, notify]);

  if (loading) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-surface-50 dark:bg-surface-950 flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-surface-50 dark:bg-surface-950 flex items-center justify-center">
        <div className="card p-8 text-center text-surface-500 text-sm">Clase no encontrada</div>
      </div>
    );
  }

  const byGrado = data.students.reduce<Record<string, number>>((acc, s) => {
    const g = s.gradoNombre || "—";
    acc[g] = (acc[g] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen min-h-[100dvh] bg-surface-50 dark:bg-surface-950">
      <header className="bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800">
        <div className="max-w-3xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Logo chip alt="Extracurriculares" className="h-9 w-auto shrink-0" />
            <div className="min-w-0">
              <button onClick={() => navigate(`${basePath}/classes`)} className="text-xs text-brand-600 hover:text-brand-700 mb-1">
                ← Volver
              </button>
              <h1 className="text-lg font-display font-bold text-surface-900 dark:text-surface-100 break-words">
                {data.assignment.discipline.codigoDisciplina}
                <span className="ml-2 text-sm font-normal text-surface-500">{data.assignment.discipline.nombre}</span>
                {data.assignment.grades.length > 0
                  ? ` — Grados ${data.assignment.grades.map((g) => g.nombre).join(", ")}`
                  : ""}
              </h1>
              <p className="text-xs text-surface-500">
                {data.assignment.teacher.nombre} {data.assignment.teacher.apellido} · {data.schedule.diaSemana} {data.schedule.horaInicio} - {data.schedule.horaFin}
                {data.schedule.aula && ` · ${data.schedule.aula}`}
              </p>
            </div>
          </div>
          <div className="text-right text-xs text-surface-500 shrink-0">
            <p>{data.students.length} estudiantes</p>
            {Object.entries(byGrado).map(([g, n]) => (
              <p key={g}>Grado {g}: {n}</p>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <div className="card p-4 mb-4">
          <p className="text-xs text-surface-500">
            Vista de solo lectura: podés ver los estudiantes de Extracurriculares de esta clase según el código y sus grados, sin tomar asistencia.
          </p>
        </div>

        {data.students.length === 0 ? (
          <div className="card p-8 text-center text-sm text-surface-500">
            No hay estudiantes de Extracurriculares inscritos en esta clase.
          </div>
        ) : (
          <div className="space-y-1">
            {data.students.map((student, i) => (
              <div key={student.codigoEstudiante} className="card px-4 py-3">
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
                        {student.codigoEstudiante} · Grado {student.gradoNombre || "—"} · {student.grupo || "—"}
                        {student.origen === "quedado" && <span className="ml-1 text-brand-600">· Se queda</span>}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-400">
                    Grado {student.gradoNombre || "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
