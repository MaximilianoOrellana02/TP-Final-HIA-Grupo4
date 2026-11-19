# 2. Gestión del proyecto mediante Scrum

## 2.1. Proyecto en Jira

El equipo organiza el TP Integrador de Sodería en el proyecto Scrum **TP Integrador HIA - Sodería** (clave **HIA**) de Jira Cloud. Scrum divide el trabajo en períodos breves llamados *sprints*: se planifican tareas, se sigue su estado y se revisa lo realizado para ajustar el trabajo siguiente. Jira permite ver el backlog, los responsables y el avance.

[Abrir el backlog del proyecto HIA en Jira](https://huellsnicolasr.atlassian.net/jira/software/projects/HIA/boards/2/backlog).

Las tareas **HIA-1 a HIA-15** y las cinco épicas **HIA-16 a HIA-20** organizan el alcance del integrador. Las actividades siguen siendo tareas técnicas. El estado de este documento corresponde al **19/11/2026**.

## 2.2. Product Backlog

El backlog cubre los quince puntos de la consigna, incluidos aplicación, infraestructura, pruebas, seguridad, documentación y despliegue. Las prioridades y los criterios de aceptación están cargados en Jira. Este cuadro los resume para la entrega:

| Tarea | Actividad | Prioridad | Criterio de aceptación resumido |
| --- | --- | --- | --- |
| HIA-1 | Selección y diagnóstico | Alta | Diagnóstico documentado con arquitectura, tecnologías y límites comprobados. |
| HIA-2 | Scrum y Jira | Alta | Backlog, sprints, roles y evidencias de seguimiento disponibles. |
| HIA-3 | Git y colaboración | Alta | Flujo de ramas y revisiones de cambios documentados y usados. |
| HIA-4 | Base de datos y servicios en Docker | Alta | Compose, datos persistentes, carga de prueba, backup y restauración comprobados. |
| HIA-5 | Optimización SQL | Alta | Ocho consultas con planes y mediciones comparables antes y después. |
| HIA-6 | Replicación de PostgreSQL | Media | Réplica y prueba de sincronización, fallo y recuperación documentadas. |
| HIA-7 | Aplicación en Docker | Alta | Frontend, API y base funcionan juntos; configuración documentada. |
| HIA-8 | CI/CD | Alta | Pipeline ejecutado para verificar, construir y desplegar. |
| HIA-9 | Acceso externo | Alta | Acceso externo seguro demostrado y arquitectura documentada. |
| HIA-10 | Monitoreo | Media | Métricas, paneles y una alerta probada. |
| HIA-11 | Incidencias | Media | Incidencias reproducibles registradas y verificadas en la herramienta elegida. |
| HIA-12 | Nextcloud | Media | Documentación compartida con accesos y permisos comprobados. |
| HIA-13 | n8n | Media | Tres flujos funcionales documentados y probados. |
| HIA-14 | Seguridad | Alta | Riesgos, controles, pruebas y respuesta a incidentes documentados. |
| HIA-15 | Documentación y defensa | Alta | Entrega reunida y aportes técnicos explicables por los cinco integrantes. |

Las estimaciones de dificultad se guardaron en Jira como puntos de historia; no equivalen a horas. HIA-5, HIA-6 y HIA-14 tienen 13 puntos y conviene revisar si se dividen al planificarlas.

## 2.3. Equipo y responsables

| Integrante | Rol propuesto |
| --- | --- |
| Orellana, Cristian Maximiliano | Product Owner y dueño de Sodería |
| Huells, Nicolas Rafael | Scrum Master y encargado del punto 2 |
| Guari, Christian Rene | Desarrollador |
| Figueroa, Maximiliano Rubén Mariano | Desarrollador y coordinador general |
| Mendez, Marcos Antonio | Desarrollador |

Los cinco realizan aportes técnicos y deben comprender el sistema para la defensa individual. Las quince tareas y las cinco épicas tienen responsable en Jira. La distribución de las tareas es: Orellana, HIA-1 y HIA-4; Huells, HIA-2, HIA-3, HIA-5 y HIA-11; Figueroa, HIA-7, HIA-8, HIA-9 y HIA-12; Mendez, HIA-6, HIA-10 y HIA-14; Guari, HIA-13 y HIA-15. Las épicas HIA-16 a HIA-20 están asignadas, respectivamente, a Huells, Orellana, Figueroa, Mendez y Guari.

## 2.4. Plan de sprints

| Sprint | Objetivo | Tareas |
| --- | --- | --- |
| 1. Diagnóstico y organización | Conocer Sodería y organizar el trabajo. | HIA-1, HIA-2, HIA-3 |
| 2. Base de datos e infraestructura | Preparar la base, analizarla y completar los contenedores. | HIA-4, HIA-5, HIA-6, HIA-7 |
| 3. Integración y operación | Integrar, publicar, monitorear y atender incidencias. | HIA-8, HIA-9, HIA-10, HIA-11 |
| 4. Automatización, seguridad y entrega | Compartir documentación, automatizar, revisar seguridad y cerrar la entrega. | HIA-12, HIA-13, HIA-14, HIA-15 |

Los cuatro sprints y sus tareas figuran en Jira. Al **19/11/2026**, los sprints 1, 2 y 3 figuran cerrados y el 4 sigue activo: HIA-13 está en «Listo»; HIA-12, HIA-14 y HIA-15 están «En curso». Existe además un sprint futuro vacío, sin tareas del plan. Las fechas de vencimiento son plazos de planificación de esta simulación académica; no demuestran que el trabajo esté terminado.

En las tareas, HIA-1 a HIA-11 y HIA-13 figuran en «Listo»; HIA-12, HIA-14 y HIA-15 figuran «En curso». La épica HIA-19 figura en «Listo» aunque HIA-12, que depende de ella, continúa en curso; su estado requiere revisión. Las cinco épicas tienen fecha de inicio en Jira y cuatro tienen fecha de vencimiento; HIA-20 todavía no tiene vencimiento.

## 2.5. Seguimiento y reuniones

El equipo actualizará el estado de cada tarea en Jira y agregará allí enlaces a entregables, avances e impedimentos cuando ocurran. Las decisiones que afecten prioridades o alcance se registrarán con fecha en la tarea correspondiente o en el registro de reuniones. Una tarea se considerará terminada cuando se pueda comprobar su criterio de aceptación.

El [Registro de reuniones Scrum](02-reuniones-scrum.md) resume las reuniones informadas por el equipo para el **11, 15, 17 y 19/11/2026**. Como no se conservaron minutas detalladas, documenta temas generales relacionados con los sprints y evita atribuir asistentes o decisiones individuales no confirmados. Las capturas del tablero muestran estados de tareas, pero no prueban por sí solas la realización de reuniones.

## 2.6. Evidencias

Las capturas del equipo muestran el proyecto, las épicas, una tarea con su criterio de aceptación y los cuatro sprints:

![Tablero Scrum de Jira](../img/02_/board.png)

![Cinco épicas del proyecto](../img/02_/lista.png)

![Detalle y criterio de aceptación de HIA-2](../img/02_/HIA-2.png)

![Sprint 1 con objetivo y tareas](../img/02_/sprint-1.png)

![Sprint 2 con objetivo y tareas](../img/02_/sprint-2.png)

![Sprint 3 con objetivo y tareas](../img/02_/sprint-3.png)

![Sprint 4 con objetivo y tareas](../img/02_/sprint-4.png)

Las siete capturas de esta sección también están adjuntas a [HIA-2](https://huellsnicolasr.atlassian.net/browse/HIA-2). Documentan la estructura y el seguimiento inicial del proyecto; no acreditan por sí solas la realización de reuniones.

**Pendiente para cerrar el punto:** conservar evidencia de los estados registrados, revisar HIA-19 frente a HIA-12 en curso y agregar al registro de reuniones cualquier detalle que el equipo pueda confirmar.
