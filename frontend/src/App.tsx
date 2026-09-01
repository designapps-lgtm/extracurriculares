import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Students from "./pages/Students";
import StudentProfile from "./pages/StudentProfile";
import Disciplines from "./pages/Disciplines";
import DisciplineDetail from "./pages/DisciplineDetail";
import Teachers from "./pages/Teachers";
import TeacherDetail from "./pages/TeacherDetail";

// Admin
import AdminLayout from "./pages/admin/AdminLayout";
import AdminStudents from "./pages/admin/AdminStudents";
import AdminTeachers from "./pages/admin/AdminTeachers";
import AdminAssignments from "./pages/admin/AdminAssignments";
import AdminUsers from "./pages/admin/AdminUsers";

// Teacher
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import TeacherAttendance from "./pages/teacher/TeacherAttendance";
import TeacherNovedad from "./pages/teacher/TeacherNovedad";

// Supervisor
import SupervisorDashboard from "./pages/supervisor/SupervisorDashboard";
import SupervisorSession from "./pages/supervisor/SupervisorSession";
import SupervisorSchedules from "./pages/supervisor/SupervisorSchedules";
import SupervisorStays from "./pages/supervisor/SupervisorStays";
import SupervisorClasses from "./pages/supervisor/SupervisorClasses";
import SupervisorAttendance from "./pages/supervisor/SupervisorAttendance";
import SupervisorNovedad from "./pages/supervisor/SupervisorNovedad";
import SupervisorTransfers from "./pages/supervisor/SupervisorTransfers";
import SupervisorLayout from "./pages/supervisor/SupervisorLayout";

// Secretary
import SecretaryLayout from "./pages/secretary/SecretaryLayout";
import SecretaryDashboard from "./pages/secretary/SecretaryDashboard";
import SecretarySchedules from "./pages/secretary/SecretarySchedules";
import SecretaryStays from "./pages/secretary/SecretaryStays";
import SecretarySession from "./pages/secretary/SecretarySession";
import SecretaryNovedad from "./pages/secretary/SecretaryNovedad";
import SecretaryTransfers from "./pages/secretary/SecretaryTransfers";

// Admin
import AdminSupervisors from "./pages/admin/AdminSupervisors";
import AdminSecretaries from "./pages/admin/AdminSecretaries";

function App() {
  return (
    <Routes>
      {/* Root = login unificado con Google */}
      <Route path="/" element={<Login />} />

      {/* Rutas de login viejas → redirigen al login unificado */}
      <Route path="/teacher/login" element={<Navigate to="/" replace />} />
      <Route path="/supervisor/login" element={<Navigate to="/" replace />} />
      <Route path="/admin/login" element={<Navigate to="/" replace />} />

      {/* Teacher routes */}
      <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
      <Route path="/teacher/session/:sessionId" element={<TeacherAttendance />} />
      <Route path="/teacher/novedad/:codigoEstudiante" element={<TeacherNovedad />} />

      {/* Public routes */}
      <Route path="/students" element={<Students />} />
      <Route path="/students/:codigo" element={<StudentProfile />} />
      <Route path="/disciplines" element={<Disciplines />} />
      <Route path="/disciplines/:codigo" element={<DisciplineDetail />} />
      <Route path="/teachers" element={<Teachers />} />
      <Route path="/teachers/:id" element={<TeacherDetail />} />

      {/* Supervisor routes */}
      <Route path="/supervisor" element={<SupervisorLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<SupervisorDashboard />} />
        <Route path="classes" element={<SupervisorClasses />} />
        <Route path="schedules" element={<SupervisorSchedules />} />
        <Route path="stays" element={<SupervisorStays />} />
        <Route path="session/:sessionId" element={<SupervisorSession />} />
        <Route path="session-attendance/:sessionId" element={<SupervisorAttendance />} />
        <Route path="novedad/:codigoEstudiante" element={<SupervisorNovedad />} />
        <Route path="transfers" element={<SupervisorTransfers />} />
      </Route>

      {/* Secretary routes — mismo flujo que supervisor sin llamar lista ni gestión */}
      <Route path="/secretary" element={<SecretaryLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<SecretaryDashboard />} />
        <Route path="schedules" element={<SecretarySchedules />} />
        <Route path="stays" element={<SecretaryStays />} />
        <Route path="session/:sessionId" element={<SecretarySession />} />
        <Route path="novedad/:codigoEstudiante" element={<SecretaryNovedad />} />
        <Route path="transfers" element={<SecretaryTransfers />} />
      </Route>

      {/* Admin routes — AdminLayout handles auth + sidebar */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="students" element={<AdminStudents />} />
        <Route path="students/:codigo" element={<StudentProfile />} />
        <Route path="disciplines" element={<Disciplines />} />
        <Route path="disciplines/:codigo" element={<DisciplineDetail />} />
        <Route path="teachers-view" element={<Teachers />} />
        <Route path="teachers-view/:id" element={<TeacherDetail />} />
        <Route path="teachers" element={<AdminTeachers />} />
        <Route path="teachers/:id" element={<TeacherDetail />} />
        <Route path="supervisors" element={<AdminSupervisors />} />
        <Route path="secretaries" element={<AdminSecretaries />} />
        <Route path="assignments" element={<AdminAssignments />} />
        <Route path="admins" element={<AdminUsers />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
