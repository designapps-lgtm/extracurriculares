import path from "path";
import { readExcel } from "../excel/excelReader";
import { validateRows } from "../excel/excelValidator";
import { mapStudents } from "../excel/excelMapper";
import { importStudents } from "../excel/studentImporter";

const dryRun = process.argv.includes("--dry-run");
const excelPath = process.env.EXCEL_PATH || "/app/Extracurriculares_base.xlsx";

async function main() {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`IMPORTADOR DE ESTUDIANTES — ${dryRun ? "MODO DRY-RUN" : "MODO REAL"}`);
  console.log(`${"=".repeat(60)}`);
  console.log(`Archivo: ${excelPath}\n`);

  // 1. Read Excel
  console.log("1. Leyendo Excel...");
  const rows = readExcel(excelPath);
  console.log(`   Filas válidas: ${rows.length}`);

  // 2. Validate
  console.log("\n2. Validando datos...");
  const { valid, errors, duplicateBarcodes } = validateRows(rows);
  console.log(`   Válidas: ${valid.length}`);
  console.log(`   Errores de validación: ${errors.length}`);
  console.log(`   Duplicados: ${duplicateBarcodes.length}`);

  if (errors.length > 0) {
    console.log("\n   Errores encontrados:");
    for (const e of errors.slice(0, 10)) {
      console.log(`     Fila ${e.row} | ${e.codigoEstudiante} | ${e.field}: ${e.error}`);
    }
  }

  // 3. Map
  console.log("\n3. Mapeando datos...");
  const students = mapStudents(valid);
  console.log(`   Estudiantes mapeados: ${students.length}`);

  const totalSchedules = students.reduce((acc, s) => acc + s.schedules.length, 0);
  console.log(`   Total actividades: ${totalSchedules}`);

  // 4. Import
  console.log(`\n4. ${dryRun ? "Simulando" : "Ejecutando"} importación...`);
  const result = await importStudents(students, dryRun);

  // 5. Report
  console.log(`\n${"=".repeat(60)}`);
  console.log("REPORTE DE IMPORTACIÓN");
  console.log(`${"=".repeat(60)}`);

  console.log(`\nEstudiantes:`);
  console.log(`  Procesados:  ${result.processed}`);
  console.log(`  Nuevos:       ${result.created}`);
  console.log(`  Modificados:  ${result.updated}`);
  console.log(`  Ausentes del Excel: ${result.absent}`);

  if (result.absentStudents.length > 0) {
    console.log(`\n  Estudiantes en BD pero no en Excel:`);
    for (const s of result.absentStudents.slice(0, 10)) {
      console.log(`    ${s}`);
    }
    if (result.absentStudents.length > 10) {
      console.log(`    ... y ${result.absentStudents.length - 10} más`);
    }
  }

  console.log(`\nActividades:`);
  console.log(`  Nuevas:       ${result.activitiesCreated}`);
  console.log(`  Modificadas:  ${result.activitiesModified}`);
  console.log(`  Eliminadas:   ${result.activitiesDeleted}`);

  console.log(`\nGrados:`);
  console.log(`  Total únicos: ${result.gradeNames.size}`);
  console.log(`  Nuevos: ${result.newGrades.length} → ${result.newGrades.sort().join(", ") || "ninguno"}`);

  console.log(`\nDisciplinas:`);
  console.log(`  Total únicas: ${result.disciplineCodes.size}`);
  console.log(`  Nuevas: ${result.newDisciplines.length}`);
  if (result.newDisciplines.length > 0) {
    for (const d of result.newDisciplines.sort().slice(0, 10)) {
      console.log(`    ${d}`);
    }
    if (result.newDisciplines.length > 10) {
      console.log(`    ... y ${result.newDisciplines.length - 10} más`);
    }
  }

  if (result.errorDetails.length > 0) {
    console.log(`\nErrores (${result.errorDetails.length}):`);
    for (const e of result.errorDetails.slice(0, 10)) {
      console.log(`  Fila ${e.row} | ${e.codigo} | ${e.error}`);
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  if (dryRun) {
    console.log("MODO DRY-RUN — Ninguna modificación realizada");
  } else if (result.errorDetails.length > 0) {
    console.log("IMPORTACIÓN FINALIZADA CON ERRORES");
  } else {
    console.log("IMPORTACIÓN COMPLETADA");
  }
  console.log(`${"=".repeat(60)}\n`);

  if (dryRun && errors.length > 0) {
    console.error("Validación con errores: revise las filas marcadas antes de importar en modo real");
    process.exit(1);
  }
  if (!dryRun && result.errorDetails.length > 0) {
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error("Error fatal:", e);
    process.exit(1);
  });
