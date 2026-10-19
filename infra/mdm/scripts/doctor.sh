#!/usr/bin/env bash
# Diagnóstico do MDM. Não imprime segredos. Saída 0 = tudo OK; 1 = há falhas.
# Checa: containers, /version, SCEP, push cert e validade, portas (só 127.0.0.1),
# exposição pública (só /mdm, /checkin, /scep), disco e CA SCEP.
# Cron sugerido (alerta diário): 0 8 * * * bash /opt/tubarao-mdm/scripts/doctor.sh || <notificar>
set -uo pipefail
source "$(dirname "$0")/_lib.sh"

WARN_DAYS="${WARN_DAYS:-30}"   # alerta de expiração do cert APNs
DISK_MAX_PCT="${DISK_MAX_PCT:-85}"
fails=0; warns=0
ok()   { printf '  [OK]    %s\n' "$*"; }
warn() { printf '  [AVISO] %s\n' "$*"; warns=$((warns+1)); }
bad()  { printf '  [FALHA] %s\n' "$*"; fails=$((fails+1)); }

echo "== Arquivos"
if [ -f "$ENV_FILE" ]; then
  perm="$(stat -c %a "$ENV_FILE" 2>/dev/null || echo '?')"
  [ "$perm" = "600" ] && ok ".env presente (600)" || warn ".env com permissão $perm (use chmod 600)"
  for k in NANOHUB_API_KEY SCEP_CHALLENGE MDM_WEBHOOK_TOKEN MDM_PUBLIC_HOST; do
    [ -n "$(env_get "$k")" ] && ok "$k definido" || bad "$k vazio"
  done
else
  bad ".env ausente (rode scripts/bootstrap.sh)"
fi

echo "== Containers"
for s in nanohub scep; do
  st="$(compose ps --format '{{.Service}} {{.State}} {{.Health}}' 2>/dev/null | awk -v s="$s" '$1==s{print $2" "$3}')"
  case "$st" in
    "running healthy") ok "$s: $st" ;;
    "") bad "$s: não encontrado" ;;
    *) bad "$s: $st" ;;
  esac
done

echo "== Endpoints locais"
if v="$(curl -fsS --max-time 5 "$NANOHUB_LOCAL/version" 2>/dev/null)"; then ok "/version: $v"; else bad "/version sem resposta"; fi
if curl -fsS --max-time 5 "$SCEP_LOCAL/scep?operation=GetCACaps" >/dev/null 2>&1; then ok "SCEP GetCACaps"; else bad "SCEP sem resposta"; fi
code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$NANOHUB_LOCAL/api/v1/nanomdm/pushcert?topic=x")"
[ "$code" = "401" ] && ok "API exige autenticação (401 sem credencial)" || bad "API sem credencial retornou $code (esperado 401)"

echo "== Push cert (APNs)"
topic="$(env_get PUSH_TOPIC)"
if [ -z "$topic" ]; then
  warn "PUSH_TOPIC vazio (rode scripts/upload-pushcert.sh)"
elif [ -n "$(env_get NANOHUB_API_KEY)" ]; then
  resp="$(api_curl -f "$NANOHUB_LOCAL/api/v1/nanomdm/pushcert?topic=$topic" 2>/dev/null)" || resp=""
  na="$(printf '%s' "$resp" | sed -n 's/.*"not_after"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
  if [ -z "$na" ]; then
    bad "push cert do topic $topic não encontrado na API"
  else
    days=$(( ( $(date -d "$na" +%s) - $(date +%s) ) / 86400 ))
    if [ "$days" -lt 0 ]; then bad "push cert EXPIRADO em $na (aparelhos não recebem comandos)"
    elif [ "$days" -lt "$WARN_DAYS" ]; then warn "push cert expira em $days dias ($na): renove no identity.apple.com com o MESMO Apple ID"
    else ok "push cert válido até $na ($days dias), topic $topic"; fi
  fi
fi

echo "== CA SCEP"
if pem="$(docker run --rm --network none -v tubarao_mdm_scep_depot:/d:ro alpine:3.20 cat /d/ca.pem 2>/dev/null)" && [ -n "$pem" ]; then
  end="$(printf '%s\n' "$pem" | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)"
  if printf '%s\n' "$pem" | openssl x509 -noout -checkend $((365*86400)) >/dev/null 2>&1; then ok "CA SCEP válida até $end"
  else warn "CA SCEP expira em menos de 1 ano ($end)"; fi
else
  bad "CA SCEP não encontrada no volume tubarao_mdm_scep_depot"
fi

echo "== Portas (devem escutar só em 127.0.0.1)"
for p in 9004 2016; do
  binds="$(ss -Hltn "sport = :$p" 2>/dev/null | awk '{print $4}' | sort -u | tr '\n' ' ')"
  if [ -z "$binds" ]; then bad "porta $p não está escutando"
  elif printf '%s' "$binds" | grep -qvE '^(127\.0\.0\.1:[0-9]+ ?)+$'; then bad "porta $p exposta além do loopback: $binds"
  else ok "porta $p: $binds"; fi
done

echo "== Exposição pública"
host="$(env_get MDM_PUBLIC_HOST)"
if [ -n "$host" ] && ! printf '%s' "$host" | grep -q exemplo; then
  # TLS precisa ser válido (curl sem -k): aparelho Apple recusa certificado inválido.
  c="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "https://$host/scep?operation=GetCACaps")"
  [ "$c" = "200" ] && ok "https://$host/scep: 200 (TLS válido)" || bad "https://$host/scep: $c (DNS/TLS/nginx?)"
  for path in /api/v1/nanomdm/pushcert /api/v1/nanocmd/ /api/v1/ddm/ /version; do
    c="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "https://$host$path")"
    case "$c" in 404|403) ok "$path NÃO publicado ($c)" ;; 000) warn "$path sem resposta" ;;
      *) bad "$path acessível publicamente ($c) — corrija o nginx JÁ" ;; esac
  done
else
  warn "MDM_PUBLIC_HOST não configurado; checagem pública ignorada"
fi

echo "== Disco"
for path in /var/lib/docker /; do
  [ -d "$path" ] || continue
  pct="$(df -P "$path" | awk 'NR==2{gsub("%","",$5); print $5}')"
  [ "$pct" -lt "$DISK_MAX_PCT" ] && ok "$path: ${pct}% usado" || warn "$path: ${pct}% usado (limite ${DISK_MAX_PCT}%)"
done

echo
echo "Resultado: $fails falha(s), $warns aviso(s)"
[ "$fails" -eq 0 ]
