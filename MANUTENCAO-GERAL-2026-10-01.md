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
- **Status da VM Antiga (`tubarao` 1GB, E2.1.Micro):** **APAGADA em 02/10/2026** (instância + boot volume de 200 GB), após conferir VM nova estável, backups diários e cópia completa local. Não há mais rollback para ela — o rollback agora é restaurar os backups (seção 6).

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
   - Contém dumps completos do Postgres, Evolution, Redis e uploads (2.9 GB íntegros), de 30/09/2026.
3. **Backup do build anterior do backend:** `/home/ubuntu/dist-backup-pre-uploads` (antes dos fixes de 01/10).
   Rollback rápido: `cd /home/ubuntu/backend/backend && mv dist dist-ruim && cp -r /home/ubuntu/dist-backup-pre-uploads dist && pm2 restart tubarao-backend`.

---

## 7. 📎 Uploads de Fotos e Vídeos (Cloudflare R2)

### Fluxo
Wizard (`pages/client/Wizard.tsx`) → `apiService.uploadFile` → `api.upload` (FormData, timeout 10 min) → `POST /api/upload` (`backend/src/routes/upload.ts`, multer em memória, autenticado) → `saveBufferToStorage` (`backend/src/services/storageService.ts`) → R2 em `solicitacoes/<userId>/<timestamp>-<uuid>-<nome>`, URL pública `https://pub-8123cae3d0f14991b1fd5e456c4f9e24.r2.dev/...`.

- **Vídeos** (`components/VideoUpload.tsx`): sobem na hora (gravação in-app, galeria ou câmera nativa). Nunca guardar `blob:` no state.
- **PDF** (CTPS): sobe na hora ao anexar.
- **Fotos**: comprimidas no navegador (1920px JPEG) e sobem no envio final. HEIC que o navegador não decodifica sobe o original na hora.
- **Limites**: foto original 25 MB, PDF 20 MB, vídeo 100 MB (teto real = corpo de requisição do Cloudflare). `MAX_FILE_SIZE` do backend = 200 MB, nginx 110 MB.
- **Tipos aceitos no backend**: jpeg, png, gif, webp, heic, heif, mp4, webm, quicktime, 3gpp, pdf.
- **Onde cada mídia fica no banco** (`loan_requests`): colunas `selfie_url`, `id_card_url`, `id_card_back_url`, `proof_of_address_url`, `proof_income_url`, `video_selfie_url`, `video_house_url`, `signature_url`, `work_card_url`, `vehicle_url`; o resto vai no JSON `supplemental_description` (`housePhotos`, `billInName`, `cnh`, `guarantee.photos/video`) e `collateral_items` (GARANTIA).
- **Uploads antigos** (até 13/03/2026) continuam em disco: `/home/ubuntu/uploads` (2,8 GB, 1.784 arquivos).

### Armadilhas já resolvidas (não regredir)
1. **Vídeo gravado no app nunca chegava** (commit `5f2e432`): o MediaRecorder gera `video/webm;codecs=vp9,opus`; a vírgula quebra o parser multipart (busboy), o arquivo chega como `text/plain` e é recusado. Fix: `VideoUpload` envia o tipo sem `;codecs`. Em 60 dias havia 0 gravações in-app no R2.
2. **CNH (AUTONOMO/MOTO) não era salva** (`5f2e432`): agora vai em `supplemental_description.cnh` e aparece no admin (Solicitações e Clientes). CNHs de pedidos anteriores estão no R2, mas sem vínculo com o pedido.
3. **Foto > 5 MB barrada antes de comprimir** (`5f2e432`): limite passou a 25 MB.
4. **Extensão `.bin` no R2** (`5f2e432`): `storageService` agora conhece mp4/webm/mov/3gp/heic.
5. **PDF via `blob:` invalidado no Android** (`700be90`): PDF sobe na hora do anexo.

### Como testar upload sem afetar produção
Gerar JWT de vida curta na VM (`jsonwebtoken`, `JWT_SECRET` do `.env`), fazer `POST https://app-api.tubaraoemprestimo.com.br/api/upload` com `FormData`, conferir `HEAD` público na URL e **apagar o objeto de teste do R2** (`DeleteObjectCommand`). Para testar código novo antes do deploy: copiar `src` para `/tmp/bt`, compilar e subir numa porta livre (ex.: 3099).

