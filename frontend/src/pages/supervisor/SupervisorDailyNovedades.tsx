import { useEffect, useMemo, useState } from "react";
import { roleApis, type RoleKind, type DailyNovedad } from "../../services/roles";
import { Loading } from "../../components/common/States";
import { useNotify } from "../../components/common/Notify";

function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
}

function formatDate(value: string | null): string {
  if (!value) return "Sin hora registrada";
  return new Date(value).toLocaleString("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Bogota",
  });
}

type Nivel = "prescolar" | "primaria" | "secundaria";

function nivelDeGrado(grado: string | null): Nivel | null {
  if (!grado) return null;
  const value = grado.trim().toUpperCase();
  if (["PV", "K3", "K4", "K5"].includes(value)) return "prescolar";
  const number = Number.parseInt(value, 10);
  if (number >= 1 && number <= 5) return "primaria";
  if (number >= 6 && number <= 12) return "secundaria";
  return null;
}

export default function SupervisorDailyNovedades({ role = "supervisor" }: { role?: RoleKind }) {
  const api = roleApis[role];
  const [fecha, setFecha] = useState(today);
  const [grado, setGrado] = useState("");
  const [grados, setGrados] = useState<string[]>([]);
  const [items, setItems] = useState<DailyNovedad[]>([]);
  const [niveles, setNiveles] = useState<Nivel[]>([]);
  const [estudiante, setEstudiante] = useState("");
  const [loading, setLoading] = useState(true);
  const notify = useNotify();

  const load = (filters: { fecha?: string; grado?: string } = {}) => {
    setLoading(true);
    api.getNovedadesDiarias({ fecha: filters.fecha ?? fecha, grado: filters.grado ?? grado })
      .then(setItems)
      .catch((error: any) => notify.error(error.message || "No se pudieron cargar las novedades"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    api.getFilters().then((data) => setGrados(data.grados)).catch(() => notify.error("No se pudieron cargar los grados"));
  }, [api, notify]);

  useEffect(() => { load(); }, [api]);

  const itemsPorNivel = useMemo(() => {
    if (niveles.length === 0) return items;
    return items.filter(({ estudiante: student }) => {
      const nivel = nivelDeGrado(student.grado);
      return nivel !== null && niveles.includes(nivel);
    });
  }, [items, niveles]);

  const estudiantes = useMemo(() => {
    const unique = new Map<string, DailyNovedad["estudiante"]>();
    itemsPorNivel.forEach(({ estudiante: student }) => unique.set(student.codigoEstudiante, student));
    return [...unique.values()].sort((a, b) => `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`));
  }, [itemsPorNivel]);

  const filteredItems = useMemo(() => {
    const search = estudiante.trim().toLowerCase();
    if (!search) return itemsPorNivel;
    return itemsPorNivel.filter(({ estudiante: student }) =>
      `${student.nombre} ${student.apellido} ${student.codigoEstudiante}`.toLowerCase().includes(search),
    );
  }, [itemsPorNivel, estudiante]);

  const toggleNivel = (nivel: Nivel) => {
    setNiveles((current) => current.includes(nivel) ? current.filter((item) => item !== nivel) : [...current, nivel]);
    setEstudiante("");
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      <div>
        <p className="text-sm text-surface-500">Seguimiento de estudiantes</p>
        <h1 className="text-2xl font-display font-bold text-surface-900 dark:text-surface-100">Novedades diarias</h1>
      </div>

      <div className="card p-4 flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1">
          <label className="block text-xs font-medium text-surface-500 mb-1">Fecha</label>
          <div className="flex gap-2">
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="min-w-0 flex-1 px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm" />
            <button type="button" onClick={() => { const current = today(); setFecha(current); load({ fecha: current }); }} className="px-3 py-2 rounded-xl border border-brand-600 text-brand-600 dark:text-brand-400 text-sm font-medium hover:bg-brand-50 dark:hover:bg-brand-900/20">Hoy</button>
          </div>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-surface-500 mb-1">Grado</label>
          <select value={grado} onChange={(e) => setGrado(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm">
            <option value="">Todos los grados</option>
            {grados.map((g) => <option key={g} value={g}>Grado {g}</option>)}
          </select>
        </div>
        <button onClick={() => load()} className="px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700">Filtrar</button>
      </div>

      <div className="card p-4 space-y-4">
        <div>
          <p className="text-xs font-medium text-surface-500 mb-2">Filtrar por nivel</p>
          <div className="flex flex-wrap gap-4">
            {(["prescolar", "primaria", "secundaria"] as Nivel[]).map((nivel) => (
              <label key={nivel} className="inline-flex items-center gap-2 text-sm text-surface-700 dark:text-surface-300 cursor-pointer">
                <input type="checkbox" checked={niveles.includes(nivel)} onChange={() => toggleNivel(nivel)} className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500" />
                {nivel === "prescolar" ? "Prescolar" : nivel[0].toUpperCase() + nivel.slice(1)}
              </label>
            ))}
          </div>
        </div>
        {niveles.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1">Filtrar por estudiante</label>
            <input list="novedades-estudiantes" value={estudiante} onChange={(e) => setEstudiante(e.target.value)} placeholder="Nombre o código del estudiante" className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm" />
            <datalist id="novedades-estudiantes">
              {estudiantes.map((student) => <option key={student.codigoEstudiante} value={`${student.nombre} ${student.apellido}`} label={student.codigoEstudiante} />)}
            </datalist>
          </div>
        )}
      </div>

      {loading ? <Loading /> : filteredItems.length === 0 ? (
        <div className="card p-10 text-center text-sm text-surface-500">No hay novedades para los filtros seleccionados.</div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map(({ estudiante, novedad }) => (
            <article key={novedad.id} className="card p-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div>
                  <h2 className="font-display font-semibold text-surface-900 dark:text-surface-100">{estudiante.nombre} {estudiante.apellido}</h2>
                  <p className="text-xs text-surface-500">Código: {estudiante.codigoEstudiante} · Grado {estudiante.grado || "sin grado"}{estudiante.grupo ? ` · ${estudiante.grupo}` : ""}</p>
                </div>
                <span className="text-xs text-surface-400">{formatDate(novedad.fechaHora || novedad.fechaNovedad || novedad.fechaCreacion)}</span>
              </div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {novedad.tipoNovedad && <div><span className="text-xs text-surface-400 block">Tipo de novedad</span><span className="text-surface-800 dark:text-surface-200">{novedad.tipoNovedad}</span></div>}
                {novedad.descripcion && <div><span className="text-xs text-surface-400 block">Descripción</span><span className="text-surface-800 dark:text-surface-200">{novedad.descripcion}</span></div>}
                {(novedad.seAusentaConTipo || novedad.seAusentaCon || novedad.seAusentaConOtro) && <div><span className="text-xs text-surface-400 block">Motivo</span><span className="text-surface-800 dark:text-surface-200">{novedad.seAusentaConTipo || novedad.seAusentaCon || novedad.seAusentaConOtro}</span></div>}
                {novedad.registradoPor && <div><span className="text-xs text-surface-400 block">Autorizado por</span><span className="text-surface-800 dark:text-surface-200">{novedad.registradoPor}</span></div>}
                <div><span className="text-xs text-surface-400 block">Fecha y hora de la novedad</span><span className="text-surface-800 dark:text-surface-200">{formatDate(novedad.fechaHora || novedad.fechaNovedad || novedad.fechaCreacion)}</span></div>
                <div><span className="text-xs text-surface-400 block">Regreso</span><span className="text-surface-800 dark:text-surface-200">{novedad.regresaAlColegio ? "Sí regresa" : "No regresa"}{novedad.horaEstimadaRegreso ? ` · ${novedad.horaEstimadaRegreso}` : ""}</span></div>
              </div>
              {estudiante.fotoUrl && (
                <div className="mt-4">
                  <span className="text-xs text-surface-400 block mb-1">Foto</span>
                  <img src={estudiante.fotoUrl} alt={`Foto de ${estudiante.nombre} ${estudiante.apellido}`} className="max-h-48 max-w-full rounded-xl object-contain border border-surface-200 dark:border-surface-700" />
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
