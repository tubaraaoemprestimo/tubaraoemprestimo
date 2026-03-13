# 🧪 Teste Manual TrackFlow - Passo a Passo

**Data:** 2026-03-13
**Objetivo:** Validar as 5 APIs do TrackFlow antes de pagar

---

## 📋 Preparação

1. Acesse: https://www.tubaraoemprestimo.com.br
2. Faça login como ADMIN
3. No menu lateral, clique em **"Investigações"**
4. Você verá a tela com 5 abas

---

## ✅ Teste 1: Consulta CPF

### Passos:
1. Clique na aba **"Consulta CPF"**
2. Digite um CPF válido: `12345678900` (ou use um CPF real de cliente)
3. Clique em **"Buscar CPF"**

### Resultado Esperado:
- ✅ Se tiver crédito: JSON com dados do CPF (nome, endereços, telefones, parentes)
- ⚠️ Se sem crédito: Erro "Limite diário atingido"
- 📊 Clique em "Ver Histórico" → deve aparecer a consulta

### O que validar:
- [ ] Dados são precisos?
- [ ] Informações úteis para análise de crédito?
- [ ] Endereços atualizados?
- [ ] Telefones válidos?

---

## ✅ Teste 2: Consulta CNPJ

### Passos:
1. Clique na aba **"Consulta CNPJ"**
2. Digite: `33478572000130` (ou use um CNPJ real)
3. Clique em **"Buscar CNPJ"**

### Resultado Esperado:
- ✅ JSON com razão social, endereço, sócios, atividades, situação cadastral

### O que validar:
- [ ] Dados da empresa corretos?
- [ ] Lista de sócios completa?
- [ ] Situação cadastral atualizada?
- [ ] Endereço correto?

---

## ✅ Teste 3: Consulta Contatos

### Passos:
1. Clique na aba **"Consulta Contatos"**
2. Preencha **pelo menos 1 campo**:
   - CPF: `12345678900`
   - OU Telefone: `11999998888`
   - OU E-mail: `teste@email.com`
   - OU Nome: `João Silva`
3. Clique em **"Buscar Contatos"**

### Resultado Esperado:
- ✅ Lista de contatos relacionados (telefones, e-mails, endereços)

### O que validar:
- [ ] Retorna múltiplos contatos?
- [ ] Telefones são válidos?
- [ ] E-mails são reais?
- [ ] Útil para localizar cliente?

---

## ✅ Teste 4: Consulta Nome/Endereço

### Passos:
1. Clique na aba **"Nome/Endereço"**
2. Digite um nome: `João Silva`
3. Opcionalmente: UF `SP`, Cidade `São Paulo`
4. Clique em **"Buscar por Nome/Endereço"**

### Resultado Esperado:
- ✅ Lista de pessoas com nome similar e seus endereços

### O que validar:
- [ ] Retorna múltiplas pessoas?
- [ ] Endereços completos?
- [ ] Útil para encontrar cliente sem CPF?
- [ ] Filtros de UF/Cidade funcionam?

---

## ✅ Teste 5: Histórico Veicular

### Passos:
1. Clique na aba **"Histórico Veicular"**
2. Selecione tipo: **"Placa"**
3. Digite: `ABC1234` (ou use uma placa real de garantia)
4. Clique em **"Buscar Veículo"**

### Resultado Esperado:
- ✅ Histórico de proprietários, débitos, restrições, leilão

### O que validar:
- [ ] Histórico de proprietários completo?
- [ ] Mostra débitos (IPVA, multas)?
- [ ] Indica se tem restrição (roubo, leilão)?
- [ ] Útil para validar garantia?

---

## 🔄 Teste de Cache (24h)

### Passos:
1. Faça uma consulta (ex: CPF)
2. **Imediatamente** faça a **mesma consulta** novamente
3. Observe o toast (mensagem)

