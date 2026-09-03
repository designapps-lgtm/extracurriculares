# Plan de implementación: usabilidad y responsive general

Cada tarea es ejecutable por separado dentro de su fase y referencia los requisitos que satisface. Las tareas preservan permisos y reglas de negocio; cualquier cambio de contrato backend está limitado a la decisión de asistencia indicada en Fase 2A. No se implementa código al crear este documento.

## Convenciones

- **P0/P1/P2:** prioridad del requisito asociado.
- **Dependencias:** tareas que deben estar completas antes de iniciar.
- **Archivos:** ubicación principal esperada; durante implementación se deben respetar cambios concurrentes y ampliar el inventario si el código real difiere.
- **Gate:** condición técnica que debe cumplirse antes de avanzar.

## Fase 0A — Contratos, inventario y arquitectura base

### 0A.1 Inventariar consumidores y capacidades por rol

- **Prioridad:** P0.
- **Requisitos:** R1, R3, R4, R17, NFR-5.
- **Archivos:** `frontend/src/App.tsx`, `frontend/src/pages/**`, `frontend/src/components/common/**`, `frontend/src/services/**`, `.kiro/specs/usabilidad-responsive-general/route-capability-matrix.md`.
- **Acción:** documentar rutas y consumidores de Secretaría, Supervisión, Profesor y Admin; separar capacidades/copy UI de APIs; definir `RoleUiConfig` sin alterar autorización y guardar la matriz como artefacto auditable.
- **Criterio:** existe una tabla de rutas y acciones permitidas; Profesor queda incluido aunque actualmente no tenga layout propio; no se crean copias de páginas por rol.
- **Dependencias:** ninguna.

### 0A.2 Definir tipos de contexto, error y estado asíncrono

- **Prioridad:** P0.
- **Requisitos:** R1, R4, R11, R15, R16, NFR-3.
- **Archivos:** `frontend/src/types/**` o módulo común equivalente, `frontend/src/services/api.ts`.
- **Acción:** crear `ViewContext`, `UserFacingError`, `AsyncState`, `DashboardWidgetState` y normalizadores de mensajes; clasificar `not-found`, `forbidden`, `network`, `timeout`, `invalid-response` y `server`.
- **Criterio:** los tipos distinguen datos previos confirmados, carga, vacío, error y resultado desconocido; no exponen mensajes HTTP crudos ni datos sensibles.
- **Dependencias:** 0A.1.

### 0A.3 Implementar `RoleUiConfig` y shell común sin cambiar APIs

- **Prioridad:** P0.
- **Requisitos:** R1, R3, R17, NFR-5.
- **Archivos:** `frontend/src/components/common/AppShell.tsx`, `frontend/src/components/common/roleConfig.ts`, `frontend/src/pages/supervisor/SupervisorLayout.tsx`, `frontend/src/App.tsx`.
- **Acción:** extraer navegación, identidad, logout, estado de autenticación, menú móvil y región `main` a un shell reutilizable; conservar `roleApis` para servicios; envolver también las rutas de Profesor mediante `AppShell` o crear `TeacherLayout`.
- **Criterio:** Secretaría, Supervisión y Profesor tienen el mismo comportamiento estructural de shell; las acciones y labels se derivan de capacidades; Admin sigue funcionando como consumidor compatible.
- **Dependencias:** 0A.1, 0A.2.

### 0A.4 Implementar `ViewContext` y retorno contextual

- **Prioridad:** P0.
- **Requisitos:** R1, R5.8, R7, R8.4, R11, R16.
- **Archivos:** `frontend/src/hooks/useReturnContext.ts`, `frontend/src/utils/viewContext.ts`, `frontend/src/App.tsx` y enlaces de listados/detalles.
- **Acción:** centralizar escritura/lectura de contexto con precedencia `location.state` → query params permitidos → defaults; serializar solo filtros, página, fecha, orden e IDs mínimos.
- **Criterio:** se cubren asistencias→sesión, clases→sesión/estudiantes, horarios→historial, estudiante→novedad y traslados→historial; back y recarga tienen fallback permitido; no se serializan tokens, contraseñas, roster ni datos innecesarios.
- **Dependencias:** 0A.2, 0A.3.

