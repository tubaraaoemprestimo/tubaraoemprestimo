# 🦈 Tubarão Empréstimos — Roadmap de Fases

## ✅ FASE 1 — Backend Core (CONCLUÍDA)
- Schema Prisma atualizado (PartnerCommission, PartnerBonus, campos novos)
- Rotas: partners, commissions, collections, loans
- Cron jobs: bonus mensal, cancelamento comissões
- Chatbot: reconhecimento de renda informal
- Customer PUT: fix de whitelisting
- Migration SQL aplicada na VPS

## ✅ FASE 2 — Frontend Wizard (CONCLUÍDA)
- Upload PDF para CTPS Digital (accept + extensão + preview)
- Campo de grau de parentesco nas referências
- Declaração de veracidade obrigatória
- Deploy na VPS realizado

---

## 🔄 FASE 3 — Painel de Parceiros (Frontend Admin)
**Objetivo:** Criar a página de gestão de parceiros no painel admin.

### 3.1 — Página `Partners.tsx` (admin)
- [ ] Lista de parceiros com filtros (status, score, período)
- [ ] Detalhes do parceiro (clientes indicados, comissões, bônus)
- [ ] Aprovar/Rejeitar parceiros
- [ ] Editar taxa de comissão
- [ ] Visualizar comissões (PENDING, PARTIAL, PAID, CANCELLED)
- [ ] Marcar comissões como pagas (payment method, reference)
- [ ] Dashboard de performance (gráficos)

### 3.2 — Rota no App.tsx
- [ ] Adicionar `/admin/partners` no menu e nas Routes
- [ ] Ícone no menu: `Handshake` ou `Users`

### 3.3 — Integração no FinanceHub
- [ ] Tab "Comissões de Parceiros" no hub financeiro
- [ ] Resumo de comissões pendentes vs pagas

---

## 🔄 FASE 4 — Painel do Parceiro (Frontend Parceiro)
**Objetivo:** Criar área exclusiva para parceiros verem seus ganhos.

### 4.1 — Página `PartnerDashboard.tsx` (client)
- [ ] Visão geral: total ganho, comissões pendentes, bônus
- [ ] Lista de clientes indicados (com status da solicitação)
- [ ] Histórico de comissões (timeline com 40/30/30%)
- [ ] Link de indicação (compartilhável via WhatsApp)
- [ ] Código de referral exclusivo
- [ ] Ranking de parceiros (gamificação)

### 4.2 — Rota no App.tsx
- [ ] Adicionar `/partner/dashboard` no ClientLayout
- [ ] Menu condicional: mostrar "Área do Parceiro" se `user.isPartner`

---

## 🔄 FASE 5 — Sistema de Cobrança Automatizada
**Objetivo:** Automatizar o processo de cobrança de parcelas.

### 5.1 — Backend
- [ ] Rota de geração de boleto/PIX para parcelas
- [ ] Webhook de confirmação de pagamento PIX
- [ ] Envio automático de comprovante ao admin
- [ ] Atualização automática do status da parcela
- [ ] Integração com gateway de pagamento (Mercado Pago ou Asaas)

### 5.2 — Frontend (Client)
- [ ] Tela de pagamento de parcela com QR Code PIX
- [ ] Histórico de pagamentos no dashboard do cliente
- [ ] Upload de comprovante se pagamento manual
- [ ] Notificação push quando parcela vence

---

## 🔄 FASE 6 — Relatórios e Analytics Avançados
**Objetivo:** Dashboards avançados para tomada de decisão.

### 6.1 — Admin Dashboard Aprimorado
- [ ] KPIs em tempo real (inadimplência, conversão, ticket médio)
- [ ] Gráficos de evolução mensal (receita, empréstimos, novos clientes)
- [ ] Mapa de calor por região (geolocalização dos clientes)
- [ ] Funil de conversão (wizard → aprovação → pagamento)
- [ ] Relatório de parceiros (ranking, comissões, performance)

### 6.2 — Exportação
- [ ] Export PDF de relatórios
- [ ] Export Excel de dados
- [ ] Relatório mensal automático por email

---

## 🔄 FASE 7 — UX/UI Polish
**Objetivo:** Polir toda a experiência do usuário.

### 7.1 — Melhorias Visuais
- [ ] Animações de transição entre steps do wizard
- [ ] Loading skeletons em todas as listas
- [ ] Empty states personalizados
- [ ] Dark mode consistente em todas as páginas
- [ ] Responsividade mobile perfeita

### 7.2 — PWA & Performance
- [ ] Service Worker para modo offline
- [ ] Cache de dados frequentes
- [ ] Lazy loading de páginas admin
- [ ] Otimização de imagens (WebP)
- [ ] Lighthouse score > 90

---

## 📋 Prioridade Sugerida
1. **FASE 3** — Painel de Parceiros (Admin) → Essencial para gestão
2. **FASE 4** — Dashboard do Parceiro → Essencial para parceiros verem ganhos
3. **FASE 5** — Cobrança Automatizada → Reduz trabalho manual
4. **FASE 6** — Relatórios → Insights de negócio
5. **FASE 7** — Polish → Experiência premium
