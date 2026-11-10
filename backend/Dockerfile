# ---------- Build: compila TypeScript ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---------- Runtime ----------
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
# sequelize-cli (devDependency) se instala para poder correr las migraciones al iniciar
RUN npm ci --omit=dev && npm install --no-save sequelize-cli@6 && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY config ./config
COPY migrations ./migrations
COPY scripts ./scripts
COPY src/config ./src/config

USER node
EXPOSE 3001
# Aplica migraciones pendientes y levanta la API
CMD ["sh", "-c", "npx sequelize-cli db:migrate --config config/config.js --env development && node dist/server.js"]
