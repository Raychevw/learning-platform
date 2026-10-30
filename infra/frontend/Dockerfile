# ---------------------------------------------------------------- build stage
FROM node:22-alpine AS build

WORKDIR /app

# Install dependencies (root workspaces include the microservices)
COPY package.json package-lock.json .npmrc ./
COPY services/course-service/package.json ./services/course-service/
COPY services/assignment-service/package.json ./services/assignment-service/
COPY services/api-gateway/package.json ./services/api-gateway/
COPY services/auth-service/package.json ./services/auth-service/
RUN npm ci --no-audit --no-fund

# Build the SPA
COPY index.html vite.config.js eslint.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build

# ---------------------------------------------------------------- runtime stage
FROM nginx:1.27-alpine

COPY infra/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:80/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
