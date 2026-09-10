# Extracurriculares — Plataforma de gestión

Sistema web para gestionar actividades extracurriculares, usuarios, asignaciones, asistencia y permanencias de un colegio.

## Arquitectura vigente

- **Frontend:** React 18, TypeScript, Vite y Tailwind CSS.
- **API:** Express 4 y TypeScript sobre Node.js.
- **Fuente de verdad:** MySQL local (dev) o servidor real (producción). La capa AppSheet académica fue migrada y retirada; solo sobrevive la consulta de novedades contra una app AppSheet separada (`Lector_QR`).
- **Autenticación:** Google Identity; sesiones JWT stateless en cookies `httpOnly`.
- **Desarrollo local:** Node.js 20 o Docker Compose.

Flujo principal:

```text
Navegador → Express (single-origin) → rutas /api → MySQL | AppSheet novedades
```

El backend sirve el build del frontend (`frontend/dist`) en el mismo origen cuando existe: `express.static` + fallback SPA para las rutas GET que no empiezan con `/api`. Así las cookies viajan first-party (sin CORS). La ruta del build se puede overridear con `FRONTEND_DIST`.

## Fuente de verdad y tablas

MySQL es la fuente autoritativa. El esquema vive en `backend/src/db/migrations/` (`001_schema.sql`, `002_enrollments_id.sql`):

- `users` (`Usuarios_Roles`): identidad, rol, estado y permisos.
- `students`, `grades`, `enrollments`, `schedules`, `assignments`, `assignment_schedules`: catálogos, inscripciones y asignaciones.
- `attendance`: asistencia por sesión.
- `stays`: permanencias registradas por supervisión.
- `reports`: reportes de problemas.
- `audit_log`: auditoría no bloqueante.
- `sync_state`: metadata del watch de Google Drive.
- `demographics` + `student_routes`: snapshot de origen y rutas del flujo de estudiantes.
- `novedades`: NO se persiste; se consulta en vivo desde AppSheet `Lector_QR`.

Las consultas de MySQL se ejecutan a través de la capa `backend/src/db/` (`mysql.ts`, `dates.ts`, `domain.ts`, `views.ts`, `audit.ts`).

## Autenticación

```text
Google ID token
  → POST /api/auth/google
  → verificación de audiencia, correo y dominio
  → búsqueda fresca en users
  → cookies access/refresh httpOnly del rol
```

Roles soportados: `admin`, `teacher`, `supervisor` y `secretary`. Login, refresh y `GET /api/auth/me` revalidan la cuenta. No existe autenticación local por contraseña.

El frontend llama a `/api/*` en su mismo dominio. Las cookies usan `Secure` en producción y `SameSite=Lax`; el login y refresh se validan contra la base cuando es un servidor relacional.

## Configuración

Copiar el ejemplo únicamente para desarrollo local:

```bash
cp .env.example .env
```

