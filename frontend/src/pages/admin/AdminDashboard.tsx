import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getDashboardStats } from "../../services/admin";
import type { DashboardStats } from "../../services/admin";

const STAT_CARDS = [
  { key: "totalStudents", label: "Estudiantes", color: "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
  { key: "enrolledStudents", label: "Inscritos", color: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
  { key: "totalTeachers", label: "Profesores", color: "bg-terracotta-50 text-terracotta-700 dark:bg-terracotta-950 dark:text-terracotta-300", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
  { key: "totalDisciplines", label: "Disciplinas", color: "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300", icon: "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" },
  { key: "totalGrades", label: "Grados", color: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
  { key: "totalAssignments", label: "Asignaciones", color: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
];

const QUICK_ACTIONS = [
  { path: "/admin/students", label: "Gestionar estudiantes", color: "bg-brand-600 hover:bg-brand-700" },
  { path: "/admin/teachers", label: "Gestionar profesores", color: "bg-terracotta-600 hover:bg-terracotta-700" },
  { path: "/admin/assignments", label: "Gestionar oferta", color: "bg-purple-600 hover:bg-purple-700" },
];

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold text-surface-900 dark:text-surface-100">
        Dashboard
      </h1>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {STAT_CARDS.map(({ key, label, color, icon }) => (
          <div key={key} className="card p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center shrink-0`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-display font-bold text-surface-900 dark:text-surface-100">
                  {stats[key as keyof DashboardStats] as number}
                </p>
                <p className="text-xs text-surface-500 dark:text-surface-400">{label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Activities by day */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-4 font-display">
          Actividades por día
        </h2>
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(stats.assignmentsByDay).map(([day, count]) => (
            <div key={day} className="text-center p-3 bg-surface-50 dark:bg-surface-800 rounded-xl">
              <p className="text-lg font-display font-bold text-surface-900 dark:text-surface-100">{count}</p>
              <p className="text-xs text-surface-500 dark:text-surface-400 capitalize">{day.toLowerCase()}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-4 font-display">
          Accesos rápidos
        </h2>
        <div className="flex flex-wrap gap-3">
          {QUICK_ACTIONS.map(({ path, label, color }) => (
            <Link
              key={path}
              to={path}
              className={`px-4 py-2.5 ${color} text-white text-sm font-medium rounded-xl transition-colors`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
