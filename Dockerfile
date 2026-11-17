# syntax=docker/dockerfile:1
# Imagen de la aplicación (Next.js) con Whisper incluido para el micrófono.
# La voz se sirve desde el contenedor Kokoro-FastAPI definido en compose.yaml.

ARG NODE_VERSION=22

# --- Dependencias y compilación -------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci

# La lección se inyecta al compilar: cambiarla exige reconstruir la imagen.
ARG LESSON_FILE=lessons/nube-nist.md
ENV LESSON_FILE=${LESSON_FILE}

COPY . .
RUN npm run build \
 && rm -rf .next/cache

# Descarga Whisper (~78 MB) a .cache/whisper; necesita tsx, así que va antes de podar.
RUN npm run voice:prepare \
 && npm prune --omit=dev \
 && npm cache clean --force

# --- Imagen final -----------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

ARG LESSON_FILE=lessons/nube-nist.md
ENV LESSON_FILE=${LESSON_FILE}

COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/.cache ./.cache
# next start vuelve a evaluar next.config.ts, que lee la lección con lib/.
COPY --chown=node:node package.json next.config.ts tsconfig.json ./
COPY --chown=node:node public ./public
COPY --chown=node:node lessons ./lessons
COPY --chown=node:node lib ./lib

USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/tutor').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node_modules/.bin/next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
