# Requirements Document

## Introduction

Esta especificación define una primera versión de filtrado amplio para la vista de asistencias de Secretaría. La primera versión cubre exactamente cuatro criterios: fecha, grado, disciplina y profesor. Los criterios pueden utilizarse por separado o combinarse. El conjunto de filtros seleccionado debe producir el mismo alcance de datos en el listado de sesiones, la paginación y la exportación global de asistencias.

El alcance no incluye un filtro por estado individual de asistencia (presente, ausente o justificado). El filtro visual por estado dentro del detalle de una sesión existente permanece fuera de este cambio.

## Glossary

- **Secretary_Attendance_View**: Vista autenticada que permite a Secretaría consultar sesiones de asistencia registradas.
- **Supervisor_Attendance_View**: Vista autenticada que permite a Supervisión consultar y gestionar sesiones de asistencia según las capacidades actuales de Supervisión.
- **Attendance_Session**: Registro de asistencia correspondiente a una clase, una fecha, una disciplina, un grado y un profesor.
- **Session_List**: Conjunto paginado de Attendance_Session mostrado en la vista de consulta.
- **Date_Filter**: Control que representa una fecha calendario concreta en formato ISO `YYYY-MM-DD`.
- **Grade_Filter**: Control que permite seleccionar un grado activo del catálogo disponible para Secretaría.
- **Discipline_Filter**: Control que permite seleccionar una disciplina disponible para Secretaría.
- **Teacher_Filter**: Control que permite seleccionar un profesor activo disponible para Secretaría.
- **Active_Filter_Set**: Conjunto de valores no vacíos seleccionados en Date_Filter, Grade_Filter, Discipline_Filter y Teacher_Filter.
- **Filter_Catalog**: Catálogo de grados, disciplinas y profesores disponibles para poblar los controles de filtrado.
- **Pagination**: Información y controles de página que representan el total de resultados, la página actual y el total de páginas de un Session_List.
- **Global_Attendance_Export**: Archivo de asistencias que contiene todas las Attendance_Session que coinciden con un Active_Filter_Set, sin limitarse a la página visible.
- **Session_Detail**: Vista existente que muestra los metadatos y los registros individuales de una Attendance_Session seleccionada.
- **Empty_State**: Mensaje visible que informa que no existen Attendance_Session para el Active_Filter_Set actual.

## Requirements

### Requirement 1: Mostrar los cuatro filtros disponibles

**User Story:** Como integrante de Secretaría, quiero disponer de filtros de fecha, grado, disciplina y profesor, para localizar sesiones de asistencia con distintos criterios.

#### Acceptance Criteria

1. WHEN una persona autenticada de Secretaría abre la Secretary_Attendance_View, THE Secretary_Attendance_View SHALL mostrar un Date_Filter, un Grade_Filter, un Discipline_Filter y un Teacher_Filter.
2. WHEN la Secretary_Attendance_View recibe el Filter_Catalog, THE Secretary_Attendance_View SHALL mostrar cada grado activo como una opción seleccionable del Grade_Filter.
3. WHEN la Secretary_Attendance_View recibe el Filter_Catalog, THE Secretary_Attendance_View SHALL mostrar cada disciplina disponible como una opción seleccionable del Discipline_Filter.
4. WHEN la Secretary_Attendance_View recibe el Filter_Catalog, THE Secretary_Attendance_View SHALL mostrar cada profesor activo como una opción seleccionable del Teacher_Filter.
5. WHEN la Secretary_Attendance_View muestra los controles de filtro, THE Secretary_Attendance_View SHALL mostrar una acción para aplicar los valores seleccionados.
6. WHEN la Secretary_Attendance_View muestra los controles de filtro, THE Secretary_Attendance_View SHALL mostrar una acción para limpiar los valores seleccionados.

### Requirement 2: Aplicar filtros individuales y combinados

**User Story:** Como integrante de Secretaría, quiero aplicar uno o varios filtros al mismo tiempo, para reducir el listado hasta las sesiones que cumplen mis criterios.

#### Acceptance Criteria