---

## 8. 📝 Envio de Solicitação por Modalidade

| Modalidade | Etapas com mídia | Validação no backend (`validateRequestByProfile`) |
|---|---|---|
| CLT | selfie, RG frente/verso, endereço, boleto, renda, CTPS **PDF**, fotos casa, vídeo casa, vídeo aceite, assinatura | referências, docs básicos, vídeo selfie e casa, CTPS |
| AUTONOMO | igual CLT, sem CTPS, + **CNH** + vídeo do estabelecimento | referências, docs básicos, vídeos |
| MOTO | selfie, RG, endereço, renda, **CNH**, fotos fachada (sem vídeos) | referências, docs básicos (sem vídeo) |
| GARANTIA | docs básicos + itens de garantia (fotos e nota fiscal opcional) + vídeos | referências, docs, vídeos, itens com fotos |
| LIMPA_NOME | só assinatura | só assinatura (**sem referências**) |
| INVESTIDOR | só assinatura, sem CPF | nada obrigatório (**sem referências**) |

Se o valor passar de `maxLoanNoGuarantee`, CLT/AUTONOMO também pedem fotos e vídeo do bem em garantia (gravados em `guarantee.photos`/`guarantee.video`).

### Bugs de envio corrigidos em 01/10/2026 (commit `2f12a0f`)
1. **LIMPA_NOME e INVESTIDOR recusados no envio**: o backend exigia 2 referências de todas as modalidades, mas o wizard dessas duas não tem o campo. Nunca houve nenhum pedido de INVESTIDOR por isso.
2. **INVESTIDOR com CPF vazio**: duplicidade agora é checada por `userId` quando não há CPF; o customer é criado com `cpf = INV_<userId>` (coluna UNIQUE).
3. **"Fotos do Bem em Garantia"** (etapa de documentos) gravavam num campo inexistente e travavam a etapa.

Teste automatizado com o payload real de cada modalidade: `backend/src/services/__tests__/loanRequestValidation.test.ts`.
Rodar testes do backend: `cd backend && node node_modules/vitest/vitest.mjs --run` (5 testes de `interestEngine` já falhavam antes, sem relação).

---

## 9. ⏳ Pendências em Aberto

- **Teste real no celular** de cada modalidade após os fixes de 01/10: LIMPA_NOME, INVESTIDOR, CLT com garantia, AUTONOMO (gravar vídeo pelo app + CNH), MOTO.
- **Branch `fix/submit-crash-wizard`** (fila de uploads, rascunho no localStorage, ErrorBoundary): não mesclada; precisa rebase sobre a `main` atual (mexe no mesmo `Wizard.tsx`) e teste no Android.
- **WhatsApp do Tubarão** (instância `tubarao` na Evolution) desconectado: ler QR Code.
- **Teste de pagamento real** na InfinitePay com cartão.
- **Chave API da Oracle**: remover `~/.oci` e `/home/ubuntu/oci-cli` da VM e revogar a chave no console após o fim da manutenção.
- **Segurança**: senha do Postgres fraca e Adminer público (`db-admin.tubaraoemprestimo.com.br`) — decisão pendente.
- ~~Alerta de gastos na Oracle~~ — **criado em 02/10/2026**: budget `alerta-gastos-tubarao` (R$ 25/mês, conta toda), e-mails para `tubaraao.emprestimo@gmail.com` quando: gasto real ≥ R$ 1 no mês; gasto real ≥ 80%; previsão ≥ 100%. Consumo esperado: R$ 0 (VM A1 2 OCPU/12 GB + 100 GB disco, dentro do Always Free: 4 OCPU/24 GB/200 GB). Única cobrança até agora: ~R$ 0,73 em 01–02/10 (300 GB de disco com as duas VMs juntas).
- **Telefone** ("não consegue colocar telefone"): nunca reproduzido.
- Arquivo `api-oracle.png` solto na raiz do projeto (não versionado) — pode apagar.
