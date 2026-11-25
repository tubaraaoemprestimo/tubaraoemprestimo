# 10 — Relatório final: Clientes Antigos (25/11/2026)

**Commit:** `174dcba` (GitHub `main`, Vercel e backend Oracle). Backup prévio: `/home/ubuntu/backups/pre-clientes-antigos-20261125-092433`.

## O que o dono consegue fazer agora
Menu **Clientes Antigos**:
1. cadastrar pelo telefone (nome e CPF opcionais);
2. escolher o serviço no catálogo real (CLT, capital de giro, garantia, moto, limpa nome; celular aparece quando for reativado no catálogo);
3. registrar o contrato antigo (valor, saldo, próxima cobrança, taxa, referência) sem mexer no caixa;
4. confirmar o saldo → o contrato entra na régua automática (7, 3 dias, vencimento, atrasos; 5 dias ao ligar a flag);
5. gerar o convite e mandar pelo WhatsApp; o cliente ativa a conta e encontra os contratos antigos no app;
6. importar a lista em CSV.

## Garantias
- Banco: **só acréscimos**, nenhum dado existente alterado; rollback testado (schema idêntico).
- Nenhuma regra de juros, multa ou pagamento alterada. Na régua só mudou: (a) contratos marcados como suspensos ficam de fora, (b) opt-out de WhatsApp, (c) aviso de 5 dias (desligado), (d) contrato **legado** com saldo maior que a cobrança não recebe mensagem de "quitação total".
- Sem CPF fictício, sem senha padrão, sem conta automática, sem fusão por telefone, sem dados pessoais no link, token só como hash.
- Falha de segurança corrigida: `returning-clients` exigia só login para listar/validar migrações; agora exige admin.

## Testes
151/156 unitários (5 falhas preexistentes da regra AUTONOMO, não tocadas) · 31/31 de integração em banco descartável · build e Playwright em 4 larguras, 0 erros. Detalhes em `07-TESTES.md`.

## Pendências
1. **Ligar o aviso de 5 dias:** revisar o texto dos templates `INSTALLMENT_DUE_5_DAYS` (cópia do de 7 dias) e colocar `COLLECTION_DUE_5_DAYS_ENABLED=true` no `.env`.
2. **Envio automático do convite:** hoje o admin manda pelo botão "Abrir no WhatsApp". Para o sistema enviar sozinho: `LEGACY_WHATSAPP_ENABLED=true`.
3. **Opt-out:** a coluna existe e a régua respeita; ainda não há botão na tela para marcar (hoje só por banco).
4. Tela antiga "Migração de Contratos" está quebrada desde antes (tabela inexistente) — sugerimos remover do menu.
5. Áudios das 08:52 são de outro assunto (plataforma de cursos de terceiro): não tratados aqui.
