# Requirements Document

## Introduction

Esta especificación define una mejora transversal de usabilidad, responsive design y accesibilidad para el aplicativo de Extracurriculares. El alcance tiene la misma prioridad de producto para **Secretaría**, **Supervisión** y **Profesores**; debe funcionar en Android, iPhone y computador, y cubre los flujos de login, dashboard, consulta y filtrado de asistencias, toma de asistencia, clases, horarios, novedades, traslados, detalle y navegación.

La especificación responde a la auditoría estática que identificó navegación profunda sin contexto, encabezados duplicados, toma de asistencia frágil ante fallos parciales, salida con cambios pendientes, acciones masivas sin confirmación, traslados confusos para Secretaría, validaciones débiles de fechas/origen/destino, toggle Hoy/Todas difícil de revertir, feedback de errores disperso, ausencia de reintento inline, filtros redundantes o ambiguos, pérdida de filtros al navegar, modales sin manejo de foco ni Escape, controles táctiles pequeños, labels y foco accesible inconsistentes, exceso de densidad en tarjetas móviles y falta de primitives compartidas.

El trabajo se organizará por fases para reducir riesgo. Las fases no eliminan ningún área del alcance: cada flujo de Secretaría, Supervisión y Profesores tendrá una experiencia usable en móvil y computador desde su fase correspondiente. Esta especificación no solicita implementar código, cambiar contratos de API ni agregar un framework de pruebas.

### Prioridades

- **P0 — Fundacional:** bloquea pérdida de datos, navegación sin contexto, accesibilidad básica, responsive mínimo y estados sin salida.
- **P1 — Flujo principal:** mejora obligatoria y equivalente para Secretaría, Supervisión y Profesores en las tareas operativas diarias.
- **P2 — Consistencia y refinamiento:** reduce densidad, duplicación visual y esfuerzo cognitivo; se implementa después de que P0/P1 sean estables.

La igualdad de prioridad significa que ningún rol puede quedar relegado a una fase posterior que impida realizar sus tareas principales. Las diferencias de copy y capacidades por rol son intencionales, no diferencias de calidad.

## Goals and non-goals

### Goals

1. Permitir que una persona sepa siempre en qué módulo, rol, fecha, clase y contexto se encuentra.
2. Hacer seguros los cambios de asistencia, novedades y traslados, incluso con red inestable o respuestas parciales.
3. Mantener filtros, scroll y contexto útiles al navegar a detalle y volver.
4. Hacer todos los flujos operables con teclado, lector de pantalla y toque.
5. Proporcionar una experiencia coherente en anchos de 320 px, 375 px, 768 px y computador.
6. Consolidar primitives compartidas de navegación, estados, formularios, foco, botones, listas y modales.

### Non-goals

- No rediseñar el modelo de permisos ni conceder capacidades nuevas a un rol.
- No cambiar reglas de negocio, estados persistidos ni el contrato de API salvo lo estrictamente necesario para soportar estados de UI ya definidos.
- No reemplazar el login o proveedor de identidad existente.
- No convertir el dashboard en un sistema de analítica nuevo.
- No hacer una reescritura completa del frontend en una sola fase.

## Glossary

- **Secretary:** persona autenticada con capacidades de Secretaría; consulta asistencias, clases, horarios, novedades y traslados según permisos actuales.
- **Supervisor:** persona autenticada con capacidades de Supervisión; supervisa clases, consulta asistencias y gestiona los flujos habilitados actualmente.
- **Teacher:** persona autenticada con capacidades de Profesor; trabaja principalmente con sus clases, toma de asistencia y novedades.
- **Role_Context:** combinación visible de rol, nombre de la sección, ubicación actual, fecha, clase y acción disponible.
- **Primary_Heading:** único encabezado `h1` que identifica la vista actual.
- **Context_Header:** región que muestra Primary_Heading, ubicación y metadatos necesarios para continuar la tarea.
- **Breadcrumb_or_Back:** navegación contextual que permite volver al listado o flujo de origen conservando su estado.
- **Shared_Primitive:** componente o patrón reutilizable para navegación, botón, campo, modal, toast, estado de carga, error, vacío, reintento, tarjeta o lista.
- **Touch_Target:** control interactivo con área mínima de 44 por 44 píxeles CSS, incluyendo el área de toque y no solo el texto o icono.
- **Filter_Draft:** valores que la persona está editando antes de aplicar una consulta.
- **Applied_Filter_Set:** valores que efectivamente determinan el listado consultado.
- **View_Context:** filtros aplicados, página, orden, fecha, selección, scroll razonable y ruta de retorno necesarios para continuar una tarea.
- **Dirty_Attendance:** toma de asistencia con cambios locales no guardados.
- **Partial_Save:** operación de guardado en la que algunos registros se guardan y otros fallan o quedan pendientes.
- **Bulk_Action:** acción que modifica muchos registros, como marcar todos presentes, ausentes o limpiar marcas.
- **Inline_Retry:** acción de reintento ubicada junto al mensaje o área que falló, sin obligar a abandonar la vista.
- **Modal_Dialog:** superficie temporal que bloquea o concentra la interacción y requiere manejo explícito de foco y teclado.
- **Empty_State:** estado que explica que una consulta válida no tiene resultados y ofrece un siguiente paso.
- **Responsive_Baselines:** anchos de referencia de 320 px, 375 px, 768 px y computador de al menos 1024 px.
- **Role_Copy:** texto, título, acción y ayuda adaptados a la capacidad y vocabulario del rol actual.
- **Network_Failure:** timeout, pérdida de conectividad, error HTTP o respuesta inválida durante una operación.

