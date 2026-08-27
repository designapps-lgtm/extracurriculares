import * as XLSX from "xlsx";

const filePath = "/app/Extracurriculares_base.xlsx";
const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets["Base"];
const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

console.log(`\n📊 ANÁLISIS DETALLADO — HOJA "Base" (${data.length} filas)\n`);

// 1. BARCODE analysis
console.log("=".repeat(60));
console.log("1. BARCODE (código estudiante)");
console.log("=".repeat(60));
const barcodes = data.map((r) => String(r["BARCODE"] || "").trim()).filter(Boolean);
const uniqueBarcodes = new Set(barcodes);
const emptyBarcodes = data.length - barcodes.length;
console.log(`Total filas: ${data.length}`);
console.log(`Vacíos: ${emptyBarcodes}`);
console.log(`Con valor: ${barcodes.length}`);
console.log(`Únicos: ${uniqueBarcodes.size}`);
console.log(`Duplicados: ${barcodes.length - uniqueBarcodes.size}`);
// Find duplicates
const barcodeCount = new Map<string, number[]>();
barcodes.forEach((b, i) => {
  if (!barcodeCount.has(b)) barcodeCount.set(b, []);
  barcodeCount.get(b)!.push(i + 2); // +2 for Excel row (1-indexed + header)
});
const dupes = [...barcodeCount.entries()].filter(([, rows]) => rows.length > 1);
if (dupes.length > 0) {
  console.log(`\n⚠️ DUPLICADOS:`);
  dupes.slice(0, 10).forEach(([code, rows]) => {
    const row1 = data[rows[0] - 2];
    const row2 = data[rows[1] - 2];
    console.log(`  ${code} — Filas ${rows.join(", ")}`);
    console.log(`    Fila ${rows[0]}: ${row1["FIRST NAME"]} ${row1["LAST NAME"]} — Grado ${row1["GRADE"]}`);
    console.log(`    Fila ${rows[1]}: ${row2["FIRST NAME"]} ${row2["LAST NAME"]} — Grado ${row2["GRADE"]}`);
  });
}
console.log(`\nMuestra de códigos: ${[...uniqueBarcodes].slice(0, 10).join(", ")}`);

// 2. ID_NUMBER analysis
console.log("\n" + "=".repeat(60));
console.log("2. ID_NUMBER (cédula/identificación)");
console.log("=".repeat(60));
const idNumbers = data.map((r) => String(r["ID_NUMBER"] || "").trim()).filter(Boolean);
const uniqueIds = new Set(idNumbers);
const emptyIds = data.length - idNumbers.length;
console.log(`Vacíos: ${emptyIds}`);
console.log(`Únicos: ${uniqueIds.size}`);
const idCount = new Map<string, number[]>();
idNumbers.forEach((id, i) => {
  if (!idCount.has(id)) idCount.set(id, []);
  idCount.get(id)!.push(i + 2);
});
const idDupes = [...idCount.entries()].filter(([, rows]) => rows.length > 1);
console.log(`Duplicados: ${idDupes.length}`);
if (idDupes.length > 0) {
  idDupes.slice(0, 5).forEach(([id, rows]) => {
    console.log(`  ID ${id} — Filas ${rows.join(", ")}`);
  });
}
console.log(`Muestra: ${[...uniqueIds].slice(0, 8).join(", ")}`);

// 3. Names analysis
console.log("\n" + "=".repeat(60));
console.log("3. NOMBRES");
console.log("=".repeat(60));
const firstNames = data.map((r) => String(r["FIRST NAME"] || "").trim());
const lastNames = data.map((r) => String(r["LAST NAME"] || "").trim());
const fullNames = data.map((r) => String(r["FULL_NAME"] || "").trim());

console.log(`\nFIRST NAME — vacíos: ${firstNames.filter((n) => !n).length}`);
console.log(`LAST NAME — vacíos: ${lastNames.filter((n) => !n).length}`);
console.log(`FULL_NAME — vacíos: ${fullNames.filter((n) => !n).length}`);

console.log(`\nMuestra LAST NAME (primeros 20 no vacíos):`);
const sampleLast = lastNames.filter(Boolean).slice(0, 20);
sampleLast.forEach((n) => console.log(`  "${n}"`));

console.log(`\nMuestra FULL_NAME (primeros 20 no vacíos):`);
const sampleFull = fullNames.filter(Boolean).slice(0, 20);
sampleFull.forEach((n) => console.log(`  "${n}"`));

// Check if FULL_NAME = LAST NAME + FIRST NAME
console.log(`\nVerificación FULL_NAME = LAST NAME + FIRST NAME:`);
let matchCount = 0;
let mismatchCount = 0;
let emptyFullCount = 0;
data.forEach((r) => {
  const last = String(r["LAST NAME"] || "").trim();
  const first = String(r["FIRST NAME"] || "").trim();
  const full = String(r["FULL_NAME"] || "").trim();
  if (!full) { emptyFullCount++; return; }
  const expected = `${last} ${first}`.trim();
  if (full === expected) matchCount++;
  else mismatchCount++;
});
console.log(`  Coinciden: ${matchCount}`);
console.log(`  No coinciden: ${mismatchCount}`);
console.log(`  FULL_NAME vacío: ${emptyFullCount}`);

// Show mismatches
if (mismatchCount > 0) {
  console.log(`\n  Ejemplos que NO coinciden:`);
  let shown = 0;
  for (const r of data) {
    if (shown >= 5) break;
    const last = String(r["LAST NAME"] || "").trim();
    const first = String(r["FIRST NAME"] || "").trim();
    const full = String(r["FULL_NAME"] || "").trim();
    if (!full || `${last} ${first}`.trim() === full) continue;
    console.log(`    LAST="${last}" + FIRST="${first}" → FULL="${full}"`);
    shown++;
  }
}

// 4. GRADE analysis
console.log("\n" + "=".repeat(60));
console.log("4. GRADE");
console.log("=".repeat(60));
const grades = data.map((r) => String(r["GRADE"] || "").trim()).filter(Boolean);
const gradeCount = new Map<string, number>();
grades.forEach((g) => gradeCount.set(g, (gradeCount.get(g) || 0) + 1));
console.log(`Valores únicos: ${[...gradeCount.keys()].join(", ")}`);
console.log(`\nDistribución:`);
[...gradeCount.entries()]
  .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
  .forEach(([g, c]) => console.log(`  ${g.padEnd(6)} — ${c} estudiantes`));

// 5. HOMEROOM analysis
console.log("\n" + "=".repeat(60));
console.log("5. HOMEROOM (¿posible grupo?)");
console.log("=".repeat(60));
const homerooms = data.map((r) => String(r["HOMEROOM"] || "").trim()).filter(Boolean);
const homeroomCount = new Map<string, number>();
homerooms.forEach((h) => homeroomCount.set(h, (homeroomCount.get(h) || 0) + 1));
console.log(`Valores únicos: ${homeroomCount.size}`);
console.log(`\nDistribución:`);
[...homeroomCount.entries()]
  .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
  .forEach(([h, c]) => console.log(`  ${h.padEnd(8)} — ${c} estudiantes`));

// 6. Discipline columns (daily schedule)
console.log("\n" + "=".repeat(60));
console.log("6. DISCIPLINAS POR DÍA (CC_*)");
console.log("=".repeat(60));
const dayCols = ["CC_LUNES", "CC_MARTES", "CC_MIERCOLES", "CC_JUEVES", "CC_VIERNES", "CC_SABADO"];

for (const col of dayCols) {
  const vals = data.map((r) => String(r[col] || "").trim()).filter(Boolean);
  const unique = [...new Set(vals)];
  console.log(`\n${col}: ${vals.length} con actividad / ${data.length - vals.length} vacíos`);
  console.log(`  Valores únicos (${unique.length}): ${unique.slice(0, 15).join(", ")}${unique.length > 15 ? "..." : ""}`);
}

// 7. Cross-analysis: students with activities on multiple days
console.log("\n" + "=".repeat(60));
console.log("7. CRUCE: Actividades por estudiante");
console.log("=".repeat(60));

// Parse discipline codes
const disciplinePattern = /^XC_(.+?)_(.+)$/;
const allDisciplineCodes = new Set<string>();
const studentSchedules = new Map<string, Map<string, string>>(); // barcode → day → code

data.forEach((r) => {
  const barcode = String(r["BARCODE"] || "").trim();
  if (!barcode) return;
  if (!studentSchedules.has(barcode)) studentSchedules.set(barcode, new Map());
  for (const day of dayCols) {
    const val = String(r[day] || "").trim();
    if (val) {
      studentSchedules.get(barcode)!.set(day, val);
      allDisciplineCodes.add(val);
    }
  }
});

console.log(`\nCódigos de disciplina encontrados (${allDisciplineCodes.size}):`);
[...allDisciplineCodes].sort().forEach((c) => console.log(`  ${c}`));

// Parse discipline components
console.log(`\nAnálisis de estructura XC_[GRADO]_[DISCIPLINA]:`);
const parsedDisciplines = new Map<string, Set<string>>(); // grade → disciplines
[...allDisciplineCodes].forEach((code) => {
  const match = code.match(disciplinePattern);
  if (match) {
    const [, grade, discipline] = match;
    if (!parsedDisciplines.has(grade)) parsedDisciplines.set(grade, new Set());
    parsedDisciplines.get(grade)!.add(discipline);
  }
});

console.log(`\nPor grado:`);
[...parsedDisciplines.entries()]
  .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
  .forEach(([grade, disciplines]) => {
    console.log(`  ${grade}: ${[...disciplines].sort().join(", ")}`);
  });

// 8. Students with NO discipline on ANY day
console.log("\n" + "=".repeat(60));
console.log("8. ESTUDIANTES SIN NINGUNA ACTIVIDAD");
console.log("=".repeat(60));
let noActivity = 0;
data.forEach((r) => {
  const barcode = String(r["BARCODE"] || "").trim();
  if (!barcode) return;
  const sched = studentSchedules.get(barcode);
  if (!sched || sched.size === 0) noActivity++;
});
console.log(`Estudiantes sin actividad en ningún día: ${noActivity}`);

