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

    return {
      codigoEstudiante: row.BARCODE,
      nombre: row.firstName || "SIN_NOMBRE",
      apellido: row.lastName || "SIN_APELLIDO",
      gradeNombre: row.grade,
      grupo: row.homeroom || null,
      correo: row.email || null,
      schedules,
      _excelRow: row._excelRow,
    };
  });
}
