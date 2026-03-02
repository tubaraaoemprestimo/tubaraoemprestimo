# 🔧 Implementar Proxy InfoSeek no Backend

## 📍 Problema

A API InfoSeek tem restrição CORS e só aceita requisições de `https://app.infoseekdata.com.br`.

Para resolver, criamos um proxy no backend que faz a chamada à API InfoSeek.

---

## 🚀 Implementação no Backend Node.js

### Localização
Backend está em: **Oracle Cloud VM** (conforme histórico)

### Endpoint a Criar
```
POST /api/infoseek
```

### Código do Endpoint (Node.js + Express)

```javascript
// routes/infoseek.js
const express = require('express');
const router = express.Router();
const axios = require('axios');

const INFOSEEK_API_KEY = 'sk_prod_2de8b4cfd0dd8d3c6f575750759b9160bf13dc4806bc85d8a697421dd0e2d4ec';
const INFOSEEK_BASE_URL = 'https://api.infoseekdata.com.br/api';

// POST /api/infoseek - Proxy para InfoSeek API
router.post('/infoseek', async (req, res) => {
    try {
        const { type, value } = req.body;

        // Validar parâmetros
        if (!type || !value) {
            return res.status(400).json({
                success: false,
                error: 'Parâmetros inválidos. Envie { type: "cpf" ou "cnpj", value: "..." }'
            });
        }

        // Validar tipo
        if (type !== 'cpf' && type !== 'cnpj') {
            return res.status(400).json({
                success: false,
                error: 'Tipo deve ser "cpf" ou "cnpj"'
            });
        }

        console.log(`[InfoSeek Proxy] Validando ${type.toUpperCase()}:`, value);

        // Chamar API InfoSeek
        const endpoint = `${INFOSEEK_BASE_URL}/validate/${type}`;
        const response = await axios.post(endpoint,
            { value },
            {
                headers: {
                    'Authorization': `Bearer ${INFOSEEK_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log(`[InfoSeek Proxy] Resposta ${type.toUpperCase()}:`, response.data);

        // Retornar resposta da InfoSeek
        return res.json(response.data);

    } catch (error) {
        console.error('[InfoSeek Proxy] Erro:', error.message);

        if (error.response) {
            // Erro da API InfoSeek
            return res.status(error.response.status).json({
                success: false,
                error: error.response.data?.message || error.message
            });
        }

        // Erro de conexão
        return res.status(500).json({
            success: false,
            error: 'Erro ao conectar com a API InfoSeek'
        });
    }
});

module.exports = router;
```

### Registrar Rota no App Principal

```javascript
// app.js ou index.js
const infoseekRoutes = require('./routes/infoseek');

// ... outras rotas ...

app.use('/api', infoseekRoutes);
```

---

## 🧪 Testar o Endpoint

### Via cURL
```bash
curl -X POST https://app-api.tubaraoemprestimo.com.br/api/infoseek \
  -H "Content-Type: application/json" \
  -d '{"type": "cpf", "value": "12345678900"}'
```

### Via Postman
```
POST https://app-api.tubaraoemprestimo.com.br/api/infoseek

Body (JSON):
{
  "type": "cpf",
  "value": "12345678900"
}
```

### Resposta Esperada
```json
{
  "success": true,
  "data": {
    "valid": true,
    "document": "123.456.789-00",
    "name": "JOÃO SILVA",
    "birthDate": "1990-01-15",
    "situation": "Regular"
  },
  "meta": {
    "type": "cpf",
    "environment": "production",
    "latency": "45ms",
    "requestId": "req_12345"
  }
}
```

---

## 📦 Dependências Necessárias

```bash
npm install axios
```

---

## 🔐 Segurança

### Variável de Ambiente (Recomendado)
Em vez de hardcoded, use variável de ambiente:

```javascript
// .env
INFOSEEK_API_KEY=sk_prod_2de8b4cfd0dd8d3c6f575750759b9160bf13dc4806bc85d8a697421dd0e2d4ec

// No código
const INFOSEEK_API_KEY = process.env.INFOSEEK_API_KEY;
```

### Rate Limiting (Opcional)
```javascript
const rateLimit = require('express-rate-limit');

const infoseekLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 60 // 60 requisições por minuto
});

router.post('/infoseek', infoseekLimiter, async (req, res) => {
    // ...
});
```

---

## ✅ Checklist de Implementação

- [ ] Criar arquivo `routes/infoseek.js`
- [ ] Instalar `axios` se necessário
- [ ] Registrar rota no app principal
- [ ] Adicionar chave API no `.env`
- [ ] Reiniciar servidor backend
- [ ] Testar endpoint com cURL/Postman
- [ ] Testar no frontend (DataSearch)
- [ ] Verificar logs no servidor

---

## 🚀 Deploy

Após implementar:

1. **Commit no backend:**
```bash
git add routes/infoseek.js
git commit -m "feat: Adicionar proxy InfoSeek API"
git push
```

2. **Reiniciar servidor na VM Oracle:**
```bash
ssh usuario@vm-oracle
cd /caminho/do/backend
pm2 restart tubarao-api
# ou
systemctl restart tubarao-api
```

3. **Testar no frontend:**
- Acessar: https://www.tubaraoemprestimo.com.br/#/admin/data-search
- Buscar um CPF
- Verificar console do navegador

---

## 📝 Notas

- A chave API está configurada para **produção** (`sk_prod_*`)
- O proxy resolve o problema de CORS
- O backend faz a chamada à InfoSeek e retorna para o frontend
- Latência adicional: ~10-20ms (proxy)

---

**Status:** ⏳ Aguardando implementação no backend
**Prioridade:** 🔴 Alta (necessário para validação de CPF funcionar)
