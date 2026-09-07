import { Router, type Request, type Response } from "express";
import { getUsers } from "../appsheet/appsheet.domain";
import { AppSheetApiError } from "../appsheet/appsheet.service";

const router = Router();

router.get("/health", async (_req: Request, res: Response) => {
  try {
    const users = await getUsers({ fresh: true });
    res.json({ status: "ok", appsheet: "connected", database: "not_used", checks: { usuariosRoles: users.length } });
  } catch (error) {
    const timeout = error instanceof AppSheetApiError && error.timedOut;
    res.status(503).json({
      status: "error",
      appsheet: timeout ? "timeout" : "disconnected",
      database: "not_used",
    });
  }
});

export { router as healthRouter };
