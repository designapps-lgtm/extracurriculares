import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  getSupervisorTeacherSchedules,
  searchSupervisorStudents,
  getSupervisorStays,
  createSupervisorStay,
  deleteSupervisorStay,
  supervisorMe,
} from "../../services/supervisor";
import { logout } from "../../services/auth";
import { useNotify } from "../../components/common/Notify";
import { Loading } from "../../components/common/States";
import Logo from "../../components/common/Logo";
import type {
  Supervisor,
  SupervisorTeacherSchedule,
  SupervisorStay,
  SupervisorStayStudent,
} from "../../types";

function hoyInput(): string {
  const t = new Date();
  const mm = String(t.getMonth() + 1).padStart(2, "0");
  const dd = String(t.getDate()).padStart(2, "0");
  return `${t.getFullYear()}-${mm}-${dd}`;
}

function initials(nombre: string, apellido: string): string {
  return `${(nombre || "?").charAt(0)}${(apellido || "").charAt(0)}`.toUpperCase();
}

export default function SupervisorStays() {
  const navigate = useNavigate();
  const notify = useNotify();

  const [supervisor, setSupervisor] = useState<Supervisor | null>(null);
  const [schedules, setSchedules] = useState<SupervisorTeacherSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  const [fecha, setFecha] = useState(hoyInput());
  const [claseValue, setClaseValue] = useState("");

  const [stays, setStays] = useState<SupervisorStay[]>([]);
  const [loadingStays, setLoadingStays] = useState(false);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SupervisorStayStudent[]>([]);
  const [searching, setSearching] = useState(false);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } finally {
      navigate("/");
    }
  }, [navigate]);

  useEffect(() => {
    supervisorMe()
      .then(setSupervisor)
      .catch(() => navigate("/"));
  }, [navigate]);

  useEffect(() => {
    getSupervisorTeacherSchedules()
      .then(setSchedules)
      .catch((e) => notify.error(e?.message || "No se pudieron cargar las clases"))
      .finally(() => setLoading(false));
  }, [notify]);

  const classOptions = useMemo(() => {
    const opts: {
      value: string;
      label: string;
      idAsignacion: string;
      idHorario: string;
      teacher: string;
      discipline: string;
      grade: string;
      diaSemana: string;
    }[] = [];
    for (const a of schedules) {
      for (const sch of a.schedules) {
        opts.push({
          value: `${a.idAsignacion}::${sch.idHorario}`,
          label: `${a.discipline.nombre} · Grado ${a.grade.nombre} · ${a.teacher.nombre} ${a.teacher.apellido} · ${sch.diaSemana}${sch.horaInicio ? ` ${sch.horaInicio}` : ""}`,
          idAsignacion: a.idAsignacion,
          idHorario: sch.idHorario,
          teacher: `${a.teacher.nombre} ${a.teacher.apellido}`,
          discipline: a.discipline.nombre,
          grade: a.grade.nombre,
          diaSemana: sch.diaSemana,
        });
      }
    }
    return opts.sort((x, y) => x.label.localeCompare(y.label));
  }, [schedules]);

  const selectedClass = useMemo(
    () => classOptions.find((c) => c.value === claseValue) ?? null,
    [classOptions, claseValue],
  );

  const loadStays = useCallback(async () => {
    if (!selectedClass) {
      setStays([]);
      return;
    }
    setLoadingStays(true);
    try {
      const data = await getSupervisorStays(selectedClass.idAsignacion, selectedClass.idHorario, fecha);
      setStays(data);
    } catch (e: any) {
      notify.error(e?.message || "No se pudieron cargar los registros");
    } finally {
      setLoadingStays(false);
    }
  }, [selectedClass, fecha, notify]);

  useEffect(() => {
    loadStays();
  }, [loadStays]);

  const selectedCodes = useMemo(() => new Set(stays.map((s) => s.student.codigoEstudiante)), [stays]);

  const runSearch = useCallback(async () => {
    const q = query.trim();
    if (q.length < 3 || !selectedClass) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const data = await searchSupervisorStudents(q);
      setResults(data);
    } catch (e: any) {
      notify.error(e?.message || "Error al buscar estudiantes");
    } finally {
      setSearching(false);
    }
  }, [query, selectedClass, notify]);

  useEffect(() => {
    const t = setTimeout(runSearch, 300);
    return () => clearTimeout(t);
  }, [runSearch]);

  const addStay = async (codigoEstudiante: string) => {
    if (!selectedClass) return;
    try {
      await createSupervisorStay({
        idAsignacion: selectedClass.idAsignacion,
        idHorario: selectedClass.idHorario,
        codigoEstudiante,
        fecha,
      });
      notify.success("Estudiante agregado");
      setResults((r) => r.filter((x) => x.codigoEstudiante !== codigoEstudiante));
      await loadStays();
    } catch (e: any) {
      notify.error(e?.message || "No se pudo agregar al estudiante");
    }
  };

  const removeStay = async (stayId: string) => {
    try {
      await deleteSupervisorStay(stayId);
      notify.success("Registro eliminado");
      setStays((s) => s.filter((x) => x.id !== stayId));
    } catch (e: any) {
      notify.error(e?.message || "No se pudo eliminar el registro");
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-surface-50 dark:bg-surface-950">
      <header className="bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Logo chip alt="Extracurriculares" className="h-9 w-auto" />
            <div className="min-w-0">
              <h1 className="text-lg font-display font-bold text-surface-900 dark:text-surface-100 truncate">
                {supervisor?.nombre} {supervisor?.apellido}
              </h1>
              <p className="text-xs text-surface-500">Niños que se quedan aunque no estén inscritos</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => navigate("/supervisor/dashboard")}
              className="px-3 py-2 text-sm text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800"
            >
              Asistencias
            </button>
            <button
              onClick={() => navigate("/supervisor/schedules")}
              className="px-3 py-2 text-sm text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800"
            >
              Ver horarios
            </button>
            <button onClick={handleLogout} className="px-3 py-2 -mr-2 text-sm text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800">
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-display font-bold text-surface-900 dark:text-surface-100">
            Niños que se quedan
          </h1>
        </div>

        {loading ? (
          <Loading />
        ) : (
          <>
            <div className="card p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">Clase</label>
                  <select
                    value={claseValue}
                    onChange={(e) => setClaseValue(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="">Selecciona la clase</option>
                    {classOptions.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">Fecha</label>
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              {selectedClass && (
                <>
                  <div className="rounded-xl bg-surface-100 dark:bg-surface-800 px-3 py-2 text-sm text-surface-700 dark:text-surface-300">
                    {selectedClass.discipline} · Grado {selectedClass.grade} · {selectedClass.teacher} · {selectedClass.diaSemana} ({fecha})
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-surface-500 mb-1">Buscar estudiante</label>
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Nombre, apellido o código (mín. 3 letras)…"
                      className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    {searching && <p className="text-xs text-surface-400 mt-1">Buscando…</p>}
                    {results.length > 0 && (
                      <ul className="mt-2 divide-y divide-surface-100 dark:divide-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden">
                        {results.map((r) => {
                          const yaAgregado = selectedCodes.has(r.codigoEstudiante);
                          return (
                            <li key={r.codigoEstudiante} className="flex items-center gap-3 px-3 py-2 bg-white dark:bg-surface-950">
                              {r.fotoUrl ? (
                                <img src={r.fotoUrl} alt="" className="h-9 w-9 rounded-lg object-cover shrink-0" />
                              ) : (
                                <span className="h-9 w-9 rounded-lg bg-surface-200 dark:bg-surface-800 flex items-center justify-center text-xs font-semibold text-surface-600 dark:text-surface-400 shrink-0">
                                  {initials(r.nombre, r.apellido)}
                                </span>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">
                                  {r.nombre} {r.apellido}
                                </p>
                                <p className="text-xs text-surface-500 truncate">
                                  {r.codigoEstudiante} · {r.gradoNombre ? `Grado ${r.gradoNombre}` : "—"} {r.grupo ? `· ${r.grupo}` : ""}
                                  {r.inscrito ? " · Inscrito" : " · No inscrito"}
                                </p>
                              </div>
                              <button
                                onClick={() => addStay(r.codigoEstudiante)}
                                disabled={yaAgregado}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-600 text-white enabled:hover:bg-brand-700 disabled:opacity-50"
                              >
                                {yaAgregado ? "Agregado" : "Agregar"}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>

            {selectedClass && (
              <div className="card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-surface-900 dark:text-surface-100">
                    Estudiantes que se quedan ({stays.length})
                  </h2>
                </div>
                {loadingStays ? (
                  <p className="text-xs text-surface-400">Cargando…</p>
                ) : stays.length === 0 ? (
                  <p className="text-sm text-surface-500">
                    Sin estudiantes registrados para esta clase esta fecha.
                  </p>
                ) : (
                  <ul className="divide-y divide-surface-100 dark:divide-surface-800">
                    {stays.map((s) => (
                      <li key={s.id} className="flex items-center gap-3 py-2">
                        {s.student.fotoUrl ? (
                          <img src={s.student.fotoUrl} alt="" className="h-9 w-9 rounded-lg object-cover shrink-0" />
                        ) : (
                          <span className="h-9 w-9 rounded-lg bg-surface-200 dark:bg-surface-800 flex items-center justify-center text-xs font-semibold text-surface-600 dark:text-surface-400 shrink-0">
                            {initials(s.student.nombre, s.student.apellido)}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">
                            {s.student.nombre} {s.student.apellido}
                          </p>
                          <p className="text-xs text-surface-500 truncate">
                            {s.student.codigoEstudiante} · {s.student.gradoNombre ? `Grado ${s.student.gradoNombre}` : "—"} {s.student.grupo ? `· ${s.student.grupo}` : ""}
                          </p>
                        </div>
                        <button
                          onClick={() => removeStay(s.id)}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/60"
                        >
                          Quitar
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
