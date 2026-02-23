# ✅ Checklist de Deploy - Funil de Vendas

## 🎯 Status Atual
✅ **Implementação completa** - Commit: `f5a203e`
- 4 etapas do funil + página final
- API backend com validações
- Admin dashboard
- Database schema
- Documentação completa

---

## 📋 Próximos Passos Obrigatórios

### 1. Database Migration
```bash
# Adicionar os models ao schema.prisma principal
# Copiar conteúdo de prisma/schema-funil.prisma para prisma/schema.prisma

# Executar migração
npx prisma migrate dev --name add_funnel_models

# Gerar Prisma Client
npx prisma generate
```

**Status**: ⏳ Pendente

---

### 2. Configurar URLs do Asaas

#### ETAPA 1 - Pré-Lançamento
**Arquivo**: `app/funil/pre-lancamento/page.tsx` (linha 12)
```typescript
const ASAAS_CHECKOUT_URL = 'https://www.asaas.com/c/seu-link-aqui';
```
**Substituir por**: Link do Método Tubarão (R$ 497/697)

#### ETAPA 2 - Pós-Compra
**Arquivo**: `app/funil/pos-compra/page.tsx` (linhas 8-9)
```typescript
const ASAAS_LIMPA_NOME_URL = 'https://www.asaas.com/c/limpa-nome-link';
const ASAAS_FINANCIAMENTO_MOTO_URL = 'https://www.asaas.com/c/financiamento-moto-link';
```
**Substituir por**: Links dos módulos complementares

#### ETAPA 3 - Mentoria Online
**Arquivo**: `app/funil/mentoria-online/page.tsx` (linha 8)
```typescript
const ASAAS_MENTORIA_ONLINE_URL = 'https://www.asaas.com/c/mentoria-online-link';
```
**Substituir por**: Link da Mentoria Online (R$ 997)

**Status**: ⏳ Pendente

---

### 3. Upload dos Vídeos

Colocar os vídeos em `public/videos/`:
- [ ] `01-pre-lancamento.mp4` - Vídeo de vendas principal
- [ ] `02-upsell-modulos.mp4` - Pitch dos módulos
- [ ] `03-pitch-mentorias.mp4` - Pitch mentoria online
- [ ] `04-mentoria-presencial.mp4` - Pitch mentoria presencial
- [ ] `05-obrigado-final.mp4` - Vídeo de agradecimento

**Opcional** - Thumbnails em `public/images/`:
- [ ] `video-thumbnail.jpg`
- [ ] `upsell-thumbnail.jpg`
- [ ] `mentoria-thumbnail.jpg`
- [ ] `mentoria-presencial-thumbnail.jpg`
- [ ] `obrigado-thumbnail.jpg`

**Status**: ⏳ Pendente

---

## 🧪 Testes Essenciais

### ETAPA 1 - Pré-Lançamento
- [ ] Contador regressivo funcionando
- [ ] Preço muda após expiração (R$ 497 → R$ 697)
- [ ] Vídeo carrega e reproduz
- [ ] Botão redireciona para Asaas
- [ ] Responsivo em mobile

### ETAPA 2 - Pós-Compra
- [ ] Vídeo de upsell carrega
- [ ] Ambos os botões de compra funcionam
- [ ] Botão "Não, obrigado" redireciona para ETAPA 3
- [ ] Cards responsivos

### ETAPA 3 - Mentoria Online
- [ ] Vídeo com autoplay funciona
- [ ] Depoimentos carregam
- [ ] Botão de compra funciona
- [ ] Botão de recusa redireciona para ETAPA 4

### ETAPA 4 - Mentoria Presencial
- [ ] Modal abre corretamente
- [ ] Máscara de WhatsApp funciona: (XX) XXXXX-XXXX
- [ ] Validação de campos obrigatórios
- [ ] Validação de objetivo (mín. 20 chars)
- [ ] Submit envia para API
- [ ] Salva no banco de dados
- [ ] Redireciona para página de obrigado
- [ ] Mensagem de erro se duplicado (7 dias)

### Página Final
- [ ] Vídeo de agradecimento carrega
- [ ] Próximos passos visíveis
- [ ] Botão "Voltar ao início" funciona

### Admin Dashboard
- [ ] Lista todas as aplicações
- [ ] Filtros por status funcionam
- [ ] Link WhatsApp abre corretamente
- [ ] Paginação funciona
- [ ] Responsivo

