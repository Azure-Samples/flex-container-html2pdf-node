FROM node:24-bookworm-slim AS worker

ARG FUNCTIONS_NODE_WORKER_SHA256=""

ADD https://aka.ms/azurefunctions/releases/node/worker/latest/worker.tar.gz \
    /tmp/worker.tar.gz

RUN if [ -n "$FUNCTIONS_NODE_WORKER_SHA256" ]; then \
        printf '%s  %s\n' \
            "$FUNCTIONS_NODE_WORKER_SHA256" \
            '/tmp/worker.tar.gz' \
            | sha256sum -c -; \
    fi \
    && mkdir -p /opt/functions-worker \
    && tar -xzf /tmp/worker.tar.gz -C /opt/functions-worker \
    && rm /tmp/worker.tar.gz

FROM node:24-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
COPY vendor/ ./vendor/
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY src/ ./src/
RUN npm run build

FROM node:24-bookworm-slim AS dependencies

WORKDIR /app
COPY package.json package-lock.json ./
COPY vendor/ ./vendor/
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund

FROM node:24-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        chromium \
        chromium-sandbox \
        fonts-dejavu-core \
        fonts-liberation \
        fonts-noto-color-emoji \
        fonts-noto-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /home/site/wwwroot
COPY --from=worker /opt/functions-worker/ /opt/functions-worker/
COPY --from=dependencies /app/node_modules/ ./node_modules/
COPY --from=build /app/dist/ ./dist/
COPY package.json host.json ./

USER node
ENTRYPOINT ["node", "/opt/functions-worker/dist/src/nodejsWorker.js"]
