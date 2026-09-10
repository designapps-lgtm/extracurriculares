# Plan vigente — migración AppSheet → MySQL ✓

Este documento reemplaza el plan histórico basado en la arquitectura AppSheet/Cloudflare. **La migración a MySQL está completa**; MySQL es la fuente de verdad y el deploy es un servidor Express single-origin.

## Completado

- Fase 0 — MySQL en Docker, pool, config y conexión verificada.
- Fase 1 — `001_schema.sql` (14 tablas) + runner de migraciones con tests.
- Fase 2 — capas `db/dates.ts`, `db/domain.ts` (15/15), `db/views.ts`; 27 consumers re-swappeados.
- Fase 3 — reports, audit, rutas, assignmentAdmin, driveSync, healthRouter y novedades pasados a MySQL; `rutas.domain.ts` desacoplado de `AppSheetRow`; webhook sync desmontado.
- Fase 4 — script one-shot `migrate-appsheet.ts` ejecutado contra la BD dev: grades 16, users 62 (2 dedup), schedules 15, demographics 791, student_routes 755, students 792, enrollments 1528, assignments 147, assignment_schedules 309, attendance 1289, stays/reports/audit 0, sync_state 1. Migración `002` para `enrollments.id VARCHAR(100)`. Fix de `splitStatements` en el runner.
- Fase 5 — deploy single-origin: Express sirve `frontend/dist` + fallback SPA; cookies first-party sin CORS. Cherry-pick `0b3bf3d` (fix `formatGradesRange`).
- Fase 6 — retirada de la capa muerta: `backend/worker/` (Cloudflare), `frontend/vercel.json`, KV/cron/webhooks de AppSheet, y todo `modules/appsheet/*` salvo `appsheet.service.ts` + `appsheet.novedades.ts` (solo novedades).

## Estado de validación

- Backend: `tsc -b` limpio, 78/78 tests verdes (los 27 tests borrados pertenecían a la capa muerta).
- Frontend: build OK.
- Smoke local (NODE_ENV=production): `/` 200 HTML, fallback SPA 200, `/api/health` DB connected, `/api/nonexistent` 404 JSON.

## Pendiente (deploy a un servidor real)

1. Aplicar migraciones y variables en el servidor de producción.
2. `npm run build` del frontend, arrancar Express con `NODE_ENV=production FRONTEND_DIST=../frontend/dist`.
3. Servir detrás de HTTPS (reverse proxy) para cookies `Secure`.
4. Backup periódico de MySQL (dumps).

## Limitaciones conocidas

- `EC_Traslados` no se usa (no se migró).
- El inicio de una clase no materializa estado `en_curso`; la sesión queda al guardar asistencia.
- Novedades dependen de la app AppSheet `Lector_QR`; sin credenciales devuelven vacío.
- `EC_Reportes_Problemas` no existía en AppSheet: `reports` se migró vacía (ya era 100% MySQL).