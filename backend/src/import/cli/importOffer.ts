import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
  // TODO: Confirmar con usuario si "Carlos Pinillo" y "Carlos Pinillos" son la misma persona.
  // Usando "Carlos Pinillo" como nombre canónico.
  { nombre: "Carlos", apellido: "Pinillo" },
  { nombre: "Cristian", apellido: "Mosquera" },
  { nombre: "Sebastián", apellido: "Saldarriaga" },
  // Nuevos (hojas KINDER/PRIMARIA/SECUNDARIA)
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
  S11: { diaSemana: "SABADO",     horaInicio: null,    horaFin: null },     // "Según programación de partidos"
  S12: { diaSemana: "LUNES",      horaInicio: "15:15", horaFin: "17:15" },  // Robótica, Olimpiadas, Artes, Técnica Vocal, Banda TR
  S13: { diaSemana: "JUEVES",     horaInicio: "15:15", horaFin: "17:15" },  // Des. Instrumental, Danza, Pequeños Científicos, Robótica LEGO, Banda Horizon, Artes SEC
  S14: { diaSemana: "MARTES",     horaInicio: "14:30", horaFin: "16:00" },  // Iniciación Musical K5 / Danzas K4
  S15: { diaSemana: "VIERNES",    horaInicio: "14:30", horaFin: "16:00" },  // Danzas K5 / Iniciación Musical K4
};

// ==========================================
// OFFER: each entry = teacher + discipline + grade + schedule keys
// ==========================================
interface OfferEntry {
  teacher: string;          // "Nombre Apellido"
  discipline: string;       // codigoDisciplina
  grade: string;            // Grade.nombre
  scheduleKeys: string[];   // ["S4", "S5", "S6"]
}

