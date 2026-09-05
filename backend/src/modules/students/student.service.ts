import { AppError } from "../../middlewares/errorHandler";
import { PaginationParams, PaginatedResult, paginatedResult } from "../../utils/pagination";
import { StudentQuery } from "./student.types";
import { getLiveStudentIndex, type LiveStudentInfo } from "../appsheet/appsheet.novedades";

const DAY_ORDER = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO"];

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function toStudentPayload(student: LiveStudentInfo) {
  const schedules = [...student.schedules]
    .sort((a, b) => DAY_ORDER.indexOf(a.diaSemana) - DAY_ORDER.indexOf(b.diaSemana))
    .map((schedule) => ({
      id: `${student.codigoEstudiante}:${schedule.diaSemana}`,
      codigoDisciplina: schedule.codigoDisciplina,
      diaSemana: schedule.diaSemana,
      discipline: {
        codigoDisciplina: schedule.codigoDisciplina,
        nombre: schedule.codigoDisciplina,
        descripcion: null,
      },
    }));

  return {
    codigoEstudiante: student.codigoEstudiante,
    nombre: student.nombre,
    apellido: student.apellido,
    idGrado: 0,
    grupo: student.grupo,
    fotoUrl: student.fotoUrl,
    estado: "activo",
    createdAt: null,
    updatedAt: null,
    grade: { idGrado: 0, nombre: student.grado, nivel: null },
    studentSchedules: schedules,
  };
}

function matchesSearch(student: LiveStudentInfo, search: string): boolean {
  const tokens = normalize(search).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = normalize(`${student.codigoEstudiante} ${student.nombre} ${student.apellido}`);
  return tokens.every((token) => haystack.includes(token));
}

export async function getStudents(query: StudentQuery, pagination: PaginationParams): Promise<PaginatedResult<any>> {
  const { search, grado, inscrito } = query;
  const disciplina = query.disciplina?.trim();
  const students = [...(await getLiveStudentIndex()).values()];

  const filtered = students
    .filter((student) => !search || matchesSearch(student, search))
    .filter((student) => !grado || student.grado === grado)
    .filter((student) => {
      if (inscrito === "true") return student.days.size > 0;
      if (inscrito === "false") return student.days.size === 0;
      return true;
    })
    .filter((student) => {
      if (!disciplina) return true;
      return student.schedules.some((schedule) => normalize(schedule.codigoDisciplina) === normalize(disciplina));
    })
    .sort((a, b) => `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`, "es"));

  const offset = (pagination.page - 1) * pagination.limit;
  const page = filtered.slice(offset, offset + pagination.limit).map(toStudentPayload);
  return paginatedResult(page, filtered.length, pagination);
}

export async function getStudentByCode(codigo: string) {
  const student = (await getLiveStudentIndex()).get(codigo);
  if (!student) {
    throw new AppError(404, "STUDENT_NOT_FOUND", "No se encontro el estudiante en AppSheet");
  }
  return toStudentPayload(student);
}

export async function getStudentProfile(codigo: string) {
  const student = (await getLiveStudentIndex()).get(codigo);
  if (!student) {
    throw new AppError(404, "STUDENT_NOT_FOUND", "No se encontro el estudiante en AppSheet");
  }

  const extracurricular = [...student.schedules]
    .sort((a, b) => DAY_ORDER.indexOf(a.diaSemana) - DAY_ORDER.indexOf(b.diaSemana))
    .map((schedule) => ({
      dia: schedule.diaSemana,
      disciplina: {
        codigo: schedule.codigoDisciplina,
        nombre: schedule.codigoDisciplina,
      },
      oferta: null,
    }));

  return {
    student: {
      codigoEstudiante: student.codigoEstudiante,
      nombre: student.nombre,
      apellido: student.apellido,
      grupo: student.grupo,
      grade: { idGrado: 0, nombre: student.grado, nivel: null },
      estado: "activo",
      fotoUrl: student.fotoUrl,
    },
    extracurricular: extracurricular.length > 0 ? extracurricular : null,
  };
}
