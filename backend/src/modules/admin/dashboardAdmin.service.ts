import prisma from "../../config/prisma";

export async function getStats() {
  const [
    totalStudents,
    enrolledStudents,
    totalTeachers,
    totalDisciplines,
    totalGrades,
    totalAssignments,
    totalSchedules,
    assignmentsByDay,
  ] = await Promise.all([
    prisma.student.count(),
    prisma.studentSchedule.groupBy({ by: ["codigoEstudiante"] }).then((r) => r.length),
    prisma.teacher.count({ where: { estado: "activo" } }),
    prisma.discipline.count({ where: { estado: "activa" } }),
    prisma.grade.count(),
    prisma.extracurricularAssignment.count({ where: { estado: "activo" } }),
    prisma.schedule.count(),
    prisma.schedule.groupBy({ by: ["diaSemana"], _count: true }).then((r) =>
      Object.fromEntries(r.map((d) => [d.diaSemana, d._count]))
    ),
  ]);

  return {
    totalStudents,
    enrolledStudents,
    unenrolledStudents: totalStudents - enrolledStudents,
    totalTeachers,
    totalDisciplines,
    totalGrades,
    totalAssignments,
    totalSchedules,
    assignmentsByDay,
  };
}