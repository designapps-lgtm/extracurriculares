import { PrismaClient } from "@prisma/client";
import { MappedStudent } from "./excelMapper";

const prisma = new PrismaClient();

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

  // Collect all unique grades and disciplines from the data
  for (const s of students) {
    result.gradeNames.add(s.gradeNombre);
    for (const sched of s.schedules) {
      result.disciplineCodes.add(sched.codigoDisciplina);
    }
  }

  // Check which grades and disciplines are new
  const existingGrades = await prisma.grade.findMany({ select: { nombre: true } });
  const existingGradeNames = new Set(existingGrades.map((g) => g.nombre));
  for (const nombre of result.gradeNames) {
    if (!existingGradeNames.has(nombre)) {
      result.newGrades.push(nombre);
    }
  }

  const existingDisciplines = await prisma.discipline.findMany({ select: { codigoDisciplina: true } });
  const existingDisciplineCodes = new Set(existingDisciplines.map((d) => d.codigoDisciplina));
  for (const codigo of result.disciplineCodes) {
    if (!existingDisciplineCodes.has(codigo)) {
      result.newDisciplines.push(codigo);
    }
  }

  // Create grades and disciplines (skip in dry-run)
  if (!dryRun) {
    for (const nombre of result.newGrades) {
      await prisma.grade.upsert({
        where: { nombre },
        create: { nombre },
        update: {},
      });
    }

    for (const codigo of result.newDisciplines) {
      await prisma.discipline.upsert({
        where: { codigoDisciplina: codigo },
        create: { codigoDisciplina: codigo, nombre: codigo },
        update: {},
      });
    }
  }

  // Find existing students in DB
  const existingStudents = await prisma.student.findMany({
    select: { codigoEstudiante: true },
  });
  const existingBarcodes = new Set(existingStudents.map((s) => s.codigoEstudiante));

  // Find students in DB that are NOT in the Excel
  const excelBarcodes = new Set(students.map((s) => s.codigoEstudiante));
  for (const barcode of existingBarcodes) {
    if (!excelBarcodes.has(barcode)) {
      result.absentStudents.push(barcode);
      result.absent++;
    }
  }

  // Process each student
  for (const student of students) {
    result.processed++;

    try {
      // Resolve grade
      const grade = await prisma.grade.findFirst({ where: { nombre: student.gradeNombre } });
      if (!grade) {
        // In dry-run, grade might not exist yet — check if it's a new grade
        if (dryRun && result.newGrades.includes(student.gradeNombre)) {
          // Grade would be created — treat as new student
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

        // Analyze activities
        const existingSchedules = await prisma.studentSchedule.findMany({
          where: { codigoEstudiante: student.codigoEstudiante },
        });

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

      // Real import: upsert student + sync schedules
      await prisma.$transaction(async (tx) => {
        await tx.student.upsert({
          where: { codigoEstudiante: student.codigoEstudiante },
          create: {
            codigoEstudiante: student.codigoEstudiante,
            nombre: student.nombre,
            apellido: student.apellido,
            idGrado: grade.idGrado,
            grupo: student.grupo,
            correo: student.correo,
          },
          update: {
            nombre: student.nombre,
            apellido: student.apellido,
            idGrado: grade.idGrado,
            grupo: student.grupo,
            correo: student.correo,
          },
        });

        // Sync schedules
        const existingSchedules = await tx.studentSchedule.findMany({
          where: { codigoEstudiante: student.codigoEstudiante },
        });

        const existingMap = new Map(existingSchedules.map((s) => [s.diaSemana, s]));
        const newMap = new Map(student.schedules.map((s) => [s.diaSemana, s]));

        for (const [dia, newEntry] of newMap) {
          const existing = existingMap.get(dia);
          if (!existing) {
            await tx.studentSchedule.create({
              data: {
                codigoEstudiante: student.codigoEstudiante,
                codigoDisciplina: newEntry.codigoDisciplina,
                diaSemana: dia,
              },
            });
            result.activitiesCreated++;
          } else if (existing.codigoDisciplina !== newEntry.codigoDisciplina) {
            await tx.studentSchedule.update({
              where: { id: existing.id },
              data: { codigoDisciplina: newEntry.codigoDisciplina },
            });
            result.activitiesModified++;
          }
        }

        for (const [dia, existing] of existingMap) {
          if (!newMap.has(dia)) {
            await tx.studentSchedule.delete({ where: { id: existing.id } });
            result.activitiesDeleted++;
          }
        }
      });

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