### 0A.5 Resolver contrato de filtros por endpoint y fecha operativa

- **Prioridad:** P0/P1.
- **Requisitos:** R5.1–R5.13, R8.2–R8.7, R16.3.
- **Archivos:** `frontend/src/services/roles.ts`, `frontend/src/services/supervisor.ts`, `frontend/src/services/secretary.ts`, `frontend/src/pages/supervisor/SupervisorDashboard.tsx`, `backend/src/modules/supervisor/supervisor.service.ts`, `backend/src/modules/supervisor/supervisor.routes.ts`, `.kiro/specs/usabilidad-responsive-general/filter-contract.md`.
- **Acción:** documentar filtros permitidos por rol/endpoint en `filter-contract.md`. Mantener fecha como “hoy” informativa si el backend la fuerza; si se requiere fecha editable, implementar el contrato backend antes del UI. Eliminar filtros locales que desincronicen listado, conteo, paginación o exportación.
- **Criterio:** existe un objeto normalizado `Applied_Filter_Set` usado por consulta, paginación, conteo, detalle y exportación; el alcance real se muestra sin fingir filtros editables.
- **Dependencias:** 0A.1, 0A.2.

### 0A.6 Decidir y documentar la estrategia de guardado de asistencia

- **Prioridad:** P0.
- **Requisitos:** R6.6–R6.10, R15, R16, NFR-3.
- **Archivos:** `frontend/src/services/teacher.ts`, `frontend/src/services/roles.ts`, `backend/src/modules/teacher/teacher.service.ts`, `backend/src/modules/supervisor/supervisor.service.ts`, `backend/src/modules/teacher/teacher.routes.ts`, `backend/src/modules/supervisor/supervisor.routes.ts`, `.kiro/specs/usabilidad-responsive-general/attendance-save-decision.md`.
- **Acción:** elegir snapshot con reconciliación segura o contrato idempotente con resultado por registro. Documentar en `attendance-save-decision.md` cómo se evita el `DELETE + INSERT` destructivo, cómo se reportan IDs inválidos y cómo se evita retry ciego tras timeout.
- **Criterio:** la decisión queda registrada en código/tipos y contrato; no se implementa una UI de guardado parcial que el backend no pueda respaldar.
- **Dependencias:** 0A.2, 0A.5.

### 0A.7 Crear la matriz técnica de verificación

- **Prioridad:** P0/P2.
- **Requisitos:** R18, NFR-1, NFR-2, NFR-3.
- **Archivos:** `.kiro/specs/usabilidad-responsive-general/verification-matrix.md`.
- **Acción:** crear filas para rol×flujo×Android/iPhone/computador×320/375/768/1024+×estado; incluir teclado, foco, lector de pantalla, back, touch target, zoom, teclado virtual, safe-area y fallos controlados.
- **Criterio:** cada combinación aplicable tiene criterio de evidencia y las no aplicables por permiso están marcadas; la matriz se usará como gate de cada fase.
- **Dependencias:** 0A.1, 0A.2.

**Gate Fase 0A:** contratos definidos, Profesor incluido en el shell, filtros reales documentados, estrategia de asistencia elegida y matriz creada.

## Fase 0B — Primitives compartidos y seguridad de interacción

### 0B.1 Centralizar tokens responsive, foco y touch targets

