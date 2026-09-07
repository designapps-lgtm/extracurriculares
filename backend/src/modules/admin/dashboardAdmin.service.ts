import { disciplineCodes, loadCoreData } from "../appsheet/appsheet.views";

export async function getStats() {
  const data = await loadCoreData();
  const enrolled = new Set(data.enrollments.map((row) => row.studentCode));
  const assignmentsByDay: Record<string, number> = {};
  for (const assignment of data.assignments) {
    for (const scheduleId of assignment.scheduleIds) {
      const day = data.scheduleById.get(scheduleId)?.day;
      if (day) assignmentsByDay[day] = (assignmentsByDay[day] ?? 0) + 1;
    }
  }
  return {
    totalStudents: data.students.length,
    enrolledStudents: enrolled.size,
    unenrolledStudents: Math.max(0, data.students.length - enrolled.size),
    totalTeachers: data.users.filter((user) => user.role === "teacher" && user.active).length,
    totalDisciplines: disciplineCodes(data).length,
    totalGrades: data.grades.length,
    totalAssignments: data.assignments.length,
    totalSchedules: data.schedules.length,
    assignmentsByDay,
  };
}
