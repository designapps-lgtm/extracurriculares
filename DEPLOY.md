# Despliegue a Producción — Extracurriculares

Arquitectura elegida: **Vercel** (frontend) + **Cloudflare Workers** (backend) + **Neon** (PostgreSQL).

Auth por **cookies httpOnly con `SameSite=None; Secure`**. El frontend y el backend
son sitios distintos (Vercel + Workers), así que `vercel.json` proxia `/api/*` hacia
el worker: el navegador habla SIEMPRE con el mismo dominio y las cookies son
first-party. Los tokens NUNCA viven en el cliente (ni localStorage ni headers).

> ⚠️ Render quedó **deshabilitado**: no usar. El backend solo corre en Cloudflare.

---

## 1. Preparar lo que ya está hecho (confirmado)

- [x] Backend compila: `npm run build` → `dist/` (0 errores TS tras `prisma generate`)
- [x] Frontend compila: `npm run build` → `dist/` (0 errores TS)
- [x] Auth backend refactorizada a tokens Bearer (middlewares + refresh en body)
- [x] Auth frontend refactorizada a localStorage (api.ts + logins + logout)
- [x] `render.yaml` (BluePrint Render, rootDir `backend`)
- [x] `frontend/vercel.json` (rewrites SPA + cleanUrls)
- [x] Excel `Extracurriculares_base.xlsx` con hoja "Base" (verificada)
- [x] `frontend/src/services/tokenStorage.ts` (almacenamiento por rol)

---

## 2. Base de datos (Neon)

### 2.1 Crear el proyecto Neon
1. Ir a https://neon.tech → crear proyecto (región cercana).
2. Copiar la cadena `DATABASE_URL` (formato pool o directo):
   `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`

### 2.2 Crear el schema (desde tu máquina)
Desde `backend/` con la env apuntando a Neon:

```bash
cd backend
DATABASE_URL="postgresql://USER:PASS@HOST/neondb?sslmode=require" npx prisma db push
```

> No hay migraciones (`prisma/migrations` vacío), por eso usamos `db push` para
> crear las tablas. En el futuro conviene `prisma migrate dev` y comitear migraciones.

---

## 3. Backend (Cloudflare Workers)

### 3.1 Variables de entorno
Las **no secretas** van en `backend/worker/wrangler.toml` → `[vars]` (`NODE_ENV`,
`PORT`, `FRONTEND_URL`, `GOOGLE_DRIVE_FOLDER_ID`). Las **secretas** (DB, JWT,
Google) NO van en el repo; se setean una sola vez con wrangler:

```bash
cd backend/worker
npx wrangler login

npx wrangler secret put DATABASE_URL
npx wrangler secret put JWT_SECRET
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON
```

### 3.2 Build
```bash
cd backend/worker
npm run build     # typecheck + wrangler deploy --dry-run
```

### 3.3 Deploy
```bash
cd backend/worker
npx wrangler deploy   # → https://extracurriculares-api.<tu-sub>.workers.dev
```

> **Rate limiting**: desactivado por defecto. Si alguna vez se corre en Node fuera
> de Workers, el limitador de Express solo se activa definiendo `AUTH_RATE_LIMIT`
> y/o `API_RATE_LIMIT` en el entorno; sin esas vars es no-op. En Workers, el rate
> limiting lo maneja Cloudflare en el edge.

---

## 4. Frontend (Vercel)

### 4.1 Variables de entorno
| Variable | Valor |
|----------|-------|
| `VITE_API_URL` | **Ya no se usa en producción.** El frontend llama a `/api/*` por el mismo dominio y `vercel.json` proxya hacia el backend de Cloudflare Workers (para que las cookies sean first-party y funcionen en móvil). Solo hace falta para desarrollo local (docker usa `http://localhost:3000`). |

> `vercel.json` contiene el rewrite `/api/* → https://extracurriculares-api.gi-school.workers.dev/api/*`.
> Si cambia el worker, actualizar esa URL. Sin el proxy, los navegadores
> móviles bloquean las cookies `SameSite=None` (third-party) y la sesión se pierde.

