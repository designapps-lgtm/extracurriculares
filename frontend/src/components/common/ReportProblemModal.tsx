import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useNotify } from "./Notify";
import { supervisorReportProblem } from "../../services/supervisor";
import { secretaryReportProblem } from "../../services/secretary";
import { teacherReportProblem } from "../../services/teacher";
import { adminReportProblem } from "../../services/adminOperations";
import type { ReportCategoria } from "../../types";

export type ReportRole = "supervisor" | "secretary" | "teacher" | "admin";

const CATEGORIAS: { value: ReportCategoria; label: string }[] = [
  { value: "problema", label: "Problema o error" },
  { value: "sugerencia", label: "Sugerencia de mejora" },
  { value: "otro", label: "Otro" },
];

const ROLE_SERVICES: Record<ReportRole, typeof supervisorReportProblem> = {
  supervisor: supervisorReportProblem,
  secretary: secretaryReportProblem,
  teacher: teacherReportProblem,
  admin: adminReportProblem,
};

export function ReportProblemButton({
  role,
  className = "",
  compact = false,
}: {
  role: ReportRole;
  className?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className}
        aria-label={compact ? "Reportar problema" : undefined}
        title={compact ? "Reportar problema" : undefined}
      >
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        {!compact && "Reportar problema"}
      </button>
      {open && <ReportProblemModal role={role} onClose={() => setOpen(false)} />}
    </>
  );
}

export function ReportProblemModal({ role, onClose }: { role: ReportRole; onClose: () => void }) {
  const location = useLocation();
  const notify = useNotify();
  const [categoria, setCategoria] = useState<ReportCategoria>("problema");
  const [descripcion, setDescripcion] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSubmit = async () => {
    if (descripcion.trim().length < 5) {
      notify.error("Describí el problema (mínimo 5 caracteres)");
      return;
    }
    setSending(true);
    try {
      await ROLE_SERVICES[role]({
        categoria,
        descripcion: descripcion.trim(),
        pagina: location.pathname,
      });
      notify.success("Reporte enviado. El equipo de administración lo revisará.");
      onClose();
    } catch (err: any) {
      notify.error(err.message || "No se pudo enviar el reporte");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-surface-900 rounded-2xl p-6 w-full max-w-md shadow-xl animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-terracotta-50 dark:bg-terracotta-950 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-terracotta-600 dark:text-terracotta-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h3 className="font-display font-semibold text-surface-900 dark:text-surface-100">Reportar problema</h3>
            <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
              El reporte llega directo a administración para poder arreglarlo.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label htmlFor="report-categoria" className="block text-xs font-medium text-surface-500 mb-1">
              Categoría
            </label>
            <select
              id="report-categoria"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as ReportCategoria)}
              className="w-full px-3 py-2.5 border border-surface-200 dark:border-surface-700 rounded-xl text-sm bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            >
              {CATEGORIAS.map((cat) => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="report-descripcion" className="block text-xs font-medium text-surface-500 mb-1">
              Descripción
            </label>
            <textarea
              id="report-descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={4}
              placeholder="¿Qué pasó? ¿Qué esperabas que ocurriera?"
              className="w-full px-3 py-2.5 border border-surface-200 dark:border-surface-700 rounded-xl text-sm bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
            />
            <p className="text-xs text-surface-400 mt-1">Página: {location.pathname}</p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-surface-200 dark:border-surface-700 rounded-xl text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={sending}
            className="flex-1 px-4 py-2.5 bg-terracotta-600 text-white rounded-xl text-sm font-medium hover:bg-terracotta-700 active:bg-terracotta-800 disabled:opacity-50 disabled:pointer-events-none transition-colors"
          >
            {sending ? "Enviando..." : "Enviar reporte"}
          </button>
        </div>
      </div>
    </div>
  );
}