## Requirements

### Requirement 1: Shell, contexto y navegación consistente [P0]

**User Story:** Como persona autenticada de cualquier rol, quiero saber dónde estoy y volver al punto anterior sin perder contexto, para no depender de recordar la ruta o rehacer la consulta.

#### Acceptance Criteria

1. WHEN una persona autenticada abre cualquier vista principal, THE application SHALL mostrar un único Primary_Heading descriptivo y un Context_Header con el módulo y la acción actual.
2. WHEN una vista está dentro de un flujo profundo, THE application SHALL mostrar Breadcrumb_or_Back hacia el origen lógico y SHALL indicar, cuando aplique, la clase, disciplina, grado, fecha o estudiante seleccionado.
3. WHEN una persona navega desde un listado a un detalle o sesión, THE application SHALL conservar un View_Context suficiente para volver al listado en la misma sección, con los filtros aplicados, página y selección de fecha que originaron la navegación.
4. WHEN una persona usa el botón Atrás del navegador, un gesto Atrás de Android o el botón Atrás del shell móvil, THE application SHALL volver al contexto anterior sin redirigir inesperadamente al login ni al inicio del rol.
5. WHEN una persona cambia de sección desde la navegación principal, THE application SHALL mostrar una sola opción activa y SHALL cerrar o colapsar la navegación móvil después de seleccionar una ruta.
6. WHEN una persona abre una ruta directamente o recarga una ruta profunda, THE application SHALL mostrar el contexto mínimo de esa ruta y SHALL ofrecer una salida clara al dashboard o listado permitido para su rol.
7. THE application SHALL use the same interaction pattern for desktop sidebar, mobile navigation launcher, back links, active route, loading route and unauthorized route in Secretary, Supervisor and Teacher flows.
8. THE application SHALL not render duplicate identity headers or duplicate page titles that compete with Primary_Heading.

### Requirement 2: Login y entrada al rol [P1]

**User Story:** Como Secretaría, Supervisión o Profesor, quiero iniciar sesión y entender el resultado, para entrar al espacio correcto sin confusión.

#### Acceptance Criteria

1. WHEN una persona abre el login en Android, iPhone o computador, THE application SHALL mostrar una acción principal claramente identificada y SHALL mantenerla visible dentro del viewport sin desplazamiento horizontal.
2. WHEN el login está en progreso, THE application SHALL deshabilitar solo las acciones que podrían duplicar la solicitud, mostrar un indicador de progreso y mantener el mensaje accesible para tecnologías de asistencia.
3. IF el login falla por credenciales, permisos, red o servidor, THEN THE application SHALL mostrar un mensaje específico y accionable junto al formulario, SHALL conservar los valores no sensibles y SHALL ofrecer Inline_Retry sin obligar a recargar toda la página.
4. IF el login falla por una sesión expirada o rol no autorizado, THEN THE application SHALL explicar el siguiente paso y SHALL evitar bucles de redirección.
5. WHEN el login es exitoso, THE application SHALL dirigir a la vista inicial correspondiente al rol y SHALL cargar el Role_Context antes de presentar acciones operativas.
6. THE application SHALL provide labels programáticos, foco visible y orden de tabulación lógico para todos los controles del login.
7. THE application SHALL not expose mensajes técnicos, tokens, credenciales ni datos de otro rol en la pantalla de login.

### Requirement 3: Dashboard accionable y adaptado por rol [P1]

**User Story:** Como persona de Secretaría, Supervisión o Profesor, quiero que el dashboard me muestre qué puedo hacer ahora, para comenzar la tarea diaria con el menor número de pasos.

#### Acceptance Criteria

1. WHEN un rol abre su dashboard, THE application SHALL mostrar un Primary_Heading único, una breve descripción adaptada al rol y acciones principales ordenadas por frecuencia de uso.
2. WHEN una persona de Secretaría abre el dashboard, THE Role_Copy SHALL priorizar consulta de asistencias, clases, horarios, novedades y traslados según sus permisos.
3. WHEN una persona de Supervisión abre el dashboard, THE Role_Copy SHALL priorizar supervisar clases, revisar asistencias, novedades y traslados según sus permisos.
4. WHEN un Profesor abre el dashboard, THE Role_Copy SHALL priorizar sus clases, llamar lista, registrar asistencia y reportar novedades.
5. WHEN una tarjeta o acceso rápido tiene navegación, THE application SHALL hacer accionable toda el área del control, SHALL indicar el destino con texto y SHALL conservar el View_Context cuando proviene de una consulta.
6. IF un resumen del dashboard falla, THEN THE application SHALL mostrar el resto de la página, identificar el bloque fallido y ofrecer Inline_Retry para ese bloque.
7. WHEN un resumen está cargando, THE application SHALL mostrar un placeholder o estado de carga localizado sin bloquear módulos que ya estén disponibles.
8. WHEN un rol no tiene datos para un resumen, THE application SHALL mostrar Empty_State con explicación y acción siguiente apropiada, no una tarjeta vacía o un error genérico.

### Requirement 4: Primitives compartidas y estados de interfaz [P0]

**User Story:** Como persona usuaria, quiero que los controles se comporten igual en todo el aplicativo, para aprender un patrón una vez y reutilizarlo en cualquier flujo.

#### Acceptance Criteria

