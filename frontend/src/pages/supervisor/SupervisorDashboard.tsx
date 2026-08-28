import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getSupervisorSessions, supervisorMe, supervisorLogout } from "../../services/supervisor";
import { getDisciplines } from "../../services/disciplines";
import { getTeachers } from "../../services/teachers";
import { useNotify } from "../../components/common/Notify";
import { Loading } from "../../components/common/States";
import { Pagination } from "../../components/common/Pagination";
import type {
  Supervisor,
  SupervisorSessionItem,
  Discipline,
  Teacher,
} from "../../types";

function formatFecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
}

const ESTADO_LABEL: Record<string, { label: string; className: string }> = {
  presente: { label: "Presente", className: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400" },
  ausente: { label: "Ausente", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400" },
  justificado: { label: "Justificado", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400" },
};

export default function SupervisorDashboard() {
  const [supervisor, setSupervisor] = useState<Supervisor | null>(null);
  const [sessions, setSessions] = useState<SupervisorSessionItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [fecha, setFecha] = useState("");
  const [disciplina, setDisciplina] = useState("");
  const [profesor, setProfesor] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const notify = useNotify();

  const load = useCallback(
    (page = 1) => {
      setLoading(true);
      const params: Record<string, string> = { page: String(page), limit: "20" };
      if (fecha) params.fecha = fecha;
      if (disciplina) params.disciplina = disciplina;
      if (profesor) params.profesor = profesor;

      getSupervisorSessions(params)
        .then((res) => {
          setSessions(res.data);
          setMeta(res.meta);
        })
        .catch((err: any) => {
          if (err.message?.includes("401") || err.message?.includes("No autenticado")) {
            navigate("/supervisor/login");
          } else {
            notify.error(err.message || "Error al cargar asistencias");
          }
        })
        .finally(() => setLoading(false));
    },
    [fecha, disciplina, profesor, navigate, notify],
  );

  useEffect(() => {
    supervisorMe()
      .then(setSupervisor)
      .catch(() => navigate("/supervisor/login"));
  }, [navigate]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    Promise.all([
      getDisciplines({ limit: 200 }).catch(() => null),
      getTeachers({ limit: 200 }).catch(() => null),
    ]).then(([dRes, tRes]) => {
      if (dRes) setDisciplines(dRes.data);
      if (tRes) setTeachers(tRes.data);
    });
  }, []);

  const handleLogout = async () => {
    await supervisorLogout();
    navigate("/supervisor/login");
  };

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
      <header className="bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="text-lg font-display font-bold text-surface-900 dark:text-surface-100 truncate">
              {supervisor?.nombre} {supervisor?.apellido}
            </h1>
            <p className="text-xs text-surface-500">Asistencias registradas por los profesores</p>
          </div>
          <button onClick={handleLogout} className="text-sm text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 shrink-0">
            Salir
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <div className="card p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1">Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1">Disciplina</label>
              <select
                value={disciplina}
                onChange={(e) => setDisciplina(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Todas</option>
                {disciplines.map((d) => (
                  <option key={d.codigoDisciplina} value={d.codigoDisciplina}>
                    {d.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1">Profesor</label>
              <select
                value={profesor}
                onChange={(e) => setProfesor(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Todos</option>
                {teachers.map((t) => (
                  <option key={t.idProfesor} value={t.idProfesor}>
                    {t.nombre} {t.apellido}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={() => load(1)}
            className="mt-3 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-700"
          >
            Filtrar
          </button>
        </div>

        <div className="card overflow-hidden p-4">
          {loading ? (
            <Loading />
          ) : sessions.length === 0 ? (
            <div className="text-center py-12 text-sm text-surface-500">
              No hay asistencias registradas con los filtros actuales.
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => navigate(`/supervisor/session/${s.id}`)}
                  className="w-full text-left block bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 hover:border-brand-300 dark:hover:border-brand-700 transition-colors p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-surface-900 dark:text-surface-100 truncate">
                        {s.assignment.discipline.nombre}
                        <span className="ml-2 text-xs text-surface-500">Grado {s.assignment.grade.nombre}</span>
                      </p>
                      <p className="text-sm text-surface-500 mt-0.5">
                        {s.teacher.nombre} {s.teacher.apellido} · {s.schedule.diaSemana} {s.schedule.horaInicio} - {s.schedule.horaFin}
                      </p>
                      <p className="text-xs text-surface-400 mt-1">{formatFecha(s.fecha)}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {(["presente", "ausente", "justificado"] as const).map((est) => (
                          <span key={est} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_LABEL[est].className}`}>
                            {ESTADO_LABEL[est].label}: {s.counts[est]}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className="text-sm text-brand-600 dark:text-brand-400 font-medium shrink-0">
                      Ver asistencia →
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            onPageChange={load}
          />
        </div>
      </main>
    </div>
  );
}