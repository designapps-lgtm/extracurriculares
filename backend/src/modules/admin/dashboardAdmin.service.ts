import { sql } from "../../config/db";

export async function getStats() {
  const [totalStudents, enrolledCount, activeTeachers, activeDisciplines, totalGrades, activeAssignments, totalSchedules, assignmentsByDay] = await Promise.all([
    sql`SELECT COUNT(*)::int AS total FROM "Student"`,
    sql`SELECT COUNT(DISTINCT "codigoEstudiante")::int AS total FROM "StudentSchedule"`,
    sql`SELECT COUNT(*)::int AS total FROM "Teacher" WHERE "estado" = 'activo'`,
    sql`SELECT COUNT(*)::int AS total FROM "Discipline" WHERE "estado" = 'activa'`,
    sql`SELECT COUNT(*)::int AS total FROM "Grade"`,
    sql`SELECT COUNT(*)::int AS total FROM "ExtracurricularAssignment" WHERE "estado" = 'activo'`,
    sql`SELECT COUNT(*)::int AS total FROM "Schedule"`,
    sql`SELECT "diaSemana", COUNT(*)::int AS count FROM "Schedule" GROUP BY "diaSemana"`,
  ]);

  const totalStudentsVal = (totalStudents as any[])[0]?.total ?? 0;
  const enrolledStudents = (enrolledCount as any[])[0]?.total ?? 0;

  const byDay: Record<string, number> = {};
  for (const row of assignmentsByDay as any[]) {
    byDay[row.diaSemana] = row.count;
  }

  return {
    totalStudents: totalStudentsVal,
    enrolledStudents,
    unenrolledStudents: totalStudentsVal - enrolledStudents,
    totalTeachers: (activeTeachers as any[])[0]?.total ?? 0,
    totalDisciplines: (activeDisciplines as any[])[0]?.total ?? 0,
    totalGrades: (totalGrades as any[])[0]?.total ?? 0,
    totalAssignments: (activeAssignments as any[])[0]?.total ?? 0,
    totalSchedules: (totalSchedules as any[])[0]?.total ?? 0,
    assignmentsByDay: byDay,
  };
}
