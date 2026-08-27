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

export const DIAS_VALIDOS = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO"];

export function normalizeTime(value: string | undefined): string | null {
  if (!value) return null;
  const t = String(value).trim();
  if (!t) return null;
  const match = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) throw new AppError(400, "INVALID_TIME", `Hora inválida: '${t}'. Use formato HH:mm (ej. 15:15)`);
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) throw new AppError(400, "INVALID_TIME", `Hora inválida: '${t}'`);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
