FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=postgresql://taskforge:taskforge@localhost:5432/taskforge?schema=public
ENV NEXT_PUBLIC_APP_URL=http://localhost:3000
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
RUN DATABASE_URL=postgresql://taskforge:taskforge@localhost:5432/taskforge?schema=public npx prisma generate
COPY --from=builder /app/src ./src
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY docker/entrypoint.sh ./docker/entrypoint.sh

RUN chmod +x ./docker/entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["./docker/entrypoint.sh"]
CMD ["npm", "run", "start"]
