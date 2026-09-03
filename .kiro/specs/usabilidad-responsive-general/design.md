# Diseño técnico: usabilidad y responsive general

## 1. Resumen y principios

La mejora se implementará de forma incremental sobre el frontend React existente. La aplicación conserva React Router, las rutas actuales, los permisos por rol y los contratos de los servicios; el trabajo agrega una capa de patrones compartidos y adapta las vistas existentes. No se hará una reescritura global ni se crearán implementaciones paralelas para cada rol.

Principios:

1. **Contexto antes que acción:** cada pantalla tiene un solo título principal, ubicación, fecha/clase/estudiante relevante y una salida clara.
2. **Estado explícito:** carga, éxito, vacío, error, reintento, guardado parcial y cambios pendientes son estados de interfaz modelados, no detalles accidentales.
3. **Seguridad de edición:** ninguna navegación, reintento o cierre borra cambios locales sin una decisión explícita.
4. **Mismo patrón, copy por rol:** Secretaría, Supervisión y Profesores usan los mismos primitives; el texto y las acciones visibles se derivan de sus capacidades actuales.
5. **Mobile-first con mejora progresiva:** 320 px y 375 px son casos válidos, 768 px es un punto intermedio y 1024 px+ usa el espacio de escritorio sin sacrificar legibilidad.
6. **Accesibilidad como comportamiento:** foco, teclado, lector de pantalla, nombres accesibles y estados no dependen de color, hover o precisión táctil.

## 2. Arquitectura actual y puntos de integración

`frontend/src/App.tsx` concentra las rutas y ya separa los flujos de Teacher, Supervisor y Secretary. Los layouts de Supervisor y Secretary proporcionan el shell de cada rol. Las pantallas de interés están en:

- Entrada: `pages/Login.tsx`.
- Shell y rutas: `App.tsx`, `pages/supervisor/SupervisorLayout.tsx`, `pages/secretary/SecretaryLayout.tsx` y el layout de profesor existente.
- Asistencias: `SupervisorDashboard`, `SupervisorAttendance`, `SupervisorSession`, `SecretarySession`, `TeacherAttendance`.
- Clases y horarios: `SupervisorClasses`, `SecretaryClasses`, `SupervisorSchedules`, `SecretarySchedules`.
- Novedades: `TeacherNovedad`, `SupervisorNovedad`, `SecretaryNovedad`, `SupervisorDailyNovedades`.
- Traslados: `SupervisorTransfers`, `SecretaryTransfers`.
- Componentes reutilizables: `components/common` y `components/teachers`.
- Tokens y responsive base: `index.css` y clases Tailwind existentes.

La primera fase debe identificar qué componentes comunes ya existen y extenderlos en lugar de reemplazarlos. Las rutas públicas y administrativas se mantienen funcionales; los primitives nuevos deben poder consumirse también por las vistas administrativas cuando compartan comportamiento.

## 3. Estructura propuesta de frontend

Se propone consolidar los patrones en `frontend/src/components/common` sin imponer una nueva librería. Los nombres son descriptivos y pueden adaptarse a los componentes existentes antes de implementar:

```text
components/common/
  AppShell.tsx                 # navegación, región principal y contexto del rol
  PageHeader.tsx               # único h1, descripción, breadcrumbs/back y metadatos
  Button.tsx                   # variantes, loading, tamaño táctil y foco
  FormField.tsx                # label, hint, error, aria-describedby
  SelectField.tsx              # select accesible y estado loading/error
  FilterBar.tsx                # draft/applied, chips, aplicar, limpiar
  ResponsiveList.tsx           # tabla desktop/lista o tarjetas compactas en móvil
  StatusMessage.tsx            # loading, error, empty, retry y éxito local
  InlineRetry.tsx              # reintento localizado y accesible
  Modal.tsx                    # foco, Tab/Shift+Tab, Escape y restauración
  ConfirmDialog.tsx             # acciones destructivas/masivas
  ToastRegion.tsx              # confirmación complementaria, no errores críticos
  UnsavedChangesGuard.tsx      # navegación y salida con cambios pendientes
  Pagination.tsx
  LiveRegion.tsx
```

