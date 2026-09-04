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
  grades?: { idGrado: number; nombre: string }[];
  schedules: {
    schedule: Schedule;
  }[];
  esPrincipal: boolean;
  estado: string;
}

export interface SupervisorTeacherSchedule {
  idAsignacion: string;
  esPrincipal: boolean;
  teacher: Pick<Teacher, "idProfesor" | "nombre" | "apellido">;
  discipline: Pick<Discipline, "codigoDisciplina" | "nombre">;
  grade: Pick<Grade, "idGrado" | "nombre">;
  schedules: Schedule[];
}

export interface SupervisorScheduleHistory {
  assignment: {
    teacher: Pick<Teacher, "idProfesor" | "nombre" | "apellido">;
    discipline: Pick<Discipline, "codigoDisciplina" | "nombre">;
    grade: Pick<Grade, "idGrado" | "nombre">;
  };
  schedule: Schedule;
  sessions: {
    id: string;
    fecha: string;
    estado: string;
    counts: { total: number; presente: number; ausente: number; justificado: number; };
  }[];
}

export interface SupervisorEnrolledStudent {
  codigoEstudiante: string;
  nombre: string;
  apellido: string;
  idGrado: number;
  gradoNombre?: string | null;
  grupo: string | null;
  correo: string | null;
  fotoUrl: string | null;
}

export interface SupervisorAssignmentHistory {
  assignment: {
    teacher: Pick<Teacher, "idProfesor" | "nombre" | "apellido">;
    discipline: Pick<Discipline, "codigoDisciplina" | "nombre">;
    grade: Pick<Grade, "idGrado" | "nombre">;
  };
  schedules: {
    schedule: Schedule;
    students: SupervisorEnrolledStudent[];
    sessions: {
      id: string;
      fecha: string;
      estado: string;
      counts: { total: number; presente: number; ausente: number; justificado: number; };
    }[];
  }[];
}

export interface SupervisorStayStudent {
  codigoEstudiante: string;
  nombre: string;
  apellido: string;
  idGrado: number;
  grupo: string | null;
  fotoUrl: string | null;
  gradoNombre: string | null;
  inscrito: boolean;
}

export interface SupervisorStay {
  id: string;
  idAsignacion: string;
  idHorario: string;
  fecha: string;
  createdAt: string;
  idSupervisor: string;
  student: {
    codigoEstudiante: string;
    nombre: string;
    apellido: string;
    idGrado: number;
    grupo: string | null;
    fotoUrl: string | null;
    gradoNombre: string | null;
  };
}

export type AttendanceCallStatus = "no_llamada" | "en_curso" | "finalizada";
export type AttendanceCallerType = "teacher" | "supervisor" | "admin" | "historico";

export interface AttendanceCaller {
  type: AttendanceCallerType;
  id: string | null;
  nombre: string;
  apellido: string;
}

export interface TeacherClass {
  idAsignacion: string;
  discipline: Pick<Discipline, "codigoDisciplina" | "nombre">;
  grade: Pick<Grade, "idGrado" | "nombre">;
  grades?: { idGrado: number; nombre: string }[];
  schedule: Schedule;
  enrolledCount: number;
  stayCount: number;
  sessionId: string | null;
  sessionEstado: string | null;
  llamadaAt: string | null;
  llamadaPorTipo: AttendanceCallerType | null;
  llamadaPorId: string | null;
  callStatus: AttendanceCallStatus;
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
  fotoUrl: string | null;
  estado: string;
  origen?: string;
  gradoNombre?: string;
}

export interface AttendanceResponse {
  assignment: Assignment;
  schedule: Schedule;
  students: AttendanceStudent[];
  session?: {
    id: string;
    estado: string;
    fecha: string;
    llamadaAt?: string | null;
    llamadaPorTipo?: AttendanceCallerType | null;
    llamadaPorId?: string | null;
  };
  teacher?: Pick<Teacher, "idProfesor" | "nombre" | "apellido">;
}

export interface SupervisorCallableClass {
  idAsignacion: string;
  discipline: Pick<Discipline, "codigoDisciplina" | "nombre">;
  grade: Pick<Grade, "idGrado" | "nombre">;
  grades?: { idGrado: number; nombre: string }[];
  teacher: Pick<Teacher, "idProfesor" | "nombre" | "apellido">;
  schedule: Schedule;
  isToday: boolean;
  enrolledCount: number;
  stayCount: number;
  sessionId: string | null;
  sessionEstado: string | null;
  llamadaAt: string | null;
  llamadaPorTipo: AttendanceCallerType | null;
  llamadaPorId: string | null;
  calledBy: AttendanceCaller | null;
  callStatus: AttendanceCallStatus;
  attendanceCount: number;
}

export interface SupervisorClassesResponse {
  date: string;
  dayName: string;
  classes: SupervisorCallableClass[];
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

export interface Secretary {
  idSecretary: string;
  codigoSecretary: string | null;
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
    fotoUrl?: string | null;
    estado: string;
  }[];
}
