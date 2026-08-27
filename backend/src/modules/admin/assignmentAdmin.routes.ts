import { Router } from "express";
import { getAssignments, getAssignmentById, createAssignment, updateAssignment, deleteAssignment } from "./assignmentAdmin.controller";
import { asyncHandler } from "../../middlewares/errorHandler";

const router = Router();

router.get("/", asyncHandler(getAssignments));
router.post("/", asyncHandler(createAssignment));
router.get("/:id", asyncHandler(getAssignmentById));
router.patch("/:id", asyncHandler(updateAssignment));
router.delete("/:id", asyncHandler(deleteAssignment));

export { router as adminAssignmentRouter };
