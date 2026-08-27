import { RawStudentRow } from "./excelReader";

export interface ValidationError {
  row: number;
  codigoEstudiante: string;
  field: string;
  value: string;
  error: string;
}

const VALID_GRADES = new Set([
  "PV", "K3", "K4", "K5",
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12",
]);

const DAY_COLUMNS = ["ccLunes", "ccMartes", "ccMiercoles", "ccJueves", "ccViernes", "ccSabado"] as const;

export interface ValidationResult {
  valid: RawStudentRow[];
  errors: ValidationError[];
  duplicateBarcodes: string[];
}

export function validateRows(rows: RawStudentRow[]): ValidationResult {
  const errors: ValidationError[] = [];
  const valid: RawStudentRow[] = [];
  const barcodeCount = new Map<string, number[]>();
  const duplicateBarcodes: string[] = [];

  for (const row of rows) {
    let hasError = false;

    // Validate grade
    if (!VALID_GRADES.has(row.grade)) {
      errors.push({
        row: row._excelRow,
        codigoEstudiante: row.BARCODE,
        field: "grade",
        value: row.grade,
        error: `Grado inválido: "${row.grade}"`,
      });
      hasError = true;
    }

    // Track barcodes for duplicate detection: the first occurrence stays valid,
    // subsequent rows with the same barcode are excluded (they would overwrite it).
    if (!barcodeCount.has(row.BARCODE)) {
      barcodeCount.set(row.BARCODE, []);
    }
    const occurrences = barcodeCount.get(row.BARCODE)!;
    occurrences.push(row._excelRow);
    if (occurrences.length > 1) {
      hasError = true;
      if (occurrences.length === 2) {
        duplicateBarcodes.push(row.BARCODE);
      }
      errors.push({
        row: row._excelRow,
        codigoEstudiante: row.BARCODE,
        field: "barcode",
        value: row.BARCODE,
        error: `Barcode duplicado (también en fila ${occurrences[0]})`,
      });
    }

    if (!hasError) {
      valid.push(row);
    }
  }

  return { valid, errors, duplicateBarcodes };
}
