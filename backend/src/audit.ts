const BASE = "http://localhost:3000/api";

let passed = 0;
let failed = 0;
let total = 0;

async function req(path: string): Promise<{ status: number; body: any }> {
  const res = await fetch(`${BASE}${path}`);
  const body = await res.json();
  return { status: res.status, body };
}

function assert(name: string, ok: boolean, detail?: string) {
  total++;
  if (ok) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

// Real data constants
const STUDENT_ENROLLED = "1345282456";    // Juan Botero Romero, K4, 1 schedule (XC_K4_Futbol)
const STUDENT_MULTI = "1345281261";       // Catalina Ocampo Ángel, 12, 4 schedules
const STUDENT_NOT_ENROLLED = "1345281232"; // Jerónimo Bautista Serrano, 12, 0 schedules
const STUDENT_NO_OFFER = "1345282338";    // Emma Botero Pulido, K4, not enrolled but grade has offer
const DISCIPLINE_MULTI_TEACHER = "XC_K4_Futbol";   // 2 teachers
const DISCIPLINE_MULTI_DAY = "XC_EL_Porras";        // 3 days per teacher
const DISCIPLINE_NULL_SCHEDULE = "XC_SEC_Futbol_F"; // SABADO, NULL times
const TEACHER_ID = "Javier Morales"; // Will resolve to UUID

async function run() {
  console.log("=".repeat(60));
  console.log("FASE 7 — AUDITORÍA FUNCIONAL");
  console.log("=".repeat(60));

  // ═══════════════════════════════════════════
  // 1. Health check
  // ═══════════════════════════════════════════
  console.log("\n--- 1. Health ---");
  const health = await req("/health");
  assert("GET /api/health → 200", health.status === 200);
  assert("database connected", health.body.database === "connected");

  // ═══════════════════════════════════════════
  // 2. Search student by codigoEstudiante
  // ═══════════════════════════════════════════
  console.log("\n--- 2. Search student by code ---");
  const byCode = await req(`/students/${STUDENT_ENROLLED}`);
  assert("GET /api/students/:codigo → 200", byCode.status === 200);
  assert("found Juan", byCode.body.data.nombre === "Juan");
  assert("has grade", byCode.body.data.grade?.nombre !== undefined);
  assert("has studentSchedules array", Array.isArray(byCode.body.data.studentSchedules));

  // 404
  const nf = await req("/students/000000");
  assert("nonexistent → 404", nf.status === 404);
  assert("error code STUDENT_NOT_FOUND", nf.body.error?.code === "STUDENT_NOT_FOUND");

  // ═══════════════════════════════════════════
  // 3. Enrolled student
  // ═══════════════════════════════════════════
  console.log("\n--- 3. Enrolled student ---");
  const enrolled = await req(`/students/${STUDENT_ENROLLED}`);
  assert("has studentSchedules", enrolled.body.data.studentSchedules.length > 0);
  assert("schedule has discipline", enrolled.body.data.studentSchedules[0].discipline !== undefined);

  // ═══════════════════════════════════════════
  // 4. Non-enrolled student
  // ═══════════════════════════════════════════
  console.log("\n--- 4. Non-enrolled student ---");
  const notEnrolled = await req(`/students/${STUDENT_NOT_ENROLLED}`);
  assert("studentSchedules is empty", notEnrolled.body.data.studentSchedules.length === 0);

  // ═══════════════════════════════════════════
  // 5. Activities by day (profile)
  // ═══════════════════════════════════════════
  console.log("\n--- 5. Activities by day ---");
  const profile = await req(`/students/${STUDENT_MULTI}/profile`);
  assert("GET profile → 200", profile.status === 200);
  assert("has student info", profile.body.data.student?.codigoEstudiante === STUDENT_MULTI);
  assert("extracurricular is array", Array.isArray(profile.body.data.extracurricular));
  assert("multiple entries", profile.body.data.extracurricular.length >= 2);

  // Check each entry has dia and disciplina
  for (const entry of profile.body.data.extracurricular) {
    assert(`entry has dia (${entry.dia})`, typeof entry.dia === "string");
    assert(`entry has disciplina`, entry.disciplina?.codigo !== undefined);
  }

  // ═══════════════════════════════════════════
  // 6. Full chain: Student → Schedule → Discipline → Assignment → Teacher → AssignmentSchedule → Schedule
  // ═══════════════════════════════════════════
  console.log("\n--- 6. Full chain resolution ---");
  const chainProfile = await req(`/students/${STUDENT_ENROLLED}/profile`);
  const entry = chainProfile.body.data.extracurricular[0];
  assert("chain: has disciplina", entry.disciplina?.codigo !== undefined);
  assert("chain: has oferta", entry.oferta !== null);
  assert("chain: oferta has profesor", typeof entry.oferta?.profesor === "string");
  assert("chain: oferta has horaInicio", entry.oferta?.horaInicio !== undefined);
  assert("chain: oferta has horaFin", entry.oferta?.horaFin !== undefined);

  // ═══════════════════════════════════════════
  // 7. Discipline detail
  // ═══════════════════════════════════════════
  console.log("\n--- 7. Discipline detail ---");
  const disc = await req(`/disciplines/${DISCIPLINE_MULTI_TEACHER}`);
  assert("GET discipline → 200", disc.status === 200);
  assert("has codigoDisciplina", disc.body.data.codigoDisciplina === DISCIPLINE_MULTI_TEACHER);
  assert("has nombre", disc.body.data.nombre !== undefined);
  assert("has assignments", disc.body.data.assignments.length > 0);
  assert("has _count", disc.body.data._count?.studentSchedules >= 0);

  // Check assignment structure
  const a = disc.body.data.assignments[0];
  assert("assignment has teacher", a.teacher?.nombre !== undefined);
  assert("assignment has grade", a.grade?.nombre !== undefined);
  assert("assignment has schedules array", Array.isArray(a.schedules));

  // Discipline 404
  const discNf = await req("/disciplines/INVALID");
  assert("invalid discipline → 404", discNf.status === 404);

  // ═══════════════════════════════════════════
  // 8. Teacher detail
  // ═══════════════════════════════════════════
  console.log("\n--- 8. Teacher detail ---");
  const teachers = await req("/teachers");
  const javier = teachers.body.data.find((t: any) => t.nombre === "Javier" && t.apellido === "Morales");
  assert("Javier Morales found in list", javier !== undefined);

  if (javier) {
    const tDetail = await req(`/teachers/${javier.idProfesor}`);
    assert("GET teacher → 200", tDetail.status === 200);
    assert("has nombre", tDetail.body.data.nombre === "Javier");
    assert("has _count.assignments", tDetail.body.data._count?.assignments > 0);

    const tAssign = await req(`/teachers/${javier.idProfesor}/assignments`);
    assert("GET teacher assignments → 200", tAssign.status === 200);
    assert("has assignments", tAssign.body.data.length > 0);
    const firstA = tAssign.body.data[0];
    assert("assignment has discipline", firstA.discipline?.nombre !== undefined);
    assert("assignment has grade", firstA.grade?.nombre !== undefined);
    assert("assignment has schedules array", Array.isArray(firstA.schedules));
  }

  // ═══════════════════════════════════════════
  // 9. Multiple teachers per discipline
  // ═══════════════════════════════════════════
  console.log("\n--- 9. Multiple teachers ---");
  const discTeachers = await req(`/disciplines/${DISCIPLINE_MULTI_TEACHER}/teachers`);
  assert("K4 Fútbol teachers → 200", discTeachers.status === 200);
  assert("has 2 teachers", discTeachers.body.data.length === 2, `got ${discTeachers.body.data.length}`);
  const names = discTeachers.body.data.map((a: any) => `${a.teacher.nombre} ${a.teacher.apellido}`);
  assert("Javier Morales present", names.includes("Javier Morales"));
  assert("Cristian Echeverry present", names.includes("Cristian Echeverry"));

  // ═══════════════════════════════════════════
  // 10. Multiple days per assignment
  // ═══════════════════════════════════════════
  console.log("\n--- 10. Multiple days ---");
  const porrasAssign = await req(`/assignments?disciplina=${DISCIPLINE_MULTI_DAY}`);
  assert("Porrismo assignments → 200", porrasAssign.status === 200);
  assert("has assignments", porrasAssign.body.data.length > 0);
  const firstPorras = porrasAssign.body.data[0];
  assert("has 3 schedules (days)", firstPorras.schedules.length === 3, `got ${firstPorras.schedules.length}`);

  // ═══════════════════════════════════════════
  // 11. NULL schedules (En programación)
  // ═══════════════════════════════════════════
  console.log("\n--- 11. NULL schedules ---");
  const nullSchedules = await req(`/schedules?dia=SABADO`);
  assert("SABADO schedules → 200", nullSchedules.status === 200);
  const satSchedule = nullSchedules.body.data.find((s: any) => s.horaInicio === null || s.horaInicio === "");
  assert("has SABADO with null times", satSchedule !== undefined);
  if (satSchedule) {
    assert("horaInicio is null/empty", !satSchedule.horaInicio);
    assert("horaFin is null/empty", !satSchedule.horaFin);
  }

  // ═══════════════════════════════════════════
  // 12. Offer ≠ enrollment
  // ═══════════════════════════════════════════
  console.log("\n--- 12. Offer ≠ enrollment ---");
  // Student in grade with offer but NOT enrolled
  const noOfferStudent = await req(`/students/${STUDENT_NO_OFFER}/profile`);
  assert("student in grade with offer but not enrolled", noOfferStudent.status === 200);
  assert("extracurricular is null", noOfferStudent.body.data.extracurricular === null);

  // ═══════════════════════════════════════════
  // 13. Pagination
  // ═══════════════════════════════════════════
  console.log("\n--- 13. Pagination ---");
  const p1 = await req("/students?page=1&limit=10");
  assert("page 1, limit 10 → 200", p1.status === 200);
  assert("returns 10 items", p1.body.data.length === 10);
  assert("meta.page = 1", p1.body.meta.page === 1);
  assert("meta.limit = 10", p1.body.meta.limit === 10);
  assert("meta.total = 788", p1.body.meta.total === 788, `got ${p1.body.meta.total}`);
  assert("meta.totalPages >= 79", p1.body.meta.totalPages >= 79);

  const p2 = await req("/students?page=2&limit=10");
  assert("page 2 → different data", p2.body.data[0]?.codigoEstudiante !== p1.body.data[0]?.codigoEstudiante);

  // ═══════════════════════════════════════════
  // 14. Search
  // ═══════════════════════════════════════════
  console.log("\n--- 14. Search ---");
  const searchName = await req("/students?search=Catalina");
  assert("search by name → results", searchName.body.data.length >= 1);
  assert("first result matches", searchName.body.data.some((s: any) => s.nombre === "Catalina"));

  const searchCode = await req("/students?search=1345282456");
  assert("search by code → results", searchCode.body.data.length >= 1);

  // ═══════════════════════════════════════════
  // 15. Filters
  // ═══════════════════════════════════════════
  console.log("\n--- 15. Filters ---");
  const filterEnrolled = await req("/students?inscrito=true");
  assert("inscrito=true → only enrolled", filterEnrolled.body.data.every((s: any) => s.studentSchedules?.length > 0));

  const filterNotEnrolled = await req("/students?inscrito=false");
  assert("inscrito=false → only not enrolled", filterNotEnrolled.body.data.every((s: any) => s.studentSchedules?.length === 0));

  const filterDisc = await req(`/students?disciplina=${DISCIPLINE_MULTI_TEACHER}`);
  assert("disciplina filter → results", filterDisc.body.data.length > 0);
  assert("all have that discipline", filterDisc.body.data.every((s: any) =>
    s.studentSchedules?.some((ss: any) => ss.codigoDisciplina === DISCIPLINE_MULTI_TEACHER)
  ));

  // ═══════════════════════════════════════════
  // 16. Grade list + detail
  // ═══════════════════════════════════════════
  console.log("\n--- 16. Grades ---");
  const grades = await req("/grades");
  assert("GET /api/grades → 200", grades.status === 200);
  assert("total = 16", grades.body.meta.total === 16);
  assert("has no degree symbol", !grades.body.data.some((g: any) => g.nombre.includes("°")));

  const gradeDetail = await req(`/grades/${grades.body.data[0].idGrado}`);
  assert("GET grade detail → 200", gradeDetail.status === 200);

  const gradeStudents = await req(`/grades/${grades.body.data[0].idGrado}/students`);
  assert("GET grade students → 200", gradeStudents.status === 200);

  const gradeAssignments = await req(`/grades/${grades.body.data[0].idGrado}/assignments`);
  assert("GET grade assignments → 200", gradeAssignments.status === 200);

  // ═══════════════════════════════════════════
  // 17. Discipline codes integrity
  // ═══════════════════════════════════════════
  console.log("\n--- 17. Discipline codes ---");
  const allDisc = await req("/disciplines?page=1&limit=100");
  assert("no hyphens in codes", !allDisc.body.data.some((d: any) => d.codigoDisciplina.includes("-")));
  assert("all codes start with XC_", allDisc.body.data.every((d: any) => d.codigoDisciplina.startsWith("XC_")));
  assert("total = 41", allDisc.body.meta.total === 41);

  // ═══════════════════════════════════════════
  // 18. Assignments
  // ═══════════════════════════════════════════
  console.log("\n--- 18. Assignments ---");
  const assigns = await req("/assignments");
  assert("GET /api/assignments → 200", assigns.status === 200);
  assert("total = 135", assigns.body.meta.total === 135);
  assert("has schedules array", Array.isArray(assigns.body.data[0].schedules));

  const filtered = await req(`/assignments?disciplina=${DISCIPLINE_MULTI_TEACHER}`);
  assert("filter by discipline → results", filtered.body.meta.total > 0);

  // ═══════════════════════════════════════════
  // 19. Schedules
  // ═══════════════════════════════════════════
  console.log("\n--- 19. Schedules ---");
  const scheds = await req("/schedules");
  assert("GET /api/schedules → 200", scheds.status === 200);
  assert("total = 15", scheds.body.meta.total === 15);

  const schedDetail = await req(`/schedules/${scheds.body.data[0].idHorario}`);
  assert("GET schedule detail → 200", schedDetail.status === 200);

  // ═══════════════════════════════════════════
  // 20. Existing tests still pass
  // ═══════════════════════════════════════════
  console.log("\n--- 20. Full test suite ---");
  // This will be run separately via test-api.ts

  // ═══════════════════════════════════════════
  // Summary
  // ═══════════════════════════════════════════
  console.log(`\n${"=".repeat(60)}`);
  console.log(`AUDITORÍA FUNCIONAL: ${passed}/${total} passed, ${failed} failed`);
  console.log("=".repeat(60));

  if (failed > 0) {
    console.log("\n⚠️  FALLOS DETECTADOS — revisar antes de continuar con admin panel");
    process.exit(1);
  } else {
    console.log("\n✅ AUDITORÍA COMPLETADA — sistema funcional, listo para admin panel");
  }
}

run().catch((e) => {
  console.error("Audit error:", e);
  process.exit(1);
});