const OFFER: OfferEntry[] = [
  // ========== KINDER (hoja KINDER) ==========

  // K4 Fútbol (Mié 1:00-2:30)
  { teacher: "Javier Morales",      discipline: "XC_K4_Futbol",        grade: "K4", scheduleKeys: ["S1"] },
  { teacher: "Cristian Echeverry",  discipline: "XC_K4_Futbol",        grade: "K4", scheduleKeys: ["S1"] },
  // K4 Polimotor (Mié 1:00-2:30)
  { teacher: "Isaí Toro",           discipline: "XC_K4_Polimotor",     grade: "K4", scheduleKeys: ["S1"] },
  { teacher: "Stefania Tabares",    discipline: "XC_K4_Polimotor",     grade: "K4", scheduleKeys: ["S1"] },
  // K4 Iniciación a Danzas (Mar 2:30-4)
  { teacher: "Luisa Granada",       discipline: "XC_K4_IniciaDanzas",  grade: "K4", scheduleKeys: ["S14"] },
  // K4 Iniciación Musical (Vie 2:30-4)
  { teacher: "Juan Carlos Ortiz",   discipline: "XC_K4_IniciaMusical", grade: "K4", scheduleKeys: ["S15"] },
  // K5 Fútbol (Lun + Jue 2:30-4)
  { teacher: "Javier Morales",      discipline: "XC_K5_Futbol",        grade: "K5", scheduleKeys: ["S2", "S3"] },
  { teacher: "Andrés Gómez",        discipline: "XC_K5_Futbol",        grade: "K5", scheduleKeys: ["S2", "S3"] },
  // K5 Polimotor (Lun + Jue 2:30-4)
  { teacher: "Isaí Toro",           discipline: "XC_K5_Polimotor",     grade: "K5", scheduleKeys: ["S2", "S3"] },
  { teacher: "Stefania Tabares",    discipline: "XC_K5_Polimotor",     grade: "K5", scheduleKeys: ["S2", "S3"] },
  // K5 Iniciación Musical (Mar 2:30-4)
  { teacher: "Juan Carlos Ortiz",   discipline: "XC_K5_IniciaMusical", grade: "K5", scheduleKeys: ["S14"] },
  // K5 Iniciación a Danzas (Vie 2:30-4)
  { teacher: "Luisa Granada",       discipline: "XC_K5_IniciaDanzas",  grade: "K5", scheduleKeys: ["S15"] },

  // ========== PRIMARIA (hoja PRIMARIA) ==========

  // Entrenamiento olimpiadas Matemáticas 4-5 (Lun 3:15-5:15)
  { teacher: "Alejandra Ramírez",   discipline: "XC_45_OlympMath",  grade: "4",  scheduleKeys: ["S12"] },
  { teacher: "Alejandra Ramírez",   discipline: "XC_45_OlympMath",  grade: "5",  scheduleKeys: ["S12"] },
  // Artes plásticas 1-5 (Lun 3:15-5:15) — 3 profesores × 5 grados
  ...["1", "2", "3", "4", "5"].flatMap((g) => [
    { teacher: "Liliana Niño",      discipline: "XC_EL_ArtesPlasticas", grade: g, scheduleKeys: ["S12"] },
    { teacher: "Mateo Brito",       discipline: "XC_EL_ArtesPlasticas", grade: g, scheduleKeys: ["S12"] },
    { teacher: "Jazmín López",      discipline: "XC_EL_ArtesPlasticas", grade: g, scheduleKeys: ["S12"] },
  ]),
  // Técnica Vocal 1-5 (Lun 3:15-5:15)
  ...["1", "2", "3", "4", "5"].map((g) => (
    { teacher: "Juan Carlos Ortiz", discipline: "XC_EL_TecVocal",       grade: g, scheduleKeys: ["S12"] }
  )),
  // 1° Fútbol (Mar/vie/sáb 3:15-5:15)
  { teacher: "Javier Morales",      discipline: "XC_1_Futbol_M",        grade: "1",  scheduleKeys: ["S4", "S5", "S6"] },
  // 2-3° Fútbol (Mar/vie/sáb)
  { teacher: "Sebastián Echeverry", discipline: "XC_23_Futbol_M",       grade: "2",  scheduleKeys: ["S4", "S5", "S6"] },
  { teacher: "Luis Eduardo Martínez", discipline: "XC_23_Futbol_M",     grade: "3",  scheduleKeys: ["S4", "S5", "S6"] },
  // 4° Fútbol
  { teacher: "Andrés Gómez",        discipline: "XC_4_Futbol_M",        grade: "4",  scheduleKeys: ["S4", "S5", "S6"] },
  // 5° Fútbol
  { teacher: "Javier Morales",      discipline: "XC_5_Futbol_M",        grade: "5",  scheduleKeys: ["S4", "S5", "S6"] },
  // Fútbol femenino 1-5 (Mar/vie/sáb)
  ...["1", "2", "3", "4", "5"].map((g) => (
    { teacher: "Óscar López",       discipline: "XC_EL_Futbol_F",       grade: g, scheduleKeys: ["S4", "S5", "S6"] }
  )),
  // Baloncesto 1-3 (Mar/vie/sáb)
  ...["1", "2", "3"].map((g) => (
    { teacher: "Mauricio Lozano",   discipline: "XC_123_Basquetbol",    grade: g, scheduleKeys: ["S4", "S5", "S6"] }
  )),
  // Baloncesto 4-5 (Mar/vie/sáb)
  ...["4", "5"].map((g) => (
    { teacher: "Yamid Gómez",       discipline: "XC_45_Basquetbol",     grade: g, scheduleKeys: ["S4", "S5", "S6"] }
  )),
  // 1° Voleibol (Mar/vie/sáb)
  { teacher: "Anderson Buitrago",   discipline: "XC_1_Voleibol",        grade: "1",  scheduleKeys: ["S4", "S5", "S6"] },
  // 2-3° Voleibol (Mar/vie/sáb)
  ...["2", "3"].map((g) => (
    { teacher: "Vanessa Castellanos", discipline: "XC_23_Voleibol",     grade: g, scheduleKeys: ["S4", "S5", "S6"] }
  )),
  // 4-5° Voleibol (Mar/vie/sáb)
  ...["4", "5"].map((g) => (
    { teacher: "Carlos Pinillo",    discipline: "XC_45_Voleibol",       grade: g, scheduleKeys: ["S4", "S5", "S6"] }
  )),
  // Porrismo 1-5 (Mar, Mié 2:00-4, Vie) — 2 profesores × 5 grados
  ...["1", "2", "3", "4", "5"].flatMap((g) => [
    { teacher: "Isaí Toro",         discipline: "XC_EL_Porras",         grade: g, scheduleKeys: ["S4", "S5", "S7"] },
    { teacher: "Stefania Tabares",  discipline: "XC_EL_Porras",         grade: g, scheduleKeys: ["S4", "S5", "S7"] },
  ]),
  // Taekwondo 1-5 (Mar, Mié 2:00-4, Vie)
  ...["1", "2", "3", "4", "5"].map((g) => (
    { teacher: "Cristian Mosquera", discipline: "XC_EL_Taekwondo",      grade: g, scheduleKeys: ["S4", "S5", "S7"] }
  )),
  // Desarrollo Instrumental 1-5 (Jue 3:15-5:15) — Juan Carlos Ortiz + Juan David Calvo
  ...["1", "2", "3", "4", "5"].flatMap((g) => [
    { teacher: "Juan Carlos Ortiz", discipline: "XC_EL_DesaInstrumental", grade: g, scheduleKeys: ["S13"] },
    { teacher: "Juan David Calvo",  discipline: "XC_EL_DesaInstrumental", grade: g, scheduleKeys: ["S13"] },
  ]),
  // Danza Moderna 1-5 (Jue 3:15-5:15)
  ...["1", "2", "3", "4", "5"].map((g) => (
    { teacher: "Luisa Granada",     discipline: "XC_EL_DanzaModerna",   grade: g, scheduleKeys: ["S13"] }
  )),
  // Pequeños científicos 1° y 3° (Jue 3:15-5:15)
  { teacher: "Julián Vargas",       discipline: "XC_EL_PequenosCientificos", grade: "1", scheduleKeys: ["S13"] },
  { teacher: "Julián Vargas",       discipline: "XC_EL_PequenosCientificos", grade: "3", scheduleKeys: ["S13"] },
  // Robótica y LEGO 4-5 (Jue 3:15-5:15)
  ...["4", "5"].map((g) => (
    { teacher: "Juan José Ramírez", discipline: "XC_Robo_Lego",         grade: g, scheduleKeys: ["S13"] }
  )),

  // ========== SECUNDARIA (hoja SECUNDARIA) ==========

  // Robótica 6° y 12° (Lun 3:15-5:15) — solo grados 6 y 12
  { teacher: "Juan José Ramírez", discipline: "XC_SEC_ProgRobot",     grade: "6",  scheduleKeys: ["S12"] },
  { teacher: "Juan José Ramírez", discipline: "XC_SEC_ProgRobot",     grade: "12", scheduleKeys: ["S12"] },
  // Banda Thunder Rock 8° (Lun 3:15-5:15)
  { teacher: "Mauricio Porras",     discipline: "XC_MS_BandaTR",        grade: "8",  scheduleKeys: ["S12"] },
  // Banda Fireworks 7° (Mar 3:15-5:15)
  { teacher: "Mauricio Porras",     discipline: "XC_SEC_BandaFW",       grade: "7",  scheduleKeys: ["S4"] },
  // Olimpiadas Matemáticas 6° y 12° (Mar 3:15-5:15) — solo grados 6 y 12
  { teacher: "Alejandra Ramírez", discipline: "XC_SEC_OlympMath", grade: "6",  scheduleKeys: ["S4"] },
  { teacher: "Alejandra Ramírez", discipline: "XC_SEC_OlympMath", grade: "12", scheduleKeys: ["S4"] },
  // MS Fútbol 6-8 (Lun 3:30-5:30, Mié 2:20-4:20, Jue 3:30-5:30, Sáb partidos)
  ...["6", "7", "8"].map((g) => (
    { teacher: "Luis Eduardo Martínez", discipline: "XC_MS_Futbol_M",   grade: g, scheduleKeys: ["S8", "S10", "S9", "S11"] }
  )),
  // HS Fútbol 9-12 (mismos días)
  ...["9", "10", "11", "12"].map((g) => (
    { teacher: "Sebastián Saldarriaga", discipline: "XC_HS_Futbol_M",   grade: g, scheduleKeys: ["S8", "S10", "S9", "S11"] }
  )),
  // Fútbol Femenino 6-12 (mismos días)
  ...["6", "7", "8", "9", "10", "11", "12"].map((g) => (
    { teacher: "Óscar López",       discipline: "XC_SEC_Futbol_F",      grade: g, scheduleKeys: ["S8", "S10", "S9", "S11"] }
  )),
  // MS Voleibol 6-8 (mismos días)
  ...["6", "7", "8"].map((g) => (
    { teacher: "Vanessa Castellanos", discipline: "XC_MS_Voleibol_F",   grade: g, scheduleKeys: ["S8", "S10", "S9", "S11"] }
  )),
  // HS Voleibol 9-12 (mismos días)
  ...["9", "10", "11", "12"].map((g) => (
    { teacher: "Carlos Pinillo",    discipline: "XC_HS_Voleibol_F",     grade: g, scheduleKeys: ["S8", "S10", "S9", "S11"] }
  )),
  // SEC Baloncesto 6-12 (mismos días)
  ...["6", "7", "8", "9", "10", "11", "12"].map((g) => (
    { teacher: "Yamid Gómez",       discipline: "XC_SEC_Basquetbol",    grade: g, scheduleKeys: ["S8", "S10", "S9", "S11"] }
  )),
  // Banda Horizon 9-10 (Jue 3:15-5:15)
  ...["9", "10"].map((g) => (
    { teacher: "Mauricio Porras",   discipline: "XC_90_BandaHorz",      grade: g, scheduleKeys: ["S13"] }
  )),
  // Artes plásticas 6-12 (Jue 3:15-5:15)
  ...["6", "7", "8", "9", "10", "11", "12"].map((g) => (
    { teacher: "Liliana Niño",      discipline: "XC_SEC_ArtesPlasticas", grade: g, scheduleKeys: ["S13"] }
  )),
  // Banda Inside (Vie 3:15-5:15) — "HS" = 9-12
  ...["9", "10", "11", "12"].map((g) => (
    { teacher: "Juan David Calvo",  discipline: "XC_HS_BandaInside",    grade: g, scheduleKeys: ["S5"] }
  )),
];

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  console.log(`\n${"=".repeat(60)}`);
  console.log(`IMPORTADOR DE OFERTA — ${dryRun ? "MODO DRY-RUN" : "MODO REAL"}`);
  console.log(`${"=".repeat(60)}\n`);

  // 0. Validate offer (grades + disciplines) BEFORE writing anything
  console.log("0. Validando oferta (grados y disciplinas):");
  const gradeMap = new Map<string, number>(); // "K4" → idGrado
  const uniqueGrades = [...new Set(OFFER.map((o) => o.grade))];
  const missingGrades: string[] = [];

  for (const g of uniqueGrades) {
    const grade = await prisma.grade.findFirst({ where: { nombre: g } });
    if (grade) {
      gradeMap.set(g, grade.idGrado);
      console.log(`   ✓ ${g} → idGrado ${grade.idGrado}`);
    } else {
      missingGrades.push(g);
    }
  }

  const disciplineSet = new Set(OFFER.map((o) => o.discipline));
  const disciplineMap = new Map<string, boolean>(); // code → exists
  const missingDisciplines: string[] = [];

  for (const d of disciplineSet) {
    const disc = await prisma.discipline.findFirst({ where: { codigoDisciplina: d } });
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
  const teacherMap = new Map<string, string>(); // "Nombre Apellido" → idProfesor
  let teachersCreated = 0;
  let teachersExisting = 0;

  for (const t of TEACHERS) {
    const fullName = `${t.nombre} ${t.apellido}`;
    const existing = await prisma.teacher.findFirst({
      where: { nombre: t.nombre, apellido: t.apellido },
    });

    if (existing) {
      teacherMap.set(fullName, existing.idProfesor);
      teachersExisting++;
      console.log(`   ✓ ${fullName} (ya existe)`);
    } else if (!dryRun) {
      const created = await prisma.teacher.create({
        data: { nombre: t.nombre, apellido: t.apellido },
      });
      teacherMap.set(fullName, created.idProfesor);
      teachersCreated++;
      console.log(`   + ${fullName}`);
    } else {
      // In dry-run, create a placeholder entry so offer validation works
      teacherMap.set(fullName, `dry-run-${fullName}`);
      console.log(`   ~ ${fullName} (dry-run)`);
    }
  }

  // 2. Create schedules
  console.log("\n2. Horarios:");
  const scheduleMap = new Map<string, string>(); // S1 → idHorario
  let schedulesCreated = 0;
  let schedulesExisting = 0;

  for (const [key, sched] of Object.entries(SCHEDULES)) {
    const existing = await prisma.schedule.findFirst({
      where: {
        diaSemana: sched.diaSemana,
        horaInicio: sched.horaInicio,
        horaFin: sched.horaFin,
      },
    });

    if (existing) {
      scheduleMap.set(key, existing.idHorario);
      schedulesExisting++;
      console.log(`   ✓ ${key}: ${sched.diaSemana} ${sched.horaInicio || "NULL"}-${sched.horaFin || "NULL"} (ya existe)`);
    } else if (!dryRun) {
      const created = await prisma.schedule.create({ data: sched });
      scheduleMap.set(key, created.idHorario);
      schedulesCreated++;
      console.log(`   + ${key}: ${sched.diaSemana} ${sched.horaInicio || "NULL"}-${sched.horaFin || "NULL"}`);
    } else {
      // In dry-run, create a placeholder entry so offer validation works
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
      // Upsert assignment (idempotent via @@unique)
      const existing = await prisma.extracurricularAssignment.findFirst({
        where: {
          idProfesor: teacherId,
          codigoDisciplina: entry.discipline,
          idGrado: gradeId,
        },
      });

      let assignmentId: string;
      if (existing) {
        assignmentId = existing.idAsignacion;
        if (existing.estado === "inactivo") {
          await prisma.extracurricularAssignment.update({
            where: { idAsignacion: existing.idAsignacion },
            data: { estado: "activo" },
          });
          assignmentsReactivated++;
          console.log(`   ↻ ${entry.teacher} + ${entry.discipline} + G${entry.grade} (reactivada)`);
        } else {
          skipped++;
        }
      } else {
        const created = await prisma.extracurricularAssignment.create({
          data: {
            idProfesor: teacherId,
            codigoDisciplina: entry.discipline,
            idGrado: gradeId,
          },
        });
        assignmentId = created.idAsignacion;
        assignmentsCreated++;
        console.log(`   + ${entry.teacher} + ${entry.discipline} + G${entry.grade}`);
      }

      // Link schedules
      for (const sKey of entry.scheduleKeys) {
        const horarioId = scheduleMap.get(sKey);
        if (!horarioId) {
          errors.push(`Schedule no encontrado: ${sKey} para ${entry.teacher} + ${entry.discipline}`);
          continue;
        }

        // Idempotent via @@unique([idAsignacion, idHorario])
        const existingLink = await prisma.assignmentSchedule.findFirst({
          where: { idAsignacion: assignmentId, idHorario: horarioId },
        });

        if (!existingLink) {
          await prisma.assignmentSchedule.create({
            data: { idAsignacion: assignmentId, idHorario: horarioId },
          });
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