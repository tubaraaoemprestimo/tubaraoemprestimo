# 🚀 Automação WhatsApp - Evolution API Integration

## 📋 Configuração Rápida

### 1. Adicione as variáveis de ambiente no `.env`:

```bash
# Evolution API Configuration
EVOLUTION_API_URL=https://sua-evolution-api.com
EVOLUTION_API_KEY=sua_api_key_aqui
EVOLUTION_INSTANCE_NAME=tubarao_whatsapp
```

### 2. Exemplo de configuração real:

```bash
EVOLUTION_API_URL=https://evolution.tubaraoemprestimos.com.br
EVOLUTION_API_KEY=B6D9F2E1A4C7H8K3M5N9P2Q4R6S8T1V3
EVOLUTION_INSTANCE_NAME=tubarao_vendas
```

---

## 🎯 Como Funciona

### Fluxo Automático:

```
1. Aluno completa Quiz
   ↓
2. Sistema calcula Lead Score
   ↓
3. Se HOT ou WARM:
   ↓
4. Aguarda 3 minutos (humanização)
   ↓
5. Dispara mensagem personalizada no WhatsApp
   ↓
6. Lead recebe mensagem do "Bruninho"
   ↓
7. Conversão! 💰
```

---

## 📱 Templates de Mensagens

### 🔥 Lead QUENTE (HOT)
```
Opa, *[Nome]*! Tudo bem? Aqui é o Bruninho, da equipe VIP do Tubarão Empréstimos.
Você tá podendo falar rapidinho?

Acabei de ver suas respostas aqui na pesquisa do curso e seu perfil chamou muito
a nossa atenção para a nossa Mentoria Exclusiva. Tenho uma janela na agenda hoje
para te explicar como funciona.

Fica melhor eu te ligar de manhã ou de tarde?
```

### ⚠️ Lead MORNO (WARM)
```
Fala *[Nome]*, aqui é o Bruninho da equipe do Tubarão Empréstimos!
Parabéns por finalizar o curso!

Vi na sua pesquisa que você gostou muito do conteúdo, mas colocou que "talvez"
participaria da mentoria. Qual foi a sua maior dúvida durante o curso que te
deixou na incerteza de dar o próximo passo?

Quero te ajudar a destravar isso!
```

### ❄️ Lead FRIO (COLD)
```
Olá *[Nome]*! Parabéns por concluir o Método Tubarão! 🦈

Obrigado pelo seu feedback na pesquisa. Qualquer dúvida, estamos à disposição!

Continue acompanhando nossos conteúdos. 💪
```

---

## 🔧 Integração Técnica

### Arquivo criado: `backend/src/services/whatsappAutomationService.ts`

**Funções principais**:
- `sendWhatsAppAutomation()` - Dispara mensagem com delay de 3 minutos
- `formatPhoneNumber()` - Formata telefone para padrão WhatsApp (5511999999999)
- `sendEvolutionMessage()` - Faz requisição POST para Evolution API

### Integrado em: `backend/src/services/leadScoringService.ts`

```typescript
// Após salvar quiz e calcular score:
if (scoring.leadStatus === 'HOT' || scoring.leadStatus === 'WARM') {
  sendWhatsAppAutomation(
    scoring.leadStatus,
    quizResponse.fullName,
    quizResponse.whatsapp
  ).catch(error => {
    console.error('❌ Erro na automação WhatsApp:', error);
  });
}
```

---

## 🛡️ Segurança e Tratamento de Erros

### ✅ Implementado:

1. **Variáveis de ambiente**: Credenciais nunca no código
2. **Try/Catch**: Erros não quebram o fluxo principal
3. **Timeout**: 10 segundos máximo por requisição
4. **Logs detalhados**: Rastreamento completo de disparos
5. **Fire and forget**: Automação não bloqueia resposta ao cliente

### ⚠️ Comportamento em caso de falha:

- Se Evolution API estiver offline → Log de erro, mas quiz é salvo normalmente
- Se número inválido → Log de erro, mas não quebra aplicação
- Se timeout → Requisição cancelada após 10s

---

## 📊 Logs e Monitoramento

### Console logs automáticos:

```bash
# Sucesso
✅ Mensagem WhatsApp enviada: { phone: '5511999999999', messageId: 'ABC123' }

# Falha
❌ Falha ao disparar automação WhatsApp: { phone: '5511999999999', error: 'timeout' }

# Início
🎯 Iniciando automação WhatsApp: { leadStatus: 'HOT', clientName: 'João Silva' }

# Delay
⏰ Aguardando 3 minutos para humanizar...

# Conclusão
🎉 Automação concluída com sucesso!
```

---

## 🚀 Melhorias Futuras (Opcional)

### 1. Sistema de Fila com BullMQ + Redis

Para ambientes serverless (Vercel), recomenda-se usar fila:

```typescript
import { Queue } from 'bullmq';

const whatsappQueue = new Queue('whatsapp-automation', {
  connection: { host: process.env.REDIS_HOST }
});

await whatsappQueue.add(
  'send-message',
  { leadStatus, clientName, clientPhone },
  { delay: 3 * 60 * 1000 } // 3 minutos
);
```

### 2. Tabela de Log no Banco

```prisma
model WhatsAppAutomation {
  id          String   @id @default(uuid())
  leadId      String
  leadStatus  String
  phone       String
  messageText String   @db.Text
  status      String   // PENDING, SENT, FAILED
  messageId   String?
  error       String?
  sentAt      DateTime?
  createdAt   DateTime @default(now())
}
```

### 3. Retry Automático

Se falhar, tentar novamente após 5 minutos (máximo 3 tentativas).

### 4. Dashboard de Automações

Painel admin mostrando:
- Total de mensagens enviadas
- Taxa de sucesso/falha
- Leads contatados vs não contatados

---

## 🧪 Como Testar

### 1. Teste manual via Postman/Insomnia:

```bash
POST https://sua-evolution-api.com/message/sendText/tubarao_whatsapp
Headers:
  Content-Type: application/json
  apikey: sua_api_key_aqui

Body:
{
  "number": "5511999999999",
  "text": "Teste de automação"
}
```

### 2. Teste no sistema:

1. Complete o quiz como aluno
2. Marque interesse em mentoria + investimento alto
3. Aguarde 3 minutos
4. Verifique se mensagem chegou no WhatsApp

### 3. Verifique logs no console do backend:

```bash
cd backend
npm run dev
# Acompanhe os logs em tempo real
```

---

## ⚡ Ativação Imediata

### Checklist:

- [ ] Adicionar variáveis no `.env`
- [ ] Reiniciar servidor backend
- [ ] Testar com número real
- [ ] Verificar logs de sucesso
- [ ] Monitorar primeiras conversões

---

## 💡 Dicas de Ouro

### 1. Humanização é CRÍTICA
- Delay de 3 minutos simula comportamento humano
- Mensagens instantâneas parecem robô

### 2. Personalize os templates
- Use o nome do cliente
- Mencione detalhes do quiz
- Crie senso de exclusividade

### 3. Monitore taxa de resposta
- Se baixa → ajuste templates
- Se alta → escale operação

### 4. Tenha equipe pronta
- Leads HOT respondem rápido
- Alguém precisa atender em até 5 minutos

---

**Sistema 100% automático e pronto para gerar vendas 24/7! 🦈💰**

Desenvolvido com ❤️ para Tubarão Empréstimos LTDA
