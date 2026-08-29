export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: ApiError;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  code: string;
  message: string;
}

export interface Grade {
  idGrado: number;
  nombre: string;
  nivel: string | null;
  estado: string;
}

export interface Discipline {
  codigoDisciplina: string;
  nombre: string;
  descripcion: string | null;
  estado: string;
  createdAt: string;
  updatedAt: string;
}

export interface Teacher {
  idProfesor: string;
  codigoProfesor: string | null;
  nombre: string;
  apellido: string;
  correo: string | null;
  fotoUrl: string | null;
  estado: string;
}

export interface Schedule {
  idHorario: string;
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
  aula: string | null;
}

export interface StudentSchedule {
  id: string;
  codigoEstudiante: string;
  codigoDisciplina: string;
  diaSemana: string;
  discipline: Discipline;
}

export interface Student {
  codigoEstudiante: string;
  nombre: string;
  apellido: string;
  idGrado: number;
  grupo: string | null;
  correo: string | null;
  fotoUrl: string | null;
  estado: string;
  grade: Grade;
  studentSchedules: StudentSchedule[];
}

export interface StudentProfile {
  student: {
    codigoEstudiante: string;
    nombre: string;
    apellido: string;
    grupo: string | null;
    grade: Grade;
    correo: string | null;
    estado: string;
    fotoUrl: string | null;
  };
  extracurricular: {
    dia: string;
    disciplina: {
      codigo: string;
      nombre: string;
    };
    oferta: {
      profesor: string;
      horaInicio: string | null;
      horaFin: string | null;
    } | null;
  }[] | null;
}

export interface DisciplineDetail extends Discipline {
  assignments: {
    teacher: Pick<Teacher, "idProfesor" | "nombre" | "apellido">;
    grade: Pick<Grade, "idGrado" | "nombre">;
    schedules: {
      schedule: Schedule;
    }[];
  }[];
  _count: { studentSchedules: number };
}

export interface DisciplineTeacher {
  teacher: Teacher;
  grade: Pick<Grade, "idGrado" | "nombre">;
  schedules: {
    schedule: Schedule;
  }[];
}

export interface TeacherWithCount extends Teacher {
  _count: { assignments: number };
}

export interface TeacherAssignment {
  discipline: Pick<Discipline, "codigoDisciplina" | "nombre">;
  grade: Pick<Grade, "idGrado" | "nombre">;
  schedules: {
    schedule: Schedule;
  }[];
}

export interface GradeWithCount extends Grade {
  _count: { students: number; assignments: number };
}

export interface Assignment {
  idAsignacion: string;
  codigoDisciplina: string;
  idGrado: number;
  teacher: Pick<Teacher, "idProfesor" | "nombre" | "apellido">;
  discipline: Pick<Discipline, "codigoDisciplina" | "nombre">;
  grade: Pick<Grade, "idGrado" | "nombre">;
  schedules: {
    schedule: Schedule;
  }[];
  esPrincipal: boolean;
  estado: string;
}

export interface TeacherClass {
  idAsignacion: string;
  discipline: Pick<Discipline, "codigoDisciplina" | "nombre">;
  grade: Pick<Grade, "idGrado" | "nombre">;
  schedule: Schedule;
  enrolledCount: number;
  sessionId: string | null;
  sessionEstado: string | null;
  attendanceCount: number;
}

export interface TeacherClassesResponse {
  teacher: Pick<Teacher, "idProfesor" | "nombre" | "apellido">;
  classes: TeacherClass[];
  dayName: string;
  date: string;
}

export interface AttendanceStudent {
  codigoEstudiante: string;
  nombre: string;
  apellido: string;
  grupo: string | null;
  estado: string;
}

export interface AttendanceResponse {
  assignment: Assignment;
  schedule: Schedule;
  students: AttendanceStudent[];
}

export interface Novedad {
  id: string;
  novedadId: string;
  codigoEstudiante: string;
  archivo: string;
  descripcion: string | null;
  seAusentaCon: string | null;
  seAusentaConOtro: string | null;
  seAusentaConTipo: string | null;
  tipoNovedad: string | null;
  flujoNovedad: string | null;
  grados: string | null;
  nombresEstudiantes: string | null;
  fotoUrls: string | null;
  fechaHora: string | null;
  scanCodes: string | null;
  fechaCreacion: string | null;
  registradoPor: string | null;
  procesado: string | null;
  regresaAlColegio: boolean;
  horaEstimadaRegreso: string | null;
  fechaNovedad: string | null;
}

export interface StudentNovedades {
  codigoEstudiante: string;
  novedades: Novedad[];
}

export interface Supervisor {
  idSupervisor: string;
  codigoSupervisor: string | null;
  nombre: string;
  apellido: string;
  correo: string | null;
  fotoUrl: string | null;
  estado: string;
}

export interface SupervisorSessionItem {
  id: string;
  fecha: string;
  estado: string;
  assignment: {
    idAsignacion: string;
    codigoDisciplina: string;
    idGrado: number;
    discipline: Pick<Discipline, "codigoDisciplina" | "nombre">;
    grade: Pick<Grade, "idGrado" | "nombre">;
  };
  schedule: Pick<Schedule, "idHorario" | "diaSemana" | "horaInicio" | "horaFin" | "aula">;
  teacher: Pick<Teacher, "idProfesor" | "nombre" | "apellido">;
  counts: {
    total: number;
    presente: number;
    ausente: number;
    justificado: number;
  };
}

export interface SupervisorSessionDetail {
  id: string;
  fecha: string;
  estado: string;
  assignment: {
    idAsignacion: string;
    codigoDisciplina: string;
    idGrado: number;
    discipline: Pick<Discipline, "codigoDisciplina" | "nombre">;
    grade: Pick<Grade, "idGrado" | "nombre">;
  };
  schedule: Pick<Schedule, "idHorario" | "diaSemana" | "horaInicio" | "horaFin" | "aula">;
  teacher: Pick<Teacher, "idProfesor" | "nombre" | "apellido">;
  records: {
    codigoEstudiante: string;
    nombre: string;
    apellido: string;
    grupo: string | null;
    estado: string;
  }[];
}
