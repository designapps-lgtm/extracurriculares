import { Router } from "express";
import prisma from "../../config/prisma";
import { asyncHandler } from "../../middlewares/errorHandler";

const router = Router();

router.get("/", asyncHandler(async (_req, res) => {
  const grades = await prisma.grade.findMany({
    include: { _count: { select: { students: true, assignments: true } } },
    orderBy: { nombre: "asc" },
  });
  res.json({ success: true, data: grades });
}));

export { router as adminGradeRouter };
