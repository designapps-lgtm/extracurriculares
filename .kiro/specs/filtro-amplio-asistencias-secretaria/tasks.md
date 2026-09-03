# Implementation Plan

## Overview

Este plan implementa el filtrado amplio de asistencias para Secretaría definido en `requirements.md` y `design.md`. El cambio cubre los cuatro filtros opcionales (`fecha`, `grado`, `disciplina` y `profesor`), su combinación conjuntiva, la consistencia entre listado/paginación/exportación y los estados accesibles de la interfaz.

Las tareas son exclusivamente de coding y validación del cambio. La ejecución de este plan modificará los archivos de aplicación indicados en las tareas; la generación de este documento no modifica código de aplicación.

## Scope and implementation notes

- La página compartida continúa siendo `frontend/src/pages/supervisor/SupervisorDashboard.tsx`; Secretaría la monta con `role="secretary"` y Supervisión con `role="supervisor"`.
- El control y el parámetro `grado` solo deben existir para Secretaría. La condición de rol debe aplicarse tanto al renderizado como a la serialización de parámetros.
- El listado y la exportación deben usar el mismo snapshot `appliedFilters`; los valores editados pero no aplicados permanecen en `draftFilters` y no alteran la consulta visible.
- El backend mantiene los endpoints existentes y debe conservar la condición `cs."estado" = 'finalizada'`, el shape de sesión, la autenticación y la navegación por `session.id`.
- No se agregan migraciones, permisos, rutas nuevas ni filtros globales por estado individual de asistencia.
- La validación debe usar `npm test` y `npm run build` en `backend/`; en `frontend/` debe ejecutarse `npm run build` y cualquier runner de pruebas ya disponible en modo no interactivo. Si no existe runner de componentes frontend, no introducir dependencias de prueba abiertas o no fijadas: complementar el build con pruebas de lógica disponible y validación manual documentada.

## Dependencias entre tareas

- Las tareas 1 y 2 son independientes y pueden ejecutarse en paralelo: la primera modifica la consulta backend y la segunda define el comportamiento opt-in de paginación.
- La tarea 3 depende de 2.1 porque el dashboard necesita el contrato de `Pagination` para cero resultados; sus parámetros deben alinearse con el contrato backend de la tarea 1.
- La tarea 4 depende de 1.1–1.3, 2.1 y 3.1–3.4; valida conjuntamente filtros, conteo, listado, paginación, exportación, estados asíncronos y accesibilidad.
- La tarea 5 depende de toda la implementación y validación anterior; es el checkpoint final de builds, regresiones de Supervisión/detalle y revisión de alcance.

## Tasks

### 1. Implementar filtro de grado y consistencia de consultas en backend

- [ ] 1.1 Extender `buildSessionWhereSQL` en `backend/src/modules/supervisor/supervisor.service.ts`
  - Leer `grado` junto con `fecha`, `disciplina` y `profesor`.
  - Agregar `g."nombre" = $n` únicamente cuando `grado` sea no vacío.
  - Mantener todos los valores de query en `params`; no interpolar ningún valor recibido del usuario en el SQL.
  - Conservar la condición de sesiones finalizadas y la semántica existente del rango de fecha `YYYY-MM-DD`.
  - Mantener índices `$n` correctos en combinaciones de uno, dos, tres y cuatro filtros.
  - Hacer la función testeable/exportable solo si es necesario para las pruebas, sin cambiar el contrato HTTP.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6; 4.1, 4.2, 4.3; 7.5, 7.6._

- [ ] 1.2 Alinear conteo, listado paginado y exportación con la misma condición filtrada
  - En `getSupervisorSessions`, añadir el `LEFT JOIN "Grade" g ON g."idGrado" = ea."idGrado"` al `COUNT(DISTINCT cs."id")` antes de aplicar las condiciones.
  - Reutilizar exactamente las mismas `conditions` y parámetros base para el conteo y el `SELECT` paginado; añadir `LIMIT` y `OFFSET` únicamente a la copia usada por el listado.
  - En `sessionsWithAttendances`/`exportSupervisorAttendance`, reutilizar las mismas condiciones y parámetros sin añadir paginación, de forma que la exportación sea global y coincida con todas las páginas del listado.
  - Conservar el `SESSION_JOIN`, el shape de respuesta, el orden existente, `total` y `totalPages` calculados por `parsePagination`.
  - Verificar que `total=0` produce metadata válida (`page=1`, `totalPages=0`) sin intentar consultar una página inexistente.
  - _Requirements: 3.1, 3.2, 4.1, 4.2, 4.3, 9.2, 9.3._

