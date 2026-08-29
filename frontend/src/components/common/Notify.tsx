import { useState, useCallback, useEffect, createContext, useContext } from "react";

interface Notification {
  id: number;
  type: "success" | "error" | "info";
  message: string;
}

interface ConfirmState {
  id: number;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: "danger" | "default";
  resolve: (result: boolean) => void;
}

interface PromptState {
  id: number;
  title: string;
  message: string;
  inputType?: string;
  inputPlaceholder?: string;
  resolve: (result: string | null) => void;
}

interface NotifyContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  confirm: (title: string, message: string, options?: { confirmLabel?: string; variant?: "danger" | "default" }) => Promise<boolean>;
  prompt: (title: string, message: string, options?: { inputType?: string; inputPlaceholder?: string }) => Promise<string | null>;
}

const NotifyContext = createContext<NotifyContextValue | null>(null);

export function useNotify() {
  const ctx = useContext(NotifyContext);
  if (!ctx) throw new Error("useNotify must be used within NotifyProvider");
  return ctx;
}

let nextId = 0;

export function NotifyProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Notification[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [promptState, setPromptState] = useState<PromptState | null>(null);

  const addToast = useCallback((type: Notification["type"], message: string) => {
    const id = ++nextId;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const confirm = useCallback(
    (title: string, message: string, options?: { confirmLabel?: string; variant?: "danger" | "default" }) =>
      new Promise<boolean>((resolve) => {
        setConfirmState({
          id: ++nextId,
          title,
          message,
          confirmLabel: options?.confirmLabel,
          variant: options?.variant,
          resolve,
        });
      }),
    [],
  );

  const prompt = useCallback(
    (title: string, message: string, options?: { inputType?: string; inputPlaceholder?: string }) =>
      new Promise<string | null>((resolve) => {
        setPromptState({
          id: ++nextId,
          title,
          message,
          inputType: options?.inputType,
          inputPlaceholder: options?.inputPlaceholder,
          resolve,
        });
      }),
    [],
  );

  const resolveConfirm = (result: boolean) => {
    confirmState?.resolve(result);
    setConfirmState(null);
  };

  const resolvePrompt = (result: string | null) => {
    promptState?.resolve(result);
    setPromptState(null);
  };

  return (
    <NotifyContext.Provider value={{ success: (m) => addToast("success", m), error: (m) => addToast("error", m), info: (m) => addToast("info", m), confirm, prompt }}>
      {children}

      {/* Toast container */}
      <div className="fixed top-20 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <Toast key={t.id} notification={t} />
        ))}
      </div>

      {/* Confirm modal */}
      {confirmState && (
        <ConfirmModal
          key={confirmState.id}
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          variant={confirmState.variant}
          onConfirm={() => resolveConfirm(true)}
          onCancel={() => resolveConfirm(false)}
        />
      )}

      {/* Prompt modal */}
      {promptState && (
        <PromptModal
          key={promptState.id}
          title={promptState.title}
          message={promptState.message}
          inputType={promptState.inputType}
          inputPlaceholder={promptState.inputPlaceholder}
          onConfirm={(val) => resolvePrompt(val)}
          onCancel={() => resolvePrompt(null)}
        />
      )}
    </NotifyContext.Provider>
  );
}

function Toast({ notification }: { notification: Notification }) {
  const icons = {
    success: (
      <svg className="w-5 h-5 text-brand-600 dark:text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    error: (
      <svg className="w-5 h-5 text-terracotta-600 dark:text-terracotta-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
    ),
    info: (
      <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
      </svg>
    ),
  };

  const bg = {
    success: "bg-white dark:bg-surface-900 border-brand-200 dark:border-brand-800",
    error: "bg-white dark:bg-surface-900 border-terracotta-200 dark:border-terracotta-800",
    info: "bg-white dark:bg-surface-900 border-blue-200 dark:border-blue-800",
  };

  return (
    <div className={`pointer-events-auto animate-in slide-in-from-right-5 duration-300 border rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 w-[calc(100vw-2rem)] sm:w-auto min-w-[min(280px,calc(100vw-2rem))] max-w-sm ${bg[notification.type]}`}>
      {icons[notification.type]}
      <p className="text-sm text-surface-700 dark:text-surface-300">{notification.message}</p>
    </div>
  );
}

function ConfirmModal({
  title,
  message,
  confirmLabel = "Confirmar",
  variant = "default",
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  const confirmBtn =
    variant === "danger"
      ? "bg-terracotta-600 text-white hover:bg-terracotta-700 active:bg-terracotta-800"
      : "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800";

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onCancel}>
      <div
        className="bg-white dark:bg-surface-900 rounded-2xl p-6 w-full max-w-sm shadow-xl animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${variant === "danger" ? "bg-terracotta-50 dark:bg-terracotta-950" : "bg-brand-50 dark:bg-brand-950"}`}>
            {variant === "danger" ? (
              <svg className="w-5 h-5 text-terracotta-600 dark:text-terracotta-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-brand-600 dark:text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
              </svg>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-display font-semibold text-surface-900 dark:text-surface-100">{title}</h3>
            <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 border border-surface-200 dark:border-surface-700 rounded-xl text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors">
            Cancelar
          </button>
          <button onClick={onConfirm} className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${confirmBtn}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function PromptModal({
  title,
  message,
  inputType = "text",
  inputPlaceholder = "",
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  inputType?: string;
  inputPlaceholder?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter" && value.trim()) onConfirm(value);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel, onConfirm, value]);

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onCancel}>
      <div
        className="bg-white dark:bg-surface-900 rounded-2xl p-6 w-full max-w-sm shadow-xl animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-950 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-brand-600 dark:text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h3 className="font-display font-semibold text-surface-900 dark:text-surface-100">{title}</h3>
            <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">{message}</p>
          </div>
        </div>
        <div className="mt-4">
          <input
            type={inputType}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={inputPlaceholder}
            autoFocus
            className="w-full px-3 py-2.5 border border-surface-200 dark:border-surface-700 rounded-xl text-sm bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 border border-surface-200 dark:border-surface-700 rounded-xl text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors">
            Cancelar
          </button>
          <button onClick={() => value.trim() && onConfirm(value)} disabled={!value.trim()} className="flex-1 px-4 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 active:bg-brand-800 disabled:opacity-50 disabled:pointer-events-none transition-colors">
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
