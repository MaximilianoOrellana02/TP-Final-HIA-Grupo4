# Checklist compartido del TP Integrador — Sodería

Este tablero sigue los **15 puntos de la consigna**. Se considera trabajo existente aunque esté en otra rama o en preparación. Una casilla se marca `[x]` cuando otro integrante puede comprobarla; junto a ella se agrega un enlace a la evidencia (archivo, PR, ejecución o captura) y el responsable.

**Uso:** editar este archivo mediante un PR a `checklist`. No publicar contraseñas, tokens, datos personales ni enlaces privados de acceso. Actualizar los estados después de cada prueba, no solo después de escribir código.

| Campo | Completar |
| --- | --- |
| Fecha de revisión | — |
| Próxima revisión | — |
| Coordinador del checklist | — |
| Enlace al tablero de tareas | — |

## 1. Selección y diagnóstico

- [x] Describir Sodería, sus funciones, tecnologías, arquitectura inicial y mejoras propuestas. Evidencia: `docs/01-seleccion-diagnostico.md` (trabajo local; verificar ubicación final).
- [ ] Preparar una explicación de 1–2 minutos sobre el estado inicial de la app y por qué se eligieron las mejoras. Responsable: —. Evidencia: —.

## 2. Gestión Scrum

- [x] Crear backlog, sprints, responsables y criterios de aceptación en Jira. Evidencia: `docs/02-gestion-scrum.md`.
- [ ] Actualizar el estado real y los responsables de todas las tareas. Responsable: —. Evidencia: —.
- [ ] Registrar reuniones realizadas, impedimentos y decisiones; evitar presentar reuniones previstas como realizadas. Responsable: —. Evidencia: —.

## 3. Control de versiones y calidad

- [x] Utilizar ramas, PR y verificaciones automáticas. Evidencia: historial de PR y `.github/workflows/ci-cd.yml`.
- [ ] Mostrar un PR revisado por otro integrante, con corrección y aprobación. Responsable: —. Evidencia: —.
- [ ] Comprobar la protección de las ramas principales y revisar que no haya secretos o datos de ejecución versionados. Responsable: —. Evidencia: —.

## 4. Docker, datos y backups

- [x] Contenerizar PostgreSQL, pgAdmin, backend y frontend con persistencia. Evidencia: `docker-compose.yml` y Dockerfiles.
- [x] Preparar la carga masiva de seis millones de filas por tabla del conjunto de prueba. Evidencia: `docs/05-informe-entregable.md` y scripts SQL; confirmar la ejecución que se defenderá.
- [ ] Ejecutar una restauración en una base separada y comparar conteos y datos. Responsable: —. Evidencia: —.
- [ ] Medir duración y tamaño de backup y restauración. Responsable: —. Evidencia: —.
- [ ] Programar y comprobar la ejecución periódica si se presentará el backup como automático. El servicio actual se ejecuta bajo demanda con `docker compose run --rm backup`. Responsable: —. Evidencia: —.

## 5. Optimización de base de datos

- [x] Investigar ocho mejoras y una adicional con planes, índices y alternativas descartadas. Evidencia: informe y planes de la rama de trabajo del punto 5.
- [ ] Repetir las mediciones sobre el código y la base que se presentarán; conservar SQL y `EXPLAIN (ANALYZE, BUFFERS)` antes/después. Responsable: —. Evidencia: —.
- [ ] Comprobar que las ocho consultas conservan resultados correctos y registrar casos donde la mejora no sea estable. Responsable: —. Evidencia: —.
- [ ] Documentar espacio y costo de mantenimiento de índices, además de los índices descartados. Responsable: —. Evidencia: —.
- [ ] Dejar instrucciones reproducibles para la carga, medición y verificación. Responsable: —. Evidencia: —.

## 6. Clúster y replicación

- [x] Configurar tres nodos PostgreSQL con Patroni, etcd y HAProxy. Evidencia: `docker-compose.yml`, `cluster/` y `docs/06-Cluster.md`.
- [ ] Demostrar escritura antes y después de detener al líder, promoción, recuperación y reintegración. Responsable: —. Evidencia: —.
- [ ] Registrar tiempo de recuperación y retraso de replicación. Responsable: —. Evidencia: —.
- [ ] Explicar límites: replicación asíncrona, un etcd, un HAProxy y un solo anfitrión; no afirmar pérdida de datos igual a cero. Responsable: —. Evidencia: —.

## 7. Aplicación web en contenedores

- [x] Conectar frontend, API y base mediante Docker Compose. Evidencia: `docker-compose.yml` y `README.md`.
- [ ] Comprobar arranque desde cero siguiendo únicamente el README. Responsable: —. Evidencia: —.
- [ ] Mostrar un flujo completo en navegador y persistencia tras reiniciar: login, cliente, entrega/cobro y consulta. Responsable: —. Evidencia: —.

## 8. CI/CD

