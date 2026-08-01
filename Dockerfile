FROM node:22.13-alpine AS build
WORKDIR /app
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_ENABLE_LEGACY_API=false
ARG VITE_LEGACY_API_BASE_URL=/
ARG VITE_USE_API_FIXTURES=false
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_ENABLE_LEGACY_API=$VITE_ENABLE_LEGACY_API
ENV VITE_LEGACY_API_BASE_URL=$VITE_LEGACY_API_BASE_URL
ENV VITE_USE_API_FIXTURES=$VITE_USE_API_FIXTURES
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