- **Prioridad:** P0.
- **Requisitos:** R13, R14, NFR-1, NFR-2, NFR-5.
- **Archivos:** `frontend/src/index.css`, configuración Tailwind si aplica, `frontend/src/components/common/**`.
- **Acción:** definir utilities/tokens para foco visible, separación táctil, `min-width/min-height: 44px`, safe-area, estados de color/texto y contenedores sin overflow.
- **Criterio:** botones, links, chips, tabs, paginación, checks y controles de asistencia pueden adoptar el contrato sin clases inconsistentes; no se oculta información esencial con hover o color.
- **Dependencias:** 0A.1.

### 0B.2 Implementar `PageHeader`, breadcrumbs/back y landmarks

- **Prioridad:** P0.
- **Requisitos:** R1, R3, R11, R14, R17.
- **Archivos:** `frontend/src/components/common/PageHeader.tsx`, vistas de `pages/secretary`, `pages/supervisor`, `pages/teacher`.
- **Acción:** crear un único `h1`, descripción, metadatos contextuales, breadcrumb/back y región de acciones; migrar encabezados duplicados de dashboards, clases, horarios, sesiones, novedades, traslados y detalles.
- **Criterio:** cada vista principal tiene un solo título principal y contexto de módulo/fecha/clase/estudiante; el back conserva `ViewContext`.
- **Dependencias:** 0A.3, 0A.4, 0B.1.

### 0B.3 Implementar estados de carga, error, vacío y reintento

- **Prioridad:** P0.
- **Requisitos:** R4, R11, R15, NFR-4.
- **Archivos:** `frontend/src/components/common/StatusMessage.tsx`, `InlineRetry.tsx`, `LiveRegion.tsx`, componentes comunes existentes de estados.
- **Acción:** consolidar estados existentes y crear contratos para `loading`, `success`, `empty`, `error`, `retrying` y datos previos; añadir live regions sin mover foco inesperadamente.
- **Criterio:** ninguna vista principal queda con spinner infinito, pantalla blanca o error solo en toast; el reintento está junto al bloque fallido y conserva input/datos confirmados.
- **Dependencias:** 0A.2, 0B.1.

### 0B.4 Migrar Notify a Modal/ConfirmDialog accesible

- **Prioridad:** P0.
- **Requisitos:** R4.7, R6.3–R6.5, R10.11–R10.13, R12, R14.
- **Archivos:** `frontend/src/components/common/Notify.tsx`, nuevos `Modal.tsx`, `ConfirmDialog.tsx`, `ToastRegion.tsx`.
- **Acción:** reemplazar `ConfirmModal`/`PromptModal` internos con modal semántico, portal, foco inicial, focus trap, Escape condicionado, clic externo condicionado, restauración y botones de 44 px; mantener API de `useNotify` o migrar consumidores explícitamente.
- **Criterio:** teclado y lector de pantalla controlan el diálogo; acciones destructivas no se cierran ni confirman accidentalmente; errores críticos no dependen solo del toast.
- **Dependencias:** 0B.1, 0B.3.

### 0B.5 Implementar `UnsavedChangesGuard`

- **Prioridad:** P0.
- **Requisitos:** R6.5, R9.4, R12.4, R15.10, R16.4–R16.6.
- **Archivos:** `frontend/src/components/common/UnsavedChangesGuard.tsx`, shell común, formularios de asistencia/novedades/traslados.
- **Acción:** integrar guardia con navegación React Router, links del shell, logout, back, `beforeunload` y mecanismo móvil disponible; ofrecer Guardar/Descartar/Cancelar.
- **Criterio:** ningún cambio local se pierde por navegación, reload o logout sin decisión explícita; Escape/clic externo no descarta silenciosamente.
- **Dependencias:** 0A.3, 0A.4, 0B.4.

### 0B.6 Consolidar controles de formulario, paginación y listas responsive

