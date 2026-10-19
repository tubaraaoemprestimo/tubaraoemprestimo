# 08 — Testes físicos (iPhone de laboratório)

Status geral: **PENDENTE**.

## Regras

- Somente **iPhone de laboratório da empresa**, sem dados pessoais, com Apple ID de teste. **Nunca** aparelho de cliente.
- **PROIBIDO** usar bloqueio, Modo Perdido ou apagamento por inadimplência — nem como teste de “cobrança”.
- O MDM **não lê** WhatsApp, fotos, mensagens nem Apple ID. Nenhum teste tenta isso.
- Localização só em **Modo Perdido** de aparelho supervisionado **da empresa**; fora do escopo deste roteiro.
- Todo comando com efeito no aparelho precisa de **reversão** testada logo em seguida.
- Evidências sem dados pessoais (mascarar UDID/serial nos prints: últimos 4 dígitos).

## Pré-requisitos

- [ ] `doctor.sh` sem falhas (anexar saída)
- [ ] Certificado APNs carregado (07)
- [ ] Webhook do backend recebendo eventos
- [ ] Cloudflare Tunnel (ou entrada direta) validado com `/mdm` — resultado registrado

## Roteiro

| # | Teste | Passos | Resultado esperado | Evidência | Status |
|---|---|---|---|---|---|
| 1 | Inscrição por perfil | Instalar perfil gerado do template | Logs `Authenticate` + `TokenUpdate`; aparelho aparece no backend | Logs nanohub + print do perfil instalado | PENDENTE |
| 2 | Push APNs | `GET /api/v1/nanomdm/push/<UDID>` | `push_result` sem erro; aparelho faz check-in em `/mdm` | Resposta da API + log | PENDENTE |
| 3 | DeviceInformation | `enqueue` com `DeviceInformation` (07, item 4) | Status `Acknowledged` no webhook; backend marca `acknowledged` | Payload do webhook (mascarado) | PENDENTE |
| 4 | Supervisão | Preparar via Apple Configurator/ADE (05) e reinscrever | `IsSupervised=true` no DeviceInformation | Resposta do comando | PENDENTE |
| 5 | Perfil reversível | `InstallProfile` com perfil inofensivo (ex.: Wi-Fi de teste ou restrição leve) → `RemoveProfile` | Perfil aparece e some em Ajustes | Prints antes/depois + logs | PENDENTE |
| 6 | Comando de segurança com reversão | `InstallProfile` com perfil de restrição (ex.: `com.apple.applicationaccess` desativando a câmera) → conferir → `RemoveProfile` | Restrição aplicada e revertida; registro de auditoria no backend | Logs + auditoria + prints antes/durante/depois | PENDENTE |
| 7 | Remoção de gestão | Enviar `RemoveProfile` do perfil MDM (ou remover manualmente no aparelho) | `CheckOut` recebido; aparelho sai do backend como não gerenciado | Log `CheckOut` + print | PENDENTE |
| 8 | Liberação ABM | Liberar o aparelho no ABM (05, item 5) | Aparelho fora do ABM; reinicialização sem tela de gestão remota | Print do ABM + print do aparelho | PENDENTE |
| 9 | Expiração/renovação APNs (simulada) | `WARN_DAYS=400 bash scripts/doctor.sh` | Aviso de expiração exibido | Saída do doctor | PENDENTE |
| 10 | Backup e restauração | `backup.sh`, restaurar em VM de teste, `DeviceInformation` | Aparelho continua respondendo após restauração | Saída dos comandos | PENDENTE |

Itens **não testados** neste roteiro e que não devem ser usados: `DeviceLock`, `EnableLostMode`, `EraseDevice` por inadimplência.

## Registro de execução

| Data | Teste # | Operador | Versão NanoHUB | iOS | Resultado | Link da evidência |
|---|---|---|---|---|---|---|
| | | | | | | |

## Critério de liberação para clientes

Todos os itens 1–3, 5, 7, 8 e 10 aprovados, mais: texto jurídico de consentimento aprovado e revisão de segurança do webhook (HMAC ou rede local + token).
