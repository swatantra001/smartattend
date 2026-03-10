# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY apps/admin-web/package.json ./apps/admin-web/
COPY packages/shared/package.json ./packages/shared/

RUN npm ci --workspace=@smartattend/admin-web \
           --workspace=@smartattend/shared

COPY packages/shared ./packages/shared
COPY apps/admin-web  ./apps/admin-web

ARG VITE_API_URL
ARG VITE_WS_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

RUN npm run build --workspace=@smartattend/shared
RUN npm run build --workspace=@smartattend/admin-web

# Production: Nginx serves the static build
FROM nginx:1.25-alpine AS runner

COPY --from=builder /app/apps/admin-web/dist /usr/share/nginx/html

# SPA routing — all 404s return index.html
RUN echo 'server { \
    listen 80; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { try_files $uri $uri/ /index.html; } \
    location ~* \.(js|css|png|ico|woff2|svg)$ { \
        expires 7d; add_header Cache-Control "public, immutable"; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost/