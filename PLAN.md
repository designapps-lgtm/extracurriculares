# PLAN DE MEJORAS INMEDIATAS — Plataforma Extracurriculares

## Contexto para el agente

- Monorepo con `backend/` (Express 4 + TypeScript + Prisma 5 + PostgreSQL) y `frontend/` (React 18 + Vite + Tailwind).
- **El repo NO tiene commits aún** (todo untracked). Sin framework de tests configurado en ninguno de los dos `package.json`. La "verificación" es `tsc` + `build` + smoke manual. NO agregues un test runner en esta pasada salvo que te lo pidan.
- Ya existe una revisión completa del código. El plan baja los hallazgos a tareas accionables con `file:line`.
- **IMPORTANTE — no rompas el contrato de la API**: el frontend consume los shapes actuales. Cuando cambies `select`/respuestas, verificá contra los consumidores (detallado en cada fase).

## Reglas de oro para el agente

1. **Seguí el patrón existente del módulo PÚBLICO** (controller delgado → service que devuelve datos → routes). Es la referencia de calidad del repo.
2. **Nunca pongas passwords/hashes en respuestas** ni en `console.log`. Nunca introduzcas credenciales hardcodeadas.
3. `useEffect`/`useCallback` correctos; **nada de `setTimeout` para esquivar closures**.
4. No agregues dependencias fuera de las indicadas. Si un paquete no está instalado, `npm install <paquete>` en la carpeta correcta.
5. No agregues comentarios de relleno. Los únicos comentarios nuevos: explicar decisiones no obvias.
6. Después de CADA fase corré el typecheck/build correspondiente. No dejes la build rota al finalizar tu turno.
7. Commits con conventional commits (`fix:`, `feat:`, `chore:`, `refactor:`) separados por fase, **sin atribución de IA**.

---

## FASE 0 — Baseline (5 min)

- Corré `npm run build` en `backend/` y `frontend/`. Anotá si ya rompe antes de tocar nada.
- Commit inicial de baseline: `git add -A && git commit -m "chore: baseline del proyecto"` (así todos los cambios de las fases quedan revisables).

---

## FASE 1 — 🔴 Críticos de seguridad backend (prioridad máxima)

### 1.1 Exposición de `passwordHash` en rutas públicas de teachers
**Problema**: `backend/src/modules/teachers/teacher.service.ts:29-37` (`getTeachers`) y `:42-53` (`getTeacherById`) hacen `findMany`/`findUnique` SIN `select` → devuelven `passwordHash` de todos los docentes en `GET /api/teachers` y `/api/teachers/:id` (rutas públicas, `app.ts:44`).

**Acción**:
1. En `getTeachers`: reemplazá el `findMany` por uno con `select` explícito con TODOS los campos no sensibles que el frontend consume.
   - Consumidores a respetar: `frontend/src/services/teachers.ts:4,17` → `pages/Teachers.tsx:32` (usa `data`, `meta`, `nombre`, `apellido`, `_count.assignments`, `fotoUrl`) y `pages/TeacherDetail.tsx:34` (`getTeacherById`). Verificá qué campos renderizan antes de armar el `select`.
   - Campos del modelo (schema.prisma:60-78): `idProfesor, codigoProfesor, nombre, apellido, correo, fotoUrl, estado, createdAt, updatedAt` + `_count.assignments`. **Excluí `passwordHash`**.
2. Idem en `getTeacherById` (`:42-53`).
3. Mismo arreglo en la capa admin (está autenticada pero por higiene): `backend/src/modules/admin/teacherAdmin.service.ts` — las funciones que listan/detallan teachers (usa `select` con `idProfesor, codigoProfesor, nombre, apellido, correo, fotoUrl, estado`).
4. **Verificar**: `grep` global a que `passwordHash` no aparezca en ningún `findMany`/`findUnique` de la capa pública de teachers. `npm run build` en backend. Levantar backend y `curl` localhost:3000/api/teachers | verificar que no existe `passwordHash` en la respuesta.

