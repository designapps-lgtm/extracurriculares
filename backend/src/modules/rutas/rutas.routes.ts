import { Router } from "express";
import { asyncHandler } from "../../middlewares/errorHandler";
import { getRutasReport } from "./rutas.service";

export const rutasRouter = Router();

rutasRouter.get("/", asyncHandler(async (_req, res) => {
  const report = await getRutasReport();
  res.json({ success: true, data: report });
}));