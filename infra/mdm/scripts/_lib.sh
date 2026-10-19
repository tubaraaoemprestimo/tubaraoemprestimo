#!/usr/bin/env bash
# Funções comuns aos scripts do MDM. Uso: source "$(dirname "$0")/_lib.sh"
# Regra: nenhum segredo é impresso nem passado em argumento de processo (ps).

MDM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$MDM_DIR/.env"
NANOHUB_LOCAL="http://127.0.0.1:9004"
SCEP_LOCAL="http://127.0.0.1:2016"

log()  { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }
die()  { printf 'ERRO: %s\n' "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "comando ausente: $1"; }

# Lê KEY do .env sem executar o arquivo (sem source).
env_get() {
  [ -f "$ENV_FILE" ] || return 0
  grep -E "^$1=" "$ENV_FILE" | tail -n1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'
}

# Define KEY=VALUE no .env (substitui a linha ou acrescenta).
env_set() {
  local key="$1" value="$2" tmp
  tmp="$(mktemp "$MDM_DIR/.env.XXXXXX")"
  if grep -qE "^$key=" "$ENV_FILE"; then
    awk -v k="$key" -v v="$value" 'BEGIN{FS=OFS="="} $1==k{print k"="v; next} {print}' "$ENV_FILE" >"$tmp"
  else
    cat "$ENV_FILE" >"$tmp"; printf '%s=%s\n' "$key" "$value" >>"$tmp"
  fi
  chmod 600 "$tmp"; mv "$tmp" "$ENV_FILE"
}

# curl na API do NanoHUB (HTTP Basic "nanohub":API_KEY). A credencial vai por
# arquivo de config via process substitution, nunca na linha de comando.
api_curl() {
  local key; key="$(env_get NANOHUB_API_KEY)"
  [ -n "$key" ] || die "NANOHUB_API_KEY vazio no .env"
  curl -sS --max-time 20 --config <(printf 'user = "nanohub:%s"\n' "$key") "$@"
}

compose() { docker compose --project-directory "$MDM_DIR" -f "$MDM_DIR/docker-compose.yml" "$@"; }
