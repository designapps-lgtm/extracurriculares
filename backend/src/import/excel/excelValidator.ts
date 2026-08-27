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
  const disciplineCodes = new Set<string>();

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

    // Collect discipline codes
    for (const dayCol of DAY_COLUMNS) {
      const val = row[dayCol];
      if (val) {
        disciplineCodes.add(val);
      }
    }

    // Track barcodes for duplicate detection
    if (!barcodeCount.has(row.BARCODE)) {
      barcodeCount.set(row.BARCODE, []);
    }
    barcodeCount.get(row.BARCODE)!.push(row._excelRow);

    if (!hasError) {
      valid.push(row);
    }
  }

  // Find duplicates
  const duplicateBarcodes = [...barcodeCount.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([code]) => code);

  return { valid, errors, duplicateBarcodes };
}
