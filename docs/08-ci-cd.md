# Punto 8: Integración Continua y Despliegue Continuo (CI/CD)

## 1. Arquitectura del Pipeline (`.github/workflows/ci-cd.yml`)

El flujo de CI/CD automatiza la validación de código, auditoría de dependencias y publicación de imágenes Docker en **GitHub Container Registry (GHCR)**:

1. **Disparadores y Concurrencia:**
   - Se ejecuta en `push` sobre `main`, `develop` y `feature/ci-cd`, y en `pull_request` hacia `main` y `develop` (más `workflow_dispatch`).
   - `concurrency: ci-cd-${{ github.ref }}` con `cancel-in-progress: true`: ante varios commits seguidos en la misma rama, cancela las ejecuciones obsoletas y procesa únicamente el último estado.
2. **Jobs de Integración Continua (CI):**
   - `ci-backend`: instala con `npm ci`, audita dependencias de producción (`npm audit --omit=dev --audit-level=high`), compila TypeScript (`npm run build`) y ejecuta las pruebas unitarias (`npm test`).
   - `ci-frontend`: instala con `npm ci`, audita dependencias (`npm audit --omit=dev --audit-level=high`) y compila el bundle Angular para entorno Docker (`npx ng build --configuration docker`).
3. **Job de Empaquetado y Publicación (`docker-build-push`):**
   - Depende de que `ci-backend` y `ci-frontend` finalicen en verde (`needs: [ci-backend, ci-frontend]`).
   - **Sin duplicación innecesaria en PRs:** corre únicamente en `push` a `main` o `develop` (o `workflow_dispatch`), evitando construir imágenes desechables en cada pull request.
   - Utiliza Docker Buildx con caché en GitHub Actions (`cache-from: type=gha` / `cache-to: type=gha,mode=max`).

## 2. Estrategia de Etiquetas (Tags en GHCR)

Mediante `docker/metadata-action@v6`, las imágenes `ghcr.io/maximilianoorellana02/soderia-backend` y `soderia-frontend` se etiquetan según la rama:

| Evento / Rama | Tags publicados en GHCR | Uso |
| :--- | :--- | :--- |
| `push` a `develop` | `:develop`, `:sha-<commit>` | Entorno de integración y pruebas continuas |
| `push` a `main` | `:main`, `:sha-<commit>`, `:latest` | Entorno estable / producción (`enable={{is_default_branch}}`) |

De este modo, los cambios en `develop` nunca sobreescriben la etiqueta `:latest` reservada para `main`.

## 3. Despliegue Continuo en Host (Watchtower) vs Desarrollo Local

Para evitar conflictos entre builds locales y actualizaciones automáticas desde GHCR, se separaron ambos flujos:

- **Modo Remoto / Despliegue Continuo (`docker-compose.yml`):**
  - `backend` y `frontend` consumen directamente `ghcr.io/maximilianoorellana02/soderia-<servicio>:${IMAGE_TAG:-develop}` (sin `build:` en el archivo base) y llevan la etiqueta `com.centurylinklabs.watchtower.enable=true`.
  - El servicio `watchtower` (`containrrr/watchtower`) corre con `--interval 30 --cleanup --label-enable`, vigilando únicamente esos dos contenedores cada 30 segundos y dejando intactos Patroni, HAProxy, etcd y observabilidad.
  - En `frontend/nginx.conf`, `resolver 127.0.0.11 valid=10s ipv6=off;` permite que Nginx re-resuelva la IP de `backend` si Watchtower recrea `soderia-backend-1`, y `Cache-Control: no-store` en `/index.html` garantiza que el navegador cargue inmediatamente los nuevos chunks compilados.

- **Modo Desarrollo Local (`docker-compose.local.yml`):**
  - Sobreescribe `backend` y `frontend` con `build:` local (`soderia-backend:local`, `soderia-frontend:local`), desactiva Watchtower (`com.centurylinklabs.watchtower.enable=false` y `profiles: [disabled]` en `watchtower`) y habilita `develop.watch` (`action: rebuild`) para reconstrucción automática al editar archivos locales.
  - Comando de uso:
    ```powershell
    docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --watch
    ```
  - Para volver al consumo automático desde GHCR sin reiniciar el clúster ni perder datos:
    ```powershell
    docker compose up -d --pull always
    ```
