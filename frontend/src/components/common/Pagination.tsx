export function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
  variant = "bordered",
}: {
  page: number;
  totalPages: number;
  total?: number;
  onPageChange: (page: number) => void;
  variant?: "bordered" | "centered";
}) {
  if (totalPages <= 1) return null;

  if (variant === "centered") {
    return (
      <div className="flex items-center justify-center gap-3 pt-2">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="btn-secondary"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Anterior
        </button>
        <span className="text-sm text-surface-500 dark:text-surface-400 font-medium tabular-nums">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="btn-secondary"
        >
          Siguiente
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 border-t border-surface-100 dark:border-surface-800 flex items-center justify-between text-sm">
      <span className="text-surface-500">
        {total} resultados · Página {page} de {totalPages}
      </span>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1 rounded-lg border border-surface-200 dark:border-surface-700 disabled:opacity-50 text-sm"
        >
          Anterior
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1 rounded-lg border border-surface-200 dark:border-surface-700 disabled:opacity-50 text-sm"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}