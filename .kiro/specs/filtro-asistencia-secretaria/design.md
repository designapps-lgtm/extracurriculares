# Filtro de asistencia para secretaria Bugfix Design

## Overview

La vista de asistencia de secretaria reutiliza `SupervisorSession` mediante `SecretarySession`, pero actualmente los conteos de Presentes y Ausentes son elementos no interactivos y la lista siempre renderiza `data.records.map(...)`. Como resultado, la secretaria no puede inspeccionar únicamente los registros de un estado de asistencia.

La solución será un cambio de frontend localizado en `frontend/src/pages/supervisor/SupervisorSession.tsx`. Se agregará un estado local con los valores `todos`, `presente` y `ausente`; los controles de Presentes y Ausentes serán botones accesibles y se incorporará una opción explícita Todos. La lista se derivará de `data.records` según el filtro activo, mientras que los conteos, exportación, acciones de Novedades y navegación continuarán usando los datos y callbacks existentes. El comportamiento de la vista de supervisor fuera del flujo de secretaria se conservará sin filtros nuevos.

## Glossary

- **Bug_Condition (C)**: Una sesión de asistencia del flujo de secretaria en la que se solicita un filtro `presente` o `ausente`, pero la lista visible incluye registros de otros estados porque sigue mostrando todos los registros.
- **Property (P)**: Para una condición de bug, la lista visible contiene exactamente los registros cuyo `estado` coincide con el filtro seleccionado y el control seleccionado se identifica visualmente y semánticamente como activo.
- **Preservation**: Los comportamientos existentes que no forman parte del filtro —conteos completos, exportación, Novedades, Volver, Salir, rutas y el flujo de supervisor— permanecen sin cambios.
- **AttendanceFilter**: Estado local de UI con uno de los valores `todos`, `presente` o `ausente`.
- **Full records**: `data.records`, la colección completa de registros de la sesión usada para conteos, exportación y datos de navegación.
- **Visible records**: La colección derivada para renderizar la lista; es `data.records` para `todos` y para flujos no-secretaria, o el subconjunto con el estado seleccionado para el flujo de secretaria.
- **SupervisorSession**: Componente compartido que obtiene y renderiza el detalle de una sesión de asistencia para supervisor y secretaria mediante la prop `role`.
- **SecretarySession**: Componente adaptador que renderiza `<SupervisorSession role="secretary" />`.

## Bug Details

### Bug Condition

El bug se manifiesta cuando una secretaria intenta seleccionar Presentes o Ausentes en una sesión que contiene registros de más de un estado. Los contadores actuales son `span`, por lo que no pueden cambiar el filtro, y el renderizado de la lista usa directamente `data.records.map`, sin derivar registros visibles según un estado.

**Formal Specification:**

```text
FUNCTION isBugCondition(X)
  INPUT: X of type AttendanceSessionView
  OUTPUT: boolean

  RETURN X.role = "secretary"
         AND X.records.length > 0
         AND X.requestedFilter IN {"presente", "ausente"}
         AND EXISTS record IN X.records WHERE record.estado != X.requestedFilter
         AND X.visibleRecords = X.records
END FUNCTION
```

La condición identifica el estado observable defectuoso después de intentar aplicar un filtro: existe al menos un registro que debería ocultarse, pero continúa en la lista.

### Examples