- **Prioridad:** P0/P1.
- **Requisitos:** R4, R8.7, R9.2–R9.3, R13, R14, NFR-5.
- **Archivos:** `frontend/src/components/common/Button.tsx`, `frontend/src/components/common/Avatar.tsx` o `Avatar.tsx` existente, `frontend/src/components/common/FormField.tsx`, `SelectField.tsx`, `ResponsiveList.tsx`, `Pagination.tsx`, consumidores de Secretaría/Supervisión/Profesor.
- **Acción:** consolidar `Button` con variantes, loading, disabled, foco y touch target; consolidar `Avatar` para foto/fallback/nombre accesible; migrar labels, hints, errores asociados, paginación y tablas/tarjetas a primitives con orden DOM, overflow controlado y estados localizados.
- **Criterio:** inputs tienen nombre programático y `aria-describedby`; listas funcionan en 320/375 px; paginación y chips son operables con teclado/toque.
- **Dependencias:** 0B.1, 0B.3.

**Gate Fase 0B:** primitives migrados al menos en un consumidor de cada rol, modales/guardia accesibles, títulos no duplicados y controles principales con 44×44 px.

## Fase 1 — Login y dashboards por rol

### 1.1 Robustecer el login Google

- **Prioridad:** P1.
- **Requisitos:** R2, R14, R15, R17, NFR-6.
- **Archivos:** `frontend/src/pages/Login.tsx`, servicios de autenticación, `App.tsx`.
- **Acción:** modelar estados del callback Google `idle/loading/success/error`, `aria-busy`, live region, reintento localizado, errores de red/servidor/rol/sesión/configuración y redirección sin bucles.
- **Criterio:** se conserva información no sensible, no se muestran tokens/credenciales y la acción duplicable queda bloqueada solo durante la solicitud.
- **Dependencias:** Fase 0B.

### 1.2 Implementar dashboard con widgets independientes

- **Prioridad:** P1.
- **Requisitos:** R3, R4, R15, R17, NFR-4.
- **Archivos:** `frontend/src/pages/secretary/SecretaryDashboard.tsx`, `SupervisorDashboard.tsx`, `teacher/TeacherDashboard.tsx`, configuración de rol.
- **Acción:** separar cada resumen en `DashboardWidgetState`, ordenar acciones por frecuencia y aplicar copy/capacidades declarativas por rol.
- **Criterio:** un fallo de widget no desmonta shell ni otros accesos; cada bloque tiene carga, vacío, error y retry; Secretaría, Supervisión y Profesor reciben la misma calidad.
- **Dependencias:** 0A.3, 0A.2, 0B.2, 0B.3.

### 1.3 Migrar navegación móvil y feedback de dashboard

- **Prioridad:** P1.
- **Requisitos:** R1, R3, R13, R14.
- **Archivos:** shells y dashboards de los tres roles, `index.css`.
- **Acción:** hacer accionables las áreas previstas, asegurar menú activo único, cierre al navegar, safe-area y acciones primarias visibles con teclado virtual.
- **Criterio:** no hay encabezados/acciones duplicados ni overflow en 320/375 px; el destino de cada acceso se entiende por texto.
- **Dependencias:** 1.2, 0B.1, 0B.2.

**Gate Fase 1:** login y dashboards cargan, fallan y recuperan por bloque; copy y capacidades no prometen permisos inexistentes.

## Fase 2A — Asistencia segura y recuperación

### 2A.1 Implementar el contrato elegido de asistencia en backend

- **Prioridad:** P0.
- **Requisitos:** R6.6–R6.10, R15, NFR-3.
- **Archivos:** `backend/src/modules/teacher/teacher.service.ts`, `backend/src/modules/supervisor/supervisor.service.ts`, rutas/tipos relacionados.
- **Acción:** según 0A.6, implementar snapshot reconciliable o mutación idempotente; validar roster/estados, evitar pérdida por `DELETE + INSERT`, devolver resultado suficiente o habilitar GET de reconciliación.
- **Criterio:** timeout, retry y respuesta parcial/no confirmada no duplican ni borran registros confirmados; Profesor y Supervisor comparten semántica segura sin cambiar permisos.
- **Dependencias:** 0A.6, 0A.2.

