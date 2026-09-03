# Diseño: filtro amplio de asistencias para Secretaría

## 1. Objetivo y trazabilidad

La implementación añade a la consulta de asistencias de Secretaría cuatro criterios opcionales: `fecha`, `grado`, `disciplina` y `profesor`. Los filtros se combinan con `AND` y definen un único `Active_Filter_Set` que debe ser compartido por:

- el listado de sesiones;
- el conteo y la paginación;
- la exportación global, sin limitarse a la página visible.

El alcance no incluye un filtro global por estado individual de asistencia. El filtro visual `todos`/`presente`/`ausente` del detalle existente permanece sin cambios.

La pantalla de Secretaría y la de Supervisión comparten `frontend/src/pages/supervisor/SupervisorDashboard.tsx`; Secretaría la monta desde `frontend/src/pages/secretary/SecretaryDashboard.tsx` con `role="secretary"`. La ampliación debe conservar el componente compartido, pero el control de grado, su estado y su parámetro solo se muestran y envían para Secretaría.

### 1.1 Estado actual frente al estado objetivo

El diseño parte de estas diferencias verificadas en el código actual:

| Área | Estado actual | Estado objetivo documentado |
|---|---|---|
| Filtros del dashboard | Estados independientes de fecha, disciplina y profesor; no hay grado ni separación draft/aplicado. | `draftFilters` para edición y `appliedFilters` como snapshot único del listado y la exportación. |
| Aplicar/limpiar | El botón actual llama a `load(1)` y no existe acción de limpiar. | Aplicar copia el draft y carga página 1; limpiar vacía ambos estados y carga página 1 sin filtros. |
| Paginación | `Pagination` recibe `load`, que lee directamente estados editables. | `handlePageChange` usa exclusivamente `appliedFilters`, conservando todos sus valores. |
| Exportación | `handleExport` lee estados editables y no puede enviar grado. | Exporta exclusivamente el snapshot aplicado, sin `page` ni `limit`. |
| Filtro SQL por grado | `buildSessionWhereSQL` solo lee fecha, disciplina y profesor. | Lee `grado`, agrega condición parametrizada sobre `g."nombre"` y reutiliza esa condición en conteo, listado y exportación. |
| Conteo SQL | El conteo une `ClassSession` y `ExtracurricularAssignment`, pero no `Grade`. | El conteo incluye el mismo `LEFT JOIN "Grade" g` que requiere la condición de grado. |
| Paginación vacía | `Pagination` retorna `null` cuando `totalPages <= 1`; con cero resultados no muestra resumen. | El dashboard puede solicitar un render opt-in que comunique `0 resultados` sin mostrar `Página 1 de 0` ni controles navegables. |
| Supervisión | Usa el mismo dashboard y sus endpoints actuales. | Conserva la UI, consultas, exportación, navegación por id y detalle; nunca renderiza ni envía `grado`. |

Estas diferencias describen trabajo pendiente de implementación; no significan que el código actual ya cumpla el comportamiento objetivo.

## 2. Decisiones de alcance y archivos

### Frontend

- `frontend/src/pages/supervisor/SupervisorDashboard.tsx`
  - Mantener la página compartida y el prop `role`.
  - Añadir el filtro de grado únicamente cuando `role === "secretary"`.
  - Separar `draftFilters` de `appliedFilters`.
  - Usar una única función para convertir un snapshot de filtros en parámetros de consulta.
  - Centralizar las cargas de página, aplicación, limpieza, paginación y exportación.
  - Implementar estados visibles de carga, error y vacío, protección contra respuestas obsoletas y nombres accesibles.
- `frontend/src/services/roles.ts`
  - Mantener `RoleFilters.grados` en el contrato común.
  - Reutilizar `getSessions` y `exportAttendance`, que ya aceptan `Record<string, string>`; no crear un servicio adicional para grado.