Variables server-only obligatorias en producción: `JWT_SECRET`, `GOOGLE_CLIENT_ID`, credenciales MySQL (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`). Variables no secretas principales: `FRONTEND_URL`, `ACCESS_TOKEN_EXPIRES_IN`, `SESSION_DURATION_HOURS`, `GOOGLE_INSTITUTION_DOMAIN`.

Novedades: `APPSHEET_NOVEDADES_APP_ID`, `APPSHEET_NOVEDADES_APPLICATION_ACCESS_KEY` y `APPSHEET_NOVEDADES_TABLE`. Si no están definidas, los endpoints de novedades responden vacíos. No exponga `JWT_SECRET` ni las llaves de AppSheet mediante variables `VITE_*`.

Consulte `.env.example` para el listado completo.

## Inicio local

### Docker Compose

```bash
docker compose up --build
```

| Servicio | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:3000 |

### Sin Docker

```bash
cd backend
npm ci
npm run dev
```

En otra terminal:

```bash
cd frontend
npm ci
npm run dev
```

### Modo producción single-origin (sin Vite)

```bash
cd frontend && npm ci && npm run build
cd ../backend && npm ci && npm run build
NODE_ENV=production FRONTEND_DIST=../frontend/dist npm start
```

Con `NODE_ENV=production` la app asume servidor single-origin: sirve `frontend/dist`, confía en el reverse proxy (`trust proxy`) y emite cookies `Secure`. Para probarlo contra `localhost` usá `NODE_ENV=development` (cookies sin `Secure`).

## API principal

### Estado

```http
GET /api/health
```

Una respuesta sana indica `status: "ok"`, `database: "connected"` y la cantidad de filas válidas de `users` observadas por el chequeo. `novedades: "appsheet"` cuando está configurada la app Lector_QR.

### Catálogos públicos

```text
GET /api/students
GET /api/students/:codigo
GET /api/students/:codigo/profile
GET /api/disciplines
GET /api/teachers
GET /api/grades
GET /api/assignments
GET /api/schedules
```

### Sesión unificada

```text
POST /api/auth/google
GET  /api/auth/me
POST /api/auth/logout
```

También se conservan rutas protegidas por rol bajo `/api/admin`, `/api/teacher`, `/api/supervisor` y `/api/secretary` para mantener el contrato actual del frontend.

## Asistencia

Sin una tabla separada de sesiones, la identidad se construye de forma determinística:

```text
SessionID    = <AsignacionID>__<HorarioID>__<YYYY-MM-DD>
AsistenciaID = <SessionID>|<CodigoEstudiante>
```

El roster combina `enrollments` y `stays`. Guardar asistencia separa altas y ediciones por `AsistenciaID`, por lo que repetir la operación actualiza filas existentes en lugar de crear duplicados. Históricos con identificadores opacos anteriores a esta convención no se atribuyen a una clase sin evidencia.

## Novedades

Las novedades se cargan en una aplicación AppSheet separada (`Lector_QR`) y se consultan directamente desde la tabla `Novedades_Diarias`. El backend usa un App ID y una llave server-only distintos de la (ya retirada) app académica. La vista de novedades vuelve a consultar la fuente cada 15 segundos mientras permanece abierta; no se mantiene una copia local.

## Migración AppSheet → MySQL

La migración one-shot vivió en `backend/src/db/migrate-appsheet.ts` y ya se ejecutó contra la base de desarrollo: leyó las tablas de AppSheet, deduplicó usuarios por jerarquía de rol (admin > secretary > supervisor > teacher) y volcó la data a MySQL en una transacción. Los volúmenes migrados y las particularidades (p. ej. `EC_Reportes_Problemas` no existía en AppSheet y se migró vacía; `InscripcionID` requería `VARCHAR(100)`) quedaron documentados en el historial de la rama `feature/santi`.

## Estructura relevante

```text
backend/
├── src/
│   ├── db/                  # mysql, migraciones, dates, domain, views, audit
│   ├── modules/
│   │   ├── appsheet/        # cliente HTTP de novedades (service + novedades)
│   │   ├── auth/            # Google, JWT y sesiones por cookies
│   │   ├── attendance/
│   │   ├── admin/
│   │   ├── teacher/
│   │   ├── supervisor/
│   │   └── secretary/
│   ├── middlewares/
│   ├── config/
│   ├── staticFiles.ts       # serving single-origin del build frontend
│   └── app.ts
└── migrations/              # SQL de schema (001, 002)

frontend/
├── src/
└── dist/                    # build servido por Express en producción
```

## Validación

```bash
cd backend
npm ci
npm test
npm run build

cd ../frontend
npm ci
npm run build
```

El despliegue y los smoke tests están documentados en `DEPLOY.md`.

## Limitaciones que requieren confirmación

- `EC_Traslados` no se usa hasta conocer su esquema real (no se migró).
- El inicio de una clase no persiste estado `en_curso`; la sesión queda materializada al guardar asistencia.
- Las novedades dependen de que la app `Lector_QR` responda; sin credenciales, los endpoints devuelven vacío.