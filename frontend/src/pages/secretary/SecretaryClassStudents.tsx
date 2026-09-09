import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { type SecretaryClassStudentsData } from "../../services/secretary";
import { roleApis, type RoleKind } from "../../services/roles";
import { useNotify } from "../../components/common/Notify";
import { Loading } from "../../components/common/States";
import Logo from "../../components/common/Logo";
import { Avatar } from "../../components/common/Avatar";
import { DIAS_CORTO } from "../../utils/dias";
import { todayColombiaDateKey } from "../../utils/colombiaDate";
import { getRutasPorCodigo } from "../../services/rutas";
import type { Novedad, RutaSlot } from "../../types";

export default function SecretaryClassStudents({ role = "secretary" }: { role?: RoleKind }) {
  const api = roleApis[role];
  const basePath = role === "admin" ? "/admin" : "/secretary";
  const navigate = useNavigate();
  const [data, setData] = useState<SecretaryClassStudentsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [novedadesMap, setNovedadesMap] = useState<Record<string, Novedad[]>>({});
  const [rutasMap, setRutasMap] = useState<Record<string, RutaSlot[]>>({});
  const { asignacionId, horarioId } = useParams<{ asignacionId: string; horarioId: string }>();
  const notify = useNotify();

  useEffect(() => {
    if (!asignacionId || !horarioId || !api.getClassStudents) return;
    api.getClassStudents(asignacionId, horarioId)
      .then((result) => {
        setData(result);
        const codigos = result.students.map((s) => s.codigoEstudiante);
        const fechaConsulta = todayColombiaDateKey();
        if (codigos.length === 0 || !fechaConsulta) return;
        api.getNovedadesBatch(codigos, fechaConsulta)
          .then((novedades) => {
            setNovedadesMap(
              novedades.reduce((acc, item) => {
                if (item.novedades.length > 0) acc[item.codigoEstudiante] = item.novedades;
                return acc;
              }, {} as Record<string, Novedad[]>),
            );
          })
          .catch(() => setNovedadesMap({}));
        getRutasPorCodigo().then(setRutasMap);
      })
      .catch((err: any) => {
        const isAuth = err.status === 401 || String(err.message || "").includes("401") || String(err.message || "").includes("No autenticado");
        if (isAuth) {
          navigate("/");
          return;
        }
        const transient = err.status === 503;
        if (transient) {
          notify.error(err.message || "Error transitorio al cargar los estudiantes, intentá de nuevo");
          return;
        }
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
        <div className="card p-8 text-center text-surface-500 text-sm">
          No se pudieron cargar los estudiantes. Si el problema persiste, volvé a intentarlo en unos minutos.
        </div>
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
                  ? ` — Grados ${formatGradesRange(data.assignment.grades)}`
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

        {(() => {
          const allNovedades = Object.entries(novedadesMap).flatMap(([codigo, list]) =>
            list.map((n) => ({ codigo, novedad: n })),
          );
          if (allNovedades.length === 0) return null;
          return (
            <section className="card p-5 mb-4">
              <h2 className="font-display font-semibold text-surface-900 dark:text-surface-100 text-base mb-3">
                Novedades del día
              </h2>
              <div className="space-y-2">
                {allNovedades.map(({ codigo, novedad }) => {
                  const st = data.students.find((s) => s.codigoEstudiante === codigo);
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

        {data.students.length === 0 ? (
          <div className="card p-8 text-center text-sm text-surface-500">
            No hay estudiantes de Extracurriculares inscritos en esta clase.
          </div>
        ) : (
          <div className="space-y-1">
            {data.students.map((student, i) => {
              const novedades = novedadesMap[student.codigoEstudiante] || [];
              const rutaHoy = (rutasMap[student.codigoEstudiante] || []).filter(
                (r) => r.diaSemana === data.schedule.diaSemana,
              );
              return (
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
                      {rutaHoy.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {rutaHoy.map((slot) => (
                            <span
                              key={slot.columnKey}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 dark:bg-surface-800 border border-brand-200 dark:border-surface-700 px-2.5 py-1.5 text-xs font-medium text-brand-700 dark:text-brand-400"
                            >
                              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 6v6m0 0V18m0-6h2.5m0 0a2.5 2.5 0 01-5 0m5 0a2.5 2.5 0 00-2.5 2.5M8 6a2 2 0 014 0M8 6V3m0 0h1.5M8 3H6m16 9a8 8 0 11-16 0 8 8 0 0116 0z" />
                              </svg>
                              Se va en ruta: {DIAS_CORTO[slot.diaSemana] || slot.diaSemana} · {slot.hora}
                            </span>
                          ))}
                        </div>
                      )}
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
                    </div>
                  </div>
                  <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-400">
                    Grado {student.gradoNombre || "—"}
                  </span>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
