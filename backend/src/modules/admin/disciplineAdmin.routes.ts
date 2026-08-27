import { Router } from "express";
import prisma from "../../config/prisma";
import { Prisma } from "@prisma/client";
import { asyncHandler } from "../../middlewares/errorHandler";

const router = Router();

router.get("/", asyncHandler(async (req, res) => {
  const page = parseInt((req.query.page as string) || "1");
  const limit = Math.min(parseInt((req.query.limit as string) || "20"), 100);
  const { search } = req.query;

  const where: Prisma.DisciplineWhereInput = {};
  if (search) {
    where.OR = [
      { codigoDisciplina: { contains: search as string, mode: "insensitive" } },
      { nombre: { contains: search as string, mode: "insensitive" } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.discipline.findMany({
      where,
      include: { _count: { select: { studentSchedules: true, assignments: true } } },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { nombre: "asc" },
    }),
    prisma.discipline.count({ where }),
  ]);

  res.json({
    success: true,
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}));

export { router as adminDisciplineRouter };
