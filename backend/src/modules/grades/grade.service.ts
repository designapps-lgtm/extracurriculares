import { sql, first } from "../../config/db";
import { AppError } from "../../middlewares/errorHandler";
import { PaginationParams, PaginatedResult, paginatedResult } from "../../utils/pagination";
import { ASSIGNMENT_SELECT, buildAssignmentList, AssignmentRow } from "../../utils/assignmentQueries";

interface GradeCounts {
  idGrado: number;
  _count_students: number;
  _count_assignments: number;
  nombre: string;
  nivel: string | null;
}

export async function getGrades(pagination: PaginationParams): Promise<PaginatedResult<any>> {
  const totalRows = await sql`SELECT COUNT(*)::int AS total FROM "Grade"` as unknown as Array<{ total: number }>;
  const total = totalRows[0]?.total ?? 0;

  const data = await sql(
    `SELECT g."idGrado", g."nombre", g."nivel", g."estado",
            COUNT(DISTINCT s."codigoEstudiante")::int AS "_count_students",
            COUNT(DISTINCT ea."idAsignacion")::int AS "_count_assignments"
     FROM "Grade" g
     LEFT JOIN "Student" s ON s."idGrado" = g."idGrado"
     LEFT JOIN "ExtracurricularAssignment" ea ON ea."idGrado" = g."idGrado"
     GROUP BY g."idGrado"
     ORDER BY g."nombre" ASC
     LIMIT $1 OFFSET $2`,
    [pagination.limit, (pagination.page - 1) * pagination.limit]
  ) as unknown as GradeCounts[];

  const formatted = data.map((g) => ({
    idGrado: g.idGrado,
    nombre: g.nombre,
    nivel: g.nivel,
    _count: { students: g._count_students, assignments: g._count_assignments },
  }));

  return paginatedResult(formatted, total, pagination);
}

export async function getGradeById(id: number) {
  const grade = await first<GradeCounts>(
    await sql(
      `SELECT g."idGrado", g."nombre", g."nivel", g."estado",
              COUNT(DISTINCT s."codigoEstudiante")::int AS "_count_students",
              COUNT(DISTINCT ea."idAsignacion")::int AS "_count_assignments"
       FROM "Grade" g
       LEFT JOIN "Student" s ON s."idGrado" = g."idGrado"
       LEFT JOIN "ExtracurricularAssignment" ea ON ea."idGrado" = g."idGrado"
       WHERE g."idGrado" = $1
       GROUP BY g."idGrado"`,
      [id]
    ) as unknown as GradeCounts[]
  );

  if (!grade) {
    throw new AppError(404, "GRADE_NOT_FOUND", "No se encontró el grado");
  }

  return {
    idGrado: grade.idGrado,
    nombre: grade.nombre,
    nivel: grade.nivel,
    _count: { students: grade._count_students, assignments: grade._count_assignments },
  };
}

export async function getGradeStudents(id: number, pagination: PaginationParams): Promise<PaginatedResult<any>> {
  const exists = await first<any>(
    await sql`SELECT "idGrado" FROM "Grade" WHERE "idGrado" = ${id} LIMIT 1` as unknown as any[]
  );
  if (!exists) {
    throw new AppError(404, "GRADE_NOT_FOUND", "No se encontró el grado");
  }

  const totalRows = await sql`SELECT COUNT(*)::int AS total FROM "Student" WHERE "idGrado" = ${id}` as unknown as Array<{ total: number }>;
  const total = totalRows[0]?.total ?? 0;

  const data = await sql(
    `SELECT s."codigoEstudiante", s."nombre", s."apellido", s."idGrado", s."grupo",
            s."correo", s."fotoUrl", s."estado", s."createdAt", s."updatedAt",
            g."idGrado" AS "idGradoRel", g."nombre" AS "nombreGrado", g."nivel"
     FROM "Student" s
     LEFT JOIN "Grade" g ON g."idGrado" = s."idGrado"
     WHERE s."idGrado" = $1
     ORDER BY s."apellido" ASC, s."nombre" ASC
     LIMIT $2 OFFSET $3`,
    [id, pagination.limit, (pagination.page - 1) * pagination.limit]
  ) as unknown as any[];

  const formatted = data.map((s) => ({
    ...s,
    grade: { idGrado: s.idGradoRel, nombre: s.nombreGrado, nivel: s.nivel },
    idGradoRel: undefined,
    nombreGrado: undefined,
    nivel: undefined,
  }));

  return paginatedResult(formatted, total, pagination);
}

export async function getGradeAssignments(id: number) {
  const exists = await first<any>(
    await sql`SELECT "idGrado" FROM "Grade" WHERE "idGrado" = ${id} LIMIT 1` as unknown as any[]
  );
  if (!exists) {
    throw new AppError(404, "GRADE_NOT_FOUND", "No se encontró el grado");
  }

  const rows = await sql(
    `SELECT ${ASSIGNMENT_SELECT},
            t."nombre" AS "profesorNombre", t."apellido" AS "profesorApellido",
            d."nombre" AS "disciplinaNombre",
            g."nombre" AS "gradoNombre"
     FROM "ExtracurricularAssignment" ea
     LEFT JOIN "Teacher" t ON t."idProfesor" = ea."idProfesor"
     LEFT JOIN "Discipline" d ON d."codigoDisciplina" = ea."codigoDisciplina"
     LEFT JOIN "Grade" g ON g."idGrado" = ea."idGrado"
     WHERE ea."idGrado" = $1
     ORDER BY ea."createdAt" ASC`,
    [id]
  ) as unknown as AssignmentRow[];

  return buildAssignmentList(rows);
}
