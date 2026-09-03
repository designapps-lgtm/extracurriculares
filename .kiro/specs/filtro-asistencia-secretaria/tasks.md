# Implementation Plan

## Overview

Este plan implementa el bugfix descrito en `bugfix.md` y `design.md`, siguiendo una secuencia de exploración, preservación, implementación y validación.

## Notes

### Alcance y notas de ejecución

Este plan implementa el bugfix descrito en `bugfix.md` y `design.md`. El cambio de producción queda limitado a `frontend/src/pages/supervisor/SupervisorSession.tsx`; `frontend/src/pages/secretary/SecretarySession.tsx` solo debe continuar pasando `role="secretary"` y no requiere cambios. No se modifican backend, contratos/tipos compartidos, rutas ni APIs.

El frontend no declara actualmente un runner de pruebas en `frontend/package.json`. Las tareas de pruebas deben reutilizar cualquier infraestructura disponible; si no existe, deben preparar el arnés mínimo de pruebas frontend y sus dependencias fijadas antes de ejecutar las propiedades, sin alterar el comportamiento de producción. Las pruebas de exploración y preservación se escriben y ejecutan antes del cambio de `SupervisorSession`.

### Dependencias entre tareas

- La tarea 1 no depende de tareas de implementación y debe ejecutarse sobre el código sin corregir.
- La tarea 2 depende de la preparación del arnés de pruebas, si fuese necesaria, pero también debe ejecutarse sobre el código sin corregir. Es independiente del fix y debe completarse antes de la tarea 3.
- La tarea 3 depende de las tareas 1 y 2: el fix se implementa después de documentar el contraejemplo y el comportamiento baseline que se preservará.
- La tarea 3.2 depende de 3.1 y reutiliza exactamente la prueba creada en la tarea 1.
- La tarea 3.3 depende de 3.1 y reutiliza exactamente las pruebas creadas en la tarea 2.
- La tarea 3.4 depende de 3.1, 3.2 y 3.3 para ejecutar la validación integrada y de compilación.
- La tarea 4 depende de todas las tareas anteriores y es el checkpoint final.

## Tasks

### Tareas

- [ ] 1. Escribir y ejecutar la prueba exploratoria de la condición del bug antes del fix
  - **Property 1: Bug Condition** - La selección de estado en secretaria debe filtrar la lista
  - **CRÍTICO**: escribir esta prueba antes de implementar el cambio; debe fallar sobre el código sin corregir y no se debe arreglar la prueba para ocultar el fallo.
  - **Objetivo**: obtener contraejemplos reproducibles de que Presentes y Ausentes son actualmente elementos no accionables y de que la lista sigue mostrando todos los estados.
  - **Enfoque PBT acotado**: generar o parametrizar sesiones con registros mixtos `presente`, `ausente` y `justificado`; para el caso determinista mínimo usar una sesión con Ana=`presente`, Bruno=`ausente` y Carla=`justificado`.
  - Renderizar `SupervisorSession` con `role="secretary"` y una sesión válida; verificar que los contadores actuales no ofrecen controles de filtro accionables.
  - Intentar seleccionar conceptualmente `presente` y `ausente` mediante la interacción disponible; el contraejemplo esperado es que no existe una acción o que la lista continúa incluyendo registros cuyo `estado` no coincide.
  - Expresar la condición como `isBugCondition(X)`: `X.role === "secretary"`, `X.records.length > 0`, filtro solicitado en `{presente, ausente}`, existe un registro con estado distinto y los registros visibles siguen siendo `X.records`.
  - Afirmar la propiedad que deberá pasar después del fix: para cada filtro solicitado, los registros visibles deben ser exactamente `filter(X.records, record.estado === filtro)` y el control solicitado debe comunicar que está activo.
  - Ejecutar en código sin corregir y documentar los contraejemplos observados, por ejemplo: Presentes no es un botón y al solicitar Presentes permanecen visibles Ausente y Justificado.
  - **Resultado esperado en esta etapa**: la prueba FALLA; ese fallo confirma que el bug existe. Tras el fix, la misma prueba deberá pasar en la tarea 3.2.
  - _Requirements: 1.1, 1.2_

