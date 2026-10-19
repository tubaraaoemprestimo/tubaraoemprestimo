# 04 — IA do WhatsApp e chatbot interno

Nenhum bot novo, nenhum listener novo. Os dois fluxos existentes recebem o **mesmo** bloco de conhecimento de `services/phoneFinancing/serviceKnowledge.ts`:

- `backend/src/routes/webhook.ts` (Evolution API).
- `backend/src/routes/chatbot.ts` (chat/teste interno).

## Ordem do prompt

1. Prompt do admin (inalterado, continua com prioridade).
2. Bloco "SERVIÇOS OFICIAIS DA TUBARÃO": os 6 serviços na ordem oficial, com link real de contratação quando disponível, e a menção ao programa Investidor.
3. Contexto já existente (dados do cliente, mídia).

## Regras injetadas sobre celulares

- Só citar modelo, preço, entrada, juros e prazo que estejam na lista do sistema; sem lista, falar em cotação.
- Enquanto a oferta estiver fechada: "novidade em breve", sem link.
- Não prometer Android.
- Nunca falar de bloqueio, rastreamento ou desativação do aparelho por atraso.
- Status de proposta, parcelas e 2ª via: encaminhar para o app autenticado.
- Empréstimo e celular sempre separados.

## Dados do cliente

O resumo de celular (`buildPhoneCustomerSummary`) só entra quando:
- a flag `PHONE_FINANCING_WHATSAPP_ENABLED` está ligada, **e**
- o número do WhatsApp corresponde ao telefone do cliente cadastrado.

CPF digitado na conversa **não** libera o resumo de celular. O resumo não contém CPF, IMEI, serial nem endereço; traz só protocolo, status, modelo e próxima parcela.

## Testes

`serviceKnowledge.test.ts`: 6 serviços mesmo sem a migração aplicada, Investidor presente, "em breve" quando fechado, link real quando aberto, só modelos cadastrados, sem preço inventado, resumo sem identificadores.

## Pendente

- Conversa real pelo WhatsApp: a instância `tubarao` da Evolution estava desconectada na última verificação (precisa ler o QR Code).
