
// 📊 Reports Panel Component
// Painel de Relatórios com Exportação PDF/Excel

import React, { useState } from 'react';
import { FileText, Download, FileSpreadsheet, Printer, Calendar, Filter, TrendingUp, Users, DollarSign, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from './Button';
import { reportService } from '../services/reportService';
import { useToast } from './Toast';

interface ReportCard {
    id: string;
    title: string;
    description: string;
    icon: React.ElementType;
    color: string;
    exportFn: (format: 'excel' | 'pdf') => Promise<void>;
}

export const ReportsPanel: React.FC = () => {
    const { addToast } = useToast();
    const [loading, setLoading] = useState<string | null>(null);
    const [installmentFilter, setInstallmentFilter] = useState<'all' | 'open' | 'late' | 'paid'>('all');

    const reports: ReportCard[] = [
        {
            id: 'requests',
            title: 'Solicitações de Empréstimo',
            description: 'Lista completa de todas as solicitações com status, valores e datas.',
            icon: FileText,
            color: 'from-blue-600 to-blue-800',
            exportFn: reportService.exportRequests
        },
        {
            id: 'customers',
            title: 'Base de Clientes',
            description: 'Relatório de clientes cadastrados com score, status e valores.',
            icon: Users,
            color: 'from-green-600 to-green-800',
            exportFn: reportService.exportCustomers
        },
        {
            id: 'loans',
            title: 'Empréstimos Ativos',
            description: 'Visão geral de todos os empréstimos com saldo devedor e parcelas.',
            icon: DollarSign,
            color: 'from-[#D4AF37] to-yellow-700',
            exportFn: reportService.exportLoans
        },
        {
            id: 'installments',
            title: 'Parcelas / Vencimentos',
            description: 'Controle de parcelas com filtros por status (abertas, pagas, atrasadas).',
            icon: Calendar,
            color: 'from-purple-600 to-purple-800',
            exportFn: (format) => reportService.exportInstallments(format, installmentFilter)
        },
        {
            id: 'default',
            title: 'Inadimplência',
            description: 'Relatório detalhado de parcelas em atraso com dias de atraso.',
            icon: AlertTriangle,
            color: 'from-red-600 to-red-800',
            exportFn: reportService.exportDefaultReport
        }
    ];

    const handleExport = async (report: ReportCard, format: 'excel' | 'pdf') => {
        setLoading(`${report.id}-${format}`);
        try {
            await report.exportFn(format);
            addToast(`Relatório "${report.title}" exportado com sucesso!`, 'success');
        } catch (error) {
            addToast(`Erro ao exportar relatório.`, 'error');
        } finally {
            setLoading(null);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <div className="p-2 bg-[#D4AF37]/20 rounded-lg">
                            <TrendingUp className="text-[#D4AF37]" size={24} />
                        </div>
                        Central de Relatórios
                    </h2>
                    <p className="text-zinc-400 mt-1">Exporte dados do sistema em PDF ou Excel</p>
                </div>
            </div>

            {/* Reports Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {reports.map((report) => {
                    const Icon = report.icon;
                    const isLoadingExcel = loading === `${report.id}-excel`;
                    const isLoadingPdf = loading === `${report.id}-pdf`;

                    return (
                        <div
                            key={report.id}
                            className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-700 transition-all group"
                        >
                            {/* Header Gradient */}
                            <div className={`bg-gradient-to-r ${report.color} p-6`}>
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                                        <Icon size={24} className="text-white" />
                                    </div>
                                    <h3 className="text-lg font-bold text-white">{report.title}</h3>
                                </div>
                            </div>

                            {/* Body */}
                            <div className="p-6">
                                <p className="text-zinc-400 text-sm mb-6">{report.description}</p>

                                {/* Filter for Installments */}
                                {report.id === 'installments' && (
                                    <div className="mb-4">
                                        <label className="text-xs text-zinc-500 mb-2 flex items-center gap-1">
                                            <Filter size={12} /> Filtrar por Status
                                        </label>
                                        <select
                                            value={installmentFilter}
                                            onChange={(e) => setInstallmentFilter(e.target.value as any)}
                                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
                                        >
                                            <option value="all">Todas as Parcelas</option>
                                            <option value="open">Apenas Abertas</option>
                                            <option value="late">Apenas Atrasadas</option>
                                            <option value="paid">Apenas Pagas</option>
                                        </select>
                                    </div>
                                )}

                                {/* Export Buttons */}
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => handleExport(report, 'excel')}
                                        disabled={loading !== null}
                                        className="flex-1 flex items-center justify-center gap-2 bg-green-900/30 hover:bg-green-900/50 border border-green-700/50 text-green-400 px-4 py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isLoadingExcel ? (
                                            <Loader2 size={16} className="animate-spin" />
                                        ) : (
                                            <FileSpreadsheet size={16} />
                                        )}
                                        <span className="font-semibold text-sm">Excel</span>
                                    </button>

                                    <button
                                        onClick={() => handleExport(report, 'pdf')}
                                        disabled={loading !== null}
                                        className="flex-1 flex items-center justify-center gap-2 bg-red-900/30 hover:bg-red-900/50 border border-red-700/50 text-red-400 px-4 py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isLoadingPdf ? (
                                            <Loader2 size={16} className="animate-spin" />
                                        ) : (
                                            <Printer size={16} />
                                        )}
                                        <span className="font-semibold text-sm">PDF</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Info */}
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 flex items-start gap-3">
                <div className="p-2 bg-blue-900/30 rounded-lg">
                    <FileText size={18} className="text-blue-400" />
                </div>
                <div>
                    <h4 className="text-white font-semibold text-sm">Dica: Exportação</h4>
                    <p className="text-zinc-400 text-xs mt-1">
                        O formato Excel gera um arquivo CSV compatível com Excel e Google Sheets.
                        O formato PDF abre uma janela de impressão onde você pode salvar como PDF ou imprimir diretamente.
                    </p>
                </div>
            </div>
        </div>
    );
};
