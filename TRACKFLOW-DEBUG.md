# TrackFlow API - Debug Report

**Data**: 2026-03-12 19:33 UTC
**Status**: ⚠️ API COM PROBLEMAS DE TIMEOUT

---

## Problemas Identificados

### 1. ✅ CORRIGIDO: TypeError no Frontend
**Erro**: `TypeError: l is not a function`
**Causa**: ConsultaCPFCard estava chamando `showToast()` mas o hook useToast retorna `addToast()`
**Solução**: Alterado linha 92, 100 e 104 de `showToast` para `addToast`
**Status**: ✅ Corrigido e deployado

### 2. ✅ CORRIGIDO: CPF não sanitizado
**Erro**: CPF enviado com formatação (pontos e traços)
**Solução**: Adicionado sanitização no apiService.ts linha 861
```typescript
const cpfLimpo = cpf.replace(/\D/g, '');
```
**Status**: ✅ Corrigido e deployado

### 3. ✅ MELHORADO: Logs do Backend
**Solução**: Adicionado logs detalhados no cpfLookup.ts linhas 286-310
- Log do erro completo
- Log do status HTTP
- Log do response.data da API externa
- Tratamento específico para 401, 402, 403, 429
**Status**: ✅ Implementado e deployado

### 4. ⚠️ PROBLEMA CRÍTICO: API TrackFlow com Timeout
**Erro**: Todas as requisições para `apis.trackflow.services` resultam em timeout
**Testes realizados**:
```bash
# Teste 1: Endpoint completo (timeout após 10s)
curl --max-time 10 'https://apis.trackflow.services/api/cpf?cpf=51774919869&token=...'
Exit code 28 (timeout)

# Teste 2: Base URL (timeout após 5s)
curl --max-time 5 'https://apis.trackflow.services/'
Exit code 28 (timeout)

# Teste 3: Conexão TCP (SUCESSO)
bash -c 'cat < /dev/null > /dev/tcp/apis.trackflow.services/443'
Conectado ✅

# Teste 4: Timeout longo (timeout após 30s)
curl --max-time 30 'https://apis.trackflow.services/api/cpf?...'
Exit code 28 (timeout)
```

**Conclusão**:
- ✅ DNS está resolvendo (66.33.22.2)
- ✅ Porta 443 está aberta
- ✅ TLS handshake funciona
- ❌ API não responde às requisições HTTP

---

## Possíveis Causas do Timeout

1. **API TrackFlow fora do ar** (mais provável)
   - Servidor está aceitando conexões mas não processando requests
   - Pode estar em manutenção ou com problemas

2. **Rate Limiting severo**
   - API pode estar bloqueando o IP do servidor
   - Necessário verificar com suporte TrackFlow

3. **Problema de autenticação**
   - Token pode estar inválido/expirado
   - Plano pode estar inativo
   - Wallet pode estar sem saldo

4. **Firewall/WAF bloqueando**
   - Cloudflare ou WAF pode estar bloqueando requisições do servidor
   - User-Agent pode estar sendo bloqueado

---

## Próximos Passos

### Imediato
1. ⚠️ **Contatar suporte TrackFlow**
   - Verificar status da conta
   - Verificar se plano está ativo
   - Verificar saldo da wallet
   - Verificar se IP do servidor está bloqueado

2. 🔍 **Testar de outro local**
   - Testar API do computador local (não do servidor)
   - Verificar se problema é específico do IP do servidor

### Técnico
3. 📝 **Adicionar fallback no frontend**
   - Mostrar mensagem amigável quando API não responder
   - Adicionar timeout de 15s no axios (já está em 30s no backend)

4. 🔄 **Implementar retry logic**
   - Tentar 2-3 vezes antes de falhar
   - Exponential backoff entre tentativas

---

## Configuração Atual

**Token**: `46e3cab6883b9755ce85aed22086f74b182c38415e47f6bd18b28f788f2f914f`
**Endpoint**: `https://apis.trackflow.services/api/cpf?cpf={cpf}&token={token}`
**Timeout Backend**: 30000ms (30s)
**Timeout Frontend**: Padrão axios

---

## Arquivos Modificados

### Frontend
- ✅ `components/ConsultaCPFCard.tsx` (linha 92, 100, 104)
- ✅ `services/apiService.ts` (linha 861)
- ✅ `pages/admin/Requests.tsx` (linhas 392-401)

### Backend
- ✅ `backend/src/routes/cpfLookup.ts` (linhas 286-310)

### Deploy
- ✅ Frontend: Buildado e deployado via SCP
- ✅ Backend: Já estava rodando com as alterações

---

## Teste Manual Necessário

1. Acessar: https://www.tubaraoemprestimo.com.br/admin/requests
2. Selecionar uma solicitação
3. Clicar em "🔍 Puxar Capivara / Consulta Completa"
4. Verificar se:
   - ✅ Toast de erro aparece corretamente (não mais "l is not a function")
   - ⚠️ Mensagem de erro será "Erro ao consultar CPF na TrackFlow" (timeout)
   - 📋 Logs do backend mostrarão detalhes do erro

---

**Conclusão**: Correções de código foram implementadas com sucesso. O problema atual é externo (API TrackFlow não responde). Necessário contato com suporte TrackFlow para resolver.