### 1.2 Contraseña por defecto `"admin123"`
**Problema**: `backend/src/modules/admin/adminUser.service.ts:22` — `bcrypt.hash(password || "admin123", 12)` crea un admin con password conocida si el body no manda `password`.

**Acción**:
- Exigí `password` siempre: si falta o es `< 6` chars → `throw new AppError(400, "VALIDATION_ERROR", "La contraseña debe tener al menos 6 caracteres")` (mismo mensaje que `resetPassword` en `:73-75`).
- Eliminá el fallback `|| "admin123"`.
- **Verificar**: `createAdmin` sin password → 400; con password válida → 201. Build.

### 1.3 JWT secret con fallback hardcodeado
**Problema**: `backend/src/config/index.ts:9` — `process.env.JWT_SECRET || "dev-secret-change-in-production"` sin validación en producción.

**Acción**:
- En `config/index.ts`: si `NODE_ENV === "production"` y falta `JWT_SECRET` → `throw new Error("JWT_SECRET es obligatorio en producción")` (fail-fast al arrancar).
- En dev podés mantener el default, pero que quede explícito un `console.warn`.
- **Verificar**: con `NODE_ENV=production` y sin JWT_SECRET el server no arranca.

### 1.4 Bug: filtros `disciplina` + `inscrito` se pisan
**Problema**: `backend/src/modules/students/student.service.ts:27-35` — ambos filtros escriben sobre `where.studentSchedules`, el segundo pisa al primero.

**Acción**:
- Lógica combinada correcta:
  - `inscrito === "true"` → `studentSchedules: { some: { ...(disciplina && { codigoDisciplina: disciplina }) } }`
  - `inscrito === "false"` → `studentSchedules: { none: {} }` (sin disciplina; si venía disciplina, se ignora — documentalo en una línea)
  - Solo `disciplina` (sin inscrito) → `studentSchedules: { some: { codigoDisciplina: disciplina } }`
- **Verificar**: build + `curl '/api/students?disciplina=XC_...&inscrito=true'` → los resultados respetan AMBOS filtros.

---

## FASE 2 — 🔴 Críticos funcionales frontend

### 2.1 Inputs pierden el foco (form definido dentro del componente)
**Problema**: `frontend/src/pages/admin/AdminTeachers.tsx:327-391` — `TeacherForm` está definido DENTRO del cuerpo de `AdminTeachers`; en cada keystroke React remonta el subtree y el input pierde el foco.

**Acción**:
- Extraer `TeacherForm` a nivel de módulo (fuera del cuerpo del componente), pasándole `form`, `setForm`, `onSave`, `onCancel` como props. Mínimo: top-level en el mismo archivo.
- **Recomendado**: creá `frontend/src/components/forms/TeacherForm.tsx` (mirá la convención de `components/` existente).
- **Verificar**: escribir en "Nombre" sin perder el foco. Build frontend.

### 2.2 Links rotos del Dashboard admin
**Problema**: `frontend/src/pages/Dashboard.tsx:257,264,270,294,373` apuntan a rutas absolutas inexistentes (`/students`, `/disciplines`, `/teachers`). Las rutas reales viven bajo `/admin/*` (`App.tsx:36-48`). Todo cae al fallback → redirige al login del teacher.

**Acción** (respetar la ruta correcta en `App.tsx`):
- `:257` → `/admin/students`
- `:264` y `:294` → `/admin/disciplines` (y `/admin/disciplines/${d.codigoDisciplina}` donde aplique — revisá el bloque completo, hay más links de disciplina/profesor)
- `:270` y `:373` → `/admin/teachers` (para las cards de profesor que linkean a detalle, `/admin/teachers/${t.idProfesor}` — existe en `App.tsx:45`)
- Revisá `frontend/src/pages/Teachers.tsx:95` (`to={/teachers/${id}}`) → debe ser `/admin/teachers-view/${id}` (la ruta es `App.tsx:43`).
- `TeacherDetail.tsx` link "Volver": que respete de dónde venís (o vaya a la vista consistente).
- **Verificar**: desde `/admin/dashboard`, clickear cada acceso rápido y card → cae en la página correcta, no en el login.

