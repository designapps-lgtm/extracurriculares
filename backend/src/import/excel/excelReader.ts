import * as XLSX from "xlsx";

export interface RawStudentRow {
  BARCODE: string;
  firstName: string;
  lastName: string;
  grade: string;
  homeroom: string;
  email: string;
  ccLunes: string;
  ccMartes: string;
  ccMiercoles: string;
  ccJueves: string;
  ccViernes: string;
  ccSabado: string;
  _excelRow: number;
}

const DAY_COLUMNS: Record<string, keyof RawStudentRow> = {
  CC_LUNES: "ccLunes",
  CC_MARTES: "ccMartes",
  CC_MIERCOLES: "ccMiercoles",
  CC_JUEVES: "ccJueves",
  CC_VIERNES: "ccViernes",
  CC_SABADO: "ccSabado",
};

export function readExcel(filePath: string): RawStudentRow[] {
  const workbook = XLSX.readFile(filePath);
  const sheetName = "Base";
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    throw new Error(`Hoja "${sheetName}" no encontrada en ${filePath}`);
  }

  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  return data
    .map((row, i) => {
      const barcode = String(row["BARCODE"] || "").trim();
      if (!barcode) return null;

      return {
        BARCODE: barcode,
        firstName: String(row["FIRST NAME"] || "").trim(),
        lastName: String(row["LAST NAME"] || "").trim(),
        grade: String(row["GRADE"] || "").trim(),
        homeroom: String(row["HOMEROOM"] || "").trim(),
        email: String(row["STUDENT_EMAIL"] || "").trim(),
        ccLunes: String(row["CC_LUNES"] || "").trim(),
        ccMartes: String(row["CC_MARTES"] || "").trim(),
        ccMiercoles: String(row["CC_MIERCOLES"] || "").trim(),
        ccJueves: String(row["CC_JUEVES"] || "").trim(),
        ccViernes: String(row["CC_VIERNES"] || "").trim(),
        ccSabado: String(row["CC_SABADO"] || "").trim(),
        _excelRow: i + 2,
      };
    })
    .filter((row): row is RawStudentRow => row !== null);
}
