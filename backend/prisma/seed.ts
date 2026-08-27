import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    console.error("Seed requiere SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD (ej: SEED_ADMIN_PASSWORD=admin123 npx prisma db seed)");
    process.exit(1);
  }
  if (password.length < 6) {
    console.error("La contraseña debe tener al menos 6 caracteres");
    process.exit(1);
  }

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) {
    const updated = await prisma.adminUser.update({
      where: { email },
      data: { passwordHash: await bcrypt.hash(password, 12), estado: "activo" },
    });
    console.log(`Admin ${email} actualizado (id ${updated.id})`);
  } else {
    const created = await prisma.adminUser.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 12),
        nombre: email.split("@")[0],
        apellido: "",
      },
    });
    console.log(`Admin ${email} creado (id ${created.id})`);
  }
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());