**Status**: ⏳ Pendente

---

## 🚀 Melhorias Recomendadas (Opcional)

### Notificações Automáticas
```typescript
// Em app/api/mentoria-application/route.ts
// Descomentar e configurar:

// Enviar WhatsApp via Evolution API
await fetch('https://seu-evolution-api.com/message/sendText', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': process.env.EVOLUTION_API_KEY
  },
  body: JSON.stringify({
    number: process.env.ADMIN_WHATSAPP,
    text: `🎯 Nova Aplicação - Mentoria Presencial\n\n` +
          `Nome: ${nome}\n` +
          `WhatsApp: ${whatsapp}\n` +
          `Cidade: ${cidade}\n` +
          `Capital: ${capitalDisponivel}\n` +
          `Experiência: ${experiencia}\n\n` +
          `Objetivo: ${objetivo}`
  })
});
```

**Status**: ⏳ Opcional

---

### Tracking e Analytics

#### Facebook Pixel
**Arquivo**: `app/funil/pre-lancamento/page.tsx`
```typescript
// Descomentar linhas 62-66 e adicionar seu Pixel ID
<Script id="facebook-pixel" strategy="afterInteractive">
  {`fbq('init', 'SEU_PIXEL_ID');`}
</Script>
```

#### Google Analytics
```typescript
<Script src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX" />
```

**Status**: ⏳ Opcional

---

### Webhook Asaas
Criar endpoint para rastrear pagamentos automaticamente:
- [ ] Criar `app/api/webhook/asaas/route.ts`
- [ ] Configurar URL no painel Asaas
- [ ] Validar assinatura do webhook
- [ ] Registrar leads como APROVADO

**Status**: ⏳ Opcional

---

## 📊 Métricas para Acompanhar

### Google Analytics
- Taxa de conversão ETAPA 1 → Compra
- Taxa de aceitação Upsells (ETAPA 2)
- Taxa de aplicação Mentoria Presencial
- Tempo médio no vídeo
- Taxa de abandono por etapa

### Admin Dashboard
- Total de aplicações recebidas
- Aplicações por status
- Taxa de aprovação
- Tempo médio de resposta

**Status**: ⏳ Configurar após deploy

---

## 🔐 Variáveis de Ambiente

Adicionar ao `.env`:
```bash
# Asaas
ASAAS_API_KEY=your_asaas_api_key

# Evolution API (opcional)
EVOLUTION_API_KEY=your_evolution_api_key
EVOLUTION_API_URL=https://seu-evolution-api.com
ADMIN_WHATSAPP=5511999999999

# Analytics (opcional)
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
NEXT_PUBLIC_FB_PIXEL_ID=123456789
```

**Status**: ⏳ Pendente

---

## 📱 URLs do Funil

Após deploy, as URLs serão:
- `https://seu-dominio.com/funil/pre-lancamento` - ETAPA 1
- `https://seu-dominio.com/funil/pos-compra` - ETAPA 2
- `https://seu-dominio.com/funil/mentoria-online` - ETAPA 3
- `https://seu-dominio.com/funil/mentoria-presencial` - ETAPA 4
- `https://seu-dominio.com/funil/obrigado-final` - Final
- `https://seu-dominio.com/admin/mentoria-applications` - Admin

---

## 🎓 Documentação

Consulte os arquivos:
- `FUNIL_SETUP.md` - Guia completo de configuração
- `FUNIL_RESUMO.md` - Resumo da implementação
- `prisma/schema-funil.prisma` - Schema do banco de dados

---

## ✅ Resumo

**Implementado**:
- ✅ 4 páginas do funil + página final
- ✅ API backend com validações
- ✅ Admin dashboard
- ✅ Database schema
- ✅ Documentação completa
- ✅ Design responsivo
- ✅ Validações client + server
- ✅ Máscara de WhatsApp
- ✅ Verificação de duplicatas

**Pendente**:
- ⏳ Migração do banco de dados
- ⏳ Configurar URLs do Asaas
- ⏳ Upload dos vídeos
- ⏳ Testes completos
- ⏳ Deploy em produção

**Opcional**:
- ⏳ Notificações automáticas
- ⏳ Tracking (Pixel, GA)
- ⏳ Webhook Asaas
- ⏳ Email marketing

---

**Última atualização**: 2026-02-23
**Commit**: `f5a203e`
**Status geral**: ✅ Pronto para configuração e deploy
