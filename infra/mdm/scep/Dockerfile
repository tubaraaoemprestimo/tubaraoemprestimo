# scepserver (micromdm/scep) compilado do código-fonte na tag v2.3.0.
# Multi-arch: o Go compila para a arquitetura do host do build (arm64 na VM Oracle).
ARG SCEP_VERSION=v2.3.0

FROM golang:1.23-alpine AS build
ARG SCEP_VERSION
ENV CGO_ENABLED=0 GOFLAGS=-trimpath
# go install baixa pelo proxy do Go com verificação no checksum DB (sum.golang.org).
RUN go install -ldflags="-s -w" github.com/micromdm/scep/v2/cmd/scepserver@${SCEP_VERSION}

FROM alpine:3.20
# wget (busybox) do alpine é usado pelo healthcheck.
RUN addgroup -S -g 10001 scep \
 && adduser -S -D -H -u 10001 -G scep scep \
 && mkdir -p /depot \
 && chown 10001:10001 /depot
COPY --from=build /go/bin/scepserver /usr/local/bin/scepserver
USER 10001:10001
WORKDIR /depot
VOLUME ["/depot"]
EXPOSE 2016
ENTRYPOINT ["scepserver"]
CMD ["-depot", "/depot", "-port", "2016"]