1. THE application SHALL define y reutilizar Shared_Primitive para navegación, Primary_Heading, botón primario/secundario/peligroso, campo etiquetado, selector, lista responsive, avatar, modal, toast, carga, error, vacío y Inline_Retry.
2. WHEN un Shared_Primitive recibe foco, THE application SHALL mostrar un indicador de foco visible con contraste suficiente y SHALL not depender únicamente del cambio de color.
3. WHEN una operación está cargando, THE application SHALL comunicar qué área está cargando, impedir duplicaciones de la misma acción y mantener visibles los datos ya confirmados cuando sea seguro hacerlo.
4. IF una operación falla, THEN el estado de error SHALL explicar qué ocurrió en lenguaje de usuario, indicar si los datos anteriores siguen disponibles y mostrar Inline_Retry cuando la operación sea repetible.
5. WHEN no hay resultados, THE Empty_State SHALL diferenciar entre consulta sin coincidencias, catálogo vacío, falta de permisos y datos aún no cargados.
6. WHEN una acción tiene éxito, THE application SHALL mostrar feedback visible y accesible, indicar el objeto afectado y no ocultar el resultado antes de que pueda percibirse.
7. THE application SHALL avoid using a toast como único canal para errores críticos, pérdida de cambios, permisos o guardados parciales.
8. THE application SHALL use consistent wording for loading, retry, cancel, save, discard, back, clear and success across all three roles, with Role_Copy where the capability differs.

### Requirement 5: Dashboard de asistencias, filtros y consulta [P1]

**User Story:** Como Secretaría o Supervisión, quiero consultar asistencias con filtros claros; como Profesor, quiero encontrar rápidamente mis sesiones, para no revisar datos irrelevantes.

#### Acceptance Criteria

1. WHEN una persona abre la consulta de asistencias, THE application SHALL mostrar fecha, disciplina, profesor y grado solo cuando sean filtros permitidos para el rol, con labels que expliquen el alcance de cada filtro.
2. WHEN existe una fecha por defecto, THE application SHALL indicar de forma explícita si representa hoy en la zona horaria del aplicativo y SHALL permitir distinguir fecha aplicada de fecha en edición.
3. WHEN una persona edita Filter_Draft y pulsa aplicar, THE application SHALL actualizar el listado, paginación, conteo y exportación con el mismo Applied_Filter_Set.
4. WHEN una persona modifica filtros sin aplicarlos, THE application SHALL indicar que existen cambios pendientes en el Filter_Draft y SHALL not mezclar esos valores con los resultados vigentes.
5. WHEN una persona pulsa limpiar, THE application SHALL restablecer todos los filtros permitidos, volver a la primera página y comunicar el nuevo alcance del listado.
6. WHEN se combinan filtros, THE application SHALL aplicar una lógica AND consistente y SHALL mostrar un resumen legible de los filtros activos, sin duplicar controles equivalentes.
7. WHEN un filtro activo se muestra como chip, THE chip SHALL indicar el nombre y valor del filtro, SHALL tener Touch_Target y SHALL poder eliminarse sin borrar los demás filtros.
8. WHEN una persona navega a una sesión y vuelve, THE application SHALL conservar Applied_Filter_Set, página y criterio de consulta, salvo que la persona elija explícitamente limpiar o cambiar filtros.
9. WHEN una persona aplica un filtro que no produce resultados, THE application SHALL mostrar Empty_State con filtros activos y acciones para limpiar o modificar la consulta.
10. IF falla el catálogo de filtros, THEN THE application SHALL mantener la estructura de la vista, marcar qué filtros no están disponibles y ofrecer Inline_Retry para el catálogo.
11. IF falla la consulta de asistencias, THEN THE application SHALL conservar los filtros, mostrar el error en el área del listado y ofrecer Inline_Retry sin borrar resultados confirmados de una consulta anterior.
12. WHEN una persona cambia rápidamente filtros o páginas, THE application SHALL ignore responses obsoletas para que una consulta anterior no reemplace la vigente.
13. WHEN una persona exporta una consulta, THE application SHALL indicar que la exportación usa el Applied_Filter_Set vigente y SHALL mostrar progreso, éxito o error con reintento.

### Requirement 6: Toma de asistencia robusta y segura [P0]

**User Story:** Como Profesor, y como Supervisor cuando tenga capacidad de llamar lista, quiero registrar asistencia sin perder cambios ante errores o navegación accidental.

#### Acceptance Criteria