### 2.3 Stale closure en filtros de AdminStudents
**Problema**: `frontend/src/pages/admin/AdminStudents.tsx:101,111` — `setTimeout(() => load(1), 0)` captura estado viejo; el refetch usa el filtro anterior.

**Acción**:
- Reemplazá el patrón por un `useEffect` con deps `[page, debouncedSearch, filterGrado, filterInscrito]` que llame a `load()` (patrón que ya usa `Students.tsx:78-84`). Eliminá los `setTimeout`.
- **Verificar**: cambiar el `<select>` de grado filtra la lista con el valor recién elegido.

---

## FASE 3 — 🟠 Seguridad de infraestructura (rápida, alto valor)

### 3.1 Rate limiting en endpoints de auth
- Instalá `express-rate-limit` en `backend/`.
- Aplicá un limiter (ej. 10 req/15 min por IP) sobre: `/api/admin/auth/login`, `/api/admin/auth/bootstrap`, `/api/teacher/auth/login` y refresh. Creá un middleware reutilizable en `backend/src/middlewares/rateLimit.ts`.
- **Verificar**: 11 login fallidos seguidos → 429.

### 3.2 Helmet + quitar fingerprint
- Instalá `helmet` en `backend/`; `app.use(helmet())` en `backend/src/app.ts:34` (antes de rutas).
- `app.disable("x-powered-by")`.
- **Verificar**: headers `X-Content-Type-Options`, `X-Frame-Options` presentes en una respuesta.

### 3.3 Mapear errores de Prisma en el errorHandler
**Problema**: `backend/src/middlewares/errorHandler.ts:62-76` — todo lo que no es `AppError` da 500. Un `P2025` o `P2002` debería ser 404/409.

**Acción**:
- En el `errorHandler`, antes del fallback genérico, detectá errores Prisma por `err.code`:
  - `P2002` → 409 `DUPLICATE_ENTITY`
  - `P2025` → 404 `NOT_FOUND`
  - `P2003`/`P2014` → 409 `FK_VIOLATION`
- **Verificar**: forzar un update con id inexistente → 404 y no 500.

---

## FASE 4 — 🟠 Uniformizar la capa admin (deuda estructural principal)

**Objetivo**: que admin siga el MISMO patrón que los módulos públicos (controller delgado + service que devuelve datos + `asyncHandler`).

### 4.0 Patrón objetivo (seguir EXACTAMENTE para todo lo que sigue)
- `service` → exporta funciones que devuelven datos (`Promise<T>`), NUNCA tocan `req`/`res`, lanzan `AppError`.
- `controller` → extrae `req.params/query/body`, llama al service, responde `res.json({ success: true, data })`. Envuelto con `asyncHandler` (el que ya existe para admin en `errorHandler.ts`).
- `routes` → solo declara endpoints + middleware + handlers.

### 4.1 Arreglar paginación admin (bug real: page/limit negativos → 500)
- Reemplazar el cálculo manual (`parseInt((req.query.page as string) || "1")` + `Math.min(..., 100)`) por `parsePagination` (`backend/src/utils/pagination.ts:16-33`) en:
  - `admin/assignmentAdmin.service.ts:7-8,38`
  - `admin/studentAdmin.service.ts:8-9,47`
  - `admin/teacherAdmin.service.ts:8-9,35`
  - `admin/disciplineAdmin.routes.ts:9-10,35`
  - `admin/scheduleAdmin.routes.ts:45-46,65`
