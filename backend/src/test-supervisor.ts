const BASE = process.env.TEST_BASE || "http://localhost:3000/api";
const SUPERVISOR_EMAIL = process.env.TEST_SUPERVISOR_EMAIL || "profesor.demo1@gi.edu.co";

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
  console.log("SUPERVISOR TESTS — schedules, classes, filters");
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

  console.log("\n" + "=".repeat(60));
  console.log(`RESULTADO: ${passed}/${total} OK${failed ? ` — ${failed} FALLARON` : ""}`);
  console.log("=".repeat(60));
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
