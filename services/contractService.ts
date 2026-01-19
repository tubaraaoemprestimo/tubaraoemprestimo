// 📄 Contract Service - Sistema completo de contratos com autenticidade
import { ContractTemplate, Customer, Loan, Receipt, DischargeDeclaration } from '../types';
import { v4 as uuidv4 } from 'uuid';

// Storage keys
const STORAGE_KEYS = {
    CONTRACTS: 'tubarao_contracts',
    CONTRACT_TEMPLATES: 'tubarao_contract_templates',
    GENERATED_DOCS: 'tubarao_generated_docs'
};

// Types
export interface GeneratedDocument {
    id: string;
    type: 'CONTRACT' | 'RECEIPT' | 'DISCHARGE';
    customerId: string;
    customerName: string;
    loanId?: string;
    title: string;
    hash: string;
    qrCode: string;
    content: string;
    variables: Record<string, string>;
    signedAt?: string;
    signatureData?: string;
    createdAt: string;
    validUntil?: string;
    status: 'DRAFT' | 'SIGNED' | 'EXPIRED' | 'CANCELLED';
}

export interface ContractTemplateExtended extends ContractTemplate {
    type: 'LOAN' | 'REFINANCE' | 'GUARANTEE' | 'CUSTOM';
    sections: {
        title: string;
        content: string;
    }[];
    requiresSignature: boolean;
    validityDays: number;
}

// Helper functions
const loadFromStorage = <T>(key: string, defaultValue: T): T => {
    try {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : defaultValue;
    } catch (e) {
        return defaultValue;
    }
};

const saveToStorage = (key: string, data: any) => {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.error(`Error saving ${key}`, e);
    }
};

// Generate hash for document verification
const generateHash = (content: string): string => {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `TUB-${Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')}-${timestamp}-${random}`.toUpperCase();
};

// Generate QR Code URL (using free API)
const generateQRCodeUrl = (data: string): string => {
    const encoded = encodeURIComponent(data);
    return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encoded}`;
};

// Default contract templates
const getDefaultTemplates = (): ContractTemplateExtended[] => [
    {
        id: 'loan-standard',
        name: 'Contrato de Empréstimo Padrão',
        type: 'LOAN',
        content: '',
        variables: ['{nome}', '{cpf}', '{endereco}', '{valor}', '{parcelas}', '{taxa}', '{vencimento}', '{data}'],
        isDefault: true,
        requiresSignature: true,
        validityDays: 365,
        createdAt: new Date().toISOString(),
        sections: [
            {
                title: 'IDENTIFICAÇÃO DAS PARTES',
                content: `**CREDOR:** TUBARÃO EMPRÉSTIMOS LTDA, inscrita no CNPJ sob nº {cnpj}, com sede em {endereco_empresa}.

**DEVEDOR:** {nome}, brasileiro(a), portador(a) do CPF nº {cpf}, residente e domiciliado(a) em {endereco}.`
            },
            {
                title: 'OBJETO DO CONTRATO',
                content: `O presente contrato tem por objeto a concessão de empréstimo pessoal no valor de **R$ {valor}** ({valor_extenso}), que será pago pelo DEVEDOR ao CREDOR nas condições estabelecidas neste instrumento.`
            },
            {
                title: 'CONDIÇÕES DE PAGAMENTO',
                content: `O valor do empréstimo será pago em **{parcelas} parcelas** mensais e consecutivas de **R$ {valor_parcela}** cada, com vencimento todo dia **{dia_vencimento}** de cada mês, iniciando em **{primeiro_vencimento}**.

A taxa de juros aplicada é de **{taxa}% ao mês**, conforme acordado entre as partes.`
            },
            {
                title: 'MORA E INADIMPLÊNCIA',
                content: `Em caso de atraso no pagamento de qualquer parcela, incidirá multa de **2% (dois por cento)** sobre o valor da parcela em atraso, acrescida de juros de mora de **1% ao mês**, calculados pro rata die.

A falta de pagamento de **3 (três) parcelas consecutivas** caracteriza inadimplência, podendo o CREDOR considerar vencidas antecipadamente todas as demais parcelas e tomar as medidas legais cabíveis para cobrança do débito.`
            },
            {
                title: 'DISPOSIÇÕES GERAIS',
                content: `As partes elegem o foro da comarca de {cidade} para dirimir quaisquer dúvidas ou litígios oriundos deste contrato.

E por estarem assim justos e contratados, firmam o presente instrumento em 2 (duas) vias de igual teor e forma.