Si ya existe un componente equivalente, se refactoriza hacia el contrato indicado en vez de duplicarlo. Los tokens de foco, separación, radios, colores de estado y altura mínima se centralizan en `index.css`/Tailwind. La regla base para controles táctiles es `min-width/min-height: 44px`; el tamaño del área interactiva no se limita al texto o icono.

## 4. Contratos de primitives

### 4.1 Contexto y navegación

`PageHeader` recibe `title`, `description`, `section`, `backTarget` o callback, `breadcrumbs` y `metadata`. Renderiza exactamente un `h1`, landmarks consistentes y una zona de acciones. El shell calcula la navegación activa a partir de la ruta, cierra la navegación móvil al cambiar de ruta y no repite identidad o título.

`ViewContext` es un objeto serializable y acotado a UI:

```ts
type ViewContext = {
  sourcePath: string;
  sourceLabel?: string;
  filters?: Record<string, string | undefined>;
  page?: number;
  date?: string;
  sort?: string;
  selectedId?: string;
};
```

Se conserva mediante `location.state` para la navegación inmediata y, cuando sea seguro y necesario para recarga, mediante parámetros serializables no sensibles. No se almacenan tokens, contraseñas, borradores de asistencia ni datos sensibles innecesarios en URL o almacenamiento persistente.

Un helper de navegación (`useReturnContext` o equivalente) centraliza construir el detalle y recuperar el origen. Si no existe contexto, el destino de respaldo es el listado permitido del módulo; nunca se fuerza el login por un simple back de una ruta autorizada.

### 4.2 Estados de datos

Las vistas de consulta usan un estado discriminado, evitando flags incompatibles:

```ts
type AsyncState<T> =
  | { status: "idle" }
  | { status: "loading"; previous?: T }
  | { status: "success"; data: T }
  | { status: "empty"; data?: T; reason: "no-results" | "no-data" | "not-available" }
  | { status: "error"; error: UserFacingError; previous?: T };
```

`StatusMessage` y `InlineRetry` reciben el estado y una acción segura. Si hay datos confirmados previos, se muestran junto al error y se identifica que la consulta vigente no se pudo actualizar. Una operación no muestra un spinner infinito: siempre tiene mensaje, salida o reintento.

Las peticiones de filtros, paginación y detalle usan un `requestId` o `AbortController` local. Solo la respuesta de la consulta vigente puede actualizar la vista. El frontend no declara éxito de mutaciones que el backend no confirmó.

### 4.3 Filtros

`FilterBar` separa `draft` de `applied`. Recibe catálogo, filtros permitidos por rol, valores iniciales y callback de consulta. La secuencia es:

1. Inicializar `draft` y `applied` con la fecha/reglas actuales.
2. Editar únicamente `draft`.
3. En Aplicar, normalizar valores, reiniciar página a 1 y crear un nuevo `Applied_Filter_Set`.
4. Consultar listado, conteo, paginación y exportación con el mismo objeto.
5. Mostrar chips eliminables de los valores aplicados.
6. En Limpiar, restaurar valores permitidos por defecto, reiniciar a página 1 y anunciar el nuevo alcance.

Los filtros de Secretaría para asistencias incluyen fecha, grado, disciplina y profesor cuando los servicios actuales los permiten. El diseño no agrega permisos: el catálogo visible se deriva del rol y de la respuesta autorizada.

### 4.4 Modal y guardas

`Modal` crea un portal, `role="dialog"`, `aria-modal="true"`, nombre accesible y descripción opcional. Al abrir, guarda el elemento que disparó el diálogo y mueve el foco a título, primer control o acción definida. Mantiene el foco con Tab/Shift+Tab, desactiva interacción subyacente y restaura el foco al cerrar.

`ConfirmDialog` se usa para acciones masivas, destructivas y descartar cambios. Un diálogo con cambios no se cierra silenciosamente por Escape o clic externo. `UnsavedChangesGuard` integra navegación React Router, acciones de shell, gesto/back del navegador cuando la plataforma lo expone y el evento de recarga; ofrece Guardar, Descartar y Cancelar.

## 5. Modelo de asistencia segura

La toma de asistencia separa tres capas:

```ts
type AttendanceDraft = {
  sessionId: string;
  records: Record<string, AttendanceStatus>;
  originalRecords: Record<string, AttendanceStatus>;
  dirtyIds: string[];
};

type SaveResult = {
  savedIds: string[];
  failed: Array<{ studentId: string; message: string }>;
  pendingIds: string[];
};
```

- `originalRecords` representa lo confirmado por servidor al abrir o reconciliar.
- `records` es la edición local inmediata.
- `dirtyIds` se recalcula por diferencia y no se limpia antes de la confirmación.

Una acción masiva calcula cantidad, estado destino y registros que reemplazará; `ConfirmDialog` la confirma y permite deshacer antes de guardar. Cada marca tiene nombre textual y estado semántico, no solo color, y todos los controles cumplen 44 px.

El guardado envía solo cambios o el formato compatible con el servicio actual. Si la respuesta es parcial, se actualizan únicamente `originalRecords` de los IDs confirmados; los fallidos y pendientes permanecen en `records`, se muestran separados y pueden reintentarse sin duplicar confirmados. Ante resultado de red desconocido, se conserva el borrador y se ofrece reconciliar/reintentar de forma segura. Al completar todo, se anuncia la cantidad guardada, se limpia la guardia y se conserva el retorno al contexto de origen.

## 6. Diseño por flujo y rol

### Login y dashboards

`Login` usa `FormField`, estado de envío localizado y mensaje asociado al formulario. Conserva valores no sensibles ante error. El shell de cada rol usa la misma estructura de encabezado, navegación y estados; las tarjetas y acciones se generan desde una configuración de capacidades ya existentes. Secretaría prioriza consulta; Supervisión supervisión/gestión habilitada; Profesor sus clases, llamada de lista y novedades. Un bloque fallido no bloquea los demás.

### Asistencias

`SupervisorDashboard` recibe el estado de filtros y resultados desde `FilterBar`; Secretaría puede usar el mismo patrón con el conjunto permitido. Listado, conteo, paginación, detalle de sesión y exportación comparten exactamente `Applied_Filter_Set`. Los enlaces a sesión pasan `ViewContext`. Un resultado sin coincidencias explica filtros y permite modificar o limpiar.

`SupervisorAttendance`, `SupervisorSession`, `SecretarySession` y `TeacherAttendance` reutilizan encabezado, estados y guardas. Las capacidades de registrar, consultar o supervisar se determinan por rol, no por una copia visual divergente.

### Clases y horarios

Las vistas de clases mantienen un estado explícito `today | all` y exponen el alcance activo, fecha y conteo. El botón de regreso entre Hoy y Todas permanece visible. En móvil, cada clase prioriza disciplina, grado, día, hora y responsable; los metadatos secundarios se agrupan sin ocultar acciones.

Los horarios usan selector de fecha y resumen de filtros. La conversión fecha/día usa una utilidad única y la zona horaria vigente del aplicativo. `ResponsiveList` se convierte en lista apilada en 320/375 px, sin tabla que obligue a scroll horizontal.

### Novedades

Los formularios comparten `FormField`, validación por campo, resumen accesible y guardia de cambios. El contexto muestra estudiante, sesión/clase y fecha. Guardar bloquea doble envío, conserva valores ante error y confirma el objeto afectado. El texto cambia según permiso: Profesor reporta/registra; Supervisión revisa/gestiona; Secretaría consulta o registra solo si su capacidad actual lo permite.

### Traslados

El flujo se modela como pasos visibles, sin cambiar el contrato de persistencia:

1. Estudiante seleccionado.
2. Fecha inicial y duración/rango.
3. Clase origen.
4. Clase destino compatible.
5. Resumen origen → destino.
6. Confirmación y guardado.

El catálogo de destino se filtra por fecha, excluye origen y muestra disciplina, grado, horario y profesor. Cambiar fecha u origen limpia destino. Las validaciones se muestran junto al campo y el resumen final identifica estudiante, rango, origen, destino y motivo. Historial y creación mantienen estados/filtros independientes.

### Detalle y retorno

Los detalles reciben `ViewContext`, muestran breadcrumb/back y un único título. La carga no presenta campos vacíos como datos. Error, no encontrado y no autorizado tienen mensajes distintos y salida permitida. Al regresar, se restaura filtro, página, fecha y orden cuando el contexto siga vigente.

