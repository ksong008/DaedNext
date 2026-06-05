FROM node:alpine AS build-web

WORKDIR /build

COPY . .

RUN corepack enable
RUN corepack prepare pnpm@latest --activate
RUN pnpm install
RUN pnpm build


FROM rust:1-bookworm AS build-daed

RUN \
    apt-get update; apt-get install -y ca-certificates cmake git make perl pkg-config llvm-15 clang-15; \
    ln -sf /usr/bin/clang-15 /usr/bin/clang; \
    ln -sf /usr/bin/llvm-strip-15 /usr/bin/llvm-strip; \
    apt-get clean autoclean && apt-get autoremove -y && rm -rf /var/lib/{apt,dpkg,cache,log}/
RUN rustup toolchain install nightly --profile minimal --component rust-src
RUN cargo install bpf-linker --version 0.10.3 --locked

ARG DAED_VERSION=self-build

WORKDIR /build

COPY . .
COPY --from=build-web /build/apps/web/dist /build/dist

RUN DAED_SKIP_WEB_BUILD=1 make APPNAME=daed VERSION=$DAED_VERSION OUTPUT=/build/daed daed-rust-native


FROM debian:bookworm-slim

LABEL org.opencontainers.image.source=https://github.com/daeuniverse/daed

RUN apt-get update; apt-get install -y ca-certificates wget; \
    apt-get clean autoclean && apt-get autoremove -y && rm -rf /var/lib/{apt,dpkg,cache,log}/
RUN mkdir -p /usr/share/daed/web
RUN mkdir -p /etc/daed/
RUN wget -O /usr/share/daed/geoip.dat https://github.com/v2rayA/dist-v2ray-rules-dat/raw/master/geoip.dat; \
    wget -O /usr/share/daed/geosite.dat https://github.com/v2rayA/dist-v2ray-rules-dat/raw/master/geosite.dat
COPY --from=build-daed /build/daed /usr/bin/daed
COPY --from=build-web /build/apps/web/dist /usr/share/daed/web
COPY install/docker-entrypoint.sh /usr/local/bin/daed-docker-entrypoint
RUN chmod +x /usr/bin/daed /usr/local/bin/daed-docker-entrypoint

EXPOSE 2023

ENTRYPOINT ["/usr/local/bin/daed-docker-entrypoint"]
