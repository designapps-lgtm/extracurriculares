import crypto from "crypto";
import { nowIso } from "../utils/colombiaTime";
import { isoToMysql } from "./dates";
import { execute } from "./mysql";

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
  await execute(
    `INSERT INTO audit_log (id, user_id, user_type, action, entity, entity_id, details, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      event.userId,
      event.userType,
      event.action,
      event.entity,
      event.entityId ?? null,
      JSON.stringify(event.details),
      isoToMysql(nowIso()),
    ],
  );
}