- [ ] 1.3 Añadir pruebas unitarias de la construcción SQL y de la igualdad de alcance
  - Cubrir sin filtros: solo la condición de sesión finalizada y ningún parámetro de filtro adicional.
  - Cubrir individualmente fecha, grado, disciplina y profesor, comprobando columna, operador, índice y valor en `params`.
  - Cubrir combinaciones de filtros y verificar `AND`, índices consecutivos y que ningún valor aparezca como literal ejecutable dentro del SQL.
  - Comprobar específicamente que `grado` usa `g."nombre"`, que el conteo incluye el join de `Grade` y que listado/conteo/exportación reciben el mismo conjunto de condiciones y parámetros base.
  - Cubrir valores de fecha válidos y conservar la prueba del rango de inicio/fin de día existente.
  - Si existen pruebas API/integración, añadir casos para Secretaría y Supervisión, incluyendo cero resultados, más de una página y exportación sin `page`/`limit`.
  - _Requirements: 2.1–2.6, 3.1–3.4, 4.1–4.4, 7.5–7.6, 9.1–9.4._

- [ ] 1.4 Ejecutar la validación backend de la tarea
  - Ejecutar `npm test` desde `backend/` en modo de ejecución única.
  - Ejecutar `npm run build` desde `backend/`.
  - Corregir cualquier divergencia entre el alcance del conteo, listado y exportación antes de continuar; no compensarla con lógica duplicada en el frontend.
  - _Requirements: 3.1, 3.2, 4.1, 4.2, 7.5, 9.2, 9.3._

### 2. Añadir soporte opt-in para paginación con cero resultados

- [ ] 2.1 Actualizar `frontend/src/components/common/Pagination.tsx` sin alterar el comportamiento por defecto
  - Añadir una prop opt-in (`alwaysRender` o equivalente) para que solo el dashboard de asistencias pueda comunicar cero resultados.
  - Con `alwaysRender` y `totalPages === 0`, renderizar un resumen accesible `0 resultados`, no mostrar `Página 1 de 0` y ocultar o deshabilitar la navegación.
  - Con `totalPages > 0`, conservar el formato y controles actuales.
  - Sin la prop opt-in, conservar el retorno temprano y comportamiento de las demás pantallas.
  - Mantener botones accesibles, foco operable y ningún callback que solicite una página inexistente.
  - _Requirements: 3.2, 5.4, 6.3, 8.2, 8.3._

- [ ] 2.2 Validar el contrato de `Pagination`
  - Cubrir los casos `totalPages=0`, `totalPages=1` y `totalPages>1`, tanto con la opción opt-in como sin ella, usando el runner existente si está disponible.
  - Comprobar que el dashboard puede mostrar `0 resultados` junto con su `Empty_State` y que otras pantallas no cambian.
  - Si no existe runner frontend, validar el build y documentar la comprobación manual de texto, botones deshabilitados/ocultos y ausencia de `Página 1 de 0`.
  - _Requirements: 3.2, 5.4, 6.1–6.3, 8.2–8.4, 9.2._

### 3. Implementar filtros draft/applied y estados de la vista compartida

- [ ] 3.1 Separar estado editable y snapshot aplicado en `frontend/src/pages/supervisor/SupervisorDashboard.tsx`
  - Definir `AttendanceFilters` con `fecha`, `grado`, `disciplina` y `profesor`, usando `""` como valor vacío.
  - Inicializar `draftFilters` y `appliedFilters` con el mismo objeto vacío sin compartir mutaciones.
  - Implementar una única serialización `toQueryParams` para listado y exportación: omitir vacíos, incluir `grado` solo para `role === "secretary"` y nunca incluir `page`/`limit` en la exportación.
  - Mantener `grado` vacío y omitido en Supervisión aunque el backend acepte el parámetro.
  - No disparar una consulta al editar un control; editar draft no debe modificar sesiones, metadata ni exportación.
  - _Requirements: 1.1–1.6, 2.5–2.6, 4.4, 9.1–9.3._

- [ ] 3.2 Renderizar catálogo y controles accesibles por rol
  - Cargar `filterData.grados`, disciplinas y profesores desde el catálogo existente, conservando solo los grados activos que entrega el contrato.
  - Renderizar en Secretaría, en orden, Fecha, Grado, Disciplina y Profesor; no renderizar Grado en Supervisión.
  - Usar etiquetas visibles asociadas con `htmlFor`/`id` estables (`attendance-fecha`, `attendance-grado`, `attendance-disciplina`, `attendance-profesor`) y opciones explícitas para no filtrar.
  - Añadir botones nativos `type="button"` para Aplicar, Limpiar y Exportar, operables con teclado y con nombres accesibles.
  - Mostrar indicador accesible durante la carga del catálogo y mantener la estructura de la vista si falla; mostrar mensaje de error visible sin bloquear la carga de sesiones.
  - _Requirements: 1.1–1.6, 7.1–7.4, 8.1–8.4, 9.1–9.3._