## 7. Responsive, accesibilidad y estilo

- Breakpoints de verificación: 320, 375, 768 y 1024 px+.
- En 320/375 px: una columna, filtros apilados o en panel controlado, acciones primarias visibles, listas compactas y sin overflow horizontal.
- En 768 px: separación de filtros y contenido, sin forzar la densidad desktop.
- En 1024 px+: sidebar y columnas con ancho máximo de lectura.
- Todos los botones, iconos, chips, tabs, paginación, checks y estados de asistencia tienen área mínima 44×44 px y separación suficiente.
- Se respetan `env(safe-area-inset-*)`, teclado virtual y zoom del usuario; no se depende de hover.
- Foco visible, orden DOM lógico, labels/`aria-describedby`, regiones `main/nav`, headings jerárquicos y live regions para cambios de estado.
- No se comunica selección, error, presente/ausente o permiso únicamente con color.
- Los mensajes de usuario permanecen en español claro; los errores técnicos se transforman en acciones entendibles.

## 8. Persistencia, privacidad y compatibilidad

La persistencia de contexto inmediato usa estado de navegación y parámetros no sensibles. Los borradores de asistencia y formularios no se guardan en `localStorage` sin una decisión explícita de seguridad; si se necesita recuperación durante la misma sesión, se mantiene en memoria o en un mecanismo protegido y se limpia al cerrar sesión. La UI nunca sustituye la autorización del backend.

Las mejoras de estado, navegación y responsive no requieren cambios de API. Si el guardado parcial no puede determinarse con la respuesta actual, la UI debe presentar estado desconocido y reconciliación segura, no inventar éxito parcial. Cualquier cambio de contrato se documentará como tarea separada y no se mezclará con un ajuste visual.

## 9. Orden de implementación y dependencias

1. **Fase 0:** tokens, primitives, estados, shell/contexto, foco de modal, Touch_Target, guards y utilidades de request vigente. Sin esto no se deben migrar flujos.
2. **Fase 1:** login, dashboards y copy por rol usando los primitives de Fase 0.
3. **Fase 2:** filtros/asistencias/clases/horarios; la toma de asistencia requiere guardas, estados y reconciliación de Fase 0.
4. **Fase 3:** novedades, traslados y detalle; reutiliza formularios, validaciones, modales y ViewContext.
5. **Fase 4:** matriz completa, revisión visual, reducción de densidad y correcciones regresivas.

Cada fase se valida antes de abrir la siguiente. Una regresión P0 encontrada durante una fase posterior vuelve a la fase fundacional correspondiente.

## 10. Estrategia de verificación

No se agrega un framework de pruebas frontend en esta especificación. La verificación combina `npm run build`, inspección con navegador/devtools y pruebas manuales estructuradas:

- Matriz de rol: Secretaría, Supervisión, Profesor.
- Matriz de dispositivo: Android, iPhone, computador; anchos 320, 375, 768, 1024+.
- Matriz de estado: carga, éxito, vacío, error, reintento, operación lenta, cambios sin guardar y guardado parcial para asistencia.
- Teclado: Tab/Shift+Tab, Enter/Espacio, Escape, foco visible y retorno de foco.
- Navegación: back de navegador, back de Android, navegación móvil, detalle/listado y recarga segura.
- Accesibilidad: al menos un lector de pantalla de escritorio y servicio de accesibilidad de Android o iPhone para los flujos principales.
- Integridad: fallo controlado de red/servidor durante filtros, guardado de asistencia, novedades y traslados; verificar que los datos confirmados y borradores seguros no se borren.

## 11. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Mezclar cambios concurrentes de filtros de asistencia | Releer el estado del workspace antes de implementar y limitar cada tarea a archivos explícitos. |
| Duplicar layouts por rol | Configurar capacidades/copy y reutilizar primitives; solo variar acciones autorizadas. |
| Declarar éxito tras respuesta parcial | `SaveResult` explícito, reconciliación por ID y estado pendiente visible. |
| Romper back o rutas profundas | `ViewContext`, destino de respaldo y verificación de cada ruta actual. |
| Hacer responsive solo visual | Validar teclado virtual, safe area, zoom, touch targets y overflow en los cuatro anchos. |
| Cambiar reglas de negocio accidentalmente | No modificar permisos/servicios salvo contrato documentado y revisión específica. |

