# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=4173

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev --include=optional --no-audit --no-fund \
  && npm cache clean --force

COPY dist ./dist
COPY server ./server
COPY public ./public

RUN mkdir -p /app/data \
  && chown -R node:node /app

USER node

EXPOSE 4173
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4173/api/ops/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/docker-entrypoint.mjs"]
