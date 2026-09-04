-- Migración: registrar fecha/hora y actor de la llamada de asistencia.
-- Ejecutar contra la base de datos antes de desplegar el backend actualizado.
-- Los registros históricos se marcan como históricos sin atribuirlos a un usuario.

ALTER TABLE "ClassSession"
  ADD COLUMN IF NOT EXISTS "llamadaAt" TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "llamadaPorTipo" TEXT,
  ADD COLUMN IF NOT EXISTS "llamadaPorId" TEXT;

CREATE INDEX IF NOT EXISTS "ClassSession_fecha_llamadaAt_idx"
  ON "ClassSession"("fecha", "llamadaAt");
CREATE INDEX IF NOT EXISTS "ClassSession_llamadaPorTipo_llamadaPorId_idx"
  ON "ClassSession"("llamadaPorTipo", "llamadaPorId");

-- Una sesión que ya estaba en curso o finalizada fue iniciada antes de esta
-- funcionalidad. Se conserva su fecha de creación como referencia, pero no se
-- inventa quién la llamó.
UPDATE "ClassSession"
SET "llamadaAt" = "createdAt",
    "llamadaPorTipo" = 'historico'
WHERE "llamadaAt" IS NULL
  AND "estado" <> 'programada';
