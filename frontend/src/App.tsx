import { Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Students from "./pages/Students";
import StudentProfile from "./pages/StudentProfile";
import Disciplines from "./pages/Disciplines";
import DisciplineDetail from "./pages/DisciplineDetail";
import Teachers from "./pages/Teachers";
import TeacherDetail from "./pages/TeacherDetail";

// Admin
import AdminLayout from "./pages/admin/AdminLayout";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminTeachers from "./pages/admin/AdminTeachers";
import AdminAssignments from "./pages/admin/AdminAssignments";
import AdminUsers from "./pages/admin/AdminUsers";

// Teacher
import TeacherLogin from "./pages/teacher/TeacherLogin";
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import TeacherAttendance from "./pages/teacher/TeacherAttendance";

function App() {
  return (
    <Routes>
      {/* Root = Teacher login */}
      <Route path="/" element={<TeacherLogin />} />

      {/* Teacher routes */}
      <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
      <Route path="/teacher/session/:sessionId" element={<TeacherAttendance />} />

      {/* Admin login (no layout) */}
      <Route path="/admin/login" element={<AdminLogin />} />

      {/* Admin routes — AdminLayout handles auth + sidebar */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="students" element={<Students />} />
        <Route path="students/:codigo" element={<StudentProfile />} />
        <Route path="disciplines" element={<Disciplines />} />
        <Route path="disciplines/:codigo" element={<DisciplineDetail />} />
        <Route path="teachers-view" element={<Teachers />} />
        <Route path="teachers-view/:id" element={<TeacherDetail />} />
        <Route path="teachers" element={<AdminTeachers />} />
        <Route path="teachers/:id" element={<TeacherDetail />} />
        <Route path="assignments" element={<AdminAssignments />} />
        <Route path="admins" element={<AdminUsers />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;


