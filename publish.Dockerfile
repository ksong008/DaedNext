# ATTENTION This part below is for publishing purpose only

ARG DAED_VERSION

FROM rust:1-bookworm AS build

RUN \
    apt-get update && apt-get install -y ca-certificates cmake git make perl pkg-config llvm-15 clang-15 && \
    ln -sf /usr/bin/clang-15 /usr/bin/clang && \
    ln -sf /usr/bin/llvm-strip-15 /usr/bin/llvm-strip && \
    apt-get clean autoclean && apt-get autoremove -y && rm -rf /var/lib/{apt,dpkg,cache,log}/
RUN rustup toolchain install nightly --profile minimal --component rust-src
RUN cargo install bpf-linker --version 0.10.3 --locked

ARG DAED_VERSION

WORKDIR /build

COPY . .

RUN rm -rf dist && cp -r apps/web/dist dist && \
    DAED_SKIP_WEB_BUILD=1 RUST_WORKSPACE=/build/DaeNext make APPNAME=daed VERSION=$DAED_VERSION OUTPUT=/build/daed daed-rust-native


FROM debian:bookworm-slim AS prod

LABEL org.opencontainers.image.source=https://github.com/ksong008/DaedNext

RUN apt-get update; apt-get install -y ca-certificates wget; \
    apt-get clean autoclean && apt-get autoremove -y && rm -rf /var/lib/{apt,dpkg,cache,log}/
RUN mkdir -p /usr/share/daed/web
RUN mkdir -p /etc/daed/
RUN wget -O /usr/share/daed/geoip.dat https://github.com/v2rayA/dist-v2ray-rules-dat/raw/master/geoip.dat; \
    wget -O /usr/share/daed/geosite.dat https://github.com/v2rayA/dist-v2ray-rules-dat/raw/master/geosite.dat
COPY --from=build /build/daed /usr/bin/daed
COPY --from=build /build/dist /usr/share/daed/web
COPY install/docker-entrypoint.sh /usr/local/bin/daed-docker-entrypoint
RUN chmod +x /usr/bin/daed /usr/local/bin/daed-docker-entrypoint

EXPOSE 2023

ENTRYPOINT ["/usr/local/bin/daed-docker-entrypoint"]