1. WHEN una persona abre una sesión de toma de asistencia, THE application SHALL mostrar la clase, fecha, horario, profesor o responsable, cantidad total y estado de cada estudiante en un encabezado contextual único.
2. WHEN una persona marca un estudiante, THE application SHALL actualizar inmediatamente el estado visual, exponer el cambio de forma accesible y mostrar el conteo actualizado sin ocultar la identidad del estudiante.
3. WHEN una persona ejecuta un Bulk_Action, THE application SHALL mostrar una confirmación que explique cuántos registros serán afectados, qué estado se aplicará y si reemplazará marcas existentes.
4. WHEN una Bulk_Action se confirma, THE application SHALL permitir deshacerla mientras los cambios sigan sin guardar o SHALL ofrecer una acción equivalente para revertirla antes del guardado.
5. WHEN Dirty_Attendance existe y la persona intenta volver, cerrar, cambiar de sesión, navegar a otra sección o recargar, THE application SHALL advertir que hay cambios sin guardar y ofrecer continuar guardando, descartar o cancelar la salida.
6. WHEN se inicia el guardado, THE application SHALL conservar el estado local, impedir doble envío y mostrar qué operación está en progreso.
7. IF ocurre un Partial_Save, THEN THE application SHALL distinguir registros guardados, fallidos y pendientes, conservar localmente los cambios no confirmados y ofrecer reintentar solo los fallidos o pendientes.
8. IF ocurre un Network_Failure durante el guardado, THEN THE application SHALL not declarar éxito completo, SHALL conservar Dirty_Attendance y SHALL mostrar Inline_Retry sin borrar las marcas locales.
9. WHEN se reintenta un guardado, THE application SHALL avoid duplicar registros ya confirmados y SHALL actualizar el conteo de guardados y pendientes.
10. WHEN todo el guardado termina correctamente, THE application SHALL confirmar el resultado, limpiar Dirty_Attendance y ofrecer volver al origen conservando su View_Context.
11. WHEN una sesión no tiene estudiantes, THE application SHALL mostrar Empty_State explicando si la lista está vacía, pendiente de carga o no disponible por permisos.
12. WHEN se cargan novedades o traslados relacionados con estudiantes, THE application SHALL mostrar su estado de carga o error en el bloque correspondiente sin impedir revisar o guardar la asistencia disponible.
13. THE application SHALL provide Touch_Target para marcar presente, ausente, justificado o pendiente, y SHALL not require precisión sobre una letra o icono pequeño.
14. THE application SHALL provide an alternative textual interaction to any color-only attendance state and SHALL expose the selected state to assistive technology.

### Requirement 7: Clases, modo Hoy/Todas y selección de sesión [P1]

**User Story:** Como Secretaría, Supervisión o Profesor, quiero distinguir mis clases, las clases de hoy y sus estudiantes, para iniciar la tarea correcta sin ambigüedad.

#### Acceptance Criteria

1. WHEN una persona abre Clases, THE application SHALL mostrar claramente si está viendo Hoy, Todas u otro alcance permitido, con un control segmentado o equivalente que indique el estado activo.
2. WHEN una persona cambia de Hoy a Todas y luego vuelve a Hoy, THE application SHALL permitir revertir la decisión en una acción visible y SHALL actualizar el contenido y el conteo del alcance seleccionado.
3. WHEN el modo seleccionado no coincide con la fecha actual, THE application SHALL mostrar una explicación de la fecha o día utilizado, especialmente en móvil.
4. WHEN una clase se muestra, THE application SHALL identificar disciplina, grado, día, hora, aula cuando exista, profesor y capacidad disponible para el rol.
5. WHEN una persona selecciona una clase, THE application SHALL indicar si abrirá estudiantes, historial, sesión o llamada de lista antes de ejecutar una acción ambigua.
6. WHEN una persona inicia una llamada de lista, THE application SHALL mostrar la clase y horario que se iniciarán, prevenir doble inicio y ofrecer feedback de progreso, éxito o error.
7. IF falla la carga de clases, THEN THE application SHALL mostrar Inline_Retry conservando el modo Hoy/Todas y cualquier filtro local.
8. WHEN no hay clases para el alcance elegido, THE application SHALL mostrar Empty_State específico: sin clases hoy, sin clases asignadas o sin resultados para el filtro.
9. WHEN una lista de clases tiene muchos elementos, THE application SHALL priorizar información esencial y evitar tarjetas móviles con densidad que obligue a leer bloques repetidos.
10. THE application SHALL use Role_Copy: "Mis clases" o "Llamar lista" para Profesor cuando corresponda, "Clases" o "Supervisar" para Supervisión y "Clases" o "Consultar" para Secretaría.

### Requirement 8: Horarios y consulta por fecha [P1]

**User Story:** Como Secretaría, Supervisión o Profesor, quiero entender mis horarios por día y clase, para planear o abrir la sesión correcta.

#### Acceptance Criteria

1. WHEN una persona abre Horarios, THE application SHALL mostrar día, fecha o selector de fecha, hora, disciplina, grado, profesor y aula cuando estén disponibles, sin repetir un encabezado de identidad ya mostrado por el shell.
2. WHEN una persona filtra por profesor, grado o fecha, THE application SHALL mostrar un resumen de filtros activos y SHALL permitir limpiarlos en una sola acción.
3. WHEN una fecha se selecciona, THE application SHALL derivar y mostrar el día correspondiente de manera consistente con la zona horaria del aplicativo.
4. WHEN una persona abre el historial o detalle de una asignación, THE application SHALL conservar el contexto de filtros y ofrecer retorno al listado de horarios.
5. IF falla la carga de horarios o historial, THEN THE application SHALL mostrar el error junto al área afectada y ofrecer Inline_Retry.
6. WHEN no hay horarios para una fecha o filtro, THE application SHALL mostrar Empty_State con una acción para elegir otra fecha o limpiar filtros.
7. THE application SHALL render horarios en una estructura legible en 320 px y 375 px sin scroll horizontal involuntario.

### Requirement 9: Novedades y comunicación de estado [P1]

**User Story:** Como Profesor, Secretaría o Supervisión, quiero registrar y revisar novedades con contexto y confirmación, para comunicar ausencias o situaciones sin perder la información.

#### Acceptance Criteria

