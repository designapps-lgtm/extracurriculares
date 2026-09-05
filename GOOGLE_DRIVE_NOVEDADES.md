# Novedades diarias

El flujo vigente ya no lee novedades desde un archivo Excel de Google Drive ni
desde la tabla SQL `Novedad`.

Las pantallas de novedades consultan AppSheet en vivo:

- estudiantes e inscripciones: `APPSHEET_DEMOGRAFICOS_TABLE`
- novedades diarias: `APPSHEET_NOVEDADES_TABLE`

Variables necesarias:

```bash
APPSHEET_APP_ID=
APPSHEET_APPLICATION_ACCESS_KEY=
APPSHEET_DEMOGRAFICOS_TABLE=Demograficos
APPSHEET_NOVEDADES_TABLE=Novedades_Diarias
```

Google Drive queda reservado para oferta/horarios, si se configura
explicitamente con:

```bash
GOOGLE_SERVICE_ACCOUNT_JSON=
GOOGLE_DRIVE_FOLDER_ID=
GOOGLE_DRIVE_OFFER_FILE_NAMES=
```

No debe subirse `Extracurriculares_base.xlsx` ni `Horario por seccion
extracurricular.xlsx` al repositorio como fuente fija.
