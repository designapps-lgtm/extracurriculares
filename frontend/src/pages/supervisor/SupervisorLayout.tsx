import { Outlet, Link, useLocation, Navigate, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { roleApis, type RoleKind, type RoleUser } from "../../services/roles";
import { logout } from "../../services/auth";
import Logo from "../../components/common/Logo";

export interface PageProps {
  role?: RoleKind;
}

export default function SupervisorLayout({ role = "supervisor" }: PageProps) {
  const api = roleApis[role];
  const basePath = role === "secretary" ? "/secretary" : "/supervisor";

  const NAV_ITEMS = [
    { path: `${basePath}/dashboard`, label: "Asistencia Extracurriculares", icon: "M3 13l4-4m0 0l4 4m-4-4v10m8-6l4 4m0 0l4-4m-4 4V3" },
    {
      path: `${basePath}/classes`,
      label: "Clases Extracurriculares",
      icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
    },
    { path: `${basePath}/schedules`, label: "Horarios Extracurriculares", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
    { path: `${basePath}/transfers`, label: "Traslados Extracurriculares", icon: "M9 13h6m2 0-2-2m2 2-2 2M7 13h.01M4 6h16M4 18h16" },
    { path: `${basePath}/novedades`, label: "Novedades diarias Extracurriculares", icon: "M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" },
  ];

  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<RoleUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    api.me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [api]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-surface-50 dark:bg-surface-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-surface-50 dark:bg-surface-950 lg:pl-64">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 bg-surface-900 dark:bg-surface-950 text-surface-100 z-40">
        <div className="px-6 py-5 border-b border-surface-800">
          <Link to={`${basePath}/dashboard`} className="inline-flex items-center gap-2">
            <Logo chip alt="Extracurriculares" className="h-8 w-auto" />
            <span className="font-display font-bold text-lg text-white">{api.label}</span>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-950 ${
                  isActive
                    ? "bg-brand-600 text-white"
                    : "text-surface-300 hover:bg-surface-800 hover:text-white"
                }`}
              >
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-surface-800">
          <div className="px-3 mb-3">
            <p className="text-sm font-medium text-white">{user.nombre} {user.apellido}</p>
            <p className="text-xs text-surface-400 truncate">{user.correo}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-surface-300 hover:bg-surface-800 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-950"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Mobile launcher */}
      <div className="lg:hidden fixed top-3 left-3 z-50">
        <button
          type="button"
          aria-label={sidebarOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={sidebarOpen}
          onClick={() => setSidebarOpen((v) => !v)}
          className="inline-flex items-center justify-center h-11 w-11 rounded-full bg-surface-900 text-white shadow-lg shadow-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-50"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d={sidebarOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
          </svg>
        </button>
      </div>

      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setSidebarOpen(false)} />
      )}

      {sidebarOpen && (
        <aside className="lg:hidden fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-surface-900 text-surface-100 flex flex-col shadow-2xl shadow-black/30">
          <div className="px-6 py-5 border-b border-surface-800 pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] flex items-center justify-between gap-3">
            <Link to={`${basePath}/dashboard`} className="inline-flex items-center gap-2" onClick={() => setSidebarOpen(false)}>
              <Logo chip alt="Extracurriculares" className="h-8 w-auto" />
              <span className="font-display font-bold text-lg text-white">{api.label}</span>
            </Link>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="text-surface-400 hover:text-white p-1.5 rounded-lg hover:bg-surface-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              aria-label="Cerrar menú"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {NAV_ITEMS.map((item) => {
              const isActive = location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-950 ${
                    isActive ? "bg-brand-600 text-white" : "text-surface-300 hover:bg-surface-800 hover:text-white"
                  }`}
                >
                  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="px-3 py-4 border-t border-surface-800">
            <div className="px-3 mb-3">
              <p className="text-sm font-medium text-white">{user.nombre} {user.apellido}</p>
              <p className="text-xs text-surface-400 truncate">{user.correo}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-surface-300 hover:bg-surface-800 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-950"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Cerrar sesión
            </button>
          </div>
        </aside>
      )}

      <main className="min-w-0 min-h-screen min-h-[100dvh] pt-16 lg:pt-0">
        <Outlet />
      </main>
    </div>
  );
}
