import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { roleApis, type RoleKind, type RoleUser } from "../../services/roles";
import { useNotify } from "../../components/common/Notify";
import { Loading } from "../../components/common/States";
import Logo from "../../components/common/Logo";
import type {
  SupervisorCallableClass,
  SupervisorTransfer,
  SupervisorStayStudent,
} from "../../types";

const DIAS_CORTO: Record<string, string> = {
  LUNES: "Lun", MARTES: "Mar", MIERCOLES: "Mié", JUEVES: "Jue",
  VIERNES: "Vie", SABADO: "Sáb", DOMINGO: "Dom",
};

function dayOfWeek(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00.000Z`);
  const names = ["DOMINGO", "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"];
  return names[d.getUTCDay()];
}

function todayStr(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
  return parts;
}

function formatFecha(fecha: string): string {
  if (!fecha) return "—";
  const d = new Date(`${fecha}T00:00:00.000Z`);
  if (isNaN(d.getTime())) return fecha;
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export interface PageProps {
  role?: RoleKind;
}

export default function SupervisorTransfers({ role = "supervisor" }: PageProps) {
  const api = roleApis[role];
  const [user, setUser] = useState<RoleUser | null>(null);
  const [classes, setClasses] = useState<SupervisorCallableClass[]>([]);
  const [transfers, setTransfers] = useState<SupervisorTransfer[]>([]);
  const [loading, setLoading] = useState(true);

  const [fecha, setFecha] = useState(todayStr());
  const [soloHoy, setSoloHoy] = useState(true);
  const [fechaFin, setFechaFin] = useState(todayStr());
  const [origenKey, setOrigenKey] = useState("");
  const [destinoKey, setDestinoKey] = useState("");
  const [studentQuery, setStudentQuery] = useState("");
  const [studentResults, setStudentResults] = useState<SupervisorStayStudent[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<SupervisorStayStudent | null>(null);
  const [motivo, setMotivo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [filterStudent, setFilterStudent] = useState("");
  const [filterFecha, setFilterFecha] = useState("");

  const navigate = useNavigate();
  const notify = useNotify();

  useEffect(() => {
    api.me()
      .then(setUser)
      .catch(() => navigate("/"));
  }, [api, navigate]);

  const loadTransfers = useCallback(
    (params?: { codigoEstudiante?: string; fecha?: string; fechaFin?: string }) => {
      api.listTransfers(params)
        .then(setTransfers)
        .catch((err: any) => notify.error(err.message || "Error al cargar historial"));
    },
    [api, notify],
  );

  useEffect(() => {
    setLoading(true);
    if (api.canManageTransfers && api.getClasses) {
      api
        .getClasses(false)
        .then((res) => setClasses(res.classes))
        .catch((err: any) => notify.error(err.message || "Error al cargar clases"))
        .finally(() => {
          setLoading(false);
          loadTransfers();
        });
    } else {
      setLoading(false);
      loadTransfers();
    }
  }, [api, loadTransfers, notify]);

  const filterStudentStr = filterStudent.trim();
  const filterFechaStr = filterFecha.trim();
  const filteredTransfers = useMemo(() => {
    return transfers.filter((t) => {
      if (filterStudentStr && !`${t.student.nombre} ${t.student.apellido} ${t.codigoEstudiante}`.toLowerCase().includes(filterStudentStr.toLowerCase())) {
        return false;
      }
      if (filterFechaStr && t.fecha !== filterFechaStr) return false;
      return true;
    });
  }, [transfers, filterStudentStr, filterFechaStr]);

  const fechaDay = fecha ? dayOfWeek(fecha) : "";
  const availableClasses = useMemo(
    () => classes.filter((c) => c.schedule.diaSemana === fechaDay),
    [classes, fechaDay],
  );

  const classLabel = (c: SupervisorCallableClass) =>
    `${c.discipline.nombre} — ${c.grade.nombre}° · ${DIAS_CORTO[c.schedule.diaSemana]} ${c.schedule.horaInicio ?? ""} · ${c.teacher.nombre} ${c.teacher.apellido}`;

  useEffect(() => {
    setDestinoKey("");
  }, [origenKey, fechaDay]);

  const classKey = (c: SupervisorCallableClass) => `${c.idAsignacion}|${c.schedule.idHorario}`;

  const handleStudentSearch = async (q: string) => {
    setStudentQuery(q);
    if (!q.trim() || !api.searchStudents) {
      setStudentResults([]);
      return;
    }
    try {
      setStudentResults(await api.searchStudents(q));
    } catch {
      setStudentResults([]);
    }
  };

  const pickStudent = (s: SupervisorStayStudent) => {
    setSelectedStudent(s);
    setStudentQuery(`${s.nombre} ${s.apellido}`);
    setStudentResults([]);
  };

  const handleSubmit = async () => {
    if (!selectedStudent) {
      notify.error("Seleccioná un estudiante");
      return;
    }
    if (!origenKey) {
      notify.error("Seleccioná la clase de origen");
      return;
    }
    if (!destinoKey) {
      notify.error("Seleccioná la clase de destino");
      return;
    }
    if (!motivo.trim()) {
      notify.error("Indicá el motivo del traslado");
      return;
    }
    const [idAsignacionOrigen, idHorarioOrigen] = origenKey.split("|");
    const [idAsignacionDestino] = destinoKey.split("|");
    if (!idAsignacionOrigen || !idHorarioOrigen || !idAsignacionDestino) return;
    if (!api.createTransfer) return;
    setSubmitting(true);
    try {
      await api.createTransfer({
        codigoEstudiante: selectedStudent.codigoEstudiante,
        idAsignacionOrigen,
        idAsignacionDestino,
        idHorarioDestino: destinoKey.split("|")[1],
        fecha,
        fechaFin: soloHoy ? undefined : fechaFin,
        motivo: motivo.trim(),
      });
      notify.success("Traslado registrado");
      setSelectedStudent(null);
      setStudentQuery("");
      setMotivo("");
      setFilterStudent("");
      setFilterFecha("");
      loadTransfers();
    } catch (err: any) {
      notify.error(err.message || "Error al registrar el traslado");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (t: SupervisorTransfer) => {
    if (!api.deleteTransfer) return;
    if (!window.confirm(`¿Eliminar el traslado de ${t.student.nombre} ${t.student.apellido} del ${formatFecha(t.fecha)}?`)) return;
    try {
      await api.deleteTransfer(t.id);
      notify.success("Traslado eliminado");
      loadTransfers();
    } catch (err: any) {
      notify.error(err.message || "Error al eliminar");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-surface-50 dark:bg-surface-950 flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-surface-50 dark:bg-surface-950">
      <header className="bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Logo chip alt="Extracurriculares" className="h-9 w-auto" />
            <div className="min-w-0">
              <h1 className="text-lg font-display font-bold text-surface-900 dark:text-surface-100 truncate">
                Traslados · Niños que se quedan
              </h1>
              <p className="text-xs text-surface-500">
                {user?.nombre ? `${user.nombre} ${user.apellido}` : ""} · mover un estudiante de una clase a otra por un tiempo
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-8">
        {api.canManageTransfers && (
        <section className="card p-6">
          <h2 className="font-display font-semibold text-surface-900 dark:text-surface-100 text-base mb-1">
            Registrar traslado
          </h2>
          <p className="text-sm text-surface-500 mb-5">
            El estudiante desaparece de la clase de origen y aparece en la clase de destino, por la duración elegida.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                Duración
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setSoloHoy(true)}
                  className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    soloHoy
                      ? "bg-brand-600 text-white"
                      : "bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400"
                  }`}
                >
                  Solo hoy
                </button>
                <button
                  onClick={() => setSoloHoy(false)}
                  className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    !soloHoy
                      ? "bg-brand-600 text-white"
                      : "bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400"
                  }`}
                >
                  Por un tiempo
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">Fecha inicial</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm"
              />
              <p className="text-xs text-surface-400 mt-1">
                {fechaDay ? DIAS_CORTO[fechaDay] || "Día inválido" : "Elegí una fecha"}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">Fecha final</label>
              <input
                type="date"
                value={fechaFin}
                min={fecha}
                onChange={(e) => setFechaFin(e.target.value)}
                disabled={soloHoy}
                className="w-full px-3 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm disabled:opacity-50"
              />
              <p className="text-xs text-surface-400 mt-1">
                {soloHoy ? "Coincide con la fecha inicial" : "Hasta qué día se queda en la clase de destino"}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                Clase de origen (donde está ahora)
              </label>
              <select
                value={origenKey}
                onChange={(e) => setOrigenKey(e.target.value)}
                disabled={!availableClasses.length}
                className="w-full px-3 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm disabled:opacity-50"
              >
                <option value="">Seleccioná...</option>
                {availableClasses.map((c) => (
                  <option key={`o-${classKey(c)}`} value={classKey(c)}>
                    {classLabel(c)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                Clase de destino (a dónde pasa)
              </label>
              <select
                value={destinoKey}
                onChange={(e) => setDestinoKey(e.target.value)}
                disabled={!origenKey}
                className="w-full px-3 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm disabled:opacity-50"
              >
                <option value="">Seleccioná...</option>
                {availableClasses
                  .filter((c) => classKey(c) !== origenKey)
                  .map((c) => (
                    <option key={`d-${classKey(c)}`} value={classKey(c)}>
                      {classLabel(c)}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">Estudiante</label>
              {selectedStudent ? (
                <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-brand-300 dark:border-brand-700 bg-brand-50 dark:bg-brand-900/20">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">
                      {selectedStudent.nombre} {selectedStudent.apellido}
                    </p>
                    <p className="text-xs text-surface-500">{selectedStudent.codigoEstudiante} · {selectedStudent.grupo || "—"}</p>
                  </div>
                  <button onClick={() => { setSelectedStudent(null); setStudentQuery(""); }} className="text-xs text-surface-400 hover:text-red-500">
                    Quitar
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={studentQuery}
                    onChange={(e) => handleStudentSearch(e.target.value)}
                    placeholder="Buscar por código, nombre o apellido..."
                    className="w-full px-3 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm"
                  />
                  {studentResults.length > 0 && (
                    <ul className="absolute z-20 mt-1 w-full bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-lg max-h-60 overflow-auto">
                      {studentResults.map((s) => (
                        <li key={s.codigoEstudiante}>
                          <button
                            onClick={() => pickStudent(s)}
                            className="w-full text-left px-3 py-2.5 text-sm hover:bg-surface-50 dark:hover:bg-surface-700"
                          >
                            <span className="font-medium text-surface-900 dark:text-surface-100">{s.nombre} {s.apellido}</span>
                            <span className="block text-xs text-surface-500">{s.codigoEstudiante} · {s.grupo || "—"}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mt-5">
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
              Motivo del traslado (trazabilidad)
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              placeholder="Ej: se pasa a Baloncesto por este día por lesión / necesidad del grupo"
              className="w-full px-3 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="mt-6 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl disabled:opacity-50"
          >
            {submitting ? "Registrando..." : "Registrar traslado"}
          </button>
        </section>
        )}

        <section className="card p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="font-display font-semibold text-surface-900 dark:text-surface-100 text-base">
              Historial de traslados
            </h2>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={filterStudent}
                onChange={(e) => setFilterStudent(e.target.value)}
                placeholder="Filtrar por estudiante..."
                className="px-3 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm"
              />
              <input
                type="date"
                value={filterFecha}
                onChange={(e) => setFilterFecha(e.target.value)}
                className="px-3 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm"
              />
            </div>
          </div>

          {filteredTransfers.length === 0 ? (
            <p className="text-sm text-surface-500 py-6 text-center">No hay traslados registrados.</p>
          ) : (
            <div className="divide-y divide-surface-100 dark:divide-surface-800">
              {filteredTransfers.map((t) => (
                <div key={t.id} className="py-4 flex flex-col md:flex-row md:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-900 dark:text-surface-100">
                      {t.student.nombre} {t.student.apellido}
                      <span className="ml-2 text-xs font-normal text-surface-500">
                        {t.codigoEstudiante} · {formatFecha(t.fecha)}
                        {t.fechaFin ? ` → ${formatFecha(t.fechaFin)}` : ""}
                      </span>
                    </p>
                    <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">
                      <span className="text-surface-400">{t.origen.discipline.nombre}</span>
                      <span className="mx-1.5 text-brand-600">→</span>
                      <span className="font-medium">{t.destino.discipline.nombre} {t.destino.grade.nombre}°</span>
                      <span className="ml-2 text-xs text-surface-500">
                        {DIAS_CORTO[t.destino.schedule.diaSemana] || t.destino.schedule.diaSemana} {t.destino.schedule.horaInicio ?? ""} · {t.destino.teacher.nombre} {t.destino.teacher.apellido}
                      </span>
                    </p>
                    {t.motivo && (
                      <p className="text-sm text-surface-500 mt-1 italic">“{t.motivo}”</p>
                    )}
                    <p className="text-xs text-surface-400 mt-1">
                      Registrado por {t.supervisor.nombre} {t.supervisor.apellido}
                    </p>
                  </div>
                  {api.canManageTransfers && (
                    <button
                      onClick={() => handleDelete(t)}
                      className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
