# 05 — Apple Business Manager (ABM)

Status: **PENDENTE** (nada abaixo foi executado ainda).

## Regras inegociáveis

- **PROIBIDO** usar bloqueio, Modo Perdido ou apagamento remoto como cobrança ou por inadimplência.
- O MDM **não lê** WhatsApp, fotos, mensagens, e-mails nem o Apple ID do usuário.
- Localização só existe em **Modo Perdido** de aparelho **supervisionado e da empresa** (ex.: aparelho de laboratório perdido/roubado), nunca de aparelho de cliente para cobrança.

## 1. Conta ABM

1. Obter/confirmar o **D-U-N-S** da Tubarão Empréstimos LTDA (razão social e endereço idênticos ao CNPJ).
2. Inscrever a empresa em <https://business.apple.com> com e-mail corporativo (não pessoal) e aguardar verificação da Apple.
3. Criar ao menos **dois** administradores (evita perda de acesso).

Evidência: print da conta ABM aprovada (sem dados pessoais).

## 2. Servidor MDM no ABM

1. ABM → Preferências → Seus servidores MDM → Adicionar.
2. Nome: `Tubarão NanoHUB`.
3. Enviar a chave pública do servidor (gerada pela ferramenta DEP escolhida, ver item 3) e baixar o **token ADE** (`.p7m`).
4. Definir o servidor como padrão para os aparelhos atribuídos (opcional).

O token ADE expira em 1 ano: registrar data e responsável pela renovação.

## 3. Token ADE e NanoHUB

O **NanoHUB não inclui NanoDEP**: ele não consome o token ADE nem sincroniza aparelhos do ABM. Opções:

| Opção | Como | Quando |
|---|---|---|
| A. NanoDEP separado | Serviço adicional (micromdm/nanodep) com o token ADE; define o perfil de inscrição automática apontando para `https://mdm.<domínio>/mdm` | Volume de aparelhos comprados de revendedor credenciado |
| B. Apple Configurator | Mac com Apple Configurator; adicionar o aparelho ao ABM e/ou preparar com supervisão via USB | Laboratório e baixo volume |

Recomendação inicial: **opção B** para o laboratório. Avaliar a opção A só depois dos testes físicos (08_TESTES_FISICOS.md). Nenhuma das duas foi testada neste projeto.

Observação Apple Configurator: aparelhos adicionados manualmente ao ABM têm um período provisório em que o usuário pode remover a gestão. Conferir as regras atuais na documentação da Apple.

## 4. Supervisão

- Supervisão só é obtida por ADE (ABM) ou Apple Configurator, com apagamento do aparelho no processo.
- Inscrição por perfil manual (sem ADE) gera aparelho **não supervisionado**: vários comandos ficam indisponíveis. Isso é aceitável e esperado no 1º teste.
- Supervisão exige consentimento formal do cliente no contrato (texto jurídico pendente).

## 5. Liberação do aparelho (quitação ou devolução)

Ao quitar o financiamento ou encerrar o contrato:

1. Enviar `RemoveProfile`/remover gestão pelo MDM (aparelho deixa de ser gerenciado).
2. **Liberar o aparelho no ABM** (“Release Devices”), conforme <https://support.apple.com/guide/business/release-devices-axmec4d28461/web>. A liberação é irreversível: o aparelho não volta ao ABM pela via normal.
3. Registrar no sistema: data, operador, número de série, comprovante.

Evidência: print do aparelho fora do ABM + log do comando no sistema.

## Pendências externas

- [ ] D-U-N-S confirmado
- [ ] Conta ABM aprovada
- [ ] Decisão NanoDEP x Apple Configurator
- [ ] Mac disponível (se Apple Configurator)
- [ ] Texto jurídico de consentimento de supervisão