- Esto arregla `?page=0` y `?limit=-5` y elimina 5 duplicaciones.
- **Verificar**: `curl '?page=0'` → 200 (clamped a 1), no 500.

### 4.2 Extraer lógica de negocio que vive inline en rutas admin
- `admin/disciplineAdmin.routes.ts:8-37` → crear `disciplineAdmin.service.ts` (o usar el `discipline.service.ts` existente) + controller.
- `admin/scheduleAdmin.routes.ts:21-76` → extraer `normalizeTime`, `DIAS_VALIDOS` y las operaciones a un service; mover validaciones a `backend/src/utils/validators.ts`.
- `admin/gradeAdmin.routes.ts:7-13` y `admin/dashboardAdmin.routes.ts:7-44` → idem.
- **Verificar**: build + smoke de cada endpoint admin (CRUD disciplinas, horarios, grados, dashboard).

### 4.3 Convertir los services admin `req/res` a "devuelven datos"
Archivos a convertir (orden sugerido por riesgo creciente): `adminUser.service.ts`, `assignmentAdmin.service.ts`, `studentAdmin.service.ts`, `teacherAdmin.service.ts`, `admin/auth.service.ts`. Cada uno: crear su controller, mover la firma, actualizar rutas. **Respetá los shapes de respuesta que consume el frontend** (`frontend/src/services/admin.ts` + páginas `Admin*.tsx`).

### 4.4 Deduplicar `assignmentInclude`
- Extraer a `backend/src/utils/prismaIncludes.ts` el objeto que está repetido en `discipline.service.ts:7-15`, `teachers/teacher.service.ts:7-15`, `assignments/assignment.service.ts:7-16` (y reemplazar las 5 variantes inline de `assignmentAdmin.service.ts:22-27,45-50,98-103,168-173,192-197` y `grade.service.ts:62-70`).

### 4.5 (Opcional, si sobra tiempo) helper `getOr404` y tipar `PaginatedResult<T>`
- Helper `getOr404(() => prisma.x.findUnique(...), "CODE", "MSG")` para eliminar los ~12 chequeos 404 repetidos.
- Reemplazar `PaginatedResult<unknown>` por `PaginatedResult<Student>`, `PaginatedResult<Discipline>`, etc. en los 7 services que lo usan.

---

## FASE 5 — 🟡 Higiene del repo y código muerto

### 5.1 Eliminar/mover leftover de desarrollo (verificado: nada los referencia)
- **Eliminar**: `backend/src/import/analyzeExcel.ts`, `backend/src/import/detailedAnalysis.ts`, `backend/src/import/verifyAnalysis.ts`, `backend/prisma/test-relations.ts` (además no compila contra el schema actual).
- **Scrub de credenciales reales**: `backend/src/test-admin.ts:23,45` contienen `senatics@gi.edu.co / admin123`. Reemplazá por credenciales fake (`admin@test.local` / `test-password`). Revisá también `backend/src/test-api.ts`.
- **Excluir del build**: en `backend/tsconfig.json` agregá a `exclude`: `src/test-*.ts`, `src/audit.ts`. (`src/import/*` son CLIs legítimos vía ts-node, pero no necesitan ir al `dist/` — excluilos también si no rompen los scripts de `package.json`).
- **Verificar**: `npm run build` backend pasa; `npx ts-node src/test-api.ts` sigue andando (contra localhost:3000).

### 5.2 Código muerto frontend (verificado: no se importan)
- `frontend/src/components/layout/Layout.tsx` y `Navbar.tsx` — importados solo entre sí. Eliminarlos (o si querés revivir el portal público, cablearlos al router — eso es una decisión de producto, no la tomes vos: **eliminá**).
- `frontend/src/pages/admin/AdminDashboard.tsx` — nunca se importa (ruta `dashboard` usa `Dashboard.tsx`). Eliminar.
- En `frontend/src/types/index.ts`: `ApiResponse<T>` y `ApiError` sin uso → usarlos en los services (unificar) o eliminarlos. **Recomendado**: usarlos en `services/admin.ts` y `services/teacher.ts` para matar de paso el `any` sistemático (ver 5.3).
- `frontend/src/hooks/index.ts` (`useFetch`), `frontend/src/utils/format.ts`, la cola muerta `refreshQueue` en `services/api.ts:28-29,49` (verificá que nada haga push antes de quitarla) → eliminar o completar.

