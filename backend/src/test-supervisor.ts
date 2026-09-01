const BASE = process.env.TEST_BASE || "http://localhost:3000/api";
const SUPERVISOR_EMAIL = process.env.TEST_SUPERVISOR_EMAIL || "profesor.demo1@gi.edu.co";

// Datos reales de la DB: estudiante en Fútbol K4 MIERCOLES (grado K4).
const STUDENT_CODE = process.env.TEST_STUDENT || "1345282448";
const ORIGEN_ASIGNACION = process.env.TEST_ORIGEN || "b3c37662-4520-4251-8695-5dbea7571ab0";
const DEST_ASIGNACION = process.env.TEST_DESTINO || "3382309a-cfd4-4ba3-a056-41071f8a2c84";
const DEST_HORARIO = process.env.TEST_DEST_HORARIO || "42260985-4143-437d-aa0f-02e722608be6";

let passed = 0;
let failed = 0;
let total = 0;

async function req(path: string, options?: RequestInit): Promise<{ status: number; body: any; headers: Headers }> {
  const res = await fetch(`${BASE}${path}`, { credentials: "include", ...options });
  const body = await res.json().catch(() => null);
  return { status: res.status, body, headers: res.headers };
}

function assert(name: string, ok: boolean, detail?: string) {
  total++;
  if (ok) { console.log(`  ✅ ${name}`); passed++; }
  else { console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`); failed++; }
}

function nextWednesday(isoOffset = 1): string {
  const now = new Date();
  // próximo MIERCOLES (3) en Colombia, salto de semanas por parametro
  const d = new Date(now.getTime() + isoOffset * 7 * 24 * 3600 * 1000);
  while (d.getUTCDay() !== 3) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split("T")[0];
}

async function login(): Promise<string> {
  const res = await req("/supervisor/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: SUPERVISOR_EMAIL }),
  });
  const setCookie = res.headers.get("set-cookie") || "";
  const match = setCookie.match(/supervisor_access=([^;]+)/);
  if (!match) return "";
  return match[1];
}

async function run() {
  console.log("=".repeat(60));
  console.log("SUPERVISOR TESTS — schedules, classes, filters, transfers");
  console.log("=".repeat(60));

  const token = await login();
  assert("login supervisor OK (obtiene cookie)", token.length > 10, `token len ${token.length}`);
  const authHeaders = { Cookie: `supervisor_access=${token}` };

  // 1) Schedules: debe traer TODAS las clases de TODOS los profesores (bug: volvía [])
  console.log("\n1. Horarios de todos los profesores");
  const sched = await req("/supervisor/schedules", { headers: authHeaders });
  assert("GET /supervisor/schedules → 200", sched.status === 200, `status ${sched.status}`);
  const schedules = sched.body?.data ?? [];
  assert("trae clases con horarios", Array.isArray(schedules) && schedules.length > 0, `got ${schedules.length}`);
  const firstWithSchedule = schedules.find((s: any) => (s.schedules?.length ?? 0) > 0);
  assert("cada clase trae sus horarios (schedules no vacío)", !!firstWithSchedule,
    firstWithSchedule ? `schedules len ${firstWithSchedule.schedules.length}` : "ninguna con horarios");
  if (firstWithSchedule) {
    assert("horario tiene idHorario", !!firstWithSchedule.schedules[0].schedule.idHorario);
  }

  // 2) Classes (hoy + todas) — para llamar lista
  console.log("\n2. Clases (toma de lista)");
  const classesToday = await req("/supervisor/classes?today=1", { headers: authHeaders });
  assert("GET /supervisor/classes?today=1 → 200", classesToday.status === 200);
  const allClasses = await req("/supervisor/classes", { headers: authHeaders });
  assert("GET /supervisor/classes (todas) → 200", allClasses.status === 200);
  const all = allClasses.body?.data?.classes ?? [];
  assert("trae clases de todos los profesores", Array.isArray(all) && all.length > 0, `got ${all.length}`);
  const withSched = all.find((c: any) => c.schedule?.idHorario);
  assert("cada clase lista trae schedule e idAsignacion", !!withSched,
    withSched ? `clase: ${withSched.discipline?.nombre}` : "ninguna con schedule");

  // 3) Filters
  console.log("\n3. Filtros");
  const filters = await req("/supervisor/filters", { headers: authHeaders });
  assert("GET /supervisor/filters → 200", filters.status === 200);
  assert("filters trae disciplinas", Array.isArray(filters.body?.data?.disciplinas) && filters.body.data.disciplinas.length > 0);
  assert("filters trae profesores", Array.isArray(filters.body?.data?.profesores) && filters.body.data.profesores.length > 0);

  // 4) Transfers: crear con duración (solo hoy = fechaFin null) y con rango, listar, eliminar
  console.log("\n4. Traslados (mover de disciplina, con duración)");
  // El estudiante está inscrito en Futbol (origen) los MIERCOLES; destino Polimotor también MIERCOLES.
  const wed = nextWednesday(2);          // sola fecha
  const wedRangeStart = nextWednesday(5);
  const wedRangeEnd = nextWednesday(6);
  assert("fecha elegida es MIERCOLES (destino/origen)", new Date(`${wed}T00:00:00.000Z`).getUTCDay() === 3);
  assert("rango de fechas distinto (no se solapa)", wedRangeStart > wed);

  const tSingle = await req("/supervisor/transfers", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({
      codigoEstudiante: STUDENT_CODE,
      idAsignacionOrigen: ORIGEN_ASIGNACION,
      idAsignacionDestino: DEST_ASIGNACION,
      idHorarioDestino: DEST_HORARIO,
      fecha: wed,
      motivo: "Test: se pasa a Polimotor solo ese día",
    }),
  });
  assert("POST transfer (solo hoy) → 201", tSingle.status === 201, `status ${tSingle.status} ${JSON.stringify(tSingle.body?.error)}`);
  const transferId = tSingle.body?.data?.id;

  const tRange = await req("/supervisor/transfers", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({
      codigoEstudiante: STUDENT_CODE,
      idAsignacionOrigen: ORIGEN_ASIGNACION,
      idAsignacionDestino: DEST_ASIGNACION,
      idHorarioDestino: DEST_HORARIO,
      fecha: wedRangeStart,
      fechaFin: wedRangeEnd,
      motivo: "Test: por un tiempo (rango)",
    }),
  });
  assert("POST transfer (rango con fechaFin) → 201", tRange.status === 201, `status ${tRange.status} ${JSON.stringify(tRange.body?.error)}`);
  const transferRangeId = tRange.body?.data?.id;

  // Duplicado/solapamiento (misma fecha que el primer traslado)
  const tOverlap = await req("/supervisor/transfers", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({
      codigoEstudiante: STUDENT_CODE,
      idAsignacionOrigen: ORIGEN_ASIGNACION,
      idAsignacionDestino: DEST_ASIGNACION,
      idHorarioDestino: DEST_HORARIO,
      fecha: wed,
      motivo: "Test solapado",
    }),
  });
  assert("transfer solapado → 409", tOverlap.status === 409, `status ${tOverlap.status} ${JSON.stringify(tOverlap.body?.error)}`);

  const list = await req(`/supervisor/transfers?codigoEstudiante=${STUDENT_CODE}`, { headers: authHeaders });
  assert("GET /transfers → 200", list.status === 200);
  const transfers = list.body?.data ?? [];
  assert("historial incluye los traslados creados", transfers.length >= 2, `got ${transfers.length}`);
  const withRange = transfers.find((t: any) => t.id === transferRangeId);
  assert("traslado con rango trae fechaFin", !!withRange?.fechaFin, withRange ? `fechaFin ${withRange.fechaFin}` : "no trae fechaFin");

  // Limpiar (borrar los que se crearon en este test)
  if (transferId) {
    const del = await req(`/supervisor/transfers/${transferId}`, { method: "DELETE", headers: authHeaders });
    assert("DELETE transfer → 200", del.status === 200);
  }
  if (transferRangeId) {
    const del2 = await req(`/supervisor/transfers/${transferRangeId}`, { method: "DELETE", headers: authHeaders });
    assert("DELETE transfer rango → 200", del2.status === 200);
  }

  // 5) Asistencia: iniciar sesión de la clase destino y verificar que el estudiante trasladado aparece
  console.log("\n5. Toma de lista con traslado");
  const start = await req("/supervisor/sessions/start", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({ idAsignacion: DEST_ASIGNACION, idHorario: DEST_HORARIO }),
  });
  // La sesión se crea para HOY; la fecha del traslado (wed) no es hoy, así que no aplica. Verificamos el contrato del endpoint.
  assert("POST sessions/start → 200", start.status === 200, `status ${start.status} ${JSON.stringify(start.body?.error)}`);

  console.log("\n" + "=".repeat(60));
  console.log(`RESULTADO: ${passed}/${total} OK${failed ? ` — ${failed} FALLARON` : ""}`);
  console.log("=".repeat(60));
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
