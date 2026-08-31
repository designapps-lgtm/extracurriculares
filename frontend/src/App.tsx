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

// Admin
import AdminSupervisors from "./pages/admin/AdminSupervisors";

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
      <Route path="/supervisor/dashboard" element={<SupervisorDashboard />} />
      <Route path="/supervisor/schedules" element={<SupervisorSchedules />} />
      <Route path="/supervisor/session/:sessionId" element={<SupervisorSession />} />

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
        <Route path="assignments" element={<AdminAssignments />} />
        <Route path="admins" element={<AdminUsers />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;