1. WHEN una persona abre Novedades, THE application SHALL indicar el estudiante, fecha, clase o sesión y rol que registra o consulta la novedad.
2. WHEN una persona crea o edita una novedad, THE application SHALL mostrar labels programáticos para descripción, acompañante, regreso y hora estimada cuando apliquen.
3. WHEN un campo obligatorio está vacío o tiene formato inválido, THE application SHALL mostrar el error junto al campo, conservar los demás valores y mover el foco al primer error sin perder el contexto.
4. WHEN una persona intenta salir con una novedad no guardada, THE application SHALL advertir sobre cambios pendientes y ofrecer guardar, descartar o cancelar.
5. WHEN se guarda una novedad, THE application SHALL mostrar progreso, impedir doble envío y confirmar el estudiante y fecha afectados.
6. IF falla el guardado o la carga de novedades, THEN THE application SHALL conservar los valores locales seguros y ofrecer Inline_Retry.
7. WHEN no existen novedades, THE application SHALL mostrar Empty_State que diferencie "no hay novedades para esta fecha" de "no se pudo cargar".
8. WHEN una novedad aparece dentro de asistencia, clases o detalle, THE application SHALL enlazarla al estudiante y fecha correctos y SHALL avoid duplicar el mismo bloque informativo sin necesidad.
9. THE application SHALL adapt Role_Copy: Profesor registra o reporta; Supervisión revisa, valida o gestiona según permiso; Secretaría consulta o registra solo si su capacidad actual lo permite.

### Requirement 10: Traslados claros y validados [P1]

**User Story:** Como Secretaría o Supervisión, quiero registrar y consultar traslados con origen, destino y duración inequívocos, para evitar mover estudiantes a una clase incorrecta.

#### Acceptance Criteria

1. WHEN una persona abre Traslados, THE application SHALL explicar en lenguaje simple qué significa un traslado y SHALL distinguir registrar traslado de consultar historial.
2. WHEN Secretaría visualiza Traslados, THE Role_Copy SHALL explicar sus acciones permitidas sin mostrar botones de gestión que no pueda ejecutar.
3. WHEN una persona selecciona fecha inicial, THE application SHALL mostrar el día de la semana y SHALL limitar o filtrar las clases disponibles a ese día cuando la regla de negocio lo requiera.
4. WHEN se elige duración "solo hoy" o "por un tiempo", THE application SHALL mostrar cuál está activa, hacer evidente cómo revertirla y habilitar fecha final solo cuando corresponda.
5. WHEN se selecciona fecha final, THE application SHALL impedir una fecha anterior a la inicial y SHALL mostrar el rango completo que será afectado.
6. WHEN se selecciona origen, THE application SHALL excluirlo de destino, mostrar disciplina, grado, horario y profesor en ambas opciones, y SHALL resetear destino si la fecha u origen cambia.
7. WHEN se selecciona destino, THE application SHALL confirmar visualmente el par origen → destino antes de registrar.
8. WHEN se busca un estudiante, THE application SHALL mostrar código, nombre, apellido y grupo cuando exista, SHALL distinguir estudiante seleccionado de resultados y SHALL allow quitarlo o cambiarlo.
9. WHEN falta estudiante, fecha, origen, destino, motivo obligatorio o el rango es inválido, THE application SHALL bloquear el registro y mostrar el error junto al dato faltante.
10. WHEN el origen y destino son la misma clase o no comparten una combinación válida de fecha/horario, THE application SHALL impedir el registro y explicar por qué.
11. WHEN una persona registra un traslado, THE application SHALL mostrar una confirmación con estudiante, fecha/rango, origen, destino y motivo antes de persistirlo.
12. IF falla el registro o eliminación de un traslado, THEN THE application SHALL conservar el formulario o filtros, mostrar el error en el área de la acción y ofrecer Inline_Retry cuando sea seguro.
13. WHEN se elimina un traslado, THE application SHALL requerir confirmación explícita, identificar el estudiante y rango afectado y SHALL not eliminarlo por un toque accidental.
14. WHEN se consulta el historial, THE application SHALL soportar filtro por estudiante y fecha sin mezclar filtros de creación con filtros de consulta.
15. WHEN no hay clases compatibles o historial, THE application SHALL mostrar Empty_State con el motivo probable y el siguiente paso.

### Requirement 11: Detalle, estudiantes y regreso al origen [P1]

**User Story:** Como persona de cualquier rol, quiero abrir un detalle y volver al contexto correcto, para revisar información sin perder el trabajo de la lista.

#### Acceptance Criteria

1. WHEN una persona abre el detalle de un estudiante, disciplina, profesor, clase, asignación o sesión, THE application SHALL mostrar un Primary_Heading único y metadatos esenciales antes de las acciones secundarias.
2. WHEN el detalle se abre desde una lista filtrada, THE application SHALL conservar la referencia al origen y SHALL show Breadcrumb_or_Back con el nombre del listado.
3. WHEN se vuelve desde el detalle, THE application SHALL restaurar Applied_Filter_Set, página y selección de fecha del listado cuando el contexto siga vigente.
4. WHEN el detalle está cargando, THE application SHALL mostrar skeleton o indicador localizado y SHALL not presentar campos vacíos como si fueran datos reales.
5. IF falla el detalle, THEN THE application SHALL mostrar mensaje específico, Inline_Retry y salida al origen; SHALL not leave a blank screen.
6. WHEN no existe el recurso o la persona no tiene permiso, THE application SHALL diferenciar no encontrado de no autorizado y SHALL offer an allowed destination.
7. WHEN el detalle incluye acciones destructivas o cambios, THE application SHALL aplicar la prevención de pérdida de datos y confirmación definida en los flujos correspondientes.

### Requirement 12: Modales, confirmaciones y foco [P0]

**User Story:** Como persona que usa teclado, lector de pantalla o toque, quiero que los diálogos sean controlables, para no quedar atrapada ni perder el punto de interacción.

