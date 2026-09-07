import { AppError } from "../../middlewares/errorHandler";
import { getUserById } from "../appsheet/appsheet.domain";

export interface AdminSessionData {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  estado: string;
  createdAt?: string | null;
}

export async function login(_email: string, _password: string): Promise<AdminSessionData> {
  throw new AppError(410, "PASSWORD_LOGIN_DISABLED", "El acceso con contraseña fue retirado. Use Iniciar sesión con Google.");
}

export async function getAdminById(adminId: string): Promise<AdminSessionData> {
  const admin = await getUserById(adminId, "admin");
  if (!admin || !admin.active) throw new AppError(403, "FORBIDDEN", "Acceso denegado");
  return {
    id: admin.id,
    email: admin.email,
    nombre: admin.firstName,
    apellido: admin.lastName,
    estado: admin.status,
    createdAt: admin.createdAt,
  };
}

export async function bootstrap(_data: {
  email: string;
  password: string;
  nombre?: string;
  apellido?: string;
}): Promise<AdminSessionData> {
  throw new AppError(410, "BOOTSTRAP_DISABLED", "El bootstrap con contraseña fue retirado. Administre Usuarios_Roles y use Google.");
}
