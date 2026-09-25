FROM node:22.13-alpine AS build
WORKDIR /app

ARG VITE_API_BASE_URL=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY package.json package-lock.json ./
COPY apps/client/package.json apps/client/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY deploy deploy
RUN node deploy/render-nginx-config.mjs --app admin --template deploy/nginx.conf.template --output /tmp/nginx.conf
RUN npm ci
COPY apps/admin apps/admin
COPY packages/ui packages/ui
RUN npm run build --workspace @wrg/platform-admin-web

FROM nginx:1.27-alpine
COPY deploy/security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build /tmp/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/admin/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