- `frontend/src/services/supervisor.ts` y `frontend/src/services/secretary.ts`
  - Conservar las rutas actuales y la serialización del cliente, que omite valores vacíos mediante `URLSearchParams`.
  - No requieren cambios de contrato para esta especificación.
- `frontend/src/components/common/Pagination.tsx`
  - Añadir una opción opt-in, por ejemplo `alwaysRender?: boolean`, sin alterar el comportamiento por defecto de las demás pantallas.
  - Definir explícitamente el formato de `totalPages === 0`; no basta con saltarse el retorno temprano porque la rama actual produciría `Página 1 de 0`.
- `frontend/src/pages/supervisor/SupervisorSession.tsx`
  - No cambiar la fuente de datos ni el filtro visual de estados.
  - Verificar que las tarjetas sigan navegando por el `id` estable de la sesión.

### Backend

- `backend/src/modules/supervisor/supervisor.service.ts`
  - Extender `buildSessionWhereSQL` con `grado` y mantener todos los valores parametrizados.
  - Añadir el `LEFT JOIN "Grade" g` al conteo de `getSupervisorSessions`.
  - Usar exactamente las mismas `conditions` y `params` en conteo, listado paginado y `sessionsWithAttendances`.
- `backend/src/modules/supervisor/supervisor.routes.ts`
  - No agregar rutas. `/filters`, `/sessions`, `/sessions/export` y `/sessions/:sessionId` ya exponen el contrato requerido.
- `backend/src/modules/secretary/secretary.routes.ts`
  - No agregar rutas. Debe conservar la autenticación de Secretaría y delegar las operaciones existentes.
- `backend/src/utils/pagination.ts`
  - No requiere cambios de semántica: `page >= 1`, límite por defecto 20, máximo 100 y `totalPages = Math.ceil(total / limit)`.

## 3. Contrato de filtros y catálogo

El tipo lógico canónico es:

```ts
type AttendanceFilters = {
  fecha: string;       // YYYY-MM-DD o ""
  grado: string;       // nombre exacto de Grade o ""
  disciplina: string;  // codigoDisciplina o ""
  profesor: string;    // idProfesor o ""
};
```

Los parámetros de filtro son exactamente `fecha`, `grado`, `disciplina` y `profesor`. El listado agrega `page` y `limit`:

```text
GET /api/{role}/sessions?page=1&limit=20&fecha=2026-08-26&grado=3&disciplina=...&profesor=...
GET /api/{role}/sessions/export?fecha=2026-08-26&grado=3&disciplina=...&profesor=...
```

La exportación nunca envía `page` ni `limit`. Los valores vacíos se omiten. Los valores del usuario no se interpolan en SQL: el cliente los codifica en la URL y el backend los coloca exclusivamente en `params`.

`filterData.grados` reutiliza el catálogo que ya devuelve `getSupervisorFilters`: solo grados con estado `activo`, ordenados por `idGrado`. El valor de cada opción es el nombre exacto de `Grade`, porque el backend filtra mediante `g."nombre"`; no se inventa una conversión entre nombres e ids.

Para Secretaría, el orden visual de controles es fecha, grado, disciplina y profesor. Las opciones vacías deben ser explícitas: `Todos los grados`, `Todas las disciplinas` y `Todos los profesores`. Para Supervisión no se renderiza el control de grado, aunque el backend soporte el parámetro opcional para ambos endpoints.

## 4. Estado de la interfaz y flujo de datos

### 4.1 Estado recomendado

En `SupervisorDashboard` se mantienen estados separados:

```ts
type AttendanceFilters = {
  fecha: string;
  grado: string;
  disciplina: string;
  profesor: string;
};

const EMPTY_FILTERS: AttendanceFilters = {
  fecha: "",
  grado: "",
  disciplina: "",
  profesor: "",
};

const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);
const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
const [listError, setListError] = useState<string | null>(null);
const [catalogError, setCatalogError] = useState<string | null>(null);
```

