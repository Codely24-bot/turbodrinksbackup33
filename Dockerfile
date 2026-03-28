FROM node:20-bookworm-slim AS build

WORKDIR /app

ARG VITE_WHATSAPP_BOT_URL=""
ENV VITE_WHATSAPP_BOT_URL=${VITE_WHATSAPP_BOT_URL}

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build

FROM caddy:2.8-alpine

COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv

EXPOSE 8080
