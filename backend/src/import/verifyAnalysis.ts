import * as XLSX from "xlsx";

const filePath = "/app/Extracurriculares_base.xlsx";
const workbook = XLSX.readFile(filePath);

// ============================================================
// 1. Check: can a student have multiple disciplines on SAME day?
// ============================================================
console.log("=".repeat(70));
console.log("1. ¿PUEDE UN ESTUDIANTE TENER MÚLTIPLES ACTIVIDADES EL MISMO DÍA?");
console.log("=".repeat(70));

const sheet = workbook.Sheets["Base"];
const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

const dayCols: Record<string, string> = {
  CC_LUNES: "LUNES",
  CC_MARTES: "MARTES",
  CC_MIERCOLES: "MIERCOLES",
  CC_JUEVES: "JUEVES",
  CC_VIERNES: "VIERNES",
  CC_SABADO: "SABADO",
};

// Each row = one student. Each CC_* column = one discipline per day.
// Since there's only ONE value per CC_* column per row, a student can only have
// ONE discipline per day (because each row has at most one value per day column).
// But let's verify there are no comma-separated values or multiple entries.

let multiDaySameDiscipline = 0;
let multiDayDiffDiscipline = 0;
let noActivity = 0;
let hasActivity = 0;
const dayCombinations = new Map<string, number>();

const studentDays = new Map<string, Map<string, string>>();

data.forEach((r) => {
  const barcode = String(r["BARCODE"] || "").trim();
  if (!barcode) return;

  const days = new Map<string, string>();
  for (const [col, day] of Object.entries(dayCols)) {
    const val = String(r[col] || "").trim();
    if (val) days.set(day, val);
  }

  studentDays.set(barcode, days);

  if (days.size === 0) {
    noActivity++;
    return;
  }
  hasActivity++;

  const disciplines = [...new Set(days.values())];
  if (disciplines.length === 1) {
    multiDaySameDiscipline++;
  } else {
    multiDayDiffDiscipline++;
  }

  // Track which days have which disciplines
  const pattern = [...days.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([d, disc]) => `${d.substring(0, 3)}=${disc}`)
    .join(", ");
  dayCombinations.set(pattern, (dayCombinations.get(pattern) || 0) + 1);
});

console.log(`\nEstudiantes con actividad: ${hasActivity}`);
console.log(`Estudiantes sin actividad: ${noActivity}`);
console.log(`\nMisma disciplina todos los días que tiene actividad: ${multiDaySameDiscipline}`);
console.log(`Disciplinas diferentes según el día: ${multiDayDiffDiscipline}`);

console.log(`\nCombinaciones de horario más comunes:`);
[...dayCombinations.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 15)
  .forEach(([pattern, count]) => {
    console.log(`  ${count.toString().padStart(4)}x — ${pattern}`);
  });

// ============================================================
// 2. Check: multiple activities on SAME day (per row)
// ============================================================
console.log("\n" + "=".repeat(70));
console.log("2. ¿HAY MÚLTIPLES ACTIVIDADES EN UNA SOLA COLUMNA DE DÍA?");
console.log("=".repeat(70));

let multiInCell = 0;
for (const col of Object.keys(dayCols)) {
  data.forEach((r, i) => {
    const val = String(r[col] || "").trim();
    if (val.includes(",") || val.includes(";")) {
      multiInCell++;
      if (multiInCell <= 5) {
        console.log(`  Fila ${i + 2}, ${col}: "${val}"`);
      }
    }
  });
}
console.log(`Celdas con múltiples valores separados por coma/punto y coma: ${multiInCell}`);
console.log(`CONCLUSIÓN: ${multiInCell === 0 ? 'UNA actividad por día por estudiante' : 'HAY casos de múltiples actividades por día'}`);

// ============================================================
// 3. Novedades_Diarias analysis
// ============================================================
console.log("\n" + "=".repeat(70));
console.log("3. HOJA: Novedades_Diarias");
console.log("=".repeat(70));

const sheet2 = workbook.Sheets["Novedades_Diarias"];
const data2 = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet2, { defval: "" });

