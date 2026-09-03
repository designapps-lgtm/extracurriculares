import { Request, Response } from "express";
import { parsePagination } from "../../utils/pagination";
import * as studentAdminService from "../admin/studentAdmin.service";
import * as studentService from "../students/student.service";

export async function getStudents(req: Request, res: Response): Promise<void> {
  const { search, grado, inscrito } = req.query;
  const pagination = parsePagination(req.query as Record<string, string>);
  const data = await studentAdminService.getStudents(
    {
      search: search as string | undefined,
      grado: grado as string | undefined,
      inscrito: inscrito as string | undefined,
    },
    pagination,
  );
  res.json({ success: true, ...data });
}

export async function getStudentProfile(req: Request, res: Response): Promise<void> {
  const profile = await studentService.getStudentProfile(String(req.params.codigo));
  res.json({ success: true, data: profile });
}