- [x] Compilar, ejecutar pruebas unitarias y publicar imágenes en GHCR. Evidencia: `.github/workflows/ci-cd.yml` y ejecución de Actions.
- [ ] Incorporar una prueba de integración relevante antes de publicar. Responsable: —. Evidencia: —.
- [ ] Demostrar que un commit identificable llega automáticamente a la web. Revisar etiquetas de imágenes de `develop` frente a `:latest` en Compose/Watchtower. Responsable: —. Evidencia: —.
- [ ] Probar y documentar rollback de una versión defectuosa. Responsable: —. Evidencia: —.

## 9. Publicación y acceso desde Internet

- [ ] Publicar la web con HTTPS y documentar URL, túnel y diagrama de red. Responsable: —. Evidencia: —.
- [ ] Probar acceso desde un dispositivo fuera de la red local. Responsable: —. Evidencia: —.
- [ ] Verificar que base de datos y herramientas administrativas no sean públicas. Responsable: —. Evidencia: —.
- [ ] Registrar disponibilidad, errores y procedimiento ante caída del enlace. Responsable: —. Evidencia: —.

## 10. Prometheus y Grafana

- [x] Recolectar métricas de PostgreSQL, contenedores y Patroni y disponer de dashboards. Evidencia: `cluster/observabilidad/` y `docs/10-monitoreo-grafana-prometheus.md`.
- [ ] Configurar reglas de alerta efectivas y un canal de notificación. Responsable: —. Evidencia: —.
- [ ] Provocar una falla controlada y registrar métrica, alerta y aviso recibido. Responsable: —. Evidencia: —.
- [ ] Verificar que los paneles muestran métricas reales y actuales. Responsable: —. Evidencia: —.

## 11. Mantis

- [x] Desplegar Mantis y preparar diez casos reproducibles. Evidencia: perfil `incidencias` y `docs/11-automatizacion-mantis.md`.
- [ ] Confirmar diez incidencias registradas en la instalación de la demostración, incluidas una de rendimiento y una de seguridad. Responsable: —. Evidencia: —.
- [ ] Completar en cada ticket reproducción, asignación, corrección, enlace al cambio y prueba posterior. Responsable: —. Evidencia: —.
- [ ] Cerrar tickets solo después de verificar la solución. Responsable: —. Evidencia: —.

## 12. Nextcloud

- [ ] Desplegar Nextcloud o utilizar una instancia autorizada. Responsable: —. Evidencia: —.
- [ ] Crear carpetas, usuarios y matriz de permisos. Responsable: —. Evidencia: —.
- [ ] Subir informes y evidencias reales. Responsable: —. Evidencia: —.
- [ ] Probar con dos cuentas que los permisos permiten y rechazan el acceso esperado. Responsable: —. Evidencia: —.

## 13. Automatización con n8n

- [x] Definir el servicio Docker de n8n. Evidencia: perfil `automatizacion` en `docker-compose.yml`.
- [ ] Crear y exportar tres flujos funcionales que integren componentes del proyecto. Responsable: —. Evidencia: —.
- [ ] Probar ejecución correcta y fallo controlado de cada flujo; conservar historial. Responsable: —. Evidencia: —.
- [ ] Proteger credenciales y webhooks y documentar disparadores, validaciones y acciones. Responsable: —. Evidencia: —.

## 14. Seguridad informática

- [ ] Quitar credenciales de clúster escritas en Compose y evitar valores por defecto débiles en el despliegue. Responsable: —. Evidencia: —.
- [ ] Elaborar matriz de amenazas específica de Sodería. Responsable: —. Evidencia: —.
- [ ] Ejecutar pruebas de dependencias, autorización y configuración de contenedores; guardar resultados. Responsable: —. Evidencia: —.
- [ ] Corregir hallazgos prioritarios y repetir sus pruebas. Responsable: —. Evidencia: —.
- [ ] Documentar respuesta y recuperación ante incidentes. Responsable: —. Evidencia: —.

## 15. Documentación final y defensa

- [ ] Crear un índice: punto de la consigna → archivo → comando → resultado → responsable. Responsable: —. Evidencia: —.
- [ ] Ensayar una demostración de aproximadamente 20 minutos con plan alternativo ante fallos de Docker o Internet. Responsable: —. Evidencia: —.
- [ ] Confirmar que cada integrante puede explicar su aporte, decisiones y limitaciones. Responsable: —. Evidencia: —.
- [ ] Separar en el informe final lo implementado, lo probado y lo pendiente; corregir afirmaciones que no coincidan con el código. Responsable: —. Evidencia: —.

## Prioridades para la próxima revisión

1. Cerrar acceso externo (9), Nextcloud (12) y los tres flujos de n8n (13).
2. Demostrar restauración (4), despliegue y rollback (8), y alerta real (10).
3. Consolidar pruebas reproducibles de SQL (5), clúster (6), incidencias (11) y seguridad (14).

