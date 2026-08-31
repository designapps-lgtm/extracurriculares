import { resolve } from "path";
import { config as loadEnv } from "dotenv";
loadEnv({ path: resolve(__dirname, "../../../../.env") });
import { sql } from "../../config/db";

// Mapeo explícito correo → profesor (derivado del Excel correos_profes.xlsx
// por las iniciales del correo + oferta en importOffer.ts + asignaciones).
const EMAIL_MAP: { correo: string; nombre: string; apellido: string }[] = [
  { correo: "javierm@gi.edu.co",       nombre: "Javier",        apellido: "Morales" },
  { correo: "luisamg@gi.edu.co",       nombre: "Luisa",         apellido: "Granada" },
  { correo: "juancarloso@gi.edu.co",   nombre: "Juan Carlos",   apellido: "Ortiz" },
  { correo: "isait@gi.edu.co",         nombre: "Isaí",          apellido: "Toro" },
  { correo: "abuitrago@gi.edu.co",     nombre: "Anderson",      apellido: "Buitrago" },
  { correo: "amlozano@gi.edu.co",      nombre: "Mauricio",      apellido: "Lozano" },
  { correo: "sebastiane@gi.edu.co",    nombre: "Sebastián",     apellido: "Echeverry" },
  { correo: "lilianan@gi.edu.co",      nombre: "Liliana",       apellido: "Niño" },
  { correo: "oscarl@gi.edu.co",        nombre: "Óscar",         apellido: "López" },
  { correo: "jvargas@gi.edu.co",       nombre: "Julián",        apellido: "Vargas" },
  { correo: "christianm@gi.edu.co",    nombre: "Cristian",      apellido: "Mosquera" },
  { correo: "etabares@gi.edu.co",      nombre: "Stefania",      apellido: "Tabares" },
  { correo: "jjramirez@gi.edu.co",     nombre: "Juan José",     apellido: "Ramírez" },
  { correo: "vanessac@gi.edu.co",      nombre: "Vanessa",       apellido: "Castellanos" },
  { correo: "andresfg@gi.edu.co",      nombre: "Andrés",        apellido: "Gómez" },
  { correo: "yacevedo@gi.edu.co",      nombre: "Yamid",         apellido: "Gómez" },
  { correo: "cpinillo@gi.edu.co",      nombre: "Carlos",        apellido: "Pinillo" },
  { correo: "aramirez@gi.edu.co",      nombre: "Alejandra",     apellido: "Ramírez" },
  { correo: "jdcalvo@gi.edu.co",       nombre: "Juan David",    apellido: "Calvo" },
  { correo: "lmartinez@gi.edu.co",     nombre: "Luis Eduardo",  apellido: "Martínez" },
  { correo: "mauriciop@gi.edu.co",     nombre: "Mauricio",      apellido: "Porras" },
  { correo: "jsaldarriaga@gi.edu.co",  nombre: "Sebastián",     apellido: "Saldarriaga" },
];

interface TeacherRow {
  idProfesor: string;
  nombre: string;
  apellido: string;
  correo: string | null;
}

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`ACTUALIZACIÓN DE CORREOS DE PROFESORES — ${DRY_RUN ? "MODO DRY-RUN" : "MODO REAL"}`);
  console.log(`Lee el mapeo fijo de correos del Excel (${EMAIL_MAP.length} profesores).`);
  console.log(`${"=".repeat(60)}\n`);

  let updated = 0;
  let newEmail = 0;
  let alreadyOk = 0;
  let notFound: string[] = [];
  const errors: string[] = [];

  for (const entry of EMAIL_MAP) {
    const existing = (
      await sql`SELECT "idProfesor", "nombre", "apellido", "correo" FROM "Teacher" WHERE "nombre" = ${entry.nombre} AND "apellido" = ${entry.apellido} LIMIT 1`
    )[0] as TeacherRow | undefined;

    if (!existing) {
      notFound.push(`${entry.nombre} ${entry.apellido} (${entry.correo})`);
      continue;
    }

    if (existing.correo === entry.correo) {
      console.log(`  ✓ ${entry.nombre} ${entry.apellido} → ${entry.correo} (ya correcto)`);
      alreadyOk++;
      continue;
    }

    const change =
      existing.correo
        ? `✏ ${existing.correo} → ${entry.correo}`
        : `+ ${entry.correo}`;

    if (DRY_RUN) {
      console.log(`  ~ ${entry.nombre.padEnd(18)} ${entry.apellido.padEnd(16)} ${change} [DRY-RUN]`);
    } else {
      await sql`UPDATE "Teacher" SET "correo" = ${entry.correo} WHERE "idProfesor" = ${existing.idProfesor}`;
      console.log(`  ${existing.correo ? "✓" : "+"} ${entry.nombre.padEnd(18)} ${entry.apellido.padEnd(16)} ${change}`);
    }

    if (existing.correo) updated++;
    else newEmail++;
  }

  // Report teachers still without email
  const allTeachers = (await sql`SELECT "idProfesor", "nombre", "apellido", "correo" FROM "Teacher" ORDER BY "apellido"`) as unknown as TeacherRow[];
  const pending = allTeachers.filter((t) => !t.correo);

  console.log(`\n${"=".repeat(60)}`);
  console.log("REPORTE");
  console.log(`${"=".repeat(60)}`);
  console.log(`Correos actualizados:   ${updated}`);
  console.log(`Correos nuevos:         ${newEmail}`);
  console.log(`Ya correctos:           ${alreadyOk}`);
  console.log(`Sin correo (restantes): ${pending.length}`);
  if (pending.length > 0) {
    console.log("\nProfesores que quedan SIN CORREO (no están en tu Excel):");
    for (const t of pending) console.log(`  · ${t.nombre} ${t.apellido}`);
  }
  if (notFound.length > 0) {
    console.log(`\nNO ENCONTRADOS por nombre (${notFound.length}):`);
    for (const n of notFound) console.log(`  ❌ ${n}`);
  }
  if (errors.length > 0) {
    console.log(`\nErrores (${errors.length}):`);
    for (const e of errors) console.log(`  ❌ ${e}`);
  }
  if (DRY_RUN) console.log("\nMODO DRY-RUN — no se aplicó ningún cambio.");
  console.log(`${"=".repeat(60)}\n`);

  if (!DRY_RUN && (errors.length > 0 || notFound.length > 0)) process.exit(1);
}

main().catch((e) => {
  console.error("Error fatal:", e);
  process.exit(1);
});
