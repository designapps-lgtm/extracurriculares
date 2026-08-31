import { Router, Request, Response } from "express";
import { sql } from "../../config/db";

const router = Router();

router.get("/health", async (_req: Request, res: Response) => {
  try {
    await sql`SELECT 1`;
    res.json({ status: "ok", database: "connected" });
  } catch {
    res.status(503).json({ status: "error", database: "disconnected" });
  }
});

export { router as healthRouter };
