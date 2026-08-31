import { sql, first } from "../../config/db";
import { MappedStudent } from "./excelMapper";

export interface ImportResult {
  processed: number;
  created: number;
  updated: number;
  unchanged: number;
  errors: number;
  absent: number;
  activitiesCreated: number;
  activitiesModified: number;
  activitiesDeleted: number;
  activityErrors: number;
  disciplineCodes: Set<string>;
  gradeNames: Set<string>;
  newGrades: string[];
  newDisciplines: string[];
  errorDetails: { row: number; codigo: string; error: string }[];
  absentStudents: string[];
}

interface GradeRow { nombre: string }
interface DisciplineRow { codigoDisciplina: string }
interface StudentCodeRow { codigoEstudiante: string }
interface GradeIdRow { idGrado: number }
interface ScheduleRow { id: string; diaSemana: string; codigoDisciplina: string }

export async function importStudents(students: MappedStudent[], dryRun: boolean): Promise<ImportResult> {
  const result: ImportResult = {
    processed: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    errors: 0,
    absent: 0,
    activitiesCreated: 0,
    activitiesModified: 0,
    activitiesDeleted: 0,
    activityErrors: 0,
    disciplineCodes: new Set(),
    gradeNames: new Set(),
    newGrades: [],
    newDisciplines: [],
    errorDetails: [],
    absentStudents: [],
  };

  for (const s of students) {
    result.gradeNames.add(s.gradeNombre);
    for (const sched of s.schedules) {
      result.disciplineCodes.add(sched.codigoDisciplina);
    }
  }

  const existingGrades = (await sql`SELECT "nombre" FROM "Grade"`) as unknown as GradeRow[];
  const existingGradeNames = new Set(existingGrades.map((g) => g.nombre));
  for (const nombre of result.gradeNames) {
    if (!existingGradeNames.has(nombre)) {
      result.newGrades.push(nombre);
    }
  }

  const existingDisciplines = (await sql`SELECT "codigoDisciplina" FROM "Discipline"`) as unknown as DisciplineRow[];
  const existingDisciplineCodes = new Set(existingDisciplines.map((d) => d.codigoDisciplina));
  for (const codigo of result.disciplineCodes) {
    if (!existingDisciplineCodes.has(codigo)) {
      result.newDisciplines.push(codigo);
    }
  }

  if (!dryRun) {
    for (const nombre of result.newGrades) {
      await sql`INSERT INTO "Grade" ("nombre") VALUES (${nombre}) ON CONFLICT ("nombre") DO NOTHING`;
    }

    for (const codigo of result.newDisciplines) {
      await sql`INSERT INTO "Discipline" ("codigoDisciplina", "nombre") VALUES (${codigo}, ${codigo}) ON CONFLICT ("codigoDisciplina") DO NOTHING`;
    }
  }

  const existingStudents = (await sql`SELECT "codigoEstudiante" FROM "Student"`) as unknown as StudentCodeRow[];
  const existingBarcodes = new Set(existingStudents.map((s) => s.codigoEstudiante));

  const excelBarcodes = new Set(students.map((s) => s.codigoEstudiante));
  const absentBarcodes: string[] = [];
  for (const barcode of existingBarcodes) {
    if (!excelBarcodes.has(barcode)) {
      result.absentStudents.push(barcode);
      result.absent++;
      absentBarcodes.push(barcode);
    }
  }

  if (!dryRun && absentBarcodes.length > 0) {
    await sql`UPDATE "Student" SET "estado" = 'inactivo' WHERE "codigoEstudiante" = ANY(${absentBarcodes})`;
  }

  for (const student of students) {
    result.processed++;

    try {
      const grade = await first<GradeIdRow>(await sql`SELECT "idGrado" FROM "Grade" WHERE "nombre" = ${student.gradeNombre} LIMIT 1`);
      if (!grade) {
        if (dryRun && result.newGrades.includes(student.gradeNombre)) {
          const isExisting = existingBarcodes.has(student.codigoEstudiante);
          if (isExisting) result.updated++;
          else result.created++;
          continue;
        }
        throw new Error(`Grado "${student.gradeNombre}" no encontrado`);
      }

      const isExisting = existingBarcodes.has(student.codigoEstudiante);

      if (dryRun) {
        if (isExisting) {
          result.updated++;
        } else {
          result.created++;
        }

        const existingSchedules = (await sql`
          SELECT "id", "diaSemana", "codigoDisciplina" FROM "StudentSchedule"
          WHERE "codigoEstudiante" = ${student.codigoEstudiante}
        `) as unknown as ScheduleRow[];

        const existingMap = new Map(existingSchedules.map((s) => [s.diaSemana, s.codigoDisciplina]));
        const newMap = new Map(student.schedules.map((s) => [s.diaSemana, s.codigoDisciplina]));

        for (const [dia, disc] of newMap) {
          if (!existingMap.has(dia)) {
            result.activitiesCreated++;
          } else if (existingMap.get(dia) !== disc) {
            result.activitiesModified++;
          }
        }

        for (const [dia] of existingMap) {
          if (!newMap.has(dia)) {
            result.activitiesDeleted++;
          }
        }

        continue;
      }

      // Upsert student (ON CONFLICT para HTTP driver sin transacción)
      await sql(
        `INSERT INTO "Student" ("codigoEstudiante", "nombre", "apellido", "idGrado", "grupo", "correo", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, now())
         ON CONFLICT ("codigoEstudiante") DO UPDATE SET
           "nombre" = EXCLUDED."nombre",
           "apellido" = EXCLUDED."apellido",
           "idGrado" = EXCLUDED."idGrado",
           "grupo" = EXCLUDED."grupo",
           "correo" = EXCLUDED."correo",
           "updatedAt" = now()`,
        [student.codigoEstudiante, student.nombre, student.apellido, grade.idGrado, student.grupo, student.correo]
      );

      // Read existing schedules (after upsert ensures student exists)
      const existingSchedules = (await sql`
        SELECT "id", "diaSemana", "codigoDisciplina" FROM "StudentSchedule"
        WHERE "codigoEstudiante" = ${student.codigoEstudiante}
      `) as unknown as ScheduleRow[];

      const existingMap = new Map(existingSchedules.map((s) => [s.diaSemana, s]));
      const newMap = new Map(student.schedules.map((s) => [s.diaSemana, s]));

      // Insert new schedules
      for (const [dia, newEntry] of newMap) {
        const existing = existingMap.get(dia);
        if (!existing) {
          await sql`INSERT INTO "StudentSchedule" ("codigoEstudiante", "codigoDisciplina", "diaSemana") VALUES (${student.codigoEstudiante}, ${newEntry.codigoDisciplina}, ${dia})`;
          result.activitiesCreated++;
        } else if (existing.codigoDisciplina !== newEntry.codigoDisciplina) {
          await sql`UPDATE "StudentSchedule" SET "codigoDisciplina" = ${newEntry.codigoDisciplina} WHERE "id" = ${existing.id}`;
          result.activitiesModified++;
        }
      }

      // Delete removed schedules
      for (const [dia, existing] of existingMap) {
        if (!newMap.has(dia)) {
          await sql`DELETE FROM "StudentSchedule" WHERE "id" = ${existing.id}`;
          result.activitiesDeleted++;
        }
      }

      if (isExisting) {
        result.updated++;
      } else {
        result.created++;
      }
    } catch (err) {
      result.errors++;
      result.errorDetails.push({
        row: student._excelRow,
        codigo: student.codigoEstudiante,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}