- **Presentes en una sesión mixta:** `data.records` contiene Ana (`presente`), Bruno (`ausente`) y Carla (`justificado`). Al seleccionar Presentes, el comportamiento actual sigue mostrando los tres; el comportamiento corregido muestra únicamente a Ana y marca el botón Presentes como activo.
- **Ausentes en una sesión mixta:** con los mismos registros, al seleccionar Ausentes la lista actual no cambia; el comportamiento corregido muestra únicamente a Bruno y reemplaza el estado activo de Presentes por Ausentes.
- **Restaurar Todos:** después de seleccionar Ausentes, la secretaria pulsa Todos. La lista corregida vuelve a incluir Ana, Bruno y Carla; los conteos siguen siendo Presentes: 1, Ausentes: 1 y Total: 3.
- **Filtro sin coincidencias:** una sesión contiene únicamente registros `presente` y la secretaria selecciona Ausentes. La vista debe conservar los conteos completos y mostrar un estado vacío específico, por ejemplo “No hay estudiantes ausentes en esta sesión”, con una acción Todos para regresar a la lista completa.
- **Sesión sin registros:** una sesión con `data.records.length === 0` debe continuar mostrando el estado vacío general de sesión sin inventar resultados filtrados.
- **Acción preservada:** con Presentes activo, la secretaria pulsa Novedades sobre un registro visible. La navegación debe usar el mismo `sessionId` y los mismos datos del estudiante que antes del filtro.

## Expected Behavior

### Correct Behavior Specification

```text
FUNCTION expectedBehavior(X)
  INPUT: X of type AttendanceSessionView
  OUTPUT: AttendanceSessionViewResult

  IF X.role != "secretary" THEN
    RETURN result.visibleRecords = X.records
  END IF

  IF X.selectedFilter = "todos" THEN
    RETURN result.visibleRecords = X.records
  END IF

  RETURN result.visibleRecords = filter(
           X.records,
           record.estado = X.selectedFilter
         )
         AND result.activeControl = X.selectedFilter
         AND result.counts = counts(X.records)
END FUNCTION
```

### Preservation Requirements

**Unchanged Behaviors:**

- Los conteos de Presentes, Ausentes y Total se calculan siempre sobre `data.records` completos, no sobre `visibleRecords`, aunque exista un filtro activo.
- Exportar a Excel continúa invocando `api.exportSession(sessionId)` y genera el archivo de la sesión completa; el filtro visual no cambia el contenido exportado.
- Novedades continúa navegando a `${basePath}/novedad/${r.codigoEstudiante}` con `sessionId`, código, nombre, apellido y grupo del registro visible.
- Volver, Salir y el enlace al dashboard continúan navegando a los destinos actuales.
- La carga de la sesión, el manejo de errores de autenticación, los estados de carga y el estado de sesión no encontrada permanecen sin cambios.
- La vista de supervisor (`role !== "secretary"`) conserva su lista completa y sus controles existentes, sin aplicar este filtro específico de secretaria.
- El significado de `data.records` no cambia y no se mutan registros ni se modifica el comportamiento de las APIs.

**Scope:**

El cambio afecta únicamente a la lista visual de la sesión en el flujo de secretaria y a los controles que la gobiernan. Incluye otros estados de teclado, ratón o navegación solo en cuanto a asegurar que no cambien. No incluye cambios de backend, tipos compartidos, rutas, formato de exportación, cálculo de asistencia ni la pantalla de novedades.

### Filter Controls and Accessibility

- Presentes y Ausentes se renderizarán como elementos `<button type="button">`, conservando sus conteos completos dentro de la etiqueta visible.
- Todos será un botón explícito y siempre permitirá quitar el filtro; cuando corresponda, un estado vacío filtrado podrá ofrecer además un botón “Mostrar todos” que active el mismo estado.
- Los controles se agruparán semánticamente con una etiqueta accesible, por ejemplo `role="group"` y `aria-label="Filtrar registros de asistencia"`.
- Cada botón expondrá `aria-pressed={attendanceFilter === value}` para que tecnologías asistivas conozcan el filtro activo. El estilo activo no será la única señal: se conservará el nombre del filtro y el estado semántico.
- Los botones tendrán estilos de foco visibles y estados disabled/hover coherentes con el diseño existente. No se dependerá únicamente del color para comunicar la selección.
- El contenedor de la lista podrá identificarse con `aria-live="polite"` o una etiqueta equivalente si resulta compatible con el patrón existente, para comunicar cambios de resultados sin interrumpir la navegación.

## Hypothesized Root Cause

