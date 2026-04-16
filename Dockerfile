# Stage 1: install all deps and build
FROM node:22.14.0-alpine AS builder

WORKDIR /app

COPY prisma ./prisma
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: production image with only what's needed to run
FROM node:22.14.0-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy production node_modules
COPY --from=builder /app/node_modules ./node_modules

# Copy Next.js build output
COPY --from=builder /app/.next ./.next

# Copy generated Prisma client
COPY --from=builder /app/src/generated ./src/generated

# Copy runtime config files
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs

EXPOSE 3000

CMD ["node_modules/.bin/next", "start", "-p", "3000", "-H", "0.0.0.0"]
