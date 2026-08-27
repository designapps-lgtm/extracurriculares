import { AppError } from "../middlewares/errorHandler";

export function validateId(value: string, field: string): void {
  if (!value || value.trim().length === 0) {
    throw new AppError(400, "INVALID_ID", `El campo ${field} es requerido`);
  }
}

export function validateUuid(value: string, field: string): void {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(value)) {
    throw new AppError(400, "INVALID_UUID", `El campo ${field} debe ser un UUID válido`);
  }
}

export function validateNumericId(value: string, field: string): number {
  const num = parseInt(value, 10);
  if (isNaN(num) || num <= 0) {
    throw new AppError(400, "INVALID_ID", `El campo ${field} debe ser un número entero positivo`);
  }
  return num;
}
