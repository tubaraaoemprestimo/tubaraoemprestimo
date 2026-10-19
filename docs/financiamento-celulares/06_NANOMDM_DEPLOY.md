# 06 — Deploy do NanoHUB (VM Oracle ARM64)

Status: **PENDENTE** (arquivos prontos em `infra/mdm/`; nada foi executado na VM).

## Regras

- **PROIBIDO** bloqueio, Modo Perdido ou apagamento por inadimplência. MDM não lê WhatsApp/fotos/Apple ID. Localização só em Modo Perdido supervisionado de aparelho da empresa.
- A API `/api/` do NanoHUB **nunca** é publicada. Só `/mdm`, `/checkin` e `/scep`.
- Não alterar o nginx/serviços existentes de `app-api.tubaraoemprestimo.com.br`: o MDM usa arquivo e host próprios.

## Componentes

| Serviço | Versão | Porta (só 127.0.0.1) | Dados |
|---|---|---|---|
| NanoHUB | `ghcr.io/micromdm/nanohub:v0.2.0` (+ camada com `wget` para healthcheck) | 9004 | volume `tubarao_mdm_nanohub_db` (storage `file`) |
| SCEP | `micromdm/scep` v2.3.0 (build do fonte) | 2016 | volume `tubarao_mdm_scep_depot` (CA) |

- NanoHUB não suporta PostgreSQL (só `file`, `mysql`, `inmem`). Usamos `file`.
- Sem `-cert-header`: autenticação do aparelho por `Mdm-Signature` (`SignMessage=true` no perfil), compatível com proxy TLS.
- Webhook: `NANOHUB_WEBHOOK_URL` → `http://host.docker.internal:3001/api/admin/mdm/webhook?token=<MDM_WEBHOOK_TOKEN>`.
- HMAC do webhook: o NanoMDM tem `-webhook-hmac-key`; **no NanoHUB v0.2.0 essa flag não aparece** na lista de flags. Verificar a cada versão. Enquanto ausente: webhook só por rede local (host/docker) + token na URL. Cuidado: o token pode aparecer em logs com `-debug`.

## 1. DNS e TLS

1. Criar `mdm.<domínio>` (ex.: `mdm.tubaraoemprestimo.com.br`).
2. TLS **válido e confiável publicamente** (aparelho Apple recusa certificado inválido/autoassinado).
3. Entrada:
   - **Cloudflare Tunnel** (padrão atual da VM): adicionar hostname `mdm.<domínio>` → `http://localhost:80` (nginx) ou direto. Compatibilidade do túnel com o protocolo MDM: **validar em laboratório**, não assumir.
   - Alternativa: DNS A para a VM + porta 443 aberta + Let's Encrypt (certbot), conforme `infra/mdm/nginx/mdm.conf.example`.

## 2. Instalação

```bash
sudo mkdir -p /opt/tubarao-mdm && sudo chown "$USER" /opt/tubarao-mdm
# copiar o conteúdo de infra/mdm/ para /opt/tubarao-mdm (scp/rsync ou git)
cd /opt/tubarao-mdm
bash scripts/bootstrap.sh   # cria .env, segredos, CA SCEP, build e sobe
nano .env                   # ajustar MDM_PUBLIC_HOST
docker compose up -d        # aplicar mudanças do .env
```

O bootstrap é idempotente: não recria a CA nem sobrescreve segredos existentes.

Backend (PM2): adicionar ao `.env` do backend `NANOHUB_URL=http://127.0.0.1:9004`, `NANOHUB_API_KEY`, `MDM_WEBHOOK_TOKEN` e `MDM_PUSH_TOPIC` (= `PUSH_TOPIC`), com os mesmos valores do `.env` do MDM. Reiniciar o `tubarao-backend` em janela de manutenção. Esta alteração é fora do escopo deste pacote.

Docker no host Linux: `host-gateway` aponta para o IP da bridge do Docker. O backend escuta em `0.0.0.0:3001`, então é alcançável; confirmar que o firewall (iptables/ufw da Oracle) não bloqueia bridge → host.

## 3. nginx

