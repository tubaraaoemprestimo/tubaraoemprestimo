import { SERVICE_TERMS } from '../constants/serviceTerms';
import { createTextPdf } from './pdfBuilder';

type InvestorContractPayload = {
  fullName: string;
  cpfCnpj: string;
  email: string;
  phone: string;
  investmentAmount: number;
  investmentTier: string;
  payoutMode: string;
  monthlyRate: number;
  bankName: string;
  pixKey: string;
  signatureDataUrl: string;
  generatedAt: string;
};

type LimpaNomeContractPayload = {
  fullName: string;
  cpfCnpj: string;
  email: string;
  phone: string;
  birthDate?: string;
  signatureDataUrl: string;
  generatedAt: string;
};

const digest = async (content: string): Promise<string> => {
  const bytes = new TextEncoder().encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  const hash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return hash;
};

const signatureProofLines = async (signatureDataUrl: string, generatedAt: string): Promise<string[]> => {
  const hash = await digest(`${generatedAt}::${signatureDataUrl}`);
  return [
    `Data/hora da assinatura: ${new Date(generatedAt).toLocaleString('pt-BR')}`,
    `Hash de integridade (SHA-256): ${hash}`,
    'Assinatura eletrônica registrada no app Tubarão Empréstimos.',
  ];
};

export const buildInvestorContractPdf = async (payload: InvestorContractPayload): Promise<Blob> => {
  const investorTerms: any = SERVICE_TERMS.INVESTIDOR;
  const signatureLines = await signatureProofLines(payload.signatureDataUrl, payload.generatedAt);

  return createTextPdf('Contrato de Alocacao de Capital - Investidor Tubarao', [
    {
      title: 'Identificacao do investidor',
      lines: [
        `Nome/Razao social: ${payload.fullName}`,
        `CPF/CNPJ: ${payload.cpfCnpj}`,
        `Email: ${payload.email}`,
        `Telefone: ${payload.phone}`,
      ],
    },
    {
      title: 'Dados do aporte',
      lines: [
        `Valor do investimento: R$ ${payload.investmentAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `Faixa: ${payload.investmentTier}`,
        `Modalidade escolhida: ${payload.payoutMode === 'MONTHLY' ? 'Mensal' : 'Anual acumulado'}`,
        `Taxa mensal contratada: ${payload.monthlyRate}% ao mês`,
        `Banco de recebimento: ${payload.bankName}`,
        `Chave PIX: ${payload.pixKey}`,
      ],
    },
    {
      title: 'Termos do contrato',
      lines: [investorTerms.contractIntro, ...(investorTerms.conditions || [])],
    },
    {
      title: 'Aceite eletronico',
      lines: [investorTerms.finalCheckboxText || investorTerms.checkboxText],
    },
    {
      title: 'Validacao digital',
      lines: signatureLines,
    },
  ]);
};

export const buildLimpaNomeContractPdf = async (payload: LimpaNomeContractPayload): Promise<Blob> => {
  const term = SERVICE_TERMS.LIMPA_NOME;
  const signatureLines = await signatureProofLines(payload.signatureDataUrl, payload.generatedAt);

  return createTextPdf('Termo de Autorizacao e Representacao - Limpa Nome', [
    {
      title: 'Identificacao do cliente',
      lines: [
        `Nome: ${payload.fullName}`,
        `CPF/CNPJ: ${payload.cpfCnpj}`,
        `Email: ${payload.email}`,
        `Telefone: ${payload.phone}`,
        `Data de nascimento: ${payload.birthDate || '-'}`,
      ],
    },
    {
      title: term.contractTitle,
      lines: term.contractText.split('
'),
    },
    {
      title: 'Aceite eletronico',
      lines: [term.checkboxText],
    },
    {
      title: 'Validacao digital',
      lines: signatureLines,
    },
  ]);
};

export const downloadPdfBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};
