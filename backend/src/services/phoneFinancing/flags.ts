/**
 * Feature flags do módulo de celulares/MDM. Tudo desligado por padrão: só a
 * string exata "true" liga. Desligar não apaga dados nem esconde contratos e
 * parcelas já existentes (as rotas do cliente de consulta continuam ativas).
 */
export interface PhoneFlags {
    phoneFinancing: boolean;      // novas propostas pelo cliente
    phoneAdmin: boolean;          // módulo no Admin
    phoneWhatsapp: boolean;       // IA do WhatsApp fala do serviço
    phonePayment: boolean;        // cobrança InfinitePay de parcelas de celular
    mdm: boolean;                 // painel/adapter MDM
    mdmRealCommands: boolean;     // envia comandos ao NanoHUB (senão só mock)
    mdmLabMode: boolean;          // exige dupla aprovação e aparelho de laboratório
}

export function getFlags(env: Record<string, string | undefined> = process.env): PhoneFlags {
    const on = (k: string) => env[k] === 'true';
    const mdm = on('APPLE_MDM_ENABLED');
    return {
        phoneFinancing: on('PHONE_FINANCING_ENABLED'),
        phoneAdmin: on('PHONE_FINANCING_ADMIN_ENABLED'),
        phoneWhatsapp: on('PHONE_FINANCING_WHATSAPP_ENABLED'),
        phonePayment: on('PHONE_FINANCING_PAYMENT_ENABLED'),
        mdm,
        mdmRealCommands: mdm && on('APPLE_MDM_REAL_COMMANDS_ENABLED'),
        mdmLabMode: mdm && on('APPLE_MDM_LAB_MODE'),
    };
}
