# Bugfix Requirements Document

## Introduction

La vista de asistencia de secretaria ya muestra los conteos de estudiantes presentes y ausentes, pero esos conteos no completan el comportamiento de filtrado esperado: al seleccionarlos, la lista debe mostrar únicamente los registros del estado elegido. Esta corrección completa el comportamiento existente sin convertirlo en una funcionalidad independiente ni alterar las acciones actuales de la sesión.

La condición del bug se define así:

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type AttendanceSessionView
  OUTPUT: boolean

  RETURN X.role = "secretary"
    AND X.records contain at least one student
    AND X.selectedStatus in {"presente", "ausente"}
    AND X.visibleRecords contain records whose estado is not X.selectedStatus
END FUNCTION
```

La propiedad de corrección es:

```pascal
// Property: Fix Checking
FOR ALL X WHERE isBugCondition(X) DO
  result ← attendanceSessionView'(X)
  ASSERT result.visibleRecords = filter(X.records, record.estado = X.selectedStatus)
END FOR
```

F representa el comportamiento original y F' representa el comportamiento corregido. La propiedad de preservación es:

```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
END FOR
```

## Bug Analysis

### Current Behavior (Defect)

La pantalla de asistencia reutilizada por el flujo de secretaria presenta los conteos de presentes y ausentes como elementos no interactivos, mientras la lista renderiza todos los registros de la sesión sin aplicar un filtro por estado.

1.1 WHEN la secretaria visualiza una sesión con registros de asistencia THEN el sistema muestra los conteos de Presentes y Ausentes sin permitir seleccionar ninguno para filtrar la lista.

1.2 WHEN la secretaria intenta seleccionar Presentes o Ausentes THEN el sistema no cambia los registros visibles y continúa mostrando estudiantes presentes, ausentes y justificados en conjunto.

### Expected Behavior (Correct)

La selección de un estado debe controlar de forma clara el contenido de la lista, y debe existir una acción explícita para quitar el filtro.

2.1 WHEN la secretaria selecciona Presentes THEN el sistema SHALL mostrar únicamente los registros cuyo estado de asistencia sea `presente` y SHALL indicar visualmente que ese filtro está activo.

2.2 WHEN la secretaria selecciona Ausentes THEN el sistema SHALL mostrar únicamente los registros cuyo estado de asistencia sea `ausente` y SHALL indicar visualmente que ese filtro está activo.

2.3 WHEN la secretaria selecciona Todos, quita el filtro activo o usa una acción equivalente claramente identificada THEN el sistema SHALL volver a mostrar todos los registros de la sesión, incluidos presentes, ausentes y justificados.

2.4 WHEN la secretaria cambia directamente de Presentes a Ausentes o de Ausentes a Presentes THEN el sistema SHALL reemplazar el filtro anterior y mostrar únicamente los registros correspondientes al nuevo estado seleccionado.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN la secretaria usa la acción Novedades de cualquier registro visible THEN el sistema SHALL CONTINUE TO abrir la vista de novedades con la sesión y los datos del estudiante correctos.

3.2 WHEN la secretaria exporta la asistencia de la sesión THEN el sistema SHALL CONTINUE TO generar el archivo Excel de la sesión sin que el filtro visual modifique su contenido.

3.3 WHEN la secretaria usa Volver, Salir o la navegación existente de la sesión THEN el sistema SHALL CONTINUE TO navegar a los destinos actuales sin cambios.

3.4 WHEN la secretaria visualiza los conteos de Presentes, Ausentes y Total THEN el sistema SHALL CONTINUE TO calcular y mostrar los conteos basados en todos los registros de la sesión, independientemente del filtro activo.

3.5 WHEN un usuario visualiza la asistencia fuera del flujo de secretaria THEN el sistema SHALL CONTINUE TO conservar el comportamiento existente de ese flujo, salvo que una especificación posterior indique lo contrario.