### 2A.2 Implementar `AttendanceDraft` y estado de sesión

- **Prioridad:** P0.
- **Requisitos:** R6.1–R6.2, R6.7–R6.14, R15.
- **Archivos:** `frontend/src/types/**`, `TeacherAttendance.tsx`, `SupervisorAttendance.tsx`, `SupervisorSession.tsx`, `SecretarySession.tsx`.
- **Acción:** separar `originalRecords`, `records`, `dirtyIds`, conteos, estados de guardado y error por registro; usar estado textual accesible para presente/ausente/justificado/pendiente.
- **Criterio:** una marca actualiza UI/conteo inmediatamente; la edición local sobrevive a errores y se distingue de lo confirmado.
- **Dependencias:** 2A.1, 0B.3, 0B.5, 0B.6.

### 2A.3 Confirmar acciones masivas y ofrecer undo

- **Prioridad:** P0.
- **Requisitos:** R6.3–R6.4, R12, R14.
- **Archivos:** controles de asistencia y `ConfirmDialog`.
- **Acción:** confirmar cantidad, estado destino y reemplazos de “todos presentes/ausentes/limpiar”; permitir undo antes de guardar y anunciar cambios.
- **Criterio:** ninguna acción masiva modifica registros sin confirmación; undo restaura el snapshot local anterior.
- **Dependencias:** 2A.2, 0B.4.

### 2A.4 Implementar guardado, partial/unknown result y retry seguro

- **Prioridad:** P0.
- **Requisitos:** R6.6–R6.10, R15, R16, NFR-3.
- **Archivos:** servicios frontend de teacher/supervisor, asistencia y `StatusMessage`.
- **Acción:** bloquear doble envío; actualizar solo confirmados; mostrar guardados/fallidos/pendientes o resultado no confirmado; reconciliar antes de repetir; limpiar `dirty` solo con confirmación total.
- **Criterio:** retry no reenvía ciegamente ni elimina cambios locales; al éxito total se anuncia resultado y se conserva retorno contextual.
- **Dependencias:** 2A.1, 2A.2, 2A.3, 0B.5.

### 2A.5 Manejar carga, vacío, detalle y novedades relacionadas

- **Prioridad:** P0/P1.
- **Requisitos:** R6.1, R6.11–R6.12, R11, R15.
- **Archivos:** `frontend/src/pages/teacher/TeacherAttendance.tsx`, `frontend/src/pages/supervisor/SupervisorAttendance.tsx`, `frontend/src/pages/supervisor/SupervisorSession.tsx`, `frontend/src/pages/secretary/SecretarySession.tsx`, servicios de asistencia y `frontend/src/components/common/StatusMessage.tsx`.
- **Acción:** migrar estados de carga/error/no encontrado/no autorizado de las sesiones; mantener novedades/traslados relacionados en bloques independientes; evitar redirigir al dashboard desde cualquier error.
- **Criterio:** una sesión sin roster, un 403/404 y una falla de red tienen mensajes y salidas diferentes; la asistencia disponible no desaparece por fallo de novedades.
- **Dependencias:** 0A.2, 0A.4, 0B.3, 2A.2.

**Gate Fase 2A:** guardado seguro probado con éxito, timeout, respuesta parcial o desconocida y retry; ningún flujo pierde cambios confirmados o pendientes.

## Fase 2B — Filtros, clases y horarios

### 2B.1 Migrar `FilterBar` draft/applied para asistencias

