FROM node:22.13-alpine AS build
WORKDIR /app

ARG VITE_API_BASE_URL=https://API_BASE_URL
ARG VITE_API_V1_BASE_URL=https://API_V1_BASE_URL
ARG VITE_COMPATIBILITY_API_BASE_URL=https://COMPATIBILITY_API_BASE_URL
ARG VITE_ADMIN_APP_URL=https://ADMIN_APP_URL
ARG VITE_STRIPE_PUBLISHABLE_KEY=
ARG VITE_TEST_USERNAME_ENABLED=false
ARG VITE_TEST_USERNAME=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_API_V1_BASE_URL=$VITE_API_V1_BASE_URL
ENV VITE_COMPATIBILITY_API_BASE_URL=$VITE_COMPATIBILITY_API_BASE_URL
ENV VITE_ADMIN_APP_URL=$VITE_ADMIN_APP_URL
ENV VITE_STRIPE_PUBLISHABLE_KEY=$VITE_STRIPE_PUBLISHABLE_KEY
ENV VITE_TEST_USERNAME_ENABLED=$VITE_TEST_USERNAME_ENABLED
ENV VITE_TEST_USERNAME=$VITE_TEST_USERNAME

COPY package.json package-lock.json ./
COPY apps/client/package.json apps/client/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN npm ci
COPY apps/client apps/client
COPY packages/ui packages/ui
RUN npm run build --workspace @wrg/platform-client-web

FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/client/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
