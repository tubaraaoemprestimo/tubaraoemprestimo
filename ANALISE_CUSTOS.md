# 💰 Análise de Custos — Tubarão Empréstimos
## Infraestrutura Real para Operação e Revenda

> **Data:** 10/02/2026
> **Cenários:** Operação Solo, Crescimento Moderado, Escala

---

## 📊 Resumo Executivo

| Cenário | Usuários | Custo Mensal (R$) | Custo por Usuário |
|---------|----------|-------------------|-------------------|
| 🟢 **Início** (atual) | 1-50 | R$ 210 - 280 | R$ 4,20 - 5,60 |
| 🟡 **Crescimento** | 50-500 | R$ 480 - 850 | R$ 0,96 - 1,70 |
| 🔴 **Escala** | 500-5.000 | R$ 1.200 - 2.500 | R$ 0,24 - 0,50 |

---

## 🔧 Stack Atual — Detalhamento por Serviço

### 1. 🌐 Domínio (Registro.br)
| Item | Custo |
|------|-------|
| Domínio .com.br | **R$ 40,00/ano** (~R$ 3,33/mês) |
| **Observação** | Registro.br é anual, não mensal |

---

### 2. ☁️ Google Cloud VM (Evolution API / WhatsApp)

**Tier Gratuito (atual):**
- VM `e2-micro` (2 vCPU, 1GB RAM)
- 30GB SSD
- **Custo: R$ 0** (gratuito nos primeiros 12 meses)

**Quando sobe de preço:**
| Cenário | VM | RAM | SSD | Custo Mensal (USD) | Custo (R$) |
|---------|-----|-----|-----|--------------------|------------|
| Após tier free | e2-micro | 1GB | 30GB | ~$7/mês | ~R$ 42 |
| 50-200 usuários | e2-small | 2GB | 30GB | ~$15/mês | ~R$ 90 |
| 200-1000 usuários | e2-medium | 4GB | 50GB | ~$34/mês | ~R$ 205 |
| 1000+ usuários | e2-standard-2 | 8GB | 100GB | ~$67/mês | ~R$ 400 |

> **Dica:** A Evolution API com 1 instância WhatsApp consome ~300MB RAM.
> Para múltiplas instâncias (revenda), cada instância adicional = ~200MB RAM.

**Quando escalar:**
- 1 instância WhatsApp = e2-micro basta
- 5 instâncias = e2-small (2GB)
- 10+ instâncias = e2-medium (4GB)
- 50+ instâncias = considerar Docker Swarm ou e2-standard

---

### 3. 🚀 Vercel (Deploy/Hosting)

| Plano | Limite | Custo (USD) | Custo (R$) |
|-------|--------|-------------|------------|
| **Hobby** (atual) | 100GB bandwidth, 1 projeto comercial | **Grátis** | R$ 0 |
| **Pro** | 1TB bandwidth, analytics, proteção | $20/mês | ~R$ 120 |
| **Enterprise** | Ilimitado, SLA, suporte | $500+/mês | ~R$ 3.000+ |

**Quando migrar para Pro:**
- Quando tiver mais de 100 visitas/dia consistentes
- Quando precisar de domínio customizado com SSL (já funciona no free)
- Quando precisar de analytics avançado
- **Recomendação:** Migrar para Pro quando faturar > R$ 2.000/mês

**⚠️ Importante para revenda:**
- No plano Hobby, só pode ter **1 projeto comercial**
- Se for vender como SaaS (multi-tenant), o plano Pro é suficiente
- Se cada cliente tiver deploy separado, precisa de 1 conta Pro por cliente

---

### 4. 🗄️ Supabase (Banco de Dados + Auth + Edge Functions)

| Plano | Limite | Custo (USD) | Custo (R$) |
|-------|--------|-------------|------------|
| **Free** (atual) | 500MB banco, 2GB storage, 50K auth users, 500K edge invocations | **Grátis** | R$ 0 |
| **Pro** | 8GB banco, 100GB storage, 100K auth users, 2M edge invocations | $25/mês | ~R$ 150 |
| **Team** | Ilimitado, suporte prioritário | $599/mês | ~R$ 3.600 |