También se conservan `sessions`, `meta`, `loading`, `exporting`, `filterData`, `user` y la navegación actuales.

- `draftFilters` contiene lo que la persona está editando y no define todavía la consulta visible.
- `appliedFilters` es un snapshot inmutable del `Active_Filter_Set` que define el listado, `meta` y la exportación.
- Editar un control no debe cambiar la lista, la metadata ni la exportación, y tampoco debe disparar una solicitud por cada cambio.
- Para Supervisión, `grado` permanece vacío y la función de serialización lo omite. No basta con ocultar el control si luego se envía el valor en segundo plano.

La serialización debe estar centralizada, por ejemplo:

```ts
function toQueryParams(filters: AttendanceFilters, role: RoleKind): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.fecha) params.fecha = filters.fecha;
  if (role === "secretary" && filters.grado) params.grado = filters.grado;
  if (filters.disciplina) params.disciplina = filters.disciplina;
  if (filters.profesor) params.profesor = filters.profesor;
  return params;
}
```

La función anterior es una forma de expresar la regla; puede implementarse con otra firma, pero listado y exportación deben usar la misma semántica.

### 4.2 Carga inicial y aplicación

La carga inicial usa `EMPTY_FILTERS` y página 1. No debe depender de un closure que lea estados editables posteriores.

`handleApplyFilters` debe:

1. crear un snapshot nuevo a partir de `draftFilters`;
2. guardar ese snapshot como `appliedFilters`;
3. invalidar la solicitud de listado anterior e iniciar la carga de página 1 pasando explícitamente el snapshot;
4. actualizar `sessions` y `meta` solo con la respuesta vigente;
5. conservar los valores seleccionados aunque el resultado sea vacío.

La función de carga debe recibir explícitamente `(page, filters)` o equivalente. No debe leer `fecha`, `grado`, `disciplina` o `profesor` desde cierres que puedan contener el estado anterior cuando React ejecute la solicitud.

`handleClearFilters` debe:

1. invalidar cualquier carga de listado en curso;
2. asignar `EMPTY_FILTERS` a `draftFilters` y `appliedFilters`;
3. cargar página 1 sin filtros adicionales;
4. dejar `meta` con el total y las páginas del alcance sin filtros;
5. mantener la misma vista y no modificar el filtro visual de estados del detalle.

Aplicar y limpiar siempre reinician la página a 1. Ambos controles deben ser botones nativos con `type="button"`; limpiar permanece disponible durante la edición y puede iniciar una nueva carga aun cuando otra esté en curso.

### 4.3 Paginación y conservación del alcance

`handlePageChange(page)` usa exclusivamente `appliedFilters`; nunca copia valores de `draftFilters`. Debe:

1. conservar exactamente el snapshot activo;
2. construir los parámetros con `toQueryParams(appliedFilters, role)`;
3. agregar `page` y `limit=20` solo para el listado;
4. actualizar lista y metadata solo si la respuesta sigue siendo vigente.

Al cambiar de página no se vuelve a leer ningún control editable. Así, si la lista visible corresponde a `F`, editar un control a otro valor `G` sin pulsar Aplicar y luego paginar sigue solicitando `F`, no `G`.

El backend devuelve `total` y `totalPages` a partir del mismo conjunto filtrado. Con `total=0`, `page=1` y `totalPages=0` son valores válidos de metadata; no se debe intentar navegar a una página inexistente.

### 4.4 Exportación global sincronizada

`handleExport` toma el `appliedFilters` vigente en el momento del click y usa la misma función `toQueryParams` que el listado. No usa filtros draft no aplicados. Si la persona edita un control y desea exportar el nuevo alcance, debe pulsar primero Aplicar; mientras tanto, exportar conserva el alcance de la lista visible.

La solicitud de exportación:

- incluye `fecha`, `grado` solo para Secretaría, `disciplina` y `profesor` que estén activos;
- no incluye `page` ni `limit`;
- debe usar el snapshot completo, aunque el listado esté en una página intermedia;
- mantiene el flujo actual de `Blob`, `URL.createObjectURL`, descarga y `URL.revokeObjectURL`.

