#!/usr/bin/env bash
# Backup dos volumes do MDM (dados NanoHUB + depot/CA SCEP) e do .env.
# Saída: $BACKUP_DIR/mdm-AAAAMMDD-HHMMSS.tar.gz (+ .sha256). Retenção: 14 dias.
# O arquivo contém a chave da CA, a chave APNs e os segredos: trate como sigiloso
# e copie para fora da VM (ex.: bucket R2 privado) — pendência operacional.
# BACKUP_STOP=1 para o nanohub durante a cópia (cópia consistente; breve indisponibilidade).
# Cron sugerido: 30 3 * * * bash /opt/tubarao-mdm/scripts/backup.sh >>/var/log/tubarao-mdm-backup.log 2>&1
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

need docker
BACKUP_DIR="${BACKUP_DIR:-$(env_get BACKUP_DIR)}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/tubarao-mdm}"
RETENTION_DAYS=14
ts="$(date +%Y%m%d-%H%M%S)"
out="mdm-$ts.tar.gz"

umask 077
mkdir -p "$BACKUP_DIR"; chmod 700 "$BACKUP_DIR"

for v in tubarao_mdm_nanohub_db tubarao_mdm_scep_depot; do
  docker volume inspect "$v" >/dev/null 2>&1 || die "volume ausente: $v"
done

if [ "${BACKUP_STOP:-0}" = "1" ]; then
  trap 'compose start nanohub >/dev/null' EXIT
  compose stop nanohub >/dev/null
  log "nanohub parado para cópia consistente"
fi

env_mount=()
[ -f "$ENV_FILE" ] && env_mount=(-v "$ENV_FILE:/src/env/.env:ro")

docker run --rm --network none \
  -v tubarao_mdm_nanohub_db:/src/nanohub_db:ro \
  -v tubarao_mdm_scep_depot:/src/scep_depot:ro \
  "${env_mount[@]}" \
  -v "$BACKUP_DIR:/out" \
  alpine:3.20 sh -c "tar --numeric-owner -czf /out/$out -C /src . && chmod 600 /out/$out"

( cd "$BACKUP_DIR" && sha256sum "$out" >"$out.sha256" && chmod 600 "$out.sha256" )
log "Backup: $BACKUP_DIR/$out ($(du -h "$BACKUP_DIR/$out" | cut -f1))"

find "$BACKUP_DIR" -maxdepth 1 -type f -name 'mdm-*.tar.gz*' -mtime +"$RETENTION_DAYS" -print -delete \
  | sed 's/^/removido (retenção): /'
