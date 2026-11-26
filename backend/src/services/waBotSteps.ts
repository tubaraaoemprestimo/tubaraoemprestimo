import { isValidCpf } from '../routes/legacyClients';
import type { Button } from './whaileys';

/**
 * Etapas do autoatendimento por botões — espelho do Wizard do app (pages/client/Wizard.tsx).
 * Puro: sem banco nem rede (exceto a busca de CEP, injetada). Cada etapa grava em `a[key]`.
 * ponytail: limites copiados do app (services/loanSettingsService.ts). Se virarem configuráveis, ler da mesma fonte.
 */
export const LIMITS = { min: 300, maxNoGuarantee: 3000, max: 10000, investorMin: 10000 };
export type Profile = 'CLT' | 'AUTONOMO' | 'GARANTIA' | 'MOTO' | 'LIMPA_NOME' | 'INVESTIDOR';
export type Media = 'image' | 'video' | 'document';
export type Answers = Record<string, any>;
type Err = { error: string };
type Parsed = { value: any; extra?: Answers } | Err;

export type Step =
    | { kind: 'choice'; key: string; text: string; options: Button[]; stop?: Record<string, string> }
    | { kind: 'text'; key: string; text: string; parse: (s: string, a: Answers, cep?: CepLookup) => Parsed | Promise<Parsed>; optional?: boolean }
    | { kind: 'file'; key: string; text: string; accept: Media[]; multi?: boolean; optional?: boolean }
    | { kind: 'location'; key: string; text: string }
    | { kind: 'info'; key: string; text: string }
    | { kind: 'sign'; key: string; text: string };

export type CepLookup = (cep: string) => Promise<{ street?: string; neighborhood?: string; city?: string; state?: string } | null>;

export const PROFILES: { id: Profile; title: string; description: string }[] = [
    { id: 'CLT', title: '💼 Empréstimo CLT', description: 'Carteira assinada' },
    { id: 'AUTONOMO', title: '🏪 Capital de giro', description: 'Comércio, pagamento em diárias' },
    { id: 'GARANTIA', title: '🚗 Com garantia', description: 'Deixe um bem como garantia' },
    { id: 'MOTO', title: '🏍️ Financiar moto', description: 'Honda Pop 110i 0 km' },
    { id: 'LIMPA_NOME', title: '🧾 Limpar nome', description: 'Contestação de negativação' },
    { id: 'INVESTIDOR', title: '📈 Investir', description: 'A partir de R$ 10.000' },
];
export const PROFILE_LABEL = Object.fromEntries(PROFILES.map(p => [p.id, p.title])) as Record<Profile, string>;

// ───────── Leitura de respostas ─────────
const digits = (s: string) => s.replace(/\D/g, '');
const ok = (value: any, extra?: Answers): Parsed => ({ value, extra });
const err = (error: string): Err => ({ error });
export const isErr = (p: Parsed): p is Err => 'error' in p;

export function parseMoney(s: string): number | null {
    const t = s.replace(/r\$|reais/gi, '').trim();
    if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+([.,]\d{1,2})?$/.test(t)) return null;
    const n = t.includes(',') ? Number(t.replace(/\./g, '').replace(',', '.')) : /^\d{1,3}(\.\d{3})+$/.test(t) ? Number(t.replace(/\./g, '')) : Number(t);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}
