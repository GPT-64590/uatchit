# syntax=docker/dockerfile:1
# Single image used for three roles: migrate, web, and cron (different commands).

# ---- build ----
FROM node:20-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Workspace manifests first — keeps `npm ci` layer cached across source changes.
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/extension/package.json apps/extension/package.json
RUN npm ci

# Source
COPY tsconfig.base.json next-auth.d.ts ./
COPY apps/web apps/web
COPY scripts scripts

# NEXT_PUBLIC_* are inlined into the client bundle at build time, so they must
# be supplied here (real values for prod). Server secrets are injected at runtime.
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_MARKETING_URL=http://localhost:3000
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_MARKETING_URL=$NEXT_PUBLIC_MARKETING_URL

# Placeholder server env so import-time Zod validation passes during the build.
# These never reach the runtime stage — real values come from compose env_file.
ENV DATABASE_URL=postgres://build:build@localhost:5432/build \
    AUTH_SECRET=build_time_placeholder_secret_0123456789 \
    AUTH_RESEND_KEY=re_build_placeholder \
    RESEND_API_KEY=re_build_placeholder \
    EMAIL_FROM=build@example.com \
    AIMLAPI_KEY=build_time_placeholder_key_0123456789 \
    BRIGHTDATA_API_KEY=build_time_placeholder_key_0123456789 \
    CRON_SECRET=build_time_placeholder_secret_0123456789
RUN npm run build -w apps/web

# ---- runtime ----
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY --from=build /app .
USER node
EXPOSE 3000
# Default role: web. Overridden by compose for the migrate and cron services.
CMD ["npm", "run", "start", "-w", "apps/web", "--", "-H", "0.0.0.0"]
