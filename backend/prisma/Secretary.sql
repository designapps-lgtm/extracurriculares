-- Migración: tablas Secretary y SecretaryRefreshToken (rol secretaria)
-- Generada con `prisma migrate diff`. Ejecutar contra la base (Neon o local)
-- antes de desplegar el backend:
--   npx prisma db push   (si se usa prisma)
--   o pegar este SQL en la consola de Neon.

CREATE TABLE "Secretary" (
    "idSecretary" TEXT NOT NULL,
    "codigoSecretary" TEXT,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "correo" TEXT,
    "fotoUrl" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Secretary_pkey" PRIMARY KEY ("idSecretary")
);

-- CreateIndex
CREATE UNIQUE INDEX "Secretary_codigoSecretary_key" ON "Secretary"("codigoSecretary");
CREATE UNIQUE INDEX "Secretary_correo_key" ON "Secretary"("correo");
CREATE INDEX "Secretary_codigoSecretary_idx" ON "Secretary"("codigoSecretary");
CREATE INDEX "Secretary_nombre_apellido_idx" ON "Secretary"("nombre", "apellido");

CREATE TABLE "SecretaryRefreshToken" (
    "id" TEXT NOT NULL,
    "secretaryId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecretaryRefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SecretaryRefreshToken_tokenHash_key" ON "SecretaryRefreshToken"("tokenHash");
CREATE INDEX "SecretaryRefreshToken_secretaryId_idx" ON "SecretaryRefreshToken"("secretaryId");
CREATE INDEX "SecretaryRefreshToken_familyId_idx" ON "SecretaryRefreshToken"("familyId");

-- AddForeignKey
ALTER TABLE "SecretaryRefreshToken" ADD CONSTRAINT "SecretaryRefreshToken_secretaryId_fkey" FOREIGN KEY ("secretaryId") REFERENCES "Secretary"("idSecretary") ON DELETE CASCADE ON UPDATE CASCADE;
