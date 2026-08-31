import { sql, first } from "../../config/db";

// ==========================================
// TEACHERS
// ==========================================
const TEACHERS = [
  { nombre: "Javier", apellido: "Morales" },
  { nombre: "Cristian", apellido: "Echeverry" },
  { nombre: "Isaí", apellido: "Toro" },
  { nombre: "Stefania", apellido: "Tabares" },
  { nombre: "Andrés", apellido: "Gómez" },
  { nombre: "Sebastián", apellido: "Echeverry" },
  { nombre: "Luis Eduardo", apellido: "Martínez" },
  { nombre: "Óscar", apellido: "López" },
  { nombre: "Mauricio", apellido: "Lozano" },
  { nombre: "Yamid", apellido: "Gómez" },
  { nombre: "Anderson", apellido: "Buitrago" },
  { nombre: "Vanessa", apellido: "Castellanos" },
  { nombre: "Carlos", apellido: "Pinillo" },
  { nombre: "Cristian", apellido: "Mosquera" },
  { nombre: "Sebastián", apellido: "Saldarriaga" },
  { nombre: "Juan Carlos", apellido: "Ortiz" },
  { nombre: "Luisa", apellido: "Granada" },
  { nombre: "Alejandra", apellido: "Ramírez" },
  { nombre: "Liliana", apellido: "Niño" },
  { nombre: "Mateo", apellido: "Brito" },
  { nombre: "Jazmín", apellido: "López" },
  { nombre: "Julián", apellido: "Vargas" },
  { nombre: "Juan José", apellido: "Ramírez" },
  { nombre: "Mauricio", apellido: "Porras" },
  { nombre: "Juan David", apellido: "Calvo" },
];

// ==========================================
// SCHEDULES (unique day+time patterns)
// ==========================================
const SCHEDULES: Record<string, { diaSemana: string; horaInicio: string | null; horaFin: string | null }> = {
  S1:  { diaSemana: "MIERCOLES",  horaInicio: "13:00", horaFin: "14:30" },
  S2:  { diaSemana: "LUNES",      horaInicio: "14:30", horaFin: "16:00" },
  S3:  { diaSemana: "JUEVES",     horaInicio: "14:30", horaFin: "16:00" },
  S4:  { diaSemana: "MARTES",     horaInicio: "15:15", horaFin: "17:15" },
  S5:  { diaSemana: "VIERNES",    horaInicio: "15:15", horaFin: "17:15" },
  S6:  { diaSemana: "SABADO",     horaInicio: "15:15", horaFin: "17:15" },
  S7:  { diaSemana: "MIERCOLES",  horaInicio: "14:00", horaFin: "16:00" },
  S8:  { diaSemana: "LUNES",      horaInicio: "15:30", horaFin: "17:30" },
  S9:  { diaSemana: "JUEVES",     horaInicio: "15:30", horaFin: "17:30" },
  S10: { diaSemana: "MIERCOLES",  horaInicio: "14:20", horaFin: "16:20" },
  S11: { diaSemana: "SABADO",     horaInicio: null,    horaFin: null },
  S12: { diaSemana: "LUNES",      horaInicio: "15:15", horaFin: "17:15" },
  S13: { diaSemana: "JUEVES",     horaInicio: "15:15", horaFin: "17:15" },
  S14: { diaSemana: "MARTES",     horaInicio: "14:30", horaFin: "16:00" },
  S15: { diaSemana: "VIERNES",    horaInicio: "14:30", horaFin: "16:00" },
};

// ==========================================
// OFFER: each entry = teacher + discipline + grade + schedule keys
// ==========================================
interface OfferEntry {
  teacher: string;
  discipline: string;
  grade: string;
  scheduleKeys: string[];
}

