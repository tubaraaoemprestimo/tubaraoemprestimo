# Imagem oficial do NanoHUB (tag fixa) + wget estático só para o healthcheck.
# Motivo: a imagem oficial é distroless (sem shell/curl/wget), então o Docker
# não consegue consultar /version sozinho.
# Atualização: troque NANOHUB_VERSION aqui E nos args/tag do docker-compose.yml.
ARG NANOHUB_VERSION=v0.2.0

FROM busybox:1.36.1-musl AS tools
# Diretório de dados com dono não-root. Fica em /data (fora do VOLUME /app/db
# declarado pela imagem base, cujas alterações no build seriam descartadas).
RUN mkdir -p /out/data

FROM ghcr.io/micromdm/nanohub:${NANOHUB_VERSION}
COPY --from=tools /bin/busybox /bin/wget
COPY --from=tools --chown=10001:10001 /out/data /data
# Mesmo UID do container SCEP: permite ler o ca.pem (modo 0400) do depot.
USER 10001:10001
