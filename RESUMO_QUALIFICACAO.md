# 📋 Sistema de Qualificação de Leads - Tubarão Empréstimos

**Data de criação:** 18/02/2026
**Versão:** 1.0
**Status:** ✅ Implementado

---

## 📌 Visão Geral

Sistema de landing page de qualificação para capturar e classificar pessoas interessadas no mercado de crédito. O sistema utiliza um funil multi-etapas com perguntas estratégicas que geram tags automáticas para segmentação e qualificação de leads.

---

## 🎯 Objetivo

Capturar leads qualificados através de um formulário interativo que:
- Identifica o perfil do interessado
- Classifica automaticamente com tags
- Permite filtros avançados no painel admin
- Redireciona para grupo WhatsApp após conclusão

---

## 🏗️ Arquitetura

### Frontend
- **Página Pública:** `/qualificacao` - Landing page com formulário multi-etapas
- **Página Admin:** `/admin/qualification-leads` - Painel de gerenciamento de leads
- **Componentes:** `QualificationPage.tsx`, `QualificationLeadsAdmin.tsx`

### Backend
- **Rota API:** `/api/qualification-leads`
- **Modelo:** `QualificationLead` (Prisma)
- **Arquivo:** `backend/src/routes/qualificationLeads.ts`

### Banco de Dados
- **Tabela:** `qualification_leads`
- **Schema:** `backend/prisma/schema.prisma`

---

## 📊 Estrutura do Banco de Dados

```prisma
model QualificationLead {
  id                String   @id @default(uuid())
  name              String
  email             String
  phone             String
  hasExperience     Boolean
  experienceLevel   String?   // iniciante, intermediario, avancado
  hasCapital        Boolean
  capitalAmount     String?   // ate_10k, 10k_50k, 50k_100k, acima_100k
  wantsToLearn      Boolean
  learningInterest  String?   // curso, mentoria, presencial
  hasTime           Boolean
  timeAvailability  String?   // integral, parcial, limitado
  wantsPartnership  Boolean
  partnershipType   String?   // investidor, operacional, correspondente
  tags              String[]  // Tags automáticas
  status            String    // NEW, CONTACTED, QUALIFIED, REJECTED
  notes             String?
  createdAt         DateTime
  updatedAt         DateTime
}
```

---

## 🎨 Fluxo do Formulário (7 Etapas)

### Etapa 1: Informações Básicas
- Nome completo
- E-mail
- WhatsApp

### Etapa 2: Experiência no Mercado
- **Pergunta:** "Você já trabalha ou trabalhou com crédito/empréstimos?"
- **Opções:** Sim / Não

### Etapa 3: Nível de Experiência (se tem experiência)
- **Pergunta:** "Qual seu nível de conhecimento no mercado?"
- **Opções:**
  - Iniciante (< 1 ano)
  - Intermediário (1-3 anos)
  - Avançado (> 3 anos)

### Etapa 4: Capital Disponível
- **Pergunta:** "Você tem capital para investir no negócio?"
- **Opções:** Sim / Não
- **Se sim:** Faixa de valor (até 10k, 10k-50k, 50k-100k, acima de 100k)

### Etapa 5: Interesse em Aprender
- **Pergunta:** "Você gostaria de aprender mais sobre o mercado de crédito?"
- **Opções:** Sim / Não

### Etapa 6: Formato de Aprendizado (se quer aprender)
- **Pergunta:** "Como você prefere aprender?"
- **Opções:**
  - Curso online
  - Mentoria online
  - Mentoria presencial

### Etapa 7: Interesse em Parceria
- **Pergunta:** "Você tem interesse em fazer parceria conosco?"
- **Opções:**
  - Investidor (capital)
  - Parceiro operacional (trabalho ativo)
  - Correspondente bancário (intermediação)
  - Não tenho interesse

---

## 🏷️ Sistema de Tags Automáticas

### Tags de Experiência
- `TAG_EXPERIENCIA` - Tem experiência no mercado
- `TAG_INICIANTE` - Não tem experiência
- `TAG_AVANCADO` - Experiência avançada (> 3 anos)

### Tags de Capital
- `TAG_CAPITAL` - Tem capital disponível
- `TAG_INVESTIDOR_ALTO` - Capital acima de 100k
- `TAG_INVESTIDOR_MEDIO` - Capital entre 50k-100k

### Tags de Aprendizado
- `TAG_APRENDIZADO` - Quer aprender
- `TAG_CURSO` - Interesse em curso online
- `TAG_MENTORIA_ONLINE` - Interesse em mentoria online
- `TAG_MENTORIA_PRESENCIAL` - Interesse em mentoria presencial

