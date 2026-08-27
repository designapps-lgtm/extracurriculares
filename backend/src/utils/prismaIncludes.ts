export const assignmentInclude = {
  teacher: { select: { idProfesor: true, nombre: true, apellido: true } },
  discipline: { select: { codigoDisciplina: true, nombre: true } },
  grade: { select: { idGrado: true, nombre: true } },
  schedules: {
    include: {
      schedule: { select: { diaSemana: true, horaInicio: true, horaFin: true, aula: true } },
    },
  },
} as const;