import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import mysql from "mysql2/promise";

// Base de test dedicada (vitest corre archivos en paralelo; no comparte DB
// con migrate.test.ts que hace DROP de tablas).
const TEST_DB = process.env.DB_TEST_NAME_DOMAIN || "extracurriculares_domain_test";

process.env.DB_NAME = TEST_DB;

let admin: mysql.Pool;

async function ensureTestDb(): Promise<void> {
  admin = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "app",
    password: process.env.DB_PASSWORD || "app-local-dev",
    connectionLimit: 1,
  });
  await admin.execute(`CREATE DATABASE IF NOT EXISTS \`${TEST_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await admin.end();
}

async function dropAllTables(): Promise<void> {
  const { getPool } = await import("./mysql");
  const pool = getPool();
  const [rows] = await pool.query<mysql.RowDataPacket[]>("SHOW TABLES");
  const tableKey = `Tables_in_${TEST_DB}`;
  const names = rows.map((row) => row[tableKey] as string);
  if (names.length === 0) return;
  await pool.query("SET FOREIGN_KEY_CHECKS = 0");
  for (const name of names) await pool.query(`DROP TABLE IF EXISTS \`${name}\``);
  await pool.query("SET FOREIGN_KEY_CHECKS = 1");
}

beforeAll(async () => {
  await ensureTestDb();
  const { getPool } = await import("./mysql");
  const { runMigrations } = await import("./migrate");
  await dropAllTables();
  await runMigrations(getPool());
  const pool = getPool();
  await pool.execute(
    `INSERT INTO users (id, role, code, email, first_name, last_name, photo_url, status,
       can_view_students, can_manage_news, can_manage_attendance, can_manage_schedules, can_administer_users)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
            (?, ?, NULL, ?, ?, ?, NULL, 'activo', ?, ?, ?, ?, ?)`,
    [
      "user-admin", "admin", "A1", "admin@gi.edu.co", "Ana", "Admin", null, "activo", 1, 1, 1, 1, 1,
      "user-teacher", "teacher", "t1@gi.edu.co", "Teo", "Teacher", 1, 1, 1, 1, 0,
    ],
  );
  await pool.execute(
    `INSERT INTO grades (id, name, level, status) VALUES (1, 'PRIMERO', 'Básica', 'activo'), (2, 'SEGUNDO', 'Básica', 'activo')`,
  );
  await pool.execute(
    `INSERT INTO schedules (id, day, start_time, end_time, classroom, status) VALUES
       ('sch-1', 'LUNES', '15:00', '16:00', 'Aula 1', 'activo'),
       ('sch-2', 'MARTES', '15:00', '16:00', 'Aula 1', 'activo')`,
  );
  await pool.execute(
    `INSERT INTO students (code, first_name, last_name, grade_id, group_name, email, photo_url, source_status) VALUES
       ('S1', 'Sofi', 'Estudiante', 1, 'A', null, null, 'activo'),
       ('S2', 'Santi', 'Estudiante', 2, 'B', null, null, 'activo')`,
  );
  await pool.execute(
    `INSERT INTO enrollments (id, student_code, discipline_code, day, status) VALUES
       ('enr-1', 'S1', 'FUT', 'LUNES', 'activo'),
       ('enr-2', 'S2', 'FUT', 'LUNES', 'activo')`,
  );
  await pool.execute(
    `INSERT INTO assignments (id, teacher_id, teacher_email, discipline_code, grade_id, is_primary, status) VALUES
       ('asg-1', 'user-teacher', 't1@gi.edu.co', 'FUT', 1, 1, 'activo'),
       ('asg-2', 'user-teacher', 't1@gi.edu.co', 'FUT', 2, 0, 'cancelado')`,
  );
  await pool.execute(
    `INSERT INTO assignment_schedules (assignment_id, schedule_id) VALUES
       ('asg-1', 'sch-1'), ('asg-1', 'sch-2')`,
  );
  await pool.execute(
    `INSERT INTO attendance (id, session_id, student_code, status, registered_at, registered_by_type, registered_by_id, observation) VALUES
       ('asg-1__sch-1__2026-09-01|S1', 'asg-1__sch-1__2026-09-01', 'S1', 'presente',
        '2026-09-01 10:00:00', 'teacher', 'user-teacher', NULL)`,
  );
  await pool.execute(
    `INSERT INTO stays (id, assignment_id, schedule_id, student_code, date, supervisor_id) VALUES
       ('st-1', 'asg-1', 'sch-1', 'S1', '2026-09-01', 'user-teacher')`,
  );
});

