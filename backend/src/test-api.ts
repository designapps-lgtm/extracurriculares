const BASE = "http://localhost:3000/api";

let passed = 0;
let failed = 0;

async function req(path: string): Promise<{ status: number; body: any }> {
  const res = await fetch(`${BASE}${path}`);
  const body = await res.json();
  return { status: res.status, body };
}

function assert(name: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

// Real data from import
const STUDENT_WITH_SCHEDULES = "1345281261"; // Catalina Ocampo Ángel, 4 schedules
const STUDENT_NO_SCHEDULES = "1345281232";   // Jerónimo Bautista Serrano, 0 schedules
const REAL_DISCIPLINE = "XC_K4_Futbol";
const REAL_DISCIPLINE_2 = "XC_EL_Porras";

async function run() {
  // Health
  console.log("\n1. Health");
  const health = await req("/health");
  assert("GET /api/health → 200", health.status === 200);
  assert("database connected", health.body.database === "connected");

  // Students list
  console.log("\n2. Students list");
  const students = await req("/students?page=1&limit=5");
  assert("GET /api/students → 200", students.status === 200);
  assert("has meta", students.body.meta !== undefined);
  assert("total = 788", students.body.meta.total === 788, `got ${students.body.meta.total}`);
  assert("limit = 5", students.body.meta.limit === 5);
  assert("returns 5 items", students.body.data.length === 5);

  // Student by code
  console.log("\n3. Student by code");
  const student = await req(`/students/${STUDENT_WITH_SCHEDULES}`);
  assert(`GET /api/students/${STUDENT_WITH_SCHEDULES} → 200`, student.status === 200);
  assert("Catalina found", student.body.data.nombre === "Catalina");
  assert("has grade", student.body.data.grade !== null);
  assert("has studentSchedules", Array.isArray(student.body.data.studentSchedules));
  assert("has schedules", student.body.data.studentSchedules.length >= 2);

  // Student not found
  console.log("\n4. Student not found");
  const notFound = await req("/students/999999");
  assert("GET /api/students/999999 → 404", notFound.status === 404);
  assert("error code", notFound.body.error?.code === "STUDENT_NOT_FOUND");

  // Student profile (enrolled)
  console.log("\n5. Student profile (enrolled)");
  const profile = await req(`/students/${STUDENT_WITH_SCHEDULES}/profile`);
  assert("GET profile → 200", profile.status === 200);
  assert("has student", profile.body.data.student !== null);
  assert("extracurricular is array", Array.isArray(profile.body.data.extracurricular));
  assert("has entries", profile.body.data.extracurricular.length >= 2);
  assert("first entry has dia", profile.body.data.extracurricular[0].dia !== undefined);
  assert("first entry has disciplina", profile.body.data.extracurricular[0].disciplina !== undefined);

  // Student profile (not enrolled)
  console.log("\n6. Student profile (not enrolled)");
  const noEnroll = await req(`/students/${STUDENT_NO_SCHEDULES}/profile`);
  assert("GET profile → 200", noEnroll.status === 200);
  assert("found student", noEnroll.body.data.student.codigoEstudiante === STUDENT_NO_SCHEDULES);
  assert("extracurricular is null", noEnroll.body.data.extracurricular === null);

  // Enrolled filter
  console.log("\n7. Enrolled filter");
  const enrolled = await req("/students?inscrito=true");
  assert("inscrito=true has results", enrolled.body.meta.total > 0);
  const hasUnenrolled = enrolled.body.data.some((s: any) => s.studentSchedules?.length === 0);
  assert("no unenrolled in result", !hasUnenrolled);

  // Search
  console.log("\n8. Search");
  const search = await req("/students?search=Catalina");
  assert("search=Catalina finds results", search.body.data.length >= 1);

  // Disciplines
  console.log("\n9. Disciplines");
  const disciplines = await req("/disciplines");
  assert("GET /api/disciplines → 200", disciplines.status === 200);
  assert("total = 41", disciplines.body.meta.total === 41, `got ${disciplines.body.meta.total}`);

  // Discipline detail
  console.log("\n10. Discipline detail");
  const futbol = await req(`/disciplines/${REAL_DISCIPLINE}`);
  assert("GET discipline → 200", futbol.status === 200);
  assert("has assignments", futbol.body.data.assignments.length > 0);
  assert("has student count", futbol.body.data._count.studentSchedules >= 0);

  // Discipline not found
  console.log("\n11. Discipline not found");
  const discNotFound = await req("/disciplines/XXX999");
  assert("GET /api/disciplines/XXX999 → 404", discNotFound.status === 404);

  // Discipline students
  console.log("\n12. Discipline students");
  const discStudents = await req(`/disciplines/${REAL_DISCIPLINE}/students`);
  assert("discipline students → 200", discStudents.status === 200);

  // Discipline teachers
  console.log("\n13. Discipline teachers");
  const discTeachers = await req(`/disciplines/${REAL_DISCIPLINE}/teachers`);
  assert("discipline teachers → 200", discTeachers.status === 200);
  assert("has teachers", discTeachers.body.data.length > 0);

  // Teachers
  console.log("\n14. Teachers");
  const teachers = await req("/teachers");
  assert("GET /api/teachers → 200", teachers.status === 200);
  assert("total >= 15", teachers.body.meta.total >= 15, `got ${teachers.body.meta.total}`);

  // Teacher detail
  console.log("\n15. Teacher detail");
  const javier = teachers.body.data.find((t: any) => t.nombre === "Javier" && t.apellido === "Morales");
  assert("Javier Morales exists", javier !== undefined);
  if (javier) {
    const detail = await req(`/teachers/${javier.idProfesor}`);
    assert("GET /api/teachers/:id → 200", detail.status === 200);
    assert("Javier found", detail.body.data.nombre === "Javier");
  }

  // Teacher assignments
  console.log("\n16. Teacher assignments");
  if (javier) {
    const assign = await req(`/teachers/${javier.idProfesor}/assignments`);
    assert("GET /api/teachers/:id/assignments → 200", assign.status === 200);
    assert("has assignments", assign.body.data.length > 0);
    assert("assignment has schedules", Array.isArray(assign.body.data[0].schedules));
  }

  // Grades
  console.log("\n17. Grades");
  const grades = await req("/grades");
  assert("GET /api/grades → 200", grades.status === 200);
  assert("total = 16", grades.body.meta.total === 16, `got ${grades.body.meta.total}`);

  // Grade detail
  console.log("\n18. Grade detail");
  const gradeK4 = grades.body.data.find((g: any) => g.nombre === "K4");
  assert("Grade K4 exists", gradeK4 !== undefined);
  if (gradeK4) {
    const detail = await req(`/grades/${gradeK4.idGrado}`);
    assert("GET /api/grades/:id → 200", detail.status === 200);
    assert("K4 found", detail.body.data.nombre === "K4");
  }

  // Grade students
  console.log("\n19. Grade students");
  if (gradeK4) {
    const result = await req(`/grades/${gradeK4.idGrado}/students`);
    assert("GET /api/grades/:id/students → 200", result.status === 200);
    assert("has students", result.body.meta.total > 0);
  }

  // Grade assignments
  console.log("\n20. Grade assignments");
  if (gradeK4) {
    const result = await req(`/grades/${gradeK4.idGrado}/assignments`);
    assert("GET /api/grades/:id/assignments → 200", result.status === 200);
    assert("has assignments", result.body.data.length > 0);
  }

  // Assignments
  console.log("\n21. Assignments");
  const assignments = await req("/assignments");
  assert("GET /api/assignments → 200", assignments.status === 200);
  assert("total = 135", assignments.body.meta.total === 135, `got ${assignments.body.meta.total}`);
  assert("assignment has schedules array", Array.isArray(assignments.body.data[0].schedules));

  // Assignments filter by discipline
  console.log("\n22. Assignments filter by discipline");
  const filtered = await req(`/assignments?disciplina=${REAL_DISCIPLINE}`);
  assert("filtered has results", filtered.body.meta.total > 0);

  // Schedules
  console.log("\n23. Schedules");
  const schedules = await req("/schedules");
  assert("GET /api/schedules → 200", schedules.status === 200);
  assert("total = 15", schedules.body.meta.total === 15, `got ${schedules.body.meta.total}`);

  // 404 route
  console.log("\n24. 404 route");
  const notFoundRoute = await req("/nonexistent");
  assert("GET /api/nonexistent → 404", notFoundRoute.status === 404);

  // OFFER TESTS
  console.log("\n25. OFFER: K4 Fútbol has 2 teachers");
  const k4f = await req(`/disciplines/${REAL_DISCIPLINE}/teachers`);
  assert("XC_K4_Futbol teachers → 200", k4f.status === 200);
  assert("K4 Fútbol has 2 teachers", k4f.body.data.length === 2, `got ${k4f.body.data.length}`);
  const k4fNames = k4f.body.data.map((a: any) => `${a.teacher.nombre} ${a.teacher.apellido}`);
  assert("Javier Morales present", k4fNames.includes("Javier Morales"));
  assert("Cristian Echeverry present", k4fNames.includes("Cristian Echeverry"));

  console.log("\n26. OFFER: K5 Fútbol has 2 teachers");
  const k5f = await req(`/disciplines/XC_K5_Futbol/teachers`);
  assert("K5 Fútbol has 2 teachers", k5f.body.data.length === 2);

  console.log("\n27. OFFER: Porrismo has 2 teachers");
  const porras = await req(`/disciplines/${REAL_DISCIPLINE_2}/teachers`);
  assert("Porrismo has 2 teachers", porras.body.data.length === 2);

  console.log("\n28. OFFER: Porrismo has 3 schedules per teacher");
  const porrasAssign = await req(`/assignments?disciplina=${REAL_DISCIPLINE_2}`);
  if (porrasAssign.body.data.length > 0) {
    assert("Porrismo assignment has 3 schedules", porrasAssign.body.data[0].schedules.length === 3, `got ${porrasAssign.body.data[0].schedules.length}`);
  }

  console.log("\n29. OFFER: MS Fútbol uses XC_MS_Futbol_M");
  const ms = await req("/disciplines/XC_MS_Futbol_M");
  assert("XC_MS_Futbol_M exists", ms.status === 200);
  const msTeachers = await req("/disciplines/XC_MS_Futbol_M/teachers");
  assert("MS Fútbol has teachers", msTeachers.body.data.length > 0);

  console.log("\n30. OFFER: HS Fútbol uses XC_HS_Futbol_M");
  const hs = await req("/disciplines/XC_HS_Futbol_M");
  assert("XC_HS_Futbol_M exists", hs.status === 200);

  console.log("\n31. OFFER: No discipline codes with hyphens");
  const allDisc = await req("/disciplines?page=1&limit=100");
  const hasHyphens = allDisc.body.data.some((d: any) => d.codigoDisciplina.includes("-"));
  assert("No hyphens in discipline codes", !hasHyphens);

  console.log("\n32. OFFER: No degree symbol in grades");
  const allGrades = await req("/grades?page=1&limit=50");
  const hasDegree = allGrades.body.data.some((g: any) => g.nombre.includes("°"));
  assert("No degree symbol in grade names", !hasDegree);

  console.log("\n33. OFFER: Idempotency check");
  const assignCount = await req("/assignments");
  assert("Assignments count stable", assignCount.body.meta.total === 135);

  console.log("\n34. OFFER: Student profile with offer info");
  const profileOffer = await req(`/students/${STUDENT_WITH_SCHEDULES}/profile`);
  if (profileOffer.body.data.extracurricular) {
    const hasOffer = profileOffer.body.data.extracurricular.some((e: any) => e.oferta !== null);
    assert("at least one entry has oferta", hasOffer);
  }

  // No test data
  console.log("\n35. CLEANUP: No test data");
  const testStudents = await req("/students?search=2025");
  assert("no test students (2025*)", !testStudents.body.data.some((s: any) => s.codigoEstudiante.startsWith("2025")));
  const noFutbol = await req("/disciplines/FUT001");
  assert("FUT001 deleted", noFutbol.status === 404);

  // Summary
  console.log(`\n${"=".repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((e) => {
  console.error("Test error:", e);
  process.exit(1);
});
