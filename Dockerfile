FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Dummy URL for image build only; production uses Fly secrets at runtime.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
RUN npm run prisma:generate
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
ENV NODE_ENV=production
# Prisma client is generated in the build stage; install CLI for Fly release_command migrations.
RUN npm prune --omit=dev \
  && npm install prisma@6.19.3 --no-save
EXPOSE 3000
CMD ["npm", "run", "start"]