`exporting` vuelve a `false` tanto en éxito como en error. Un error muestra un mensaje visible y permite reintentar sin cambiar `appliedFilters`.

### 4.5 Carga del catálogo

La carga de `api.getFilters()` debe distinguirse de la carga del listado:

- mientras carga, la zona de catálogo muestra un indicador accesible;
- si falla, muestra `No se pudieron cargar los filtros...` de forma visible y conserva la estructura de la vista;
- los controles siguen existiendo, con opciones vacías o las opciones ya disponibles;
- la carga de sesiones no se considera automáticamente fallida y no queda bloqueada por el error del catálogo;
- fecha, Aplicar y Limpiar conservan una semántica coherente aunque no haya opciones de selects.

## 5. Prevención de respuestas obsoletas

El cliente `api` no expone actualmente un `AbortSignal`, por lo que la primera implementación usa un contador monotónico, por ejemplo `requestIdRef`:

1. cada carga de sesiones incrementa el contador y captura su id;
2. cada `then`, `catch` y `finally` compara el id capturado con el actual;
3. solo la solicitud vigente puede escribir `sessions`, `meta`, `listError` o `loading`;
4. una respuesta antigua no puede ocultar el indicador ni borrar un error de una solicitud más nueva.

El mismo mecanismo se aplica al iniciar rápidamente Aplicar, Limpiar o un cambio de página. La solicitud se asocia al snapshot de filtros que recibió; si falla, se conservan los filtros de ese snapshot y se muestra el error correspondiente. La invalidación por request id es la garantía funcional aunque posteriormente se añada `AbortController` como optimización.

## 6. Backend y SQL parametrizado

### 6.1 Construcción de condiciones

`buildSessionWhereSQL(query)` debe leer `grado` además de `fecha`, `disciplina` y `profesor`:

- siempre conserva `cs."estado" = 'finalizada'`;
- `disciplina` agrega `ea."codigoDisciplina" = $n`;
- `profesor` agrega `cs."idProfesor" = $n`;
- `grado` agrega `g."nombre" = $n`;
- `fecha` conserva el formato exacto `YYYY-MM-DD` y el rango de inicio y fin del día existente.

Cada valor se agrega primero a `params` y la condición usa el índice posterior a ese `push`. Ningún valor de query se concatena en el texto SQL.

El listado y la exportación ya utilizan `SESSION_JOIN`, que incluye `LEFT JOIN "Grade" g`. El conteo de `getSupervisorSessions` actualmente no incluye ese join; debe añadir el mismo `LEFT JOIN "Grade" g ON g."idGrado" = ea."idGrado"` antes de aplicar `where`. El conteo mantiene `COUNT(DISTINCT cs."id")`.

La invariante es:

```text
conditions y params de un request
  = condiciones y parámetros del COUNT
  = condiciones y parámetros del SELECT paginado
  = condiciones y parámetros de sessionsWithAttendances
```

Solo el SELECT paginado añade al final sus parámetros propios de `LIMIT` y `OFFSET`; la exportación no añade ninguno.

### 6.2 Listado paginado

`getSupervisorSessions` conserva este flujo:

1. parsear `page` y `limit` con `parsePagination`;
2. obtener `conditions` y `params` una sola vez;
3. ejecutar el conteo con el join de `Grade` cuando corresponda;
4. ejecutar el `SELECT` con una copia de `params` y añadir `LIMIT` y `OFFSET` al final;
5. mapear las filas con `sessionShape` y devolver `meta`.

El `SELECT` ya contiene el join de `Grade` y el grupo correspondiente. La condición de grado debe afectar tanto al conteo como al SELECT, para que `total`, `totalPages` y las tarjetas representen exactamente el mismo alcance.