```bash
sudo cp nginx/mdm.conf.example /etc/nginx/sites-available/mdm.conf
sudo sed -i 's/mdm.exemplo.com.br/mdm.tubaraoemprestimo.com.br/g' /etc/nginx/sites-available/mdm.conf
sudo ln -s /etc/nginx/sites-available/mdm.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Se o certificado Let's Encrypt ainda não existir, comente o bloco `443`, emita com certbot e reative.

## 4. Certificado APNs

Ver `07_CERTIFICADOS_INSCRICAO.md`. Depois:

```bash
bash scripts/upload-pushcert.sh /caminho/seguro/apns-cert.pem /caminho/seguro/apns-key.pem
shred -u /caminho/seguro/apns-key.pem   # após confirmar o backup
```

## 5. Verificação

```bash
bash scripts/doctor.sh
```

Checa containers, `/version`, SCEP, push cert e validade, API exigindo autenticação, portas só em loopback, `/api/` não publicado, TLS público, disco e CA SCEP. Não imprime segredos. Saída ≠ 0 = falha.

## 6. Atualização (tag fixa)

1. Ler o changelog da nova versão (flags, storage, HMAC do webhook).
2. `bash scripts/backup.sh`.
3. Trocar a versão em **dois** lugares de `docker-compose.yml` (`args.NANOHUB_VERSION` e `image:`) e em `nanohub/Dockerfile`.
4. `docker compose build --pull nanohub && docker compose up -d nanohub`.
5. `bash scripts/doctor.sh` + enviar `DeviceInformation` ao aparelho de laboratório.

Nunca usar `latest`.

## 7. Rollback

1. Voltar as tags/versões anteriores nos arquivos.
2. `docker compose build nanohub && docker compose up -d nanohub`.
3. Se o formato dos dados mudou: restaurar o backup anterior à atualização (item 8).

## 8. Backup e restauração

Backup (`tar` dos dois volumes + `.env`, retenção 14 dias, `chmod 600`):

```bash
bash scripts/backup.sh                    # quente
BACKUP_STOP=1 bash scripts/backup.sh      # consistente (para o nanohub por segundos)
# cron: 30 3 * * * BACKUP_STOP=1 bash /opt/tubarao-mdm/scripts/backup.sh >>/var/log/tubarao-mdm-backup.log 2>&1
```

O backup contém a chave da CA, a chave APNs e os segredos. Copiar para fora da VM (bucket privado, criptografado). **Sem backup da CA e da chave APNs, todos os aparelhos precisam ser reinscritos.**

Restauração:

```bash
cd /opt/tubarao-mdm
docker compose down
sha256sum -c /var/backups/tubarao-mdm/mdm-AAAAMMDD-HHMMSS.tar.gz.sha256
mkdir -p /tmp/mdm-restore && tar -xzf /var/backups/tubarao-mdm/mdm-AAAAMMDD-HHMMSS.tar.gz -C /tmp/mdm-restore
for v in nanohub_db scep_depot; do
  docker volume create tubarao_mdm_$v
  docker run --rm -v tubarao_mdm_$v:/dst -v /tmp/mdm-restore/$v:/src:ro alpine:3.20 \
    sh -c 'rm -rf /dst/* && cp -a /src/. /dst/'
done
install -m 600 /tmp/mdm-restore/env/.env .env
rm -rf /tmp/mdm-restore
docker compose up -d && bash scripts/doctor.sh
```

Testar a restauração em laboratório antes de depender dela.

## 9. Alerta de expiração do APNs

O certificado APNs vale 1 ano. Expirado, **nenhum** aparelho recebe comandos. `doctor.sh` avisa com 30 dias de antecedência (`WARN_DAYS`).

```cron
0 8 * * * bash /opt/tubarao-mdm/scripts/doctor.sh >/tmp/mdm-doctor.log 2>&1 || <comando de notificação: e-mail/WhatsApp do admin>
```

Registrar também a data na agenda da empresa (responsável + Apple ID usado).

## Pendências

- [ ] Confirmar que a imagem `ghcr.io/micromdm/nanohub:v0.2.0` tem variante `linux/arm64`
- [ ] Criar DNS `mdm.<domínio>` e TLS
- [ ] Validar Cloudflare Tunnel com MDM em laboratório
- [ ] Rota `/api/admin/mdm/webhook` no backend publicada e testada
- [ ] Cópia externa dos backups
- [ ] Teste de restauração