export function parseBirth(s: string, now = new Date()): string | null {
    const m = s.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (!m) return null;
    const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCDate() !== d || dt.getUTCMonth() !== mo - 1) return null;
    const age = (now.getTime() - dt.getTime()) / (365.25 * 86400000);
    return age >= 18 && age < 100 ? `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null;
}
const brPhone = (s: string) => { const d = digits(s).replace(/^55(?=\d{10,11}$)/, ''); return /^\d{10,11}$/.test(d) ? d : null; };
const name = (min = 5) => (s: string) => (s.trim().length >= min && /\p{L}/u.test(s) ? ok(s.trim().slice(0, 120)) : err('Digite o nome completo.'));
const free = (min = 2, max = 200) => (s: string) => (s.trim().length >= min ? ok(s.trim().slice(0, max)) : err('Resposta muito curta.'));
const skippable = (s: string) => /^(-|nao|não|nao tenho|não tenho|pular)$/i.test(s.trim());

const yesNo = (key: string, text: string, stop?: Record<string, string>): Step => ({ kind: 'choice', key, text, options: [{ id: 'sim', title: '✅ Sim' }, { id: 'nao', title: '❌ Não' }], stop });
const accept = (key: string, text: string): Step => ({ kind: 'choice', key, text, options: [{ id: 'aceito', title: '✅ Aceito' }], stop: {} });

const RELATIONS = ['Pai', 'Mãe', 'Irmão(ã)', 'Cônjuge', 'Filho(a)', 'Tio(a)', 'Primo(a)', 'Amigo(a)', 'Colega', 'Vizinho(a)', 'Outro'];
const PIX = [{ id: 'cpf', title: 'CPF' }, { id: 'phone', title: 'Telefone' }, { id: 'email', title: 'E-mail' }, { id: 'random', title: 'Chave aleatória' }];
const GUARANTEE_TYPES = ['Carro', 'Moto', 'Celular', 'Notebook', 'TV', 'Eletrodoméstico'];

function personal(p: Profile, a: Answers): Step[] {
    const s: Step[] = [
        { kind: 'text', key: 'name', text: 'Qual é o seu *nome completo*?', parse: name() },
        p === 'LIMPA_NOME'
            ? { kind: 'text', key: 'cpf', text: 'Informe o *CPF ou CNPJ* (só números).', parse: s => { const d = digits(s); return isValidCpf(d) || (d.length === 14 && !/^(\d)\1+$/.test(d)) ? ok(d) : err('CPF ou CNPJ inválido.'); } }
            : { kind: 'text', key: 'cpf', text: 'Informe o seu *CPF* (só números).', parse: s => (isValidCpf(s) ? ok(digits(s)) : err('CPF inválido. Confira e digite de novo.')) },
        { kind: 'text', key: 'birthDate', text: 'Data de nascimento (ex.: *25/03/1990*).', parse: s => { const v = parseBirth(s); return v ? ok(v) : err('Data inválida ou menor de 18 anos. Use DD/MM/AAAA.'); } },
    ];
    if (!a.phone) s.push({ kind: 'text', key: 'phone', text: 'Seu número de WhatsApp com DDD (ex.: 11999998888).', parse: t => { const v = brPhone(t); return v ? ok(v) : err('Número inválido.'); } });
    if (p === 'LIMPA_NOME') return s;
    s.push(
        { kind: 'text', key: 'instagram', text: 'Seu *Instagram* (ex.: @seunome). Se não tiver, envie *-*.', parse: t => ok(skippable(t) ? '' : t.trim().slice(0, 60)) },
        { kind: 'text', key: 'cep', text: 'Seu *CEP* (só números).', parse: async (t, _a, cep) => {
            const d = digits(t); if (d.length !== 8) return err('CEP deve ter 8 números.');
            const r = cep ? await cep(d).catch(() => null) : null;
            return ok(d, r ? { street: r.street, neighborhood: r.neighborhood, city: r.city, state: r.state } : {});
        } },
    );
    if (!a.street) s.push({ kind: 'text', key: 'street', text: 'Não achei o CEP. Digite *rua, bairro e cidade*.', parse: free(5) });
    s.push({ kind: 'text', key: 'number', text: `${a.street ? `Endereço: *${[a.street, a.neighborhood, a.city].filter(Boolean).join(', ')}*.\n` : ''}Qual o *número* (e complemento)?`, parse: free(1, 60) });
    s.push({ kind: 'text', key: 'income', text: 'Qual a sua *renda mensal*? (ex.: 2500)', parse: t => { const v = parseMoney(t); return v ? ok(v) : err('Valor inválido.'); } });
    if (p === 'CLT') s.push(
        { kind: 'text', key: 'occupation', text: 'Qual a sua *profissão/cargo*?', parse: free() },
        { kind: 'text', key: 'companyName', text: 'Nome da *empresa* onde trabalha.', parse: free() },
    );
    if (p === 'AUTONOMO') s.push(
        { kind: 'text', key: 'cnpj', text: 'CNPJ do comércio (só números). Se não tiver, envie *-*.', parse: t => { if (skippable(t)) return ok(''); const d = digits(t); return d.length === 14 ? ok(d) : err('CNPJ deve ter 14 números (ou envie -).'); } },
        { kind: 'text', key: 'businessAddress', text: 'Endereço do *comércio*.', parse: free(5) },
    );
    for (const n of [1, 2]) s.push(
        { kind: 'text', key: `ref${n}Name`, text: `*Contato de confiança ${n}*: nome completo.`, parse: name(3) },
        { kind: 'text', key: `ref${n}Phone`, text: `Telefone do contato ${n} com DDD.`, parse: t => { const v = brPhone(t); if (!v) return err('Número inválido.'); return v === a.phone || (n === 2 && v === a.ref1Phone) ? err('Use um número diferente do seu e do outro contato.') : ok(v); } },
        { kind: 'choice', key: `ref${n}Rel`, text: `Qual o parentesco com o contato ${n}?`, options: RELATIONS.map(r => ({ id: r, title: r })) },
    );
    return s;
}

function guarantee(a: Answers): Step[] {
    const s: Step[] = [];
    const count = Number(a.gCount || 1);
    for (let i = 0; i < count; i++) s.push(
        { kind: 'choice', key: `g${i}Type`, text: `*Bem ${i + 1}* em garantia: qual o tipo?`, options: GUARANTEE_TYPES.map(t => ({ id: t.toLowerCase(), title: t })) },
        { kind: 'text', key: `g${i}Desc`, text: 'Descreva o bem (marca, modelo, ano).', parse: free(3) },
        { kind: 'text', key: `g${i}Cond`, text: 'Estado de conservação (ex.: ótimo, bom, com marcas de uso).', parse: free(2, 120) },
        { kind: 'text', key: `g${i}Value`, text: 'Valor estimado do bem (ex.: 8000).', parse: t => { const v = parseMoney(t); return v ? ok(v) : err('Valor inválido.'); } },
        { kind: 'file', key: `g${i}Photos`, text: 'Envie *fotos do bem*. Quando terminar, toque em *Pronto*.', accept: ['image'], multi: true },
        yesNo(`g${i}HasInvoice`, 'Tem nota fiscal do bem?'),
    );
    for (let i = 0; i < count; i++) if (a[`g${i}HasInvoice`] === 'sim') s.push({ kind: 'file', key: `g${i}Invoice`, text: `Envie a *nota fiscal* do bem ${i + 1} (foto ou PDF).`, accept: ['image', 'document'] });
    const total = Array.from({ length: count }, (_, i) => Number(a[`g${i}Value`] || 0)).reduce((x, y) => x + y, 0);
    const needed = Number(a.amount || 0) * 2;
    if (a[`g${count - 1}HasInvoice`] && total < needed && count < 5) {
        s.push({ kind: 'choice', key: `gMore${count}`, text: `A soma dos bens (R$ ${total.toLocaleString('pt-BR')}) precisa ser pelo menos o dobro do valor pedido (R$ ${needed.toLocaleString('pt-BR')}). Quer adicionar outro bem?`, options: [{ id: 'sim', title: '➕ Adicionar bem' }, { id: 'nao', title: '❌ Desistir' }], stop: { nao: 'Tudo bem. Sem garantia suficiente não conseguimos seguir com este pedido. Digite *menu* para recomeçar.' } });
    }
    return s;
}

function documents(p: Profile): Step[] {
    const img: Media[] = ['image'], imgDoc: Media[] = ['image', 'document'];
    const s: Step[] = [
        { kind: 'file', key: 'selfie', text: '📸 Tire uma *selfie segurando seu documento* (RG ou CNH) ao lado do rosto.', accept: img },
        { kind: 'file', key: 'idFront', text: p === 'MOTO' ? 'Foto da *CNH (frente)*.' : 'Foto do *documento (frente)* — RG ou CNH.', accept: img },
        { kind: 'file', key: 'idBack', text: 'Foto do *documento (verso)*.', accept: img },
        { kind: 'file', key: 'proofAddress', text: '*Comprovante de endereço* (foto ou PDF).', accept: imgDoc },
        { kind: 'file', key: 'proofIncome', text: '*Comprovante de renda* (foto ou PDF).', accept: imgDoc },
        { kind: 'file', key: 'housePhotos', text: '*Fotos da sua casa* (fachada e interior). Quando terminar, toque em *Pronto*.', accept: img, multi: true },
    ];
    if (p !== 'MOTO') s.push(
        { kind: 'file', key: 'billInName', text: '*Conta no seu nome* (água, luz, internet…), foto ou PDF.', accept: imgDoc },
        { kind: 'file', key: 'videoHouse', text: p === 'AUTONOMO' ? '🎥 Grave um *vídeo do seu comércio* (até 1 minuto).' : '🎥 Grave um *vídeo da sua casa* (até 1 minuto).', accept: ['video'] },
        { kind: 'file', key: 'videoSelfie', text: '🎥 Grave um *vídeo do seu rosto* dizendo seu nome e que *aceita os juros e as condições* do empréstimo.', accept: ['video'] },
    );
    if (p === 'CLT') s.push({ kind: 'file', key: 'workCard', text: '*Carteira de trabalho digital* (PDF ou print).', accept: imgDoc });
    if (p === 'AUTONOMO') s.push({ kind: 'file', key: 'cnh', text: 'Foto da *CNH*. Se não tiver, toque em *Pular*.', accept: img, optional: true });
    s.push({ kind: 'location', key: 'location', text: '📍 Envie sua *localização atual*: toque no 📎 › *Localização* › *Localização atual*.' });
    return s;
}

const bank = (investor = false): Step[] => [
    { kind: 'text', key: 'bankName', text: `🏦 Nome do *banco* para ${investor ? 'receber os rendimentos' : 'receber o valor'}.`, parse: free() },
    { kind: 'choice', key: 'pixKeyType', text: 'Qual o tipo da sua *chave PIX*?', options: PIX },
    { kind: 'text', key: 'pixKey', text: 'Digite a *chave PIX*.', parse: free(4, 120) },
    { kind: 'text', key: 'accountHolderName', text: 'Nome do *titular* da conta.', parse: name(3) },
    ...(investor ? [] : [{ kind: 'text', key: 'accountHolderCpf', text: 'CPF do titular da conta.', parse: (t: string) => (isValidCpf(t) ? ok(digits(t)) : err('CPF inválido.')) } as Step]),
];

/** Assinatura pelo link seguro: desenha a assinatura, tira uma selfie e compartilha a localização. */
const signature: Step = { kind: 'sign', key: 'signature', text: '✍️ *Última etapa: assinatura*\nToque no link abaixo para *assinar*, tirar uma *foto* e confirmar sua *localização*. Ele vale por 24 horas.' };

const TERMS = 'Ao aceitar, você declara que as informações e documentos enviados são verdadeiros e autoriza a Tubarão Empréstimos a consultar seus dados para análise de crédito e a tratá-los conforme a LGPD. A solicitação está sujeita a análise.';

/** Lista de etapas da modalidade, recalculada a cada resposta (etapas condicionais). */
export function stepsFor(p: Profile, a: Answers): Step[] {
    if (p === 'INVESTIDOR') {
        const tier = Number(a.amount || 0) >= 50000 ? 'PREMIUM' : 'STANDARD';
        const rate = (mode: string) => (tier === 'PREMIUM' ? (mode === 'MONTHLY' ? 5 : 6) : (mode === 'MONTHLY' ? 2.5 : 3.5));
        return [
            { kind: 'info', key: 'about', text: '📈 *Programa de Investimento Tubarão*\n\n• A partir de R$ 10.000\n• Standard (até R$ 49.999): 2,5% a.m. mensal ou 3,5% a.m. anual acumulado\n• Premium (a partir de R$ 50.000): 5% a.m. mensal ou 6% a.m. anual acumulado\n\nNossa equipe entra em contato em até 48 h para formalizar.' },
            { kind: 'text', key: 'name', text: 'Seu *nome completo*.', parse: name() },
            { kind: 'text', key: 'birthDate', text: 'Data de nascimento (ex.: *25/03/1990*).', parse: s => { const v = parseBirth(s); return v ? ok(v) : err('Data inválida ou menor de 18 anos.'); } },
            ...(a.phone ? [] : [{ kind: 'text', key: 'phone', text: 'Seu WhatsApp com DDD.', parse: (t: string) => { const v = brPhone(t); return v ? ok(v) : err('Número inválido.'); } } as Step]),
            { kind: 'choice', key: 'contactTime', text: 'Melhor horário para contato?', options: [{ id: 'manha', title: 'Manhã' }, { id: 'tarde', title: 'Tarde' }, { id: 'noite', title: 'Noite' }, { id: 'qualquer', title: 'Qualquer horário' }] },
            { kind: 'text', key: 'amount', text: 'Quanto deseja investir? (mínimo R$ 10.000)', parse: t => { const v = parseMoney(t); return v && v >= LIMITS.investorMin ? ok(v) : err('Valor mínimo: R$ 10.000.'); } },
            { kind: 'choice', key: 'payoutMode', text: `Faixa *${tier === 'PREMIUM' ? 'Premium' : 'Standard'}*. Como prefere receber?`, options: [{ id: 'MONTHLY', title: `Mensal ${String(rate('MONTHLY')).replace('.', ',')}%` }, { id: 'ANNUAL', title: `Anual ${String(rate('ANNUAL')).replace('.', ',')}%` }] },
            ...bank(true),
            accept('terms', TERMS),
            signature,
        ];
    }
    const s: Step[] = [];
    if (p === 'CLT' || p === 'AUTONOMO' || p === 'GARANTIA') {
        s.push(yesNo('returning', 'Você *já é cliente* da Tubarão?'));
        const max = p === 'GARANTIA' ? LIMITS.max : LIMITS.maxNoGuarantee;
        s.push({ kind: 'text', key: 'amount', text: `Qual valor você precisa? (de R$ ${LIMITS.min} a R$ ${max.toLocaleString('pt-BR')})${p !== 'GARANTIA' ? '\n_Acima disso, escolha Empréstimo com garantia._' : ''}`, parse: t => { const v = parseMoney(t); return v && v >= LIMITS.min && v <= max ? ok(v) : err(`Digite um valor entre R$ ${LIMITS.min} e R$ ${max.toLocaleString('pt-BR')}.`); } });
    }
    if (p === 'CLT') s.push(yesNo('clt3m', 'Você tem *mais de 3 meses* de carteira assinada no emprego atual?', { nao: 'No momento o empréstimo CLT exige mais de 3 meses de carteira assinada. Quando completar, é só voltar aqui. Digite *menu* para ver outras opções.' }));
    if (p === 'AUTONOMO') s.push(
        { kind: 'choice', key: 'paymentDays', text: 'Em quantas *diárias* você quer pagar?', options: [{ id: '20', title: '20 diárias' }, { id: '30', title: '30 diárias' }] },
        accept('commerceTerms', 'Declaro que tenho comércio em funcionamento e que o pagamento será em diárias, de segunda a sábado.'),
    );
    if (p === 'MOTO') s.push({ kind: 'info', key: 'product', text: '🏍️ *Honda Pop 110i 2026* — 0 km\n\n• Entrada: R$ 2.000,00\n• 36x R$ 611,00 + seguro R$ 150,00/mês\n• Cor conforme estoque\n• Transferência após a 36ª parcela' });
    s.push(accept('terms', TERMS));
    s.push(...personal(p, a));
    if (p === 'LIMPA_NOME') return [...s, signature];
    if (p === 'GARANTIA') s.push(...guarantee(a));
    s.push(...documents(p));
    if (p !== 'MOTO') s.push(...bank());
    s.push(signature);
    return s;
}

/** Próxima etapa sem resposta (null = tudo respondido). */
export function nextStep(p: Profile, a: Answers): Step | null {
    return stepsFor(p, a).find(st => a[st.key] === undefined) || null;
}

/** Soma dos bens ≥ 2x o valor pedido (regra do app). */
export function guaranteeOk(a: Answers) {
    const count = Number(a.gCount || 1);
    const total = Array.from({ length: count }, (_, i) => Number(a[`g${i}Value`] || 0)).reduce((x, y) => x + y, 0);
    return total >= Number(a.amount || 0) * 2;
}

/** Evidências da assinatura pelo link (foto, local, horário, IP). */
const signMeta = (a: Answers) => a.signature ? { photoUrl: a.signature.photoUrl, latitude: a.signature.lat, longitude: a.signature.lng, accuracy: a.signature.accuracy, at: a.signature.at, ip: a.signature.ip, userAgent: a.signature.ua } : undefined;

/** Corpo igual ao do app (services/apiService.ts submitRequest) para POST /loan-requests. */
export function buildPayload(p: Profile, a: Answers, meta: { email: string; acceptedAt: string; messageId: string }) {
    const files = (k: string) => (Array.isArray(a[k]) ? a[k] : []);
    if (p === 'INVESTIDOR') {
        const tier = Number(a.amount) >= 50000 ? 'PREMIUM' : 'STANDARD';
        const monthlyRate = tier === 'PREMIUM' ? (a.payoutMode === 'MONTHLY' ? 5 : 6) : (a.payoutMode === 'MONTHLY' ? 2.5 : 3.5);
        return {
            profileType: p, fullName: a.name, clientName: a.name, cpf: '', birthDate: a.birthDate, email: meta.email, phone: a.phone,
            preferredContactTime: a.contactTime, bankName: a.bankName, pixKey: a.pixKey, pixKeyType: a.pixKeyType, accountHolderName: a.accountHolderName,
            amount: a.amount, investmentAmount: a.amount, investmentTier: tier, payoutMode: a.payoutMode, monthlyRate, termsAccepted: true,
            signatureUrl: a.signature?.url, declarationAccepted: true,
            supplementalDescription: JSON.stringify({ channel: 'WHATSAPP_BUTTONS', acceptance: { at: meta.acceptedAt, phone: a.phone, messageId: meta.messageId }, signature: signMeta(a) }),
        };
    }
    const count = Number(a.gCount || 1);
    const collateralItems = p === 'GARANTIA' ? Array.from({ length: count }, (_, i) => ({
        type: a[`g${i}Type`], description: a[`g${i}Desc`], condition: a[`g${i}Cond`], estimatedValue: a[`g${i}Value`],
        photos: files(`g${i}Photos`), hasInvoice: a[`g${i}HasInvoice`] === 'sim', invoiceUrl: files(`g${i}Invoice`)[0] || null,
    })) : undefined;
    const loc = a.location || {};
    const extra = {
        channel: 'WHATSAPP_BUTTONS',
        acceptance: { at: meta.acceptedAt, phone: a.phone, messageId: meta.messageId },
        housePhotos: files('housePhotos'), billInName: files('billInName'), cnh: files('cnh'),
        location: loc.lat != null ? { latitude: loc.lat, longitude: loc.lng } : undefined,
        address: a.street, number: a.number, cep: a.cep, neighborhood: a.neighborhood, city: a.city, state: a.state,
        contactTrust1Name: a.ref1Name, contactTrust1Relationship: a.ref1Rel, contactTrust2Name: a.ref2Name, contactTrust2Relationship: a.ref2Rel,
        instagram: a.instagram || undefined, occupation: a.occupation, cnpj: a.cnpj || undefined, businessAddress: a.businessAddress,
        accountHolderCpf: a.accountHolderCpf, isReturningClient: a.returning === 'sim',
        signature: signMeta(a),
    };
    const installments = p === 'LIMPA_NOME' ? 0 : p === 'MOTO' ? 36 : p === 'AUTONOMO' ? Number(a.paymentDays) : 1;
    return {
        profileType: p, clientName: a.name, cpf: a.cpf, email: meta.email, phone: a.phone, birthDate: a.birthDate, instagram: a.instagram || undefined,
        zipCode: a.cep, address: a.street, neighborhood: a.neighborhood, city: a.city, state: a.state,
        monthlyIncome: a.income, companyName: a.companyName,
        amount: p === 'LIMPA_NOME' ? 0 : p === 'MOTO' ? 21996 : a.amount, installments,
        companyPaymentDay: p === 'AUTONOMO' ? Number(a.paymentDays) : undefined,
        reference1Name: a.ref1Name, reference1Phone: a.ref1Phone, reference2Name: a.ref2Name, reference2Phone: a.ref2Phone,
        selfieUrl: files('selfie'), idCardUrl: files('idFront'), idCardBackUrl: files('idBack'), proofOfAddressUrl: files('proofAddress'),
        proofIncomeUrl: files('proofIncome'), videoSelfieUrl: files('videoSelfie'), videoHouseUrl: files('videoHouse'),
        workCardUrl: files('workCard'), signatureUrl: a.signature?.url,
        collateralItems,
        bankName: a.bankName, pixKey: a.pixKey, pixKeyType: a.pixKeyType, accountHolderName: a.accountHolderName,
        latitude: loc.lat ?? null, longitude: loc.lng ?? null,
        contractTermsAccepted: true, declarationAccepted: true, contractAccepted: true,
        supplementalDescription: JSON.stringify(extra),
    };
}

/** Resumo antes do envio (o cliente confirma por botão). */
export function summary(p: Profile, a: Answers) {
    const money = (n: any) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const lines = [`*${PROFILE_LABEL[p]}*`, `Nome: ${a.name}`];
    if (a.cpf) lines.push(`CPF/CNPJ: ***${String(a.cpf).slice(-4)}`);
    if (p === 'MOTO') lines.push('Produto: Honda Pop 110i — 36x R$ 611,00');
    else if (a.amount) lines.push(`Valor: ${money(a.amount)}${p === 'AUTONOMO' ? ` em ${a.paymentDays} diárias` : ''}`);
    if (p === 'INVESTIDOR') lines.push(`Recebimento: ${a.payoutMode === 'MONTHLY' ? 'mensal' : 'anual acumulado'}`);
    if (a.pixKey) lines.push(`PIX: ${a.pixKeyType} ***${String(a.pixKey).slice(-4)}`);
    const nFiles = Object.values(a).filter(v => Array.isArray(v)).reduce((n: number, v: any) => n + v.length, 0);
    if (nFiles) lines.push(`Arquivos enviados: ${nFiles}`);
    return lines.join('\n');
}
