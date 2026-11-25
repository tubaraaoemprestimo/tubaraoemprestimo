# 04 — Fluxos

1. **Admin cadastra:** Clientes Antigos → telefone (+ nome/CPF opcionais) → Salvar. Se o telefone já existe, aparece um aviso e o botão vira "Confirmar: é outra pessoa".
2. **Admin registra contrato:** "Registrar contrato antigo" → serviço do catálogo, valor, saldo (0 = quitado), próxima cobrança e vencimento, referência. Sem marcar "Conferi o saldo", o contrato fica com **Cobrança suspensa** (há um botão para confirmar depois).
3. **Régua:** contrato ativo e confirmado entra nos avisos de 7, (5) e 3 dias, vencimento e atrasos, com as regras atuais.
4. **Convite:** "Gerar convite" → mensagem pronta + "Abrir no WhatsApp" (envio manual enquanto a automação estiver desligada).
5. **Cliente ativa:** abre o link → confirma os 4 últimos dígitos do telefone (e o CPF, se cadastrado) → nome, e-mail, senha, aceite → a conta é criada e ligada ao cadastro existente; os contratos antigos aparecem no app.
6. **Importação:** "Importar planilha" → CSV `telefone;nome;cpf;servico;valor;saldo;valor_cobranca;vencimento;referencia` → pré-visualização → importa só as linhas válidas, sem enviar mensagens.