- **Prioridad:** P1.
- **Requisitos:** R5.1–R5.13, R16.
- **Archivos:** `frontend/src/components/common/FilterBar.tsx`, `frontend/src/pages/supervisor/SupervisorDashboard.tsx`, `frontend/src/services/roles.ts`, `frontend/src/services/supervisor.ts`, `frontend/src/services/secretary.ts`, `frontend/src/services/api.ts`, `backend/src/modules/supervisor/supervisor.service.ts`, `backend/src/modules/supervisor/supervisor.routes.ts` (`/sessions`, `/sessions/export`, `/sessions/:sessionId/export`).
- **Acción:** implementar draft/applied, dirty indicator, chips eliminables, AND consistente, limpiar a página 1, requestId/AbortController y persistencia mediante `ViewContext`; reutilizar el mismo objeto normalizado para listado, conteo, paginación y las dos rutas de exportación; modelar progreso, éxito, error, retry seguro y resultado desconocido de la exportación sin borrar filtros ni resultados confirmados.
- **Criterio:** fecha/grado/disciplina/profesor solo aparecen si el endpoint/rol los soporta; listado, conteo, paginación y exportación usan el mismo set aplicado; exportar comunica progreso y éxito, y ante error o timeout conserva el contexto y ofrece retry/reconciliación sin duplicar descargas.
- **Dependencias:** 0A.5, 0A.4, 0B.3, 0B.6.

### 2B.2 Migrar clases Hoy/Todas y acción primaria por capacidad

- **Prioridad:** P1.
- **Requisitos:** R7, R13, R14, R17.
- **Archivos:** `SupervisorClasses.tsx`, `SecretaryClasses.tsx`, `TeacherDashboard.tsx`/vista de clases, servicios correspondientes.
- **Acción:** modelar `today | all`, fecha/día/conteo, botón reversible, `Consultar estudiantes`/`Ver sesión`/`Llamar lista`, prevención de doble inicio y feedback localizado.
- **Criterio:** el alcance activo y el destino de cada acción son claros en móvil; error/retry conserva modo y filtros; solo se muestran capacidades autorizadas.
- **Dependencias:** 0A.3, 0A.4, 0B.2, 0B.3.

### 2B.3 Migrar horarios y selector de fecha

- **Prioridad:** P1.
- **Requisitos:** R8, R13, R14, R16.
- **Archivos:** `SupervisorSchedules.tsx`, `SecretarySchedules.tsx`, servicios y utilidades de fecha.
- **Acción:** unificar fecha/día/zona horaria, filtros activos, limpiar, historial y retorno; convertir tablas densas a `ResponsiveList` en móvil.
- **Criterio:** no hay scroll horizontal involuntario en 320/375 px; sin horarios, error y retry se distinguen; detalle vuelve con contexto.
- **Dependencias:** 0B.2, 0B.3, 0B.6, 0A.4.

**Gate Fase 2B:** filtros y contexto son consistentes en los tres roles aplicables; clases Hoy/Todas es reversible; horarios pasan los cuatro anchos.

## Fase 3 — Novedades, traslados y detalles

### 3.1 Migrar formularios de novedades

- **Prioridad:** P1.
- **Requisitos:** R9, R12, R14, R15, R16, R17.
- **Archivos:** `TeacherNovedad.tsx`, `SupervisorNovedad.tsx`, `SecretaryNovedad.tsx`, componentes de formulario y servicios.
- **Acción:** usar `FormField`, schema de validación, error junto al campo, resumen/foco al primer error, guardia, estados de guardado y copy por rol; enlazar cada novedad con estudiante, fecha y clase/sesión correctos, y reutilizar un único bloque cuando aparezca desde asistencia, clases o detalle.
- **Criterio:** campos y contexto estudiante/clase/fecha son accesibles; guardar no duplica ni limpia ante error; salida ofrece Guardar/Descartar/Cancelar; la novedad conserva su asociación correcta y no se duplica entre vistas.
- **Dependencias:** 0B.4, 0B.5, 0B.6, 0A.2.

### 3.2 Rediseñar traslados por pasos y validar reglas

