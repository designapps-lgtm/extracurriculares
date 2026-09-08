# Despliegue a producción — Extracurriculares

Arquitectura oficial: **Vercel** para el frontend, **Cloudflare Workers** para la API Express y **AppSheet/Google Sheets** como fuente de verdad.

La URL vigente del Worker es:

```text
https://extracurriculares-api.gi-school.workers.dev
```

El frontend no llama esa URL directamente desde el navegador. `frontend/vercel.json` reescribe `/api/*` al Worker para mantener las cookies como first-party.

## 1. Requisitos

- Node.js 20 o superior.
- Sesión de Wrangler autorizada para la cuenta correcta de Cloudflare.
- Acceso administrativo a la aplicación de AppSheet.
- Cliente OAuth web de Google con los orígenes del frontend autorizados.
- Árbol de trabajo revisado y validaciones locales en verde.

El backend de producción es únicamente el Worker. No se debe habilitar otro servidor en paralelo con el mismo frontend.

## 2. Configuración de Cloudflare

> Por qué se "borraban" las variables: `wrangler deploy` SINCRONIZA el bloque
> `[vars]` de `backend/worker/wrangler.toml` con Cloudflare. Toda variable de
> texto creada a mano en el dashboard que no esté en ese archivo SE ELIMINA en
> cada deploy. Los secretos (`wrangler secret put`) viven aparte y sobreviven,
> pero SOLO si se cargaron como secretos: si pegás un secreto en el dashboard
> como variable de texto, el próximo deploy también lo borra.
>
> Regla: vars de texto → siempre en `wrangler.toml`. Secretos → siempre con
> `wrangler secret put`. Nunca al revés, nunca solo en el dashboard.

### Variables no secretas

Se versionan en `backend/worker/wrangler.toml` y se suben solas con cada deploy:

- `NODE_ENV`
- `PORT`
- `FRONTEND_URL` (sin barra final)
- `ACCESS_TOKEN_EXPIRES_IN`
- `SESSION_DURATION_HOURS`
- `GOOGLE_INSTITUTION_DOMAIN`
- `APPSHEET_APP_ID`
- `APPSHEET_DEMOGRAFICOS_TABLE`
- `APPSHEET_NOVEDADES_APP_ID`
- `APPSHEET_NOVEDADES_TABLE`
- `GOOGLE_DRIVE_FOLDER_ID` (vacía = watch de Drive apagado)
- `GOOGLE_DRIVE_WEBHOOK_URL` (vacía = watch de Drive apagado)

`FRONTEND_URL` debe coincidir con el sitio de Vercel permitido. Si cambia la URL del Worker, también debe actualizarse el destino de `/api/:path*` en `frontend/vercel.json`.

### Secretos obligatorios

No se guardan en Git ni se pasan al frontend. Cargarlos una vez (persisten entre deploys):

```bash
cd backend/worker
npx wrangler login
npx wrangler secret put JWT_SECRET
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put APPSHEET_APPLICATION_ACCESS_KEY
npx wrangler secret put APPSHEET_NOVEDADES_APPLICATION_ACCESS_KEY
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON
```

`GOOGLE_SERVICE_ACCOUNT_JSON` es el JSON del service account de Google Drive:
sin él, el proxy de fotos (`/api/photos/drive/:fileId`) responde `503 DRIVE_NOT_CONFIGURED` y las imágenes de estudiantes, profesores y novedades se rompen en producción.

Wrangler solicitará cada valor de forma interactiva. Para comprobar únicamente los nombres configurados:

```bash
npx wrangler secret list --name extracurriculares-api
```

Secretos opcionales, sólo si se habilita el watch de Drive
(`GOOGLE_DRIVE_FOLDER_ID` con valor real en `wrangler.toml`):

```text
GOOGLE_DRIVE_WEBHOOK_TOKEN
APPSHEET_WEBHOOK_TOKEN
```

## 3. Rotación obligatoria de la llave AppSheet

La llave que se compartió fuera del almacén de secretos debe considerarse comprometida:

1. Genere/revoque la llave desde la administración de AppSheet.
2. Cargue la nueva llave con `wrangler secret put APPSHEET_APPLICATION_ACCESS_KEY`.
3. Despliegue una nueva versión del Worker.
4. Verifique `/api/health` y un login real.
5. Confirme que la llave anterior ya no funciona.