const OFFER: OfferEntry[] = [
  // ========== KINDER (hoja KINDER) ==========
  { teacher: "Javier Morales",      discipline: "XC_K4_Futbol",        grade: "K4", scheduleKeys: ["S1"] },
  { teacher: "Cristian Echeverry",  discipline: "XC_K4_Futbol",        grade: "K4", scheduleKeys: ["S1"] },
  { teacher: "Isaí Toro",           discipline: "XC_K4_Polimotor",     grade: "K4", scheduleKeys: ["S1"] },
  { teacher: "Stefania Tabares",    discipline: "XC_K4_Polimotor",     grade: "K4", scheduleKeys: ["S1"] },
  { teacher: "Luisa Granada",       discipline: "XC_K4_IniciaDanzas",  grade: "K4", scheduleKeys: ["S14"] },
  { teacher: "Juan Carlos Ortiz",   discipline: "XC_K4_IniciaMusical", grade: "K4", scheduleKeys: ["S15"] },
  { teacher: "Javier Morales",      discipline: "XC_K5_Futbol",        grade: "K5", scheduleKeys: ["S2", "S3"] },
  { teacher: "Andrés Gómez",        discipline: "XC_K5_Futbol",        grade: "K5", scheduleKeys: ["S2", "S3"] },
  { teacher: "Isaí Toro",           discipline: "XC_K5_Polimotor",     grade: "K5", scheduleKeys: ["S2", "S3"] },
  { teacher: "Stefania Tabares",    discipline: "XC_K5_Polimotor",     grade: "K5", scheduleKeys: ["S2", "S3"] },
  { teacher: "Juan Carlos Ortiz",   discipline: "XC_K5_IniciaMusical", grade: "K5", scheduleKeys: ["S14"] },
  { teacher: "Luisa Granada",       discipline: "XC_K5_IniciaDanzas",  grade: "K5", scheduleKeys: ["S15"] },

  // ========== PRIMARIA (hoja PRIMARIA) ==========
  { teacher: "Alejandra Ramírez",   discipline: "XC_45_OlympMath",  grade: "4",  scheduleKeys: ["S12"] },
  { teacher: "Alejandra Ramírez",   discipline: "XC_45_OlympMath",  grade: "5",  scheduleKeys: ["S12"] },
  ...["1", "2", "3", "4", "5"].flatMap((g) => [
    { teacher: "Liliana Niño",      discipline: "XC_EL_ArtesPlasticas", grade: g, scheduleKeys: ["S12"] },
    { teacher: "Mateo Brito",       discipline: "XC_EL_ArtesPlasticas", grade: g, scheduleKeys: ["S12"] },
    { teacher: "Jazmín López",      discipline: "XC_EL_ArtesPlasticas", grade: g, scheduleKeys: ["S12"] },
  ]),
  ...["1", "2", "3", "4", "5"].map((g) => (
    { teacher: "Juan Carlos Ortiz", discipline: "XC_EL_TecVocal",       grade: g, scheduleKeys: ["S12"] }
  )),
  { teacher: "Javier Morales",      discipline: "XC_1_Futbol_M",        grade: "1",  scheduleKeys: ["S4", "S5", "S6"] },
  { teacher: "Sebastián Echeverry", discipline: "XC_23_Futbol_M",       grade: "2",  scheduleKeys: ["S4", "S5", "S6"] },
  { teacher: "Luis Eduardo Martínez", discipline: "XC_23_Futbol_M",     grade: "3",  scheduleKeys: ["S4", "S5", "S6"] },
  { teacher: "Andrés Gómez",        discipline: "XC_4_Futbol_M",        grade: "4",  scheduleKeys: ["S4", "S5", "S6"] },
  { teacher: "Javier Morales",      discipline: "XC_5_Futbol_M",        grade: "5",  scheduleKeys: ["S4", "S5", "S6"] },
  ...["1", "2", "3", "4", "5"].map((g) => (
    { teacher: "Óscar López",       discipline: "XC_EL_Futbol_F",       grade: g, scheduleKeys: ["S4", "S5", "S6"] }
  )),
  ...["1", "2", "3"].map((g) => (
    { teacher: "Mauricio Lozano",   discipline: "XC_123_Basquetbol",    grade: g, scheduleKeys: ["S4", "S5", "S6"] }
  )),
  ...["4", "5"].map((g) => (
    { teacher: "Yamid Gómez",       discipline: "XC_45_Basquetbol",     grade: g, scheduleKeys: ["S4", "S5", "S6"] }
  )),
  { teacher: "Anderson Buitrago",   discipline: "XC_1_Voleibol",        grade: "1",  scheduleKeys: ["S4", "S5", "S6"] },
  ...["2", "3"].map((g) => (
    { teacher: "Vanessa Castellanos", discipline: "XC_23_Voleibol",     grade: g, scheduleKeys: ["S4", "S5", "S6"] }
  )),
  ...["4", "5"].map((g) => (
    { teacher: "Carlos Pinillo",    discipline: "XC_45_Voleibol",       grade: g, scheduleKeys: ["S4", "S5", "S6"] }
  )),
  ...["1", "2", "3", "4", "5"].flatMap((g) => [
    { teacher: "Isaí Toro",         discipline: "XC_EL_Porras",         grade: g, scheduleKeys: ["S4", "S5", "S7"] },
    { teacher: "Stefania Tabares",  discipline: "XC_EL_Porras",         grade: g, scheduleKeys: ["S4", "S5", "S7"] },
  ]),
  ...["1", "2", "3", "4", "5"].map((g) => (
    { teacher: "Cristian Mosquera", discipline: "XC_EL_Taekwondo",      grade: g, scheduleKeys: ["S4", "S5", "S7"] }
  )),
  ...["1", "2", "3", "4", "5"].flatMap((g) => [
    { teacher: "Juan Carlos Ortiz", discipline: "XC_EL_DesaInstrumental", grade: g, scheduleKeys: ["S13"] },
    { teacher: "Juan David Calvo",  discipline: "XC_EL_DesaInstrumental", grade: g, scheduleKeys: ["S13"] },
  ]),
  ...["1", "2", "3", "4", "5"].map((g) => (
    { teacher: "Luisa Granada",     discipline: "XC_EL_DanzaModerna",   grade: g, scheduleKeys: ["S13"] }
  )),
  { teacher: "Julián Vargas",       discipline: "XC_EL_PequenosCientificos", grade: "1", scheduleKeys: ["S13"] },
  { teacher: "Julián Vargas",       discipline: "XC_EL_PequenosCientificos", grade: "3", scheduleKeys: ["S13"] },
  ...["4", "5"].map((g) => (
    { teacher: "Juan José Ramírez", discipline: "XC_Robo_Lego",         grade: g, scheduleKeys: ["S13"] }
  )),

  // ========== SECUNDARIA (hoja SECUNDARIA) ==========
  { teacher: "Juan José Ramírez", discipline: "XC_SEC_ProgRobot",     grade: "6",  scheduleKeys: ["S12"] },
  { teacher: "Juan José Ramírez", discipline: "XC_SEC_ProgRobot",     grade: "12", scheduleKeys: ["S12"] },
  { teacher: "Mauricio Porras",     discipline: "XC_MS_BandaTR",        grade: "8",  scheduleKeys: ["S12"] },
  { teacher: "Mauricio Porras",     discipline: "XC_SEC_BandaFW",       grade: "7",  scheduleKeys: ["S4"] },
  { teacher: "Alejandra Ramírez", discipline: "XC_SEC_OlympMath", grade: "6",  scheduleKeys: ["S4"] },
  { teacher: "Alejandra Ramírez", discipline: "XC_SEC_OlympMath", grade: "12", scheduleKeys: ["S4"] },
  ...["6", "7", "8"].map((g) => (
    { teacher: "Luis Eduardo Martínez", discipline: "XC_MS_Futbol_M",   grade: g, scheduleKeys: ["S8", "S10", "S9", "S11"] }
  )),
  ...["9", "10", "11", "12"].map((g) => (
    { teacher: "Sebastián Saldarriaga", discipline: "XC_HS_Futbol_M",   grade: g, scheduleKeys: ["S8", "S10", "S9", "S11"] }
  )),
  ...["6", "7", "8", "9", "10", "11", "12"].map((g) => (
    { teacher: "Óscar López",       discipline: "XC_SEC_Futbol_F",      grade: g, scheduleKeys: ["S8", "S10", "S9", "S11"] }
  )),
  ...["6", "7", "8"].map((g) => (
    { teacher: "Vanessa Castellanos", discipline: "XC_MS_Voleibol_F",   grade: g, scheduleKeys: ["S8", "S10", "S9", "S11"] }
  )),
  ...["9", "10", "11", "12"].map((g) => (
    { teacher: "Carlos Pinillo",    discipline: "XC_HS_Voleibol_F",     grade: g, scheduleKeys: ["S8", "S10", "S9", "S11"] }
  )),
  ...["6", "7", "8", "9", "10", "11", "12"].map((g) => (
    { teacher: "Yamid Gómez",       discipline: "XC_SEC_Basquetbol",    grade: g, scheduleKeys: ["S8", "S10", "S9", "S11"] }
  )),
  ...["9", "10"].map((g) => (
    { teacher: "Mauricio Porras",   discipline: "XC_90_BandaHorz",      grade: g, scheduleKeys: ["S13"] }
  )),
  ...["6", "7", "8", "9", "10", "11", "12"].map((g) => (
    { teacher: "Liliana Niño",      discipline: "XC_SEC_ArtesPlasticas", grade: g, scheduleKeys: ["S13"] }
  )),
  ...["9", "10", "11", "12"].map((g) => (
    { teacher: "Juan David Calvo",  discipline: "XC_HS_BandaInside",    grade: g, scheduleKeys: ["S5"] }
  )),
];

