import { sql } from "../../config/db";

export async function listGrades() {
  const rows = await sql`
    SELECT g."idGrado", g."nombre", g."nivel", g."estado",
      (SELECT COUNT(*)::int FROM "Student" s WHERE s."idGrado" = g."idGrado") AS "studentsCount",
      (SELECT COUNT(*)::int FROM "ExtracurricularAssignment" ea WHERE ea."idGrado" = g."idGrado") AS "assignmentsCount"
    FROM "Grade" g
    ORDER BY g."nombre" ASC
  `;
  return (rows as any[]).map((r) => ({
    idGrado: r.idGrado,
    nombre: r.nombre,
    nivel: r.nivel,
    estado: r.estado,
    _count: { students: r.studentsCount, assignments: r.assignmentsCount },
  }));
}
