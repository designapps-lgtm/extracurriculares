# Plan vigente — validación de la migración AppSheet

Este documento reemplaza el plan histórico basado en la arquitectura anterior. AppSheet/Google Sheets es ahora la única fuente de datos del backend y Cloudflare Worker es el runtime oficial de producción.

## Completado

- Cliente AppSheet separado con timeout, errores estructurados y reintentos sólo para lecturas.
- Repositorio con caché corta e invalidación tras mutaciones.
- Identidad, roles, estado y permisos desde `Usuarios_Roles`.
- Google como único autenticador y JWT stateless en cookies `httpOnly`.
- Catálogos, asistencia, permanencias y CRUD administrativo migrados a tablas AppSheet.
- Dependencias y archivos del almacenamiento anterior retirados del runtime.
- Worker sin sincronización periódica: AppSheet se consulta en vivo.
- Novedades deshabilitadas de forma segura mientras no exista una tabla válida.

## Pendiente antes del despliegue

1. Confirmar columnas reales de `EC_Auditoria` y `EC_Permanencias` en **AppSheet → Data → Columns**.
2. Probar mutaciones controladas y reversibles en `EC_Asistencias`, `EC_Permanencias`, `EC_Auditoria` y `Profesores_Horarios`.
3. Detener las mutaciones si AppSheet exige columnas no conocidas; no inferir nuevos campos.
4. Añadir pruebas del cliente AppSheet, autenticación, refresh, permisos, asistencia y duplicados de permanencia.
5. Ejecutar builds, tests, typecheck del Worker, dry-run y `git diff --check`.
6. Revisar el diff completo y confirmar que no contiene secretos.
7. Desplegar el Worker y ejecutar smoke tests de health, token inválido, login real y asistencia.
8. Rotar la llave AppSheet compartida fuera del almacén de secretos, actualizar el secret del Worker y repetir smoke tests.

## Limitaciones conocidas

- Filas históricas con `SessionID` opaco no se relacionan con asignaciones sin evidencia adicional.
- Sin una tabla de sesiones, iniciar una clase no materializa estado `en_curso`; guardar asistencia materializa la sesión.
- `EC_Traslados` no se usa hasta confirmar su esquema y diseñar el contrato correspondiente.
- No hay tabla de novedades configurada; los endpoints devuelven vacío.
- El esquema de `Profesores_Horarios` puede exigir columnas adicionales y debe verificarse antes de usar su CRUD en producción.

## Criterios de aceptación

- Backend, frontend y Worker compilan sin errores.
- Tests automatizados cubren éxito y fallos temporales de AppSheet, auth y escrituras idempotentes.
- `/api/health` confirma acceso a `Usuarios_Roles`.
- Un token Google inválido produce `401 INVALID_GOOGLE_TOKEN`.
- Una cuenta inactiva no puede iniciar ni renovar sesión.
- Guardar dos veces la misma asistencia edita la fila existente en vez de duplicarla.
- Ningún secreto aparece en archivos versionados, respuestas o logs.
- No se realiza ninguna eliminación remota irreversible como parte de esta migración.
