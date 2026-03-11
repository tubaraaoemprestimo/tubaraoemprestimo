# CLAUDE.md - Instruções para Claude Code

## 🎯 Uso Automático de Skills

Você tem acesso a **713+ skills especializados** em `.claude/skills/skills/`. 

### Regra Principal
**SEMPRE consulte os skills relevantes automaticamente** antes de executar tarefas complexas. Não espere o usuário pedir - detecte a necessidade e use.

### Como Usar Skills

1. **Localize o skill** em `.claude/skills/skills/[nome-do-skill]/SKILL.md`
2. **Leia o arquivo SKILL.md** para obter as instruções específicas
3. **Aplique as melhores práticas** documentadas no skill

### Mapeamento Automático de Skills

| Quando o usuário pedir... | Use estes skills |
|---------------------------|------------------|
| Componente React | `react-patterns`, `react-best-practices` |
| TypeScript | `typescript-expert`, `typescript-pro` |
| Next.js | `nextjs-best-practices`, `nextjs-app-router-patterns` |
| Supabase/PostgreSQL | `postgres-best-practices`, `supabase-automation` |
| API REST | `api-design-principles`, `api-patterns` |
| Testes | `test-driven-development`, `testing-patterns`, `playwright-skill` |
| Segurança | `api-security-best-practices`, `vulnerability-scanner` |
| Performance | `web-performance-optimization`, `performance-profiling` |
| SEO | `seo-audit`, `seo-fundamentals` |
| Docker/Deploy | `docker-expert`, `vercel-deployment` |
| WhatsApp | `whatsapp-automation` |
| CSS/Tailwind | `tailwind-patterns`, `tailwind-design-system` |
| Documentação | `documentation-templates`, `readme` |
| Git/PR | `git-advanced-workflows`, `create-pr` |
| Debug | `debugging-strategies`, `systematic-debugging` |
| Refatoração | `code-refactoring-refactor-clean`, `clean-code` |

### Índice Completo
O arquivo `.claude/skills/skills_index.json` contém a lista completa de todos os skills disponíveis.

### Buscar Skills
Para encontrar skills relevantes, busque em `.claude/skills/skills/` por palavras-chave.

---

## 📁 Estrutura do Projeto

Este é o projeto **Tubarão Empréstimos** - um sistema de empréstimos com:
- Frontend React + TypeScript + Vite
- Backend Supabase (PostgreSQL + Edge Functions)
- PWA com push notifications
- Integração WhatsApp via Evolution API
- Deploy na Vercel

### Tecnologias Principais
- React 18 + TypeScript
- Vite
- Supabase (Auth, Database, Storage, Edge Functions)
- Tailwind CSS (opcional)
- Recharts (gráficos)
- Lucide React (ícones)

### Comandos
```bash
npm run dev      # Desenvolvimento
npm run build    # Build produção
npm run preview  # Preview do build
```

### Convenções
- Componentes em PascalCase
- Arquivos .tsx para componentes React
- Serviços em /services
- Páginas em /pages/[area]/
- Tipos em /types.ts

---

## 🔥 IMPORTANTE

1. **Use skills automaticamente** - não espere ser solicitado
2. **Priorize qualidade** - aplique as melhores práticas dos skills
3. **Seja proativo** - ao detectar uma tarefa, consulte o skill relevante primeiro
4. **Documente** - explique qual skill está usando e por quê
