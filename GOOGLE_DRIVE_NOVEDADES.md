# Novedades diarias

## Estado actual

No existe una tabla real de novedades confirmada en la aplicación AppSheet configurada. El nombre usado anteriormente no corresponde a una tabla o slice invocable y producía errores de API.

Por ello:

- `APPSHEET_NOVEDADES_TABLE` permanece ausente o vacía;
- los endpoints de novedades devuelven una lista vacía en lugar de fallar;
- no se descargan archivos completos de Google Drive para reconstruir novedades;
- no hay sincronización periódica ni cron de novedades.

Estudiantes, inscripciones y horarios se obtienen de las tablas AppSheet vigentes. Google Drive no es la fuente de la oferta académica.

## Cómo habilitar novedades de forma segura

Antes de configurar una tabla:

1. Crear o identificar la tabla/slice real en la misma aplicación AppSheet.
2. Confirmar su nombre exacto y acceso mediante API.
3. Compartir el esquema de **AppSheet → Data → Columns**.
4. Verificar, como mínimo, identificador de novedad, código de estudiante, fecha de novedad, tipo y descripción.
5. Probar una lectura sin datos personales en logs.
6. Configurar `APPSHEET_NOVEDADES_TABLE` como binding server-only y desplegar nuevamente.

La API debe filtrar por el día solicitado usando la zona `America/Bogota`; una vista de novedades diarias no debe mezclar registros de días anteriores. El filtrado debe validarse con casos en los límites de medianoche de Colombia.

Nunca exponga `APPSHEET_APPLICATION_ACCESS_KEY` al frontend. Las variables relacionadas son:

```text
APPSHEET_APP_ID                  # no secreta
APPSHEET_APPLICATION_ACCESS_KEY  # secreta, sólo backend
APPSHEET_NOVEDADES_TABLE         # omitir hasta confirmar la tabla
```

## Google Drive opcional

El código de Drive queda únicamente para un watch opcional y metadata de cambios en `EC_Sync_State`. Si se habilita, requiere credenciales server-only y validación del webhook:

```text
GOOGLE_SERVICE_ACCOUNT_JSON
GOOGLE_DRIVE_FOLDER_ID
GOOGLE_DRIVE_WEBHOOK_URL
GOOGLE_DRIVE_WEBHOOK_TOKEN
```

Recibir una notificación de Drive no importa ni sobrescribe oferta, asistencia o novedades. No suba hojas operativas al repositorio como fuente fija.