console.log(`Filas: ${data2.length}`);
console.log(`Columnas: ${Object.keys(data2[0] || {}).length}`);
console.log(`\nColumnas: ${Object.keys(data2[0] || {}).join(", ")}`);

// Analyze key columns
const novedadCols = [
  "NovedadID", "StudentID", "Novedad_de_Salida_Diaria",
  "Grado_Estudiante_Snap", "Nombre_Estudiante_Snap",
  "ScanCode", "Tipo de Novedad", "Flujo_Novedad", "Fecha_Novedad"
];

console.log("\nColumnas clave:");
for (const col of novedadCols) {
  const vals = data2.map((r) => String(r[col] || "").trim()).filter(Boolean);
  const unique = [...new Set(vals)];
  console.log(`  ${col}: ${vals.length} valores, ${unique.length} únicos`);
  if (unique.length <= 10) {
    console.log(`    Valores: ${unique.join(", ")}`);
  } else {
    console.log(`    Muestra: ${unique.slice(0, 5).join(", ")}`);
  }
}

// Check if StudentID/ScanCode matches BARCODE from Base
console.log("\n" + "-".repeat(70));
console.log("¿ScanCode de Novedades coincide con BARCODE de Base?");
const baseBarcodes = new Set(data.map((r) => String(r["BARCODE"] || "").trim()).filter(Boolean));
const novScanCodes = data2.map((r) => String(r["ScanCode"] || "").trim()).filter(Boolean);
const novStudentIds = data2.map((r) => String(r["StudentID"] || "").trim()).filter(Boolean);

const scanMatch = novScanCodes.filter((s) => baseBarcodes.has(s));
const idMatch = novStudentIds.filter((s) => baseBarcodes.has(s));

console.log(`  ScanCode que coinciden con BARCODE: ${scanMatch.length}/${novScanCodes.length}`);
console.log(`  StudentID que coinciden con BARCODE: ${idMatch.length}/${novStudentIds.length}`);
console.log(`  StudentID como número vs BARCODE como string:`);
console.log(`    Muestra StudentID: ${novStudentIds.slice(0, 5).join(", ")}`);
console.log(`    Muestra BARCODE: ${[...baseBarcodes].slice(0, 5).join(", ")}`);

// Date analysis
console.log("\nFechas:");
const fechas = data2.map((r) => r["Fecha_Novedad"]).filter((f) => f !== "" && f !== null);
const sampleFechas = fechas.slice(0, 5);
sampleFechas.forEach((f) => {
  if (typeof f === "number") {
    const date = new Date((f - 25569) * 86400 * 1000);
    console.log(`  ${f} → ${date.toISOString().split("T")[0]}`);
  }
});

// What does Novedades represent?
console.log("\n¿Qué representa Novedades_Diarias?");
console.log("  Es un registro de salidas/ausencias/llegadas tardías de estudiantes.");
console.log("  NO contiene información de disciplinas extracurriculares.");
console.log("  Es un sistema de control de asistencia/diario.");

// ============================================================
// 4. Summary for UNIQUE constraint decision
// ============================================================
console.log("\n" + "=".repeat(70));
console.log("4. DECISIÓN: UNIQUE constraint en StudentSchedule");
console.log("=".repeat(70));
console.log(`\nBasado en el análisis:`);
console.log(`- Cada fila del Excel tiene UNA sola columna por día (CC_LUNES, etc.)`);
console.log(`- Cada columna por día tiene UN solo valor de disciplina`);
console.log(`- ${multiInCell === 0 ? 'NO hay celdas con múltiples valores' : 'HAY celdas con múltiples valores'}`);
console.log(`\n→ Un estudiante puede tener como MÁXIMO 1 actividad por día`);
console.log(`\nUNIQUE constraint recomendado:`);
console.log(`  @@unique([codigoEstudiante, diaSemana])`);
console.log(`\nEsto garantiza que un estudiante no tenga dos actividades el mismo día.`);
console.log(`Si en el futuro se permitieran múltiples actividades por día, se cambiaría a:`);
console.log(`  @@unique([codigoEstudiante, codigoDisciplina, diaSemana])`);