**Quando vai estourar o Free:**
| Recurso | Limite Free | Quando estoura | Impacto |
|---------|-------------|----------------|---------|
| **Banco de dados** | 500MB | ~2.000-5.000 solicitações | Precisa do Pro |
| **Storage (docs/fotos)** | 1GB | ~500 clientes com documentos | Precisa do Pro |
| **Edge Functions** | 500K invocações/mês | ~100 clientes ativos/dia | Precisa do Pro |
| **Auth users** | 50.000 | Muito difícil estourar | OK |
| **Realtime** | 200 conexões simultâneas | ~100 clientes online ao mesmo tempo | Precisa do Pro |

**Estimativa realista:**
- 50 clientes → Free basta
- 100-500 clientes → **Pro ($25/mês)**
- 500+ clientes → Pro + add-ons de storage

> **Dica:** Cada solicitação de empréstimo com 5 fotos = ~5MB de storage.
> 500 clientes × 5MB = 2.5GB → já precisa do Pro.

---

### 5. 🤖 Google Gemini API (IA do Chatbot)

| Plano | Limite | Custo |
|-------|--------|-------|
| **Free** (atual) | 15 RPM, 1M tokens/min, 1.500 req/dia | **Grátis** |
| **Pay-as-you-go** | Ilimitado | $0.075/1M tokens input, $0.30/1M tokens output (Gemini 1.5 Flash) |

**Modelo usado:** Gemini 1.5 Flash (mais barato)

**Custo estimado por conversa:**
- Média de 5 mensagens por conversa
- ~500 tokens por mensagem (input + output)
- 1 conversa ≈ 2.500 tokens ≈ $0.0003

| Volume | Conversas/mês | Custo (USD) | Custo (R$) |
|--------|---------------|-------------|------------|
| Baixo | 500 | ~$0.15 | ~R$ 1 |
| Médio | 5.000 | ~$1.50 | ~R$ 9 |
| Alto | 50.000 | ~$15.00 | ~R$ 90 |

> **Conclusão:** Gemini é MUITO barato. Mesmo com 50.000 conversas/mês, custa menos de R$ 100.

---

### 6. 📋 API CPF/CNPJ

| Item | Custo |
|------|-------|
| Plano atual | **R$ 160,00/mês** |

**Observação:** Este é um custo fixo que não escala muito.
Geralmente os planos de consulta CPF/CNPJ são:
- R$ 80-160/mês para 500-2.000 consultas
- R$ 300-500/mês para 5.000-10.000 consultas

---

### 7. 📱 WhatsApp / Evolution API

| Item | Custo |
|------|-------|
| Chip/número WhatsApp | ~R$ 15-30/mês (plano de dados) |
| Evolution API (self-hosted) | **Grátis** (roda na VM do Google) |
| Evolution API (cloud) | ~$19-49/mês se usar o serviço deles |

---

## 📋 CENÁRIO 1: Início (1-50 clientes) — SEU CUSTO ATUAL

| Serviço | Custo Mensal (R$) |
|---------|-------------------|
| Domínio Registro.br | R$ 3,33 |
| Google Cloud VM (free tier) | R$ 0,00 |
| Vercel (Hobby) | R$ 0,00 |
| Supabase (Free) | R$ 0,00 |
| Gemini API (Free) | R$ 0,00 |
| API CPF/CNPJ | R$ 160,00 |
| Chip WhatsApp | R$ 20,00 |
| **TOTAL** | **R$ 183,33** |

> Adicione seu tempo de desenvolvimento/suporte = custo real maior.

---

## 📋 CENÁRIO 2: Crescimento (50-500 clientes)

| Serviço | Custo Mensal (R$) |
|---------|-------------------|
| Domínio Registro.br | R$ 3,33 |
| Google Cloud VM (e2-small) | R$ 90,00 |
| Vercel (Pro) | R$ 120,00 |
| Supabase (Pro) | R$ 150,00 |
| Gemini API (pay-as-you-go) | R$ 10,00 |
| API CPF/CNPJ | R$ 160,00 |
| Chip WhatsApp | R$ 20,00 |
| **TOTAL** | **R$ 553,33** |

---

## 📋 CENÁRIO 3: Escala (500-5.000 clientes)

