# 11 — Implantação final (24/11/2026)

## Versões
| Item | Valor |
|---|---|
| Commit em produção | `9d095a0` (`main`) |
| Branch homologada | `manutencao/homologacao-2026-11-24` |
| Produção anterior | frontend `b35abb6` / backend `e38682a` |
| Backend Oracle | `1adfe8b` em execução (único commit posterior, `9d095a0`, é só frontend; repositório da VM alinhado em `9d095a0`) |
| URL | https://tubaraoemprestimo.com.br (200) / www (200) |
| Vercel | produção `success`, bundle contém o código novo |
| PM2 | `tubarao-backend` online, fork, 1 instância, node 20.20.2; **só ele foi reiniciado** |
| PostgreSQL | íntegro; **nenhuma migração, nenhum `db push`** |

## O que foi publicado nesta etapa
1. **Pagamentos (crítico):** aprovação do comprovante + baixa (parcela, contrato, lançamento) numa única transação `Serializable`; notificações só depois do commit. Webhook InfinitePay também em transação. Regras financeiras inalteradas.
2. **Privacidade:** o bloco "Acesso rápido" mostra só contato do **titular** (WhatsApp/Instagram) e documentos de identificação. Endereço/mapa, fotos e vídeo da residência e contatos de referência **saíram do destaque** até avaliação jurídica (CDC art. 42, LGPD). A ficha antiga (seções que já existiam antes da manutenção) não foi alterada.
3. **Layout:** cartões até 1280 px em Clientes e Contratos (no tablet/notebook com menu lateral a tabela cortava ações e nome); menu móvel com `aria-label`.

## Backup
`/home/ubuntu/backups/deploy-20261124-183226/` (pasta 700, arquivos 600):
- `COMMIT_ANTERIOR` (`e38682a`), `dist/` (build anterior), `pm2-config.json`
- `tubarao_db.dump` (pg_dump `-Fc`, 47 MB, 82 tabelas com dados conferidas via `pg_restore -l`)

## Rollback
**Backend:**
```bash
ssh tubarao-vm
cd /home/ubuntu/backend/backend
rm -rf dist && cp -a /home/ubuntu/backups/deploy-20261124-183226/dist dist
pm2 restart tubarao-backend --update-env
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3001/api/health   # 200
```
**Frontend:** Vercel → Deployments → deploy de `b35abb6` → Promote to Production (ou `git revert` dos commits e push).
**Banco:** não há mudança estrutural; **não restaurar o dump sobre o banco ativo** (apagaria operações feitas depois). O dump é para desastre.

## Validações em produção (sem efeito financeiro)
Totais antes e depois das validações iguais: 71 contratos, saldo R$ 29.099,40, 464 parcelas, 151 comprovantes (57 pendentes), 291 lançamentos.

| Verificação (token gerado na VM, só leitura ou ID inexistente) | Resultado |
|---|---|
| Cliente lista clientes / abre ficha de outro | 403 / 403 |
| Admin lista clientes / ficha / contratos / comprovantes | 200 |
| Cliente vê os próprios contratos / comprovantes | 200 / 200 |
| Cliente tenta aprovar comprovante | 403 |
| Admin aprova / rejeita comprovante inexistente | 404 / 409, nada gravado |
| CORS do site para a API | 204, origem permitida |

## Homologação visual final (Chromium, dados fictícios, tráfego externo bloqueado)
Larguras 375, 390, 430, 768, 1024, 1280, 1440 — **todas as checagens passaram, 0 erros de JavaScript**:
rolagem horizontal (clientes, ficha, contratos, detalhe, edição, painel do cliente) = 0; busca por nome sem acento, CPF e telefone sem máscara; busca mantida ao fechar a ficha; botão da ficha visível sem rolar; ficha e ficha-no-contrato sem contatos de referência; edição de contrato com campos; cliente bloqueado na área admin. Resultado e prints em `prints/final/`.

Observação: o selo "MODO DEMO" (só existe no modo demo) cobria o botão "Editar Contrato" no celular; foi ocultado apenas no navegador de teste.

## Testes automatizados
139 aprovados, 5 reprovados. Os 5 são os mesmos de antes da manutenção (`interestEngine`, regra AUTONOMO de domingos), ver `10-HOMOLOGACAO-24-11.md`. Verificação de integração da baixa contra PostgreSQL descartável: 4/4.

## Riscos remanescentes
- Safari/iPhone e Android reais não testados (só emulação de largura no Chromium).
- Decisões pendentes do responsável: regra AUTONOMO (5 testes), multas sobrepostas, 53 comprovantes de parcelas já pagas (ver 05).
- A ficha antiga ainda exibe, para o admin, endereço, referências e fotos da casa que já existiam antes desta manutenção; recomenda-se avaliação jurídica.
