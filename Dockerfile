FROM node:22.14.0-alpine

WORKDIR /app

# Copy prisma schema first — needed for postinstall (prisma generate)
COPY prisma ./prisma

# Install dependencies (including dev — needed for prisma generate & next build)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node_modules/.bin/next", "start", "-p", "3000", "-H", "0.0.0.0"]
