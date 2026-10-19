# 07 — Certificados e inscrição do 1º iPhone

Status: **PENDENTE**.

## Regras

- **PROIBIDO** bloqueio, Modo Perdido ou apagamento por inadimplência. MDM não lê WhatsApp/fotos/Apple ID. Localização só em Modo Perdido supervisionado de aparelho da empresa.
- Chaves privadas (APNs, CA SCEP, assinatura de perfil) nunca vão para o Git, chat ou e-mail. Ficam na VM (`chmod 600`) e no backup criptografado.

## 1. Certificado APNs MDM

O push do MDM exige certificado APNs emitido pela Apple em <https://identity.apple.com> (Apple Push Certificates Portal). A Apple só aceita CSR **assinado por um fornecedor MDM** (conta Apple Developer com capacidade “MDM CSR”).

### 1.1 CSR

```bash
umask 077
openssl genrsa -out apns-key.pem 2048
openssl req -new -key apns-key.pem -subj "/CN=Tubarao Emprestimos MDM/O=Tubarao Emprestimos/C=BR" -out apns.csr
```

### 1.2 Assinatura do CSR por fornecedor MDM

Caminhos possíveis (escolher um, verificar condições atuais):

- Conta Apple Developer da organização com o certificado “MDM Vendor” liberado pela Apple; assinar o CSR com ferramenta do ecossistema MicroMDM (confirmar ferramenta e procedimento na documentação vigente).
- Serviço de terceiros que assina CSR para MDM open source (avaliar contrato e privacidade antes; nunca enviar a chave privada, só o CSR).

Resultado: arquivo de requisição assinado (plist em base64) para enviar no portal.

### 1.3 identity.apple.com

1. Entrar com o **Apple ID corporativo dedicado** (ex.: `mdm@tubaraoemprestimo.com.br`), nunca pessoal.
2. “Create a Certificate” → enviar a requisição assinada → baixar `.pem`.
3. Converter se necessário e enviar ao NanoHUB:

```bash
bash /opt/tubarao-mdm/scripts/upload-pushcert.sh apns-cert.pem apns-key.pem
```

O script valida cert/chave, rejeita chave com senha, envia (`PUT /api/v1/nanomdm/pushcert`) e grava o `PUSH_TOPIC` no `.env`.

### 1.4 Renovação anual

- Renovar **no mesmo Apple ID** e usando **“Renew”** no certificado existente, para manter o **mesmo topic**.
- Novo certificado (topic diferente) = todos os aparelhos precisam ser reinscritos.
- `upload-pushcert.sh` avisa se o topic mudou; `doctor.sh` avisa 30 dias antes do vencimento.
- Registrar: Apple ID, data de vencimento, responsável.

## 2. SCEP

- CA criada por `scripts/bootstrap.sh` (`scepserver ca -init`, RSA 4096, 10 anos) no volume `tubarao_mdm_scep_depot`.
- O NanoHUB confia nessa CA (`-ca /scep-depot/ca.pem`) para validar a identidade do aparelho.
- O aparelho obtém o certificado em `https://mdm.<domínio>/scep` usando o `SCEP_CHALLENGE`.
- O challenge é estático: quem tiver o perfil pode pedir certificado. Mitigação: não distribuir o perfil publicamente; trocar o challenge se vazar (aparelhos já inscritos não são afetados). Challenge dinâmico: evolução futura.
- Validade do certificado do aparelho: `SCEP_CERT_VALID` (padrão 365 dias). Renovação de identidade: testar em laboratório.

## 3. Perfil de inscrição

Template: `infra/mdm/profiles/enroll.mobileconfig.template` (payload SCEP + payload MDM com `ServerURL` `/mdm`, `CheckInURL` `/checkin`, `Topic`, `SignMessage=true`, `AccessRights=8191`). Instruções de geração no próprio arquivo.

- O perfil gerado contém o challenge: **não versionar**, `chmod 600`, apagar após uso.
- `PayloadRemovalDisallowed=false`: o usuário pode remover o perfil em aparelho não supervisionado (comportamento esperado e transparente).

### Assinatura do perfil

Sem assinatura o iOS exibe “Não verificado”. Para o laboratório isso é aceitável. Para clientes, assinar com certificado confiável:

```bash
openssl smime -sign -signer fullchain-leaf.pem -inkey privkey.pem -certfile chain.pem \
  -nodetach -outform der -in enroll.mobileconfig -out enroll-signed.mobileconfig
```

Usar o certificado TLS do host como assinador: validar em laboratório se o iOS exibe “Verificado”.

## 4. Inscrição do 1º iPhone de laboratório

Somente aparelho **da empresa**, sem dados pessoais, Apple ID de teste.

1. `bash scripts/doctor.sh` sem falhas.
2. Gerar o perfil (template) e transferir por canal privado (AirDrop/download autenticado).
3. iPhone: abrir o perfil → Ajustes → Perfil baixado → Instalar.
4. Conferir nos logs: `docker compose logs --since 10m nanohub` (Authenticate e TokenUpdate).
5. Enviar `DeviceInformation` pela API (na VM):

```bash
cd /opt/tubarao-mdm && source scripts/_lib.sh
UDID=<udid-do-log>
cat > /tmp/devinfo.plist <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Command</key><dict><key>RequestType</key><string>DeviceInformation</string>
<key>Queries</key><array><string>DeviceName</string><string>OSVersion</string><string>SerialNumber</string><string>IsSupervised</string></array></dict>
<key>CommandUUID</key><string>lab-devinfo-001</string>
</dict></plist>
EOF
api_curl -X PUT --data-binary @/tmp/devinfo.plist "$NANOHUB_LOCAL/api/v1/nanomdm/enqueue/$UDID"
```

6. Resposta esperada: `push_result` para o UDID e `command_uuid`. Resultado do aparelho chega no webhook do backend.

Roteiro completo e evidências: `08_TESTES_FISICOS.md`.

## Pendências externas

- [ ] Apple ID corporativo dedicado ao MDM
- [ ] Caminho de assinatura do CSR (fornecedor MDM)
- [ ] Certificado APNs emitido
- [ ] iPhone de laboratório da empresa
- [ ] Decisão sobre assinatura do perfil
