# ---------------------------------------------------------------- build stage
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---------------------------------------------------------------- runtime stage
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/dist ./dist
RUN addgroup -S nodejs && adduser -S nestjs -G nodejs && chown -R nestjs:nodejs /app
USER nestjs
EXPOSE 3001
CMD ["node", "dist/main.js"]