## 12. Trazabilidad de requisitos

- R1, R3, R11, R16: `AppShell`, `PageHeader`, `ViewContext`, retorno contextual.
- R2, R17: `Login`, estados de envío, configuración de copy/capacidades.
- R4, R12, R14, R15: primitives de estado, `Modal`, `ConfirmDialog`, `LiveRegion`, foco y reintento.
- R5: `FilterBar`, `Applied_Filter_Set`, request vigente, paginación/exportación.
- R6: `AttendanceDraft`, bulk action confirmada, guardia, guardado parcial y reconciliación.
- R7, R8: estado Hoy/Todas, `ResponsiveList`, selector de fecha y contexto.
- R9, R10: formularios compartidos, validaciones, pasos de traslado y guardia.
- R13 y NFR-1/NFR-2: tokens responsive, Touch_Target, safe area, zoom y matriz de dispositivos.
- NFR-3/NFR-4/NFR-5/NFR-6: idempotencia de UI, carga localizada, primitives, privacidad y autorización existente.

## 13. Correcciones obligatorias tras contrastar con la implementación real

Este apartado prevalece sobre cualquier formulación anterior que suponga una capacidad o componente que todavía no existe.

### 13.1 Arquitectura de roles y Profesor

`App.tsx` actualmente monta las tres rutas de Profesor directamente; no existe `TeacherLayout`. `SupervisorLayout` se reutiliza para Supervisor, Secretaría y Admin mediante `role`, mientras Profesor usa `services/teacher.ts` separado. Fase 0 debe crear un `AppShell` común o `TeacherLayout` que envuelva `/teacher/dashboard`, `/teacher/session/:sessionId` y `/teacher/novedad/:codigoEstudiante`, y debe migrar allí identidad, logout, navegación, back, contexto y estados. Esto no obliga a unificar las APIs.

Se separan explícitamente:

```ts
type RoleUiConfig = {
  role: "secretary" | "supervisor" | "teacher" | "admin";
  labels: Record<string, string>;
  capabilities: Record<string, boolean>;
};

// RoleApi puede continuar siendo diferente por backend/rol.
```

`RoleUiConfig` controla copy y acciones visibles; la autorización continúa en cada servicio/backend. La igualdad de calidad se verifica con el mismo checklist, no con una API única. Las vistas supervisor compartidas que reciben `role` se consideran consumidores multirol, no cuatro páginas independientes.

### 13.2 Contrato real de asistencia y decisión de API

Los endpoints actuales de Profesor y Supervisor reciben un snapshot de `records`, borran los registros de la sesión y vuelven a insertar los estados válidos; devuelven solo un total/mensaje. Por ello, no se puede implementar “guardar solo dirtyIds” ni `SaveResult` parcial únicamente en frontend.

Antes de migrar la UI de asistencia, Fase 2A debe cerrar una de estas opciones:

1. **Preferida:** cambiar el contrato de mutación a una operación idempotente que acepte snapshot completo o patch explícito, valide cada estudiante/estado, devuelva `savedIds`, `failed[]`, `pendingIds` y `operationId`/versión, y exponga lectura para reconciliación.
2. **Compatibilidad sin contrato nuevo:** enviar siempre el snapshot completo; no declarar guardado parcial; ante timeout mostrar “resultado no confirmado”, consultar nuevamente la sesión antes de reintentar y conservar el borrador hasta reconciliar. No se permite retry ciego.

El cambio de API anterior es una excepción permitida al non-goal únicamente porque es necesario para R6/NFR-3. Si se mantiene la opción 2, `SaveResult` se modela como resultado de reconciliación UI, no como respuesta inventada del servidor. En ambos casos se rechazan o reportan IDs/estados inválidos. El endpoint debe conservar registros confirmados y cambios pendientes según la opción elegida.

### 13.3 Modal, Notify y guardia de salida

