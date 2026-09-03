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

export interface ImportStudentsOptions {
  /** Evita desactivar registros cuando la fuente llegó parcialmente validada. */
  deactivateAbsent?: boolean;
}

export async function importStudents(
  students: MappedStudent[],
  dryRun: boolean,
  options: ImportStudentsOptions = {},
): Promise<ImportResult> {
  const deactivateAbsent = options.deactivateAbsent ?? true;
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
  if (deactivateAbsent) {
    for (const barcode of existingBarcodes) {
      if (!excelBarcodes.has(barcode)) {
        result.absentStudents.push(barcode);
        result.absent++;
        absentBarcodes.push(barcode);
      }
    }
  }

  if (!dryRun && deactivateAbsent && absentBarcodes.length > 0) {
    await sql`UPDATE "Student" SET "estado" = 'inactivo' WHERE "codigoEstudiante" = ANY(${absentBarcodes})`;
  }

  for (const student of students) {
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
        values
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
          // La tabla de producción actualmente no tiene default para `id`,
          // aunque el schema Prisma declare @default(uuid()). Generarlo aquí
          // mantiene el importador compatible con ambas estructuras.
          await sql`INSERT INTO "StudentSchedule" ("id", "codigoEstudiante", "codigoDisciplina", "diaSemana") VALUES (gen_random_uuid(), ${student.codigoEstudiante}, ${newEntry.codigoDisciplina}, ${dia})`;
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


/**
 * Importación masiva para fuentes serverless como AppSheet.
 *
 * El importador histórico hace varias consultas por estudiante. Eso funciona
 * en Node, pero supera el límite de subrequests de Cloudflare Workers cuando
 * AppSheet devuelve cientos de filas. Esta variante mantiene el mismo modelo
 * de datos usando un número constante de consultas parametrizadas.
 */
export async function importStudentsBulk(
  students: MappedStudent[],
  dryRun: boolean,
  options: ImportStudentsOptions = {},
): Promise<ImportResult> {
  const deactivateAbsent = options.deactivateAbsent ?? true;
  const result: ImportResult = {
    processed: students.length,
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

  for (const student of students) {
    result.gradeNames.add(student.gradeNombre);
    for (const schedule of student.schedules) {
      result.disciplineCodes.add(schedule.codigoDisciplina);
    }
  }

  let grades = (await sql`SELECT "idGrado", "nombre" FROM "Grade"`) as unknown as Array<{ idGrado: number; nombre: string }>;
  const existingGradeNames = new Set(grades.map((grade) => grade.nombre));
  result.newGrades = [...result.gradeNames].filter((name) => !existingGradeNames.has(name));

  if (!dryRun && result.newGrades.length > 0) {
    const values = result.newGrades;
    const placeholders = values.map((_, index) => `($${index + 1})`).join(", ");
    await sql(
      `INSERT INTO "Grade" ("nombre") VALUES ${placeholders} ON CONFLICT ("nombre") DO NOTHING`,
      values,
    );
    grades = await sql`SELECT "idGrado", "nombre" FROM "Grade"` as unknown as Array<{ idGrado: number; nombre: string }>;
  }

  const gradeIds = new Map(grades.map((grade) => [grade.nombre, grade.idGrado]));
  const validStudents = students.filter((student) => {
    if (gradeIds.has(student.gradeNombre)) return true;
    result.errors++;
    result.errorDetails.push({
      row: student._excelRow,
      codigo: student.codigoEstudiante,
      error: `Grado "${student.gradeNombre}" no encontrado`,
    });
    return false;
  });

  let disciplines = (await sql`SELECT "codigoDisciplina" FROM "Discipline"`) as unknown as DisciplineRow[];
  const existingDisciplineCodes = new Set(disciplines.map((discipline) => discipline.codigoDisciplina));
  result.newDisciplines = [...result.disciplineCodes].filter((code) => !existingDisciplineCodes.has(code));

  if (!dryRun && result.newDisciplines.length > 0) {
    const values = result.newDisciplines.flatMap((code) => [code, code]);
    const placeholders = result.newDisciplines.map((_, index) => `($${index * 2 + 1}, $${index * 2 + 2})`).join(", ");
    await sql(
      `INSERT INTO "Discipline" ("codigoDisciplina", "nombre") VALUES ${placeholders} ON CONFLICT ("codigoDisciplina") DO NOTHING`,
      values,
    );
  }

  const existingStudents = (await sql`SELECT "codigoEstudiante" FROM "Student"`) as unknown as StudentCodeRow[];
  const existingBarcodes = new Set(existingStudents.map((student) => student.codigoEstudiante));
  const studentCodes = validStudents.map((student) => student.codigoEstudiante);

  if (deactivateAbsent) {
    const importedCodes = new Set(studentCodes);
    const absentBarcodes = [...existingBarcodes].filter((code) => !importedCodes.has(code));
    result.absentStudents = absentBarcodes;
    result.absent = absentBarcodes.length;
    if (!dryRun && absentBarcodes.length > 0) {
      await sql`UPDATE "Student" SET "estado" = 'inactivo' WHERE "codigoEstudiante" = ANY(${absentBarcodes})`;
    }
  }

  result.created = validStudents.filter((student) => !existingBarcodes.has(student.codigoEstudiante)).length;
  result.updated = validStudents.length - result.created;

  if (dryRun || validStudents.length === 0) return result;

  async function upsertStudentRows(rows: MappedStudent[], includeEstado: boolean): Promise<void> {
    if (rows.length === 0) return;

    const values: unknown[] = [];
    const tuples = rows.map((student, index) => {
      const offset = index * (includeEstado ? 7 : 6);
      values.push(
        student.codigoEstudiante,
        student.nombre,
        student.apellido,
        gradeIds.get(student.gradeNombre),
        student.grupo,
        student.correo,
      );
      if (includeEstado) values.push(student.estado);
      const params = Array.from({ length: includeEstado ? 7 : 6 }, (_, valueIndex) => `$${offset + valueIndex + 1}`);
      return `(${params.join(", ")}, now())`;
    }).join(", ");

    const columns = includeEstado
      ? `"codigoEstudiante", "nombre", "apellido", "idGrado", "grupo", "correo", "estado", "updatedAt"`
      : `"codigoEstudiante", "nombre", "apellido", "idGrado", "grupo", "correo", "updatedAt"`;
    const updates = [
      `"nombre" = EXCLUDED."nombre"`,
      `"apellido" = EXCLUDED."apellido"`,
      `"idGrado" = EXCLUDED."idGrado"`,
      `"grupo" = EXCLUDED."grupo"`,
      `"correo" = EXCLUDED."correo"`,
      `"updatedAt" = now()`,
    ];
    if (includeEstado) updates.push(`"estado" = EXCLUDED."estado"`);

    await sql(
      `INSERT INTO "Student" (${columns}) VALUES ${tuples}
       ON CONFLICT ("codigoEstudiante") DO UPDATE SET ${updates.join(", ")}`,
      values,
    );
  }

  await upsertStudentRows(validStudents.filter((student) => Boolean(student.estado)), true);
  await upsertStudentRows(validStudents.filter((student) => !student.estado), false);

  // AppSheet devuelve el snapshot completo de horarios. Reemplazar todos los
  // horarios de los estudiantes del lote evita consultas individuales y
  // conserva la semántica del importador anterior.
  const oldScheduleRows = await sql`
    SELECT count(*)::int AS count FROM "StudentSchedule"
    WHERE "codigoEstudiante" = ANY(${studentCodes})
  ` as unknown as Array<{ count: number | string }>;
  result.activitiesDeleted = Number(oldScheduleRows[0]?.count || 0);
  await sql`DELETE FROM "StudentSchedule" WHERE "codigoEstudiante" = ANY(${studentCodes})`;

  const scheduleRows: Array<[string, string, string]> = [];
  for (const student of validStudents) {
    const byDay = new Map<string, string>();
    for (const schedule of student.schedules) {
      byDay.set(schedule.diaSemana, schedule.codigoDisciplina);
    }
    for (const [day, discipline] of byDay) {
      scheduleRows.push([student.codigoEstudiante, discipline, day]);
    }
  }

  if (scheduleRows.length > 0) {
    const values: unknown[] = [];
    const tuples = scheduleRows.map((row, index) => {
      const offset = index * 3;
      values.push(...row);
      return `(gen_random_uuid(), $${offset + 1}, $${offset + 2}, $${offset + 3})`;
    }).join(", ");
    await sql(
      `INSERT INTO "StudentSchedule" ("id", "codigoEstudiante", "codigoDisciplina", "diaSemana") VALUES ${tuples}`,
      values,
    );
    result.activitiesCreated = scheduleRows.length;
  }

  return result;
}
