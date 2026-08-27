import { Router, Request, Response } from "express";
import prisma from "../../config/prisma";

const router = Router();

router.get("/health", async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "connected" });
  } catch {
    res.status(503).json({ status: "error", database: "disconnected" });
  }
});

export { router as healthRouter };