No se modifica el shape de `SupervisorSessionItem`: las tarjetas siguen mostrando disciplina, grado, profesor, horario, fecha y conteos.

### 6.3 Exportación global

`exportSupervisorAttendance` debe llamar a `buildSessionWhereSQL` una sola vez y pasar exactamente `conditions` y `params` a `sessionsWithAttendances`. Esa función obtiene todas las sesiones coincidentes sin `LIMIT` ni `OFFSET`, une sus asistencias y genera el workbook actual.

No se implementa una segunda lógica de filtros para exportar. La igualdad entre listado, conteo y exportación es una propiedad del diseño. El export individual `/sessions/:sessionId/export` no recibe filtros globales y no se modifica.

Las rutas continúan separadas por autenticación:

- `/api/supervisor/sessions` y `/api/supervisor/sessions/export`;
- `/api/secretary/sessions` y `/api/secretary/sessions/export`.

El backend puede aceptar `grado` en ambos roles para compartir handlers, pero la UI de Supervisión no lo envía. Una petición de Supervisión sin `grado` debe conservar el resultado previo.

## 7. Paginación, cero resultados y estados accesibles

### 7.1 Contrato de `Pagination` para `totalPages=0`

El comportamiento por defecto de `Pagination` no cambia: las pantallas existentes siguen ocultando el componente cuando `totalPages <= 1`. El dashboard de asistencias puede activar una opción opt-in (`alwaysRender` o nombre equivalente) para cumplir el requisito de mostrar el estado de cero resultados.

Con esa opción y `totalPages === 0`, la variante usada por el dashboard debe:

- renderizar un resumen accesible que diga `0 resultados`;
- no mostrar `Página 1 de 0`;
- ocultar los botones de navegación o dejarlos deshabilitados, sin acciones que soliciten una página inexistente;
- conservar `page=1` solo como valor técnico de metadata;
- no alterar el `Empty_State` del área de listado.

Con `totalPages > 0`, se conserva el formato normal de páginas. La opción es opt-in para no cambiar otras pantallas. Si se mantiene la variante `centered`, debe respetar la misma regla de no mostrar una fracción `1 / 0`; el dashboard de esta especificación usa la variante existente `bordered` salvo decisión explícita posterior.

### 7.2 Estados visibles y accesibles

Cada control debe tener una etiqueta visible asociada mediante `htmlFor`/`id` estable:

- `attendance-fecha` / `Fecha`;
- `attendance-grado` / `Grado`;
- `attendance-disciplina` / `Disciplina`;
- `attendance-profesor` / `Profesor`.

El orden DOM recomendado es fecha, grado cuando corresponda, disciplina, profesor, Aplicar, Limpiar y Exportar. Los botones deben ser enfocables y operables con teclado. Aplicar y Limpiar no deben mover el foco a un elemento destruido; se conserva el foco en la acción activada o se devuelve al primer control únicamente cuando sea necesario.

El área del listado debe tener `aria-live="polite"` o una región de estado equivalente. Carga, error y vacío deben ser texto real:

- carga: `Cargando asistencias...`;
- error de catálogo: `No se pudieron cargar los filtros...`;
- error de listado: `No se pudieron cargar las asistencias...`;
- vacío: `No hay asistencias registradas con los filtros actuales.`;
- exportación: el botón comunica `Generando...`; el error es visible y permite un nuevo intento.

Cuando no hay resultados, los controles conservan el snapshot seleccionado, el `Empty_State` permanece dentro del área del listado y `Pagination` comunica cero resultados sin páginas navegables.

## 8. Preservación del detalle de sesión y de Supervisión

Cada tarjeta navega a `${basePath}/session/${s.id}`. El backend de detalle recibe ese id y consulta una sola `ClassSession`; no reconstruye la sesión a partir de grado, disciplina o profesor. Esto garantiza que una sesión obtenida con un filtro de grado no sea sustituida por otra del mismo grado.

