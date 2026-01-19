
// 📄 Report Service - Exportação de Relatórios PDF/Excel
// Tubarão Empréstimos - Sistema de Relatórios Profissionais

import { LoanRequest, Customer, Loan, Transaction, LoanStatus } from '../types';
import { supabaseService } from './supabaseService';

interface ReportData {
  title: string;
  generatedAt: string;
  data: any[];
  summary?: Record<string, any>;
}

// Gera CSV compatível com Excel (UTF-8 BOM para acentos)
const generateCSV = (headers: string[], rows: any[][], filename: string): void => {
  const BOM = '\uFEFF'; // UTF-8 BOM para Excel reconhecer acentos
  const csvContent = BOM + [
    headers.join(';'),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
};

// Gera HTML formatado para impressão/PDF
const generatePrintableHTML = (report: ReportData, columns: { key: string; label: string }[]): string => {
  const rows = report.data.map(item => 
    `<tr>${columns.map(col => `<td>${item[col.key] ?? '-'}</td>`).join('')}</tr>`
  ).join('');

  const summaryHTML = report.summary ? `
    <div class="summary">
      <h3>Resumo</h3>
      <div class="summary-grid">
        ${Object.entries(report.summary).map(([k, v]) => `
          <div class="summary-item">
            <span class="label">${k}</span>
            <span class="value">${v}</span>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>${report.title} - Tubarão Empréstimos</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #1a1a1a; color: #fff; padding: 40px; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; border-bottom: 2px solid #D4AF37; padding-bottom: 20px; }
        .header h1 { color: #D4AF37; font-size: 28px; }
        .header .meta { text-align: right; color: #888; font-size: 14px; }
        .summary { background: #2a2a2a; border-radius: 12px; padding: 20px; margin-bottom: 30px; border: 1px solid #333; }
        .summary h3 { color: #D4AF37; margin-bottom: 15px; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; }
        .summary-item { background: #1a1a1a; padding: 15px; border-radius: 8px; text-align: center; }
        .summary-item .label { display: block; color: #888; font-size: 12px; text-transform: uppercase; margin-bottom: 5px; }
        .summary-item .value { display: block; color: #D4AF37; font-size: 20px; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; background: #2a2a2a; border-radius: 12px; overflow: hidden; }
        th { background: #D4AF37; color: #000; padding: 15px 12px; text-align: left; font-weight: 600; text-transform: uppercase; font-size: 12px; }
        td { padding: 12px; border-bottom: 1px solid #333; font-size: 14px; }
        tr:hover { background: #333; }
        tr:last-child td { border-bottom: none; }
        .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
        @media print {
          body { background: #fff; color: #000; }
          .summary { background: #f5f5f5; }
          .summary-item { background: #fff; }
          table { background: #fff; }
          th { background: #D4AF37; }
          td { border-color: #ddd; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🦈 ${report.title}</h1>
        <div class="meta">
          <div>Tubarão Empréstimos</div>
          <div>Gerado em: ${report.generatedAt}</div>
        </div>
      </div>
      ${summaryHTML}
      <table>
        <thead>
          <tr>${columns.map(col => `<th>${col.label}</th>`).join('')}</tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">
        <p>Documento gerado automaticamente pelo sistema Tubarão Empréstimos</p>
        <p>Este relatório é confidencial e de uso interno</p>
      </div>
    </body>
    </html>
  `;
};

const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const openPrintWindow = (html: string): void => {
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    // Auto print after load
    printWindow.onload = () => {
      setTimeout(() => printWindow.print(), 500);
    };
  }
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('pt-BR');
};

const getStatusLabel = (status: LoanStatus): string => {
  const labels: Record<string, string> = {
    PENDING: 'Pendente',
    WAITING_DOCS: 'Aguardando Docs',
    APPROVED: 'Aprovado',
    REJECTED: 'Rejeitado',
    PAID: 'Quitado',
    DEFAULTED: 'Inadimplente'
  };
  return labels[status] || status;
};

export const reportService = {
  // 📊 Relatório de Solicitações
  exportRequests: async (format: 'excel' | 'pdf'): Promise<void> => {
    const requests = await supabaseService.getRequests();
    const now = new Date().toLocaleString('pt-BR');

    const columns = [
      { key: 'clientName', label: 'Cliente' },
      { key: 'cpf', label: 'CPF' },
      { key: 'phone', label: 'Telefone' },
      { key: 'amountFormatted', label: 'Valor' },
      { key: 'installments', label: 'Parcelas' },
      { key: 'statusLabel', label: 'Status' },
      { key: 'dateFormatted', label: 'Data' }
    ];

    const data = requests.map(r => ({
      ...r,
      amountFormatted: formatCurrency(r.amount),
      statusLabel: getStatusLabel(r.status),
      dateFormatted: formatDate(r.date)
    }));

    const totalAmount = requests.reduce((acc, r) => acc + r.amount, 0);
    const pending = requests.filter(r => r.status === LoanStatus.PENDING).length;
    const approved = requests.filter(r => r.status === LoanStatus.APPROVED).length;

    const report: ReportData = {
      title: 'Relatório de Solicitações',
      generatedAt: now,
      data,
      summary: {
        'Total Solicitações': requests.length,
        'Pendentes': pending,
        'Aprovadas': approved,
        'Valor Total': formatCurrency(totalAmount)
      }
    };

    if (format === 'excel') {
      const headers = columns.map(c => c.label);
      const rows = data.map(item => columns.map(col => item[col.key as keyof typeof item]));
      generateCSV(headers, rows, `solicitacoes_${Date.now()}`);
    } else {
      const html = generatePrintableHTML(report, columns);
      openPrintWindow(html);
    }
  },

  // 👥 Relatório de Clientes
  exportCustomers: async (format: 'excel' | 'pdf'): Promise<void> => {
    const customers = await supabaseService.getCustomers();
    const now = new Date().toLocaleString('pt-BR');

    const columns = [
      { key: 'name', label: 'Nome' },
      { key: 'cpf', label: 'CPF' },
      { key: 'email', label: 'E-mail' },
      { key: 'phone', label: 'Telefone' },
      { key: 'status', label: 'Status' },
      { key: 'internalScore', label: 'Score' },
      { key: 'totalDebtFormatted', label: 'Dívida Total' },
      { key: 'joinedAtFormatted', label: 'Cadastro' }
    ];

    const data = customers.map(c => ({
      ...c,
      totalDebtFormatted: formatCurrency(c.totalDebt),
      joinedAtFormatted: formatDate(c.joinedAt)
    }));

    const totalDebt = customers.reduce((acc, c) => acc + c.totalDebt, 0);
    const active = customers.filter(c => c.status === 'ACTIVE').length;
    const avgScore = customers.length > 0 
      ? Math.round(customers.reduce((acc, c) => acc + c.internalScore, 0) / customers.length) 
      : 0;

    const report: ReportData = {
      title: 'Relatório de Clientes',
      generatedAt: now,
      data,
      summary: {
        'Total Clientes': customers.length,
        'Ativos': active,
        'Bloqueados': customers.length - active,
        'Score Médio': avgScore,
        'Dívida Total': formatCurrency(totalDebt)
      }
    };

    if (format === 'excel') {
      const headers = columns.map(c => c.label);
      const rows = data.map(item => columns.map(col => item[col.key as keyof typeof item]));
      generateCSV(headers, rows, `clientes_${Date.now()}`);
    } else {
      const html = generatePrintableHTML(report, columns);
      openPrintWindow(html);
    }
  },

  // 💰 Relatório Financeiro (Empréstimos Ativos)
  exportLoans: async (format: 'excel' | 'pdf'): Promise<void> => {
    const loans = await supabaseService.getClientLoans();
    const now = new Date().toLocaleString('pt-BR');

    const columns = [
      { key: 'id', label: 'ID' },
      { key: 'amountFormatted', label: 'Valor Original' },
      { key: 'remainingFormatted', label: 'Saldo Devedor' },
      { key: 'installmentsCount', label: 'Parcelas' },
      { key: 'paidInstallments', label: 'Pagas' },
      { key: 'statusLabel', label: 'Status' },
      { key: 'startDateFormatted', label: 'Início' }
    ];

    const data = loans.map(l => {
      const paidCount = l.installments.filter(i => i.status === 'PAID').length;
      return {
        ...l,
        amountFormatted: formatCurrency(l.amount),
        remainingFormatted: formatCurrency(l.remainingAmount),
        paidInstallments: `${paidCount}/${l.installmentsCount}`,
        statusLabel: getStatusLabel(l.status),
        startDateFormatted: formatDate(l.startDate)
      };
    });

    const totalOriginal = loans.reduce((acc, l) => acc + l.amount, 0);
    const totalRemaining = loans.reduce((acc, l) => acc + l.remainingAmount, 0);

    const report: ReportData = {
      title: 'Relatório Financeiro - Empréstimos',
      generatedAt: now,
      data,
      summary: {
        'Total Empréstimos': loans.length,
        'Valor Original': formatCurrency(totalOriginal),
        'Saldo Devedor': formatCurrency(totalRemaining),
        'Recebido': formatCurrency(totalOriginal - totalRemaining)
      }
    };

    if (format === 'excel') {
      const headers = columns.map(c => c.label);
      const rows = data.map(item => columns.map(col => item[col.key as keyof typeof item]));
      generateCSV(headers, rows, `emprestimos_${Date.now()}`);
    } else {
      const html = generatePrintableHTML(report, columns);
      openPrintWindow(html);
    }
  },

  // 📅 Relatório de Parcelas (Vencimentos)
  exportInstallments: async (format: 'excel' | 'pdf', filter?: 'all' | 'open' | 'late' | 'paid'): Promise<void> => {
    const loans = await supabaseService.getClientLoans();
    const now = new Date().toLocaleString('pt-BR');
    const today = new Date();

    const allInstallments: any[] = [];
    loans.forEach(loan => {
      loan.installments.forEach(inst => {
        const dueDate = new Date(inst.dueDate);
        const isLate = inst.status === 'OPEN' && dueDate < today;
        allInstallments.push({
          loanId: loan.id,
          ...inst,
          actualStatus: isLate ? 'LATE' : inst.status,
          amountFormatted: formatCurrency(inst.amount),
          dueDateFormatted: formatDate(inst.dueDate),
          paidAtFormatted: inst.paidAt ? formatDate(inst.paidAt) : '-'
        });
      });
    });

    let filtered = allInstallments;
    if (filter === 'open') filtered = allInstallments.filter(i => i.actualStatus === 'OPEN');
    if (filter === 'late') filtered = allInstallments.filter(i => i.actualStatus === 'LATE');
    if (filter === 'paid') filtered = allInstallments.filter(i => i.status === 'PAID');

    const columns = [
      { key: 'loanId', label: 'Empréstimo' },
      { key: 'dueDateFormatted', label: 'Vencimento' },
      { key: 'amountFormatted', label: 'Valor' },
      { key: 'actualStatus', label: 'Status' },
      { key: 'paidAtFormatted', label: 'Pago Em' }
    ];

    const totalOpen = filtered.filter(i => i.actualStatus === 'OPEN').reduce((a, i) => a + i.amount, 0);
    const totalLate = filtered.filter(i => i.actualStatus === 'LATE').reduce((a, i) => a + i.amount, 0);
    const totalPaid = filtered.filter(i => i.status === 'PAID').reduce((a, i) => a + i.amount, 0);

    const report: ReportData = {
      title: 'Relatório de Parcelas',
      generatedAt: now,
      data: filtered,
      summary: {
        'Total Parcelas': filtered.length,
        'A Vencer': formatCurrency(totalOpen),
        'Em Atraso': formatCurrency(totalLate),
        'Pagas': formatCurrency(totalPaid)
      }
    };

    if (format === 'excel') {
      const headers = columns.map(c => c.label);
      const rows = filtered.map(item => columns.map(col => item[col.key as keyof typeof item]));
      generateCSV(headers, rows, `parcelas_${filter || 'todas'}_${Date.now()}`);
    } else {
      const html = generatePrintableHTML(report, columns);
      openPrintWindow(html);
    }
  },

  // 📈 Relatório de Inadimplência
  exportDefaultReport: async (format: 'excel' | 'pdf'): Promise<void> => {
    const loans = await supabaseService.getClientLoans();
    const customers = await supabaseService.getCustomers();
    const now = new Date().toLocaleString('pt-BR');
    const today = new Date();

    const lateInstallments: any[] = [];
    loans.forEach(loan => {
      loan.installments.forEach(inst => {
        const dueDate = new Date(inst.dueDate);
        if (inst.status === 'OPEN' && dueDate < today) {
          const daysLate = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          lateInstallments.push({
            loanId: loan.id,
            daysLate,
            ...inst,
            amountFormatted: formatCurrency(inst.amount),
            dueDateFormatted: formatDate(inst.dueDate)
          });
        }
      });
    });

    // Sort by days late descending
    lateInstallments.sort((a, b) => b.daysLate - a.daysLate);

    const columns = [
      { key: 'loanId', label: 'Empréstimo' },
      { key: 'dueDateFormatted', label: 'Vencimento' },
      { key: 'daysLate', label: 'Dias Atraso' },
      { key: 'amountFormatted', label: 'Valor' }
    ];

    const totalLate = lateInstallments.reduce((a, i) => a + i.amount, 0);
    const avgDaysLate = lateInstallments.length > 0 
      ? Math.round(lateInstallments.reduce((a, i) => a + i.daysLate, 0) / lateInstallments.length)
      : 0;

    const report: ReportData = {
      title: 'Relatório de Inadimplência',
      generatedAt: now,
      data: lateInstallments,
      summary: {
        'Parcelas Atrasadas': lateInstallments.length,
        'Valor Total Atraso': formatCurrency(totalLate),
        'Média Dias Atraso': `${avgDaysLate} dias`
      }
    };

    if (format === 'excel') {
      const headers = columns.map(c => c.label);
      const rows = lateInstallments.map(item => columns.map(col => item[col.key as keyof typeof item]));
      generateCSV(headers, rows, `inadimplencia_${Date.now()}`);
    } else {
      const html = generatePrintableHTML(report, columns);
      openPrintWindow(html);
    }
  }
};
