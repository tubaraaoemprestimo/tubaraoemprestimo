// Contract PDF Service - gera PDF real do contrato assinado e faz upload via API backend
import { api } from './apiClient';
import { SERVICE_TERMS } from '../constants/serviceTerms';

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

// Generate QR Code URL
const generateQRCodeUrl = (data: string): string => {
  const encoded = encodeURIComponent(data);
  return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encoded}`;
};

// CSS compartilhado para o documento PDF (print-ready A4)
const getDocumentCSS = () => `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', Arial, sans-serif;
      color: #333;
      background: white;
      padding: 0;
      margin: 0;
    }

    .document-container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
    }

    .header {
      background: linear-gradient(135deg, #D4AF37 0%, #B8860B 100%);
      color: black;
      padding: 25px 35px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .logo-section {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .logo-section img {
      width: 50px;
      height: 50px;
      border-radius: 8px;
      object-fit: contain;
      background: white;
      padding: 4px;
    }

    .company-info h1 {
      font-size: 20px;
      font-weight: 700;
    }

    .company-info p {
      font-size: 11px;
      opacity: 0.8;
    }

    .doc-type {
      background: rgba(0,0,0,0.2);
      padding: 6px 14px;
      border-radius: 16px;
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
    }

    .document-title {
      background: #f8f8f8;
      padding: 20px 35px;
      border-bottom: 1px solid #eee;
    }

    .document-title h2 {
      font-size: 22px;
      color: #1a1a1a;
      margin-bottom: 4px;
    }

    .document-title .meta {
      color: #666;
      font-size: 12px;
    }

    .content {
      padding: 30px 35px;
      line-height: 1.8;
      font-size: 13px;
    }

    .section-title {
      color: #B8860B;
      font-size: 14px;
      font-weight: 700;
      margin: 25px 0 12px 0;
      padding-bottom: 6px;
      border-bottom: 2px solid #D4AF37;
      text-transform: uppercase;
    }

    .content p {
      margin-bottom: 12px;
      text-align: justify;
    }

    .content ul {
      margin-left: 20px;
      margin-bottom: 12px;
    }

    .content ul li {
      margin-bottom: 4px;
    }

    .data-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin: 15px 0;
      padding: 15px;
      background: #f9f9f9;
      border-radius: 8px;
      border: 1px solid #eee;
    }

    .data-item {
      font-size: 12px;
    }

    .data-item .label {
      color: #888;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .data-item .value {
      color: #222;
      font-weight: 600;
    }

    .signature-section {
      background: #f8f8f8;
      padding: 30px 35px;
      border-top: 2px solid #D4AF37;
    }

    .signature-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 50px;
      margin-top: 20px;
    }

    .signature-box {
      text-align: center;
    }

    .signature-image {
      max-width: 180px;
      max-height: 70px;
      margin: 0 auto;
      display: block;
    }

    .signature-line {
      border-top: 2px solid #333;
      padding-top: 8px;
      margin-top: 10px;
    }

    .signature-name {
      font-weight: 600;
      font-size: 13px;
      margin-bottom: 2px;
    }

    .signature-role {
      font-size: 11px;
      color: #666;
    }

    .verification-section {
      background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
      color: white;
      padding: 25px 35px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .verification-info h4 {
      color: #D4AF37;
      font-size: 11px;
      text-transform: uppercase;
      margin-bottom: 8px;
    }

    .hash-code {
      font-family: monospace;
      font-size: 12px;
      background: rgba(212, 175, 55, 0.1);
      padding: 6px 10px;
      border-radius: 4px;
      border: 1px solid rgba(212, 175, 55, 0.3);
      color: #D4AF37;
    }

    .verification-date {
      font-size: 11px;
      color: #888;
      margin-top: 8px;
    }

    .qr-code {
      background: white;
      padding: 8px;
      border-radius: 8px;
    }

    .qr-code img {
      width: 80px;
      height: 80px;
    }

    @media print {
      body { background: white; padding: 0; }
      .document-container { box-shadow: none; }
    }
`;

// =====================================================
// GERAR HTML DO CONTRATO LIMPA_NOME
// =====================================================
export function generateLimpaNomeContractHTML(
  formData: { name: string; cpf: string; phone: string; email: string },
  signatureUrl: string,
  brandSettings?: { companyName?: string; cnpj?: string; logoUrl?: string | null }
): string {
  const companyName = brandSettings?.companyName || 'BM SOLUCTION MARKETING LTDA';
  const cnpj = brandSettings?.cnpj || '57.241.795/0001-47';
  const logo = brandSettings?.logoUrl || '/Logo.png';
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR');
  const dateTimeStr = now.toLocaleString('pt-BR');

  const hash = generateHash(formData.cpf + 'LIMPA_NOME' + now.toISOString());
  const verificationUrl = `https://tubaraoemprestimos.com/verificar/${hash}`;
  const qrCode = generateQRCodeUrl(verificationUrl);

  const contractText = SERVICE_TERMS.LIMPA_NOME.contractText
    .replace(/\n/g, '<br>')
    .replace(/•/g, '<li>')
    .replace(/<li>/g, '</li><li>')
    .replace(/<\/li><li>/, '<ul><li>')
    + '</li></ul>';

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Termo de Autorização e Representação</title>
  <style>${getDocumentCSS()}</style>
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
      <span class="doc-type">Limpa Nome</span>
    </div>

    <div class="document-title">
      <h2>Termo de Autorização e Representação</h2>
      <p class="meta">Gerado em ${dateStr} &bull; CPF/CNPJ: ${formData.cpf}</p>
    </div>

    <div class="content">
      <h3 class="section-title">DADOS DO CLIENTE</h3>
      <div class="data-grid">
        <div class="data-item"><span class="label">Nome</span><br><span class="value">${formData.name}</span></div>
        <div class="data-item"><span class="label">CPF/CNPJ</span><br><span class="value">${formData.cpf}</span></div>
        <div class="data-item"><span class="label">Telefone</span><br><span class="value">${formData.phone}</span></div>
        <div class="data-item"><span class="label">Email</span><br><span class="value">${formData.email}</span></div>
      </div>

      <h3 class="section-title">CONDIÇÕES DO SERVIÇO</h3>
      <ul>
        ${SERVICE_TERMS.LIMPA_NOME.conditions.map(c => `<li>${c}</li>`).join('')}
      </ul>

      <h3 class="section-title">TERMO DE AUTORIZAÇÃO E REPRESENTAÇÃO</h3>
      <p>${SERVICE_TERMS.LIMPA_NOME.contractText.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>').replace(/•/g, '&bull;')}</p>
    </div>

    <div class="signature-section">
      <h3 style="margin-bottom: 8px; font-size: 14px;">Assinaturas</h3>
      <p style="font-size: 11px; color: #666;">As partes declaram estar de acordo com todas as cláusulas deste documento.</p>

      <div class="signature-grid">
        <div class="signature-box">
          ${signatureUrl ? `<img src="${signatureUrl}" class="signature-image" alt="Assinatura do Cliente">` : ''}
          <div class="signature-line">
            <p class="signature-name">${formData.name}</p>
            <p class="signature-role">Contratante</p>
          </div>
        </div>
        <div class="signature-box">
          <div class="signature-line" style="margin-top: ${signatureUrl ? '80px' : '0'};">
            <p class="signature-name">${companyName}</p>
            <p class="signature-role">Contratada</p>
          </div>
        </div>
      </div>
    </div>

    <div class="verification-section">
      <div class="verification-info">
        <h4>Verificação de Autenticidade</h4>
        <p class="hash-code">${hash}</p>
        <p class="verification-date">Assinado digitalmente em ${dateTimeStr}</p>
      </div>
      <div class="qr-code">
        <img src="${qrCode}" alt="QR Code de Verificação">
      </div>
    </div>
  </div>
</body>
</html>`;
}

// =====================================================
// GERAR HTML DO CONTRATO GENÉRICO (CLT, AUTONOMO, MOTO, GARANTIA)
// =====================================================
export function generateGenericContractHTML(
  formData: {
    name: string;
    cpf: string;
    phone: string;
    email: string;
    amount: number;
    installments: number;
    installmentValue: number;
    interestRate: number;
    totalAmount: number;
    profileType: string;
  },
  signatureUrl: string,
  brandSettings?: { companyName?: string; cnpj?: string; logoUrl?: string | null; address?: string }
): string {
  const companyName = brandSettings?.companyName || 'BM SOLUCTION MARKETING LTDA';
  const cnpj = brandSettings?.cnpj || '57.241.795/0001-47';
  const logo = brandSettings?.logoUrl || '/Logo.png';
  const companyAddress = brandSettings?.address || 'Av. Paulista, 1000 - São Paulo, SP';
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR');
  const dateTimeStr = now.toLocaleString('pt-BR');

  const hash = generateHash(formData.cpf + formData.profileType + formData.amount + now.toISOString());
  const verificationUrl = `https://tubaraoemprestimos.com/verificar/${hash}`;
  const qrCode = generateQRCodeUrl(verificationUrl);

  const profileLabels: Record<string, string> = {
    CLT: 'Empréstimo Pessoal (CLT)',
    AUTONOMO: 'Capital de Giro (Comércio)',
    MOTO: 'Financiamento de Motocicleta',
    GARANTIA: 'Empréstimo com Garantia',
    GARANTIA_VEICULO: 'Empréstimo com Garantia',
  };
  const docTypeLabel = profileLabels[formData.profileType] || 'Contrato';

  const terms = SERVICE_TERMS[formData.profileType as keyof typeof SERVICE_TERMS];
  const conditions = terms?.conditions || [];

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contrato - ${docTypeLabel}</title>
  <style>${getDocumentCSS()}</style>
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
      <span class="doc-type">${docTypeLabel}</span>
    </div>

    <div class="document-title">
      <h2>${docTypeLabel}</h2>
      <p class="meta">Gerado em ${dateStr} &bull; CPF: ${formData.cpf}</p>
    </div>

    <div class="content">
      <h3 class="section-title">IDENTIFICAÇÃO DAS PARTES</h3>
      <p><strong>CREDOR:</strong> ${companyName}, inscrita no CNPJ sob nº ${cnpj}, com sede em ${companyAddress}.</p>
      <p><strong>DEVEDOR:</strong> ${formData.name}, portador(a) do CPF nº ${formData.cpf}.</p>

      <h3 class="section-title">DADOS DO CONTRATO</h3>
      <div class="data-grid">
        <div class="data-item"><span class="label">Nome</span><br><span class="value">${formData.name}</span></div>
        <div class="data-item"><span class="label">CPF</span><br><span class="value">${formData.cpf}</span></div>
        <div class="data-item"><span class="label">Telefone</span><br><span class="value">${formData.phone}</span></div>
        <div class="data-item"><span class="label">Email</span><br><span class="value">${formData.email}</span></div>
        ${formData.profileType === 'MOTO' ? `
        <div class="data-item"><span class="label">Produto</span><br><span class="value">Honda Pop 110i 2026</span></div>
        <div class="data-item"><span class="label">Entrada</span><br><span class="value">R$ 2.000,00</span></div>
        <div class="data-item"><span class="label">Parcelas</span><br><span class="value">36x de R$ 611,00</span></div>
        <div class="data-item"><span class="label">Seguro Mensal</span><br><span class="value">R$ 150,00/mês</span></div>
        <div class="data-item"><span class="label">Mensal Total</span><br><span class="value">R$ 761,00</span></div>
        <div class="data-item"><span class="label">Valor Total</span><br><span class="value">R$ ${formData.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
        ` : `
        <div class="data-item"><span class="label">Valor Solicitado</span><br><span class="value">R$ ${formData.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
        ${formData.installments > 1 ? `<div class="data-item"><span class="label">Parcelas</span><br><span class="value">${formData.installments}x de R$ ${formData.installmentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>` : ''}
        <div class="data-item"><span class="label">Taxa de Juros</span><br><span class="value">${formData.interestRate}% ao mês</span></div>
        <div class="data-item"><span class="label">Valor Total</span><br><span class="value">R$ ${formData.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
        `}
      </div>

      <h3 class="section-title">CONDIÇÕES</h3>
      <ul>
        ${conditions.map(c => `<li>${c}</li>`).join('')}
      </ul>

      <h3 class="section-title">DISPOSIÇÕES GERAIS</h3>
      <p>O presente contrato é regido pelas leis da República Federativa do Brasil. As partes elegem o foro da comarca de São Paulo para dirimir quaisquer dúvidas ou litígios oriundos deste contrato.</p>
      <p>E por estarem assim justos e contratados, firmam o presente instrumento.</p>
      <p style="text-align: center; margin-top: 20px;">${dateStr}</p>
    </div>

    <div class="signature-section">
      <h3 style="margin-bottom: 8px; font-size: 14px;">Assinaturas</h3>
      <p style="font-size: 11px; color: #666;">As partes declaram estar de acordo com todas as cláusulas deste documento.</p>

      <div class="signature-grid">
        <div class="signature-box">
          ${signatureUrl ? `<img src="${signatureUrl}" class="signature-image" alt="Assinatura do Cliente">` : ''}
          <div class="signature-line">
            <p class="signature-name">${formData.name}</p>
            <p class="signature-role">Contratante / Devedor</p>
          </div>
        </div>
        <div class="signature-box">
          <div class="signature-line" style="margin-top: ${signatureUrl ? '80px' : '0'};">
            <p class="signature-name">${companyName}</p>
            <p class="signature-role">Contratada / Credora</p>
          </div>
        </div>
      </div>
    </div>

    <div class="verification-section">
      <div class="verification-info">
        <h4>Verificação de Autenticidade</h4>
        <p class="hash-code">${hash}</p>
        <p class="verification-date">Assinado digitalmente em ${dateTimeStr}</p>
      </div>
      <div class="qr-code">
        <img src="${qrCode}" alt="QR Code de Verificação">
      </div>
    </div>
  </div>
</body>
</html>`;
}

// =====================================================
// CONVERTER HTML PARA PDF BLOB (usando html2pdf.js)
// =====================================================
export async function generatePdfFromHTML(html: string): Promise<Blob> {
  // html2pdf.js é uma lib client-side, importa dinamicamente
  const html2pdf = (await import('html2pdf.js')).default;

  // Criar um container temporário oculto
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '800px';
  container.innerHTML = html;
  document.body.appendChild(container);

  // Aguardar imagens carregarem (QR code, logo, assinatura)
  const images = container.querySelectorAll('img');
  await Promise.all(
    Array.from(images).map(img =>
      new Promise<void>((resolve) => {
        if (img.complete) return resolve();
        img.onload = () => resolve();
        img.onerror = () => resolve(); // não bloquear se imagem falhar
      })
    )
  );

  // Pequeno delay para renderização
  await new Promise(resolve => setTimeout(resolve, 500));

  try {
    const pdfBlob: Blob = await html2pdf()
      .set({
        margin: 0,
        filename: 'contrato.pdf',
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false,
        },
        jsPDF: {
          unit: 'mm',
          format: 'a4',
          orientation: 'portrait',
        },
      })
      .from((container.querySelector('.document-container') as HTMLElement) || container)
      .outputPdf('blob');

    return pdfBlob;
  } finally {
    document.body.removeChild(container);
  }
}

// =====================================================
// UPLOAD DO PDF VIA API BACKEND
// =====================================================
export async function uploadContractPdf(pdfBlob: Blob, cpf: string, profileType: string): Promise<string> {
  const cleanCpf = cpf.replace(/\D/g, '');
  const timestamp = Date.now();
  const fileName = `contrato_${cleanCpf}_${profileType.toLowerCase()}_${timestamp}.pdf`;

  const file = new File([pdfBlob], `contrato_${profileType.toLowerCase()}_${timestamp}.pdf`, {
    type: 'application/pdf',
  });

  const { data, error } = await api.upload(file, fileName);

  if (error) {
    console.error('Erro no upload do PDF:', error?.message || error);
    throw error;
  }

  const pdfUrl = data?.url;
  if (!pdfUrl) {
    throw new Error('Upload concluido sem URL de retorno.');
  }

  console.log('PDF do contrato enviado:', pdfUrl);
  return pdfUrl;
}

// =====================================================
// ORQUESTRADOR: Gera HTML > PDF > Upload > Retorna URL
// =====================================================
export async function generateAndUploadContract(
  profileType: string,
  formData: {
    name: string;
    cpf: string;
    phone: string;
    email: string;
    amount?: number;
    installments?: number;
    installmentValue?: number;
    interestRate?: number;
    totalAmount?: number;
  },
  signatureUrl: string,
  brandSettings?: { companyName?: string; cnpj?: string; logoUrl?: string | null; address?: string }
): Promise<string> {
  console.log(`📄 Gerando PDF do contrato (${profileType})...`);

  // 1. Gerar HTML
  let html: string;
  if (profileType === 'LIMPA_NOME') {
    html = generateLimpaNomeContractHTML(formData, signatureUrl, brandSettings);
  } else {
    html = generateGenericContractHTML(
      {
        name: formData.name,
        cpf: formData.cpf,
        phone: formData.phone,
        email: formData.email,
        amount: formData.amount || 0,
        installments: formData.installments || 1,
        installmentValue: formData.installmentValue || 0,
        interestRate: formData.interestRate || 0,
        totalAmount: formData.totalAmount || 0,
        profileType,
      },
      signatureUrl,
      brandSettings
    );
  }

  // 2. Converter para PDF
  const pdfBlob = await generatePdfFromHTML(html);
  console.log(`✅ PDF gerado: ${(pdfBlob.size / 1024).toFixed(1)} KB`);

  // 3. Upload via API
  const pdfUrl = await uploadContractPdf(pdfBlob, formData.cpf, profileType);
  console.log(`✅ PDF uploaded: ${pdfUrl}`);

  return pdfUrl;
}

export const contractPdfService = {
  generateLimpaNomeContractHTML,
  generateGenericContractHTML,
  generatePdfFromHTML,
  uploadContractPdf,
  generateAndUploadContract,
};

export default contractPdfService;
