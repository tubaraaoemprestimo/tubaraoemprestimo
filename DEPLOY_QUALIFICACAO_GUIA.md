# 🚀 GUIA DE DEPLOY - Sistema de Qualificação de Leads

**Data:** 18/02/2026
**Status:** ✅ Código commitado e enviado para GitHub

---

## 📋 O que foi criado

### Frontend
- ✅ Landing page de qualificação: `/qualificacao`
- ✅ Painel admin de leads: `/admin/qualification-leads`
- ✅ Formulário multi-etapas (7 etapas)
- ✅ Sistema de tags automáticas

### Backend
- ✅ API REST completa: `/api/qualification-leads`
- ✅ Modelo no banco de dados: `qualification_leads`
- ✅ Rotas CRUD completas
- ✅ Sistema de filtros e busca

### Documentação
- ✅ `RESUMO_QUALIFICACAO.md` - Documentação completa do sistema

---

## 🔧 COMANDOS PARA EXECUTAR NO SERVIDOR

### Opção 1: Executar comandos manualmente

```bash
# 1. Conectar via SSH
ssh -i ssh-key-2026-02-12.key ubuntu@136.248.115.113

# 2. Navegar para o diretório do backend
cd ~/backend/backend

# 3. Fazer pull das alterações
git pull origin main

# 4. Aplicar schema no banco de dados
npx prisma db push

# 5. Gerar Prisma Client
npx prisma generate

# 6. Rebuild do backend
npm run build

# 7. Reiniciar PM2
pm2 restart tubarao-backend

# 8. Verificar logs
pm2 logs tubarao-backend --lines 50
```

### Opção 2: Executar script automático

```bash
# 1. Conectar via SSH
ssh -i ssh-key-2026-02-12.key ubuntu@136.248.115.113

# 2. Executar todos os comandos de uma vez
cd ~/backend/backend && \
git pull origin main && \
npx prisma db push && \
npx prisma generate && \
npm run build && \
pm2 restart tubarao-backend && \
pm2 logs tubarao-backend --lines 50
```

---

## ⚠️ IMPORTANTE: Configurar Link do WhatsApp

Após o deploy, você precisa configurar o link do grupo WhatsApp:

1. Editar o arquivo no servidor:
```bash
nano ~/backend/pages/public/QualificationPage.tsx
```

2. Procurar pela linha 48 e alterar:
```typescript
const whatsappGroup = 'https://chat.whatsapp.com/SEU_LINK_DO_GRUPO';
```

3. Ou fazer localmente e dar push:
- Editar: `D:\Projetos\TUBARÃO EMPRESTIMOS\pages\public\QualificationPage.tsx`
- Linha 48: Alterar o link do WhatsApp
- Commit e push
- Fazer pull no servidor

---

## 🌐 URLs de Acesso

### Produção (após deploy)
- **Landing Page:** https://www.tubaraoemprestimo.com.br/#/qualificacao
- **Painel Admin:** https://www.tubaraoemprestimo.com.br/#/admin/qualification-leads

### Desenvolvimento (local)
- **Landing Page:** http://localhost:5173/#/qualificacao
- **Painel Admin:** http://localhost:5173/#/admin/qualification-leads

---

## ✅ Checklist de Deploy

- [ ] Conectar via SSH no servidor
- [ ] Navegar para `~/backend/backend`
- [ ] Executar `git pull origin main`
- [ ] Executar `npx prisma db push`
- [ ] Executar `npx prisma generate`
- [ ] Executar `npm run build`
- [ ] Executar `pm2 restart tubarao-backend`
- [ ] Verificar logs com `pm2 logs tubarao-backend --lines 50`
- [ ] Configurar link do grupo WhatsApp
- [ ] Testar landing page: https://www.tubaraoemprestimo.com.br/#/qualificacao
- [ ] Testar painel admin: https://www.tubaraoemprestimo.com.br/#/admin/qualification-leads

---

## 🐛 Troubleshooting

### Erro: "Prisma schema validation"
**Solução:** O schema foi corrigido para usar `env("DATABASE_URL")` ao invés de URL hardcoded.

### Erro: "cd: /home/ubuntu/tubarao-backend: No such file or directory"
**Solução:** O diretório correto é `~/backend/backend` (não `tubarao-backend`).

### Erro ao aplicar schema
**Solução:** Verificar se o .env tem a variável `DATABASE_URL` configurada:
```bash
cat ~/backend/backend/.env | grep DATABASE_URL
```

### Backend não reinicia
**Solução:** Verificar status do PM2:
```bash
pm2 status
pm2 logs tubarao-backend --err
```

---

## 📊 Estrutura da Tabela Criada

```sql
CREATE TABLE qualification_leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR NOT NULL,
  email VARCHAR NOT NULL,
  phone VARCHAR NOT NULL,
  has_experience BOOLEAN NOT NULL,
  experience_level VARCHAR,
  has_capital BOOLEAN NOT NULL,
  capital_amount VARCHAR,
  wants_to_learn BOOLEAN NOT NULL,
  learning_interest VARCHAR,
  has_time BOOLEAN NOT NULL,
  time_availability VARCHAR,
  wants_partnership BOOLEAN NOT NULL,
  partnership_type VARCHAR,
  tags TEXT[] DEFAULT '{}',
  status VARCHAR DEFAULT 'NEW',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🎯 Próximos Passos

1. **Deploy no servidor** (executar comandos acima)
2. **Configurar link do WhatsApp** (linha 48 do QualificationPage.tsx)
3. **Testar o formulário** (preencher e verificar se salva no banco)
4. **Testar o painel admin** (verificar filtros e exportação CSV)
5. **Divulgar a landing page** (compartilhar o link)

---

## 📞 Comandos Úteis

```bash
# Ver logs em tempo real
pm2 logs tubarao-backend

# Ver status do PM2
pm2 status

# Reiniciar backend
pm2 restart tubarao-backend

# Ver últimas 100 linhas de log
pm2 logs tubarao-backend --lines 100

# Verificar se o banco está rodando
sudo systemctl status postgresql

# Conectar no banco de dados
psql -U postgres -d tubarao_db
```

---

## 📝 Notas Finais

- ✅ Todo o código foi commitado e enviado para o GitHub
- ✅ O schema do Prisma foi corrigido para usar variável de ambiente
- ✅ A documentação completa está em `RESUMO_QUALIFICACAO.md`
- ✅ O sistema está pronto para deploy

**Basta executar os comandos no servidor e o sistema estará funcionando!**

---

**Desenvolvido por:** Claude Code (Anthropic)
**Data:** 18/02/2026 13:52 UTC
**Commit:** 0bfdaa2

🦈 **Tubarão Empréstimos**
