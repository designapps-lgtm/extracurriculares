# Despliegue a producción — Extracurriculares

Arquitectura oficial: **servidor Windows** (Windows Server) que corre **MySQL y Node nativos** (sin Docker) + **Nginx como reverse proxy**. El backend Express sirve el build del frontend (`frontend/dist`) en el mismo origen junto con la API REST, con **MySQL** como fuente de verdad. La única integración AppSheet que queda es la consulta de novedades contra la app `Lector_QR`.

> Docker se usa **solo para desarrollo local** (`docker compose up`). No se usa
> en producción: las imágenes del compose (mysql:8.4, node:20-slim) son Linux y
> un Windows Server no las levanta salvo con Docker Desktop/WSL2, que agrega
> fragilidad innecesaria al servicio.

El frontend habla con la API en el MISMO origen (rutas relativas `/api/*`), así las cookies de sesión viajan first-party y `SameSite=Lax` alcanza (mitiga CSRF).

## 1. Requisitos

- Windows Server (2019 o 2022) con acceso público (IP pública + dominio para Google OAuth).
- Node.js 20 LTS (instalador `.msi`).
- MySQL 8 (instalador oficial).
- Nginx for Windows (o IIS) como reverse proxy + HTTPS.
- Cliente OAuth web de Google con el **dominio** autorizado (Google no permite IPs desnudas en OAuth).
- Credenciales de la app AppSheet `Lector_QR` (opcional: solo para novedades).

## 2. Instalación en Windows Server

### MySQL 8

1. Instalar MySQL 8 con el instalador oficial (Developer/Server default). Elegir autenticación `MySQL Native Password` para compatibilidad con `mysql2`.
2. Dejar el servicio `MySQL80` en `Automático` y corriendo.
3. Crear el usuario de la app con privilegios sobre la base:

```sql
CREATE DATABASE extracurriculares CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'app'@'localhost' IDENTIFIED BY '<password>';
GRANT ALL PRIVILEGES ON `extracurriculares`.* TO 'app'@'localhost';
FLUSH PRIVILEGES;
```

> Si el backend y MySQL viven en máquinas distintas, usar `'app'@'%'` y GRANT
> `ON `extracurriculares`.*` (o `extracurriculares%` si habrá varias bases).

### Node 20 LTS

1. Instalar el `.msi` de Node 20 LTS (marca "agregar al PATH").
2. Verificar:

```powershell
node --version
npm --version
```

## 3. App y migraciones

Clonar/actualizar el repo en el servidor (p. ej. `C:\apps\extracurriculares`) y ejecutar:

```powershell
cd backend
npm ci
npm run build
npx ts-node --transpile-only src/db/migrate.ts
```

`migrate.ts` crea las tablas (idempotente) registrando lo aplicado en `migrations`.
Esta máquina además debe hacer `npm run build` del frontend en producción:

```powershell
cd .\frontend
npm ci
npm run build       # genera frontend/dist
```

## 4. Configuración (.env)

En `backend/.env` (server-only; no exponer a Git):

```text
# Obligatorios
NODE_ENV=production
JWT_SECRET=<clave larga aleatoria>
GOOGLE_CLIENT_ID=<client OAuth web con el dominio autorizado>
DB_HOST=localhost
DB_PORT=3306
DB_USER=app
DB_PASSWORD=<password del usuario MySQL>
DB_NAME=extracurriculares

# No secretos
PORT=3000
FRONTEND_URL=<origen público del dominio, sin barra final>
ACCESS_TOKEN_EXPIRES_IN=15m
SESSION_DURATION_HOURS=168
GOOGLE_INSTITUTION_DOMAIN=gi.edu.co
FRONTEND_DIST=C:\apps\extracurriculares\frontend\dist

# Novedades (opcional)
APPSHEET_NOVEDADES_APP_ID=<id de la app Lector_QR>
APPSHEET_NOVEDADES_APPLICATION_ACCESS_KEY=<llave server-only Lector_QR>
APPSHEET_NOVEDADES_TABLE=Novedades_Diarias

# Google Drive (opcional, proxy de fotos y watch)
GOOGLE_SERVICE_ACCOUNT_JSON=<json del service account>
GOOGLE_DRIVE_FOLDER_ID=
GOOGLE_DRIVE_WEBHOOK_URL=
GOOGLE_DRIVE_WEBHOOK_TOKEN=
```

