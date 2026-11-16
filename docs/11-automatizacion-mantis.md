# Simulación programada de incidencias en Mantis

La simulación se ejecuta en el Mantis local del proyecto Sodería (`http://localhost:8990`). Los cinco tickets de prueba anteriores se eliminaron después de respaldar toda la base. El nuevo recorrido contiene diez casos numerados según la lista discutida: 1–7, 9–11. Se omiten el 8 y el 12.

El respaldo previo a la limpieza está en `%LOCALAPPDATA%\tp-final-orellana\mantis-automation\backup-20261115-182216.sql`. En esa misma carpeta se guardan el estado de la ejecución y los tokens locales. Estos archivos no se versionan.

## Participantes

| Caso | Tema | Cuenta que lo crea | Cuenta que agrega la nota | Responsable final |
| --- | --- | --- | --- | --- |
| 1 | Arranque de Mantis | Figueroa | Guari | huells (`administrator`) |
| 2 | Puerto 8989 ocupado | huells | Figueroa | huells (`administrator`) |
| 3 | Arranque del backend y clúster | Figueroa | Guari | Méndez |
| 4 | Cambio de nodo principal | Figueroa | Méndez | Orellana |
| 5 | Sincronización de réplicas | Guari | Figueroa | Méndez |
| 6 | Conexión de pgAdmin | Figueroa | huells | Guari |
| 7 | Archivo de backup | Guari | Figueroa | Orellana |
| 9 | Métricas en Grafana | Figueroa | Guari | Méndez |
| 10 | Rendimiento de una consulta | Méndez | Guari | Figueroa |
| 11 | Acceso al panel de HAProxy | huells | Figueroa | Orellana |

Las acciones programadas se identifican como **simulación automatizada** dentro de Mantis. El nombre de la cuenta indica qué token usó el script, no que esa persona escribió manualmente la nota. Figueroa puede revisar todas las incidencias del proyecto como líder.

## Ritmo

- Se crea un ticket cada dos horas, mientras la computadora y Docker estén encendidos.
- Cuarenta minutos después de cada creación, otra cuenta agrega una nota de seguimiento.
- Cuarenta minutos después de la nota, la cuenta `administrator` asigna el ticket al responsable y pasa su estado a **Asignada**.
- El script no resuelve ni cierra tickets sin prueba. El responsable ejecuta la prueba, deja su evidencia y lo marca como resuelto; después otro integrante verifica y cierra.
- Si la computadora está apagada, la próxima acción se ejecuta al volver a estar disponible. El script procesa una acción por ejecución para evitar una carga simultánea.

La tarea de Windows se llama `TPFinal-MantisSimulacion` y ejecuta `scripts/ejecutar-mantis-simulacion.cmd` cada cinco minutos. El primer ticket se creó el 15/11/2026 a las 18:22; la próxima creación está prevista para las 20:22. El script detiene la tarea y revoca sus tokens al terminar las diez cargas, notas y asignaciones.

## Control desde la raíz del proyecto

```powershell
python scripts/mantis_simulacion.py estado
Get-Content "$env:LOCALAPPDATA\tp-final-orellana\mantis-automation\run.log" -Tail 20
```

Para detener la carga antes de que termine:

```powershell
python scripts/mantis_simulacion.py detener
```

El script conserva los tickets ya creados. No es necesario dejar abierta una terminal: la tarea programada de Windows realiza las ejecuciones. El archivo `scripts/mantis_simulacion.py` contiene los textos, autores, notas y responsables de los diez casos.
