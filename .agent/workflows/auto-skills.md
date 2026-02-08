---
description: Como usar skills automaticamente quando precisar de conhecimento especializado
---

# Uso Automático de Skills

## Localização dos Skills
Os skills estão em `.agent/skills/skills/` organizados por categoria.

## Quando Usar Skills
O agente deve consultar automaticamente os skills quando:

1. **Desenvolvimento Web/React** → consultar `react-patterns`, `typescript-expert`
2. **Supabase/Banco de dados** → consultar `supabase`, `postgres-best-practices`
3. **Segurança** → consultar `api-security-best-practices`, `vulnerability-scanner`
4. **DevOps/Deploy** → consultar `vercel-deployment`, `docker-expert`
5. **Testes** → consultar `test-driven-development`, `testing-patterns`
6. **SEO/Marketing** → consultar `seo-audit`, `copywriting`
7. **Arquitetura** → consultar `architecture`, `senior-architect`

## Como Consultar
Para usar um skill, ler o arquivo `SKILL.md` dentro da pasta do skill:
```
.agent/skills/skills/[nome-do-skill]/SKILL.md
```

## Index de Skills
O arquivo `.agent/skills/skills_index.json` contém a lista completa de todos os skills disponíveis com suas descrições.

## Consulta Rápida
Usar `grep_search` para encontrar skills relevantes no diretório `.agent/skills/skills/`
