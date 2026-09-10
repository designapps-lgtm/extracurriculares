# Despliegue a producción — Extracurriculares

Arquitectura oficial: **servidor Node/Express single-origin** que sirve el build del frontend (`frontend/dist`) y la API REST, con **MySQL** como fuente de verdad. La única integración AppSheet que queda es la consulta de novedades contra la app `Lector_QR`.

El frontend habla con la API en el MISMO origen (rutas relativas `/api/*`), así las cookies de sesión viajan first-party y `SameSite=Lax` alcanza (mitiga CSRF).

## 1. Requisitos

- Node.js 20 o superior.
- Servidor con MySQL 8 para la base de datos.
- Cliente OAuth web de Google con el origen del frontend autorizado.
- Credenciales de la app AppSheet `Lector_QR` (opcional: solo para novedades).

## 2. Base de datos

Levantar MySQL y aplicar las migraciones (crean tablas e índices, idempotentes):

```bash
cd backend
npm ci
npm run build
npx ts-node --transpile-only src/db/migrate.ts
```

Las migraciones viven en `backend/src/db/migrations/`: `001_schema.sql` (14 tablas) y `002_enrollments_id.sql` (`enrollments.id` ampliado a `VARCHAR(100)` para los IDs compuestos heredados de AppSheet).

### Variables de base de datos obligatorias

```text
DB_HOST
DB_PORT
DB_USER
DB_PASSWORD
DB_NAME
```

Crear el usuario con privilegios sobre la base correspondiente:

```sql
CREATE USER 'app'@'%' IDENTIFIED BY '<password>';
GRANT ALL PRIVILEGES ON `extracurriculares%`.* TO 'app'@'%';
FLUSH PRIVILEGES;
```

## 3. Configuración

Copiar `.env.example` a `.env` en el servidor y completar:

### Secrets obligatorios

```text
JWT_SECRET            # rotar; usado para firmar access/refresh
GOOGLE_CLIENT_ID      # verificación de audiencia del ID token
DB_HOST / DB_USER / DB_PASSWORD / DB_NAME
```

### No secretos

```text
PORT                  # por defecto 3000
FRONTEND_URL          # origen público del sitio, sin barra final
ACCESS_TOKEN_EXPIRES_IN   # por defecto 15m
SESSION_DURATION_HOURS    # por defecto 168
GOOGLE_INSTITUTION_DOMAIN # por defecto gi.edu.co
```

### Novedades (opcional)

```text
APPSHEET_NOVEDADES_APP_ID
APPSHEET_NOVEDADES_APPLICATION_ACCESS_KEY
APPSHEET_NOVEDADES_TABLE       # Novedades_Diarias
```

Sin estas tres variables, los endpoints de novedades devuelven vacío (no rompen el resto).

### Google Drive (opcional, proxy de fotos y watch)

```text
GOOGLE_SERVICE_ACCOUNT_JSON
GOOGLE_DRIVE_FOLDER_ID
GOOGLE_DRIVE_WEBHOOK_URL
GOOGLE_DRIVE_WEBHOOK_TOKEN
```

Sin `GOOGLE_SERVICE_ACCOUNT_JSON`, el proxy de fotos (`/api/photos/drive/:fileId`) responde `503 DRIVE_NOT_CONFIGURED`.

## 4. Build y despliegue

### Build del frontend

```bash
cd frontend
npm ci
npm run build        # genera frontend/dist
```

### Build del backend

```bash
cd backend
npm ci
npm run build        # genera backend/dist
```

### Arranque single-origin

```bash
cd backend
NODE_ENV=production FRONTEND_DIST=../frontend/dist npm start
```

Con `NODE_ENV=production` la app Express:
- sirve `frontend/dist` con `express.static` + fallback SPA para GET que no empiecen con `/api`;
- confía en el reverse proxy (`app.set("trust proxy", 1)`) para rate limiting por IP real;
- emite cookies `Secure` + `SameSite=Lax` (requiere servir sobre HTTPS).

Si se sirve detrás de un reverse proxy (Nginx/Caddy), forwardear HTTP y usar certificado. Si se quiere probar en `localhost` contra HTTP, usar `NODE_ENV=development` (cookies sin `Secure`).

## 5. Validación previa

```bash
cd backend
npm ci
npm test
npm run build

cd ../frontend
npm ci
npm run build

git diff --check
```

## 6. Upgrades y migraciones de schema

Cada cambio de schema agrega `NNN_*.sql` en `backend/src/db/migrations/` y se aplica con `npx ts-node --transpile-only src/db/migrate.ts`. El runner registra las aplicadas en `migrations` y es idempotente.

## 7. Smoke tests

### Estado

```bash
curl --fail-with-body http://localhost:3000/api/health
```

Esperado: HTTP 200 con `status: "ok"`, `database: "connected"`, `novedades: "appsheet"` (si está configurada) y `checks.usuariosRoles` con la cantidad de usuarios.

### Autenticación e imágenes

- token Google inválido en `POST /api/auth/google` → `401 INVALID_GOOGLE_TOKEN`.
- `GET /api/auth/me` conserva la sesión tras recargar (cookies httpOnly).
- proxy de fotos con fileId desconocido → `400`/`404` (configurado) o `503 DRIVE_NOT_CONFIGURED` (falta el service account).

### Frontend sobre la API

1. Abrir la URL del servidor y entrar con una cuenta institucional registrada.
2. Confirmar que `GET /api/auth/me` y las rutas de cada rol responden bien en el mismo origen.
3. Verificar en DevTools que los tokens están sólo en cookies `httpOnly`, no en almacenamiento web.

## 8. Seguridad operativa

- Access y refresh JWT se firman con `JWT_SECRET` y se envían en cookies `httpOnly`, `Secure` y `SameSite=Lax` en producción.
- Login, refresh y `/api/auth/me` revalidan usuario, rol y estado contra `users`.
- Configure rate limiting en el reverse proxy si hay múltiples instancias; el contador en memoria de Express no es compartido.
- Los webhooks de Drive deben validar `X-Goog-Channel-Token`, canal y recurso.
- Backup regular de MySQL (dumps). Es la única fuente de verdad persistida.

## 9. Nota histórica

La arquitectura anterior (frontend en Vercel + API como Cloudflare Worker + AppSheet/Google Sheets como fuente de verdad) fue reemplazada por esta migración a MySQL single-origin. Se retiraron: `backend/worker/`, `frontend/vercel.json`, el KV/cron del worker y toda la capa AppSheet académica (dominio, repositorio, sync por webhook); solo se conserva la consulta de novedades (`backend/src/modules/appsheet/{appsheet.service.ts, appsheet.novedades.ts}`).