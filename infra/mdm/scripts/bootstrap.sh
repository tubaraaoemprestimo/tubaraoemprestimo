#!/usr/bin/env bash
# Prepara e sobe NanoHUB + SCEP. Idempotente: pode rodar várias vezes.
# - cria .env a partir do .env.example (chmod 600), se não existir;
# - gera segredos aleatórios apenas para variáveis vazias;
# - cria a CA do SCEP apenas se ainda não existir;
# - builda e sobe o compose e espera /version responder.
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

need docker; need openssl; need curl
docker compose version >/dev/null 2>&1 || die "plugin docker compose ausente"

umask 077
if [ ! -f "$ENV_FILE" ]; then
  cp "$MDM_DIR/.env.example" "$ENV_FILE"
  log ".env criado a partir do .env.example"
fi
chmod 600 "$ENV_FILE"

for k in NANOHUB_API_KEY SCEP_CHALLENGE MDM_WEBHOOK_TOKEN; do
  if [ -z "$(env_get "$k")" ]; then
    env_set "$k" "$(openssl rand -hex 32)"
    log "$k gerado (valor não exibido; consulte o .env)"
  fi
done

host="$(env_get MDM_PUBLIC_HOST)"
case "$host" in
  ""|*exemplo*) log "AVISO: MDM_PUBLIC_HOST ainda é placeholder; ajuste antes de gerar o perfil." ;;
esac

log "Build das imagens (tags fixas)"
compose build --pull

# CA do SCEP: só cria se não houver ca.pem no depot.
in_scep() { compose run --rm --no-deps -T --entrypoint sh scep -c "$1"; }
if in_scep 'test -f /depot/ca.pem'; then
  log "CA SCEP já existe; mantida"
elif in_scep 'test -f /depot/ca.key'; then
  die "depot com ca.key e sem ca.pem (init interrompido?). Restaure o backup ou limpe o volume manualmente após análise."
else
  log "Criando CA SCEP (RSA 4096, 10 anos)"
  compose run --rm --no-deps -T scep ca -init -depot /depot \
    -common_name "Tubarao Emprestimos MDM SCEP CA" \
    -organization "Tubarao Emprestimos" -country BR
fi

log "Subindo serviços"
compose up -d

for i in $(seq 1 30); do
  if curl -fsS --max-time 3 "$NANOHUB_LOCAL/version" >/dev/null 2>&1; then
    log "NanoHUB respondendo: $(curl -fsS --max-time 3 "$NANOHUB_LOCAL/version")"
    break
  fi
  [ "$i" -eq 30 ] && die "NanoHUB não respondeu em $NANOHUB_LOCAL/version. Veja: docker compose logs nanohub"
  sleep 2
done

cat <<EOF

Próximos passos (docs/financiamento-celulares/06_NANOMDM_DEPLOY.md):
  1. Copiar NANOHUB_API_KEY e MDM_WEBHOOK_TOKEN do .env para o .env do backend.
  2. Configurar nginx (nginx/mdm.conf.example) e DNS de $host.
  3. Enviar o certificado APNs: bash scripts/upload-pushcert.sh cert.pem key.pem
  4. Verificar: bash scripts/doctor.sh
EOF
