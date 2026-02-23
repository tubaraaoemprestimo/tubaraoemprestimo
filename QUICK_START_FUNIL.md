# 🚀 Quick Start - Funil de Vendas

## ⚡ Começar Agora (3 Passos)

### 1️⃣ Migrar o Banco de Dados (2 minutos)

```bash
# Abrir o arquivo prisma/schema.prisma
# Copiar todo o conteúdo de prisma/schema-funil.prisma
# Colar no final do schema.prisma

# Executar migração
npx prisma migrate dev --name add_funnel_models

# Gerar client
npx prisma generate
```

### 2️⃣ Configurar Links do Asaas (5 minutos)

Criar produtos no Asaas e substituir os links:

**app/funil/pre-lancamento/page.tsx** (linha 12):
```typescript
const ASAAS_CHECKOUT_URL = 'SEU_LINK_ASAAS_AQUI';
```

**app/funil/pos-compra/page.tsx** (linhas 8-9):
```typescript
const ASAAS_LIMPA_NOME_URL = 'SEU_LINK_ASAAS_AQUI';
const ASAAS_FINANCIAMENTO_MOTO_URL = 'SEU_LINK_ASAAS_AQUI';
```

**app/funil/mentoria-online/page.tsx** (linha 8):
```typescript
const ASAAS_MENTORIA_ONLINE_URL = 'SEU_LINK_ASAAS_AQUI';
```

### 3️⃣ Testar Localmente (3 minutos)

```bash
# Iniciar servidor de desenvolvimento
npm run dev

# Acessar no navegador:
# http://localhost:5173/funil/pre-lancamento
# http://localhost:5173/funil/pos-compra
# http://localhost:5173/funil/mentoria-online
# http://localhost:5173/funil/mentoria-presencial
# http://localhost:5173/funil/obrigado-final
# http://localhost:5173/admin/mentoria-applications
```

---

## 📹 Vídeos (Opcional mas Recomendado)

Coloque seus vídeos em `public/videos/`:
- `01-pre-lancamento.mp4`
- `02-upsell-modulos.mp4`
- `03-pitch-mentorias.mp4`
- `04-mentoria-presencial.mp4`
- `05-obrigado-final.mp4`

Se não tiver os vídeos ainda, o player mostrará um fundo preto.

---

## 🧪 Teste Rápido do Formulário

1. Acesse: `http://localhost:5173/funil/mentoria-presencial`
2. Clique em "APLICAR PARA MENTORIA PRESENCIAL"
3. Preencha o formulário:
   - Nome: Teste Silva
   - WhatsApp: (11) 99999-9999
   - Cidade: São Paulo/SP
   - Capital: Qualquer opção
   - Experiência: Qualquer opção
   - Objetivo: "Quero construir um negócio de 6 dígitos por mês" (mín. 20 chars)
4. Clique em "ENVIAR APLICAÇÃO"
5. Deve redirecionar para `/funil/obrigado-final`

### Verificar no Admin:
1. Acesse: `http://localhost:5173/admin/mentoria-applications`
2. Deve aparecer a aplicação de teste

---

## 🎯 Fluxo Completo de Teste

```
1. /funil/pre-lancamento
   ↓ Clicar em "GARANTIR MINHA VAGA AGORA"
   → Redireciona para Asaas (se configurado)

2. /funil/pos-compra
   ↓ Clicar em "Não, obrigado"
   → Redireciona para /funil/mentoria-online

3. /funil/mentoria-online
   ↓ Clicar em "Não, quero continuar sem a mentoria"
   → Redireciona para /funil/mentoria-presencial

4. /funil/mentoria-presencial
   ↓ Preencher formulário e enviar
   → Redireciona para /funil/obrigado-final

5. /funil/obrigado-final
   ✅ Fim do funil
```

---

## 🔍 Verificar se Está Funcionando

### ✅ Checklist Rápido

- [ ] Contador regressivo está rodando (ETAPA 1)
- [ ] Vídeos carregam (ou mostram fundo preto se não tiver)
- [ ] Botões de CTA funcionam
- [ ] Formulário valida campos obrigatórios
- [ ] Máscara de WhatsApp funciona: (XX) XXXXX-XXXX
- [ ] Submit do formulário funciona
- [ ] Admin dashboard lista aplicações
- [ ] Filtros do admin funcionam
- [ ] Responsivo em mobile (F12 → Toggle device toolbar)

---

## 🚨 Problemas Comuns

### Erro: "PrismaClient is unable to run in the browser"
**Solução**: A API route está correta, mas pode estar importando Prisma no client. Verifique se não há imports de `@prisma/client` em componentes client-side.

### Erro: "Table 'mentoria_applications' doesn't exist"
**Solução**: Execute a migração do banco:
```bash
npx prisma migrate dev --name add_funnel_models
```

### Formulário não envia
**Solução**: Abra o console (F12) e verifique erros. Certifique-se que a API está rodando.

### Vídeos não carregam
**Solução**: Verifique se os arquivos estão em `public/videos/`. Se não tiver os vídeos, comente as tags `<video>` temporariamente.

---

## 📦 Deploy em Produção

### Vercel (Recomendado)

```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel

# Configurar variáveis de ambiente no dashboard:
# DATABASE_URL
# ASAAS_API_KEY (se usar webhook)
```

### Variáveis de Ambiente Necessárias

```bash
DATABASE_URL="postgresql://..."
```

**Opcional**:
```bash
EVOLUTION_API_KEY="..."
EVOLUTION_API_URL="..."
ADMIN_WHATSAPP="5511999999999"
```

---

## 📊 Monitorar Aplicações

### Via Admin Dashboard
`https://seu-dominio.com/admin/mentoria-applications`

### Via Banco de Dados
```sql
-- Ver todas as aplicações
SELECT * FROM mentoria_applications ORDER BY created_at DESC;

-- Contar por status
SELECT status, COUNT(*) FROM mentoria_applications GROUP BY status;

-- Aplicações dos últimos 7 dias
SELECT * FROM mentoria_applications
WHERE created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

---

## 🎨 Personalizar Design

### Cores Principais
- Dourado: `#D4AF37` (CTAs, destaques)
- Dourado escuro: `#B8860B` (gradientes)
- Preto: `#000000` (background)
- Zinc: `#18181b` (cards)

### Fontes
- Títulos: `font-black` (900)
- Subtítulos: `font-bold` (700)
- Texto: `font-normal` (400)

### Espaçamentos
- Mobile: `px-4 py-12`
- Desktop: `px-8 py-20`

---

## 📞 Suporte

### Documentação Completa
- `FUNIL_SETUP.md` - Setup detalhado
- `FUNIL_RESUMO.md` - Resumo da implementação
- `CHECKLIST_DEPLOY_FUNIL.md` - Checklist completo

### Tecnologias
- Next.js: https://nextjs.org/docs
- Prisma: https://www.prisma.io/docs
- Asaas: https://docs.asaas.com
- Tailwind: https://tailwindcss.com/docs

---

## ✨ Próximos Passos Recomendados

1. **Adicionar Tracking**: Facebook Pixel + Google Analytics
2. **Webhook Asaas**: Rastrear pagamentos automaticamente
3. **Notificações**: WhatsApp automático via Evolution API
4. **Email Marketing**: Sequência de emails pós-compra
5. **A/B Testing**: Testar diferentes versões dos vídeos
6. **Retargeting**: Pixel do Facebook para quem não comprou

---

**Status**: ✅ Pronto para usar
**Tempo estimado de setup**: 10-15 minutos
**Última atualização**: 2026-02-23