1. WHEN una persona de Secretaría aplica un Date_Filter, THE Secretary_Attendance_View SHALL mostrar únicamente Attendance_Session cuya fecha coincide con la fecha seleccionada.
2. WHEN una persona de Secretaría aplica un Grade_Filter, THE Secretary_Attendance_View SHALL mostrar únicamente Attendance_Session cuyo grado coincide con el grado seleccionado.
3. WHEN una persona de Secretaría aplica un Discipline_Filter, THE Secretary_Attendance_View SHALL mostrar únicamente Attendance_Session cuya disciplina coincide con la disciplina seleccionada.
4. WHEN una persona de Secretaría aplica un Teacher_Filter, THE Secretary_Attendance_View SHALL mostrar únicamente Attendance_Session cuyo profesor coincide con el profesor seleccionado.
5. WHEN una persona de Secretaría aplica más de un filtro, THE Secretary_Attendance_View SHALL mostrar únicamente Attendance_Session que cumplen simultáneamente todos los valores del Active_Filter_Set.
6. WHEN una persona de Secretaría consulta la Secretary_Attendance_View sin valores seleccionados, THE Secretary_Attendance_View SHALL mostrar el mismo conjunto de Attendance_Session disponible sin filtros adicionales.

### Requirement 3: Mantener la consistencia del listado y la paginación

**User Story:** Como integrante de Secretaría, quiero que el listado y sus páginas respeten mis filtros, para revisar resultados completos sin mezclar sesiones que no coinciden.

#### Acceptance Criteria

1. WHEN una persona de Secretaría aplica un Active_Filter_Set, THE Session_List SHALL contener únicamente Attendance_Session que coinciden con el Active_Filter_Set.
2. WHEN un Active_Filter_Set produce resultados en varias páginas, THE Pagination SHALL calcular el total de resultados y el total de páginas únicamente con Attendance_Session que coinciden con el Active_Filter_Set.
3. WHEN una persona de Secretaría cambia de página con un Active_Filter_Set vigente, THE Session_List SHALL conservar todos los valores del Active_Filter_Set en la nueva página.
4. WHEN una persona de Secretaría aplica o modifica un Active_Filter_Set, THE Secretary_Attendance_View SHALL mostrar la primera página del nuevo resultado.

### Requirement 4: Aplicar el mismo alcance a la exportación global

**User Story:** Como integrante de Secretaría, quiero exportar las asistencias con los mismos filtros del listado, para obtener un archivo coherente con la consulta realizada.

#### Acceptance Criteria

1. WHEN una persona de Secretaría solicita un Global_Attendance_Export con un Active_Filter_Set, THE Global_Attendance_Export SHALL incluir todas las Attendance_Session que coinciden con el Active_Filter_Set, incluyendo sesiones de páginas no visibles.
2. WHEN una persona de Secretaría solicita un Global_Attendance_Export con un Active_Filter_Set, THE Global_Attendance_Export SHALL excluir cada Attendance_Session que no coincide simultáneamente con todos los valores seleccionados.
3. WHEN una persona de Secretaría solicita un Global_Attendance_Export sin valores seleccionados, THE Global_Attendance_Export SHALL conservar el alcance de la exportación global sin filtros adicionales.
4. WHEN una persona de Secretaría modifica un filtro antes de solicitar un Global_Attendance_Export, THE Secretary_Attendance_View SHALL usar los valores vigentes del Active_Filter_Set en la solicitud de exportación.

### Requirement 5: Limpiar filtros y restaurar el listado

**User Story:** Como integrante de Secretaría, quiero limpiar todos los filtros con una sola acción, para volver rápidamente a la consulta general.

#### Acceptance Criteria

1. WHEN una persona de Secretaría activa la acción de limpiar filtros, THE Secretary_Attendance_View SHALL vaciar Date_Filter, Grade_Filter, Discipline_Filter y Teacher_Filter.
2. WHEN una persona de Secretaría activa la acción de limpiar filtros, THE Secretary_Attendance_View SHALL eliminar todos los valores del Active_Filter_Set.
3. WHEN una persona de Secretaría activa la acción de limpiar filtros, THE Session_List SHALL recargarse sin filtros adicionales desde la primera página.
4. WHEN una persona de Secretaría activa la acción de limpiar filtros, THE Pagination SHALL representar el total y las páginas del resultado sin filtros adicionales.

### Requirement 6: Informar resultados vacíos

**User Story:** Como integrante de Secretaría, quiero recibir una explicación clara cuando ningún resultado coincide, para saber que la consulta terminó sin sesiones.

#### Acceptance Criteria

1. WHEN un Active_Filter_Set no coincide con ninguna Attendance_Session, THE Secretary_Attendance_View SHALL mostrar un Empty_State visible dentro del área del listado.
2. WHEN un Active_Filter_Set no coincide con ninguna Attendance_Session, THE Secretary_Attendance_View SHALL conservar los valores seleccionados en Date_Filter, Grade_Filter, Discipline_Filter y Teacher_Filter.
3. WHEN un Active_Filter_Set no coincide con ninguna Attendance_Session, THE Secretary_Attendance_View SHALL mostrar Pagination con cero resultados y sin páginas navegables.

### Requirement 7: Gestionar carga y errores de filtros

