import { AppError } from "../middlewares/errorHandler";

export async function getOr404<T>(query: Promise<T | null>, code: string, message: string): Promise<T> {
  const result = await query;
  if (!result) {
    throw new AppError(404, code, message);
  }
  return result;
}