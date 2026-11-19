# Punto 3: Git y colaboración

## Repositorio y forma de trabajo

Usamos [TP-Final-HIA-Grupo4](https://github.com/MaximilianoOrellana02/TP-Final-HIA-Grupo4) como repositorio remoto público de Sodería. Comprobamos su visibilidad en GitHub el **19/11/2026**. El repositorio tiene `main` como rama predeterminada; el desarrollo más reciente está en `develop`. Esto importa al revisar la entrega: `main` y `develop` no muestran necesariamente el mismo estado del proyecto.

El archivo [README inicial](../README.md) ya estaba en el primer commit, [`73dea4b`](https://github.com/MaximilianoOrellana02/TP-Final-HIA-Grupo4/commit/73dea4b), del 10/11/2026. Hoy explica la estructura de la aplicación, cómo levantarla con Docker y cómo acceder a los servicios. El historial conserva ese punto de partida y los cambios posteriores.

Para evitar publicar archivos locales, `.gitignore` excluye `.env`, `credenciales-demo.txt`, dependencias y datos persistidos de Docker. Hay archivos `.env.example` con la configuración de ejemplo. Esta comprobación describe los archivos actuales y las reglas de exclusión; **no equivale a una auditoría completa de secretos o datos personales en todos los commits**.

## Historial de commits

Los commits permiten seguir qué se agregó y cuándo. En `develop` encontramos, por ejemplo, la integración del informe Scrum en [`e4b5faf`](https://github.com/MaximilianoOrellana02/TP-Final-HIA-Grupo4/commit/e4b5faf), el informe de optimización en [`1e768e8`](https://github.com/MaximilianoOrellana02/TP-Final-HIA-Grupo4/commit/1e768e8) y la corrección de estabilidad del clúster en [`ff4db71`](https://github.com/MaximilianoOrellana02/TP-Final-HIA-Grupo4/commit/ff4db71). Los mensajes distinguen documentación, funciones y correcciones. También hay commits de integración que muestran la entrada de cambios de otras ramas a `develop`.

## Ramas de trabajo

Separamos tareas en ramas antes de integrarlas. Estos nombres y usos están comprobados en el remoto:

| Rama | Trabajo registrado | Evidencia |
| --- | --- | --- |
| `main` | Rama predeterminada del repositorio. | [Repositorio](https://github.com/MaximilianoOrellana02/TP-Final-HIA-Grupo4) |
| `develop` | Rama donde se integraron los cambios recientes del equipo. | [Historial de `develop`](https://github.com/MaximilianoOrellana02/TP-Final-HIA-Grupo4/commits/develop/) |
| `docs/punto-5-optimizacion-sql` | Documentación de las consultas y las pruebas de base de datos. | [PR #4](https://github.com/MaximilianoOrellana02/TP-Final-HIA-Grupo4/pull/4) |
| `fix/soderia-cluster-estable` | Correcciones del clúster. | [PR #12](https://github.com/MaximilianoOrellana02/TP-Final-HIA-Grupo4/pull/12) |
| `feat/optimizacion-db-carga-6m` | Carga de prueba y optimizaciones de base de datos. | [PR #17](https://github.com/MaximilianoOrellana02/TP-Final-HIA-Grupo4/pull/17) |
| `feature/jira` | Actualización del informe Scrum y las reuniones. | [PR #18](https://github.com/MaximilianoOrellana02/TP-Final-HIA-Grupo4/pull/18) |

Los prefijos `docs/`, `fix/`, `feat/` y `feature/` ayudan a reconocer el tipo de cambio. El repositorio usa tanto `feat/` como `feature/`; **no hay una convención única aplicada a todas las ramas**. Las ramas de trabajo permanecen visibles en el remoto después de algunas integraciones.

## Solicitudes de integración y revisiones

Usamos pull requests para llevar cambios de una rama de trabajo a `develop`. En los casos revisados, GitHub registra la rama de origen, la rama de destino, los commits y los archivos modificados:

| Solicitud | Origen → destino | Resultado comprobado |
| --- | --- | --- |
| [PR #4](https://github.com/MaximilianoOrellana02/TP-Final-HIA-Grupo4/pull/4) | `docs/punto-5-optimizacion-sql` → `develop` | Fusionada; dos commits y siete archivos modificados. |
| [PR #12](https://github.com/MaximilianoOrellana02/TP-Final-HIA-Grupo4/pull/12) | `fix/soderia-cluster-estable` → `develop` | Fusionada; dos commits y cinco archivos modificados. |
| [PR #17](https://github.com/MaximilianoOrellana02/TP-Final-HIA-Grupo4/pull/17) | `feat/optimizacion-db-carga-6m` → `develop` | Fusionada; seis commits y diecisiete archivos modificados. |
| [PR #18](https://github.com/MaximilianoOrellana02/TP-Final-HIA-Grupo4/pull/18) | `feature/jira` → `develop` | Fusionada; un commit y dos archivos modificados. |

También está el [PR #9](https://github.com/MaximilianoOrellana02/TP-Final-HIA-Grupo4/pull/9), que al 19/11/2026 seguía abierto como borrador. Su descripción enumera verificaciones pendientes y pide no fusionarlo sin validarlas. Es un ejemplo de cambio que quedó separado mientras se comprobaba su comportamiento.

**Límite de la evidencia:** consultamos las revisiones registradas en GitHub para los PR #1 a #19 y no encontramos revisiones enviadas, aprobaciones ni solicitudes de cambios. Las solicitudes de integración y sus fusiones están comprobadas; una fusión por sí sola **no demuestra que otra persona haya revisado el código**. Para completar ese entregable falta dejar una revisión formal en un PR posterior, con observaciones o aprobación verificables.

## Conclusión

El repositorio público, el README, el historial de commits, las ramas de trabajo y las solicitudes de integración están disponibles para consultar. Las ramas permitieron separar documentación, funciones y correcciones, y los PR muestran cómo se incorporaron varios de esos cambios a `develop`. La parte que todavía no podemos acreditar es la revisión formal de código: no aparece registrada en los PR consultados.
