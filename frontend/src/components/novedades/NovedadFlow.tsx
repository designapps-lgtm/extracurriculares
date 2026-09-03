import type { Novedad } from "../../types";

function isProcessed(value: string | null): boolean {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  return ["si", "sí", "true", "1", "procesado", "completado", "finalizado", "cerrado"].includes(normalized);
}

export function shouldShowNovedadField(novedad: Novedad, field: string): boolean {
  return !novedad.novedadMeta || novedad.novedadMeta.visibleFields.includes(field);
}

export default function NovedadFlow({ novedad, compact = false }: { novedad: Novedad; compact?: boolean }) {
  const meta = novedad.novedadMeta;
  if (!meta) {
    return novedad.flujoNovedad ? (
      <div className="rounded-xl border border-brand-100 dark:border-brand-900/40 bg-brand-50/70 dark:bg-brand-900/10 px-4 py-3">
        <p className="text-xs font-medium text-brand-700 dark:text-brand-300">Flujo</p>
        <p className="text-sm font-semibold text-brand-900 dark:text-brand-100">{novedad.flujoNovedad}</p>
      </div>
    ) : null;
  }

  const completed = isProcessed(novedad.procesado);
  const currentIndex = completed ? meta.flowSteps.length - 1 : Math.min(1, meta.flowSteps.length - 1);

  return (
    <section className={`rounded-xl border border-brand-100 dark:border-brand-900/40 bg-brand-50/70 dark:bg-brand-900/10 ${compact ? "px-3 py-3" : "px-4 py-4"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-brand-700 dark:text-brand-300">Flujo de atención</p>
          <p className="text-sm font-semibold text-brand-900 dark:text-brand-100">{meta.flowLabel}</p>
        </div>
        <span className="rounded-full bg-white/80 dark:bg-surface-900/70 px-2.5 py-1 text-xs font-medium text-brand-700 dark:text-brand-300">
          {meta.familyLabel}
        </span>
      </div>

      <div className={`mt-3 grid ${compact ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-1 sm:grid-cols-2"} gap-2`}>
        {meta.flowSteps.map((step, index) => {
          const done = index < currentIndex || (completed && index === currentIndex);
          const active = !completed && index === currentIndex;
          return (
            <div key={step.key} className={`rounded-lg border px-3 py-2 ${done ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-900/20" : active ? "border-brand-300 bg-white dark:border-brand-700 dark:bg-surface-900/60" : "border-brand-100/80 bg-white/50 dark:border-brand-900/30 dark:bg-surface-900/30"}`}>
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${done ? "bg-emerald-500" : active ? "bg-brand-500" : "bg-surface-300 dark:bg-surface-600"}`} />
                <span className={`text-xs font-medium ${done ? "text-emerald-800 dark:text-emerald-200" : active ? "text-brand-800 dark:text-brand-200" : "text-surface-500 dark:text-surface-400"}`}>
                  {step.label}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-surface-400">{done ? "Completado" : active ? "En seguimiento" : "Pendiente"}</p>
            </div>
          );
        })}
      </div>

      {!compact && (
        <p className="mt-3 text-xs text-brand-700/80 dark:text-brand-300/80">
          Esta clasificación orienta el seguimiento y no cambia automáticamente la asistencia.
        </p>
      )}
    </section>
  );
}