### Resultado Esperado:
- ✅ Segunda consulta deve mostrar: **"Consulta em cache (últimas 24h)"**
- ✅ Resultado instantâneo (não gasta crédito)
- ✅ No histórico, ambas aparecem mas só 1 gastou crédito

---

## 📊 Teste de Histórico

### Passos:
1. Clique em **"Ver Histórico"** (botão no topo)
2. Observe a lista de consultas

### Resultado Esperado:
- ✅ Badge mostra total de consultas
- ✅ Ícone verde (✓) = sucesso
- ✅ Ícone vermelho (⚠) = erro
- ✅ Mostra data/hora de cada consulta
- ✅ Clique em uma consulta → carrega resultado

---

## 🎯 Critérios de Decisão

### ✅ VALE A PENA PAGAR SE:

- **Precisão:** Dados corretos em >80% das consultas
- **Atualização:** Informações dos últimos 6 meses
- **Utilidade:** Dados que você NÃO tem em outras fontes
- **Economia:** Economiza >2h/dia de pesquisa manual
- **ROI:** Evita 1 inadimplência/mês = já pagou o plano

### ❌ NÃO VALE A PENA SE:

- **Erros:** Muitos "CPF não encontrado" (>50%)
- **Desatualizado:** Dados de >1 ano atrás
- **Genérico:** Informações que você já tem no cadastro
- **Volume:** Limite diário muito baixo para seu uso
- **Custo:** Preço > economia de tempo

---

## 💰 Planos TrackFlow (Referência)

| Plano | Consultas/Mês | Preço Estimado |
|-------|---------------|----------------|
| Gratuito | 5/dia (1 de cada tipo) | R$ 0 |
| Básico | 100 | ~R$ 200 |
| Pro | 500 | ~R$ 800 |
| Enterprise | Ilimitado | Sob consulta |

**Nota:** Preços são estimativas. Consulte o dashboard TrackFlow para valores exatos.

---

## 📝 Checklist de Validação

Após 5 dias de teste (1 API por dia):

- [ ] **Dia 1:** Testei CPF - Dados úteis? ⭐⭐⭐⭐⭐
- [ ] **Dia 2:** Testei CNPJ - Dados úteis? ⭐⭐⭐⭐⭐
- [ ] **Dia 3:** Testei Contatos - Dados úteis? ⭐⭐⭐⭐⭐
- [ ] **Dia 4:** Testei Nome/Endereço - Dados úteis? ⭐⭐⭐⭐⭐
- [ ] **Dia 5:** Testei Veículo - Dados úteis? ⭐⭐⭐⭐⭐
- [ ] Cache de 24h funcionou corretamente
- [ ] Histórico salvou todas as consultas
- [ ] Interface é fácil de usar
- [ ] Tempo de resposta é aceitável (<5s)

---

## 🚀 Próximos Passos

### Se decidir PAGAR:

1. Acesse: https://apis.trackflow.services/dashboard/plan
2. Login: `Jefferson.22gs@gmail.com` / `Fla61626*`
3. Escolha o plano adequado ao seu volume
4. Após pagamento, copie o novo token
5. Envie o token para atualizar no backend

### Se decidir NÃO PAGAR:

- Sistema continua funcionando com 5 consultas gratuitas/dia
- Cache de 24h continua economizando créditos
- Histórico continua salvando consultas

---

## 📞 Suporte

**Dúvidas sobre o sistema:**
- Verifique logs no PM2: `pm2 logs tubarao-backend | grep TrackFlow`
- Consulte histórico no banco: `SELECT * FROM "TrackFlowQuery" ORDER BY "createdAt" DESC LIMIT 10;`

**Dúvidas sobre a API TrackFlow:**
- Dashboard: https://apis.trackflow.services/dashboard
- Documentação: https://apis.trackflow.services/docs

---

**Última atualização:** 2026-03-13
**Status:** ✅ Sistema 100% funcional e pronto para validação