- **Prioridad:** P1.
- **Requisitos:** R10, R12, R13, R14, R15, R17.
- **Archivos:** `SupervisorTransfers.tsx`, `SecretaryTransfers.tsx`, servicios y `backend/src/modules/supervisor/supervisor.service.ts`.
- **Acción:** implementar pasos estudiante→fecha/duración→origen→destino→resumen; mostrar y permitir cambiar/quitar el estudiante seleccionado con código, nombre, apellido y grupo; validar fecha inicial/final, día, origen/destino, horario, motivo, solapamiento y permisos; limpiar destino al cambiar dependencias; confirmar el resumen antes de persistir y ofrecer error/retry seguro.
- **Criterio:** el resumen muestra origen→destino, estudiante, rango y motivo; se excluye origen; los errores aparecen junto al campo; Secretaría no ve acciones no permitidas; si no hay estudiante/clases compatibles/historial se muestra Empty_State con motivo y siguiente paso; el registro requiere confirmación y ante error conserva formulario y filtros.
- **Dependencias:** 0B.2, 0B.3, 0B.4, 0B.5, 0B.6.

### 3.3 Confirmar eliminación e historial de traslados

- **Prioridad:** P1.
- **Requisitos:** R10.11–R10.15, R12, R16.
- **Archivos:** `frontend/src/pages/supervisor/SupervisorTransfers.tsx`, `frontend/src/pages/secretary/SecretaryTransfers.tsx`, `frontend/src/services/roles.ts`, `frontend/src/services/supervisor.ts`, `frontend/src/services/secretary.ts`, `backend/src/modules/supervisor/supervisor.service.ts`, `backend/src/modules/supervisor/supervisor.routes.ts`.
- **Acción:** separar filtros de creación/historial, agregar confirmación de eliminación con estudiante/rango, estados de error/retry y retorno contextual.
- **Criterio:** no existe eliminación por toque accidental; historial vacío, no autorizado y error se diferencian; los filtros no se mezclan con el formulario de creación.
- **Dependencias:** 3.2, 0B.4, 0A.4.

### 3.4 Migrar detalles y errores semánticos

- **Prioridad:** P1.
- **Requisitos:** R1, R11, R12, R14, R15, R16.
- **Archivos:** `SupervisorSession.tsx`, `SecretarySession.tsx`, `TeacherAttendance.tsx`, `StudentProfile.tsx`, `DisciplineDetail.tsx`, `TeacherDetail.tsx` y detalles equivalentes.
- **Acción:** aplicar `PageHeader`, `ViewContext`, `UserFacingError`, skeleton/empty, 403/404/network y salida al origen permitido.
- **Criterio:** ningún detalle queda en blanco ni redirige genéricamente; back restaura filtros/página/fecha; encabezados no se duplican.
- **Dependencias:** 0A.2, 0A.4, 0B.2, 0B.3.

**Gate Fase 3:** novedades, traslados y detalles protegen formularios, exponen validaciones y recuperan contexto en Secretaría, Supervisión y Profesor donde aplique.

## Fase 4 — Integración responsive, accesibilidad y refinamiento

### 4.1 Ejecutar y completar la matriz por flujo y rol

- **Prioridad:** P0/P1/P2.
- **Requisitos:** R18, NFR-1, NFR-2, NFR-3, NFR-4.
- **Archivos:** `verification-matrix.md`, evidencias de la implementación.
- **Acción:** recorrer login, dashboard, asistencias, toma de asistencia, clases, horarios, novedades, traslados, detalle y navegación para cada rol/dispositivo/ancho/estado aplicable.
- **Criterio:** cada fila tiene evidencia; se cubren Tab/Shift+Tab, foco, Escape, lector de pantalla, browser back, Android back, touch target, overflow, zoom, teclado virtual, partial save y unsaved changes.
- **Dependencias:** Fases 1, 2A, 2B y 3.

### 4.2 Auditar nombres largos, texto aumentado, orientación y safe-area

