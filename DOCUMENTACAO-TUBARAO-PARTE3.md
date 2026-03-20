---
## 5️⃣ PÁGINAS FRONTEND E FLUXOS DE NEGÓCIO

A estrutura do projeto separa a interface pública/cliente (PWA) e a área Administrativa.

### 5.1. Área do Cliente (Frontend Público/PWA)
As rotas são compostas de um Wizard ("funil") com passos dinâmicos:

*   **Rota: `/` (Home)**: Escolha do perfil: "Empréstimo CLT", "Capital de Giro", "Com Garantia", "Financiamento Moto", "Limpar Nome".
*   **Rota: `/wizard`**: Formulário multi-step que altera dependendo da escolha (renderiza campos de empresa só se for CLT; campos de carro se for Garantia). Validado na última etapa com a assinatura de canvas.
*   **Rota: `/client/dashboard`**: Tela que lista o status (`PENDING`, `APPROVED`, `REJECTED`). Se for `APPROVED`, permite clicar no botão "Aceitar Termos" para iniciar a aprovação definitiva.

### 5.2. Área Administrativa (`/admin/*`)
Todas as páginas administrativas exigem role `ADMIN`.

#### **`Requests.tsx` (Gestão de Solicitações)**
-   **Aba principal de Trabalho do Admin**. Mostra listagem completa (`PENDING`, `APPROVED`, etc).
-   Filtros avançados (STATUS_TABS e PROFILE_TABS) para visualização rápida.
-   Modais de Aprovação (gerar contraproposta), Recusa (escolha do motivo), e Exclusão (Soft Delete para `CANCELLED`).
-   **Regra de Negócio Crítica**: Um administrador é alertado com um sino (`Bell`) caso uma contraproposta seja aceita pelo cliente (`loadNotifications()` a cada 30s).
-   **Botões Mágicos**:
    -   *Ativar Contrato*: Informa 1ª parcela, dia de vencimento, envia PIX e o Admin clica "Confirmar e Ativar".
    -   *Pedir Documentos*: Se o cliente enviou um RG borrado, o admin muda o status para `WAITING_DOCS` e dispara push/email pedindo a re-análise.

#### **`CollectionAutomationPanel.tsx` (Réguas de Cobrança)**
-   Controle visual de todas as regras automatizadas (`7 dias antes`, `Vence hoje`, `3 dias de atraso`, etc).
-   Mapeamento estático no código (`rules[]`) que busca do backend em `stats` quantas pessoas estão em cada regra.
-   Botão "Executar Manualmente" que aciona o cron manualmente e reporta quantos SMS/Emails foram enviados.

#### **`DataSearchNew.tsx` (Busca TrackFlow)**
-   Formulário de 5 abas (CPF, CNPJ, Contatos, Endereço, Veículos) para buscar informações na API da TrackFlow.
-   **Histórico**: Renderiza todas as últimas consultas feitas por aquele Admin (baseado no Token) para não precisar pagar por uma mesma busca novamente num intervalo curto de dias. Renderiza todos os dados complexos (Renda, Parentes, Telefones, Endereços, Credenciais vazadas).

#### **`Customers.tsx` (Base de Clientes)**
-   Acesso aos CPFs aprovados e com contratos em andamento. Histórico de atraso, score interno de 0 a 1000 que sobe se o cliente paga em dia e cai se atrasa ou pede bloqueio.

#### **`Blacklist.tsx`** e **`SecurityHub.tsx`**
-   Adição de CPFs bloqueados manualmente ou bloqueios baseados no rastreamento de tentativas múltiplas do mesmo IP (Antifraude).

---

## 6️⃣ REGRAS DE NEGÓCIO CRÍTICAS

1.  **Inadimplência Escalável (Juros)**:
    -   Se o sistema não tiver um juros de atraso personalizado no Cadastro do Cliente, usa-se a tabela `SystemSetting`:
        -   Multa Fixa (`late_fixed_fee`): Aplicada 1 dia após o vencimento (Ex: 2%).
        -   Juros Diário (`late_interest_daily`): Aplicado ao valor da parcela diariamente (Ex: 0.33%).
2.  **Múltiplas Solicitações (Anti-Spam)**:
    -   Um cliente (baseado no CPF) NÃO PODE criar uma nova solicitação `PENDING` se já existir uma `PENDING`, `WAITING_DOCS` ou `APPROVED`.
3.  **Comissionamento de Parceiros**:
    -   Não é pago 100% de uma vez. O parceiro cadastra um link: `?ref=CODIGO`.
    -   O cliente pede empréstimo e a comissão vai para `PartnerCommission`.
    -   A regra divide o pagamento dependendo de quantas parcelas o cliente paga. (Ex: Libera 40% só quando o cliente pagar a primeira parcela).
4.  **Status Múltiplos (WhatsApp)**:
    -   A requisição de "Postar Status" pega a URL do Cloudflare R2 e despacha pela Evolution API para o JID `status@broadcast`, preenchendo todos os JIDs (telefones de contatos) para garantir entrega em massa simultânea, e lida com bloqueios de rate limit usando uma pausa inteligente.
5.  **Notificações Híbridas**:
    -   Um evento de aprovação de crédito aciona 3 métodos simultâneos:
        -   Envia SMS ou WhatsApp via Evolution API.
        -   Envia e-mail via Resend/Nodemailer (Template HTML com bordas arredondadas e logotipo dourado).
        -   Cria um registro na tabela `Notification` para brilhar a bolinha de sino no PWA do cliente ou Admin.

---

## 7️⃣ SEGURANÇA E AUTENTICAÇÃO

*   **JWT (JSON Web Token)**: Expiram conforme configuração, o Client armazena no LocalStorage.
*   `requireAdmin`: Middleware estrito na API que rejeita requisições se a `role` não for `ADMIN`.
*   **Hash de Senhas**: `bcryptjs` usado no momento do registro. O banco de dados nunca salva senhas cruas.
*   **Geolocalização Fixa**: Capturada no Frontend na hora do cadastro e salva na tabela `Customer`. O administrador usa o Google Maps API no `Geolocation.tsx` para garantir que o cliente está onde diz morar (evita golpes).

## 8️⃣ DESIGN SYSTEM E ESTILOS

*   **Tema Principal**: Dark Theme. Fundo preto (`#000000` / `bg-black`), cards e caixas de texto em cinza chumbo escuro (`bg-zinc-900`, `border-zinc-800`).
*   **Cor Destaque (Brand Color)**: Dourado Premium (`#D4AF37`).
*   **Estados Visuais (Badges)**:
    -   Pendente: Amarelo (`bg-yellow-600`)
    -   Aprovado: Verde Esmeralda (`bg-green-600`)
    -   Ativo: Azul (`bg-blue-600`)
    -   Rejeitado: Vermelho (`bg-red-600`)
    -   Contraproposta: Laranja (`bg-orange-600`)
*   Os botões principais (Aprovar, Aceitar, Continuar) usam hover suave para o dourado envelhecido (`hover:bg-[#C4A037]`).
*   Telas desenhadas pensando na usabilidade `Mobile-First` no caso da área do cliente (Wizard), e grids complexos (`grid-cols-1 md:grid-cols-4`) para as estatísticas e Dashboards da área do Administrador.

---
**FIM DA DOCUMENTAÇÃO TÉCNICA (TUBARÃO EMPRÉSTIMOS)**
*Esta estrutura contém os fundamentos de negócio, tabelas, arquitetura e front-end descritos em detalhes e é suficiente para reconstruir, manter ou estender o projeto.*