#### Acceptance Criteria

1. WHEN se abre un Modal_Dialog, THE application SHALL mover el foco al título, primer control accionable o acción explícitamente definida.
2. WHILE un Modal_Dialog está abierto, THE application SHALL mantener el foco dentro del diálogo al usar Tab y Shift+Tab, y SHALL prevent interaction accidental con el contenido subyacente.
3. WHEN una persona pulsa Escape o activa cerrar, THE application SHALL cerrar el diálogo si la operación no es obligatoria y SHALL devolver el foco al control que lo abrió.
4. WHEN un diálogo contiene cambios o acción destructiva, THE application SHALL not cerrarse silenciosamente con Escape o clic fuera; SHALL request confirmation or clearly preserve the draft.
5. THE application SHALL provide `role`, accessible name, description when needed and `aria-modal` semantics for every Modal_Dialog.
6. WHEN un diálogo se usa en 320 px o 375 px, THE application SHALL remain usable without controls fuera del viewport ni scroll horizontal.

### Requirement 13: Responsive y ergonomía táctil [P0]

**User Story:** Como persona que usa Android, iPhone o computador, quiero que el aplicativo se adapte a mi pantalla y forma de interacción, para completar tareas sin zoom, precisión excesiva ni desplazamiento horizontal.

#### Acceptance Criteria

1. THE application SHALL support Responsive_Baselines of 320 px, 375 px, 768 px and computador de al menos 1024 px sin solapamiento, texto cortado que oculte información esencial ni scroll horizontal involuntario.
2. WHEN el viewport es 320 px o 375 px, THE application SHALL priorizar una columna, apilar formularios, compactar navegación y convertir tablas o tarjetas densas en listas legibles.
3. WHEN el viewport es 768 px, THE application SHALL usar el espacio disponible para separar filtros y contenido sin forzar una versión de escritorio ilegible.
4. WHEN el viewport es de computador, THE application SHALL aprovechar columnas y sidebar sin hacer que el contenido principal quede excesivamente ancho o pierda la jerarquía.
5. THE application SHALL give every interactive control, checkbox, radio, tab, chip, close button, attendance status and pagination action a Touch_Target of at least 44 by 44 CSS pixels.
6. THE application SHALL provide suficiente separación entre controles táctiles para reducir activaciones accidentales y SHALL not rely on hover to expose essential actions.
7. WHEN un teclado virtual de Android o iPhone aparece, THE application SHALL mantener visible el campo activo y la acción relevante sin bloquear el botón de guardar o continuar.
8. THE application SHALL respect safe-area insets on devices with notches or home indicators, especialmente en navegación y acciones fijas.
9. THE application SHALL support orientación vertical como caso principal y SHALL remain usable in horizontal orientation where the device provides it.
10. THE application SHALL not require pinch zoom to read or activate any primary flow and SHALL preserve user zoom settings.
11. WHEN una lista es extensa, THE application SHALL mantener encabezados y acciones esenciales accesibles sin crear una tarjeta móvil con más información repetida de la necesaria.

### Requirement 14: Accesibilidad operativa [P0]

**User Story:** Como persona con teclado, lector de pantalla, baja visión o limitación motora, quiero completar los mismos flujos principales, para que el aplicativo no dependa de color, hover o precisión táctil.

#### Acceptance Criteria

1. THE application SHALL provide a programmatic label or accessible name for every input, select, checkbox, radio, button, link, tab and icon-only control.
2. THE application SHALL preserve a logical reading order and keyboard order matching the visual task order in login, dashboard, filters, attendance, classes, schedules, novedades and transfers.
3. THE application SHALL show a visible focus indicator with sufficient contrast on light and dark themes.
4. WHEN validation, loading, success, partial failure or empty states change, THE application SHALL expose the relevant message through an appropriate live region without interrupting unrelated reading.
5. THE application SHALL not communicate required, selected, error, present, absent or disabled states by color alone.
6. THE application SHALL associate each validation error with its field and SHALL provide a summary or focus behavior for multi-field forms.
7. THE application SHALL keep headings hierarchical, use landmarks for navigation/main/content, and SHALL avoid duplicate Primary_Heading.
8. THE application SHALL make links distinguishable from surrounding text and SHALL not use an icon as the only indication of navigation direction.
9. THE application SHALL support keyboard operation of filters, pagination, tabs, confirmation dialogs, attendance controls, bulk actions and retry actions.
10. THE application SHALL announce changes to a list or session without moving focus unexpectedly unless the user triggered a navigation or validation correction.

### Requirement 15: Feedback, errores y recuperación [P0]

**User Story:** Como persona que realiza una tarea diaria, quiero saber si una operación está cargando, falló, quedó parcial o terminó, para decidir el siguiente paso sin adivinar.

#### Acceptance Criteria

1. THE application SHALL model at least the states loading, success, empty, error, retrying, partial success and unsaved changes wherever the underlying operation can produce them.
2. IF una carga inicial falla, THEN THE application SHALL show an error state with Inline_Retry and an allowed navigation path; SHALL not display an indefinitely spinning indicator.
3. IF una acción repetible falla, THEN Inline_Retry SHALL be scoped to that action or block and SHALL preserve safe user input and confirmed data.
4. IF una acción no puede reintentarse sin riesgo de duplicación, THEN THE application SHALL explain the state and offer a safe refresh or reconciliation action instead of a blind retry.
5. WHEN hay una operación en progreso, THE application SHALL prevent double submission and SHALL keep the user informed of the affected object.
6. WHEN una respuesta tarda, THE application SHALL preserve the shell, context and cancel/back affordance where cancelación sea segura.
7. WHEN ocurre un error de permisos, THE application SHALL explain that the action is not available and SHALL hide or disable only the forbidden action, preserving allowed navigation.
8. THE application SHALL use Spanish user-facing copy, avoid raw HTTP/status/stack messages and state what the person can do next.
9. THE application SHALL provide feedback within the local area first and use a global toast only as complementary confirmation.
10. THE application SHALL not clear a form, filter or local attendance change until the server confirms the operation or the person explicitly discards it.