| Serviço | Custo Mensal (R$) |
|---------|-------------------|
| Domínio Registro.br | R$ 3,33 |
| Google Cloud VM (e2-medium) | R$ 205,00 |
| Vercel (Pro) | R$ 120,00 |
| Supabase (Pro + storage add-on) | R$ 300,00 |
| Gemini API | R$ 90,00 |
| API CPF/CNPJ (plano maior) | R$ 400,00 |
| Chip WhatsApp × 3 | R$ 60,00 |
| **TOTAL** | **R$ 1.178,33** |

---

## 💼 MODELO DE REVENDA — Preço sugerido para seu cliente

### Opção A: Venda Única + Mensalidade
| Item | Valor |
|------|-------|
| Implantação (setup + personalização) | R$ 2.000 - 5.000 |
| Mensalidade (suporte + infraestrutura) | R$ 300 - 800/mês |
| Customizações extras | R$ 100 - 300/hora |

### Opção B: SaaS (Assinatura mensal)
| Plano | Valor | Inclui |
|-------|-------|--------|
| **Básico** | R$ 197/mês | Sistema + 1 WhatsApp + até 100 clientes |
| **Profissional** | R$ 397/mês | Sistema + 3 WhatsApp + até 500 clientes + IA |
| **Enterprise** | R$ 797/mês | Sistema completo + ilimitado + suporte VIP |

### Opção C: Licença para revenda (White-label)
| Item | Valor |
|------|-------|
| Licença única para revender | R$ 5.000 - 15.000 |
| Royalty por cliente final | R$ 30-50/mês por sub-cliente |
| Suporte técnico ao revendedor | R$ 500/mês |

---

## 📊 Margem de Lucro por Cenário de Revenda

### Se vender como SaaS a R$ 397/mês:

| Escala | Clientes pagantes | Receita | Custo Infra | Lucro Bruto | Margem |
|--------|-------------------|---------|-------------|-------------|--------|
| Início | 5 | R$ 1.985 | R$ 183 | R$ 1.802 | **91%** |
| Crescendo | 20 | R$ 7.940 | R$ 553 | R$ 7.387 | **93%** |
| Escala | 100 | R$ 39.700 | R$ 1.178 | R$ 38.522 | **97%** |

> **Margem de lucro é ALTÍSSIMA** porque SaaS escala sem custos proporcionais.

---

## ⚠️ Custos Escondidos (não esqueça!)

| Item | Estimativa Mensal |
|------|-------------------|
| Seu tempo de desenvolvimento/bug fix | Valor da sua hora × horas |
| Suporte ao cliente (WhatsApp, email) | 10-20h/mês |
| Marketing/Ads para aquisição | R$ 500-2.000/mês |
| Contador/MEI/Empresa | R$ 80-200/mês |
| Certificado codesign (se PWA app store) | R$ 0 (não necessário para PWA) |
| Backup extra / disaster recovery | R$ 0 (Supabase faz backup automático no Pro) |

---

## 🎯 Recomendação Final

### Para você (desenvolvedor):
1. **Hoje:** Mantenha tudo no free tier (R$ 183/mês só CPF + domínio)
2. **Com 50+ clientes:** Migre Supabase e Vercel para Pro (R$ 553/mês)
3. **Com 200+ clientes:** Scale a VM e contrate alguém para suporte

### Para seu cliente (revendedor):
- **Preço mínimo de venda:** R$ 297/mês (para cobrir custos + margem)
- **Preço ideal:** R$ 497/mês (SaaS com boa margem)
- **Se vender licenças:** R$ 5.000-10.000 + R$ 200/mês suporte

### Modelo recomendado:
> **SaaS a R$ 397/mês** = custo real ~R$ 50/cliente, lucro de R$ 347/cliente (87% margem)

---

## 📌 Dicas para Reduzir Custos

1. **Supabase Storage:** Comprimir imagens antes do upload (já implementado no Wizard)
2. **Edge Functions:** Cache de consultas CPF repetidas (não consultar mesmo CPF 2x)
3. **VM:** Usar spot/preemptible VM no Google Cloud (60-80% mais barato)
4. **Gemini:** Usar Gemini Flash (10x mais barato que Pro)
5. **Multi-tenant:** Um único deploy serve vários clientes (não criar deploy por cliente)