Los filtros globales no se envían a `getSession` ni alteran `SupervisorSession`. El detalle conserva sus registros y sus opciones de estado existentes:

- `todos` muestra todos los registros;
- `presente` muestra solo presentes;
- `ausente` muestra solo ausentes.

La vista de Supervisión conserva, sin regresión:

1. el acceso autorizado y sus endpoints actuales;
2. la UI actual de fecha, disciplina y profesor, sin control de grado visible;
3. el listado, conteo, paginación y exportación sin parámetro `grado`;
4. la navegación al detalle por `session.id` y el comportamiento existente del detalle;
5. el shape de las respuestas y sus capacidades actuales.

La condición de rol debe comprobarse tanto al renderizar el control como al serializar parámetros. Ocultar el control sin omitir el parámetro no satisface esta regla.

## 9. Propiedades de corrección

Las siguientes propiedades guían implementación y pruebas sobre cualquier conjunto de sesiones y cualquier combinación de valores no vacíos.

### P1. Coincidencia conjuntiva

Toda sesión devuelta por el listado o la exportación cumple simultáneamente cada filtro activo: fecha, `assignment.grade.nombre`, `assignment.discipline.codigoDisciplina` y `teacher.idProfesor`. Un filtro vacío no restringe el resultado.

### P2. Igualdad entre conteo, listado y exportación

Para un mismo snapshot `F`, la unión del listado paginado de todas sus páginas es igual al conjunto de sesiones usado para exportación. `meta.total` es el tamaño del conjunto y `totalPages = ceil(total / limit)`.

### P3. Persistencia al paginar

Cambiar de página sin Aplicar ni Limpiar conserva exactamente `F`; ninguna solicitud de página usa valores de `draftFilters`.

### P4. Reinicio de página

Aplicar un nuevo snapshot o limpiar produce una solicitud con `page=1` y no muestra la continuación de la página anterior.

### P5. Exportación sin paginación

La exportación usa `F`, omite `page` y `limit` e incluye sesiones de todas las páginas coincidentes. Sin filtros conserva el alcance global anterior.

### P6. Separación draft/aplicado

Editar un control sin aplicar no cambia lista, metadata ni exportación. Aplicar sincroniza lista, paginación y exportación con el nuevo snapshot. Limpiar vacía controles y snapshot y recarga la primera página sin filtros.

### P7. Respuesta vigente única

Si dos solicitudes terminan en orden inverso, solo la última iniciada puede modificar lista, metadata, error o carga.

### P8. Cero resultados

Si `F` no coincide, se conservan sus valores, se muestra `Empty_State`, se devuelve `total=0`, `totalPages=0` y `Pagination` comunica `0 resultados` sin navegación habilitada ni texto `Página 1 de 0`.

### P9. Parametrización

Los valores de fecha, grado, disciplina y profesor aparecen solo en `params`; ningún valor de query se concatena como SQL ejecutable.

### P10. Compatibilidad por rol

Una solicitud de Supervisión sin `grado` conserva el resultado, shape, paginación y exportación previos. La UI de Supervisión no renderiza ni envía grado. Secretaría y Supervisión pueden compartir condiciones y handlers cuando reciben los mismos filtros permitidos, diferenciándose por autenticación y endpoint.

### P11. Identidad del detalle

Para cualquier tarjeta seleccionada, el detalle corresponde al mismo `session.id`, independientemente de los filtros que produjeron el listado. El filtro de estados opera solo sobre `records` ya cargados.

### P12. Accesibilidad operable

Todos los controles tienen nombre accesible, se pueden operar con teclado y exponen cambios de carga, error y vacío como texto accesible.

## 10. Plan de pruebas y validación

### 10.1 Pruebas unitarias de backend

Añadir pruebas Vitest para la lógica pura de condiciones, extrayéndola o exportándola sin cambiar el contrato HTTP:

