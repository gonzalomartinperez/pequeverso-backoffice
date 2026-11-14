# syntax=docker/dockerfile:1@sha256:4edf897a3ffa55b89f906fc8cc78afdb3f1834cc9c7083565e611a8a7d5fe99e
# Production image for the Pequeverso assistant backoffice (docs/deployment-contract.md).
# One image, two commands: `node server.js` (default) and `node scripts/db-migrate.ts` (one-shot
# migrations, run by the operator before starting a release that needs them).
# Base pinned by digest (node 24.22.0, Debian trixie slim, linux/amd64 verified).
FROM node:24.22.0-trixie-slim@sha256:a6155384446670e9719bdc4fd0ebe4d4b29fb32a8d6aa523da3547a6cfbcf22c AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
# No dependency needs an install script (verified in package-lock.json); never run them.
RUN --mount=type=cache,target=/root/.npm,sharing=locked npm ci --ignore-scripts --no-audit --no-fund
COPY next.config.ts next-env.d.ts tsconfig.json postcss.config.json ./
COPY src ./src
COPY public ./public
# Reproducible timestamps: docker-bake.hcl passes the commit time (BuildKit also rewrites layer times).
ARG SOURCE_DATE_EPOCH
# `next build` type-checks with the project-local TypeScript 7 CLI; tests are excluded from the image.
RUN npx next build --webpack

FROM gcr.io/distroless/nodejs24-debian13:nonroot@sha256:cb606325b7ec4af55462cb0b424a53b452a5b4a894ffe841fcf1048d216fb9f8 AS runtime
# Not secret (provenance records build args). ARGs do not cross stages, so both are declared here.
ARG SERVICE_REVISION=unknown
ARG VERSION=0.0.0-dev
LABEL org.opencontainers.image.title="pequeverso-backoffice" \
      org.opencontainers.image.source="https://github.com/gonzalomartinperez/pequeverso-backoffice" \
      org.opencontainers.image.description="Pequeverso private backoffice (access and assistant operations)" \
      org.opencontainers.image.documentation="https://github.com/gonzalomartinperez/pequeverso-backoffice/tree/main/docs" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${SERVICE_REVISION}"
WORKDIR /app
ENV PATH=/nodejs/bin:/usr/local/bin:/usr/bin:/bin
ENV NODE_ENV=production BACKOFFICE_ENVIRONMENT=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
ENV SERVICE_REVISION=${SERVICE_REVISION} VERSION=${VERSION}
COPY --chown=65532:65532 LICENSE NOTICE.md THIRD_PARTY_NOTICES.md ./
COPY --from=build --chown=65532:65532 /app/.next/standalone ./
COPY --from=build --chown=65532:65532 /app/.next/static ./.next/static
COPY --from=build --chown=65532:65532 /app/public ./public
# Migrations: the runner needs only Node and `pg` (already traced into the standalone output).
COPY --chown=65532:65532 migrations ./migrations
COPY --chown=65532:65532 scripts/db-migrate.ts ./scripts/db-migrate.ts
USER 65532:65532
ENTRYPOINT []
EXPOSE 3000
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/healthz',{signal:AbortSignal.timeout(2000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "server.js"]