### 4.2 Deploy
- Vercel auto-detecta Vite. Configura el **Root Directory** a `frontend/`.
- Build command: `npm run build` · Output: `dist`
- `vercel.json` maneja los rewrites SPA (rutas `/admin/*` en refresh directo).
  **No usar `cleanUrls: true`**: rompe el catch-all rewrite y las rutas anidadas
  devuelven 404 al recargar la página.

---

## 5. Cargar datos + seed (después del deploy de la API)

Desde `backend/`, apuntando con `DATABASE_URL` a Neon:

```bash
# 1. Validar dónde no hay profesores: primero el seed de admin
DATABASE_URL="..." SEED_ADMIN_EMAIL="admin@tu.colegio.edu" SEED_ADMIN_PASSWORD="password" npx ts-node prisma/seed.ts

# 2. Importar estudiantes + grados + disciplinas (crea la Base)
cd backend
DATABASE_URL="..." EXCEL_PATH="/ruta/a/Extracurriculares_base.xlsx" npx ts-node src/import/cli/importStudents.ts

# 3. Importar la oferta (profesores, horarios, asignaciones) — dry-run primero
DATABASE_URL="..." npx ts-node src/import/cli/importOffer.ts --dry-run
DATABASE_URL="..." npx ts-node src/import/cli/importOffer.ts
```

> El orden importa: `importStudents` crea grados/disciplinas que `importOffer` necesita.
> `importOffer` tiene `--dry-run` para validar antes de escribir.

---

## 5.5 Backend en Cloudflare Workers (BACKEND OFFICIAL — Render deshabilitado)

> ✅ **Estado: producción.** El backend vive en `extracurriculares-api.gi-school.workers.dev`
> y es el ÚNICO backend. Render fue deshabilitado (el rewrite del frontend ya apunta al worker).
> Limitación conocida: plan Free = 10ms de CPU por request; si bcrypt (login admin)
> o el parseo de xlsx exceden el límite en runtime, migrar al plan pagado (~$5/mes).

### Archivos creados
| Archivo | Qué es |
|---------|--------|
| `backend/worker/worker.ts` | Entrypoint Workers: `fetch` (envuelve Express con `httpServerHandler`) + `scheduled` (cron de novedades) |
| `backend/worker/env.ts` | Puebla `process.env` desde los bindings de Workers (se importa primero) |
| `backend/worker/wrangler.toml` | Config de deploy: cron `*/10 * * * *`, compat flags, variables |
| `backend/worker/package.json` | Wrangler + dependencias de build del worker |
| `backend/worker/tsconfig.json` | Typecheck del worker (usa `types: ["node"]`) |

### Cambios en `src/`
| Archivo | Cambio |
|---------|--------|
| `src/config/prisma.ts` | Usa `Pool` + `PrismaNeon` (adapter serverless de Neon) para correr en edge. Sigue funcionando en Node/Render. |
| `prisma/schema.prisma` | Agregado `previewFeatures = ["driverAdapters"]` + `prisma generate` |
| `src/utils/tokens.ts` | `import crypto from "node:crypto"` (compat tipos) |

### Por qué NO se usa `server.ts`
`server.ts` llama `app.listen()` + `setInterval` (sync de novedades). En Workers:
- No hay proceso continuo: `setInterval` no corre.
- El cron lo maneja Cloudflare con el trigger `scheduled`.

Por eso `worker.ts` importa `app.ts` directamente y define su propio `scheduled`.

### Variables de entorno
Las **no secretas** van en `wrangler.toml` → `[vars]`. Las **secretas** (DB, JWT, Google)
NO van en el repo; se setean con wrangler:

```bash
cd backend/worker
npx wrangler login

# Secretos (uno por línea; wrangler pide el valor)
npx wrangler secret put DATABASE_URL
npx wrangler secret put JWT_SECRET
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON
npx wrangler secret put GOOGLE_DRIVE_FOLDER_ID
npx wrangler secret put GOOGLE_DRIVE_WEBHOOK_TOKEN
npx wrangler secret put APPSHEET_APPLICATION_ACCESS_KEY
npx wrangler secret put APPSHEET_WEBHOOK_TOKEN
```

