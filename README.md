# Extracurriculares — Plataforma de Gestión

Sistema web para gestionar actividades extracurriculares de un colegio.

## Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL 16
- **ORM**: Prisma
- **Dev**: Docker Compose

## Inicio rápido

```bash
docker compose up --build
```

| Servicio  | URL                     |
|-----------|-------------------------|
| Frontend  | http://localhost:5173    |
| Backend   | http://localhost:3000    |
| PostgreSQL| localhost:5432           |

## Variables de entorno

Copiar `.env.example` a `.env` y ajustar:

```bash
POSTGRES_USER=extracurriculares
POSTGRES_PASSWORD=secret_password
POSTGRES_DB=extracurriculares
DATABASE_URL=postgresql://extracurriculares:secret_password@postgres:5432/extracurriculares?schema=public
PORT=3000
FRONTEND_URL=http://localhost:5173
```

## Base de datos

### Migraciones

```bash
docker compose exec backend npx prisma migrate dev --name <nombre>
```

### Seed

```bash
docker compose exec backend npx tsx prisma/seed.ts
```

### Prisma Studio

```bash
docker compose exec backend npx prisma studio
```

## API REST

### Health

```
GET /api/health
→ { "status": "ok", "database": "connected" }
```

### Students

```
GET    /api/students                          # Lista con paginación y filtros
GET    /api/students/:codigo                  # Buscar por código oficial
GET    /api/students/:codigo/profile          # Perfil completo con extracurricular
```

**Query params:**
- `page` (default: 1)
- `limit` (default: 20, max: 100)
- `search` (busca por código, nombre o apellido)
- `grado` (nombre del grado, ej: "7°")
- `disciplina` (código de disciplina, ej: "FUT001")
- `inscrito` ("true" o "false")

### Disciplines

```
GET    /api/disciplines                      # Lista con paginación
GET    /api/disciplines/:codigo              # Detalle con asignaciones y conteo
GET    /api/disciplines/:codigo/students     # Estudiantes inscritos
GET    /api/disciplines/:codigo/teachers     # Profesores asignados
```

### Teachers

```
GET    /api/teachers                         # Lista con paginación
GET    /api/teachers/:id                     # Detalle
GET    /api/teachers/:id/assignments         # Asignaciones del profesor
```

### Grades

```
GET    /api/grades                           # Lista con paginación
GET    /api/grades/:id                       # Detalle
GET    /api/grades/:id/students              # Estudiantes del grado
GET    /api/grades/:id/assignments           # Asignaciones del grado
```

### Assignments

```
GET    /api/assignments                      # Lista con paginación y filtros
GET    /api/assignments/:id                  # Detalle
```

**Query params:**
- `grado` (nombre del grado)
- `disciplina` (código de disciplina)
- `profesor` (UUID del profesor)

### Schedules

```
GET    /api/schedules                        # Lista con paginación
GET    /api/schedules/:id                    # Detalle
```

## Estructura del proyecto

```
backend/
├── src/
│   ├── modules/
│   │   ├── students/        # controller, service, routes, types
│   │   ├── disciplines/
│   │   ├── teachers/
│   │   ├── grades/
│   │   ├── schedules/
│   │   ├── assignments/
│   │   └── health/
│   ├── middlewares/          # errorHandler, requestLogger
│   ├── config/              # prisma, env config
│   ├── utils/               # pagination, validators
│   ├── app.ts
│   └── server.ts
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
└── Dockerfile

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   ├── hooks/
│   ├── api/
│   ├── types/
│   └── utils/
├── index.html
├── vite.config.ts
├── tailwind.config.js
└── Dockerfile

docker-compose.yml
.env.example
```

## Tests

```bash
docker compose exec backend npx tsx src/test-api.ts
```

## Modelo de datos

```
Student ──FK──→ Grade
Student ──FK──→ Discipline (nullable = no inscrito)

ExtracurricularAssignment ──FK──→ Teacher
ExtracurricularAssignment ──FK──→ Discipline
ExtracurricularAssignment ──FK──→ Grade
ExtracurricularAssignment ──FK──→ Schedule (nullable)
```

**Regla principal:** Para obtener el profesor y horario de un estudiante:
`Student.codigoDisciplina + Student.idGrado → Assignment → Teacher + Schedule`
