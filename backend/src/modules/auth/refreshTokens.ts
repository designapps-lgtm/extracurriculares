import jwt, { type JwtPayload } from "jsonwebtoken";
import { config } from "../../config";
import { AppError } from "../../middlewares/errorHandler";

interface RefreshServiceOptions {
  userIdField: "teacherId" | "adminId" | "supervisorId" | "secretaryId";
  tableName: string;
  buildAccessToken: (identity: { id: string; email: string }) => string;
}

interface LegacyRefreshClaims extends JwtPayload {
  tokenType: "refresh";
  userId: string;
  email: string;
  userIdField: string;
}

/**
 * Compatibilidad para consumidores legacy. Las sesiones nuevas usan session.ts;
 * este adaptador ya no persiste tokens ni accede a una base de datos.
 */
export function createRefreshService({ userIdField, buildAccessToken }: RefreshServiceOptions) {
  const create = (userId: string, email: string) => jwt.sign(
    { tokenType: "refresh", userId, email, userIdField },
    config.jwtSecret,
    { expiresIn: `${config.sessionDurationHours}h`, jwtid: crypto.randomUUID() } as jwt.SignOptions,
  );

  const decode = (token: string): LegacyRefreshClaims => {
    if (!token) throw new AppError(401, "REFRESH_REQUIRED", "No hay sesión activa para renovar");
    try {
      const claims = jwt.verify(token, config.jwtSecret) as LegacyRefreshClaims;
      if (claims.tokenType !== "refresh" || claims.userIdField !== userIdField || !claims.userId) throw new Error("claims");
      return claims;
    } catch {
      throw new AppError(401, "INVALID_REFRESH_TOKEN", "Token de renovación inválido o expirado");
    }
  };

  return {
    issue: async (userId: string, email: string) => ({ accessToken: buildAccessToken({ id: userId, email }), refreshToken: create(userId, email) }),
    rotate: async (presented: string, email: string) => {
      const claims = decode(presented);
      const resolvedEmail = email || claims.email || "";
      return { userId: claims.userId, accessToken: buildAccessToken({ id: claims.userId, email: resolvedEmail }), refreshToken: create(claims.userId, resolvedEmail) };
    },
    revoke: async (_presented: string) => undefined,
    validate: async (presented: string) => ({ userId: decode(presented).userId }),
  };
}

export { jwt };
