import { Router } from "express";
import prisma from "../../config/prisma";
import { asyncHandler, AppError } from "../../middlewares/errorHandler";

const router = Router();

const DIAS_VALIDOS = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO"];

function normalizeTime(value: string | undefined): string | null {
  if (!value) return null;
  const t = String(value).trim();
  if (!t) return null;
  const match = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) throw new AppError(400, "INVALID_TIME", `Hora inválida: '${t}'. Use formato HH:mm (ej. 15:15)`);
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) throw new AppError(400, "INVALID_TIME", `Hora inválida: '${t}'`);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

router.post("/", asyncHandler(async (req, res) => {
  const { diaSemana, horaInicio, horaFin, aula } = req.body;

  if (!diaSemana || !DIAS_VALIDOS.includes(diaSemana)) {
    throw new AppError(400, "INVALID_DAY", `Día inválido. Use uno de: ${DIAS_VALIDOS.join(", ")}`);
  }
  const hi = normalizeTime(horaInicio);
  const hf = horaFin === null ? null : normalizeTime(horaFin);

  const existing = await prisma.schedule.findFirst({ where: { diaSemana, horaInicio: hi, horaFin: hf } });

  if (existing) {
    res.status(200).json({ success: true, data: existing, created: false });
    return;
  }

  const schedule = await prisma.schedule.create({
    data: { diaSemana, horaInicio: hi, horaFin: hf, aula },
  });

  res.status(201).json({ success: true, data: schedule, created: true });
}));

router.get("/", asyncHandler(async (req, res) => {
  const page = parseInt((req.query.page as string) || "1");
  const limit = Math.min(parseInt((req.query.limit as string) || "20"), 100);
  const { dia } = req.query;

  const where: any = {};
  if (dia) where.diaSemana = dia as string;

  const [data, total] = await Promise.all([
    prisma.schedule.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ diaSemana: "asc" }, { horaInicio: "asc" }],
    }),
    prisma.schedule.count({ where }),
  ]);

  res.json({
    success: true,
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const schedule = await prisma.schedule.findUnique({ where: { idHorario: req.params.id } });
  if (!schedule) {
    res.status(404).json({ success: false, error: { code: "SCHEDULE_NOT_FOUND", message: "No se encontró el horario" } });
    return;
  }
  res.json({ success: true, data: schedule });
}));

export { router as adminScheduleRouter };
