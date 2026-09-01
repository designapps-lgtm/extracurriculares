import { Router } from "express";
import { getSecretaries, getSecretaryById, createSecretary, updateSecretary, deleteSecretary } from "./secretaryAdmin.controller";
import { asyncHandler } from "../../middlewares/errorHandler";

const router = Router();

router.get("/", asyncHandler(getSecretaries));
router.post("/", asyncHandler(createSecretary));
router.get("/:id", asyncHandler(getSecretaryById));
router.patch("/:id", asyncHandler(updateSecretary));
router.delete("/:id", asyncHandler(deleteSecretary));

export { router as adminSecretaryRouter };
