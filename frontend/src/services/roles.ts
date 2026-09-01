import type {
  ApiResponse,
  PaginatedResponse,
  SupervisorSessionItem,
  SupervisorSessionDetail,
  SupervisorTeacherSchedule,
  SupervisorAssignmentHistory,
  SupervisorStay,
  SupervisorStayStudent,
  SupervisorTransfer,
  SupervisorClassesResponse,
  StudentNovedades,
} from "../types";
import * as supervisorApi from "./supervisor";
import * as secretaryApi from "./secretary";
import type { SecretaryClassStudentsData } from "./secretary";

export type RoleKind = "supervisor" | "secretary";

export interface RoleUser {
  nombre: string;
  apellido: string;
  correo: string | null;
}

export interface RoleFilters {
  disciplinas: {
    codigoDisciplina: string;
    nombre: string;
    grados: string[];
  }[];
  profesores: {
    idProfesor: string;
    nombre: string;
    apellido: string;
  }[];
}

export interface TransferCreatePayload {
  codigoEstudiante: string;
  idAsignacionOrigen: string;
  idAsignacionDestino: string;
  idHorarioDestino: string;
  fecha: string;
  fechaFin?: string;
  motivo: string;
}

export interface RoleApi {
  role: RoleKind;
  label: string;
  me: () => Promise<RoleUser>;
  getSessions: (params?: Record<string, string>) => Promise<PaginatedResponse<SupervisorSessionItem>>;
  getSession: (sessionId: string) => Promise<SupervisorSessionDetail>;
  getFilters: () => Promise<RoleFilters>;
  exportAttendance: (params?: Record<string, string>) => Promise<Blob>;
  exportSession: (sessionId: string) => Promise<Blob>;
  getTeacherSchedules: () => Promise<SupervisorTeacherSchedule[]>;
  getAssignmentHistory: (asignacionId: string) => Promise<SupervisorAssignmentHistory>;
  listTransfers: (params?: { codigoEstudiante?: string; fecha?: string; fechaFin?: string }) => Promise<SupervisorTransfer[]>;
  getNovedadesBatch: (codigos: string[], fecha?: string) => Promise<StudentNovedades[]>;
  // Capacidades: solo el supervisor llama lista y gestiona traslados/niños que se quedan.
  canCallList: boolean;
  canManageTransfers: boolean;
  canManageStays: boolean;
  // Vista "Llamar lista": el supervisor la usa para llamar; la secretaria para visualizar.
  getClasses: (todayOnly?: boolean) => Promise<SupervisorClassesResponse>;
  getClassStudents?: (asignacionId: string, horarioId: string) => Promise<SecretaryClassStudentsData>;
  // Operaciones de escritura (solo supervisor; undefined en secretaria).
  startSession?: (data: { idAsignacion: string; idHorario: string }) => Promise<{ id: string }>;
  createTransfer?: (data: TransferCreatePayload) => Promise<{ id: string }>;
  deleteTransfer?: (id: string) => Promise<void>;
  searchStudents?: (q: string) => Promise<SupervisorStayStudent[]>;
  getStays?: (idAsignacion: string, idHorario: string, fecha: string) => Promise<SupervisorStay[]>;
}

const supervisorRole: RoleApi = {
  role: "supervisor",
  label: "Supervisor",
  me: async () => {
    const s = await supervisorApi.supervisorMe();
    return { nombre: s.nombre, apellido: s.apellido, correo: s.correo };
  },
  getSessions: supervisorApi.getSupervisorSessions,
  getSession: supervisorApi.getSupervisorSession,
  getFilters: supervisorApi.getSupervisorFilters,
  exportAttendance: supervisorApi.exportSupervisorAttendance,
  exportSession: supervisorApi.exportSupervisorSession,
  getTeacherSchedules: supervisorApi.getSupervisorTeacherSchedules,
  getAssignmentHistory: supervisorApi.getSupervisorAssignmentHistory,
  listTransfers: supervisorApi.listSupervisorTransfers,
  getNovedadesBatch: supervisorApi.getSupervisorNovedadesBatch,
  canCallList: true,
  canManageTransfers: true,
  canManageStays: true,
  getClasses: supervisorApi.getSupervisorClasses,
  startSession: supervisorApi.supervisorStartSession,
  createTransfer: supervisorApi.createSupervisorTransfer,
  deleteTransfer: supervisorApi.deleteSupervisorTransfer,
  searchStudents: supervisorApi.searchSupervisorStudents,
  getStays: supervisorApi.getSupervisorStays,
};

const secretaryRole: RoleApi = {
  role: "secretary",
  label: "Secretaría",
  me: async () => {
    const s = await secretaryApi.secretaryMe();
    return { nombre: s.nombre, apellido: s.apellido, correo: s.correo };
  },
  getSessions: secretaryApi.getSecretarySessions,
  getSession: secretaryApi.getSecretarySession,
  getFilters: secretaryApi.getSecretaryFilters,
  exportAttendance: secretaryApi.exportSecretaryAttendance,
  exportSession: secretaryApi.exportSecretarySession,
  getTeacherSchedules: secretaryApi.getSecretaryTeacherSchedules,
  getAssignmentHistory: secretaryApi.getSecretaryAssignmentHistory,
  listTransfers: secretaryApi.listSecretaryTransfers,
  getNovedadesBatch: secretaryApi.getSecretaryNovedadesBatch,
  canCallList: false,
  canManageTransfers: false,
  canManageStays: false,
  getClasses: secretaryApi.getSecretaryClasses,
  getClassStudents: secretaryApi.getSecretaryClassStudents,
};

export const roleApis: Record<RoleKind, RoleApi> = {
  supervisor: supervisorRole,
  secretary: secretaryRole,
};

export type { ApiResponse };