1. **Controles no interactivos:** Presentes y Ausentes se implementan como `span`, por lo que no existe una interacción que actualice un filtro local ni una semántica de botón.
2. **Renderizado directo de la fuente:** La lista usa `data.records.map(...)` en lugar de una colección derivada. Aunque se agregara un estado de filtro, no tendría efecto mientras el renderizado siga consumiendo todos los registros.
3. **Ausencia de estado explícito:** El componente no tiene una variable que represente `todos`, `presente` o `ausente`, por lo que no puede mantener la selección ni cambiar directamente entre estados.
4. **Conteos y resultados no están separados conceptualmente:** El mismo `data.records` es apropiado para conteos y exportación, pero debe producirse una colección independiente para la lista. Filtrar `data.records` en sitio o reutilizar la colección filtrada para conteos introduciría una regresión.
5. **Componente compartido por dos roles:** `SupervisorSession` atiende tanto a supervisor como a secretaria. Aplicar controles y filtrado sin considerar `role` podría cambiar involuntariamente el flujo de supervisor; la implementación debe limitar la nueva UI y la lista derivada al rol `secretary`.

## Correctness Properties

Property 1: Bug Condition - La lista de secretaria respeta el estado seleccionado

_For any_ sesión del flujo de secretaria donde `isBugCondition(X)` sea verdadero, la implementación corregida SHALL mostrar en `visibleRecords` exactamente `filter(X.records, record.estado = X.selectedFilter)` para `selectedFilter` igual a `presente` o `ausente`, sin incluir registros de otros estados.

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - Entradas no afectadas conservan el comportamiento original

_For any_ estado de sesión donde `isBugCondition(X)` sea falso, la implementación corregida SHALL producir el mismo comportamiento original para la lista no filtrada y conservar las acciones existentes, incluyendo Novedades, exportación, navegación y el flujo de supervisor.

**Validates: Requirements 3.1, 3.2, 3.3, 3.5**

Property 3: Filter State - Todos y los cambios directos son deterministas

_For any_ colección de registros y cualquier secuencia de selecciones válidas entre `todos`, `presente` y `ausente`, seleccionar `todos` SHALL mostrar la colección completa, y seleccionar un estado SHALL reemplazar el estado anterior y mostrar únicamente los registros que coincidan con el nuevo estado.

**Validates: Requirements 2.3, 2.4**

Property 4: Full Data Isolation - El filtro visual no altera conteos ni operaciones de sesión

_For any_ colección de registros y cualquier filtro activo de secretaria, los conteos mostrados SHALL ser iguales a los conteos calculados desde la colección completa, y las operaciones de exportación, Novedades y navegación SHALL recibir los mismos datos que recibirían sin filtro.

**Validates: Requirements 3.1, 3.2, 3.4**

## Fix Implementation

### Changes Required

**File**: `frontend/src/pages/supervisor/SupervisorSession.tsx`

**Function/Component**: `SupervisorSession`

**Specific Changes**:

1. **Agregar el tipo y estado local del filtro:**
   - Declarar un tipo local `AttendanceFilter = "todos" | "presente" | "ausente"`.
   - Inicializar `const [attendanceFilter, setAttendanceFilter] = useState<AttendanceFilter>("todos")`.
   - Mantener el estado en el componente, sin persistencia ni cambios de URL, para que abandonar o recargar la sesión restablezca Todos.

2. **Derivar la lista visible sin mutar la fuente:**
   - Crear `visibleRecords` a partir de `data.records`.
   - Para `role === "secretary"` y filtro distinto de `todos`, aplicar `data.records.filter((r) => r.estado === attendanceFilter)`.
   - Para Todos y para roles distintos de secretaria, usar todos los registros.
   - Sustituir únicamente el `data.records.map(...)` de la lista por `visibleRecords.map(...)`; conservar `data.records.length` para el estado de sesión sin registros.

3. **Convertir los conteos requeridos en controles accesibles:**
   - Reemplazar los `span` de Presentes y Ausentes por botones con `type="button"` y `onClick` que actualice el filtro.
   - Mantener cada conteo derivado de `counts`, que se calcula antes del filtrado.
   - Renderizar los botones de filtro en el flujo de secretaria; para supervisor, conservar la apariencia y comportamiento existente o aplicar una presentación no interactiva equivalente sin filtrar la lista, según el patrón visual del componente.
   - Añadir el botón Todos con `onClick={() => setAttendanceFilter("todos")}` y estado activo cuando corresponda.

