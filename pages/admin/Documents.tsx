// 📄 Document Generator - Contratos, Recibos e Declarações com Assinatura Digital
import React, { useState, useEffect, useRef } from 'react';
import {
    FileText, Download, Printer, Eye, Receipt as ReceiptIcon, Award, FileCheck,
    Plus, Search, X, Edit2, Trash2, CheckCircle, Clock, AlertTriangle,
    QrCode, Shield, Pen, Save, Copy, ExternalLink, Sparkles
} from 'lucide-react';
import { Button } from '../../components/Button';
import { contractService, GeneratedDocument, ContractTemplateExtended } from '../../services/contractService';
import { documentService } from '../../services/adminService';
import { supabaseService } from '../../services/supabaseService';
import { useBrand } from '../../contexts/BrandContext';
import { Receipt, DischargeDeclaration, Customer, Loan } from '../../types';
import { useToast } from '../../components/Toast';

export const DocumentsPage: React.FC = () => {
    const { addToast } = useToast();
    const { settings: brandSettings } = useBrand();
    const [activeTab, setActiveTab] = useState<'contracts' | 'receipts' | 'declarations' | 'templates'>('contracts');
    const [documents, setDocuments] = useState<GeneratedDocument[]>([]);
    const [templates, setTemplates] = useState<ContractTemplateExtended[]>([]);
    const [receipts, setReceipts] = useState<Receipt[]>([]);
    const [declarations, setDeclarations] = useState<DischargeDeclaration[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loans, setLoans] = useState<Loan[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal states
    const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
    const [isDeclarationModalOpen, setIsDeclarationModalOpen] = useState(false);
    const [previewHTML, setPreviewHTML] = useState<string>('');
    const [previewDoc, setPreviewDoc] = useState<GeneratedDocument | null>(null);

    // Receipt/Declaration form states
    const [receiptCustomerId, setReceiptCustomerId] = useState('');
    const [receiptAmount, setReceiptAmount] = useState('');
    const [receiptMethod, setReceiptMethod] = useState('PIX');
    const [declarationCustomerId, setDeclarationCustomerId] = useState('');
    const [declarationLoanId, setDeclarationLoanId] = useState('');

    // Form states
    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    const [selectedLoanId, setSelectedLoanId] = useState('');
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [currentTemplate, setCurrentTemplate] = useState<Partial<ContractTemplateExtended>>({
        name: '',
        type: 'LOAN',
        sections: [{ title: '', content: '' }],
        requiresSignature: true,
        validityDays: 365
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [customersData, loansData] = await Promise.all([
                supabaseService.getCustomers(),
                supabaseService.getClientLoans()
            ]);
            setCustomers(Array.isArray(customersData) ? customersData : []);
            setLoans(Array.isArray(loansData) ? loansData : []);

            const docs = contractService.getDocuments();
            setDocuments(Array.isArray(docs) ? docs : []);

            const temps = contractService.getTemplates();
            setTemplates(Array.isArray(temps) ? temps : []);

            const recs = documentService.getReceipts();
            setReceipts(Array.isArray(recs) ? recs : []);

            const decls = documentService.getDeclarations();
            setDeclarations(Array.isArray(decls) ? decls : []);
        } catch (error) {
            console.error("Erro ao carregar dados:", error);
            addToast("Erro ao carregar dados", "error");
        }
    };

    const handleGenerateContract = () => {
        const customer = customers.find(c => c.id === selectedCustomerId);
        const loan = loans.find(l => l.id === selectedLoanId);

        if (!customer) {
            addToast('Selecione um cliente', 'warning');
            return;
        }
        if (!loan) {
            addToast('Selecione um empréstimo', 'warning');
            return;
        }
        if (!selectedTemplateId) {
            addToast('Selecione um template', 'warning');
            return;
        }

        const doc = contractService.generateContract(selectedTemplateId, customer, loan, undefined, brandSettings);
        addToast('Contrato gerado com sucesso!', 'success');
        setIsGenerateModalOpen(false);
        setSelectedCustomerId('');
        setSelectedLoanId('');
        setSelectedTemplateId('');
        loadData();

        // Preview
        handlePreview(doc);
    };

    const handlePreview = (doc: GeneratedDocument) => {
        const html = contractService.generateDocumentHTML(doc, brandSettings);
        setPreviewHTML(html);
        setPreviewDoc(doc);
        setIsPreviewOpen(true);
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(previewHTML);
            printWindow.document.close();
            setTimeout(() => printWindow.print(), 500);
        }
    };

    const handleDownload = (doc?: GeneratedDocument) => {
        const html = doc ? contractService.generateDocumentHTML(doc, brandSettings) : previewHTML;
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${doc?.type || 'documento'}_${doc?.id || Date.now()}.html`;
        a.click();
        URL.revokeObjectURL(url);
        addToast('Documento baixado!', 'success');
    };

    const handleCopyHash = (hash: string) => {
        navigator.clipboard.writeText(hash);
        addToast('Código de verificação copiado!', 'success');
    };

    const handleSaveTemplate = () => {
        if (!currentTemplate.name || !currentTemplate.sections?.length) {
            addToast('Preencha nome e pelo menos uma seção', 'warning');
            return;
        }

        const template = contractService.saveTemplate({
            name: currentTemplate.name!,
            type: currentTemplate.type || 'CUSTOM',
            content: '',
            variables: extractVariables(currentTemplate.sections || []),
            isDefault: false,
            requiresSignature: currentTemplate.requiresSignature ?? true,
            validityDays: currentTemplate.validityDays || 365,
            sections: currentTemplate.sections || []
        });

        addToast('Template salvo com sucesso!', 'success');
        setIsTemplateModalOpen(false);
        setCurrentTemplate({ name: '', type: 'LOAN', sections: [{ title: '', content: '' }], requiresSignature: true, validityDays: 365 });
        loadData();
    };

    const extractVariables = (sections: { title: string; content: string }[]): string[] => {
        const allContent = sections.map(s => s.content).join(' ');
        const matches = allContent.match(/\{[^}]+\}/g);
        return matches ? [...new Set(matches)] : [];
    };

    // Receipt handlers
    const handleGenerateReceipt = () => {
        const customer = customers.find(c => c.id === receiptCustomerId);
        if (!customer || !receiptAmount) {
            addToast('Preencha todos os campos', 'warning');
            return;
        }
        const receipt = documentService.generateReceipt({
            customerId: customer.id,
            customerName: customer.name,
            amount: parseFloat(receiptAmount),
            paymentMethod: (receiptMethod === 'DINHEIRO' ? 'CASH' : receiptMethod === 'TRANSFERENCIA' ? 'TRANSFER' : receiptMethod) as any,
            loanId: 'AVULSO',
            installmentId: 'AVULSO',
            paymentDate: new Date().toISOString()
        });
        addToast('Recibo gerado com sucesso!', 'success');
        setIsReceiptModalOpen(false);
        setReceiptCustomerId('');
        setReceiptAmount('');
        loadData();
    };

    const handlePreviewReceipt = (receipt: Receipt) => {
        const html = documentService.receiptToHTML(receipt, brandSettings);
        setPreviewHTML(html);
        setPreviewDoc(null);
        setIsPreviewOpen(true);
    };

    const handleDownloadReceipt = (receipt: Receipt) => {
        const html = documentService.receiptToHTML(receipt, brandSettings);
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `recibo_${receipt.id}.html`;
        a.click();
        URL.revokeObjectURL(url);
        addToast('Recibo baixado!', 'success');
    };

    // Declaration handlers
    const handleGenerateDeclaration = () => {
        const customer = customers.find(c => c.id === declarationCustomerId);
        const loan = loans.find(l => l.id === declarationLoanId);
        if (!customer || !loan) {
            addToast('Selecione cliente e empréstimo', 'warning');
            return;
        }
        const declaration = documentService.generateDischarge({
            customerId: customer.id,
            customerName: customer.name,
            cpf: customer.cpf,
            loanId: loan.id,
            originalAmount: loan.amount,
            totalPaid: loan.amount,
            startDate: loan.startDate,
            endDate: new Date().toISOString()
        });
        addToast('Declaração gerada com sucesso!', 'success');
        setIsDeclarationModalOpen(false);
        setDeclarationCustomerId('');
        setDeclarationLoanId('');
        loadData();
    };

    const handlePreviewDeclaration = (decl: DischargeDeclaration) => {
        const html = documentService.dischargeToHTML(decl, brandSettings);
        setPreviewHTML(html);
        setPreviewDoc(null);
        setIsPreviewOpen(true);
    };

    const handleDownloadDeclaration = (decl: DischargeDeclaration) => {
        const html = documentService.dischargeToHTML(decl, brandSettings);
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `quitacao_${decl.id}.html`;
        a.click();
        URL.revokeObjectURL(url);
        addToast('Declaração baixada!', 'success');
    };

    const customerLoans = selectedCustomerId
        ? loans.filter(l => l.id.startsWith(selectedCustomerId) || customers.find(c => c.id === selectedCustomerId))
        : [];

    const filteredDocuments = documents.filter(d =>
        d.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.hash.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusColor = (status: GeneratedDocument['status']) => {
        const colors = {
            DRAFT: 'bg-yellow-900/50 text-yellow-400',
            SIGNED: 'bg-green-900/50 text-green-400',
            EXPIRED: 'bg-zinc-800 text-zinc-400',
            CANCELLED: 'bg-red-900/50 text-red-400'
        };
        return colors[status];
    };

    const getStatusLabel = (status: GeneratedDocument['status']) => {
        const labels = { DRAFT: 'Rascunho', SIGNED: 'Assinado', EXPIRED: 'Expirado', CANCELLED: 'Cancelado' };
        return labels[status];
    };

    return (
        <div className="p-4 md:p-8 bg-black min-h-screen text-white pb-32">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <h1 className="text-3xl font-bold text-[#D4AF37] flex items-center gap-2">
                    <FileText size={32} /> Gerador de Documentos
                </h1>
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => setIsTemplateModalOpen(true)}>
                        <Plus size={18} /> Novo Template
                    </Button>
                    <Button onClick={() => setIsGenerateModalOpen(true)}>
                        <Sparkles size={18} /> Gerar Contrato
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <p className="text-zinc-400 text-sm">Total Contratos</p>
                    <p className="text-2xl font-bold text-[#D4AF37]">{documents.length}</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <p className="text-zinc-400 text-sm">Assinados</p>
                    <p className="text-2xl font-bold text-green-400">{documents.filter(d => d.status === 'SIGNED').length}</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <p className="text-zinc-400 text-sm">Pendentes</p>
                    <p className="text-2xl font-bold text-yellow-400">{documents.filter(d => d.status === 'DRAFT').length}</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <p className="text-zinc-400 text-sm">Templates</p>
                    <p className="text-2xl font-bold text-blue-400">{templates.length}</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 bg-zinc-900/50 p-1 rounded-xl w-fit border border-zinc-800">
                {(['contracts', 'receipts', 'declarations', 'templates'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === tab ? 'bg-[#D4AF37] text-black' : 'text-zinc-400 hover:text-white'
                            }`}
                    >
                        {tab === 'contracts' ? 'Contratos' : tab === 'receipts' ? 'Recibos' : tab === 'declarations' ? 'Quitações' : 'Templates'}
                    </button>
                ))}
            </div>

            {/* Search */}
            <div className="flex gap-4 mb-6">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar por cliente ou código de verificação..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-10 pr-4 py-3 text-white focus:border-[#D4AF37] outline-none"
                    />
                </div>
            </div>

            {/* Contracts Tab */}
            {activeTab === 'contracts' && (
                <div className="space-y-4">
                    {filteredDocuments.length === 0 ? (
                        <div className="text-center py-16 bg-zinc-900 border border-zinc-800 rounded-2xl">
                            <FileCheck size={64} className="mx-auto mb-4 text-zinc-600" />
                            <p className="text-zinc-400 text-lg mb-2">Nenhum contrato gerado</p>
                            <p className="text-sm text-zinc-500 mb-6">Clique em "Gerar Contrato" para criar seu primeiro documento</p>
                            <Button onClick={() => setIsGenerateModalOpen(true)}>
                                <Sparkles size={18} /> Gerar Primeiro Contrato
                            </Button>
                        </div>
                    ) : (
                        filteredDocuments.map(doc => (
                            <div key={doc.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-[#D4AF37]/50 transition-colors">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-start gap-4">
                                        <div className={`p-3 rounded-xl ${doc.status === 'SIGNED' ? 'bg-green-900/30' : 'bg-yellow-900/30'}`}>
                                            {doc.status === 'SIGNED' ? (
                                                <CheckCircle className="text-green-400" size={24} />
                                            ) : (
                                                <Clock className="text-yellow-400" size={24} />
                                            )}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white text-lg">{doc.title}</h3>
                                            <p className="text-zinc-400">{doc.customerName}</p>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(doc.status)}`}>
                                                    {getStatusLabel(doc.status)}
                                                </span>
                                                <span className="text-xs text-zinc-500">
                                                    {new Date(doc.createdAt).toLocaleDateString('pt-BR')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                                        {/* Verification Code */}
                                        <div className="flex items-center gap-2 bg-black/50 rounded-lg px-3 py-2">
                                            <Shield className="text-[#D4AF37]" size={16} />
                                            <code className="text-xs text-zinc-400 font-mono">{doc.hash.substring(0, 20)}...</code>
                                            <button
                                                onClick={() => handleCopyHash(doc.hash)}
                                                className="p-1 hover:bg-zinc-800 rounded"
                                                title="Copiar código"
                                            >
                                                <Copy size={14} className="text-zinc-500" />
                                            </button>
                                        </div>

                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handlePreview(doc)}
                                                className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                                                title="Visualizar"
                                            >
                                                <Eye size={18} className="text-zinc-400" />
                                            </button>
                                            <button
                                                onClick={() => handleDownload(doc)}
                                                className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                                                title="Download"
                                            >
                                                <Download size={18} className="text-zinc-400" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Templates Tab */}
            {activeTab === 'templates' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {templates.map(template => (
                        <div key={template.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-[#D4AF37]/50 transition-colors">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <span className={`text-xs px-2 py-1 rounded-full ${template.type === 'LOAN' ? 'bg-blue-900/50 text-blue-400' :
                                        template.type === 'REFINANCE' ? 'bg-purple-900/50 text-purple-400' :
                                            'bg-zinc-800 text-zinc-400'
                                        }`}>
                                        {template.type === 'LOAN' ? 'Empréstimo' : template.type === 'REFINANCE' ? 'Refinanciamento' : 'Personalizado'}
                                    </span>
                                    <h3 className="font-bold text-white mt-2">{template.name}</h3>
                                </div>
                                {template.isDefault && (
                                    <span className="text-xs bg-[#D4AF37]/20 text-[#D4AF37] px-2 py-1 rounded">Padrão</span>
                                )}
                            </div>
                            <p className="text-sm text-zinc-400 mb-4">
                                {template.sections?.length || 0} seções • {template.validityDays} dias de validade
                            </p>
                            <div className="flex flex-wrap gap-1 mb-4">
                                {template.variables.slice(0, 5).map(v => (
                                    <span key={v} className="text-[10px] bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded font-mono">{v}</span>
                                ))}
                                {template.variables.length > 5 && (
                                    <span className="text-[10px] text-zinc-500">+{template.variables.length - 5}</span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="secondary"
                                    className="flex-1 text-sm py-2"
                                    onClick={() => {
                                        setSelectedTemplateId(template.id);
                                        setIsGenerateModalOpen(true);
                                    }}
                                >
                                    Usar Template
                                </Button>
                            </div>
                        </div>
                    ))}

                    {/* Add New Template Card */}
                    <button
                        onClick={() => setIsTemplateModalOpen(true)}
                        className="bg-zinc-900/50 border-2 border-dashed border-zinc-700 rounded-xl p-6 hover:border-[#D4AF37] transition-colors flex flex-col items-center justify-center min-h-[200px]"
                    >
                        <Plus size={32} className="text-zinc-600 mb-2" />
                        <p className="text-zinc-400">Criar Novo Template</p>
                    </button>
                </div>
            )}

            {/* Receipts Tab */}
            {activeTab === 'receipts' && (
                <div className="space-y-4">
                    <div className="flex justify-end mb-4">
                        <Button onClick={() => setIsReceiptModalOpen(true)}>
                            <ReceiptIcon size={18} /> Gerar Recibo
                        </Button>
                    </div>
                    {receipts.length === 0 ? (
                        <div className="text-center py-16 bg-zinc-900 border border-zinc-800 rounded-2xl">
                            <ReceiptIcon size={64} className="mx-auto mb-4 text-zinc-600" />
                            <p className="text-zinc-400 text-lg mb-2">Nenhum recibo gerado</p>
                            <p className="text-sm text-zinc-500">Gere recibos ao confirmar pagamentos</p>
                        </div>
                    ) : (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-zinc-800 bg-zinc-800/50">
                                        <th className="text-left py-4 px-6 text-zinc-400 font-medium">Recibo</th>
                                        <th className="text-left py-4 px-6 text-zinc-400 font-medium">Cliente</th>
                                        <th className="text-left py-4 px-6 text-zinc-400 font-medium">Valor</th>
                                        <th className="text-left py-4 px-6 text-zinc-400 font-medium">Data</th>
                                        <th className="text-left py-4 px-6 text-zinc-400 font-medium">Método</th>
                                        <th className="text-right py-4 px-6 text-zinc-400 font-medium">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {receipts.map(receipt => (
                                        <tr key={receipt.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                                            <td className="py-4 px-6 font-mono text-zinc-400">#{receipt.id.slice(-6)}</td>
                                            <td className="py-4 px-6 font-bold text-white">{receipt.customerName}</td>
                                            <td className="py-4 px-6 text-green-400">R$ {receipt.amount.toLocaleString()}</td>
                                            <td className="py-4 px-6 text-zinc-400">
                                                {new Date(receipt.paymentDate).toLocaleDateString('pt-BR')}
                                            </td>
                                            <td className="py-4 px-6">
                                                <span className="bg-blue-900/50 text-blue-400 text-xs px-2 py-1 rounded">
                                                    {receipt.paymentMethod}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handlePreviewReceipt(receipt)}
                                                        className="p-2 hover:bg-zinc-800 rounded-lg"
                                                        title="Visualizar"
                                                    >
                                                        <Eye size={16} className="text-zinc-400" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDownloadReceipt(receipt)}
                                                        className="p-2 hover:bg-zinc-800 rounded-lg"
                                                        title="Download"
                                                    >
                                                        <Download size={16} className="text-zinc-400" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Declarations Tab */}
            {activeTab === 'declarations' && (
                <div className="space-y-4">
                    <div className="flex justify-end mb-4">
                        <Button onClick={() => setIsDeclarationModalOpen(true)}>
                            <Award size={18} /> Gerar Quitação
                        </Button>
                    </div>
                    {declarations.length === 0 ? (
                        <div className="text-center py-16 bg-zinc-900 border border-zinc-800 rounded-2xl">
                            <Award size={64} className="mx-auto mb-4 text-zinc-600" />
                            <p className="text-zinc-400 text-lg mb-2">Nenhuma declaração gerada</p>
                            <p className="text-sm text-zinc-500">Gere declarações para empréstimos quitados</p>
                        </div>
                    ) : (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-zinc-800 bg-zinc-800/50">
                                        <th className="text-left py-4 px-6 text-zinc-400 font-medium">ID</th>
                                        <th className="text-left py-4 px-6 text-zinc-400 font-medium">Cliente</th>
                                        <th className="text-left py-4 px-6 text-zinc-400 font-medium">CPF</th>
                                        <th className="text-left py-4 px-6 text-zinc-400 font-medium">Valor Original</th>
                                        <th className="text-left py-4 px-6 text-zinc-400 font-medium">Data</th>
                                        <th className="text-right py-4 px-6 text-zinc-400 font-medium">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {declarations.map(decl => (
                                        <tr key={decl.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                                            <td className="py-4 px-6 font-mono text-zinc-400">#{decl.id.slice(-6)}</td>
                                            <td className="py-4 px-6 font-bold text-white">{decl.customerName}</td>
                                            <td className="py-4 px-6 text-zinc-400">{decl.cpf}</td>
                                            <td className="py-4 px-6 text-[#D4AF37]">R$ {decl.originalAmount.toLocaleString()}</td>
                                            <td className="py-4 px-6 text-zinc-400">
                                                {new Date(decl.generatedAt).toLocaleDateString('pt-BR')}
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handlePreviewDeclaration(decl)}
                                                        className="p-2 hover:bg-zinc-800 rounded-lg"
                                                        title="Visualizar"
                                                    >
                                                        <Eye size={16} className="text-zinc-400" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDownloadDeclaration(decl)}
                                                        className="p-2 hover:bg-zinc-800 rounded-lg"
                                                        title="Download"
                                                    >
                                                        <Download size={16} className="text-zinc-400" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Generate Contract Modal */}
            {isGenerateModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-[#D4AF37] flex items-center gap-2">
                                <Sparkles size={24} /> Gerar Novo Contrato
                            </h2>
                            <button onClick={() => setIsGenerateModalOpen(false)} className="text-zinc-500 hover:text-white">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-zinc-400 mb-2">Template de Contrato</label>
                                <select
                                    value={selectedTemplateId}
                                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                                >
                                    <option value="">Selecione um template</option>
                                    {templates.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-zinc-400 mb-2">Cliente</label>
                                <select
                                    value={selectedCustomerId}
                                    onChange={(e) => { setSelectedCustomerId(e.target.value); setSelectedLoanId(''); }}
                                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                                >
                                    <option value="">Selecione um cliente</option>
                                    {customers.map(c => (
                                        <option key={c.id} value={c.id}>{c.name} - {c.cpf}</option>
                                    ))}
                                </select>
                            </div>
                            {selectedCustomerId && (
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-2">Empréstimo</label>
                                    <select
                                        value={selectedLoanId}
                                        onChange={(e) => setSelectedLoanId(e.target.value)}
                                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                                    >
                                        <option value="">Selecione um empréstimo</option>
                                        {loans.filter(l => {
                                            const customer = customers.find(c => c.id === selectedCustomerId);
                                            return customer;
                                        }).map(l => (
                                            <option key={l.id} value={l.id}>
                                                R$ {l.amount.toLocaleString()} - {l.installments.length}x
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className="bg-black/50 rounded-xl p-4 border border-zinc-800">
                                <div className="flex items-center gap-2 text-sm text-zinc-400">
                                    <Shield className="text-[#D4AF37]" size={16} />
                                    <span>O contrato será gerado com código de verificação único e QR Code de autenticidade</span>
                                </div>
                            </div>
                            <Button onClick={handleGenerateContract} className="w-full">
                                <Sparkles size={18} /> Gerar Contrato
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Template Editor Modal */}
            {isTemplateModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-[#D4AF37]">Editor de Template</h2>
                            <button onClick={() => setIsTemplateModalOpen(false)} className="text-zinc-500 hover:text-white">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-2">Nome do Template</label>
                                    <input
                                        value={currentTemplate.name || ''}
                                        onChange={(e) => setCurrentTemplate({ ...currentTemplate, name: e.target.value })}
                                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                                        placeholder="Ex: Contrato de Empréstimo Pessoal"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-2">Tipo</label>
                                    <select
                                        value={currentTemplate.type || 'LOAN'}
                                        onChange={(e) => setCurrentTemplate({ ...currentTemplate, type: e.target.value as any })}
                                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                                    >
                                        <option value="LOAN">Empréstimo</option>
                                        <option value="REFINANCE">Refinanciamento</option>
                                        <option value="GUARANTEE">Garantia</option>
                                        <option value="CUSTOM">Personalizado</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-2">Validade (dias)</label>
                                    <input
                                        type="number"
                                        value={currentTemplate.validityDays || 365}
                                        onChange={(e) => setCurrentTemplate({ ...currentTemplate, validityDays: Number(e.target.value) })}
                                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                                    />
                                </div>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        checked={currentTemplate.requiresSignature ?? true}
                                        onChange={(e) => setCurrentTemplate({ ...currentTemplate, requiresSignature: e.target.checked })}
                                        className="w-5 h-5 accent-[#D4AF37]"
                                    />
                                    <span className="text-zinc-400">Requer assinatura digital</span>
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm text-zinc-400">Seções do Contrato</label>
                                    <button
                                        onClick={() => setCurrentTemplate({
                                            ...currentTemplate,
                                            sections: [...(currentTemplate.sections || []), { title: '', content: '' }]
                                        })}
                                        className="text-xs bg-zinc-800 text-zinc-400 px-3 py-1 rounded-lg hover:bg-zinc-700"
                                    >
                                        + Adicionar Seção
                                    </button>
                                </div>
                                <div className="space-y-4">
                                    {currentTemplate.sections?.map((section, index) => (
                                        <div key={index} className="bg-black border border-zinc-800 rounded-xl p-4">
                                            <div className="flex justify-between items-center mb-2">
                                                <input
                                                    value={section.title}
                                                    onChange={(e) => {
                                                        const updated = [...(currentTemplate.sections || [])];
                                                        updated[index].title = e.target.value;
                                                        setCurrentTemplate({ ...currentTemplate, sections: updated });
                                                    }}
                                                    className="bg-transparent border-b border-zinc-700 pb-1 text-white font-bold focus:border-[#D4AF37] outline-none flex-1"
                                                    placeholder="Título da Seção"
                                                />
                                                <button
                                                    onClick={() => {
                                                        const updated = currentTemplate.sections?.filter((_, i) => i !== index);
                                                        setCurrentTemplate({ ...currentTemplate, sections: updated });
                                                    }}
                                                    className="p-1 hover:bg-red-900/50 rounded ml-2"
                                                >
                                                    <Trash2 size={16} className="text-zinc-500" />
                                                </button>
                                            </div>
                                            <textarea
                                                value={section.content}
                                                onChange={(e) => {
                                                    const updated = [...(currentTemplate.sections || [])];
                                                    updated[index].content = e.target.value;
                                                    setCurrentTemplate({ ...currentTemplate, sections: updated });
                                                }}
                                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-zinc-300 text-sm focus:border-[#D4AF37] outline-none resize-none h-32"
                                                placeholder="Conteúdo da seção. Use variáveis como {nome}, {valor}, {cpf}..."
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4">
                                <h4 className="text-blue-400 font-bold text-sm mb-2">💡 Variáveis Disponíveis</h4>
                                <div className="flex flex-wrap gap-2">
                                    {['{nome}', '{cpf}', '{endereco}', '{telefone}', '{valor}', '{parcelas}', '{taxa}', '{data}', '{vencimento}'].map(v => (
                                        <code key={v} className="text-xs bg-blue-900/30 text-blue-300 px-2 py-1 rounded">{v}</code>
                                    ))}
                                </div>
                            </div>

                            <Button onClick={handleSaveTemplate} className="w-full">
                                <Save size={18} /> Salvar Template
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Preview Modal */}
            {isPreviewOpen && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col">
                        <div className="bg-zinc-800 p-4 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-4">
                                <h2 className="text-white font-bold">Preview do Documento</h2>
                                {previewDoc && (
                                    <div className="flex items-center gap-2 bg-black/50 rounded-lg px-3 py-1">
                                        <QrCode size={16} className="text-[#D4AF37]" />
                                        <code className="text-xs text-zinc-400">{previewDoc.hash.substring(0, 25)}...</code>
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handlePrint}
                                    className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
                                    title="Imprimir"
                                >
                                    <Printer size={20} className="text-white" />
                                </button>
                                <button
                                    onClick={() => handleDownload(previewDoc || undefined)}
                                    className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
                                    title="Download"
                                >
                                    <Download size={20} className="text-white" />
                                </button>
                                <button
                                    onClick={() => setIsPreviewOpen(false)}
                                    className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
                                >
                                    <X size={20} className="text-white" />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto bg-zinc-950">
                            <iframe
                                srcDoc={previewHTML}
                                className="w-full h-full min-h-[600px]"
                                title="Document Preview"
                                style={{ border: 'none' }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Receipt Modal */}
            {isReceiptModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg p-6 animate-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-[#D4AF37] flex items-center gap-2">
                                <ReceiptIcon size={24} /> Gerar Recibo
                            </h2>
                            <button onClick={() => setIsReceiptModalOpen(false)} className="text-zinc-500 hover:text-white">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-zinc-400 mb-2">Cliente</label>
                                <select
                                    value={receiptCustomerId}
                                    onChange={(e) => setReceiptCustomerId(e.target.value)}
                                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                                >
                                    <option value="">Selecione um cliente</option>
                                    {customers.map(c => (
                                        <option key={c.id} value={c.id}>{c.name} - {c.cpf}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-zinc-400 mb-2">Valor (R$)</label>
                                <input
                                    type="number"
                                    value={receiptAmount}
                                    onChange={(e) => setReceiptAmount(e.target.value)}
                                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                                    placeholder="0.00"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-zinc-400 mb-2">Forma de Pagamento</label>
                                <select
                                    value={receiptMethod}
                                    onChange={(e) => setReceiptMethod(e.target.value)}
                                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                                >
                                    <option value="PIX">PIX</option>
                                    <option value="DINHEIRO">Dinheiro</option>
                                    <option value="TRANSFERENCIA">Transferência</option>
                                    <option value="BOLETO">Boleto</option>
                                </select>
                            </div>
                            <Button onClick={handleGenerateReceipt} className="w-full mt-4">
                                <ReceiptIcon size={18} /> Confirmar Geração
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Declaration Modal */}
            {isDeclarationModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg p-6 animate-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-[#D4AF37] flex items-center gap-2">
                                <Award size={24} /> Gerar Declaração de Quitação
                            </h2>
                            <button onClick={() => setIsDeclarationModalOpen(false)} className="text-zinc-500 hover:text-white">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-zinc-400 mb-2">Cliente</label>
                                <select
                                    value={declarationCustomerId}
                                    onChange={(e) => { setDeclarationCustomerId(e.target.value); setDeclarationLoanId(''); }}
                                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                                >
                                    <option value="">Selecione um cliente</option>
                                    {customers.map(c => (
                                        <option key={c.id} value={c.id}>{c.name} - {c.cpf}</option>
                                    ))}
                                </select>
                            </div>
                            {declarationCustomerId && (
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-2">Empréstimo Quitado</label>
                                    <select
                                        value={declarationLoanId}
                                        onChange={(e) => setDeclarationLoanId(e.target.value)}
                                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                                    >
                                        <option value="">Selecione um empréstimo</option>
                                        {loans.map(l => (
                                            <option key={l.id} value={l.id}>
                                                R$ {l.amount.toLocaleString()} ({new Date(l.startDate).toLocaleDateString()}) - Restante: R$ {l.remainingAmount}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <Button onClick={handleGenerateDeclaration} className="w-full mt-4">
                                <Award size={18} /> Gerar Declaração
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