`components/common/Notify.tsx` contiene hoy `ConfirmModal` y `PromptModal` sin semántica completa de diálogo, focus trap ni restauración de foco. Fase 0 debe migrar ese proveedor al primitive `Modal`/`ConfirmDialog`, conservando la API pública de `useNotify` cuando sea posible. El modal final debe soportar portal, `role="dialog"`, `aria-modal`, nombre/descripción, foco inicial, Tab/Shift+Tab, Escape condicionado, clic externo condicionado y restauración.

`UnsavedChangesGuard` debe conectarse a enlaces y logout del shell, navegación React Router, `beforeunload`, back del navegador y el mecanismo de back móvil disponible. Asistencia, novedades y formularios de traslado usan la política **Guardar / Descartar / Cancelar**. Escape o clic externo nunca descartan silenciosamente.

### 13.4 ViewContext y precedencia

Antes de migrar detalles se implementa `useReturnContext` con esta precedencia:

1. `location.state.viewContext` para navegación inmediata.
2. Query params permitidos y no sensibles, para recarga o nueva pestaña.
3. Defaults del módulo, únicamente si no hay contexto válido.

Tabla mínima de rutas:

| Origen | Destino | Datos permitidos | Fallback |
|---|---|---|---|
| Asistencias | sesión/detalle | filtros aplicados, página, fecha, orden | listado de asistencias |
| Clases | sesión/estudiantes | modo Hoy/Todas, filtros, fecha | listado de clases |
| Horarios | historial | profesor/grado/fecha, página | listado de horarios |
| Estudiante/listado | novedad | código, sesión/clase, fecha | listado permitido |
| Traslados | historial/detalle | estudiante, rango, filtros | traslados |

`selectedId` solo contiene el identificador mínimo necesario; nombres, roster, tokens y credenciales no se serializan. En la implementación se probarán precedencia, recarga y back por cada rol.

### 13.5 Filtros y fecha vigente

El contrato de filtros se fija por endpoint antes de construir `FilterBar`. Para el dashboard de asistencias operativo actual, la fecha se fuerza a hoy en zona horaria Colombia; por tanto, mientras el backend no soporte un rango/fecha seleccionable, la UI debe mostrarla como alcance informativo no editable y no fingir que es un filtro de fecha. Si el producto requiere fecha editable, se añade una tarea de contrato backend y se actualizan listado, conteo, paginación y exportación juntos.

Los filtros de Secretaría de la implementación existente —fecha si está soportada, grado, disciplina y profesor— deben compartir un único objeto normalizado entre consulta, conteo, paginación, detalle/exportación. Cualquier filtro visual posterior, como nivel si reaparece, debe declararse como tal y no puede alterar una página sin cambiar conteo/exportación. Los catálogos y filtros permitidos se documentan por rol/endpoint en las tareas.

### 13.6 Login y dashboards

El login actual usa Google Identity Services, no campos de credenciales. El diseño de entrada se implementa como estados `idle/loading/success/error` del callback Google, con `aria-busy`, live region, bloqueo únicamente de la acción duplicable, reintento localizado y preservación de estado no sensible. Se definen copy para red/servidor, sesión expirada, rol no autorizado y configuración faltante sin mostrar tokens ni credenciales ni crear bucles.

Cada dashboard debe exponer `DashboardWidgetState` independiente (`loading`, `success`, `empty` con razón, `error` con retry). Shell, heading y accesos permitidos sobreviven al fallo de un widget. La configuración por rol documenta widgets, acciones y empty state de Secretaría, Supervisión y Profesor.

### 13.7 Asistencia, clases, formularios y errores

`AttendanceStatusControl` expone presente, ausente, justificado y pendiente con texto visible/nombre accesible. Toda acción masiva confirma cantidad, estado y reemplazo, y ofrece undo antes del guardado. Profesor y Supervisor consumen el mismo patrón, aunque sus acciones autorizadas difieran.

Las clases declaran una acción primaria por capacidad (`Consultar estudiantes`, `Ver sesión`, `Llamar lista`) y un estado de inicio que identifica clase/horario, evita doble inicio y conserva filtros ante error. Novedades y traslados tienen schemas de validación, error asociado al campo, resumen y foco al primer error. Traslados además confirman eliminación con estudiante y rango, excluyen origen de destino, verifican fecha/día/horario y limpian destino cuando cambia fecha u origen.

