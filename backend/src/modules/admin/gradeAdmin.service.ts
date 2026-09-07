import { loadCoreData, gradePayload } from "../appsheet/appsheet.views";

export async function listGrades() {
  const data = await loadCoreData();
  return data.grades.slice().sort((a, b) => a.id - b.id).map((grade) => ({
    ...gradePayload(grade),
    _count: {
      students: data.students.filter((row) => row.gradeId === grade.id).length,
      assignments: data.assignments.filter((row) => row.gradeId === grade.id).length,
    },
  }));
}