### Tags de Disponibilidade
- `TAG_DISPONIBILIDADE` - Tem tempo disponível
- `TAG_TEMPO_INTEGRAL` - Disponibilidade integral

### Tags de Parceria
- `TAG_PARCERIA` - Quer parceria
- `TAG_INVESTIDOR` - Quer investir capital
- `TAG_OPERACIONAL` - Quer trabalhar ativamente
- `TAG_CORRESPONDENTE` - Quer ser correspondente bancário

---

## 🔌 API Endpoints

### POST `/api/qualification-leads`
Criar novo lead de qualificação

**Body:**
```json
{
  "name": "João Silva",
  "email": "joao@email.com",
  "phone": "11999999999",
  "hasExperience": true,
  "experienceLevel": "avancado",
  "hasCapital": true,
  "capitalAmount": "acima_100k",
  "wantsToLearn": true,
  "learningInterest": "mentoria",
  "hasTime": true,
  "timeAvailability": "integral",
  "wantsPartnership": true,
  "partnershipType": "investidor"
}
```

**Response:**
```json
{
  "success": true,
  "lead": {
    "id": "uuid",
    "name": "João Silva",
    "tags": ["TAG_EXPERIENCIA", "TAG_AVANCADO", "TAG_CAPITAL", "TAG_INVESTIDOR_ALTO", ...],
    "status": "NEW",
    "createdAt": "2026-02-18T13:00:00.000Z"
  }
}
```

### GET `/api/qualification-leads`
Listar leads com filtros

**Query Params:**
- `status` - Filtrar por status (NEW, CONTACTED, QUALIFIED, REJECTED)
- `tags` - Filtrar por tags (separadas por vírgula)
- `search` - Buscar por nome, email ou telefone

**Response:**
```json
{
  "leads": [
    {
      "id": "uuid",
      "name": "João Silva",
      "email": "joao@email.com",
      "phone": "11999999999",
      "tags": ["TAG_EXPERIENCIA", "TAG_CAPITAL"],
      "status": "NEW",
      "createdAt": "2026-02-18T13:00:00.000Z"
    }
  ]
}
```

### GET `/api/qualification-leads/:id`
Buscar lead específico

**Response:**
```json
{
  "lead": {
    "id": "uuid",
    "name": "João Silva",
    "email": "joao@email.com",
    "phone": "11999999999",
    "hasExperience": true,
    "experienceLevel": "avancado",
    "tags": ["TAG_EXPERIENCIA", "TAG_AVANCADO"],
    "status": "NEW",
    "createdAt": "2026-02-18T13:00:00.000Z"
  }
}
```

### PATCH `/api/qualification-leads/:id`
Atualizar lead

**Body:**
```json
{
  "status": "CONTACTED",
  "notes": "Entrei em contato via WhatsApp"
}
```

### DELETE `/api/qualification-leads/:id`
Deletar lead

**Response:**
```json
{
  "success": true
}
```

---

## 🎨 Painel Administrativo

### Funcionalidades

#### 1. Listagem de Leads
- Tabela com todos os leads
- Informações: Nome, Email, Telefone, Tags, Status, Data

#### 2. Filtros Avançados
- **Busca:** Por nome, email ou telefone
- **Status:** NEW, CONTACTED, QUALIFIED, REJECTED
- **Tags:** Filtrar por qualquer tag do sistema

#### 3. Ações
- **Ver detalhes:** Modal com todas as informações do lead
- **Alterar status:** Botões rápidos para mudar status
- **Excluir:** Remover lead do sistema
- **Exportar CSV:** Download de todos os leads filtrados

#### 4. Estatísticas
- Total de leads
- Leads por status
- Leads por tag

---

## 🚀 Deploy e Configuração

### 1. Aplicar Schema no Banco de Dados

```bash
# No servidor (via SSH)
cd /home/ubuntu/tubarao-backend
npx prisma db push
```

### 2. Rebuild do Backend

```bash
npm run build
pm2 restart all
```

### 3. Deploy do Frontend

```bash
# Local
npm run build
git add .
git commit -m "feat: adiciona sistema de qualificação de leads"
git push origin main
```

O Vercel fará o deploy automático.

### 4. Configurar Link do WhatsApp

Editar o arquivo `pages/public/QualificationPage.tsx` linha 48:

```typescript
const whatsappGroup = 'https://chat.whatsapp.com/SEU_LINK_DO_GRUPO';
```

---

