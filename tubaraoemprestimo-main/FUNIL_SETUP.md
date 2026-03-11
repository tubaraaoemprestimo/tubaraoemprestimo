# Instruções de Setup do Funil de Vendas

## 1. Migração do Banco de Dados

### Passo 1: Mesclar o schema do funil com o schema principal

O arquivo `prisma/schema-funil.prisma` contém os modelos necessários para o funil. Você precisa adicionar esses modelos ao seu `prisma/schema.prisma` principal.

Adicione os seguintes modelos ao final do seu `schema.prisma`:

```prisma
// Model para registrar vendas/leads do funil
model Lead {
  id        String   @id @default(cuid())
  nome      String
  email     String?
  whatsapp  String?
  produto   String   // Ex: "Método Tubarão - Fundador", "Módulo Limpa Nome", etc.
  valor     Decimal  @db.Decimal(10, 2)
  status    String   @default("PENDENTE") // PENDENTE, APROVADO, CANCELADO
  etapa     Int      // 1, 2, 3, 4 - qual etapa do funil
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([email])
  @@index([status])
  @@index([createdAt])
  @@map("leads")
}

// Model para aplicações da Mentoria Presencial (High Ticket)
model MentoriaApplication {
  id                  String   @id @default(cuid())
  nome                String
  whatsapp            String
  cidade              String
  capitalDisponivel   String   // Pode ser faixa ou valor exato
  experiencia         String   // Ex: "Iniciante", "Intermediário", "Avançado"
  objetivo            String   @db.Text
  status              String   @default("PENDENTE") // PENDENTE, APROVADO, REJEITADO, CONTATADO
  observacoes         String?  @db.Text
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@index([status])
  @@index([createdAt])
  @@map("mentoria_applications")
}

// Model para configurações do funil (opcional - para admin)
model FunnelConfig {
  id                    String   @id @default(cuid())
  countdownEndDate      DateTime // Data final do contador
  precoFundador         Decimal  @default(497) @db.Decimal(10, 2)
  precoOficial          Decimal  @default(697) @db.Decimal(10, 2)
  desabilitarAposExpira Boolean  @default(false)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@map("funnel_config")
}
```

### Passo 2: Gerar e executar a migração

```bash
# Gerar a migração
npx prisma migrate dev --name add_funnel_models

# Ou se estiver em produção
npx prisma migrate deploy
```

### Passo 3: Gerar o Prisma Client atualizado

```bash
npx prisma generate
```

---

## 2. Configuração dos Links de Checkout Asaas

Você precisa substituir os links placeholder pelos links reais do Asaas:

### ETAPA 1 - Pré-Lançamento
**Arquivo:** `app/funil/pre-lancamento/page.tsx`
**Linha 12:**
```typescript
const ASAAS_CHECKOUT_URL = 'https://www.asaas.com/c/seu-link-aqui';
```
**Substituir por:** Link do checkout do Método Tubarão (R$ 497/697)

### ETAPA 2 - Pós-Compra (Upsells)
**Arquivo:** `app/funil/pos-compra/page.tsx`
**Linhas 8-9:**
```typescript
const ASAAS_LIMPA_NOME_URL = 'https://www.asaas.com/c/limpa-nome-link';
const ASAAS_FINANCIAMENTO_MOTO_URL = 'https://www.asaas.com/c/financiamento-moto-link';
```
**Substituir por:**
- Link do Módulo Limpa Nome (R$ 297)
- Link do Módulo Financiamento de Moto (R$ 497)

### ETAPA 3 - Mentoria Online
**Arquivo:** `app/funil/mentoria-online/page.tsx`
**Linha 8:**
```typescript
const ASAAS_MENTORIA_ONLINE_URL = 'https://www.asaas.com/c/mentoria-online-link';
```
**Substituir por:** Link da Mentoria Online em Grupo (R$ 997)

---

## 3. Upload dos Vídeos

Coloque os vídeos na pasta `public/videos/`:

- `01-pre-lancamento.mp4` - Vídeo de vendas principal (ETAPA 1)
- `02-upsell-modulos.mp4` - Pitch dos módulos complementares (ETAPA 2)
- `03-pitch-mentorias.mp4` - Pitch da mentoria online (ETAPA 3)
- `04-mentoria-presencial.mp4` - Pitch da mentoria presencial (ETAPA 4)
- `05-obrigado-final.mp4` - Vídeo de agradecimento e próximos passos

### Thumbnails (opcional)
Coloque as thumbnails na pasta `public/images/`:
- `video-thumbnail.jpg`
- `upsell-thumbnail.jpg`
- `mentoria-thumbnail.jpg`
- `mentoria-presencial-thumbnail.jpg`
- `obrigado-thumbnail.jpg`

---

## 4. Configuração do Webhook Asaas (Opcional)

Para rastrear pagamentos automaticamente, configure um webhook no Asaas:

### Criar endpoint de webhook
**Arquivo:** `app/api/webhook/asaas/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validar assinatura do webhook (recomendado)
    // const signature = request.headers.get('asaas-signature');

    const { event, payment } = body;

    if (event === 'PAYMENT_CONFIRMED') {
      // Registrar lead como aprovado
      await prisma.lead.create({
        data: {
          nome: payment.customer.name,
          email: payment.customer.email,
          whatsapp: payment.customer.phone,
          produto: payment.description,
          valor: payment.value,
          status: 'APROVADO',
          etapa: 1, // Ajustar conforme o produto
        },
      });

      // TODO: Enviar email de boas-vindas
      // TODO: Liberar acesso ao produto
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Erro no webhook:', error);
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 });
  }
}
```