4. **Indicar el estado activo y soportar teclado/lectores de pantalla:**
   - Aplicar `aria-pressed` a cada control y clases visuales distinguibles para el estado activo.
   - Incluir `aria-label` o texto accesible que indique “Presentes”, “Ausentes” y “Todos”, sin ocultar los conteos visibles.
   - Añadir foco visible, `role="group"` y una etiqueta accesible al conjunto de filtros.

5. **Agregar estados vacíos específicos:**
   - Conservar el mensaje actual para `data.records.length === 0`.
   - Cuando `data.records.length > 0` pero `visibleRecords.length === 0`, mostrar un mensaje que indique que no hay registros para el estado seleccionado y un botón Todos/Mostrar todos.
   - No renderizar una cuadrícula vacía ni eliminar la posibilidad de regresar a la lista completa.

6. **Conservar las operaciones fuera del filtro:**
   - No modificar `handleExport`, `openNovedad`, `counts`, `api.getSession`, `basePath`, los enlaces ni las rutas.
   - No pasar `visibleRecords` a la exportación ni cambiar el objeto `state` usado por Novedades.
   - No cambiar `SecretarySession.tsx`, contratos de API, tipos de dominio o backend.

## Testing Strategy

### Validation Approach

La validación seguirá la metodología de bugfix: primero se debe poder reproducir el defecto en el renderizado actual, luego verificar la corrección para cada filtro y finalmente comprobar que las operaciones no relacionadas siguen utilizando la colección completa. Las pruebas deben cubrir tanto la variante compartida `SupervisorSession role="secretary"` como la preservación de `role="supervisor"`.

### Exploratory Bug Condition Checking

**Goal**: Obtener contraejemplos del código actual antes de implementar el cambio y confirmar que el problema está en la falta de controles y en el uso directo de `data.records`.

**Test Plan**: Renderizar `SupervisorSession` con `role="secretary"` y una sesión que contenga registros `presente`, `ausente` y `justificado`. Comprobar que los elementos actuales no son botones, que no existe una acción de filtro y que el renderizado muestra todos los registros. Si se usa una prueba de interacción, intentar seleccionar los contadores debe demostrar que no existe un cambio de lista.

**Test Cases**:

1. **Controles actuales no interactivos**: comprobar que Presentes y Ausentes son `span` y no tienen rol/acción de botón.
2. **Lista sin filtro**: con una sesión mixta, comprobar que la vista actual muestra los registros de los tres estados.
3. **Contraejemplo de Presentes**: intentar obtener solo `presente`; los registros `ausente` y `justificado` permanecen visibles en el código no corregido.
4. **Contraejemplo de Ausentes**: intentar obtener solo `ausente`; la lista actual tampoco cambia.

**Expected Counterexamples**:

- No existe un control accionable para cambiar el estado.
- `data.records.map` produce estudiantes de todos los estados aun cuando se solicita conceptualmente un subconjunto.
- No existe un estado vacío diferenciable para un filtro que no tiene coincidencias.

### Fix Checking

**Goal**: Verificar que todos los estados de filtro de secretaria producen la colección visible correcta y que la UI comunica el estado activo.

**Pseudocode:**

```text
FOR ALL X WHERE isBugCondition(X) DO
  result := renderSupervisorSession_fixed(X, role = "secretary")
  ASSERT result.visibleRecords = filter(X.records, record.estado = X.requestedFilter)
  ASSERT result.control(X.requestedFilter).ariaPressed = true
  ASSERT every rendered record has record.estado = X.requestedFilter
END FOR
```

**Test Cases**:

1. Seleccionar Presentes en una sesión mixta y verificar que solo aparecen registros `presente`, el conteo completo no cambia y Presentes tiene `aria-pressed="true"`.
2. Seleccionar Ausentes después de Presentes y verificar que el filtro anterior se reemplaza, no se combina, y solo aparecen registros `ausente`.
3. Seleccionar Todos después de cualquier estado y verificar que vuelven todos los registros, incluidos `justificado`.
4. Seleccionar un estado sin coincidencias y verificar el mensaje vacío específico, el botón Todos y la posibilidad de restaurar la lista.
5. Activar los controles mediante teclado y verificar que tienen foco visible, nombre accesible y el mismo resultado que un clic.

### Preservation Checking

**Goal**: Verificar que para entradas no afectadas el resultado y las operaciones del componente siguen siendo equivalentes al comportamiento original.

**Pseudocode:**

```text
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT renderSupervisorSession_original(X).visibleRecords
         = renderSupervisorSession_fixed(X).visibleRecords
  ASSERT counts_original(X.records) = counts_fixed(X.records)
  ASSERT export_original(X.sessionId) = export_fixed(X.sessionId)
  ASSERT navigationPayload_original(X) = navigationPayload_fixed(X)
END FOR
```

**Test Cases**:

1. **Conteos independientes del filtro**: seleccionar Presentes y Ausentes en sesiones mixtas y comprobar que Presentes, Ausentes y Total siempre corresponden a `data.records`, no a la lista visible.
2. **Exportación completa**: con un filtro activo, pulsar Exportar a Excel y comprobar que se invoca `api.exportSession(sessionId)` una sola vez con el mismo `sessionId` y que el filtro no se envía como parámetro ni recorta el archivo.
3. **Novedades**: con y sin filtro, pulsar Novedades en un registro visible y comprobar el mismo destino, `sessionId` y payload del estudiante.
4. **Navegación y estados de carga**: comprobar que Volver, Salir, autenticación, carga y sesión no encontrada conservan sus rutas y mensajes.
5. **Supervisor sin regresión**: renderizar con `role="supervisor"` y verificar que la lista sigue mostrando todos los registros y que las acciones existentes mantienen su comportamiento.

### Unit Tests

- Probar la derivación `todos -> todos los registros`, `presente -> solo presentes` y `ausente -> solo ausentes`.
- Probar el cambio directo `presente -> ausente` y `ausente -> presente`.
- Probar el estado vacío cuando la sesión tiene registros pero el filtro no tiene coincidencias, incluyendo la acción Todos.
- Probar el estado vacío original cuando la sesión no tiene registros.
- Probar que los botones tienen `type="button"`, nombre accesible, `aria-pressed` correcto y foco/activación por teclado.
- Probar que los conteos se calculan antes del filtro y permanecen basados en `data.records`.

### Property-Based Tests

- Generar colecciones de registros con estados `presente`, `ausente` y `justificado`; para cada filtro de secretaria, verificar que la lista visible es exactamente el resultado de `filter(records, estado)`, preservando orden y cardinalidad.
- Generar secuencias de selecciones válidas y verificar que el estado final determina de forma determinista la lista: `todos` muestra la fuente completa y cada estado muestra únicamente sus coincidencias.
- Generar sesiones y filtros, y verificar que los conteos completos son invariantes respecto del filtro y que el resultado de exportación/navegación no depende de `visibleRecords`.
- Generar entradas con `role="supervisor"` o sin condición de bug y verificar preservación de la lista completa y las acciones existentes.

### Integration Tests

- Probar el flujo completo de secretaria: cargar sesión, seleccionar Presentes, revisar la lista, cambiar a Ausentes y volver a Todos.
- Probar una sesión mixta con un registro Justificado para asegurar que Todos lo incluye y que Presentes/Ausentes no lo incluyen.
- Probar una sesión sin coincidencias para un estado y restaurar la lista mediante Mostrar todos.
- Probar, con un filtro activo, exportación, Novedades, Volver y Salir para confirmar que el filtrado solo afecta la lista.
- Probar el flujo compartido de supervisor para confirmar que la nueva funcionalidad no cambia su comportamiento.
