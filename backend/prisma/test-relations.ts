import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function test() {
  let passed = 0;
  let failed = 0;

  function assert(name: string, ok: boolean, detail?: string) {
    if (ok) {
      console.log(`  ✅ ${name}`);
      passed++;
    } else {
      console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
      failed++;
    }
  }

  // 1. Student by code
  console.log("\n1. Buscar estudiante por código");
  const juan = await prisma.student.findUnique({ where: { codigoEstudiante: "20250001" } });
  assert("Juan found", juan !== null);
  assert("Juan grade correct", juan?.nombre === "Juan" && juan?.apellido === "Pérez");

  // 2. Enrolled students
  console.log("\n2. Estudiantes inscritos");
  const enrolled = await prisma.student.findMany({ where: { codigoDisciplina: { not: null } } });
  assert("Enrolled count = 17", enrolled.length === 17, `got ${enrolled.length}`);
  const notEnrolled = enrolled.filter((s) => s.codigoDisciplina === null);
  assert("No unenrolled in result", notEnrolled.length === 0);

  // 3. Students by discipline
  console.log("\n3. Estudiantes por disciplina");
  const futbolStudents = await prisma.student.findMany({ where: { codigoDisciplina: "FUT001" } });
  assert("Futbol students count = 6", futbolStudents.length === 6, `got ${futbolStudents.length}`);

  // 4. Teachers by discipline
  console.log("\n4. Profesores por disciplina");
  const futbolTeachers = await prisma.extracurricularAssignment.findMany({
    where: { codigoDisciplina: "FUT001" },
    select: { teacher: { select: { nombre: true, apellido: true } } },
    distinct: ["idProfesor"],
  });
  assert("Futbol has 2 teachers", futbolTeachers.length === 2, `got ${futbolTeachers.length}`);

  // 5. Assignments by grade
  console.log("\n5. Asignaciones por grado");
  const grade6 = await prisma.grade.findUnique({ where: { nombre: "6°" } });
  const grade6Assignments = await prisma.extracurricularAssignment.findMany({
    where: { idGrado: grade6!.idGrado },
    include: { discipline: true, teacher: true },
  });
  assert("Grade 6 has 2 assignments (Futbol + Voleibol)", grade6Assignments.length === 2, `got ${grade6Assignments.length}`);

  // 6. Student profile (Juan -> Futbol 7° -> Carlos -> Monday 3PM)
  console.log("\n6. Perfil completo de estudiante");
  const juanProfile = await prisma.student.findUnique({
    where: { codigoEstudiante: "20250001" },
    include: {
      grade: true,
      discipline: true,
    },
  });
  assert("Juan has grade", juanProfile?.grade !== null);
  assert("Juan has discipline", juanProfile?.discipline?.nombre === "Fútbol");

  // Find Juan's assignment: FUT001 + 6°
  const juanAssignment = await prisma.extracurricularAssignment.findFirst({
    where: {
      codigoDisciplina: "FUT001",
      idGrado: juanProfile!.idGrado,
    },
    include: { teacher: true, schedule: true },
  });
  assert("Juan assignment found", juanAssignment !== null);
  assert("Juan teacher is Carlos", juanAssignment?.teacher.nombre === "Carlos");
  assert("Juan schedule is Lunes 15:00", juanAssignment?.schedule?.diaSemana === "Lunes" && juanAssignment?.schedule?.horaInicio === "15:00");

  // 7. Carlos teaches multiple grades
  console.log("\n7. Carlos imparte a múltiples grados");
  const carlos = await prisma.teacher.findFirst({ where: { nombre: "Carlos" } });
  const carlosAssignments = await prisma.extracurricularAssignment.findMany({
    where: { idProfesor: carlos!.idProfesor },
    include: { discipline: true, grade: true, schedule: true },
  });
  assert("Carlos has 3 assignments", carlosAssignments.length === 3, `got ${carlosAssignments.length}`);
  const carlosGrades = carlosAssignments.map((a) => a.grade.nombre);
  assert("Carlos teaches 6°, 7°, 8°", carlosGrades.includes("6°") && carlosGrades.includes("7°") && carlosGrades.includes("8°"));

  // 8. Student without discipline (Pedro Jiménez)
  console.log("\n8. Estudiante sin disciplina");
  const pedro = await prisma.student.findUnique({ where: { codigoEstudiante: "20250018" } });
  assert("Pedro exists", pedro !== null);
  assert("Pedro has no discipline", pedro?.codigoDisciplina === null);

  // 9. Discipline without students check (Atletismo should have some)
  console.log("\n9. Disciplina con y sin estudiantes");
  const atletismoStudents = await prisma.student.findMany({ where: { codigoDisciplina: "ATL001" } });
  assert("Atletismo has 2 students", atletismoStudents.length === 2, `got ${atletismoStudents.length}`);

  // 10. María teaches 2 disciplines (Baloncesto + Atletismo)
  console.log("\n10. María imparte 2 disciplinas");
  const maria = await prisma.teacher.findFirst({ where: { nombre: "María" } });
  const mariaAssignments = await prisma.extracurricularAssignment.findMany({
    where: { idProfesor: maria!.idProfesor },
    include: { discipline: true },
  });
  const mariaDisciplines = [...new Set(mariaAssignments.map((a) => a.discipline.codigoDisciplina))];
  assert("María teaches 2 disciplines", mariaDisciplines.length === 2, `got ${mariaDisciplines.length}`);
  assert("María teaches BAL001 and ATL001", mariaDisciplines.includes("BAL001") && mariaDisciplines.includes("ATL001"));

  // 11. Fútbol has Carlos + Andrés
  console.log("\n11. Fútbol con 2 profesores");
  const futbolAssignments = await prisma.extracurricularAssignment.findMany({
    where: { codigoDisciplina: "FUT001" },
    include: { teacher: true, grade: true },
  });
  const futbolTeachersNames = [...new Set(futbolAssignments.map((a) => `${a.teacher.nombre} ${a.teacher.apellido}`))];
  assert("Fútbol has Carlos + Andrés", futbolTeachersNames.includes("Carlos Gómez") && futbolTeachersNames.includes("Andrés López"));

  // 12. Counts
  console.log("\n12. Conteos totales");
  const totalStudents = await prisma.student.count();
  const totalDisciplines = await prisma.discipline.count();
  const totalTeachers = await prisma.teacher.count();
  const totalGrades = await prisma.grade.count();
  const totalAssignments = await prisma.extracurricularAssignment.count();
  const totalSchedules = await prisma.schedule.count();
  assert("Students = 21", totalStudents === 21, `got ${totalStudents}`);
  assert("Disciplines = 5", totalDisciplines === 5, `got ${totalDisciplines}`);
  assert("Teachers = 5", totalTeachers === 5, `got ${totalTeachers}`);
  assert("Grades = 6", totalGrades === 6, `got ${totalGrades}`);
  assert("Assignments = 13", totalAssignments === 13, `got ${totalAssignments}`);
  assert("Schedules = 7", totalSchedules === 7, `got ${totalSchedules}`);

  console.log(`\n${"=".repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

test()
  .catch((e) => {
    console.error("Test error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
