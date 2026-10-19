#!/usr/bin/env bash
# Envia o certificado APNs MDM (PEM) + chave privada (PEM, sem senha) ao NanoHUB.
# Uso: bash scripts/upload-pushcert.sh <cert-apns.pem> <chave-privada.pem>
# Grava o topic retornado em PUSH_TOPIC no .env (topic não é segredo).
# Renovação anual: rode de novo com o certificado renovado (mesmo topic).
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

[ $# -eq 2 ] || die "uso: $0 <cert-apns.pem> <chave-privada.pem>"
cert="$1"; key="$2"
need curl; need openssl
[ -r "$cert" ] || die "certificado não legível: $cert"
[ -r "$key" ]  || die "chave não legível: $key"

openssl x509 -in "$cert" -noout >/dev/null 2>&1 || die "certificado não é PEM X.509 válido"
openssl pkey -in "$key" -passin pass: -noout >/dev/null 2>&1 \
  || die "chave inválida ou protegida por senha (NanoHUB exige chave sem senha)"

cert_pub="$(openssl x509 -in "$cert" -noout -pubkey | openssl sha256)"
key_pub="$(openssl pkey -in "$key" -passin pass: -pubout | openssl sha256)"
[ "$cert_pub" = "$key_pub" ] || die "chave privada não corresponde ao certificado"

openssl x509 -in "$cert" -noout -checkend 0 >/dev/null || die "certificado já expirado"
log "Certificado: $(openssl x509 -in "$cert" -noout -subject -enddate | tr '\n' ' ')"

resp="$(cat "$cert" "$key" | api_curl -f -X PUT --data-binary @- "$NANOHUB_LOCAL/api/v1/nanomdm/pushcert")" \
  || die "falha no PUT /api/v1/nanomdm/pushcert"
topic="$(printf '%s' "$resp" | sed -n 's/.*"topic"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
[ -n "$topic" ] || die "resposta sem topic: $resp"

old="$(env_get PUSH_TOPIC)"
if [ -n "$old" ] && [ "$old" != "$topic" ]; then
  log "AVISO: topic mudou ($old -> $topic). Aparelhos inscritos no topic antigo NÃO recebem push; renove sempre com o mesmo Apple ID."
fi
env_set PUSH_TOPIC "$topic"
log "Push cert carregado. Topic: $topic"

log "Conferência: $(api_curl -f "$NANOHUB_LOCAL/api/v1/nanomdm/pushcert?topic=$topic")"