{cidade}, {data}.`
            }
        ]
    },
    {
        id: 'refinance',
        name: 'Contrato de Refinanciamento',
        type: 'REFINANCE',
        content: '',
        variables: ['{nome}', '{cpf}', '{valor_original}', '{valor_novo}', '{desconto}', '{novas_parcelas}'],
        isDefault: false,
        requiresSignature: true,
        validityDays: 365,
        createdAt: new Date().toISOString(),
        sections: [
            {
                title: 'OBJETO',
                content: `Pelo presente instrumento, as partes acordam o refinanciamento da dívida original de **R$ {valor_original}**, passando a um novo valor de **R$ {valor_novo}**, com desconto de **{desconto}%**.`
            },
            {
                title: 'NOVAS CONDIÇÕES',
                content: `O novo saldo devedor será pago em **{novas_parcelas} parcelas** mensais de **R$ {valor_nova_parcela}** cada.`
            }
        ]
    }
];

// Contract Service
export const contractService = {
    // Templates
    getTemplates: (): ContractTemplateExtended[] => {
        return loadFromStorage(STORAGE_KEYS.CONTRACT_TEMPLATES, getDefaultTemplates());
    },

    saveTemplate: (template: Omit<ContractTemplateExtended, 'id' | 'createdAt'>): ContractTemplateExtended => {
        const templates = loadFromStorage<ContractTemplateExtended[]>(STORAGE_KEYS.CONTRACT_TEMPLATES, getDefaultTemplates());
        const newTemplate: ContractTemplateExtended = {
            ...template,
            id: `template-${Date.now()}`,
            createdAt: new Date().toISOString()
        };
        templates.push(newTemplate);
        saveToStorage(STORAGE_KEYS.CONTRACT_TEMPLATES, templates);
        return newTemplate;
    },

    updateTemplate: (id: string, updates: Partial<ContractTemplateExtended>): boolean => {
        const templates = loadFromStorage<ContractTemplateExtended[]>(STORAGE_KEYS.CONTRACT_TEMPLATES, []);
        const index = templates.findIndex(t => t.id === id);
        if (index >= 0) {
            templates[index] = { ...templates[index], ...updates };
            saveToStorage(STORAGE_KEYS.CONTRACT_TEMPLATES, templates);
            return true;
        }
        return false;
    },

    deleteTemplate: (id: string): boolean => {
        const templates = loadFromStorage<ContractTemplateExtended[]>(STORAGE_KEYS.CONTRACT_TEMPLATES, []);
        saveToStorage(STORAGE_KEYS.CONTRACT_TEMPLATES, templates.filter(t => t.id !== id));
        return true;
    },

    // Document Generation
    generateContract: (
        templateId: string,
        customer: Customer,
        loan: Loan,
        customVariables?: Record<string, string>,
        brandSettings?: any
    ): GeneratedDocument => {
        const templates = contractService.getTemplates();
        const template = templates.find(t => t.id === templateId) || templates[0];

        // Build variables
        const variables: Record<string, string> = {
            '{nome}': customer.name,
            '{cpf}': customer.cpf,
            '{endereco}': customer.address || 'Não informado',
            '{telefone}': customer.phone,
            '{email}': customer.email,
            '{valor}': loan.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
            '{valor_extenso}': numberToWords(loan.amount),
            '{parcelas}': loan.installments.length.toString(),
            '{valor_parcela}': (loan.amount / loan.installments.length).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
            '{taxa}': loan.interestRate?.toString() || '5',
            '{dia_vencimento}': new Date(loan.installments[0]?.dueDate || new Date()).getDate().toString(),
            '{primeiro_vencimento}': new Date(loan.installments[0]?.dueDate || new Date()).toLocaleDateString('pt-BR'),
            '{data}': new Date().toLocaleDateString('pt-BR'),
            '{cidade}': brandSettings?.city || 'São Paulo',
            '{cnpj}': brandSettings?.cnpj || '00.000.000/0001-00',
            '{endereco_empresa}': brandSettings?.address || 'Rua Principal, 123',
            ...customVariables
        };

        // Generate content from sections
        let fullContent = template.sections.map(section => {
            let content = section.content;
            Object.entries(variables).forEach(([key, value]) => {
                content = content.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
            });
            return `## ${section.title}\n\n${content}`;
        }).join('\n\n---\n\n');

        const hash = generateHash(fullContent + customer.cpf + loan.id);
        const verificationUrl = `https://tubaraoemprestimos.com/verificar/${hash}`;
        const qrCode = generateQRCodeUrl(verificationUrl);

        const doc: GeneratedDocument = {
            id: `DOC-${Date.now()}`,
            type: 'CONTRACT',
            customerId: customer.id,
            customerName: customer.name,
            loanId: loan.id,
            title: template.name,
            hash,
            qrCode,
            content: fullContent,
            variables,
            createdAt: new Date().toISOString(),
            validUntil: template.validityDays ? new Date(Date.now() + template.validityDays * 24 * 60 * 60 * 1000).toISOString() : undefined,
            status: 'DRAFT'
        };

        // Save to storage
        const docs = loadFromStorage<GeneratedDocument[]>(STORAGE_KEYS.GENERATED_DOCS, []);
        docs.push(doc);
        saveToStorage(STORAGE_KEYS.GENERATED_DOCS, docs);

        return doc;
    },

    // Sign document
    signDocument: (docId: string, signatureData: string): GeneratedDocument | null => {
        const docs = loadFromStorage<GeneratedDocument[]>(STORAGE_KEYS.GENERATED_DOCS, []);
        const index = docs.findIndex(d => d.id === docId);
        if (index >= 0) {
            docs[index].signedAt = new Date().toISOString();
            docs[index].signatureData = signatureData;
            docs[index].status = 'SIGNED';
            saveToStorage(STORAGE_KEYS.GENERATED_DOCS, docs);
            return docs[index];
        }
        return null;
    },

    // Get documents
    getDocuments: (customerId?: string): GeneratedDocument[] => {
        const docs = loadFromStorage<GeneratedDocument[]>(STORAGE_KEYS.GENERATED_DOCS, []);
        if (customerId) {
            return docs.filter(d => d.customerId === customerId);
        }
        return docs;
    },

    getDocumentById: (id: string): GeneratedDocument | null => {
        const docs = loadFromStorage<GeneratedDocument[]>(STORAGE_KEYS.GENERATED_DOCS, []);
        return docs.find(d => d.id === id) || null;
    },

    getDocumentByHash: (hash: string): GeneratedDocument | null => {
        const docs = loadFromStorage<GeneratedDocument[]>(STORAGE_KEYS.GENERATED_DOCS, []);
        return docs.find(d => d.hash === hash) || null;
    },

    // Generate document HTML for printing/PDF
    generateDocumentHTML: (doc: GeneratedDocument, brandSettings?: any): string => {
        const logo = brandSettings?.logoUrl || '/Logo.png';
        const companyName = brandSettings?.companyName || 'Tubarão Empréstimos';
        const cnpj = brandSettings?.cnpj || '00.000.000/0001-00';

        // Convert markdown-like content to HTML
        let htmlContent = doc.content
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/## ([^\n]+)/g, '<h3 class="section-title">$1</h3>')
            .replace(/---/g, '<hr class="section-divider">')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');
        htmlContent = `<p>${htmlContent}</p>`;

        return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${doc.title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Inter', sans-serif;
      background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%);
      color: #333;
      padding: 40px;
      min-height: 100vh;
    }
    
    .document-container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      border-radius: 24px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      overflow: hidden;
    }
    
    .header {
      background: linear-gradient(135deg, #D4AF37 0%, #B8860B 100%);
      color: black;
      padding: 30px 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .logo-section {
      display: flex;
      align-items: center;
      gap: 15px;
    }
    
    .logo-section img {
      width: 60px;
      height: 60px;
      border-radius: 12px;
      object-fit: contain;
      background: white;
      padding: 5px;
    }
    
    .company-info h1 {
      font-size: 24px;
      font-weight: 700;
    }
    
    .company-info p {
      font-size: 12px;
      opacity: 0.8;
    }
    
    .doc-type {
      background: rgba(0,0,0,0.2);
      padding: 8px 16px;
      border-radius: 20px;
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
    }
    
    .document-title {
      background: #f8f8f8;
      padding: 25px 40px;
      border-bottom: 1px solid #eee;
    }
    
    .document-title h2 {
      font-size: 28px;
      color: #1a1a1a;
      margin-bottom: 5px;
    }
    
    .document-title .meta {
      color: #666;
      font-size: 14px;
    }
    
    .content {
      padding: 40px;
      line-height: 1.8;
      font-size: 14px;
    }
    
    .section-title {
      color: #D4AF37;
      font-size: 16px;
      font-weight: 700;
      margin: 30px 0 15px 0;
      padding-bottom: 8px;
      border-bottom: 2px solid #D4AF37;
      text-transform: uppercase;
    }
    
    .section-divider {
      border: none;
      border-top: 1px dashed #ddd;
      margin: 30px 0;
    }
    
    .content p {
      margin-bottom: 15px;
      text-align: justify;
    }
    
    .signature-section {
      background: #f8f8f8;
      padding: 40px;
      border-top: 2px solid #D4AF37;
    }
    
    .signature-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 60px;
      margin-top: 30px;
    }
    
    .signature-box {
      text-align: center;
    }
    
    .signature-line {
      border-top: 2px solid #333;
      padding-top: 10px;
      margin-top: ${doc.signatureData ? '10px' : '80px'};
    }
    
    .signature-name {
      font-weight: 600;
      margin-bottom: 3px;
    }
    
    .signature-role {
      font-size: 12px;
      color: #666;
    }
    
    .signature-image {
      max-width: 200px;
      max-height: 80px;
      margin: 0 auto;
    }
    
    .verification-section {
      background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
      color: white;
      padding: 30px 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .verification-info h4 {
      color: #D4AF37;
      font-size: 12px;
      text-transform: uppercase;
      margin-bottom: 10px;
    }
    
    .hash-code {
      font-family: monospace;
      font-size: 14px;
      background: rgba(212, 175, 55, 0.1);
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid rgba(212, 175, 55, 0.3);
      color: #D4AF37;
    }
    
    .verification-date {
      font-size: 12px;
      color: #888;
      margin-top: 10px;
    }
    
    .qr-code {
      background: white;
      padding: 10px;
      border-radius: 12px;
    }
    
    .qr-code img {
      width: 100px;
      height: 100px;
    }
    
    .status-badge {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      margin-left: 10px;
    }
    
    .status-signed {
      background: #22C55E;
      color: white;
    }
    
    .status-draft {
      background: #EAB308;
      color: black;
    }
    
    @media print {
      body { background: white; padding: 0; }
      .document-container { box-shadow: none; border-radius: 0; }
    }
  </style>
</head>
<body>
  <div class="document-container">
    <div class="header">
      <div class="logo-section">
        <img src="${logo}" alt="Logo">
        <div class="company-info">
          <h1>${companyName}</h1>
          <p>CNPJ: ${cnpj}</p>
        </div>
      </div>
      <span class="doc-type">${doc.type === 'CONTRACT' ? 'Contrato' : doc.type === 'RECEIPT' ? 'Recibo' : 'Declaração'}</span>
    </div>
    
    <div class="document-title">
      <h2>
        ${doc.title}
        <span class="status-badge ${doc.status === 'SIGNED' ? 'status-signed' : 'status-draft'}">
          ${doc.status === 'SIGNED' ? '✓ Assinado' : 'Rascunho'}
        </span>
      </h2>
      <p class="meta">
        Documento nº ${doc.id} • Cliente: ${doc.customerName} • Gerado em ${new Date(doc.createdAt).toLocaleDateString('pt-BR')}
      </p>
    </div>
    
    <div class="content">
      ${htmlContent}
    </div>
    
    <div class="signature-section">
      <h3 style="margin-bottom: 10px;">Assinaturas</h3>
      <p style="font-size: 12px; color: #666;">As partes abaixo assinadas declaram estar de acordo com todas as cláusulas deste documento.</p>
      
      <div class="signature-grid">
        <div class="signature-box">
          ${doc.signatureData ? `<img src="${doc.signatureData}" class="signature-image" alt="Assinatura do Cliente">` : ''}
          <div class="signature-line">
            <p class="signature-name">${doc.customerName}</p>
            <p class="signature-role">Contratante / Devedor</p>
          </div>
        </div>
        <div class="signature-box">
          <div class="signature-line">
            <p class="signature-name">${companyName}</p>
            <p class="signature-role">Contratada / Credora</p>
          </div>
        </div>
      </div>
    </div>
    
    <div class="verification-section">
      <div class="verification-info">
        <h4>🔒 Verificação de Autenticidade</h4>
        <p class="hash-code">${doc.hash}</p>
        <p class="verification-date">
          ${doc.signedAt ? `Assinado digitalmente em ${new Date(doc.signedAt).toLocaleString('pt-BR')}` : 'Aguardando assinatura'}
          ${doc.validUntil ? ` • Válido até ${new Date(doc.validUntil).toLocaleDateString('pt-BR')}` : ''}
        </p>
      </div>
      <div class="qr-code">
        <img src="${doc.qrCode}" alt="QR Code de Verificação">
      </div>
    </div>
  </div>
</body>
</html>
    `;
    }
};

// Helper: Number to words (simplified)
function numberToWords(num: number): string {
    const units = ['', 'mil', 'milhões', 'bilhões'];
    const formatNum = (n: number) => {
        if (n < 1000) return n.toString();
        const i = Math.floor(Math.log10(n) / 3);
        const val = n / Math.pow(1000, i);
        return `${val.toFixed(val % 1 === 0 ? 0 : 2)} ${units[i]}`;
    };
    const reais = Math.floor(num);
    const centavos = Math.round((num - reais) * 100);
    let result = `${formatNum(reais)} reais`;
    if (centavos > 0) {
        result += ` e ${centavos} centavos`;
    }
    return result;
}

export default contractService;
