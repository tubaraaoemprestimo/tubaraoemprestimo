# 08 — Segurança

| Risco | Medida |
|---|---|
| Webhook forjado (qualquer um podia injetar mensagens e acionar a IA) | Cabeçalho `x-inbox-secret` (≥ 32 caracteres) + instância conferidos em tempo constante. |
| `POST /api/webhook/send` público | Agora `authenticate + requireAdmin`. |
| `POST /api/chatbot/message` público | Agora `authenticate + requireAdmin`. |
| CORS aceitava qualquer origem | Origem fora da lista é recusada. |
| Chave da Evolution | Só no backend. Mídia passa por proxy autenticado. |
| IA revelando dados de terceiros por CPF digitado | Bloco de busca por CPF e dados financeiros **removido** do prompt. A IA orienta a usar o app oficial e não confirma cadastros. |
| Injeção de instruções pelo cliente | Prompt instrui a não aceitar comandos administrativos; a IA não tem ferramentas que alterem saldo, quitem, aprovem comprovantes, criem empréstimos ou mudem juros. |
| Vínculo errado de contrato | Ficha 360° só mostra contratos após vínculo **confirmado** pelo operador (auditado `WA_LINK_CUSTOMER`). Coincidência de telefone aparece só como sugestão. |
| Segredos em mensagens | Tokens/senhas em links e textos são mascarados antes de gravar (`inboxText`). |
| Mídia maliciosa / grande | MIME em lista permitida, limite 16 MB, `nosniff`, `Cache-Control: private, no-store`. Visualização única não é baixada. |
| Vazamento entre instâncias | Toda consulta filtra pela instância configurada. |

Mudança de comportamento: perguntas como "quanto devo?" no WhatsApp passam a ser direcionadas ao aplicativo ou ao atendente, em vez de a IA responder com valores.