Nunca pegue la llave en comandos versionados, archivos del frontend, issues o logs.

## 4. Validación previa

Desde la raíz del repositorio:

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

cd ../..
git diff --check
```

El dry-run debe completar el bundle sin publicar cambios.

Antes de desplegar, revise además:

- que `wrangler secret list` muestre `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `APPSHEET_APPLICATION_ACCESS_KEY`, `APPSHEET_NOVEDADES_APPLICATION_ACCESS_KEY` y `GOOGLE_SERVICE_ACCOUNT_JSON`;
- que no haya secretos en el diff;
- que `APPSHEET_APP_ID` apunte a la aplicación esperada;
- que las tablas requeridas respondan a lecturas controladas;
- que cualquier escritura de prueba use datos identificables y pueda revertirse.

## 5. Validación de esquemas AppSheet

Antes de habilitar mutaciones administrativas o de supervisión en producción, confirme en **AppSheet → Data → Columns**:

### `EC_Auditoria`

```text
AuditoriaID, UsuarioID, TipoUsuario, Accion, Entidad, EntidadID,
Detalles, CreatedAt
```

### `EC_Permanencias`

```text
PermanenciaID, AsignacionID, HorarioID, CodigoEstudiante, Fecha,
SupervisorID, CreatedAt
```

También debe probarse una escritura reversible en `EC_Asistencias` y `Profesores_Horarios`. Si AppSheet rechaza una mutación por columnas requeridas, detenga las pruebas y obtenga el esquema exacto; no adivine campos adicionales.

`EC_Traslados` permanece sin escritura ni endpoint activo hasta conocer sus columnas.

## 6. Despliegue del Worker

Publicar es un cambio de producción. Usar SIEMPRE el deploy autocurativo (el único que publica de forma segura):

```bash
cd backend/worker
npm run deploy:safe
```

`npm run deploy:safe` ejecuta un pipeline en 4 pasos (ver `backend/worker/scripts/deploy.mjs`):

1. **Preflight** — valida que las 12 vars estén en `wrangler.toml` y que los 5 secretos existan en Cloudflare; si falta algo, aborta sin publicar.
2. **Restaurar secretos** — si un deploy previo (por ejemplo, de assets o del dashboard) borró los secretos, los recrea automáticamente desde `backend/worker/.secrets.production` (archivo local, gitignored, con los valores vigentes). Si ese archivo no existe, aborta con instrucciones.
3. **Publicar** — sube el Worker a `extracurriculares-api`.
4. **Smoke test + rollback** — verifica contra la URL real de producción que `/api/health` responda `200` con `appsheet: "connected"` y `secrets: "ok"`, que el proxy de fotos `/api/photos/drive/:fileId` NO responda `503` (si responde 503, falta `GOOGLE_SERVICE_ACCOUNT_JSON`), y que `/api/auth/google` con un token falso devuelva `401` (no `404`, no 500 de "no configurado"). Si algo falla, vuelve automáticamente a la versión anterior con `wrangler rollback` y aborta con exit 1.

`wrangler deploy` a secas sigue disponible, pero NO verifica nada: puede publicar un Worker roto y **no restaura secretos**. No lo use para producción si querés evitar el ciclo de "el login se rompió de nuevo".

### Por qué "cada vez que subía un cambio se rompía el login"

El frontend de Vercel reescribe `/api/*` a la URL del Worker `extracurriculares-api.gi-school.workers.dev`. Si esa URL deja de servir la API Express, TODO lo que dependa del backend responde `404` y el login (que arranca con `GET /api/auth/me`) muere.

El mecanismo recurrente era:

1. Se publicaba una versión **sin la configuración de la API** (por ejemplo, un build de assets/frontend desplegado al worker `extracurriculares-api` desde el dashboard o desde otro proyecto que usa el mismo nombre).
2. Esa publicación reemplaza el script y **borra los secretos del Worker** (`wrangler secret list` quedaba vacío: `JWT_SECRET`, `GOOGLE_CLIENT_ID`, las llaves de AppSheet y el service account de Drive).
3. El resultado: `/api/health` → `404` (o seguidamente 500 por secretos faltantes), login roto hasta volver a setear secretos y redesplegar la API.

Reglas para que no vuelva a pasar:

- El worker `extracurriculares-api` es **solo la API Express**. Nunca lo pise con un deploy de assets/frontend (ni desde el dashboard ni desde otro proyecto con el mismo nombre).
- Revise **Cloudflare Dashboard → Workers & Pages → `extracurriculares-api` → Settings/Triggers** y desactive cualquier auto-deploy ("deploy from git"/preview) conectado a este worker; si está conectado a un repo, cada push vuelve a romper el login.
- No borre los secretos manualmente; si un deploy raro los deja sin secretos, `npm run deploy:safe` los restaura solo desde `.secrets.production`.
- `backend/worker/.secrets.production` NO se commitea (gitignore). Si se pierde, los secretos hay que volver a cargarlos con `wrangler secret put` y mantener ese archivo local al día.

Cloudflare conserva versiones del Worker. Si los smoke tests detectan una regresión, `deploy:safe` ya hizo `wrangler rollback` automáticamente; si no, use el historial de despliegues del dashboard para volver a la versión anterior mientras se investiga.

El handler `scheduled` actual es un no-op: AppSheet se consulta en vivo y no existe una réplica que deba sincronizarse por cron.

## 7. Smoke tests

### Estado y manejo de token inválido

```bash
curl --fail-with-body \
  https://extracurriculares-api.gi-school.workers.dev/api/health

curl -i -X POST \
  -H 'Content-Type: application/json' \
  --data '{"credential":"invalid-test-token"}' \
  https://extracurriculares-api.gi-school.workers.dev/api/auth/google

curl -i \
  https://extracurriculares-api.gi-school.workers.dev/api/photos/drive/unknown-file-id-0000
```

Resultados esperados:

- `/api/health`: HTTP 200, `status: "ok"`, `appsheet: "connected"` y `checks.secrets: "ok"`. Si `checks.secrets` lista nombres, faltan secretos en el Worker (corra `npm run deploy:safe` para restaurarlos).
- token falso: HTTP 401 con código `INVALID_GOOGLE_TOKEN`, sin detalles internos.
- proxy de fotos con fileId desconocido: HTTP 400 o 404 (el proxy está configurado). Si responde `503 DRIVE_NOT_CONFIGURED`, falta `GOOGLE_SERVICE_ACCOUNT_JSON` y las imágenes están rotas.

### Flujo autenticado en navegador

1. Abrir el frontend de Vercel y entrar con una cuenta institucional registrada.
2. Confirmar que `GET /api/auth/me` conserva la sesión tras recargar.
3. Probar `/api/teacher/classes` con un profesor activo.
4. Abrir una clase, comprobar el roster y guardar una asistencia controlada.
5. Verificar paneles de supervisor, secretaría y administración según permisos.
6. Confirmar en DevTools que los tokens están sólo en cookies `httpOnly`, no en almacenamiento web.

### Observabilidad mínima

En errores de AppSheet, revise los logs del Worker buscando estado HTTP, tabla, acción y timeout. No copie encabezados de autenticación ni cuerpos que contengan datos personales a canales públicos.

## 8. Frontend en Vercel

Configuración esperada:

- Root Directory: `frontend/`
- Build Command: `npm run build`
- Output Directory: `dist`

`VITE_GOOGLE_CLIENT_ID` es configuración pública del cliente OAuth. Ningún secreto server-only debe usar prefijo `VITE_`.

El rewrite crítico está en `frontend/vercel.json`:

```text
/api/:path* → https://extracurriculares-api.gi-school.workers.dev/api/:path*
```

Después de cambiar ese archivo, despliegue Vercel y repita login, refresh y logout desde el dominio final.

## 9. Seguridad operativa

- Access y refresh JWT se firman con `JWT_SECRET` y se envían en cookies `httpOnly`, `Secure` y `SameSite=Lax` en producción.
- Login, refresh y `/api/auth/me` revalidan usuario, rol y estado contra `Usuarios_Roles`.
- Las mutaciones de AppSheet no tienen reintentos automáticos.
- Configure rate limiting de producción en Cloudflare; un contador en memoria de Express no es compartido entre instancias.
- Los webhooks de Drive deben validar `X-Goog-Channel-Token`, canal y recurso.
- No elimine fuentes o proyectos remotos anteriores como parte del despliegue. Cualquier borrado irreversible requiere una aprobación separada y una copia verificada.
