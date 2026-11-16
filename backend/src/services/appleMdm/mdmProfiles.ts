import { createHash } from 'crypto';

/**
 * Perfis .mobileconfig dos aparelhos corporativos.
 *  - enrollment: inscrição no NanoHUB (SCEP + MDM). Contém o SCEP_CHALLENGE: só admin baixa.
 *  - restrictions: trava sair do iCloud, apagar pelos Ajustes e desligar o Buscar.
 *    As três chaves só valem em aparelho SUPERVISIONADO (Apple Configurator).
 * locked=true grava PayloadRemovalDisallowed: em aparelho supervisionado com perfil
 * instalado pelo Configurator, o usuário não remove. Em não supervisionado o iOS ignora.
 * ponytail: perfis sem assinatura (iOS mostra "Não verificado"); assinar com
 * `openssl smime -sign` se incomodar.
 */

// UUID estável por conteúdo: reinstalar substitui o perfil em vez de duplicar.
const uuid = (seed: string) => {
    const h = createHash('sha256').update(seed).digest('hex');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`.toUpperCase();
};
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function wrap(id: string, name: string, description: string, locked: boolean, payloads: string) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadContent</key>
    <array>${payloads}
    </array>
    <key>PayloadDisplayName</key><string>${esc(name)}</string>
    <key>PayloadDescription</key><string>${esc(description)}</string>
    <key>PayloadOrganization</key><string>Tubarão Empréstimos LTDA</string>
    <key>PayloadIdentifier</key><string>${id}</string>
    <key>PayloadUUID</key><string>${uuid(id)}</string>
    <key>PayloadType</key><string>Configuration</string>
    <key>PayloadVersion</key><integer>1</integer>
    <key>PayloadRemovalDisallowed</key><${locked}/>
</dict>
</plist>
`;
}

export function enrollmentProfile(cfg: { host: string; challenge: string; topic: string; locked: boolean }) {
    const base = 'br.com.tubaraoemprestimo.mdm';
    const scepUuid = uuid(`${base}.scep`);
    return wrap(`${base}.enroll`, 'Tubarão Empréstimos — Gestão do aparelho',
        'Aparelho corporativo. A empresa vê inventário (modelo, iOS, apps, bateria) e pode localizar em Modo Perdido. Não acessa WhatsApp, fotos, mensagens nem e-mails.',
        cfg.locked, `
        <dict>
            <key>PayloadType</key><string>com.apple.security.scep</string>
            <key>PayloadVersion</key><integer>1</integer>
            <key>PayloadIdentifier</key><string>${base}.scep</string>
            <key>PayloadUUID</key><string>${scepUuid}</string>
            <key>PayloadDisplayName</key><string>Identidade do aparelho (SCEP)</string>
            <key>PayloadContent</key>
            <dict>
                <key>URL</key><string>https://${esc(cfg.host)}/scep</string>
                <key>Challenge</key><string>${esc(cfg.challenge)}</string>
                <key>Keysize</key><integer>2048</integer>
                <key>Key Type</key><string>RSA</string>
                <key>Key Usage</key><integer>5</integer>
                <key>Subject</key>
                <array>
                    <array><array><string>O</string><string>Tubarao Emprestimos</string></array></array>
                    <array><array><string>CN</string><string>MDM Identity</string></array></array>
                </array>
            </dict>
        </dict>
        <dict>
            <key>PayloadType</key><string>com.apple.mdm</string>
            <key>PayloadVersion</key><integer>1</integer>
            <key>PayloadIdentifier</key><string>${base}.mdm</string>
            <key>PayloadUUID</key><string>${uuid(`${base}.mdm`)}</string>
            <key>PayloadDisplayName</key><string>Gestão do aparelho</string>
            <key>IdentityCertificateUUID</key><string>${scepUuid}</string>
            <key>ServerURL</key><string>https://${esc(cfg.host)}/mdm</string>
            <key>CheckInURL</key><string>https://${esc(cfg.host)}/checkin</string>
            <key>Topic</key><string>${esc(cfg.topic)}</string>
            <key>SignMessage</key><true/>
            <key>CheckOutWhenRemoved</key><true/>
            <key>AccessRights</key><integer>8191</integer>
        </dict>`);
}

export function restrictionsProfile() {
    const id = 'br.com.tubaraoemprestimo.restrictions';
    return wrap(id, 'Tubarão Empréstimos — Proteção do aparelho',
        'Impede sair do iCloud da empresa, apagar o aparelho pelos Ajustes e desligar o Buscar iPhone.', true, `
        <dict>
            <key>PayloadType</key><string>com.apple.applicationaccess</string>
            <key>PayloadVersion</key><integer>1</integer>
            <key>PayloadIdentifier</key><string>${id}.access</string>
            <key>PayloadUUID</key><string>${uuid(`${id}.access`)}</string>
            <key>PayloadDisplayName</key><string>Restrições</string>
            <key>allowAccountModification</key><false/>
            <key>allowEraseContentAndSettings</key><false/>
            <key>allowFindMyDeviceModification</key><false/>
        </dict>`);
}
