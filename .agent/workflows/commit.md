---
description: Workflow padrão para commits - sempre atualizar o RESUMO_PROJETO.md antes de commitar
---

## Passos para todo Commit

Sempre que for fazer um commit de alterações no projeto, siga estes passos na ordem:

### 1. Atualizar o RESUMO_PROJETO.md
- Abra o arquivo `RESUMO_PROJETO.md` na raiz do projeto
- Atualize a data em "Última atualização"
- Adicione as alterações feitas na seção "📝 Últimas Alterações"
- Se criou novos arquivos/rotas/tabelas, adicione nas seções correspondentes
- Se alterou fluxos importantes, atualize a documentação do fluxo

### 2. Build de verificação
// turbo
```bash
npx vite build
```

### 3. Git add
```bash
git add -A
```

### 4. Git commit
```bash
git commit -m "tipo: descrição breve das alterações"
```
Tipos: `feat`, `fix`, `refactor`, `style`, `docs`, `chore`

### 5. Git push
```bash
git push origin main
```

### Notas importantes
- O RESUMO_PROJETO.md serve para que outra IA ou desenvolvedor entenda o projeto completo
- Sempre inclua: o que foi alterado, quais arquivos, e como funciona
- Mantenha o formato markdown organizado e scannable
- Se a alteração mudou um fluxo crítico (auth, antifraude, wizard), detalhe o novo comportamento