- **Prioridad:** P0/P2.
- **Requisitos:** R13, R14, NFR-1, NFR-2.
- **Archivos:** `frontend/src/index.css`, `frontend/src/components/common/**`, `frontend/src/pages/secretary/**`, `frontend/src/pages/supervisor/**`, `frontend/src/pages/teacher/**`, `.kiro/specs/usabilidad-responsive-general/verification-matrix.md`.
- **Acción:** corregir solapamientos, truncamientos que oculten información, errores multilínea, orientación horizontal, notch/home indicator y teclado virtual en acciones primarias.
- **Criterio:** no se requiere pinch zoom; el usuario conserva zoom; los controles y mensajes siguen operables en los cuatro anchos.
- **Dependencias:** 4.1, 0B.1, 0B.6.

### 4.3 Auditar consistencia y retirar duplicaciones

- **Prioridad:** P2.
- **Requisitos:** R4, R17, R18, NFR-5, NFR-6.
- **Archivos:** `frontend/src/components/common/**`, `frontend/src/pages/secretary/**`, `frontend/src/pages/supervisor/**`, `frontend/src/pages/teacher/**`, `frontend/src/pages/admin/**` cuando un primitive compartido las afecte, `frontend/src/services/**`, `.kiro/specs/usabilidad-responsive-general/verification-matrix.md`.
- **Acción:** eliminar headers, botones, estados y estilos paralelos; confirmar que primitives comunes tienen consumidores de los tres roles; realizar smoke test Admin si el cambio lo afecta.
- **Criterio:** no hay dos patrones para el mismo estado/acción sin justificación; permisos, copy, logs, toasts y URLs no exponen datos sensibles.
- **Dependencias:** 4.1, 4.2.

### 4.4 Ejecutar builds y validaciones de regresión

- **Prioridad:** P0.
- **Requisitos:** R18, NFR-1–NFR-6.
- **Archivos:** `frontend/package.json`, `backend/package.json`, `frontend/src/**`, `backend/src/**`, `.kiro/specs/usabilidad-responsive-general/verification-matrix.md`.
- **Acción:** ejecutar `npm run build` en frontend y backend, pruebas backend existentes, `git diff --check` y validación manual de los gates; corregir errores antes de cerrar la fase.
- **Criterio:** builds pasan, pruebas disponibles pasan, no hay errores de tipos ni diff con whitespace inválido, y toda limitación de plataforma tiene alternativa accesible documentada.
- **Dependencias:** 4.1, 4.2, 4.3.

## Orden resumido de dependencias

```text
0A.1 → 0A.2 → 0A.3 → 0A.4
                 ├→ 0B.2 → Fase 1/2B/3
0A.5 ────────────┘
0A.6 → 2A.1 → 2A.2 → 2A.3 → 2A.4
0B.1 → 0B.3 → 0B.4 → 0B.5 → asistencia/formularios
0B.6 → filtros, horarios y formularios
Fase 1 + 2A + 2B + 3 → Fase 4
```

## Definition of Done de la implementación

- Secretaría, Supervisión y Profesores completan sus flujos permitidos con el mismo nivel de calidad en Android, iPhone y computador.
- 320/375/768/1024+ no presentan overflow horizontal ni ocultan acciones primarias.
- Controles primarios tienen 44×44 px, foco visible, nombre accesible y estado que no depende solo del color.
- Cada consulta tiene carga/éxito/vacío/error/retry; asistencia además protege cambios, acciones masivas y guardado desconocido/parcial según la estrategia elegida.
- Modales manejan foco, Tab/Shift+Tab, Escape condicionado y restauración; formularios protegen cambios pendientes.
- Filtros, página, fecha y contexto regresan correctamente desde detalles; respuestas obsoletas no reemplazan la consulta vigente.
- No se cambiaron permisos ni se exponen tokens, contraseñas o datos sensibles en URL, logs, toasts o errores.
- `verification-matrix.md` está completa con evidencia y las builds/pruebas disponibles pasan.