1. sin filtros solo aparece la condición de sesión finalizada;
2. cada filtro individual genera columna y parámetro esperados;
3. `grado` usa `g."nombre"` y su valor no aparece en el SQL;
4. combinaciones de dos, tres y cuatro filtros usan `AND` e índices `$n` correctos;
5. fechas válidas generan inicio y fin del día;
6. el conteo incluye el join de `Grade` cuando `grado` está activo;
7. los mismos `conditions`/`params` se pasan al listado y a la exportación.

### 10.2 Pruebas API/integración

Usar valores descubiertos desde el catálogo activo, sin asumir un grado fijo:

- `/supervisor/filters` y `/secretary/filters` incluyen grados activos;
- cada filtro individual y las combinaciones solo devuelven sesiones coincidentes;
- `meta.total` y `meta.totalPages` corresponden al conjunto filtrado, incluido cero;
- solicitar una segunda página conserva fecha, grado, disciplina y profesor;
- exportar con filtros incluye todas las sesiones coincidentes aunque superen una página;
- exportar sin filtros conserva el alcance global;
- los endpoints de Secretaría y Supervisión conservan el shape;
- Supervisión sin `grado` conserva el resultado y no requiere el nuevo control;
- el detalle de un id obtenido desde una lista filtrada devuelve ese mismo id.

### 10.3 Validación frontend

El frontend no tiene actualmente runner de componentes. La validación automatizada mínima es:

- `npm run build` en `frontend`;
- `npm run build` en `backend`;
- `npm test` en `backend` para pruebas existentes y nuevas.

Si se incorpora un runner de componentes posteriormente, debe cubrir draft/aplicado, aplicar, limpiar, reset de página, conservación de filtros al paginar, exportación con snapshot aplicado, respuesta obsoleta y `totalPages=0`.

### 10.4 Verificación manual

Con una cuenta de Secretaría:

1. abrir el dashboard y comprobar fecha, grado, disciplina, profesor, labels y opciones;
2. aplicar solo grado y verificar página 1, listado y total filtrados;
3. combinar los cuatro filtros, navegar páginas y confirmar que no se pierden;
4. editar un control sin aplicar y confirmar que listado, paginación y exportación conservan el snapshot anterior;
5. aplicar el cambio y confirmar que listado y exportación se sincronizan;
6. limpiar y comprobar controles vacíos, listado sin filtros y primera página;
7. probar una combinación sin resultados: valores conservados, mensaje visible, `0 resultados` y cero páginas navegables;
8. comprobar carga/error de catálogo, listado y exportación, incluido el reintento;
9. usar teclado y un inspector o lector de pantalla para labels, foco y regiones live;
10. abrir una sesión filtrada, alternar `Presentes`, `Ausentes` y `Todos`, volver y aplicar otro filtro.

Con una cuenta de Supervisión:

1. comprobar que no aparece el control de grado;
2. repetir la consulta actual de fecha, disciplina y profesor;
3. verificar que paginación, exportación, shape, navegación y detalle no cambian;
4. confirmar que las solicitudes no envían `grado`.

## 11. Secuencia de implementación

1. Hacer testeable `buildSessionWhereSQL` y añadir `grado` parametrizado.
2. Añadir el `LEFT JOIN "Grade" g` al conteo y verificar igualdad de condiciones entre conteo, listado y exportación.
3. Actualizar `SupervisorDashboard` con `draftFilters`/`appliedFilters`, grado condicionado por rol, `toQueryParams`, Aplicar, Limpiar, paginación por snapshot, exportación sincronizada y request id.
4. Añadir estados visibles, labels, regiones live y el contrato opt-in de `Pagination` para `totalPages=0`.
5. Confirmar que `SupervisorSession`, las rutas, autenticación y capacidades de Supervisión no sufren cambios.
6. Ejecutar pruebas backend, builds y la matriz manual por rol.

No se modifican datos, migraciones ni permisos. El cambio es de consulta, presentación y pruebas; las autenticaciones separadas de `/api/supervisor` y `/api/secretary` permanecen vigentes.
