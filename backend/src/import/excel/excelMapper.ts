import { RawStudentRow } from "./excelReader";

export interface MappedStudent {
  codigoEstudiante: string;
  nombre: string;
  apellido: string;
  gradeNombre: string;
  grupo: string | null;
  correo: string | null;
  schedules: MappedSchedule[];
  _excelRow: number;
  /** Estado explícito (activo/inactivo) si el origen lo trae. */
  estado?: string;
  /** Valores de origen usados para validar sin persistir columnas auxiliares. */
  sourceFirstName?: string;
  sourceMiddleName?: string;
  sourceEstado?: string;
}

export interface MappedSchedule {
  codigoDisciplina: string;
  diaSemana: string;
}

const DAY_MAP: Record<string, string> = {
  ccLunes: "LUNES",
  ccMartes: "MARTES",
  ccMiercoles: "MIERCOLES",
  ccJueves: "JUEVES",
  ccViernes: "VIERNES",
  ccSabado: "SABADO",
};

/** Deja los nombres en el formato usado por la aplicación: sin tildes y sin espacios duplicados. */
export function normalizeStudentName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function mapStudents(rows: RawStudentRow[]): MappedStudent[] {
  return rows.map((row) => {
    const schedules: MappedSchedule[] = [];

    for (const [field, dia] of Object.entries(DAY_MAP)) {
      const disciplina = row[field as keyof RawStudentRow] as string;
      if (disciplina) {
        schedules.push({
          codigoDisciplina: disciplina,
          diaSemana: dia,
        });
      }
    }

    const firstName = normalizeStudentName(row.firstName);
    const middleName = normalizeStudentName(row.middleName);
    const lastName = normalizeStudentName(row.lastName);
    const estado = row.estado.toUpperCase();

    return {
      codigoEstudiante: row.BARCODE,
      nombre: [firstName, middleName].filter(Boolean).join(" ") || "SIN_NOMBRE",
      apellido: lastName || "SIN_APELLIDO",
      gradeNombre: row.grade,
      grupo: row.homeroom || null,
      correo: row.email || null,
      schedules,
      _excelRow: row._excelRow,
      sourceFirstName: firstName,
      sourceMiddleName: middleName,
      sourceEstado: row.estado,
      estado: row.estado
        ? (["ACTIVE", "ACTIVO", "ACTIVA"].includes(estado)
          ? "activo"
          : (["INACTIVE", "INACTIVO", "INACTIVA"].includes(estado) ? "inactivo" : undefined))
        : undefined,
    };
  });
}