- [ ] 3.3 Centralizar carga de sesiones y proteger contra respuestas obsoletas
  - Hacer que la función de carga reciba explícitamente `(page, filters)` o equivalente; no leer filtros editables desde un closure ambiguo.
  - Usar un contador monotónico `requestIdRef` para que solo la solicitud vigente pueda escribir `sessions`, `meta`, `listError` y `loading` en `then`, `catch` y `finally`.
  - Aplicar el mecanismo a carga inicial, Aplicar, Limpiar y cambio de página, conservando los filtros del snapshot que originó la consulta cuando ocurre un error.
  - Mostrar carga y error del listado en una región `aria-live="polite"` o equivalente, sin permitir que una respuesta antigua borre resultados o errores vigentes.
  - Inicializar la carga en página 1 con filtros vacíos sin depender de estados editables posteriores.
  - _Requirements: 2.1–2.6, 3.1–3.4, 6.1–6.3, 7.1, 7.2, 7.5, 7.6, 8.3._

- [ ] 3.4 Implementar Aplicar, Limpiar y paginación con `appliedFilters`
  - En Aplicar, copiar `draftFilters` a un snapshot nuevo, guardarlo como `appliedFilters`, invalidar la solicitud anterior e iniciar página 1.
  - En Limpiar, invalidar la solicitud anterior, vaciar draft y applied, iniciar página 1 sin filtros y conservar el filtro visual de estados del detalle sin cambios.
  - En `handlePageChange`, usar exclusivamente `appliedFilters`, conservar todos sus valores y agregar `page`/`limit=20` solo al listado.
  - Resetear siempre a la primera página al aplicar o limpiar; no usar valores draft editados pero no aplicados durante la paginación.
  - Pasar la opción de cero resultados a `Pagination` y renderizar `Empty_State` dentro del área del listado, conservando valores seleccionados cuando no haya coincidencias.
  - _Requirements: 2.1–2.6, 3.1–3.4, 5.1–5.4, 6.1–6.3, 8.2–8.4._

- [ ] 3.5 Sincronizar exportación global con el snapshot aplicado
  - Hacer que `handleExport` use `appliedFilters` en el momento del click y la misma `toQueryParams` del listado.
  - Enviar fecha, grado (solo Secretaría), disciplina y profesor activos; omitir `page` y `limit` para incluir todas las páginas coincidentes.
  - Conservar el flujo actual de `Blob`, descarga, `URL.createObjectURL` y `URL.revokeObjectURL`.
  - Mostrar estado accesible `Generando...`, error visible ante fallo y restablecer `exporting=false` tanto en éxito como en error para permitir reintento.
  - No exportar filtros draft que no hayan sido aplicados.
  - _Requirements: 4.1–4.4, 7.7–7.8, 8.2–8.4, 9.3._

- [ ] 3.6 Preservar navegación, detalle y compatibilidad de Supervisión
  - Mantener navegación a `${basePath}/session/${s.id}` usando el id estable de la sesión y no reconstruirla por grado, disciplina o profesor.
  - No cambiar `frontend/src/pages/supervisor/SupervisorSession.tsx`, el filtro visual `todos`/`presente`/`ausente`, ni los endpoints de detalle/exportación individual.
  - Verificar que Supervisión conserva fecha, disciplina, profesor, listado, paginación, exportación, shape y capacidades actuales, sin control ni parámetro `grado`.
  - _Requirements: 9.1–9.4, 10.1–10.4._

### 4. Ejecutar validación integrada del cambio

- [ ] 4.1 Añadir o completar pruebas de comportamiento para el flujo de filtros
  - Con catálogo real o fixtures derivados del contrato, comprobar controles, opciones activas y serialización de los cuatro filtros para Secretaría.
  - Comprobar cada filtro individual, combinaciones de dos/tres/cuatro filtros, combinación vacía y semántica `AND` en listado y exportación.
  - Comprobar que aplicar reinicia página, paginar conserva `appliedFilters`, editar draft sin aplicar no altera el listado y limpiar restaura la consulta sin filtros.
  - Comprobar cero resultados: valores conservados, `Empty_State`, `0 resultados`, cero páginas navegables y ausencia de `Página 1 de 0`.
  - Comprobar que dos respuestas asíncronas fuera de orden dejan visible solo la respuesta de la última solicitud iniciada.
  - _Requirements: 1.1–1.6, 2.1–2.6, 3.1–3.4, 5.1–5.4, 6.1–6.3, 7.1–7.8._

- [ ] 4.2 Validar accesibilidad y operación con teclado
  - Verificar nombre programático de cada control, foco, orden DOM fecha → grado (Secretaría) → disciplina → profesor → Aplicar → Limpiar → Exportar y operación sin mouse.
  - Verificar que carga, error, vacío y exportación se exponen como texto accesible y no dependen solo de color o iconos.
  - Verificar que aplicar/limpiar no destruyen el foco de forma inesperada y permiten continuar la consulta.
  - _Requirements: 7.1–7.8, 8.1–8.4._