Todos los detalles usan `UserFacingError` con `kind: not-found | forbidden | network | timeout | invalid-response | server`. Un 403 conserva navegación permitida, un 404 distingue recurso inexistente y una falla de red ofrece retry; no se redirige genéricamente al dashboard desde cualquier `catch`.

### 13.8 Política transversal de mutaciones, privacidad y texto aumentado

`api.ts` puede refrescar autenticación ante 401, pero eso no demuestra que una mutación no se haya aplicado. Cada mutación se clasifica como confirmada, resultado desconocido o fallida; solo operaciones idempotentes/reconciliadas pueden reintentarse automáticamente. Toasts, logs y errores no contienen tokens, contraseñas, roster completo ni detalle sensible innecesario. Logout/expiración limpian drafts protegidamente y avisan antes cuando la plataforma lo permite.

La verificación responsive incluye tamaño de texto aumentado, zoom del usuario, nombres largos, errores multilínea, teclado virtual, orientación horizontal y safe-area. Un primitive no se considera migrado hasta que su consumidor de Secretaría, Supervisión y Profesor cumple nombre accesible, foco, 44×44 px, estados y overflow.

## 14. Matriz mínima de verificación y gates

La matriz completa se materializa en `verification-matrix.md` durante Fase 0A. Cada fila cruza `rol × flujo × dispositivo/ancho × estado` y registra evidencia, fecha y resultado. Se incluyen estas filas base:

| Rol | Flujos obligatorios | Dispositivo/ancho | Estados y comportamiento |
|---|---|---|---|
| Secretaría | login, dashboard, asistencias/filtros, clases, horarios, novedades, traslados, detalle/navegación | Android 320/375, iPhone 320/375, computador 768/1024+ | carga, éxito, vacío, error, retry, back, contexto y touch |
| Supervisión | login, dashboard, asistencias/filtros, toma de asistencia permitida, clases, horarios, novedades, traslados, detalle/navegación | Android 320/375, iPhone 320/375, computador 768/1024+ | carga, éxito, vacío, error, retry, bulk action, foco y contexto |
| Profesor | login, dashboard, clases, toma de asistencia, novedades, detalle/navegación | Android 320/375, iPhone 320/375, computador 768/1024+ | carga, éxito, vacío, error, retry, partial/unknown save, unsaved changes, back |

Para cada primitive y consumidor se verifica teclado (Tab/Shift+Tab/Enter/Espacio/Escape), foco visible, lector de pantalla, nombre/estado accesible, 44×44 px, zoom/texto aumentado, teclado virtual y ausencia de overflow. Admin recibe smoke test cuando una modificación del primitive lo afecte, aunque no sea un rol P1 de la matriz.

## 15. Fases corregidas

- **Fase 0A — contrato y arquitectura:** inventario real; `TeacherLayout`/`AppShell`; `RoleUiConfig` separado de APIs; `ViewContext`; `UserFacingError`; política de privacidad/mutaciones; decisión de filtros y asistencia; esqueleto de matriz.
- **Fase 0B — primitives migrados:** tokens, `Modal`/`ConfirmDialog`, migración de `Notify`, guardia, `PageHeader`, estados, `Pagination`, touch targets, live regions y headers duplicados; un consumidor por rol como mínimo.
- **Fase 1 — login y dashboards:** Google login robusto, `DashboardWidgetState`, copy/capacidades declarativas y estados parciales para los tres roles.
- **Fase 2A — asistencia/API:** resolver opción de snapshot/reconciliación o contrato idempotente; implementar `AttendanceDraft`, bulk action, undo, guardia, save result y recuperación.
- **Fase 2B — filtros/clases/horarios:** fijar filtros por endpoint, fecha/zona horaria, contexto, acción primaria de clase, Hoy/Todas y listas responsive.
- **Fase 3 — novedades/traslados/detalle:** schemas, validación/foco, confirmaciones, errores 403/404/network, eliminación segura y retorno contextual.
- **Fase 4 — matriz y refinamiento:** ejecutar `verification-matrix.md`, corregir regresiones, densidad, texto aumentado, orientación, safe area y consumidores Admin afectados.