// 9. Students with SAME discipline every day vs DIFFERENT
console.log("\n" + "=".repeat(60));
console.log("9. PATRONES DE DISCIPLINA POR ESTUDIANTE");
console.log("=".repeat(60));
let sameEveryDay = 0;
let differentDays = 0;
let someDaysOnly = 0;

const patternExamples: { same: string[]; different: string[]; some: string[] } = { same: [], different: [], some: [] };

data.forEach((r) => {
  const barcode = String(r["BARCODE"] || "").trim();
  if (!barcode) return;
  const sched = studentSchedules.get(barcode);
  if (!sched) return;

  const activities = [...sched.values()];
  const uniqueActivities = new Set(activities);

  if (sched.size < 6) {
    someDaysOnly++;
    if (patternExamples.some.length < 3) {
      const name = `${r["FIRST NAME"]} ${r["LAST NAME"]}`;
      patternExamples.some.push(`${name} (${barcode}): ${activities.join(", ")}`);
    }
  } else if (uniqueActivities.size === 1) {
    sameEveryDay++;
    if (patternExamples.same.length < 3) {
      const name = `${r["FIRST NAME"]} ${r["LAST NAME"]}`;
      patternExamples.same.push(`${name} (${barcode}): ${[...uniqueActivities][0]}`);
    }
  } else {
    differentDays++;
    if (patternExamples.different.length < 3) {
      const name = `${r["FIRST NAME"]} ${r["LAST NAME"]}`;
      const dayActivity = dayCols.map((d) => `${d.replace("CC_", "").substring(0, 3)}=${sched.get(d) || "-"}`).join(", ");
      patternExamples.different.push(`${name} (${barcode}): ${dayActivity}`);
    }
  }
});

console.log(`Misma actividad todos los días: ${sameEveryDay}`);
patternExamples.same.forEach((e) => console.log(`  Ej: ${e}`));
console.log(`\nActividades diferentes por día: ${differentDays}`);
patternExamples.different.forEach((e) => console.log(`  Ej: ${e}`));
console.log(`\nSolo algunos días con actividad: ${someDaysOnly}`);
patternExamples.some.forEach((e) => console.log(`  Ej: ${e}`));

// 10. GENDER analysis
console.log("\n" + "=".repeat(60));
console.log("10. GÉNERO");
console.log("=".repeat(60));
const genders = data.map((r) => String(r["GENDER"] || "").trim());
const genderCount = new Map<string, number>();
genders.forEach((g) => genderCount.set(g, (genderCount.get(g) || 0) + 1));
[...genderCount.entries()].forEach(([g, c]) => console.log(`  "${g}": ${c}`));

// 11. UNIQUE_ID analysis (possible internal ID)
console.log("\n" + "=".repeat(60));
console.log("11. UNIQUE_ID (¿ID interno del sistema?)");
console.log("=".repeat(60));
const uniqueIds2 = data.map((r) => String(r["UNIQUE_ID"] || "").trim()).filter(Boolean);
const uniqueSet2 = new Set(uniqueIds2);
const emptyUid = data.length - uniqueIds2.length;
console.log(`Vacíos: ${emptyUid}`);
console.log(`Únicos: ${uniqueSet2.size}`);
console.log(`Muestra: ${[...uniqueSet2].slice(0, 10).join(", ")}`);

// 12. Relación BARCODE vs ID_NUMBER vs UNIQUE_ID
console.log("\n" + "=".repeat(60));
console.log("12. RELACIÓN BARCODE ↔ ID_NUMBER ↔ UNIQUE_ID");
console.log("=".repeat(60));
const sample20 = data.slice(0, 20);
sample20.forEach((r) => {
  const bc = String(r["BARCODE"] || "").trim();
  const idn = String(r["ID_NUMBER"] || "").trim();
  const uid = String(r["UNIQUE_ID"] || "").trim();
  const name = `${r["FIRST NAME"]} ${r["LAST NAME"]}`;
  console.log(`  ${name.padEnd(30)} BARCODE=${bc.padEnd(10)} ID=${idn.padEnd(12)} UNIQUE_ID=${uid}`);
});

// 13. FECHA_MATRICULA
console.log("\n" + "=".repeat(60));
console.log("13. FECHA_MATRICULA (fecha Excel serial)");
console.log("=".repeat(60));
const fechas = data.map((r) => r["FECHA_MATRICULA"]).filter((f) => f !== "" && f !== null);
const sampleFechas = fechas.slice(0, 5);
console.log(`Muestra de valores serial: ${sampleFechas.join(", ")}`);
// Excel serial to date
sampleFechas.forEach((f) => {
  if (typeof f === "number") {
    const date = new Date((f - 25569) * 86400 * 1000);
    console.log(`  ${f} → ${date.toISOString().split("T")[0]}`);
  }
});

console.log("\n✅ Análisis detallado completado.");