**User Story:** Como integrante de Secretaría, quiero recibir estados claros durante la carga o ante un error, para distinguir una consulta en proceso de una consulta sin resultados.

#### Acceptance Criteria

1. WHEN la Secretary_Attendance_View carga el Filter_Catalog o un Session_List, THE Secretary_Attendance_View SHALL mostrar un indicador de carga en el área afectada.
2. WHEN la Secretary_Attendance_View carga un Session_List con un Active_Filter_Set, THE Secretary_Attendance_View SHALL impedir que una respuesta de una consulta anterior reemplace los resultados de la consulta vigente.
3. IF la carga del Filter_Catalog falla, THEN THE Secretary_Attendance_View SHALL mostrar un mensaje de error visible.
4. IF la carga del Filter_Catalog falla, THEN THE Secretary_Attendance_View SHALL mantener disponible la estructura de la vista.
5. IF la carga de un Session_List falla, THEN THE Secretary_Attendance_View SHALL mostrar un mensaje de error visible.
6. IF la carga de un Session_List falla, THEN THE Secretary_Attendance_View SHALL conservar los valores del Active_Filter_Set que originó la consulta.
7. IF la solicitud de un Global_Attendance_Export falla, THEN THE Secretary_Attendance_View SHALL mostrar un mensaje de error visible.
8. IF la solicitud de un Global_Attendance_Export falla, THEN THE Secretary_Attendance_View SHALL restablecer el estado de exportación para permitir un nuevo intento.

### Requirement 8: Proporcionar controles accesibles

**User Story:** Como integrante de Secretaría, quiero utilizar los filtros con teclado y tecnologías de asistencia, para consultar asistencias sin depender únicamente del mouse o de señales visuales.

#### Acceptance Criteria

1. WHEN la Secretary_Attendance_View muestra un control de filtro, THE Secretary_Attendance_View SHALL asociar el control con una etiqueta programática que identifique fecha, grado, disciplina o profesor.
2. WHEN una persona de Secretaría navega la Secretary_Attendance_View con teclado, THE Secretary_Attendance_View SHALL permitir enfocar y operar Date_Filter, Grade_Filter, Discipline_Filter, Teacher_Filter, la acción de aplicar y la acción de limpiar.
3. WHEN cambia el estado de carga, error o Empty_State, THE Secretary_Attendance_View SHALL exponer el cambio mediante texto accesible para tecnologías de asistencia.
4. WHEN una persona de Secretaría aplica o limpia filtros, THE Secretary_Attendance_View SHALL conservar un orden de foco que permita continuar la consulta sin perder el contexto de la acción.

### Requirement 9: Preservar la vista y capacidades de Supervisión

**User Story:** Como supervisor, quiero que la ampliación de filtros de Secretaría no altere mi vista de asistencias, para continuar usando las capacidades actuales de Supervisión.

#### Acceptance Criteria

1. WHEN una persona de Supervisión abre la Supervisor_Attendance_View, THE Supervisor_Attendance_View SHALL conservar el acceso autorizado a la vista.
2. WHEN una persona de Supervisión abre la Supervisor_Attendance_View, THE Supervisor_Attendance_View SHALL conservar el listado actual de asistencias.
3. WHEN una persona de Supervisión consulta, filtra o exporta asistencias, THE Supervisor_Attendance_View SHALL conservar las capacidades actuales de Supervisión.
4. WHEN una persona de Supervisión abre una sesión desde la Supervisor_Attendance_View, THE Session_Detail SHALL conservar el comportamiento existente para Supervisión.

### Requirement 10: Preservar el detalle de sesión y su filtro de estados

**User Story:** Como integrante de Secretaría, quiero abrir el detalle de una sesión filtrada sin perder la información de asistencia, para revisar los registros individuales de la sesión correcta.

#### Acceptance Criteria

1. WHEN una persona de Secretaría selecciona una Attendance_Session desde el Session_List, THE Session_Detail SHALL mostrar los metadatos y registros de la Attendance_Session seleccionada.
2. WHEN una persona de Secretaría abre un Session_Detail desde un Session_List filtrado por grado, THE Session_Detail SHALL mostrar los registros de la sesión seleccionada sin sustituir la sesión por otra del mismo grado.
3. WHEN una persona de Secretaría usa el filtro visual de estados dentro de un Session_Detail, THE Session_Detail SHALL conservar las opciones existentes para presentes, ausentes y todos los registros.
4. WHEN una persona de Secretaría cambia filtros del Session_List después de regresar desde un Session_Detail, THE Secretary_Attendance_View SHALL aplicar el nuevo Active_Filter_Set sin alterar los datos guardados de la sesión consultada.
