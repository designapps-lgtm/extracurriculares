import crypto from "crypto";
import { nowIso } from "../../utils/colombiaTime";
import { APPSHEET_TABLES, addRows } from "./appsheet.repository";

export interface AuditEvent {
  userId: string;
  userType: string;
  action: string;
  entity: string;
  entityId: string | null;
  details: Record<string, unknown>;
}

/** Escritura no bloqueante. Los nombres siguen la convención de EC_Auditoria. */
export async function writeAuditEvent(event: AuditEvent): Promise<void> {
  await addRows(APPSHEET_TABLES.audit, [{
    AuditoriaID: crypto.randomUUID(),
    UsuarioID: event.userId,
    TipoUsuario: event.userType,
    Accion: event.action,
    Entidad: event.entity,
    EntidadID: event.entityId ?? "",
    Detalles: JSON.stringify(event.details),
    CreatedAt: nowIso(),
  }]);
}
