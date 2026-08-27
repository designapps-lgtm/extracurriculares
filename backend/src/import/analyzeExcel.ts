import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function analyze() {
  const filePath = "/app/Extracurriculares_base.xlsx";
  console.log(`\n📄 Analizando: ${filePath}\n`);

  const workbook = XLSX.readFile(filePath);

  console.log(`Hojas: ${workbook.SheetNames.join(", ")}`);
  console.log(`Total hojas: ${workbook.SheetNames.length}\n`);

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

    console.log(`${"=".repeat(60)}`);
    console.log(`HOJA: "${sheetName}"`);
    console.log(`${"=".repeat(60)}`);
    console.log(`Filas: ${data.length}`);

    if (data.length === 0) {
      console.log("Vacía.\n");
      continue;
    }

    const columns = Object.keys(data[0]);
    console.log(`Columnas: ${columns.length}\n`);

    // Column analysis
    console.log("ANÁLISIS DE COLUMNAS:");
    console.log("-".repeat(80));
    console.log(
      "Columna".padEnd(30) +
      "Tipo".padEnd(10) +
      "Vacíos".padEnd(10) +
      "No vacíos".padEnd(12) +
      "Ejemplos"
    );
    console.log("-".repeat(80));

    for (const col of columns) {
      const values = data.map((row) => row[col]);
      const emptyCount = values.filter((v) => v === "" || v === null || v === undefined).length;
      const nonEmpty = values.filter((v) => v !== "" && v !== null && v !== undefined);
      const uniqueVals = [...new Set(nonEmpty.map(String))];
      const sample = uniqueVals.slice(0, 3).join(", ");
      const type = typeof nonEmpty[0];

      console.log(
        String(col).padEnd(30) +
        type.padEnd(10) +
        String(emptyCount).padEnd(10) +
        String(nonEmpty.length).padEnd(12) +
        sample
      );
    }

    // Identify key columns (heuristic)
    console.log("\n\nIDENTIFICACIÓN DE COLUMNAS CLAVE:");
    console.log("-".repeat(40));

    const colLower = columns.map((c) => ({ original: c, lower: c.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") }));

    const findCol = (keywords: string[]) =>
      colLower.find((c) => keywords.some((k) => c.lower.includes(k)))?.original;

    const codeCol = findCol(["codigo", "código", "code", "id estudiante", "id_estudiante", "cod"]);
    const nameCol = findCol(["nombre", "name"]);
    const apellidoCol = findCol(["apellido", "surname", "last name", "apellidos"]);
    const gradoCol = findCol(["grado", "grade"]);
    const grupoCol = findCol(["grupo", "group"]);
    const disciplinaCol = findCol(["disciplina", "discipline", "actividad", "extracurricular", "materia"]);
    const correoCol = findCol(["correo", "email", "mail"]);
    const fotoCol = findCol(["foto", "photo", "imagen", "image"]);

    console.log(`Código estudiante: ${codeCol || "NO ENCONTRADO"}`);
    console.log(`Nombre: ${nameCol || "NO ENCONTRADO"}`);
    console.log(`Apellido: ${apellidoCol || "NO ENCONTRADO"}`);
    console.log(`Grado: ${gradoCol || "NO ENCONTRADO"}`);
    console.log(`Grupo: ${grupoCol || "NO ENCONTRADO"}`);
    console.log(`Disciplina: ${disciplinaCol || "NO ENCONTRADO"}`);
    console.log(`Correo: ${correoCol || "NO ENCONTRADO"}`);
    console.log(`Foto: ${fotoCol || "NO ENCONTRADO"}`);

    // Unique values for key columns
    if (codeCol) {
      const codes = data.map((r) => String(r[codeCol] || "").trim()).filter(Boolean);
      const uniqueCodes = new Set(codes);
      const duplicates = codes.filter((c, i) => codes.indexOf(c) !== i);
      const uniqueDuplicates = [...new Set(duplicates)];

      console.log(`\nCÓDIGOS DE ESTUDIANTE:`);
      console.log(`  Total: ${codes.length}`);
      console.log(`  Únicos: ${uniqueCodes.size}`);
      console.log(`  Duplicados: ${uniqueDuplicates.length}`);
      if (uniqueDuplicates.length > 0) {
        console.log(`  Ejemplos duplicados: ${uniqueDuplicates.slice(0, 5).join(", ")}`);
      }
    }

    if (disciplinaCol) {
      const disciplinas = data.map((r) => String(r[disciplinaCol] || "").trim());
      const nonEmptyDisc = disciplinas.filter(Boolean);
      const uniqueDisc = [...new Set(nonEmptyDisc)];
      console.log(`\nDISCIPLINAS:`);
      console.log(`  Con disciplina: ${nonEmptyDisc.length}`);
      console.log(`  Sin disciplina: ${disciplinas.length - nonEmptyDisc.length}`);
      console.log(`  Valores únicos: ${uniqueDisc.join(", ")}`);
    }

    if (gradoCol) {
      const grados = [...new Set(data.map((r) => String(r[gradoCol] || "").trim()).filter(Boolean))];
      console.log(`\nGRADOS:`);
      console.log(`  Valores únicos: ${grados.join(", ")}`);
    }

    if (grupoCol) {
      const grupos = [...new Set(data.map((r) => String(r[grupoCol] || "").trim()).filter(Boolean))];
      console.log(`\nGRUPOS:`);
      console.log(`  Valores únicos: ${grupos.join(", ")}`);
    }

    // Check for multiple disciplines per student
    if (codeCol && disciplinaCol) {
      const studentDisciplines = new Map<string, Set<string>>();
      for (const row of data) {
        const code = String(row[codeCol] || "").trim();
        const disc = String(row[disciplinaCol] || "").trim();
        if (!code || !disc) continue;
        if (!studentDisciplines.has(code)) studentDisciplines.set(code, new Set());
        studentDisciplines.get(code)!.add(disc);
      }

      const multiDiscStudents = [...studentDisciplines.entries()].filter(([, discs]) => discs.size > 1);
      console.log(`\n⚠️ ESTUDIANTES CON MÚLTIPLES DISCIPLINAS: ${multiDiscStudents.length}`);
      if (multiDiscStudents.length > 0) {
        multiDiscStudents.slice(0, 5).forEach(([code, discs]) => {
          console.log(`  ${code}: ${[...discs].join(", ")}`);
        });
      }
    }

    // Compare with DB disciplines
    console.log(`\nCOMPARACIÓN CON BASE DE DATOS:`);
    const dbDisciplines = await prisma.discipline.findMany({ select: { codigoDisciplina: true, nombre: true } });
    const dbDiscMap = new Map(dbDisciplines.map((d) => [d.codigoDisciplina, d.nombre]));
    const dbGrades = await prisma.grade.findMany({ select: { nombre: true, idGrado: true } });
    const dbGradeMap = new Map(dbGrades.map((g) => [g.nombre, g.idGrado]));

    if (disciplinaCol) {
      const excelDiscs = [...new Set(data.map((r) => String(r[disciplinaCol] || "").trim()).filter(Boolean))];
      const existing = excelDiscs.filter((d) => dbDiscMap.has(d));
      const newDiscs = excelDiscs.filter((d) => !dbDiscMap.has(d));
      console.log(`  Disciplinas en BD: ${existing.join(", ") || "ninguna"}`);
      console.log(`  Disciplinas nuevas: ${newDiscs.join(", ") || "ninguna"}`);
    }

    if (gradoCol) {
      const excelGrados = [...new Set(data.map((r) => String(r[gradoCol] || "").trim()).filter(Boolean))];
      const existing = excelGrados.filter((g) => dbGradeMap.has(g));
      const newGrados = excelGrados.filter((g) => !dbGradeMap.has(g));
      console.log(`  Grados en BD: ${existing.join(", ") || "ninguna"}`);
      console.log(`  Grados nuevos: ${newGrados.join(", ") || "ninguna"}`);
    }

    console.log("\n");
  }
}

analyze()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