- [ ] 2. Escribir y ejecutar las pruebas de preservación antes del fix
  - **Property 2: Preservation** - Los comportamientos no afectados permanecen invariantes
  - **CRÍTICO**: seguir metodología observation-first; observar primero el código sin corregir y capturar sus resultados antes de implementar filtros.
  - Verificar sobre el baseline que `counts` se calcula desde todos los registros y que Presentes, Ausentes y Total incluyen la sesión completa.
  - Verificar que `handleExport` invoca `api.exportSession(sessionId)` sin filtro visual y que la operación usa la sesión completa.
  - Verificar que Novedades navega a `${basePath}/novedad/${r.codigoEstudiante}` con el mismo `sessionId`, código, nombre, apellido y grupo del registro visible.
  - Verificar que Volver, Salir y el enlace al dashboard conservan sus destinos actuales, y que carga, autenticación y sesión no encontrada mantienen sus estados existentes.
  - Verificar con `role="supervisor"` que la lista continúa mostrando todos los registros y que no se introduce el filtro de secretaria.
  - **Enfoque PBT**: generar sesiones con registros `presente`, `ausente`, `justificado`, sesiones vacías y secuencias de acciones; para toda entrada fuera de `isBugCondition(X)`, comparar la lista/acciones observadas con el baseline. Cuando el harness no permita interceptar descargas o navegación directamente, usar mocks/espías del API y del router para comprobar payloads y destinos.
  - Ejecutar las pruebas en código sin corregir y documentar los resultados observados. Estas pruebas deben PASS antes del fix.
  - No incluir en esta tarea expectativas nuevas de filtrado; solo capturar lo que se debe conservar.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 3. Implementar el filtro de asistencia de secretaria y validar el comportamiento
  - **Dependencias**: 1 y 2.
  - Aplicar el cambio únicamente en `SupervisorSession`, condicionado por `role === "secretary"`; no cambiar `SecretarySession`, backend, APIs, rutas ni tipos de dominio.

  - [ ] 3.1 Implementar el fix en `frontend/src/pages/supervisor/SupervisorSession.tsx`
    - Declarar `AttendanceFilter = "todos" | "presente" | "ausente"` y estado local inicializado en `"todos"`; no persistirlo en URL ni fuera del componente.
    - Derivar `visibleRecords` sin mutar `data.records`: usar todos los registros para `todos` y para roles distintos de secretaria, y filtrar por `r.estado === attendanceFilter` solo para secretaria con `presente` o `ausente`.
    - Reemplazar únicamente el `data.records.map(...)` de la lista por `visibleRecords.map(...)`; conservar `data.records.length` para el estado vacío general y para Total.
    - En el flujo de secretaria, convertir Presentes y Ausentes en botones `type="button"` y agregar Todos como control explícito. Mantener sus conteos desde `counts` calculados sobre `data.records`.
    - Exponer `aria-pressed` para cada filtro, grupo accesible con nombre, nombres visibles/accesibles claros, foco visible y estados activos distinguibles sin depender solo del color.
    - Al seleccionar Presentes, Ausentes o Todos, reemplazar el estado anterior de forma determinista. Si no hay coincidencias pero la sesión sí tiene registros, mostrar un estado vacío específico y una acción Todos/Mostrar todos; si la sesión está vacía, conservar el mensaje general existente.
    - Para supervisor, conservar la presentación y lista completa existentes, sin aplicar el filtro específico de secretaria.
    - Mantener sin cambios `counts`, `handleExport`, `api.getSession`, `api.exportSession`, `openNovedad`, `basePath`, enlaces, rutas y el objeto `state` de Novedades. La exportación debe seguir usando `sessionId` y no `visibleRecords`.
    - _Bug_Condition: `isBugCondition(X)` cuando `X.role === "secretary"`, hay registros, el filtro solicitado es `presente` o `ausente`, existe un registro con otro estado y la lista visible aún equivale a `X.records`.
    - _Expected_Behavior: `visibleRecords = filter(X.records, record.estado === X.selectedFilter)` para `presente`/`ausente`; `todos` muestra `X.records`; el filtro activo expone `aria-pressed=true`; los conteos siguen basados en `X.records`.
    - _Preservation: preservar conteos completos, exportación de la sesión completa, payload/destino de Novedades, Volver/Salir/dashboard, estados de carga/error y flujo completo de supervisor.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ] 3.2 Verificar que la prueba de condición del bug ahora pasa
    - **Property 1: Expected Behavior** - La lista filtrada coincide exactamente con el estado seleccionado
    - **Dependencia**: 3.1.
    - Reejecutar la misma prueba exploratoria de la tarea 1; no escribir una prueba alternativa ni cambiar sus expectativas para hacerla pasar.
    - Verificar Presentes en una sesión mixta: solo aparecen registros `presente`, el control tiene `aria-pressed="true"` y los demás controles no quedan activos.
    - Verificar Ausentes, incluido el cambio directo desde Presentes: solo aparecen registros `ausente`, sin combinar filtros.
    - Verificar Todos y la restauración desde un estado vacío filtrado: reaparecen todos los registros, incluido `justificado`.
    - **Resultado esperado**: la propiedad pasa para todos los casos generados/parametrizados que satisfacen `isBugCondition`.
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ] 3.3 Verificar que las pruebas de preservación siguen pasando
    - **Property 2: Preservation** - El filtro visual no altera operaciones ni flujos existentes
    - **Dependencia**: 3.1.
    - Reejecutar exactamente las pruebas de preservación de la tarea 2, sin duplicarlas ni redefinir el baseline.
    - Comprobar con filtros activos que los conteos siguen siendo los de `data.records`, que exportar sigue llamando `api.exportSession(sessionId)` para la sesión completa y que Novedades recibe el payload original del registro visible.
    - Comprobar que Volver, Salir, dashboard, carga, errores y supervisor mantienen el comportamiento anterior.
    - **Resultado esperado**: todas las pruebas de preservación pasan; cualquier cambio fuera del alcance debe corregirse antes de avanzar.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ] 3.4 Ejecutar validación integrada y de accesibilidad del componente
    - **Dependencias**: 3.1, 3.2 y 3.3.
    - Cubrir la secuencia completa secretaria: cargar sesión, Todos → Presentes → Ausentes → Todos, incluyendo una sesión mixta con Justificado y un filtro sin coincidencias.
    - Activar los botones con teclado y verificar nombre accesible, `type="button"`, `aria-pressed`, foco visible y el mismo resultado que con clic.
    - Confirmar que `data.records` no se muta y que orden/cardinalidad de los registros visibles coinciden con el filtro aplicado.
    - Ejecutar `npm run build` desde `frontend/` (`tsc -b && vite build`) y el runner de pruebas configurado, usando modo de ejecución única/no-watch.
    - Revisar que el diff de producción solo incluya el componente previsto y que no haya cambios de backend, `SecretarySession`, rutas o servicios.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 4. Checkpoint - Confirmar que todas las pruebas pasan
  - **Dependencias**: 1, 2 y 3.1–3.4.
  - Confirmar que Property 1 pasó después del fix y que Property 2 continúa pasando.
  - Confirmar que las pruebas unitarias/integración, accesibilidad y `npm run build` pasan en modo de ejecución única.
  - Confirmar que la sesión sin registros conserva el estado vacío general y que una sesión con registros sin coincidencias ofrece Todos/Mostrar todos.
  - Confirmar que no se modificó código fuera del alcance aprobado ni se cambió el contrato de exportación, navegación o Novedades.

