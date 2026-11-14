# Pequeverso IAM database artifact only; infrastructure is owned by vps-ops.
# Official PostgreSQL 18.6 minor release, linux/amd64 manifest verified 2026-10-12.
FROM postgres:18.6-trixie@sha256:74935e72241653ca55e0414067e6d8763aceb8a810eb51b452253ec3dcfc4336
USER root
# Signed Debian security packages; never disable repository/signature validation.
RUN apt-get -o Acquire::Retries=2 -o Acquire::http::Timeout=30 update \
    && apt-get install -y --no-install-recommends \
        liblzma5=5.8.1-1+deb13u2 xz-utils=5.8.1-1+deb13u2 \
        libpcre2-8-0=10.46-1~deb13u3 \
        libperl5.40=5.40.1-6+deb13u1 perl=5.40.1-6+deb13u1 \
        perl-base=5.40.1-6+deb13u1 perl-modules-5.40=5.40.1-6+deb13u1 \
        libssl3t64=3.5.7-1~deb13u3 openssl=3.5.7-1~deb13u3 \
        tzdata=2026c-0+deb13u1 \
        apt=3.0.4 libapt-pkg7.0=3.0.4 \
        zlib1g=1:1.3.dfsg+really1.3.1-1+deb13u1 \
    && rm -rf /var/lib/apt/lists/* /usr/local/bin/gosu \
    && test "$(id -u postgres)" = 999 \
    && test "$(id -g postgres)" = 999
# Purge unused GPG only; Trixie util-linux requires liblastlog2-2 -> libsqlite3-0.
# Do not force a dependency removal or disable PostgreSQL XML support to hide CVE findings.
RUN apt-get purge -y gpg \
    && command -v sqv \
    && psql --version && pg_dump --version && pg_restore --version && pgbench --version
# The unchanged official entrypoint only uses gosu when uid=0. Root startup is unsupported;
# initialize a NEW volume's ownership separately, then always execute as postgres.
USER 999:999
# Readiness over TCP: during first-start init the temporary server listens on the socket only, so a
# socket probe would report healthy too early. The variables are the official image's, defaults included.
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
  CMD ["sh", "-c", "pg_isready -q -h 127.0.0.1 -U \"${POSTGRES_USER:-postgres}\" -d \"${POSTGRES_DB:-${POSTGRES_USER:-postgres}}\""]
ARG SERVICE_REVISION=unknown
ARG VERSION=0.0.0-dev
LABEL org.opencontainers.image.title="pequeverso-backoffice-postgres" \
      org.opencontainers.image.source="https://github.com/gonzalomartinperez/pequeverso-backoffice" \
      org.opencontainers.image.description="PostgreSQL 18 IAM database artifact for the Pequeverso backoffice (CI and restore drills)" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${SERVICE_REVISION}"