Sin credenciales de novedades los endpoints responden vacío (no rompen el resto).
Sin `GOOGLE_SERVICE_ACCOUNT_JSON`, el proxy de fotos responde `503 DRIVE_NOT_CONFIGURED`.

Ver la ruta de `FRONTEND_DIST` en Windows: usar separadores `\` o la ruta absoluta completa.

## 5. Correr la app como servicio de Windows

La app debe arrancar sola con el server. Opciones (elegir una):

### a) PM2 (recomendada, simple)

```powershell
npm install -g pm2
cd C:\apps\extracurriculares\backend
pm2 start dist/server.js --name extracurriculares --env production
pm2 save
pm2 startup   # crea el servicio que arranca con Windows
```

### b) nssm (servicio nativo de Windows)

```powershell
nssm install Extracurriculares "C:\Program Files\nodejs\node.exe" "C:\apps\extracurriculares\backend\dist\server.js"
nssm set Extracurriculares AppDirectory C:\apps\extracurriculares\backend
nssm set Extracurriculares AppStdout C:\apps\extracurriculares\backend\out.log
nssm set Extracurriculares AppStderr C:\apps\extracurriculares\backend\err.log
nssm start Extracurriculares
```

## 6. Reverse proxy + HTTPS (Nginx for Windows)

Nginx forwards al backend y termina TLS. Config base (`C:\nginx\conf\nginx.conf`):

```nginx
http {
  server {
    listen 80;
    server_name extracurriculares.gi.edu.co;   # tu dominio
    location / {
      proxy_pass http://127.0.0.1:3000;
      proxy_set_header Host $host;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto https;
      proxy_http_version 1.1;
    }
  }
}
```

Con `NODE_ENV=production` la app emite cookies `Secure` (requiere servir la app por HTTPS), así que es **obligatorio** terminar SSL en el proxy. Si se usa IIS, el equivalente es un sitio con `httpPlatformHandler` + certificado.

Certificados (Let's Encrypt o el cert del colegio): el origen final del OAuth de Google debe coincidir con `https://<dominio>` que sirve el proxy, **no** con una IP desnuda.

## 7. Smoke tests

```powershell
curl -i http://localhost:3000/api/health
```

Esperado: HTTP 200 con `status: "ok"`, `database: "connected"`, `novedades: "appsheet"` (si está configurada) y `checks.usuariosRoles` con la cantidad de usuarios. Luego repetir contra la URL pública del proxy y validar login real.

## 8. Seguridad operativa

- Access y refresh JWT en cookies `httpOnly`, `Secure`, `SameSite=Lax` (producción).
- Login, refresh y `/api/auth/me` revalidan usuario, rol y estado contra `users`.
- Rate limiting: el contador en memoria de Express es por instancia; conviene limitar en Nginx/IIS.
- Webhooks de Drive: validar `X-Goog-Channel-Token`, canal y recurso.
- Backup diario de MySQL (`mysqldump`) — es la única fuente de verdad persistida.
- Poner el firewall de Windows Server: abrir solo `80`/`443` (no `3000`).

## 9. Validación previa al deploy

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

## 10. Nota histórica

La arquitectura anterior (Vercel + Cloudflare Worker + AppSheet/Google Sheets como fuente de verdad) fue reemplazada. Se retiraron `backend/worker/`, `frontend/vercel.json`, el KV/cron del worker y toda la capa AppSheet académica (dominio, repositorio, sync por webhook); solo se conserva la consulta de novedades (`backend/src/modules/appsheet/{appsheet.service.ts, appsheet.novedades.ts}`).