interface GradeRow { idGrado: number; nombre: string }
interface DisciplineRow { codigoDisciplina: string }
interface TeacherRow { idProfesor: string }
interface ScheduleRow { idHorario: string }
interface AssignmentRow { idAsignacion: string; estado: string }
interface AssignmentLinkRow { idAsignacion: string }

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  console.log(`\n${"=".repeat(60)}`);
  console.log(`IMPORTADOR DE OFERTA — ${dryRun ? "MODO DRY-RUN" : "MODO REAL"}`);
  console.log(`${"=".repeat(60)}\n`);

  // 0. Validate offer (grades + disciplines) BEFORE writing anything
  console.log("0. Validando oferta (grados y disciplinas):");
  const gradeMap = new Map<string, number>();
  const uniqueGrades = [...new Set(OFFER.map((o) => o.grade))];
  const missingGrades: string[] = [];

  for (const g of uniqueGrades) {
    const grade = await first<GradeRow>(await sql`SELECT "idGrado", "nombre" FROM "Grade" WHERE "nombre" = ${g} LIMIT 1`);
    if (grade) {
      gradeMap.set(g, grade.idGrado);
      console.log(`   ✓ ${g} → idGrado ${grade.idGrado}`);
    } else {
      missingGrades.push(g);
    }
  }

  const disciplineSet = new Set(OFFER.map((o) => o.discipline));
  const disciplineMap = new Map<string, boolean>();
  const missingDisciplines: string[] = [];

  for (const d of disciplineSet) {
    const disc = await first<DisciplineRow>(await sql`SELECT "codigoDisciplina" FROM "Discipline" WHERE "codigoDisciplina" = ${d} LIMIT 1`);
    if (disc) {
      disciplineMap.set(d, true);
      console.log(`   ✓ ${d}`);
    } else {
      missingDisciplines.push(d);
    }
  }

  if (missingGrades.length > 0 || missingDisciplines.length > 0) {
    for (const g of missingGrades) console.error(`   ❌ GRADO NO ENCONTRADO: ${g}`);
    for (const d of missingDisciplines) console.error(`   ❌ DISCIPLINA NO ENCONTRADA: ${d}`);
    console.error("Abortando antes de escribir cualquier dato");
    process.exit(1);
  }

  // 1. Create teachers
  console.log("\n1. Profesores:");
  const teacherMap = new Map<string, string>();
  let teachersCreated = 0;
  let teachersExisting = 0;

  for (const t of TEACHERS) {
    const fullName = `${t.nombre} ${t.apellido}`;
    const existing = await first<TeacherRow>(await sql`SELECT "idProfesor" FROM "Teacher" WHERE "nombre" = ${t.nombre} AND "apellido" = ${t.apellido} LIMIT 1`);

    if (existing) {
      teacherMap.set(fullName, existing.idProfesor);
      teachersExisting++;
      console.log(`   ✓ ${fullName} (ya existe)`);
    } else if (!dryRun) {
      const rows = await sql`INSERT INTO "Teacher" ("nombre", "apellido") VALUES (${t.nombre}, ${t.apellido}) RETURNING "idProfesor"`;
      const created = rows[0] as unknown as TeacherRow;
      teacherMap.set(fullName, created.idProfesor);
      teachersCreated++;
      console.log(`   + ${fullName}`);
    } else {
      teacherMap.set(fullName, `dry-run-${fullName}`);
      console.log(`   ~ ${fullName} (dry-run)`);
    }
  }

  // 2. Create schedules
  console.log("\n2. Horarios:");
  const scheduleMap = new Map<string, string>();
  let schedulesCreated = 0;
  let schedulesExisting = 0;

  for (const [key, sched] of Object.entries(SCHEDULES)) {
    const existing = await first<ScheduleRow>(await sql`SELECT "idHorario" FROM "Schedule" WHERE "diaSemana" = ${sched.diaSemana} AND "horaInicio" IS NOT DISTINCT FROM ${sched.horaInicio} AND "horaFin" IS NOT DISTINCT FROM ${sched.horaFin} LIMIT 1`);

    if (existing) {
      scheduleMap.set(key, existing.idHorario);
      schedulesExisting++;
      console.log(`   ✓ ${key}: ${sched.diaSemana} ${sched.horaInicio || "NULL"}-${sched.horaFin || "NULL"} (ya existe)`);
    } else if (!dryRun) {
      const rows = await sql`INSERT INTO "Schedule" ("diaSemana", "horaInicio", "horaFin") VALUES (${sched.diaSemana}, ${sched.horaInicio}, ${sched.horaFin}) RETURNING "idHorario"`;
      const created = rows[0] as unknown as ScheduleRow;
      scheduleMap.set(key, created.idHorario);
      schedulesCreated++;
      console.log(`   + ${key}: ${sched.diaSemana} ${sched.horaInicio || "NULL"}-${sched.horaFin || "NULL"}`);
    } else {
      scheduleMap.set(key, `dry-run-${key}`);
      console.log(`   ~ ${key}: ${sched.diaSemana} ${sched.horaInicio || "NULL"}-${sched.horaFin || "NULL"} (dry-run)`);
    }
  }

  // 3. Create assignments + assignment schedules
  console.log(`\n3. Asignaciones (${OFFER.length} offerings):`);
  let assignmentsCreated = 0;
  let assignmentsReactivated = 0;
  let assignmentSchedulesCreated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const entry of OFFER) {
    const teacherId = teacherMap.get(entry.teacher);
    const gradeId = gradeMap.get(entry.grade);
    const discExists = disciplineMap.get(entry.discipline);

    if (!teacherId) {
      errors.push(`Profesor no encontrado: ${entry.teacher}`);
      continue;
    }
    if (!gradeId) {
      errors.push(`Grado no encontrado: ${entry.grade}`);
      continue;
    }
    if (!discExists) {
      errors.push(`Disciplina no encontrada: ${entry.discipline}`);
      continue;
    }

    if (dryRun) {
      assignmentsCreated++;
      assignmentSchedulesCreated += entry.scheduleKeys.length;
      continue;
    }

    try {
      const existing = await first<AssignmentRow>(await sql`SELECT "idAsignacion", "estado" FROM "ExtracurricularAssignment" WHERE "idProfesor" = ${teacherId} AND "codigoDisciplina" = ${entry.discipline} AND "idGrado" = ${gradeId} LIMIT 1`);

      let assignmentId: string;
      if (existing) {
        assignmentId = existing.idAsignacion;
        if (existing.estado === "inactivo") {
          await sql`UPDATE "ExtracurricularAssignment" SET "estado" = 'activo' WHERE "idAsignacion" = ${existing.idAsignacion}`;
          assignmentsReactivated++;
          console.log(`   ↻ ${entry.teacher} + ${entry.discipline} + G${entry.grade} (reactivada)`);
        } else {
          skipped++;
        }
      } else {
        const rows = await sql`INSERT INTO "ExtracurricularAssignment" ("idProfesor", "codigoDisciplina", "idGrado") VALUES (${teacherId}, ${entry.discipline}, ${gradeId}) RETURNING "idAsignacion"`;
        const created = rows[0] as unknown as { idAsignacion: string };
        assignmentId = created.idAsignacion;
        assignmentsCreated++;
        console.log(`   + ${entry.teacher} + ${entry.discipline} + G${entry.grade}`);
      }

      for (const sKey of entry.scheduleKeys) {
        const horarioId = scheduleMap.get(sKey);
        if (!horarioId) {
          errors.push(`Schedule no encontrado: ${sKey} para ${entry.teacher} + ${entry.discipline}`);
          continue;
        }

        const existingLink = await first<AssignmentLinkRow>(await sql`SELECT "idAsignacion" FROM "AssignmentSchedule" WHERE "idAsignacion" = ${assignmentId} AND "idHorario" = ${horarioId} LIMIT 1`);

        if (!existingLink) {
          await sql`INSERT INTO "AssignmentSchedule" ("idAsignacion", "idHorario") VALUES (${assignmentId}, ${horarioId})`;
          assignmentSchedulesCreated++;
        }
      }
    } catch (err) {
      errors.push(`Error: ${entry.teacher} + ${entry.discipline} + ${entry.grade}: ${err}`);
    }
  }

  // Report
  console.log(`\n${"=".repeat(60)}`);
  console.log("REPORTE DE IMPORTACIÓN DE OFERTA");
  console.log(`${"=".repeat(60)}`);
  console.log(`\nProfesores:           ${teachersCreated} creados, ${teachersExisting} ya existían`);
  console.log(`Horarios:             ${schedulesCreated} creados, ${schedulesExisting} ya existían`);
  console.log(`Asignaciones:         ${assignmentsCreated} nuevas, ${assignmentsReactivated} reactivadas, ${skipped} ya existentes`);
  console.log(`Schedule links:       ${assignmentSchedulesCreated} creados`);

  if (errors.length > 0) {
    console.log(`\nErrores (${errors.length}):`);
    for (const e of errors) console.log(`  ❌ ${e}`);
  }

  console.log(`\n${"=".repeat(60)}`);
  if (dryRun) {
    console.log("MODO DRY-RUN — Ninguna modificación realizada");
  } else if (errors.length > 0) {
    console.log("IMPORTACIÓN DE OFERTA FINALIZADA CON ERRORES");
  } else {
    console.log("IMPORTACIÓN DE OFERTA COMPLETADA");
  }
  console.log(`${"=".repeat(60)}\n`);

  if (!dryRun && errors.length > 0) {
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error("Error fatal:", e);
    process.exit(1);
  });
