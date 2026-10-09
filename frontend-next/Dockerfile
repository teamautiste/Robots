FROM node:20-bookworm-slim AS dependencies

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

FROM node:20-bookworm-slim AS build

WORKDIR /app

ARG BACKEND_URL=http://backend:5000
ARG CAMERA_SERVICE_URL=http://host.docker.internal:5001

ENV BACKEND_URL=$BACKEND_URL \
    CAMERA_SERVICE_URL=$CAMERA_SERVICE_URL \
    NEXT_TELEMETRY_DISABLED=1

COPY --from=dependencies /app/node_modules ./node_modules
COPY . ./

RUN npm run serve

FROM node:20-bookworm-slim AS runtime

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=4553 \
    HOSTNAME=0.0.0.0 \
    BACKEND_URL=http://backend:5000 \
    CAMERA_SERVICE_URL=http://host.docker.internal:5001

WORKDIR /app

COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static

USER node

EXPOSE 4553

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:4553').then(response => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "server.js"]
