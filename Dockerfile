# Pörssiohjain - Energy usage optimization platform
# Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
# Licensed under the Pörssiohjain Personal Use License v1.0.
ARG NODE_IMAGE=public.ecr.aws/docker/library/node:22-alpine
ARG NGINX_IMAGE=public.ecr.aws/docker/library/nginx:1.30.2-alpine

# Build static assets natively for both runtime architectures.
FROM --platform=$BUILDPLATFORM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . ./
RUN npm run build

FROM ${NGINX_IMAGE}
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
COPY LICENSE /usr/share/nginx/html/LICENSE
EXPOSE 80
