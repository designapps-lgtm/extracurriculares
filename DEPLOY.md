# Despliegue a Producción — Extracurriculares

Arquitectura elegida: **Vercel** (frontend) + **Render** (backend Node) + **Neon** (PostgreSQL).

Auth refactorizada a **tokens Bearer** (header `Authorization` + `localStorage`), porque
las cookies no viajan entre dominios distintos. **No usamos cookies en producción.**

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

## 3. Backend (Render)

### 3.1 Variables de entorno (en el dashboard de Render o via `render.yaml`)
| Variable | Valor |
|----------|-------|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | cadena aleatoria larga (obligatorio, el backend falla si falta) |
| `DATABASE_URL` | cadena de conexión de Neon |
| `FRONTEND_URL` | `https://TU-PROYECTO.vercel.app` (origen permitido en CORS) |
| `ACCESS_TOKEN_EXPIRES_IN` | `15m` |
| `REFRESH_TOKEN_EXPIRES_IN_DAYS` | `7` |

> `render.yaml` marca `JWT_SECRET`, `DATABASE_URL`, `FRONTEND_URL` como `sync: false`
> para que los ingreses manualmente en el dashboard (secretos).

### 3.2 Comandos (ya en `render.yaml`)
- Build: `npm ci && npx prisma generate && npm run build`
- Start: `npm start` → `node dist/server.js`
- Health: `/api/health`

### 3.3 Deploy
- Desde el dashboard de Render: **New → Blueprint** → apuntar al repo.
- O crear un **Web Service** manual apuntando a `backend/`.

---

## 4. Frontend (Vercel)

### 4.1 Variables de entorno
| Variable | Valor |
|----------|-------|
| `VITE_API_URL` | `https://TU-BACKEND.onrender.com` (URL del backend en Render) |

> `VITE_API_URL` se embebe en el build. Si cambia, hay que rebuildear.

### 4.2 Deploy
- Vercel auto-detecta Vite. Configura el **Root Directory** a `frontend/`.
- Build command: `npm run build` · Output: `dist`
- `vercel.json` maneja los rewrites SPA (rutas `/admin/*` en refresh directo).

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

## 6. Verificación final

1. Login admin en `<vercel>/admin/login` → dashboard.
2. Buscar estudiante por código.
3. Login profesor en `<vercel>/teacher/login` con un correo del `import:students`.
4. Iniciar una clase y registrar asistencia.
5. Refrescar la página a mitad de sesión (verificar que el token Bearer mantiene la sesión).

---

## Notas de seguridad / limitaciones (refactor a tokens)

- Los tokens viven en `localStorage` (vulnerable a XSS). Compensaciones ya existentes:
  `helmet`, JWT firmado, refresh tokens rotativos con detección de reuso.
- `httpOnly` cookies eran más seguras, pero incompatibles con dominios distintos
  (Vercel + Render). Si más adelante se tolera un solo dominio, se puede volver a cookies.
- No hay migraciones de Prisma comiteadas. Al primer cambio de schema en prod,
  generar migraciones y correr `prisma migrate deploy` en vez de `db push`.
