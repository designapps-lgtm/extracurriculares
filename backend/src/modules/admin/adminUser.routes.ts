import { Router } from "express";
import { listAdmins, createAdmin, updateAdmin, resetPassword, deleteAdmin } from "./adminUser.controller";
import { asyncHandler } from "../../middlewares/errorHandler";

const router = Router();

router.get("/", asyncHandler(listAdmins));
router.post("/", asyncHandler(createAdmin));
router.patch("/:id", asyncHandler(updateAdmin));
router.patch("/:id/reset-password", asyncHandler(resetPassword));
router.delete("/:id", asyncHandler(deleteAdmin));

export { router as adminUserRouter };