## 📱 URLs de Acesso

### Produção
- **Landing Page:** https://www.tubaraoemprestimo.com.br/#/qualificacao
- **Painel Admin:** https://www.tubaraoemprestimo.com.br/#/admin/qualification-leads

### Desenvolvimento
- **Landing Page:** http://localhost:5173/#/qualificacao
- **Painel Admin:** http://localhost:5173/#/admin/qualification-leads

---

## 🎯 Casos de Uso

### Caso 1: Lead Investidor Experiente
**Perfil:**
- Tem experiência avançada
- Capital acima de 100k
- Quer parceria como investidor

**Tags geradas:**
- TAG_EXPERIENCIA
- TAG_AVANCADO
- TAG_CAPITAL
- TAG_INVESTIDOR_ALTO
- TAG_PARCERIA
- TAG_INVESTIDOR

**Ação:** Prioridade alta para contato

### Caso 2: Lead Iniciante Interessado em Aprender
**Perfil:**
- Sem experiência
- Sem capital
- Quer curso online

**Tags geradas:**
- TAG_INICIANTE
- TAG_APRENDIZADO
- TAG_CURSO

**Ação:** Direcionar para curso/mentoria

### Caso 3: Lead Correspondente
**Perfil:**
- Experiência intermediária
- Tempo parcial
- Quer ser correspondente

**Tags geradas:**
- TAG_EXPERIENCIA
- TAG_DISPONIBILIDADE
- TAG_PARCERIA
- TAG_CORRESPONDENTE

**Ação:** Apresentar programa de correspondentes

---

## 🔧 Manutenção

### Adicionar Nova Tag

1. Adicionar lógica no backend (`qualificationLeads.ts`):
```typescript
if (condicao) {
  tags.push('TAG_NOVA');
}
```

2. Adicionar no array de tags disponíveis no admin (`QualificationLeadsAdmin.tsx`):
```typescript
const availableTags = [
  ...
  'TAG_NOVA'
];
```

### Adicionar Nova Pergunta

1. Adicionar campo no schema Prisma
2. Adicionar etapa no formulário (`QualificationPage.tsx`)
3. Adicionar lógica de tags no backend
4. Atualizar interface `FormData`

---

## 📊 Métricas Sugeridas

- Taxa de conversão por etapa
- Tempo médio de preenchimento
- Tags mais comuns
- Taxa de qualificação (QUALIFIED / TOTAL)
- Origem dos leads (se implementar UTM tracking)

---

## 🔐 Segurança

- ✅ Validação de campos obrigatórios
- ✅ Sanitização de inputs
- ✅ Proteção contra SQL injection (Prisma)
- ✅ Rate limiting (implementar se necessário)
- ✅ CORS configurado

---

## 🐛 Troubleshooting

### Erro ao criar lead
- Verificar se o backend está rodando
- Verificar conexão com banco de dados
- Verificar logs: `pm2 logs tubarao-backend`

### Tags não aparecem
- Verificar lógica de geração de tags no backend
- Verificar se o campo `tags` está sendo salvo corretamente

### Redirecionamento WhatsApp não funciona
- Verificar se o link do grupo está correto
- Verificar se o link está no formato: `https://chat.whatsapp.com/CODIGO`

---

## 📝 Changelog

### v1.0 - 18/02/2026
- ✅ Implementação inicial do sistema
- ✅ Formulário multi-etapas (7 etapas)
- ✅ Sistema de tags automáticas (16 tags)
- ✅ Painel administrativo completo
- ✅ Filtros avançados
- ✅ Exportação CSV
- ✅ API REST completa
- ✅ Integração com WhatsApp

---

## 🎓 Próximas Melhorias

- [ ] Dashboard com gráficos e estatísticas
- [ ] Integração com CRM
- [ ] Envio automático de email de boas-vindas
- [ ] Notificações push para novos leads
- [ ] Score de qualificação automático
- [ ] Integração com WhatsApp Business API
- [ ] UTM tracking para origem dos leads
- [ ] A/B testing de perguntas
- [ ] Funil de conversão visual
- [ ] Relatórios automatizados

---

## 👥 Equipe

**Desenvolvido por:** Claude Code (Anthropic)
**Data:** 18/02/2026
**Projeto:** Tubarão Empréstimos

---

## 📞 Suporte

Para dúvidas ou problemas:
1. Verificar logs do backend: `pm2 logs tubarao-backend`
2. Verificar console do navegador (F12)
3. Consultar esta documentação
4. Verificar status do banco de dados

---

**Fim da documentação** 🦈
