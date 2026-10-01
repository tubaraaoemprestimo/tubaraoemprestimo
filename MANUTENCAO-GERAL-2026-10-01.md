# 📋 Histórico de Manutenção e Arquitetura - Tubarão Empréstimos

**Data da Manutenção Principal:** 01/10/2026  
**Status do Sistema:** ✅ PRODUÇÃO ESTÁVEL - NENHUM SERVIÇO FORA DO AR

---

## 1. 🏗️ Nova Infraestrutura (Migração de VM)

O sistema foi migrado com sucesso de uma instância saturada de 1GB RAM para uma instância de alta performance de 12GB RAM, eliminando o gargalo crônico de memória e swap.

### VM de Produção Atual (`tubarao-v2`)
- **Provedor:** Oracle Cloud Infrastructure (OCI) - Região `sa-saopaulo-1` (São Paulo)
- **Shape:** `VM.Standard.A1.Flex` (Arquitetura ARM64 Ampere)
- **Recursos:** **2 OCPUs / 12 GB de Memória RAM / 100 GB SSD NVMe**
- **Sistema Operacional:** Ubuntu 24.04 LTS (Kernel aarch64)
- **IP Privado:** `10.0.0.203`
- **IP Público:** `150.230.226.76`
- **Uso de RAM Médio:** ~1.6 GB de 12 GB (**10.4 GB livres**, 0 MB de Swap)
- **Status da VM Antiga (`tubarao` 1GB):** **STOPPED (Desligada com segurança)** no console da Oracle. Todos os dados permanecem preservados nela para rollback se necessário.

---

## 2. 🔑 Acesso Remoto e Redes (Bypass de Bloqueio Corporativo)

A rede corporativa bloqueia conexões de saída diretas (portas 22, 80, etc.). O acesso foi restabelecido através de **Cloudflare Zero Trust Tunnels**, passando pela porta HTTPS 443 liberada:

### Túneis Cloudflare Ativos
1. **Túnel SSH (`tubarao-ssh`):**
   - Rota: `ssh.tubaraoemprestimo.com.br` -> `localhost:22`
   - Permite conectar via SSH a partir de qualquer rede usando `cloudflared access ssh`.
   - Configuração local em `~/.ssh/config`:
     ```ssh
     Host tubarao-vm
         HostName ssh.tubaraoemprestimo.com.br
         User ubuntu
         IdentityFile "J:\AREA DE TRABALHO\Projetos\TUBARÃO EMPRÉSTIMOS LTDA\ssh-key-2026-02-12.key"
         ProxyCommand cloudflared access ssh --hostname %h
     ```
2. **Túnel de Aplicações (`cloudflared-legacy`):**
   - `app-api.tubaraoemprestimo.com.br` -> `localhost:3001` (Backend Node.js)
   - `api.tubaraoemprestimo.com.br` -> `localhost:8080` (Evolution API WhatsApp)

### Acesso ao Site da Empresa (`www.tubaraoemprestimo.com.br`)
Caso a rede da empresa bloqueie o acesso web ao domínio, foi configurado um proxy SOCKS5 local via SSH:
- **Porta Local:** `127.0.0.1:1080`
- Comando para abrir navegador passando pelo túnel:
  ```bash
  chrome.exe --proxy-server="socks5://127.0.0.1:1080" https://www.tubaraoemprestimo.com.br
  ```

---

## 3. 💳 Integração de Pagamentos: InfinitePay (Checkout Integrado)

O sistema de cobrança foi 100% automatizado, substituindo o envio manual de comprovante PIX pela baixa automática da InfinitePay:

### Fluxo do Cliente
1. O cliente acessa `#/client/contracts`.
2. Em parcelas abertas ou no botão de quitação, clica em **"Pagar agora"**.
3. O backend cria a cobrança na InfinitePay via API oficial (`POST https://api.checkout.infinitepay.io/links`) e redireciona para o checkout.
4. O cliente escolhe pagar via **Pix** ou **Cartão de Crédito**.
5. Assim que pago, a InfinitePay notifica nosso webhook (`POST /api/webhooks/infinitepay`).
6. O backend confirma o pagamento via consulta oficial (`POST /payment_check`), valida valor e dá a baixa automática no contrato, gerando recibo, liberando o limite e disparando notificações.
7. O cliente é redirecionado para a página de retorno (`#/pagamento/retorno`), que mostra a confirmação em tempo real.

### Banco de Dados
- Criada a tabela `payment_charges`:
  - `id` (UUID único, usado como `order_nsu`)
  - `amount_cents` (inteiro em centavos)
  - `transaction_nsu` com **índice UNIQUE** (idempotência contra webhooks repetidos)
  - Campos de auditoria: `payment_method`, `receipt_url`, `paid_at`, etc.

### Variáveis no `.env` da VM
```env
INFINITEPAY_HANDLE=tubaraoemprestimo
INFINITEPAY_API_URL=https://api.checkout.infinitepay.io
INFINITEPAY_WEBHOOK_URL=https://app-api.tubaraoemprestimo.com.br/api/webhooks/infinitepay
INFINITEPAY_REDIRECT_URL=https://www.tubaraoemprestimo.com.br/#/pagamento/retorno
INFINITEPAY_TIMEOUT_MS=15000
```

---

## 4. 📱 Régua de Cobrança Automática (WhatsApp + E-mail + Push)

- O cron de cobrança roda diariamente às **09:00 BRT (12:00 UTC)**.
- **Link Direto:** As mensagens agora contêm o link direto do checkout da InfinitePay na variável `{pix_key}`, permitindo que o cliente pague com 1 clique direto da notificação.
- **Push Notifications (Web Push):** Corrigido o envio de Web Push que falhava por incompatibilidade de schema. Agora usa `PushSubscription.userId` e direciona o clique para a fatura.
- **Templates:** Todos os 16 templates no banco foram atualizados para substituir o texto de chave Pix estática por "Pague pelo app (Pix ou cartão)".

---

## 5. 🗄️ Estrutura de Containers e Serviços na VM

```bash
docker ps
```
- `tubarao_postgres` (porta 5432) — Banco de dados PostgreSQL da aplicação
- `evolution_api` (porta 8080) — Gateway WhatsApp Evolution API v2.3.7
- `evolution_postgres` — Banco de dados interno da Evolution API
- `evolution_redis` — Cache de sessões do WhatsApp

### Backend Node.js
- Gerenciado via PM2: `tubarao-backend`
- Executando em `/home/ubuntu/backend/backend`
- Comandos úteis:
  ```bash
  pm2 status
  pm2 logs tubarao-backend --lines 50
  pm2 restart tubarao-backend
  ```

---

## 6. 💾 Rotina de Backups

1. **Backup Automático Diário:**
   - Script: `/home/ubuntu/backup-tubarao.sh`
   - Agendamento: todo dia às **03:00 UTC** via crontab
   - Destino: `/home/ubuntu/backups/`
2. **Backups Locais Salvos na Máquina de Desenvolvimento:**
   - Pasta: `J:\AREA DE TRABALHO\Projetos\TUBARÃO EMPRÉSTIMOS LTDA\backups_completos\`
   - Contém dumps completos do Postgres, Evolution, Redis e uploads (2.9 GB íntegros).