- [ ] 4.3 Ejecutar builds y pruebas de ambos paquetes
  - Ejecutar `npm test` y `npm run build` desde `backend/`.
  - Ejecutar `npm run build` desde `frontend/` y el runner frontend disponible en modo no-watch; si no existe, conservar la validación manual especificada en la tarea 2.2.
  - Revisar errores TypeScript, lint/build y diferencias de contrato antes del checkpoint final.
  - _Requirements: 3.1–3.4, 4.1–4.4, 7.1–7.8, 8.1–8.4, 9.1–9.4._

### 5. Checkpoint final de regresión y alcance

- [ ] 5.1 Confirmar la matriz final por rol y el detalle de sesión
  - Secretaría: filtros fecha/grado/disciplina/profesor, combinaciones, paginación, exportación global, limpiar, cero resultados, errores y reintento.
  - Supervisión: ausencia visual y de red del parámetro `grado`, comportamiento previo de filtros, paginación/exportación, shape y autorización.
  - Detalle: abrir una sesión filtrada por su `id`, conservar metadatos/registros y mantener el filtro visual de estados `todos`/`presente`/`ausente`.
  - Confirmar que ninguna respuesta obsoleta reemplaza la consulta vigente y que todos los mensajes de carga/error/vacío son visibles y accesibles.
  - _Requirements: 6.1–6.3, 7.1–7.8, 8.1–8.4, 9.1–9.4, 10.1–10.4._

- [ ] 5.2 Revisar alcance del diff y cerrar la validación
  - Confirmar que no se agregaron rutas, migraciones, permisos ni filtros globales de estado individual.
  - Confirmar que el backend usa SQL parametrizado y que conteo, listado y exportación comparten el mismo alcance.
  - Confirmar que todos los tests/builds previstos pasan y registrar cualquier validación manual no automatizada.
  - _Requirements: 2.5, 3.1–3.4, 4.1–4.4, 9.1–9.4, 10.1–10.4._

## Task Dependency Graph

```text
┌─────────────────────────────────────┐      ┌──────────────────────────────────────┐
│ 1.1 SQL parametrizado con grado     │      │ 2.1 Pagination opt-in totalPages=0  │
│ 1.2 Conteo/listado/exportación      │      │ 2.2 Validación de Pagination         │
│ 1.3 Pruebas backend                 │      └──────────────────┬───────────────────┘
│ 1.4 Test + build backend            │                         │
└──────────────────┬──────────────────┘                         │
                   │                                            │
                   │                         ┌──────────────────▼───────────────────┐
                   └────────────────────────▶│ 3. Dashboard: draft/applied, UI,    │
                                             │ request id, apply/clear/page/export  │
                                             │ 3.1–3.6                              │
                                             └──────────────────┬───────────────────┘
                                                                │
                         ┌──────────────────────────────────────▼────────────────────┐
                         │ 4.1 Integración de filtros, concurrencia y cero resultados │
                         │ 4.2 Accesibilidad y teclado                              │
                         │ 4.3 Tests/builds completos                                │
                         └──────────────────────────┬─────────────────────────────────┘
                                                    │
                         ┌──────────────────────────▼─────────────────────────────────┐
                         │ 5.1 Regresión por rol y detalle                           │
                         │ 5.2 Checkpoint de alcance y validación                     │
                         └────────────────────────────────────────────────────────────┘
```

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": ["1.1", "1.2", "2.1"]
    },
    {
      "wave": 2,
      "tasks": ["1.3", "2.2"],
      "dependsOn": ["1.1", "1.2", "2.1"]
    },
    {
      "wave": 3,
      "tasks": ["1.4"],
      "dependsOn": ["1.3"]
    },
    {
      "wave": 4,
      "tasks": ["3.1", "3.2", "3.3"],
      "dependsOn": ["1.4", "2.2"]
    },
    {
      "wave": 5,
      "tasks": ["3.4", "3.5", "3.6"],
      "dependsOn": ["3.1", "3.2", "3.3"]
    },
    {
      "wave": 6,
      "tasks": ["4.1", "4.2", "4.3"],
      "dependsOn": ["1.4", "3.4", "3.5", "3.6"]
    },
    {
      "wave": 7,
      "tasks": ["5.1", "5.2"],
      "dependsOn": ["4.1", "4.2", "4.3"]
    }
  ]
}
```

### Resumen de dependencias

- `1.1 + 1.2 → 1.3 → 1.4`
- `2.1 → 2.2`
- `1.4 + 2.2 → 3.1–3.3 → 3.4–3.6`
- `1.4 + 3.4–3.6 → 4.1–4.3 → 5.1–5.2`