### Requirement 16: Persistencia de contexto y prevención de pérdida [P0]

**User Story:** Como persona que realiza una consulta o edición, quiero que el sistema preserve mi trabajo de forma predecible, para no repetir pasos ni perder cambios.

#### Acceptance Criteria

1. WHEN una persona navega de listado a detalle y regresa, THE application SHALL restore the View_Context relevant to that list.
2. WHEN una persona abre una vista permitida en una nueva pestaña o recarga una consulta, THE application SHALL preserve o reconstruir filtros serializables y fecha sin exponer información sensible en lugares no permitidos.
3. WHEN un filtro o selección se conserva entre rutas, THE application SHALL mostrarlo de forma visible para evitar que una persona crea que está viendo todos los datos.
4. WHEN Dirty_Attendance o un formulario no guardado existe, THE application SHALL protect it on route navigation, browser refresh and mobile back gesture to the extent supported by the platform.
5. WHEN una persona elige descartar, THE application SHALL clear only the pending local changes after confirmation and SHALL preserve server-confirmed data.
6. WHEN una sesión expira durante una consulta o edición, THE application SHALL preserve local safe state where possible, explain the need to authenticate and SHALL not present the operation as saved.
7. THE application SHALL avoid persisting passwords, tokens, sensitive student details or attendance drafts in an unprotected mechanism solely for convenience.
8. WHEN la persona vuelve al mismo flujo durante la misma sesión, THE application SHALL use consistent restoration rules rather than restoring some filters silently and discarding others.

### Requirement 17: Copy, idioma y adaptación por rol [P1]

**User Story:** Como persona de cualquier rol, quiero que el texto describa mi responsabilidad real, para entender qué hará cada acción.

#### Acceptance Criteria

1. THE application SHALL use Spanish claro, directo y consistente en labels, botones, estados, confirmaciones, errores y ayudas.
2. WHEN una acción es equivalente en distintos roles, THE application SHALL preserve its meaning while adapting Role_Copy only where the permission or responsibility changes.
3. THE application SHALL distinguish "consultar", "supervisar", "llamar lista", "registrar", "guardar", "exportar", "trasladar" and "eliminar" instead of using a generic "Continuar" for consequential actions.
4. WHEN una acción masiva o destructiva aparece, THE confirmation SHALL name the affected object, quantity, date and consequence in user language.
5. THE application SHALL not expose internal identifiers, route names or implementation terms as primary copy unless they are useful to the person, such as a student code.
6. WHEN content is shortened for mobile, THE application SHALL preserve the distinction between essential entities and SHALL provide access to the full value without relying on hover.
7. THE application SHALL review copy for Secretaría, Supervisión and Profesores separately so that hidden permissions are not implied by a visible label.

### Requirement 18: Calidad responsive y verificación por flujo [P2]

**User Story:** Como responsable del producto, quiero verificar la mejora por rol, dispositivo y estado, para evitar que una corrección visual rompa otro flujo.

#### Acceptance Criteria

1. THE implementation plan SHALL define a verification matrix with roles Secretary, Supervisor and Teacher; devices Android, iPhone and computer; Responsive_Baselines 320, 375, 768 and 1024+; and states loading, success, empty, error, retry, partial save and unsaved changes where applicable.
2. THE verification matrix SHALL include login, dashboard, attendance filters, attendance capture, classes, schedules, novedades, transfers, detail and navigation for every role that has access to each flow.
3. WHEN a Shared_Primitive changes, THE verification SHALL include at least one consumer from each of Secretary, Supervisor and Teacher where the primitive is used.
4. THE implementation SHALL validate keyboard navigation, visible focus, Escape in dialogs, browser back, Android back and mobile viewport behavior before considering P0 complete.
5. THE implementation SHALL validate that no primary flow requires horizontal scrolling at 320 px or 375 px and that every primary Touch_Target meets the minimum size.
6. THE implementation SHALL validate partial save and network recovery using a controlled failure without deleting confirmed or local pending attendance changes.
7. THE implementation SHALL validate context restoration after entering and leaving at least one detail view from each role.
8. THE implementation SHALL document any platform limitation that cannot be made equivalent on Android, iPhone or computer and provide an accessible alternative.

## Non-functional requirements

### NFR-1: Responsive correctness [P0]

1. THE application SHALL render the primary role flows without horizontal overflow or clipped primary actions at 320 px, 375 px, 768 px and 1024 px or wider.
2. THE application SHALL maintain usable line length, hierarchy and spacing when browser text size or system text size is increased, without hiding primary information or actions.
3. THE application SHALL handle dynamic content lengths for names, disciplines, groups, error messages and translated date labels without overlap.

### NFR-2: Accessibility [P0]

1. THE application SHALL target conformance with WCAG 2.2 AA for the changed interface, including keyboard access, focus visibility, labels, name/role/value, reflow and non-color state communication.
2. THE application SHALL preserve user zoom and SHALL not use fixed overlays that prevent access to content at increased text or display size.
3. THE application SHALL test with keyboard-only navigation and at least one screen reader on a desktop environment plus platform accessibility services on Android or iPhone for the primary flows.