### Configurar no Asaas
1. Acesse o painel do Asaas
2. Vá em Configurações > Webhooks
3. Adicione a URL: `https://seu-dominio.com/api/webhook/asaas`
4. Selecione os eventos: `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`

---

## 5. Tracking e Analytics

### Facebook Pixel
**Arquivo:** `app/funil/pre-lancamento/page.tsx`

Descomente e configure o Facebook Pixel (linhas 62-66):

```typescript
<Script id="facebook-pixel" strategy="afterInteractive">
  {`
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', 'SEU_PIXEL_ID');
    fbq('track', 'PageView');
  `}
</Script>
```

### Google Analytics
```typescript
<Script src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX" strategy="afterInteractive" />
<Script id="google-analytics" strategy="afterInteractive">
  {`
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-XXXXXXXXXX');
  `}
</Script>
```

---

## 6. Fluxo Completo do Funil

```
ETAPA 1: Pré-Lançamento
├─ URL: /funil/pre-lancamento
├─ Produto: Método Tubarão (R$ 497 → R$ 697)
├─ Ação: Compra via Asaas
└─ Redirect: /funil/pos-compra

ETAPA 2: Pós-Compra (Upsells)
├─ URL: /funil/pos-compra
├─ Produtos:
│  ├─ Módulo Limpa Nome (R$ 297)
│  └─ Módulo Financiamento Moto (R$ 497)
├─ Ação: Compra via Asaas (opcional)
└─ Redirect: /funil/mentoria-online

ETAPA 3: Mentoria Online
├─ URL: /funil/mentoria-online
├─ Produto: Mentoria Online em Grupo (R$ 997)
├─ Ação: Compra via Asaas (opcional)
└─ Redirect: /funil/mentoria-presencial

ETAPA 4: Mentoria Presencial
├─ URL: /funil/mentoria-presencial
├─ Produto: Mentoria Presencial Individual (R$ 5.997)
├─ Ação: Formulário de aplicação
├─ API: POST /api/mentoria-application
└─ Redirect: /funil/obrigado-final

ETAPA FINAL: Obrigado
├─ URL: /funil/obrigado-final
└─ Próximos passos e instruções
```

---

## 7. Testes

### Checklist de Testes

- [ ] ETAPA 1: Contador regressivo funcionando
- [ ] ETAPA 1: Botão de compra redireciona para Asaas
- [ ] ETAPA 1: Vídeo carrega corretamente
- [ ] ETAPA 2: Ambos os botões de upsell funcionam
- [ ] ETAPA 2: Botão "Não, obrigado" redireciona para ETAPA 3
- [ ] ETAPA 3: Vídeo e depoimentos carregam
- [ ] ETAPA 3: Botão de recusa redireciona para ETAPA 4
- [ ] ETAPA 4: Formulário valida todos os campos
- [ ] ETAPA 4: Máscara de WhatsApp funciona: (XX) XXXXX-XXXX
- [ ] ETAPA 4: Validação de objetivo (mínimo 20 caracteres)
- [ ] ETAPA 4: Submit envia para API e salva no banco
- [ ] ETAPA 4: Redirect para página de obrigado após sucesso
- [ ] ETAPA FINAL: Vídeo de agradecimento carrega
- [ ] Mobile: Todas as páginas responsivas
- [ ] Mobile: Vídeos funcionam em iOS/Android

---

## 8. Monitoramento e Admin

### Visualizar Aplicações da Mentoria

Crie uma página admin para visualizar as aplicações:

**Arquivo:** `app/admin/mentoria-applications/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';

export default function MentoriaApplicationsAdmin() {
  const [applications, setApplications] = useState([]);

  useEffect(() => {
    fetch('/api/mentoria-application')
      .then(res => res.json())
      .then(data => setApplications(data));
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Aplicações - Mentoria Presencial</h1>
      <div className="space-y-4">
        {applications.map((app: any) => (
          <div key={app.id} className="bg-white border rounded-lg p-6 shadow">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Nome</p>
                <p className="font-bold">{app.nome}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">WhatsApp</p>
                <p className="font-bold">{app.whatsapp}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Cidade</p>
                <p>{app.cidade}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Capital Disponível</p>
                <p>{app.capitalDisponivel}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Experiência</p>
                <p>{app.experiencia}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <p className="font-bold text-blue-600">{app.status}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-gray-600">Objetivo</p>
                <p className="text-sm">{app.objetivo}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-500">
                  Enviado em: {new Date(app.createdAt).toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 9. Próximos Passos Recomendados

1. **Email Marketing**: Integrar com Mailchimp/SendGrid para sequência de emails
2. **WhatsApp Automático**: Enviar mensagem automática via Evolution API quando aplicação for recebida
3. **CRM Integration**: Integrar com Pipedrive/RD Station para gestão de leads
4. **A/B Testing**: Testar diferentes versões dos vídeos e copy
5. **Retargeting**: Configurar pixel do Facebook para retargeting de quem não comprou
6. **Urgência**: Adicionar contador de vagas limitadas (ex: "Restam 5 vagas")
7. **Prova Social**: Adicionar contador de pessoas que já compraram
8. **Chat ao Vivo**: Adicionar Tawk.to ou Intercom para suporte em tempo real

---

## 10. Suporte

Para dúvidas ou problemas:
- Documentação Asaas: https://docs.asaas.com
- Documentação Prisma: https://www.prisma.io/docs
- Documentação Next.js: https://nextjs.org/docs
