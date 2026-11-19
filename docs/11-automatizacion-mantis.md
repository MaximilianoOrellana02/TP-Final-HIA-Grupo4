# 11. Gestión de incidencias con MantisBT

## 11.1. Herramienta funcionando

El equipo utiliza **MantisBT** para registrar problemas y mejoras de Sodería, asignar su seguimiento y consultar las soluciones. Cada incidencia reúne una descripción breve, una persona responsable, pasos de comprobación y notas de seguimiento.

[Abrir MantisBT de Sodería](http://localhost:8990/).

La herramienta funciona en Docker junto con su base de datos MariaDB y un servicio de correo local. Los datos se guardan en un volumen para conservar las incidencias al recrear los contenedores. La configuración está en [Docker Compose](../docker-compose.yml) y en [config_inc.php](../mantis/config_inc.php).

Para iniciar los servicios:

```powershell
docker compose --profile incidencias up -d mantis-db mantis-correo mantisbt
```

Al **19/11/2026**, los tres servicios estaban en ejecución y la página de acceso de Mantis respondía correctamente en el puerto **8990**. El enlace corresponde al entorno local del equipo donde se ejecuta Docker.

## 11.2. Equipo y forma de trabajo

Los cinco integrantes tienen nivel **desarrollador dentro del proyecto Sodería**. La cuenta administradora permite organizar la carga y las asignaciones. El equipo usa el siguiente recorrido:

1. **Registrar:** describir el problema o la mejora y explicar cómo comprobarlo.
2. **Asignar:** indicar quién se encarga de revisar la solución y documentar el resultado.
3. **Dar seguimiento:** agregar una nota con el avance o la comprobación pendiente.
4. **Resolver y verificar:** registrar la comprobación realizada y su alcance; si confirma la solución, resolver y cerrar la incidencia.

Las reuniones y la comunicación directa del grupo siguen siendo el medio de coordinación. Mantis conserva un registro breve de los casos y de su seguimiento.

| Integrante | Usuario en Mantis |
| --- | --- |
| Orellana, Cristian Maximiliano | `cristian.orellana` |
| Huells, Nicolas Rafael | `nicolas.huells` |
| Guari, Christian Rene | `christian.guari` |
| Figueroa, Maximiliano Rubén Mariano | `maximiliano.figueroa` |
| Mendez, Marcos Antonio | `marcos.mendez` |

## 11.3. Registro de incidencias

El proyecto contiene **diez casos**, numerados del **14 al 23**, sobre cambios presentes en el repositorio. Se distinguen las correcciones de errores de las mejoras de uso, configuración y rendimiento.

| Incidencia | Tipo | Problema o necesidad | Solución registrada |
| --- | --- | --- | --- |
| [#14. Acceso a Configuración](http://localhost:8990/view.php?id=14) | Corrección de interfaz | No aparecía el botón para abrir Configuración. | Se restauraron el engranaje y la ventana de Configuración. |
| [#15. Contadores de clientes](http://localhost:8990/view.php?id=15) | Corrección de información | Los datos de los clientes cargados podían interpretarse como totales generales. | Se ajustaron los contadores y se aclaró el alcance del saldo mostrado. |
| [#16. Navegación por páginas](http://localhost:8990/view.php?id=16) | Mejora de uso | Para llegar a más resultados había que seguir cargando registros con «Ver más». | Se incorporaron páginas numeradas y botones anterior y siguiente en Clientes e Historial. |
| [#17. Tablero inicial de Grafana](http://localhost:8990/view.php?id=17) | Mejora de configuración | Se necesitaba acceder directamente al tablero del proyecto. | Se configuró Observabilidad Integral como tablero inicial. |
| [#18. Identificadores de clientes](http://localhost:8990/view.php?id=18) | Corrección de validación | Las consultas de actividad y deuda vieja podían ejecutarse sin indicar los clientes. | Se exigieron entre 1 y 100 identificadores válidos. |
| [#19. Scripts de Linux](http://localhost:8990/view.php?id=19) | Corrección de compatibilidad | Los saltos de línea de Windows podían afectar la ejecución de los scripts en Linux. | Se normalizó el formato de los scripts durante la construcción de la imagen. |
| [#20. Permisos de métricas](http://localhost:8990/view.php?id=20) | Corrección de configuración | Un permiso de consulta de métricas se aplicaba en otra base. | Se corrigió el script para concederlo en la base configurada. |
| [#21. Frecuencia de métricas SQL](http://localhost:8990/view.php?id=21) | Mejora de rendimiento | La recolección consultaba PostgreSQL cada 2 segundos. | Se cambió el intervalo a 15 segundos y se fijó una espera de 10 segundos. |
| [#22. Conteo y listado separados](http://localhost:8990/view.php?id=22) | Mejora de rendimiento | El conteo incluía relaciones que solo hacían falta para mostrar los registros. | Se separaron `count` y `findAll` en Clientes e Historial. |
| [#23. Ruta de Hoy](http://localhost:8990/view.php?id=23) | Corrección con grandes volúmenes | La pantalla pedía todos los clientes y podía superar el límite de carga. | Se incorporó una consulta paginada para los clientes de la ruta del día. |

## 11.4. Evidencias de asignación y seguimiento

Cada caso tiene informador, responsable y una nota de seguimiento. Las asignaciones que figuran en Mantis al **19/11/2026** son las siguientes:

| Incidencia | Informador | Asignada a | Cuenta de revisión |
| --- | --- | --- | --- |
| #14. Configuración | Orellana | Figueroa | Orellana |
| #15. Contadores | Huells | Orellana | Huells |
| #16. Páginas | Guari | Orellana | Guari |
| #17. Grafana | Mendez | Mendez | Mendez |
| #18. Identificadores | Figueroa | Huells | Figueroa |
| #19. Scripts | Mendez | Figueroa | Mendez |
| #20. Permisos | Guari | Figueroa | Guari |
| #21. Métricas SQL | Figueroa | Mendez | Mendez |
| #22. Conteos | Orellana | Huells | Orellana |
| #23. Ruta de Hoy | Figueroa | Huells | Figueroa |

Las notas resumen la revisión automática del código y, en los casos cerrados, la implementación comprobada y su cierre. La cuenta asociada a una nota identifica el rol usado en el ejercicio; no acredita que ese integrante haya realizado una prueba manual. Las asignaciones indican quién lleva el seguimiento del caso.

Para consultar las evidencias, se abre la incidencia desde la tabla anterior y se revisan los campos **Informador**, **Asignada a**, **Notas de incidencias** e **Historial de incidencias**. En el historial se pueden ver la creación, las asignaciones, los cambios de responsable y las notas.

## 11.5. Soluciones e historial de resolución

Las soluciones descritas tienen antecedentes concretos en Git. La tabla permite ubicar el cambio y su fecha sin confundirlos con el estado del ticket en Mantis.

| Incidencia | Fecha del cambio en Git | Referencia |
| --- | --- | --- |
| #14. Configuración | 19/11/2026 | [66fc3c6](https://github.com/MaximilianoOrellana02/TP-Final-HIA-Grupo4/commit/66fc3c6) |
| #15. Contadores | 16/11/2026 | [b3e97a1](https://github.com/MaximilianoOrellana02/TP-Final-HIA-Grupo4/commit/b3e97a1) |
| #16. Páginas | 18/11/2026 | [82ae29e](https://github.com/MaximilianoOrellana02/TP-Final-HIA-Grupo4/commit/82ae29e) |
| #17. Grafana | 17/11/2026 | [b8815c1](https://github.com/MaximilianoOrellana02/TP-Final-HIA-Grupo4/commit/b8815c1) |
| #18. Identificadores | 18/11/2026 | [116d6de](https://github.com/MaximilianoOrellana02/TP-Final-HIA-Grupo4/commit/116d6de) |
| #19. Scripts | 16/11/2026 | [ce2f06c](https://github.com/MaximilianoOrellana02/TP-Final-HIA-Grupo4/commit/ce2f06c) |
| #20. Permisos | 19/11/2026 | [66fc3c6](https://github.com/MaximilianoOrellana02/TP-Final-HIA-Grupo4/commit/66fc3c6) |
| #21. Métricas SQL | 17/11/2026 | [b8815c1](https://github.com/MaximilianoOrellana02/TP-Final-HIA-Grupo4/commit/b8815c1) |
| #22. Conteos | 18/11/2026 | [9860aa8](https://github.com/MaximilianoOrellana02/TP-Final-HIA-Grupo4/commit/9860aa8) |
| #23. Ruta de Hoy | 18/11/2026 | [89c6d34](https://github.com/MaximilianoOrellana02/TP-Final-HIA-Grupo4/commit/89c6d34) |

Al **19/11/2026**, las incidencias **#14 a #20, #22 y #23** están **Cerradas**, con resolución **Corregida**. Cada una conserva notas de seguimiento y los pasos por **Resuelta** y **Cerrada**. El cierre se basa en la implementación comprobada mediante revisión automática del código de `develop`; no representa una prueba manual de todas las funciones.

La incidencia **#21** continúa **Asignada**, con resolución **Abierta**: el cambio a 15 segundos está en Git, pero Prometheus todavía utiliza un intervalo de 2 segundos. Queda pendiente aplicar la configuración y comprobar que siguen llegando métricas.

## 11.6. Estado de los entregables

| Entregable | Evidencia disponible |
| --- | --- |
| Herramienta funcionando | Mantis y sus servicios en ejecución; página de acceso disponible en `localhost:8990`. |
| Registro de incidencias | Diez casos con descripción, solución y pasos de comprobación. |
| Evidencias de asignación y seguimiento | Responsables, notas e historial consultables en cada ticket. |
| Historial de resolución | Nueve casos con notas y transiciones a Resuelta y Cerrada; #21 permanece asignada con el motivo pendiente registrado. |

**Pendiente:** aplicar y comprobar el intervalo de métricas de #21 antes de registrar su cierre.