### NFR-3: Robustness and data integrity [P0]

1. THE application SHALL never report a mutation as fully successful when the server has confirmed only a subset of records.
2. THE application SHALL be idempotent from the user's perspective when a retry follows an unknown network outcome, reconciling confirmed records before applying remaining changes.
3. THE application SHALL preserve server-confirmed data and safe local drafts across recoverable UI or network failures.
4. THE application SHALL avoid race conditions in filter, pagination, catalog, detail and save requests that could display stale data as current.

### NFR-4: Performance and perceived responsiveness [P1]

1. THE application SHALL render the shell, heading and primary recovery/navigation action before waiting for secondary data.
2. THE application SHALL use localized loading placeholders or indicators and SHALL not block unrelated regions while a single widget loads.
3. THE application SHALL keep touch interactions responsive and SHALL provide immediate visual state feedback before a network round trip completes when the operation is safely optimistic.
4. THE application SHALL not add redundant requests solely because a person navigates between list and detail with preserved context.

### NFR-5: Consistency and maintainability [P1]

1. THE changed flows SHALL use Shared_Primitive rather than near-duplicate implementations for loading, errors, retry, buttons, inputs, pagination, dialogs, navigation and status messaging.
2. THE application SHALL keep visual tokens for spacing, color, radius, typography, focus and Touch_Target behavior centralized enough to prevent role-specific drift.
3. THE implementation SHALL preserve existing role permissions and API response semantics unless a requirement explicitly identifies a necessary compatibility change.
4. THE implementation SHALL keep role-specific copy and capabilities declarative rather than duplicating entire page structures for each role where behavior is equivalent.

### NFR-6: Privacy and security of UI state [P0]

1. THE application SHALL not place passwords, access tokens or unnecessary sensitive student/attendance data in URLs, logs, toasts or error messages.
2. THE application SHALL clear or protect local drafts when the session ends or the user logs out, while warning about unsaved changes before clearing them where feasible.
3. THE application SHALL honor server authorization even if a hidden or disabled UI control is bypassed.

## Implementation phases

### Phase 0 — Foundation, safety and navigation [P0]

Cubre Requirements 1, 4, 12, 13, 14, 15 y 16. Crear o consolidar Shared_Primitives; resolver Primary_Heading, Context_Header, navegación profunda, retorno, foco de modales, Escape, Touch_Target, labels, estados de carga/error/vacío/reintento y protección de cambios pendientes. Debe validarse en los tres roles y en 320/375/768/1024+ antes de continuar.

### Phase 1 — Entrada y tareas diarias por rol [P1]

Cubre Requirements 2, 3 y 17. Mejorar login, dashboards y Role_Copy para Secretaría, Supervisión y Profesores con la misma calidad, sin cambiar permisos. Incluir estados parciales de dashboard y recuperación inline.

### Phase 2 — Asistencias, clases y horarios [P0/P1]

Cubre Requirements 5, 6, 7 y 8. Resolver filtros y persistencia, toma de asistencia con confirmación de Bulk_Action, Dirty_Attendance, Partial_Save, reintento seguro, modo Hoy/Todas reversible, consulta de clases y horarios responsive. Validar tanto flujo de Profesor como capacidades equivalentes de Secretaría y Supervisión.

### Phase 3 — Novedades, traslados y detalle [P1]

Cubre Requirements 9, 10 y 11. Resolver formularios, validaciones de fecha/origen/destino, copy para Secretaría y Supervisión, confirmaciones, filtros de historial, detalle y retorno contextual. Mantener protección contra pérdida de novedades y traslados no guardados.

### Phase 4 — Verificación transversal y refinamiento [P2]

Cubre Requirement 18 y NFR-1 a NFR-6. Reducir densidad de tarjetas, eliminar encabezados o controles duplicados restantes, auditar consistencia visual y completar la matriz de verificación por rol, dispositivo, ancho y estado. Las correcciones P0/P1 encontradas en esta fase regresan a la fase que corresponda; no se consideran refinamiento opcional.

## Definition of Done

1. Los tres roles prioritarios pueden completar sus tareas permitidas en Android, iPhone y computador sin perder contexto ni cambios.
2. Los anchos 320 px, 375 px, 768 px y 1024 px o superior no presentan scroll horizontal involuntario ni ocultan acciones primarias.
3. Todos los controles primarios cumplen Touch_Target mínimo de 44 por 44 CSS px y tienen label/nombre accesible, foco visible y orden lógico.
4. Cada flujo relevante tiene estados verificables de carga, éxito, vacío, error y Inline_Retry; la toma de asistencia además tiene guardado parcial y cambios pendientes.
5. Las acciones masivas, destructivas y salidas con cambios pendientes tienen confirmación o protección explícita.
6. Los filtros y el contexto se conservan al navegar al detalle y regresar, y las respuestas obsoletas no reemplazan la consulta vigente.
7. Los modales manejan foco, Tab/Shift+Tab, Escape, cierre seguro y restauración de foco.
8. El copy diferencia correctamente Secretaría, Supervisión y Profesores sin prometer capacidades que el rol no tiene.
9. Los cambios usan primitives compartidas y no introducen una implementación paralela por rol para comportamientos equivalentes.
10. La matriz de verificación de Requirement 18 está completada y cualquier limitación de plataforma tiene una alternativa accesible documentada.
