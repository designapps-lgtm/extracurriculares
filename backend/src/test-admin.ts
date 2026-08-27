const BASE = "http://localhost:3000/api";

let passed = 0;
let failed = 0;
let total = 0;

async function req(path: string, options?: RequestInit): Promise<{ status: number; body: any; headers: Headers }> {
  const res = await fetch(`${BASE}${path}`, { credentials: "include", ...options });
  const body = await res.json().catch(() => null);
  return { status: res.status, body, headers: res.headers };
}

function assert(name: string, ok: boolean, detail?: string) {
  total++;
  if (ok) { console.log(`  ✅ ${name}`); passed++; }
  else { console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`); failed++; }
}

async function login(): Promise<string> {
  const res = await req("/admin/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "senatics@gi.edu.co", password: "admin123" }),
  });
  // Extract access token from set-cookie header
  const setCookie = res.headers.get("set-cookie");
  const match = setCookie?.match(/admin_access=([^;]+)/);
  return match ? match[1] : "";
}

async function run() {
  console.log("=".repeat(60));
  console.log("FASE 7 — ADMIN TESTS");
  console.log("=".repeat(60));

  // ═══════════════════════════════════════════
  // AUTH TESTS
  // ═══════════════════════════════════════════
  console.log("\n--- AUTH ---");

  // 1. Login authorized
  const loginRes = await req("/admin/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "senatics@gi.edu.co", password: "admin123" }),
  });
  assert("login authorized → 200", loginRes.status === 200);
  assert("login returns admin", loginRes.body.data?.admin?.email === "senatics@gi.edu.co");

  // 2. Login wrong password
  const loginFail = await req("/admin/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@colegio.edu.co", password: "wrong" }),
  });
  assert("login wrong password → 401", loginFail.status === 401);

  // 3. Login nonexistent user
  const loginNoUser = await req("/admin/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "nonexistent@test.com", password: "test" }),
  });
  assert("login nonexistent → 401", loginNoUser.status === 401);

  // 4. Access without token
  const noAuth = await req("/admin/dashboard/stats");
  assert("no auth → 401", noAuth.status === 401);

  // Get valid token
  const token = await login();
  assert("got auth token", token.length > 0);

  const authHeaders = { Cookie: `admin_access=${token}` };

  // Cleanup leftover test teachers from prior runs
  const existingTeachers = await req("/admin/teachers?limit=100", { headers: authHeaders });
  for (const t of existingTeachers.body.data || []) {
    if (t.nombre === "Test" || t.nombre === "TestUpdated") {
      // Hard delete if inactive
      await req(`/admin/teachers/${t.idProfesor}`, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "inactivo" }),
      });
    }
  }

  // 5. Access with valid token
  const authStats = await req("/admin/dashboard/stats", { headers: authHeaders });
  assert("auth dashboard → 200", authStats.status === 200);
  assert("has stats", authStats.body.data?.totalStudents === 788);

  // 6. /me endpoint
  const me = await req("/admin/auth/me", { headers: authHeaders });
  assert("GET /me → 200", me.status === 200);
  assert("me returns email", me.body.data?.email === "senatics@gi.edu.co");

  // 7. /me without token
  const meNoAuth = await req("/admin/auth/me");
  assert("GET /me no auth → 401", meNoAuth.status === 401);

  // 8. Bootstrap blocked when admins exist
  const bootstrapBlocked = await req("/admin/auth/bootstrap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "newadmin@test.com", password: "test1234" }),
  });
  assert("bootstrap blocked when admins exist → 403", bootstrapBlocked.status === 403);

  // 9. Bootstrap without email
  const bootstrapNoEmail = await req("/admin/auth/bootstrap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "test1234" }),
  });
  assert("bootstrap without email → 400", bootstrapNoEmail.status === 400);

  // 10. Bootstrap with short password
  const bootstrapShortPass = await req("/admin/auth/bootstrap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "newadmin@test.com", password: "123" }),
  });
  assert("bootstrap short password → 400", bootstrapShortPass.status === 400);

  // ═══════════════════════════════════════════
  // STUDENTS TESTS
  // ═══════════════════════════════════════════
  console.log("\n--- STUDENTS ---");

  // 8. List students
  const students = await req("/admin/students?page=1&limit=5", { headers: authHeaders });
  assert("list students → 200", students.status === 200);
  assert("total = 788", students.body.meta?.total === 788);
  assert("returns 5", students.body.data?.length === 5);

  // 9. Search students
  const search = await req("/admin/students?search=Catalina", { headers: authHeaders });
  assert("search students → 200", search.status === 200);
  assert("finds Catalina", search.body.data?.some((s: any) => s.nombre === "Catalina"));

  // 10. Get student by code
  const student = await req("/admin/students/1345281261", { headers: authHeaders });
  assert("get student → 200", student.status === 200);
  assert("Catalina found", student.body.data?.nombre === "Catalina");

  // 11. Student not found
  const studentNf = await req("/admin/students/000000", { headers: authHeaders });
  assert("student not found → 404", studentNf.status === 404);

  // 12. Update student
  const updateStudent = await req("/admin/students/1345281261", {
    method: "PATCH",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ grupo: "12X" }),
  });
  assert("update student → 200", updateStudent.status === 200);
  assert("grupo updated", updateStudent.body.data?.grupo === "12X");

  // Restore
  await req("/admin/students/1345281261", {
    method: "PATCH",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ grupo: "12A" }),
  });

  // 13. Students without auth
  const studentsNoAuth = await req("/admin/students");
  assert("students no auth → 401", studentsNoAuth.status === 401);

  // ═══════════════════════════════════════════
  // TEACHERS TESTS
  // ═══════════════════════════════════════════
  console.log("\n--- TEACHERS ---");

  // 14. List teachers
  const teachers = await req("/admin/teachers", { headers: authHeaders });
  assert("list teachers → 200", teachers.status === 200);
  const initialTeacherCount = teachers.body.meta?.total;
  assert("has teachers", initialTeacherCount >= 15);

  // 15. Create teacher
  const newTeacher = await req("/admin/teachers", {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ nombre: "Test", apellido: "Admin", correo: "test@colegio.edu.co" }),
  });
  assert("create teacher → 201", newTeacher.status === 201);
  assert("has id", newTeacher.body.data?.idProfesor !== undefined);
  const teacherId = newTeacher.body.data?.idProfesor;

  // 16. Get teacher
  const teacherDetail = await req(`/admin/teachers/${teacherId}`, { headers: authHeaders });
  assert("get teacher → 200", teacherDetail.status === 200);
  assert("Test found", teacherDetail.body.data?.nombre === "Test");

  // 17. Update teacher
  const updateTeacher = await req(`/admin/teachers/${teacherId}`, {
    method: "PATCH",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ nombre: "TestUpdated" }),
  });
  assert("update teacher → 200", updateTeacher.status === 200);
  assert("name updated", updateTeacher.body.data?.nombre === "TestUpdated");

  // 18. Deactivate teacher (no assignments)
  const deactivate = await req(`/admin/teachers/${teacherId}`, {
    method: "PATCH",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ estado: "inactivo" }),
  });
  assert("deactivate teacher → 200", deactivate.status === 200);
  assert("teacher inactive", deactivate.body.data?.estado === "inactivo");

  // 19. Deactivate teacher with assignments
  const javier = teachers.body.data.find((t: any) => t.nombre === "Javier");
  const deactivateJavier = await req(`/admin/teachers/${javier.idProfesor}`, {
    method: "PATCH",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ estado: "inactivo" }),
  });
  assert("deactivate teacher with assignments → 400", deactivateJavier.status === 400);

  // 20. Teachers without auth
  const teachersNoAuth = await req("/admin/teachers");
  assert("teachers no auth → 401", teachersNoAuth.status === 401);

  // ═══════════════════════════════════════════
  // ASSIGNMENTS TESTS
  // ═══════════════════════════════════════════
  console.log("\n--- ASSIGNMENTS ---");

  // 21. List assignments
  const assignments = await req("/admin/assignments", { headers: authHeaders });
  assert("list assignments → 200", assignments.status === 200);
  assert("total = 135", assignments.body.meta?.total === 135);

  // 22. Get assignment by ID
  const firstAssignment = assignments.body.data[0];
  const assignmentDetail = await req(`/admin/assignments/${firstAssignment.idAsignacion}`, { headers: authHeaders });
  assert("get assignment → 200", assignmentDetail.status === 200);
  assert("has schedules", assignmentDetail.body.data?.schedules?.length > 0);

  // 23. Create assignment
  // Find a grade that exists
  const gradeList = await req("/admin/grades", { headers: authHeaders });
  const testGrade = gradeList.body.data.find((g: any) => g.nombre === "K4");

  const createAssign = await req("/admin/assignments", {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      codigoDisciplina: "XC_K4_Futbol",
      idGrado: testGrade.idGrado,
      idProfesor: teacherId, // test teacher (inactive, but let's use active one)
    }),
  });
  // Might fail because teacher is inactive
  // Let's use an active teacher
  const createAssign2 = await req("/admin/assignments", {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      codigoDisciplina: "XC_K4_Futbol",
      idGrado: testGrade.idGrado,
      idProfesor: javier.idProfesor,
    }),
  });
  // Should fail because duplicate (Javier already teaches K4_Futbol for K4)
  assert("duplicate assignment → 409", createAssign2.status === 409);

  // 24. Create with nonexistent discipline
  const badDisc = await req("/admin/assignments", {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ codigoDisciplina: "INVALID", idGrado: testGrade.idGrado, idProfesor: javier.idProfesor }),
  });
  assert("invalid discipline → 400", badDisc.status === 400);

  // 25. Create with nonexistent teacher
  const badTeacher = await req("/admin/assignments", {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ codigoDisciplina: "XC_K4_Futbol", idGrado: testGrade.idGrado, idProfesor: "nonexistent" }),
  });
  assert("invalid teacher → 400", badTeacher.status === 400);

  // 26. Create with nonexistent grade
  const badGrade = await req("/admin/assignments", {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ codigoDisciplina: "XC_K4_Futbol", idGrado: 99999, idProfesor: javier.idProfesor }),
  });
  assert("invalid grade → 400", badGrade.status === 400);

  // 27. Delete (deactivate) assignment
  const originalEstado = firstAssignment.estado;
  const deleteRes = await req(`/admin/assignments/${firstAssignment.idAsignacion}`, {
    method: "DELETE",
    headers: authHeaders,
  });
  assert("delete assignment → 200", deleteRes.status === 200);

  // Undo the side effect: restore the assignment's original estado so the test
  // doesn't leave a real offer deactivated after running.
  const restoreRes = await req(`/admin/assignments/${firstAssignment.idAsignacion}`, {
    method: "PATCH",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ estado: originalEstado }),
  });
  assert("restore assignment estado → 200", restoreRes.status === 200);

  // 28. Assignments without auth
  const assignsNoAuth = await req("/admin/assignments");
  assert("assignments no auth → 401", assignsNoAuth.status === 401);

  // ═══════════════════════════════════════════
  // DISCIPLINES TESTS
  // ═══════════════════════════════════════════
  console.log("\n--- DISCIPLINES ---");

  const disc = await req("/admin/disciplines", { headers: authHeaders });
  assert("list disciplines → 200", disc.status === 200);
  assert("total = 41", disc.body.meta?.total === 41);
  assert("no hyphens", !disc.body.data.some((d: any) => d.codigoDisciplina.includes("-")));

  // ═══════════════════════════════════════════
  // GRADES TESTS
  // ═══════════════════════════════════════════
  console.log("\n--- GRADES ---");

  const grades = await req("/admin/grades", { headers: authHeaders });
  assert("list grades → 200", grades.status === 200);
  assert("total = 16", grades.body.data?.length === 16);
  assert("no degree symbol", !grades.body.data.some((g: any) => g.nombre.includes("°")));

  // ═══════════════════════════════════════════
  // SCHEDULES TESTS
  // ═══════════════════════════════════════════
  console.log("\n--- SCHEDULES ---");

  const schedules = await req("/admin/schedules", { headers: authHeaders });
  assert("list schedules → 200", schedules.status === 200);
  assert("total = 15", schedules.body.meta?.total === 15);

  // ═══════════════════════════════════════════
  // ADMIN USERS TESTS
  // ═══════════════════════════════════════════
  console.log("\n--- ADMIN USERS ---");

  // 31. List admins
  const admins = await req("/admin/admins", { headers: authHeaders });
  assert("list admins → 200", admins.status === 200);
  assert("has senatics", admins.body.data?.some((a: any) => a.email === "senatics@gi.edu.co"));

  // 32. Create admin
  const newAdmin = await req("/admin/admins", {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test-admin@gi.edu.co", nombre: "Test", apellido: "Admin" }),
  });
  assert("create admin → 201", newAdmin.status === 201);
  assert("has id", newAdmin.body.data?.id !== undefined);
  const newAdminId = newAdmin.body.data?.id;

  // 33. Duplicate email
  const dupAdmin = await req("/admin/admins", {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test-admin@gi.edu.co" }),
  });
  assert("duplicate email → 409", dupAdmin.status === 409);

  // 34. Update admin
  const updateAdminRes = await req(`/admin/admins/${newAdminId}`, {
    method: "PATCH",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ nombre: "TestUpdated" }),
  });
  assert("update admin → 200", updateAdminRes.status === 200);
  assert("name updated", updateAdminRes.body.data?.nombre === "TestUpdated");

  // 35. Reset password
  const resetPass = await req(`/admin/admins/${newAdminId}/reset-password`, {
    method: "PATCH",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ password: "newpass123" }),
  });
  assert("reset password → 200", resetPass.status === 200);

  // 36. Can't disable yourself
  const meAdmin = admins.body.data.find((a: any) => a.email === "senatics@gi.edu.co");
  const disableSelf = await req(`/admin/admins/${meAdmin.id}`, {
    method: "PATCH",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ estado: "inactivo" }),
  });
  assert("disable self → 400", disableSelf.status === 400);

  // 37. Can't delete yourself
  const deleteSelf = await req(`/admin/admins/${meAdmin.id}`, {
    method: "DELETE",
    headers: authHeaders,
  });
  assert("delete self → 400", deleteSelf.status === 400);

  // 38. Delete test admin
  const deleteAdminRes = await req(`/admin/admins/${newAdminId}`, {
    method: "DELETE",
    headers: authHeaders,
  });
  assert("delete admin → 200", deleteAdminRes.status === 200);

  // 39. Admin not found
  const adminNf = await req(`/admin/admins/nonexistent`, {
    method: "PATCH",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ nombre: "x" }),
  });
  assert("admin not found → 404", adminNf.status === 404);

  // 40. Admin users no auth
  const adminsNoAuth = await req("/admin/admins");
  assert("admin users no auth → 401", adminsNoAuth.status === 401);

  // ═══════════════════════════════════════════
  // SECURITY TESTS
  // ═══════════════════════════════════════════
  console.log("\n--- SECURITY ---");

  // 29. 401 on all admin routes without auth
  const routes401 = [
    "/admin/students",
    "/admin/teachers",
    "/admin/assignments",
    "/admin/disciplines",
    "/admin/grades",
    "/admin/schedules",
    "/admin/dashboard/stats",
  ];
  for (const route of routes401) {
    const r = await req(route);
    assert(`${route} no auth → 401`, r.status === 401);
  }

  // 30. Invalid token
  const invalidToken = await req("/admin/dashboard/stats", {
    headers: { Cookie: "admin_access=invalid-token-here" },
  });
  assert("invalid token → 401", invalidToken.status === 401);

  // ═══════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════
  console.log("\n--- CLEANUP ---");

  // Delete test teacher (hard delete to keep counts clean)
  if (teacherId) {
    const deleteTeacher = await req(`/admin/teachers/${teacherId}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    assert("cleanup: delete test teacher", deleteTeacher.status === 200);
  }

  // ═══════════════════════════════════════════
  // EXISTING TESTS STILL PASS
  // ═══════════════════════════════════════════
  console.log("\n--- EXISTING TESTS ---");
  console.log("(run test-api.ts separately to verify)");

  // ═══════════════════════════════════════════
  // Summary
  // ═══════════════════════════════════════════
  console.log(`\n${"=".repeat(60)}`);
  console.log(`ADMIN TESTS: ${passed}/${total} passed, ${failed} failed`);
  console.log("=".repeat(60));

  if (failed > 0) process.exit(1);
}

run().catch((e) => {
  console.error("Admin test error:", e);
  process.exit(1);
});
