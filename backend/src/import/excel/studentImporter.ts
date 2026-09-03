import { sql, first } from "../../config/db";
import { MappedStudent } from "./excelMapper";
import { canonicalGradeName, normalizeLookupText, normalizeStudentCode } from "./normalization";

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
interface DisciplineRow { codigoDisciplina: string; nombre: string | null }
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

  // Se cargan primero las claves existentes para que una variante del origen,
  // como 12345.0 o "12 345", actualice al alumno ya existente en vez de crear
  // un segundo registro.
  const existingStudents = (await sql`SELECT "codigoEstudiante" FROM "Student"`) as unknown as StudentCodeRow[];
  const existingBarcodes = new Set(existingStudents.map((s) => s.codigoEstudiante));
  const existingCodeByNormalized = new Map<string, string>();
  for (const student of existingStudents) {
    const normalized = normalizeStudentCode(student.codigoEstudiante);
    if (!existingCodeByNormalized.has(normalized)) existingCodeByNormalized.set(normalized, student.codigoEstudiante);
  }

  const existingGrades = (await sql`SELECT "nombre" FROM "Grade"`) as unknown as GradeRow[];
  const existingGradeNames = new Set(existingGrades.map((g) => g.nombre));
  const gradeByCanonicalName = new Map<string, string>();
  for (const grade of existingGrades) {
    const key = canonicalGradeName(grade.nombre);
    // Preferimos el nombre canónico (por ejemplo 8) si la base tiene también
    // una variante (8A), porque las ofertas se relacionan con ese grado.
    if (!gradeByCanonicalName.has(key) || grade.nombre === key) {
      gradeByCanonicalName.set(key, grade.nombre);
    }
  }

  const existingDisciplines = (await sql`
    SELECT "codigoDisciplina", "nombre" FROM "Discipline"
  `) as unknown as DisciplineRow[];
  const disciplineByLookup = new Map<string, string>();
  for (const discipline of existingDisciplines) {
    disciplineByLookup.set(normalizeLookupText(discipline.codigoDisciplina), discipline.codigoDisciplina);
    if (discipline.nombre) disciplineByLookup.set(normalizeLookupText(discipline.nombre), discipline.codigoDisciplina);
  }

  const normalizedStudents = students.map((student) => {
    const rawCode = normalizeStudentCode(student.codigoEstudiante);
    const code = existingCodeByNormalized.get(rawCode) || rawCode;
    const rawGrade = canonicalGradeName(student.gradeNombre);
    const gradeNombre = gradeByCanonicalName.get(rawGrade) || rawGrade;
    const schedules = student.schedules.map((schedule) => {
      const rawDiscipline = String(schedule.codigoDisciplina ?? "").trim();
      return {
        ...schedule,
        codigoDisciplina: disciplineByLookup.get(normalizeLookupText(rawDiscipline)) || rawDiscipline,
      };
    });
    return { ...student, codigoEstudiante: code, gradeNombre, schedules };
  });

  for (const s of normalizedStudents) {
    result.gradeNames.add(s.gradeNombre);
    for (const sched of s.schedules) {
      result.disciplineCodes.add(sched.codigoDisciplina);
    }
  }

  for (const nombre of result.gradeNames) {
    if (nombre && !existingGradeNames.has(nombre)) {
      result.newGrades.push(nombre);
    }
  }

  const existingDisciplineCodes = new Set(existingDisciplines.map((d) => d.codigoDisciplina));
  for (const codigo of result.disciplineCodes) {
    if (codigo && !existingDisciplineCodes.has(codigo)) {
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

  const sourceBarcodes = new Set(normalizedStudents.map((s) => s.codigoEstudiante));
  const absentBarcodes: string[] = [];
  for (const barcode of existingBarcodes) {
    if (!sourceBarcodes.has(barcode)) {
      result.absentStudents.push(barcode);
      result.absent++;
      absentBarcodes.push(barcode);
    }
  }

  if (!dryRun && absentBarcodes.length > 0) {
    await sql`UPDATE "Student" SET "estado" = 'inactivo' WHERE "codigoEstudiante" = ANY(${absentBarcodes})`;
  }

  for (const student of normalizedStudents) {
    result.processed++;

    try {
      const grade = await first<GradeIdRow>(await sql`SELECT "idGrado" FROM "Grade" WHERE "nombre" = ${student.gradeNombre} LIMIT 1` as unknown as GradeIdRow[]);
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
        if (isExisting) result.updated++;
        else result.created++;

        const existingSchedules = (await sql`
          SELECT "id", "diaSemana", "codigoDisciplina" FROM "StudentSchedule"
          WHERE "codigoEstudiante" = ${student.codigoEstudiante}
        `) as unknown as ScheduleRow[];

        const existingMap = new Map(existingSchedules.map((s) => [s.diaSemana, s.codigoDisciplina]));
        const newMap = new Map(student.schedules.map((s) => [s.diaSemana, s.codigoDisciplina]));

        for (const [dia, disc] of newMap) {
          if (!existingMap.has(dia)) result.activitiesCreated++;
          else if (existingMap.get(dia) !== disc) result.activitiesModified++;
        }
        for (const [dia] of existingMap) {
          if (!newMap.has(dia)) result.activitiesDeleted++;
        }
        continue;
      }

      // Upsert student (ON CONFLICT para HTTP driver sin transacción).
      const estadoValue = student.estado ? "estado" : null;
      const columns = ['"codigoEstudiante"', '"nombre"', '"apellido"', '"idGrado"', '"grupo"', '"correo"', '"updatedAt"'];
      const placeholders = ["$1", "$2", "$3", "$4", "$5", "$6", "now()"];
      const updateSets = [
        '"nombre" = EXCLUDED."nombre"',
        '"apellido" = EXCLUDED."apellido"',
        '"idGrado" = EXCLUDED."idGrado"',
        '"grupo" = EXCLUDED."grupo"',
        '"correo" = EXCLUDED."correo"',
        '"updatedAt" = now()',
      ];
      const values: unknown[] = [student.codigoEstudiante, student.nombre, student.apellido, grade.idGrado, student.grupo, student.correo];

      if (estadoValue) {
        columns.push('"estado"');
        placeholders.push("$7");
        updateSets.push('"estado" = EXCLUDED."estado"');
        values.push(student.estado);
      }

      await sql(
        `INSERT INTO "Student" (${columns.join(", ")})
         VALUES (${placeholders.join(", ")})
         ON CONFLICT ("codigoEstudiante") DO UPDATE SET
           ${updateSets.join(",\n           ")}`,
        values,
      );

      const existingSchedules = (await sql`
        SELECT "id", "diaSemana", "codigoDisciplina" FROM "StudentSchedule"
        WHERE "codigoEstudiante" = ${student.codigoEstudiante}
      `) as unknown as ScheduleRow[];

      const existingMap = new Map(existingSchedules.map((s) => [s.diaSemana, s]));
      const newMap = new Map(student.schedules.map((s) => [s.diaSemana, s]));

      for (const [dia, newEntry] of newMap) {
        const existing = existingMap.get(dia);
        if (!existing) {
          // La tabla de producción actualmente no tiene default para id,
          // aunque el schema Prisma declare @default(uuid()).
          await sql`INSERT INTO "StudentSchedule" ("id", "codigoEstudiante", "codigoDisciplina", "diaSemana") VALUES (gen_random_uuid(), ${student.codigoEstudiante}, ${newEntry.codigoDisciplina}, ${dia})`;
          result.activitiesCreated++;
        } else if (existing.codigoDisciplina !== newEntry.codigoDisciplina) {
          await sql`UPDATE "StudentSchedule" SET "codigoDisciplina" = ${newEntry.codigoDisciplina} WHERE "id" = ${existing.id}`;
          result.activitiesModified++;
        }
      }

      for (const [dia, existing] of existingMap) {
        if (!newMap.has(dia)) {
          await sql`DELETE FROM "StudentSchedule" WHERE "id" = ${existing.id}`;
          result.activitiesDeleted++;
        }
      }

      if (isExisting) result.updated++;
      else result.created++;
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
