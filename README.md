# Extracurriculares — Plataforma de gestión

Sistema web para gestionar actividades extracurriculares, usuarios, asignaciones, asistencia y permanencias de un colegio.

## Arquitectura vigente

- **Frontend:** React 18, TypeScript, Vite y Tailwind CSS; producción en Vercel.
- **API:** Express 4 y TypeScript, empaquetados como Cloudflare Worker.
- **Fuente de datos:** AppSheet sobre Google Sheets. No existe una réplica local ni un motor de datos adicional en runtime.
- **Autenticación:** Google Identity; sesiones JWT stateless en cookies `httpOnly`.
- **Desarrollo local:** Node.js 20 o Docker Compose.

Flujo principal:

```text
Navegador → Vercel /api/* → Cloudflare Worker → Express → servicios AppSheet → Google Sheets
```

El backend mantiene el contrato REST consumido por el frontend. Las rutas delegan en controladores/servicios y la integración externa está aislada en `backend/src/modules/appsheet/`.

## Fuente de verdad y tablas

AppSheet es la fuente autoritativa. Las tablas utilizadas por la API son:

- `Usuarios_Roles`: identidad, rol, estado y permisos.
- `EC_Estudiantes`, `EC_Grados` y `EC_Inscripciones`: catálogo e inscripciones.
- `EC_Horarios`, `Profesores_Horarios` y `EC_Asignacion_Horarios`: oferta y asignaciones.
- `EC_Asistencias`: asistencia por sesión.
- `EC_Permanencias`: permanencias registradas por supervisión.
- `EC_Auditoria`: auditoría no bloqueante.
- `EC_Sync_State`: metadata opcional del watch de Google Drive.
- `Demograficos`: snapshot de origen utilizado por el flujo de estudiantes.
- `EC_Traslados`: reservada; no tiene un endpoint activo mientras no se confirme su esquema.

Las lecturas tienen caché en memoria de 15 segundos por tabla dentro de cada instancia. Toda mutación invalida la tabla afectada. `Find` reintenta únicamente fallos temporales; `Add`, `Edit` y `Delete` no se reintentan para evitar duplicados.

## Autenticación

```text
Google ID token
  → POST /api/auth/google
  → verificación de audiencia, correo y dominio
  → búsqueda fresca en Usuarios_Roles
  → cookies access/refresh httpOnly del rol
```

Roles soportados: `admin`, `teacher`, `supervisor` y `secretary`. El estado y los permisos se leen de `Usuarios_Roles`. Login, refresh y `GET /api/auth/me` revalidan la cuenta. No existe autenticación local por contraseña.

El frontend llama a `/api/*` en su mismo dominio; `frontend/vercel.json` reescribe esas peticiones al Worker. Las cookies usan `Secure` en producción y `SameSite=Lax`.

## Configuración

Copiar el ejemplo únicamente para desarrollo local:

```bash
cp .env.example .env
```

Variables server-only obligatorias en producción:

```text
JWT_SECRET
GOOGLE_CLIENT_ID
APPSHEET_APPLICATION_ACCESS_KEY
```

Variables no secretas principales:

```text
FRONTEND_URL
ACCESS_TOKEN_EXPIRES_IN
SESSION_DURATION_HOURS
GOOGLE_INSTITUTION_DOMAIN
APPSHEET_APP_ID
APPSHEET_DEMOGRAFICOS_TABLE
```

`APPSHEET_NOVEDADES_TABLE` debe permanecer sin definir hasta contar con una tabla real. No exponga `JWT_SECRET`, la llave de AppSheet ni credenciales de Google mediante variables `VITE_*`.

Consulte `.env.example` para desarrollo y `backend/worker/wrangler.toml` para los bindings de producción.

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

Para probar el Worker localmente, cree `backend/worker/.dev.vars` sólo en su máquina con los secretos vigentes y ejecute:

```bash
cd backend/worker
npm ci
npm run dev
```

## API principal

### Estado

```http
GET /api/health
```

Una respuesta sana indica `status: "ok"`, `appsheet: "connected"` y la cantidad de filas válidas de `Usuarios_Roles` observadas por el chequeo.

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

El roster combina `EC_Inscripciones` y `EC_Permanencias`. Guardar asistencia separa altas y ediciones por `AsistenciaID`, por lo que repetir la operación actualiza filas existentes en lugar de crear duplicados. Históricos con identificadores opacos anteriores a esta convención no se atribuyen a una clase sin evidencia.

## Novedades

No hay una tabla de novedades válida configurada actualmente. Por seguridad operativa, los endpoints devuelven listas vacías mientras `APPSHEET_NOVEDADES_TABLE` no esté definida. Consulte `GOOGLE_DRIVE_NOVEDADES.md` antes de habilitarla.

## Estructura relevante

```text
backend/
├── src/
│   ├── modules/
│   │   ├── appsheet/       # cliente HTTP, repositorio, dominio, vistas y auditoría
│   │   ├── auth/           # Google, JWT y sesiones por cookies
│   │   ├── attendance/
│   │   ├── admin/
│   │   ├── teacher/
│   │   ├── supervisor/
│   │   └── secretary/
│   ├── middlewares/
│   ├── config/
│   └── app.ts
└── worker/                  # entrypoint y configuración Cloudflare

frontend/
├── src/
└── vercel.json              # proxy /api hacia Cloudflare
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

cd ../backend/worker
npm ci
npm run typecheck
npm run deploy:dry-run
```

El despliegue y los smoke tests están documentados en `DEPLOY.md`.

## Limitaciones que requieren confirmación

- Las columnas de `EC_Auditoria` y `EC_Permanencias` se infirieron porque ambas tablas estaban vacías. Deben confirmarse en **AppSheet → Data → Columns** o mediante una mutación controlada y reversible.
- `Profesores_Horarios` debe validarse con una escritura controlada antes de usar su CRUD en producción.
- `EC_Traslados` no se escribe hasta conocer su esquema real.
- El inicio de una clase no persiste estado `en_curso`; la sesión queda materializada al guardar asistencia.