> `GOOGLE_DRIVE_FOLDER_ID` está en `[vars]` como placeholder vacío; si preferís
> como secreto, quitalo de `[vars]` y dale `wrangler secret put`.
>
> `GOOGLE_DRIVE_WEBHOOK_URL` debe apuntar al endpoint público del worker,
> por ejemplo `https://extracurriculares-api.gi-school.workers.dev/api/webhooks/google-drive`.

El App ID de AppSheet y el nombre de la tabla se configuran en `wrangler.toml` como
`APPSHEET_APP_ID` y `APPSHEET_DEMOGRAFICOS_TABLE` (por defecto `Demograficos`). La
Application Access Key debe configurarse como secreto y nunca guardarse en el repositorio.
Cada ejecución del cron consulta AppSheet; si la respuesta es vacía/incompleta o la
importación reporta errores, intenta usar `Extracurriculares_base.xlsx` desde la carpeta
configurada de Drive como respaldo. Por eso, si se desea ese respaldo, el archivo debe
estar en `GOOGLE_DRIVE_FOLDER_ID` con ese nombre exacto.

Después del deploy y de setear los secretos, pegale una vez al bootstrap:

```bash
curl -X POST \
  -H "X-Goog-Channel-Token: $GOOGLE_DRIVE_WEBHOOK_TOKEN" \
  https://extracurriculares-api.gi-school.workers.dev/api/webhooks/google-drive/bootstrap
```

### Probar en local
```bash
cd backend/worker
npx wrangler login          # una sola vez
npx wrangler dev            # http://localhost:8787
```

### Deploy
```bash
cd backend/worker
npx wrangler deploy         # → https://extracurriculares-api.<tu-sub>.workers.dev
```

Después de deployar, actualizá el rewrite del frontend en `frontend/vercel.json`
de `/api/*` → la URL de tu Worker (en vez de Render).

### ⚠️ Limitaciones conocidas (leer antes de producción)
1. **Plan Free = 10ms de CPU por request.** Express + Prisma + bcrypt pueden
   superar ese límite (especialmente bcrypt en login de admin y parseo de xlsx).
   Si en runtime se quedan en "timeout insuficiente de CPU", hay que migrar al
   plan pagado (~$5/mes, 50ms) o quitar código pesado.
2. **Transacciones en edge**: el sync de novedades usa `prisma.$transaction`. En
   Workers las conexiones WebSocket viven solo dentro de la request; verificar en
   runtime que el cron `scheduled` complete las transacciones. Puede requerir
   ajustar a queries no transaccionales o a `PrismaNeonHttp`.
3. **Cold starts**: la primera request tras enfriarse puede tardar unos segundos
   (arranca Express completo).

---

## 6. Verificación final

1. Login admin en `<vercel>/admin/login` → dashboard.
2. Buscar estudiante por código.
3. Login profesor en `<vercel>/teacher/login` con un correo del `import:students`.
4. Iniciar una clase y registrar asistencia.
5. Refrescar la página a mitad de sesión (verificar que el token Bearer mantiene la sesión).

---

## Notas de seguridad / limitaciones (auth por cookies)

- Las cookies son `httpOnly` (inalcanzables desde JS) → no vulnerables a XSS.
  La sesión se mantiene con refresh tokens rotativos con detección de reuso.
- `SameSite=None` requiere HTTPS (`secure: true` se activa con `NODE_ENV=production`).
- Las mutaciones usan `Content-Type: application/json`, lo que exige preflight CORS;
  el origin debe ser el del frontend permitido, mitigando CSRF en gran parte.
- Si en el futuro frontend y backend comparten un solo dominio, se puede volver a
  `SameSite=Lax`/`Strict` (más robusto frente al bloqueo de cookies de terceros).
- No hay migraciones de Prisma comiteadas. Al primer cambio de schema en prod,
  generar migraciones y correr `prisma migrate deploy` en vez de `db push`.
