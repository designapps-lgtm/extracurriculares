import { sql, first } from "../../config/db";
import { normalizeDay, normalizeTime } from "../../utils/validators";
import type { ParsedOfferEntry, ParsedOfferSchedule } from "./offerWorkbook";

interface GradeRow { idGrado: number; nombre: string }
interface TeacherRow { idProfesor: string }
interface DisciplineRow { codigoDisciplina: string }
interface ScheduleRow { idHorario: string }
interface AssignmentRow { idAsignacion: string; estado: string }

function splitTeacherName(fullName: string): { nombre: string; apellido: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { nombre: fullName.trim(), apellido: "" };
  return { nombre: parts.slice(0, -1).join(" "), apellido: parts[parts.length - 1] };
}

async function resolveScheduleLinks(schedules: ParsedOfferSchedule[]): Promise<{ idHorario: string }[]> {
  const links: { idHorario: string }[] = [];
  for (const s of schedules) {
    const day = normalizeDay(s.diaSemana) || s.diaSemana;
    const hi = s.horaInicio ? normalizeTime(s.horaInicio) : null;
    const hf = s.horaFin ? normalizeTime(s.horaFin) : null;

    const existing = await first<ScheduleRow>(
      await sql`
        SELECT "idHorario"
        FROM "Schedule"
        WHERE "diaSemana" = ${day}
          AND "horaInicio" IS NOT DISTINCT FROM ${hi}
          AND "horaFin" IS NOT DISTINCT FROM ${hf}
        LIMIT 1
      ` as unknown as ScheduleRow[]
    );

    if (existing) {
      links.push({ idHorario: existing.idHorario });
      continue;
    }

    const rows = (await sql`
      INSERT INTO "Schedule" ("idHorario", "diaSemana", "horaInicio", "horaFin", "aula", "updatedAt")
      VALUES (gen_random_uuid(), ${day}, ${hi}, ${hf}, ${s.aula || null}, now())
      RETURNING "idHorario"
    `) as unknown as ScheduleRow[];
    links.push({ idHorario: rows[0].idHorario });
  }

  return links;
}

export async function syncOfferEntries(entries: ParsedOfferEntry[], dryRun = false) {
  const result = {
    entries: entries.length,
    created: 0,
    reactivated: 0,
    skipped: 0,
    assignmentsCreated: 0,
    schedulesCreated: 0,
  };

  const uniqueGrades = [...new Set(entries.flatMap((e) => e.grades))];
  const uniqueDisciplines = [...new Set(entries.map((e) => e.discipline))];
  const uniqueTeachers = [...new Set(entries.map((e) => e.teacher))];

  const gradeMap = new Map<string, number>();
  for (const g of uniqueGrades) {
    const grade = await first<GradeRow>(await sql`SELECT "idGrado", "nombre" FROM "Grade" WHERE "nombre" = ${g} LIMIT 1` as unknown as GradeRow[]);
    if (grade) gradeMap.set(g, grade.idGrado);
    else throw new Error(`Grado no encontrado: ${g}`);
  }

  for (const code of uniqueDisciplines) {
    const existing = await first<DisciplineRow>(await sql`SELECT "codigoDisciplina" FROM "Discipline" WHERE "codigoDisciplina" = ${code} LIMIT 1` as unknown as DisciplineRow[]);
    if (!existing && !dryRun) {
      await sql`INSERT INTO "Discipline" ("codigoDisciplina", "nombre") VALUES (${code}, ${code}) ON CONFLICT ("codigoDisciplina") DO NOTHING`;
    }
  }

  const teacherMap = new Map<string, string>();
  for (const teacherName of uniqueTeachers) {
    const existing = await first<TeacherRow>(await sql`
      SELECT "idProfesor"
      FROM "Teacher"
      WHERE "nombre" || ' ' || "apellido" = ${teacherName}
      LIMIT 1
    ` as unknown as TeacherRow[]);
    if (existing) {
      teacherMap.set(teacherName, existing.idProfesor);
      continue;
    }

    const { nombre, apellido } = splitTeacherName(teacherName);
    if (!dryRun) {
      const rows = (await sql`INSERT INTO "Teacher" ("nombre", "apellido") VALUES (${nombre}, ${apellido}) RETURNING "idProfesor"`) as unknown as TeacherRow[];
      teacherMap.set(teacherName, rows[0].idProfesor);
    } else {
      teacherMap.set(teacherName, `dry-run-${teacherName}`);
    }
  }

  for (const entry of entries) {
    const teacherId = teacherMap.get(entry.teacher);
    if (!teacherId) continue;

    const scheduleLinks = dryRun ? [] : await resolveScheduleLinks(entry.schedules);
    if (!dryRun) result.schedulesCreated += scheduleLinks.length;

    for (const gradeNombre of entry.grades) {
      const gradeId = gradeMap.get(gradeNombre);
      if (!gradeId) continue;

      const existing = await first<AssignmentRow>(await sql`
        SELECT "idAsignacion", "estado"
        FROM "ExtracurricularAssignment"
        WHERE "idProfesor" = ${teacherId}
          AND "codigoDisciplina" = ${entry.discipline}
          AND "idGrado" = ${gradeId}
        LIMIT 1
      ` as unknown as AssignmentRow[]);

      let assignmentId: string;
      if (existing) {
        assignmentId = existing.idAsignacion;
        if (!dryRun) {
          if (existing.estado === "inactivo") {
            await sql`UPDATE "ExtracurricularAssignment" SET "estado" = 'activo', "updatedAt" = now() WHERE "idAsignacion" = ${assignmentId}`;
            result.reactivated++;
          } else {
            result.skipped++;
          }
          await sql`DELETE FROM "AssignmentSchedule" WHERE "idAsignacion" = ${assignmentId}`;
          for (const link of scheduleLinks) {
            await sql`INSERT INTO "AssignmentSchedule" ("id", "idAsignacion", "idHorario") VALUES (gen_random_uuid(), ${assignmentId}, ${link.idHorario})`;
          }
        }
      } else {
        if (!dryRun) {
          const rows = (await sql`
            INSERT INTO "ExtracurricularAssignment" ("idProfesor", "codigoDisciplina", "idGrado")
            VALUES (${teacherId}, ${entry.discipline}, ${gradeId})
            RETURNING "idAsignacion"
          `) as unknown as AssignmentRow[];
          assignmentId = rows[0].idAsignacion;
          result.created++;
          for (const link of scheduleLinks) {
            await sql`INSERT INTO "AssignmentSchedule" ("id", "idAsignacion", "idHorario") VALUES (gen_random_uuid(), ${assignmentId}, ${link.idHorario})`;
          }
        } else {
          result.created++;
        }
      }

      if (!dryRun) result.assignmentsCreated++;
    }
  }

  return result;
}