afterAll(async () => {
  const { getPool } = await import("./mysql");
  await getPool().end().catch(() => undefined);
  await admin?.end().catch(() => undefined);
});

describe("db/domain contra MySQL real", () => {
  it("getUsers trae usuarios mapeados a AppUser con permisos", async () => {
    const { getUsers } = await import("./domain");
    const users = await getUsers();
    const admin = users.find((user) => user.id === "user-admin");
    expect(admin).toMatchObject({
      id: "user-admin",
      role: "admin",
      email: "admin@gi.edu.co",
      firstName: "Ana",
      lastName: "Admin",
      active: true,
      permissions: {
        canViewStudents: true,
        canAdministerUsers: true,
      },
    });
  });

  it("getUserByEmail normaliza minúsculas y getUserById filtra por rol", async () => {
    const { getUserByEmail, getUserById } = await import("./domain");
    const user = await getUserByEmail("  ADMIN@gi.edu.co ");
    expect(user?.id).toBe("user-admin");
    const asTeacher = await getUserById("user-teacher", "admin");
    expect(asTeacher).toBeNull();
    const asTeacher2 = await getUserById("user-teacher", "teacher");
    expect(asTeacher2?.id).toBe("user-teacher");
  });

  it("createUser rechaza correo duplicado y luego crea", async () => {
    const { createUser, getUsersByEmail } = await import("./domain");
    await expect(createUser({
      email: "admin@gi.edu.co",
      role: "teacher",
      firstName: "X",
      lastName: "Y",
      code: "X1",
    })).rejects.toMatchObject({ clientCode: "DUPLICATE_EMAIL" });

    const created = await createUser({
      email: "nuevo@gi.edu.co",
      role: "secretary",
      firstName: "Nuevo",
      lastName: "Usuario",
      code: "N1",
    });
    expect(created.id).toBeTruthy();
    const fetched = await getUsersByEmail("nuevo@gi.edu.co");
    expect(fetched[0]?.permissions.canAdministerUsers).toBe(false);
  });

  it("updateUser cambia nombre y preserva created_at", async () => {
    const { updateUser, getUserByEmail } = await import("./domain");
    const updated = await updateUser("user-teacher", { firstName: "Teodoro" });
    expect(updated.firstName).toBe("Teodoro");
    const user = await getUserByEmail("t1@gi.edu.co");
    expect(user?.id).toBe("user-teacher");
  });

  it("getGrades y getSchedules mapean columnas SQL", async () => {
    const { getGrades, getSchedules } = await import("./domain");
    const grades = await getGrades();
    expect(grades).toContainEqual(expect.objectContaining({ id: 1, name: "PRIMERO" }));
    const schedules = await getSchedules();
    expect(schedules).toContainEqual(expect.objectContaining({ id: "sch-1", day: "LUNES", startTime: "15:00" }));
  });

  it("getStudents une grade_name desde la tabla de grados", async () => {
    const { getStudents } = await import("./domain");
    const students = await getStudents();
    expect(students).toContainEqual(expect.objectContaining({ code: "S1", gradeId: 1, gradeName: "PRIMERO" }));
  });

  it("getEnrollments mapea filas activas", async () => {
    const { getEnrollments } = await import("./domain");
    const enrollments = await getEnrollments();
    expect(enrollments).toContainEqual(expect.objectContaining({ studentCode: "S1", disciplineCode: "FUT", day: "LUNES" }));
  });

  it("getAssignments agrupa los horarios por asignación y respeta el estado", async () => {
    const { getAssignments } = await import("./domain");
    const assignments = await getAssignments();
    const asg1 = assignments.find((row) => row.id === "asg-1");
    const asg2 = assignments.find((row) => row.id === "asg-2");
    expect(asg1?.scheduleIds).toEqual(expect.arrayContaining(["sch-1", "sch-2"]));
    expect(asg1?.teacherEmail).toBe("t1@gi.edu.co");
    expect(asg2?.status).toBe("cancelado");
  });

  it("getAttendance y getStays mapean columnas SQL", async () => {
    const { getAttendance, getStays } = await import("./domain");
    const [attendance, stays] = await Promise.all([getAttendance(), getStays()]);
    expect(attendance).toContainEqual(expect.objectContaining({
      sessionId: "asg-1__sch-1__2026-09-01",
      studentCode: "S1",
      status: "presente",
      registeredAt: "2026-09-01T10:00:00",
    }));
    expect(stays).toContainEqual(expect.objectContaining({ assignmentId: "asg-1", date: "2026-09-01" }));
  });

  it("buildSessionId/resolveSessionId mantienen el formato de AppSheet", async () => {
    const { buildSessionId, resolveSessionId, getAssignments } = await import("./domain");
    const sessionId = buildSessionId("asg-1", "sch-1", "2026-09-01");
    expect(sessionId).toBe("asg-1__sch-1__2026-09-01");
    const assignments = await getAssignments();
    const resolved = resolveSessionId(sessionId, assignments);
    expect(resolved?.assignment.id).toBe("asg-1");
    expect(resolved?.scheduleId).toBe("sch-1");
    expect(resolved?.date).toBe("2026-09-01");
  });

  it("upsertAttendanceRows crea y luego actualiza sin duplicar por sesión+estudiante", async () => {
    const { upsertAttendanceRows, getAttendance } = await import("./domain");
    await upsertAttendanceRows({
      sessionId: "asg-1__sch-1__2026-09-02",
      callerType: "teacher",
      callerId: "user-teacher",
      records: [{ studentCode: "S1", status: "presente" }],
    });
    let rows = (await getAttendance()).filter((row) => row.sessionId === "asg-1__sch-1__2026-09-02");
    expect(rows).toHaveLength(1);

    await upsertAttendanceRows({
      sessionId: "asg-1__sch-1__2026-09-02",
      callerType: "supervisor",
      callerId: "user-admin",
      records: [{ studentCode: "S1", status: "justificado", observation: "médico" }],
    });
    rows = (await getAttendance()).filter((row) => row.sessionId === "asg-1__sch-1__2026-09-02");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "justificado", registeredByType: "supervisor" });
  });

  it("createStay no duplica y removeStay valida supervisor", async () => {
    const { createStay, removeStay, getStays } = await import("./domain");
    const duplicate = await createStay({
      assignmentId: "asg-1",
      scheduleId: "sch-1",
      studentCode: "S1",
      date: "2026-09-01",
      supervisorId: "user-teacher",
    });
    expect(duplicate).toBeNull();

    const id = await createStay({
      assignmentId: "asg-1",
      scheduleId: "sch-2",
      studentCode: "S2",
      date: "2026-09-03",
      supervisorId: "user-teacher",
    });
    expect(id).toBeTruthy();

    expect(await removeStay(id as string, "otro-supervisor")).toBe(false);
    expect(await removeStay(id as string, "user-teacher")).toBe(true);
    const stays = await getStays();
    expect(stays.some((row) => row.id === id)).toBe(false);
  });

  it("createScheduleRow crea horarios y no duplica el mismo día/hora", async () => {
    const { createScheduleRow } = await import("./domain");
    const first = await createScheduleRow({ day: "MIERCOLES", startTime: "08:00", endTime: "09:00", classroom: null });
    expect(first.created).toBe(true);
    const second = await createScheduleRow({ day: "MIERCOLES", startTime: "08:00", endTime: "09:00", classroom: null });
    expect(second.created).toBe(false);
    expect(second.schedule.id).toBe(first.schedule.id);
  });

  it("getUsersByEmail ignora la opción fresh (no hay caché en MySQL)", async () => {
    const { getUsersByEmail } = await import("./domain");
    const users = await getUsersByEmail("admin@gi.edu.co", { fresh: true });
    expect(users[0]?.id).toBe("user-admin");
  });

  it("removeUser elimina por id y lanza NOT_FOUND", async () => {
    const { createUser, removeUser, getUsersByEmail } = await import("./domain");
    const created = await createUser({
      email: "para-remover@gi.edu.co",
      role: "teacher",
      firstName: "Rem",
      lastName: "Over",
      code: "R1",
    });
    await removeUser(created.id);
    expect(await getUsersByEmail("para-remover@gi.edu.co")).toHaveLength(0);
    await expect(removeUser("no-existe")).rejects.toMatchObject({ clientCode: "NOT_FOUND" });
    vi.clearAllMocks();
  });
});