# 🚀 ATIVAÇÃO IMEDIATA - Sistema WhatsApp Automático

## ✅ CONFIGURAÇÃO JÁ EXISTENTE

Você já tem as credenciais da Evolution API configuradas no `.env`:

```bash
EVOLUTION_API_URL="http://localhost:8080"
EVOLUTION_API_KEY="SUA_CHAVE_AQUI"
EVOLUTION_INSTANCE="tubarao"
```

**O sistema já está configurado para usar essas variáveis!** ✅

---

## 📋 PASSOS PARA ATIVAR (3 MINUTOS)

### 1️⃣ Adicionar Modelo no Prisma Schema

Abra o arquivo `backend/prisma/schema.prisma` e adicione no final:

```prisma
model WhatsAppAutomation {
  id          String   @id @default(uuid())
  leadId      String   @map("lead_id")
  leadStatus  String   @map("lead_status")
  clientName  String   @map("client_name")
  phone       String
  messageText String   @db.Text @map("message_text")
  status      String   @default("PENDING")
  messageId   String?  @map("message_id")
  error       String?  @db.Text
  sentAt      DateTime? @map("sent_at")
  createdAt   DateTime @default(now()) @map("created_at")

  @@map("whatsapp_automations")
  @@index([leadId])
  @@index([status])
  @@index([createdAt])
}
```

### 2️⃣ Aplicar Migration

```bash
cd backend
npx prisma migrate dev --name add_whatsapp_automation
```

### 3️⃣ Reiniciar Servidor

```bash
npm run dev
```

---

## 🧪 TESTAR AGORA

### Teste Rápido via API:

```bash
POST http://localhost:3001/api/automation/test
Headers:
  Authorization: Bearer {seu_token_admin}
  Content-Type: application/json

Body:
{
  "phone": "11999999999",
  "name": "Teste Automação",
  "leadStatus": "HOT"
}
```

**Resultado esperado**:
- ⏰ Aguarda 3 minutos
- 📱 Mensagem chega no WhatsApp
- ✅ Log de sucesso no console

---

## 🔥 COMO FUNCIONA AUTOMATICAMENTE

### Fluxo Real:

```
1. Aluno completa Quiz no site
   ↓
2. Sistema calcula Lead Score
   ↓
3. Se HOT ou WARM:
   ↓
4. 🎯 AUTOMAÇÃO DISPARA SOZINHA
   ↓
5. Aguarda 3 minutos (humanização)
   ↓
6. Envia mensagem personalizada
   ↓
7. Lead recebe no WhatsApp
   ↓
8. Equipe fecha venda! 💰
```

**Você não precisa fazer NADA!** O sistema trabalha sozinho 24/7.

---

## 📱 MENSAGENS QUE SERÃO ENVIADAS

### 🔥 Lead QUENTE (HOT)
```
Opa, *João Silva*! Tudo bem? Aqui é o Bruninho, da equipe VIP do Tubarão Empréstimos.
Você tá podendo falar rapidinho?

Acabei de ver suas respostas aqui na pesquisa do curso e seu perfil chamou muito
a nossa atenção para a nossa Mentoria Exclusiva. Tenho uma janela na agenda hoje
para te explicar como funciona.

Fica melhor eu te ligar de manhã ou de tarde?
```

### ⚠️ Lead MORNO (WARM)
```
Fala *João Silva*, aqui é o Bruninho da equipe do Tubarão Empréstimos!
Parabéns por finalizar o curso!

Vi na sua pesquisa que você gostou muito do conteúdo, mas colocou que "talvez"
participaria da mentoria. Qual foi a sua maior dúvida durante o curso que te
deixou na incerteza de dar o próximo passo?

Quero te ajudar a destravar isso!
```

---

## 📊 MONITORAR DISPAROS

### Ver Estatísticas:
```bash
GET http://localhost:3001/api/automation/stats
```

Resposta:
```json
{
  "total": 15,
  "sent": 13,
  "failed": 2,
  "pending": 0,
  "successRate": "86.67%"
}
```

### Ver Logs Completos:
```bash
GET http://localhost:3001/api/automation/logs
```

### Ver Mensagens Falhadas:
```bash
GET http://localhost:3001/api/automation/failed
```

### Reenviar Mensagem Falhada:
```bash
POST http://localhost:3001/api/automation/retry/{id}
```

---

## 🎯 CHECKLIST FINAL

- [x] Código implementado
- [x] Variáveis de ambiente já configuradas
- [x] Integração com Lead Scoring ativa
- [ ] Adicionar modelo no schema.prisma
- [ ] Aplicar migration
- [ ] Reiniciar servidor
- [ ] Testar com número real
- [ ] Monitorar primeiras conversões

---

## 💡 DICAS IMPORTANTES

### 1. Certifique-se que a Evolution API está rodando
```bash
# Testar se está online:
curl http://localhost:8080/instance/connectionState/tubarao
```

### 2. Formato do número
O sistema formata automaticamente:
- Entrada: `(11) 99999-9999`
- Saída: `5511999999999` (DDI + DDD + Número)

### 3. Delay de 3 minutos é CRÍTICO
Não remova! Isso humaniza a automação e evita parecer robô.

### 4. Logs no Console
Acompanhe em tempo real:
```bash
cd backend
npm run dev
# Você verá:
# 🎯 Iniciando automação WhatsApp...
# ⏰ Aguardando 3 minutos...
# ✅ Mensagem enviada!
```

---

## 🚨 TROUBLESHOOTING

### Erro: "Evolution API não configurada"
- Verifique se o `.env` tem as 3 variáveis
- Reinicie o servidor após adicionar

### Erro: "timeout"
- Evolution API pode estar offline
- Verifique: `curl http://localhost:8080`

### Mensagem não chega
- Verifique se o número está correto
- Verifique se a instância está conectada
- Veja logs: `GET /api/automation/logs`

---

## ✅ SISTEMA PRONTO!

**Arquivos já criados**:
1. ✅ `backend/src/services/whatsappAutomationService.ts`
2. ✅ `backend/src/services/automationLogService.ts`
3. ✅ `backend/src/routes/automation.ts`
4. ✅ `backend/src/services/leadScoringService.ts` (modificado)
5. ✅ `backend/src/server.ts` (modificado)

**Falta apenas**:
1. Adicionar modelo no schema.prisma
2. Rodar migration
3. Reiniciar servidor

**Tempo estimado: 3 minutos** ⏱️

---

**🦈 Seu funcionário digital está pronto para trabalhar 24/7! 💰**

Data: 2026-03-20
Hora: 11:57 UTC
