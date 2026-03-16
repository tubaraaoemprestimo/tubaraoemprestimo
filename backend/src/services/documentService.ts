import { prisma } from './prisma';

// ============================================================
// TIPOS
// ============================================================

export interface CompanySettings {
    cnpj: string;
    companyName: string;
    pixKey: string;
    pixKeyType: string;
    pixReceiverName: string;
    appUrl: string;
}

// ============================================================
// HELPERS
// ============================================================

function formatBRL(value: number): string {
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(date: Date | string | null | undefined): string {
    if (!date) return '—';
    const d = new Date(date);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatCPF(cpf: string): string {
    const c = cpf.replace(/\D/g, '');
    if (c.length !== 11) return cpf;
    return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
}

function docId(id: string): string {
    return id.replace(/-/g, '').substring(0, 12).toUpperCase();
}

// ============================================================
// BUSCAR SETTINGS DA EMPRESA
// ============================================================

export async function getCompanySettings(): Promise<CompanySettings> {
    const rows = await prisma.$queryRaw<{ key: string; value: string }[]>`
        SELECT key, value FROM system_settings
        WHERE key IN ('cnpj','companyName','pixKey','pixKeyType','pixReceiverName')
    `;
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    return {
        cnpj: map['cnpj'] || '57.241.795/0001-47',
        companyName: map['companyName'] || 'BM SOLUCTION MARKETING LTDA',
        pixKey: map['pixKey'] || '57.241.795/0001-47',
        pixKeyType: map['pixKeyType'] || 'CNPJ',
        pixReceiverName: map['pixReceiverName'] || 'BM SOLUCTION MARKETING LTDA',
        appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://www.tubaraoemprestimo.com.br',
    };
}

// ============================================================
// SALVAR DOCUMENTO
// ============================================================

export async function saveDocument(params: {
    type: 'CONTRACT' | 'RECEIPT' | 'DISCHARGE';
    customerId: string;
    loanId?: string;
    installmentId?: string;
    title: string;
    htmlContent: string;
    amount?: number;
    metadata?: Record<string, any>;
    createdBy?: string;
}): Promise<string> {
    const id = await prisma.$queryRaw<{ id: string }[]>`
        INSERT INTO generated_documents (id, type, customer_id, loan_id, installment_id, title, html_content, amount, metadata, created_by)
        VALUES (
            gen_random_uuid()::text,
            ${params.type},
            ${params.customerId},
            ${params.loanId || null},
            ${params.installmentId || null},
            ${params.title},
            ${params.htmlContent},
            ${params.amount || null},
            ${JSON.stringify(params.metadata || {})}::jsonb,
            ${params.createdBy || 'SYSTEM'}
        )
        RETURNING id
    `;
    return id[0].id;
}

// ============================================================
// CSS BASE COMPARTILHADO
// ============================================================

function baseStyles(): string {
    return `
        body { margin:0; padding:0; font-family:'Segoe UI',Arial,sans-serif; background:#0a0a0a; color:#e0e0e0; }
        .doc { max-width:700px; margin:0 auto; background:#111; border:1px solid #2a2a2a; border-radius:12px; overflow:hidden; }
        .header { background:linear-gradient(135deg,#D4AF37,#C5A028); padding:28px 32px; text-align:center; }
        .header h1 { margin:0; color:#000; font-size:22px; font-weight:800; letter-spacing:2px; text-transform:uppercase; }
        .header p { margin:6px 0 0; color:#1a1a1a; font-size:12px; font-weight:600; letter-spacing:1px; }
        .doc-type { background:#1a1a1a; border-bottom:2px solid #D4AF37; padding:16px 32px; text-align:center; }
        .doc-type h2 { margin:0; color:#D4AF37; font-size:18px; letter-spacing:1px; text-transform:uppercase; }
        .doc-type p { margin:4px 0 0; color:#888; font-size:12px; }
        .body { padding:28px 32px; }
        .section { margin-bottom:24px; }
        .section-title { color:#D4AF37; font-size:12px; font-weight:700; letter-spacing:2px; text-transform:uppercase; border-bottom:1px solid #2a2a2a; padding-bottom:8px; margin-bottom:14px; }
        .row { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #1e1e1e; font-size:14px; }
        .row:last-child { border-bottom:none; }
        .row .label { color:#888; }
        .row .value { color:#fff; font-weight:600; text-align:right; }
        .highlight-box { background:#1a1a1a; border:1px solid #D4AF37; border-radius:8px; padding:16px 20px; margin:16px 0; }
        .highlight-box .big { font-size:28px; font-weight:800; color:#D4AF37; text-align:center; display:block; }
        .highlight-box .label-sm { font-size:12px; color:#888; text-align:center; display:block; margin-bottom:6px; }
        .pix-box { background:#0d1a0d; border:1px solid #2a4a2a; border-radius:8px; padding:14px 20px; margin:16px 0; }
        .pix-box .pix-label { color:#4caf50; font-size:12px; font-weight:700; letter-spacing:1px; margin-bottom:8px; }
        .pix-box .pix-row { display:flex; justify-content:space-between; font-size:13px; padding:4px 0; }
        .pix-box .pix-row .k { color:#888; }
        .pix-box .pix-row .v { color:#fff; font-weight:600; }
        .clauses { background:#0f0f0f; border-radius:8px; padding:16px 20px; font-size:13px; color:#888; line-height:1.8; }
        .clauses p { margin:0 0 8px; }
        .sig-area { display:flex; justify-content:space-between; margin-top:32px; gap:24px; }
        .sig-block { flex:1; text-align:center; }
        .sig-line { border-top:1px solid #444; padding-top:8px; margin-top:40px; font-size:12px; color:#888; }
        .footer { background:#0d0d0d; padding:16px 32px; text-align:center; border-top:1px solid #1e1e1e; }
        .footer p { margin:4px 0; font-size:11px; color:#555; }
        .stamp-ok { display:inline-block; background:#1a3a1a; border:2px solid #4caf50; color:#4caf50; font-weight:800; font-size:13px; letter-spacing:2px; padding:6px 20px; border-radius:6px; margin:8px 0; text-transform:uppercase; }
        .stamp-discharge { display:inline-block; background:#1a2a3a; border:2px solid #D4AF37; color:#D4AF37; font-weight:800; font-size:14px; letter-spacing:2px; padding:8px 24px; border-radius:6px; margin:12px 0; text-transform:uppercase; }
    `;
}

// ============================================================
// GERAR HTML — CONTRATO
// ============================================================

export function generateContractHTML(params: {
    loan: any;
    customer: any;
    loanRequest: any;
    settings: CompanySettings;
}): string {
    const { loan, customer, loanRequest, settings } = params;
    const now = new Date();
    const contractNum = docId(loan.id);

    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<style>${baseStyles()}</style></head><body>
<div class="doc">
    <div class="header">
        <h1>🦈 ${settings.companyName}</h1>
        <p>CNPJ: ${settings.cnpj}</p>
    </div>
    <div class="doc-type">
        <h2>📄 Contrato de Empréstimo</h2>
        <p>Nº ${contractNum} &nbsp;|&nbsp; Emitido em ${formatDate(now)}</p>
    </div>
    <div class="body">

        <div class="section">
            <div class="section-title">Contratante (CREDOR)</div>
            <div class="row"><span class="label">Razão Social</span><span class="value">${settings.companyName}</span></div>
            <div class="row"><span class="label">CNPJ</span><span class="value">${settings.cnpj}</span></div>
        </div>

        <div class="section">
            <div class="section-title">Contratado (DEVEDOR)</div>
            <div class="row"><span class="label">Nome Completo</span><span class="value">${customer.name}</span></div>
            <div class="row"><span class="label">CPF</span><span class="value">${formatCPF(customer.cpf)}</span></div>
            <div class="row"><span class="label">Telefone</span><span class="value">${customer.phone || '—'}</span></div>
            <div class="row"><span class="label">E-mail</span><span class="value">${customer.email}</span></div>
        </div>

        <div class="section">
            <div class="section-title">Condições do Empréstimo</div>
            <div class="highlight-box">
                <span class="label-sm">Valor do Empréstimo</span>
                <span class="big">${formatBRL(loan.amount || loan.principalAmount)}</span>
            </div>
            <div class="row"><span class="label">Taxa de Juros</span><span class="value">${loan.interestRate || loanRequest?.monthlyRate || '—'}% a.m.</span></div>
            <div class="row"><span class="label">Número de Parcelas</span><span class="value">${loan.totalInstallments || loan.installmentsCount}</span></div>
            <div class="row"><span class="label">Frequência de Pagamento</span><span class="value">${loan.paymentFrequency === 'DAILY' ? 'Diária' : loan.paymentFrequency === 'WEEKLY' ? 'Semanal' : 'Mensal'}</span></div>
            <div class="row"><span class="label">Data do 1º Pagamento</span><span class="value">${formatDate(loan.firstPaymentDate || loan.nextPaymentDate)}</span></div>
            <div class="row"><span class="label">Saldo Devedor Inicial</span><span class="value">${formatBRL(loan.remainingAmount || loan.amount)}</span></div>
            <div class="row"><span class="label">Data de Início</span><span class="value">${formatDate(loan.startDate)}</span></div>
        </div>

        <div class="section">
            <div class="section-title">Dados para Pagamento</div>
            <div class="pix-box">
                <div class="pix-label">💚 Chave PIX para Pagamento</div>
                <div class="pix-row"><span class="k">Tipo</span><span class="v">${settings.pixKeyType}</span></div>
                <div class="pix-row"><span class="k">Chave</span><span class="v">${settings.pixKey}</span></div>
                <div class="pix-row"><span class="k">Favorecido</span><span class="v">${settings.pixReceiverName}</span></div>
            </div>
        </div>

        <div class="section">
            <div class="section-title">Cláusulas e Condições</div>
            <div class="clauses">
                <p>1. O DEVEDOR se compromete a pagar as parcelas nas datas acordadas, conforme as condições estabelecidas neste contrato.</p>
                <p>2. Em caso de atraso, serão cobrados juros de mora e multa conforme tabela vigente da empresa.</p>
                <p>3. O pagamento deve ser realizado exclusivamente pela chave PIX indicada neste contrato.</p>
                <p>4. Após cada pagamento, o DEVEDOR deve enviar o comprovante pelo aplicativo para confirmação.</p>
                <p>5. A quitação antecipada pode ser solicitada a qualquer momento, com desconto proporcional dos juros futuros.</p>
                <p>6. Este contrato é regido pelas leis da República Federativa do Brasil.</p>
            </div>
        </div>

        <div class="sig-area">
            <div class="sig-block">
                <div class="sig-line">${settings.companyName}<br>CNPJ: ${settings.cnpj}<br>CREDOR</div>
            </div>
            <div class="sig-block">
                <div class="sig-line">${customer.name}<br>CPF: ${formatCPF(customer.cpf)}<br>DEVEDOR</div>
            </div>
        </div>
    </div>
    <div class="footer">
        <p>${settings.companyName} &nbsp;|&nbsp; CNPJ: ${settings.cnpj}</p>
        <p>Contrato Nº ${contractNum} &nbsp;|&nbsp; Emitido em ${formatDate(now)}</p>
        <p>Acesse ${settings.appUrl} para acompanhar seu contrato</p>
    </div>
</div>
</body></html>`;
}

// ============================================================
// GERAR HTML — RECIBO DE PAGAMENTO
// ============================================================

export function generateReceiptHTML(params: {
    receipt: any;
    installment: any;
    loan: any;
    customer: any;
    settings: CompanySettings;
    installmentNumber?: number;
}): string {
    const { receipt, installment, loan, customer, settings, installmentNumber } = params;
    const receiptNum = docId(receipt.id);
    const now = new Date();

    const totalInstallments = loan.totalInstallments || loan.installmentsCount || 1;
    const installNum = installmentNumber || 1;

    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<style>${baseStyles()}</style></head><body>
<div class="doc">
    <div class="header">
        <h1>🦈 ${settings.companyName}</h1>
        <p>CNPJ: ${settings.cnpj}</p>
    </div>
    <div class="doc-type">
        <h2>🧾 Recibo de Pagamento</h2>
        <p>Nº ${receiptNum} &nbsp;|&nbsp; Emitido em ${formatDate(now)}</p>
    </div>
    <div class="body">

        <div style="text-align:center; margin-bottom:20px;">
            <span class="stamp-ok">✅ Pagamento Confirmado</span>
        </div>

        <div class="section">
            <div class="section-title">Dados do Pagador</div>
            <div class="row"><span class="label">Nome</span><span class="value">${customer.name}</span></div>
            <div class="row"><span class="label">CPF</span><span class="value">${formatCPF(customer.cpf)}</span></div>
            <div class="row"><span class="label">E-mail</span><span class="value">${customer.email}</span></div>
        </div>

        <div class="section">
            <div class="section-title">Dados do Pagamento</div>
            <div class="highlight-box">
                <span class="label-sm">Valor Pago</span>
                <span class="big">${formatBRL(Number(receipt.amount || installment.amount))}</span>
            </div>
            <div class="row"><span class="label">Data do Pagamento</span><span class="value">${formatDate(receipt.reviewedAt || now)}</span></div>
            <div class="row"><span class="label">Parcela</span><span class="value">${installNum} / ${totalInstallments}</span></div>
            <div class="row"><span class="label">Vencimento da Parcela</span><span class="value">${formatDate(installment.dueDate)}</span></div>
            <div class="row"><span class="label">Referente ao Contrato</span><span class="value">Nº ${docId(loan.id)}</span></div>
        </div>

        <div class="section">
            <div class="section-title">Saldo Devedor</div>
            <div class="row"><span class="label">Saldo Anterior</span><span class="value">${formatBRL(Number(loan.remainingAmount) + Number(receipt.amount || installment.amount))}</span></div>
            <div class="row"><span class="label">Valor Pago</span><span class="value" style="color:#4caf50;">- ${formatBRL(Number(receipt.amount || installment.amount))}</span></div>
            <div class="row"><span class="label">Saldo Devedor Atual</span><span class="value" style="color:#D4AF37;">${formatBRL(Number(loan.remainingAmount))}</span></div>
        </div>

        <div class="section">
            <div class="section-title">Empresa Recebedora</div>
            <div class="row"><span class="label">Razão Social</span><span class="value">${settings.companyName}</span></div>
            <div class="row"><span class="label">CNPJ</span><span class="value">${settings.cnpj}</span></div>
        </div>

        <div class="sig-area">
            <div class="sig-block">
                <div class="sig-line">${settings.companyName}<br>CNPJ: ${settings.cnpj}<br>CREDOR</div>
            </div>
            <div class="sig-block">
                <div class="sig-line">${customer.name}<br>CPF: ${formatCPF(customer.cpf)}<br>DEVEDOR</div>
            </div>
        </div>
    </div>
    <div class="footer">
        <p>Recibo Nº ${receiptNum} &nbsp;|&nbsp; ${settings.companyName} &nbsp;|&nbsp; CNPJ: ${settings.cnpj}</p>
        <p>Emitido em ${formatDate(now)} &nbsp;|&nbsp; Documento com validade legal</p>
        <p>Acesse ${settings.appUrl} para ver seus documentos</p>
    </div>
</div>
</body></html>`;
}

// ============================================================
// GERAR HTML — DECLARAÇÃO DE QUITAÇÃO
// ============================================================

export function generateDischargeHTML(params: {
    loan: any;
    customer: any;
    settings: CompanySettings;
    totalPaid: number;
}): string {
    const { loan, customer, settings, totalPaid } = params;
    const now = new Date();
    const dischargeNum = docId(loan.id) + 'QT';

    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<style>${baseStyles()}</style></head><body>
<div class="doc">
    <div class="header">
        <h1>🦈 ${settings.companyName}</h1>
        <p>CNPJ: ${settings.cnpj}</p>
    </div>
    <div class="doc-type">
        <h2>🏆 Declaração de Quitação</h2>
        <p>Nº ${dischargeNum} &nbsp;|&nbsp; Emitido em ${formatDate(now)}</p>
    </div>
    <div class="body">

        <div style="text-align:center; margin:20px 0;">
            <span class="stamp-discharge">🏆 CONTRATO QUITADO</span>
        </div>

        <div class="section">
            <div class="section-title">Declaração</div>
            <div class="clauses" style="font-size:15px; color:#e0e0e0; line-height:2;">
                <p>A empresa <strong style="color:#D4AF37;">${settings.companyName}</strong>, inscrita no CNPJ sob nº <strong>${settings.cnpj}</strong>, declara para os devidos fins de direito que o(a) Sr(a). <strong style="color:#fff;">${customer.name}</strong>, portador(a) do CPF <strong>${formatCPF(customer.cpf)}</strong>, quitou integralmente o contrato de empréstimo abaixo especificado, nada mais havendo a receber a qualquer título, seja de principal, juros, multas ou encargos.</p>
            </div>
        </div>

        <div class="section">
            <div class="section-title">Dados do Cliente</div>
            <div class="row"><span class="label">Nome Completo</span><span class="value">${customer.name}</span></div>
            <div class="row"><span class="label">CPF</span><span class="value">${formatCPF(customer.cpf)}</span></div>
            <div class="row"><span class="label">E-mail</span><span class="value">${customer.email}</span></div>
        </div>

        <div class="section">
            <div class="section-title">Dados do Contrato Quitado</div>
            <div class="highlight-box">
                <span class="label-sm">Total Pago</span>
                <span class="big">${formatBRL(totalPaid)}</span>
            </div>
            <div class="row"><span class="label">Valor Original do Empréstimo</span><span class="value">${formatBRL(loan.amount || loan.principalAmount)}</span></div>
            <div class="row"><span class="label">Contrato Nº</span><span class="value">${docId(loan.id)}</span></div>
            <div class="row"><span class="label">Data de Início do Contrato</span><span class="value">${formatDate(loan.startDate)}</span></div>
            <div class="row"><span class="label">Data de Quitação</span><span class="value">${formatDate(now)}</span></div>
            <div class="row"><span class="label">Saldo Devedor Após Quitação</span><span class="value" style="color:#4caf50;">R$ 0,00</span></div>
        </div>

        <div class="sig-area">
            <div class="sig-block">
                <div class="sig-line">${settings.companyName}<br>CNPJ: ${settings.cnpj}<br>CREDOR</div>
            </div>
            <div class="sig-block">
                <div class="sig-line">${customer.name}<br>CPF: ${formatCPF(customer.cpf)}<br>DEVEDOR</div>
            </div>
        </div>

        <div style="text-align:center; margin-top:24px;">
            <p style="color:#888; font-size:13px; line-height:1.7;">Este documento tem validade jurídica e comprova a quitação total das obrigações financeiras entre as partes.<br>Emitido eletronicamente em ${formatDate(now)} — Declaração Nº ${dischargeNum}</p>
        </div>
    </div>
    <div class="footer">
        <p>${settings.companyName} &nbsp;|&nbsp; CNPJ: ${settings.cnpj}</p>
        <p>Declaração de Quitação Nº ${dischargeNum} &nbsp;|&nbsp; ${formatDate(now)}</p>
        <p>Guarde este documento. Ele comprova a quitação do seu empréstimo.</p>
    </div>
</div>
</body></html>`;
}
