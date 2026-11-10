# ---------- Build: compila Angular ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Configuración "docker": producción, pero la API se consume en /api (nginx hace de proxy)
RUN npx ng build --configuration docker

# ---------- Runtime: nginx sirve los estáticos y hace proxy de /api al backend ----------
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/soderia-frontend/browser /usr/share/nginx/html
EXPOSE 80