### 5.3 Tipar la capa admin
- Reemplazar `{ success: boolean; data: any[]; meta: any }` en `frontend/src/services/admin.ts` (17 ocurrencias) y `teacher.ts` (5) por tipos reales: importá los tipos de `frontend/src/types/index.ts` (ya existen `Student`, `Teacher`, `Discipline`, `Grade`, `Schedule`, `Assignment`).
- Eliminar las re-definiciones locales de tipos en `AdminStudents.tsx:5-21`, `AdminTeachers.tsx:19-63`, `AdminAssignments.tsx:16-40` e importar los de `types/index.ts`.
- **Verificar**: `npm run build` frontend pasa con `strict`.

### 5.4 Componentes de UI duplicados
- Extraer a `frontend/src/components/common/`: `Pagination` (4 copias: `Students.tsx:266-312`, `AdminStudents.tsx:174-196`, `AdminTeachers.tsx:524-546`, `AdminAssignments.tsx:341-363`), `Avatar` (6 copias de `AVATAR_COLORS`), `Loading` (reemplazar los 8 spinners inline).
- Reemplazar las 4 paginaciones por el componente nuevo (mismo markup y comportamiento).

---

## FASE 6 — 🟡 Robustez de importers y seed (opcional si el agente tiene presupuesto)

- **Exit codes**: en `importStudents.ts:105-109` y `importOffer.ts:424-428`, salir con código 1 si hubo errores (`errors > 0`). Reportes no mintiendo: `importOffer.ts:405-406` imprime totales, no creados.
- **`process.exit(1)` a mitad** en `importOffer.ts:288,304` → refactor para validar grados/disciplinas ANTES de escribir, o envolver en `$transaction`.
- **Duplicados de barcode**: en `excelValidator.ts:65-67`, además de reportarlos, EXCLUIRLOS del set `valid` (hoy se importan y el segundo pisa al primero).
- **`seed.ts`**: es un no-op que confunde (`backend/prisma/seed.ts:5-7`). Reemplazarlo por un seed real que cree un admin inicial con password leída de env (o, si no, eliminarlo de `package.json` y documentar que el "seed" son los importers).
- **Estudiantes ausentes**: `studentImporter.ts:96-102` detecta ausentes pero no los desactiva → marcarlos `estado: "inactivo"` (el modelo ya tiene el campo).

---

## Verificación global (correr al final de TODO)

```bash
# Backend
cd backend && npm run build          # tsc sin errores
# Frontend
cd frontend && npm run build         # tsc -b && vite build sin errores
```

Smoke manual con `docker compose up` + backend levantado:
- `GET /api/teachers` → sin `passwordHash`
- `POST /api/admin/admins` sin password → 400
- `GET /api/students?disciplina=XC_...&inscrito=true` → filtros combinados
- Login admin con password incorrecta x10 → 429
- `/admin/dashboard` → accesos rápidos navegan bien, inputs no pierden foco

## Criterios de aceptación (definition of done)

1. `npm run build` verde en backend y frontend al final de CADA fase.
2. Ningún endpoint devuelve `passwordHash`.
3. Ningún password hardcodeado en `src/` (grep de `admin123` = 0 resultados).
4. La capa admin usa el mismo patrón controller/service que la pública.
5. Cero componentes definidos dentro de otros componentes (grep de patrones sospechosos).
6. Cero archivos de debug/leftover en `src/` y `prisma/` (los listados en Fase 5.1).
