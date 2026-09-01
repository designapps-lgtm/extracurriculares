-- Migración: tabla StudentTransfer (traslados de estudiantes por fecha)
-- Generada con `prisma migrate diff`. Ejecutar contra la base (Neon o local)
-- antes de desplegar el backend:
--   npx prisma db push   (si se usa prisma)
--   o pegar este SQL en la consola de Neon.

CREATE TABLE "StudentTransfer" (
    "id" TEXT NOT NULL,
    "codigoEstudiante" TEXT NOT NULL,
    "idAsignacionOrigen" TEXT NOT NULL,
    "idAsignacionDestino" TEXT NOT NULL,
    "idHorarioDestino" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "fechaFin" DATE,
    "motivo" TEXT NOT NULL,
    "idSupervisor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentTransfer_idAsignacionOrigen_idx" ON "StudentTransfer"("idAsignacionOrigen");
CREATE INDEX "StudentTransfer_idAsignacionDestino_idx" ON "StudentTransfer"("idAsignacionDestino");
CREATE INDEX "StudentTransfer_idHorarioDestino_idx" ON "StudentTransfer"("idHorarioDestino");
CREATE INDEX "StudentTransfer_idSupervisor_idx" ON "StudentTransfer"("idSupervisor");
CREATE INDEX "StudentTransfer_fecha_idx" ON "StudentTransfer"("fecha");
CREATE UNIQUE INDEX "StudentTransfer_codigoEstudiante_fecha_key" ON "StudentTransfer"("codigoEstudiante", "fecha");

-- AddForeignKey
ALTER TABLE "StudentTransfer" ADD CONSTRAINT "StudentTransfer_codigoEstudiante_fkey" FOREIGN KEY ("codigoEstudiante") REFERENCES "Student"("codigoEstudiante") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentTransfer" ADD CONSTRAINT "StudentTransfer_idAsignacionOrigen_fkey" FOREIGN KEY ("idAsignacionOrigen") REFERENCES "ExtracurricularAssignment"("idAsignacion") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentTransfer" ADD CONSTRAINT "StudentTransfer_idAsignacionDestino_fkey" FOREIGN KEY ("idAsignacionDestino") REFERENCES "ExtracurricularAssignment"("idAsignacion") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentTransfer" ADD CONSTRAINT "StudentTransfer_idHorarioDestino_fkey" FOREIGN KEY ("idHorarioDestino") REFERENCES "Schedule"("idHorario") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentTransfer" ADD CONSTRAINT "StudentTransfer_idSupervisor_fkey" FOREIGN KEY ("idSupervisor") REFERENCES "Supervisor"("idSupervisor") ON DELETE RESTRICT ON UPDATE CASCADE;