## Task Dependency Graph

```text
                          ┌─────────────────────────────┐
                          │ 1. Property 1: Bug Condition│
                          │    exploración en unfixed   │
                          └──────────────┬──────────────┘
                                         │
                                         ▼
┌─────────────────────────────┐   ┌──────────────────────────────┐
│ 2. Property 2: Preservation │──▶│ 3.1 Implementar el fix        │
│    baseline en unfixed      │   │    (secretaria únicamente)    │
└──────────────┬──────────────┘   └──────────────┬───────────────┘
               │                                 │
               │                 ┌───────────────┴───────────────┐
               │                 ▼                               ▼
               │   ┌──────────────────────────┐   ┌──────────────────────────┐
               └──▶│ 3.2 Property 1: Expected │   │ 3.3 Property 2:           │
                   │      Behavior pasa       │   │      Preservation pasa    │
                   └──────────────┬───────────┘   └──────────────┬───────────┘
                                  │                              │
                                  └──────────────┬───────────────┘
                                                 ▼
                                  ┌──────────────────────────────┐
                                  │ 3.4 Validación integrada,    │
                                  │     accesibilidad y build    │
                                  └──────────────┬───────────────┘
                                                 ▼
                                  ┌──────────────────────────────┐
                                  │ 4. Checkpoint: todo pasa     │
                                  └──────────────────────────────┘
```

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1", "2"] },
    { "wave": 2, "tasks": ["3.1"], "dependsOn": ["1", "2"] },
    { "wave": 3, "tasks": ["3.2", "3.3"], "dependsOn": ["3.1"] },
    { "wave": 4, "tasks": ["3.4"], "dependsOn": ["3.2", "3.3"] },
    { "wave": 5, "tasks": ["4"], "dependsOn": ["3.4"] }
  ]
}
```

### Resumen de dependencias

`1 → 3.1 → 3.2 → 3.4 → 4`

`2 → 3.1 → 3.3 → 3.4 → 4`

`1` y `2` deben completarse antes de `3.1`; `3.2` y `3.3` pueden ejecutarse en paralelo después de `3.1`, pero ambas son necesarias para `3.4` y el checkpoint final.
