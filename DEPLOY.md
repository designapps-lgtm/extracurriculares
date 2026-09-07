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

### Variables no secretas

Se versionan en `backend/worker/wrangler.toml`:

- `NODE_ENV`
- `PORT`
- `FRONTEND_URL`
- `ACCESS_TOKEN_EXPIRES_IN`
- `SESSION_DURATION_HOURS`
- `GOOGLE_INSTITUTION_DOMAIN`
- `APPSHEET_APP_ID`
- `APPSHEET_DEMOGRAFICOS_TABLE`

`FRONTEND_URL` debe coincidir con el sitio de Vercel permitido. Si cambia la URL del Worker, también debe actualizarse el destino de `/api/:path*` en `frontend/vercel.json`.

### Secretos obligatorios

No se guardan en Git ni se pasan al frontend:

```bash
cd backend/worker
npx wrangler login
npx wrangler secret put JWT_SECRET --name extracurriculares-api
npx wrangler secret put GOOGLE_CLIENT_ID --name extracurriculares-api
npx wrangler secret put APPSHEET_APPLICATION_ACCESS_KEY --name extracurriculares-api
```

Wrangler solicitará cada valor de forma interactiva. Para comprobar únicamente los nombres configurados:

```bash
npx wrangler secret list --name extracurriculares-api
```

Secretos opcionales, sólo si se habilita el watch de Drive:

```text
GOOGLE_SERVICE_ACCOUNT_JSON
GOOGLE_DRIVE_FOLDER_ID
GOOGLE_DRIVE_WEBHOOK_URL
GOOGLE_DRIVE_WEBHOOK_TOKEN
```

`APPSHEET_NOVEDADES_TABLE` no debe configurarse hasta identificar una tabla real y confirmar sus columnas. La API devuelve novedades vacías mientras esté ausente.

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

- que `wrangler secret list` muestre `JWT_SECRET`, `GOOGLE_CLIENT_ID` y `APPSHEET_APPLICATION_ACCESS_KEY`;
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

Publicar es un cambio de producción. Ejecútelo sólo después de revisar el dry-run y los esquemas pendientes:

```bash
cd backend/worker
npx wrangler deploy --name extracurriculares-api
```

Cloudflare conserva versiones del Worker. Si los smoke tests detectan una regresión, use el historial de despliegues del dashboard para volver inmediatamente a la versión anterior mientras se investiga.

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
```

Resultados esperados:

- `/api/health`: HTTP 200, `status: "ok"` y `appsheet: "connected"`.
- token falso: HTTP 401 con código `INVALID_GOOGLE_TOKEN`, sin detalles internos.

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
