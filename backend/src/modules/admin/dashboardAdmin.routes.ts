import { Router } from "express";
import prisma from "../../config/prisma";
import { asyncHandler } from "../../middlewares/errorHandler";

const router = Router();

router.get("/stats", asyncHandler(async (_req, res) => {
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

  res.json({
    success: true,
    data: {
      totalStudents,
      enrolledStudents,
      unenrolledStudents: totalStudents - enrolledStudents,
      totalTeachers,
      totalDisciplines,
      totalGrades,
      totalAssignments,
      totalSchedules,
      assignmentsByDay,
    },
  });
}));

export { router as adminDashboardRouter };
