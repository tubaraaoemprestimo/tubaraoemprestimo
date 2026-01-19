// 📄 My Documents - Portal do Cliente para visualizar documentos
import React, { useState, useEffect, useRef } from 'react';
import {
    FileText, Download, Eye, Shield, CheckCircle, Clock,
    AlertTriangle, QrCode, Pen, X, ChevronRight, FileCheck,
    Receipt, Award, Calendar
} from 'lucide-react';
import { Button } from '../../components/Button';
import { contractService, GeneratedDocument } from '../../services/contractService';
import { documentService } from '../../services/adminService';
import { supabaseService } from '../../services/supabaseService';
import { useBrand } from '../../contexts/BrandContext';
import { useToast } from '../../components/Toast';

// Signature Pad Component
const SignaturePad: React.FC<{
    onSave: (signature: string) => void;
    onCancel: () => void;
}> = ({ onSave, onCancel }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [lastPos, setLastPos] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.strokeStyle = '#1a1a1a';
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
            }
        }
    }, []);

    const getPos = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        return {
            x: (clientX - rect.left) * (canvas.width / rect.width),
            y: (clientY - rect.top) * (canvas.height / rect.height)
        };
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDrawing(true);
        setLastPos(getPos(e));
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx) return;

        const currentPos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(lastPos.x, lastPos.y);
        ctx.lineTo(currentPos.x, currentPos.y);
        ctx.stroke();
        setLastPos(currentPos);
    };

    const stopDrawing = () => setIsDrawing(false);

    const clear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (ctx && canvas) {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    };

    const save = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const dataUrl = canvas.toDataURL('image/png');
            onSave(dataUrl);
        }
    };

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                <Pen className="text-[#D4AF37]" size={20} />
                Assine no campo abaixo
            </h3>
            <div className="bg-white rounded-xl overflow-hidden mb-4 touch-none">
                <canvas
                    ref={canvasRef}
                    width={500}
                    height={200}
                    className="w-full cursor-crosshair"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                />
            </div>
            <div className="flex gap-3">
                <Button variant="secondary" onClick={clear} className="flex-1">
                    Limpar
                </Button>
                <Button variant="secondary" onClick={onCancel} className="flex-1">
                    Cancelar
                </Button>
                <Button onClick={save} className="flex-1">
                    <CheckCircle size={18} /> Confirmar Assinatura
                </Button>
            </div>
        </div>
    );
};

export const MyDocuments: React.FC = () => {
    const { addToast } = useToast();
    const { settings: brandSettings } = useBrand();
    const [activeTab, setActiveTab] = useState<'all' | 'contracts' | 'receipts'>('all');
    const [documents, setDocuments] = useState<GeneratedDocument[]>([]);
    const [selectedDoc, setSelectedDoc] = useState<GeneratedDocument | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isSigningOpen, setIsSigningOpen] = useState(false);
    const [previewHTML, setPreviewHTML] = useState('');

    useEffect(() => {
        loadDocuments();
    }, []);

    const loadDocuments = () => {
        const user = supabaseService.auth.getUser();
        if (user) {
            const allDocs = contractService.getDocuments(user.id);
            setDocuments(allDocs);
        }
    };

    const handlePreview = (doc: GeneratedDocument) => {
        const html = contractService.generateDocumentHTML(doc, brandSettings);
        setPreviewHTML(html);
        setSelectedDoc(doc);
        setIsPreviewOpen(true);
    };

    const handleSign = (doc: GeneratedDocument) => {
        setSelectedDoc(doc);
        setIsSigningOpen(true);
    };

    const handleSaveSignature = (signatureData: string) => {
        if (selectedDoc) {
            const signed = contractService.signDocument(selectedDoc.id, signatureData);
            if (signed) {
                addToast('Documento assinado com sucesso!', 'success');
                loadDocuments();
                setIsSigningOpen(false);

                // Show updated preview
                const html = contractService.generateDocumentHTML(signed, brandSettings);
                setPreviewHTML(html);
                setSelectedDoc(signed);
                setIsPreviewOpen(true);
            }
        }
    };

    const handleDownload = () => {
        if (!selectedDoc) return;
        const html = contractService.generateDocumentHTML(selectedDoc, brandSettings);
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedDoc.title.replace(/\s+/g, '_')}_${selectedDoc.id}.html`;
        a.click();
        URL.revokeObjectURL(url);
        addToast('Documento baixado!', 'success');
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(previewHTML);
            printWindow.document.close();
            setTimeout(() => printWindow.print(), 500);
        }
    };

    const getStatusIcon = (status: GeneratedDocument['status']) => {
        switch (status) {
            case 'SIGNED': return <CheckCircle className="text-green-400" size={20} />;
            case 'DRAFT': return <Clock className="text-yellow-400" size={20} />;
            case 'EXPIRED': return <AlertTriangle className="text-red-400" size={20} />;
            default: return <FileText className="text-zinc-400" size={20} />;
        }
    };

    const getStatusLabel = (status: GeneratedDocument['status']) => {
        const labels = { DRAFT: 'Aguardando Assinatura', SIGNED: 'Assinado', EXPIRED: 'Expirado', CANCELLED: 'Cancelado' };
        return labels[status];
    };

    const getStatusColor = (status: GeneratedDocument['status']) => {
        const colors = {
            DRAFT: 'border-yellow-500/30 bg-yellow-900/10',
            SIGNED: 'border-green-500/30 bg-green-900/10',
            EXPIRED: 'border-red-500/30 bg-red-900/10',
            CANCELLED: 'border-zinc-500/30 bg-zinc-900/10'
        };
        return colors[status];
    };

    const filteredDocs = documents.filter(d => {
        if (activeTab === 'contracts') return d.type === 'CONTRACT';
        if (activeTab === 'receipts') return d.type === 'RECEIPT' || d.type === 'DISCHARGE';
        return true;
    });

    const pendingCount = documents.filter(d => d.status === 'DRAFT').length;

    return (
        <div className="p-4 md:p-8 bg-black min-h-screen text-white pb-32">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Meus Documentos</h1>
                <p className="text-zinc-400">Acesse seus contratos, recibos e declarações</p>
            </div>

            {/* Pending Alert */}
            {pendingCount > 0 && (
                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-2xl p-4 mb-6 flex items-center gap-4">
                    <div className="p-3 bg-yellow-900/50 rounded-xl">
                        <Pen className="text-yellow-400" size={24} />
                    </div>
                    <div className="flex-1">
                        <p className="font-bold text-white">Você tem {pendingCount} documento(s) aguardando assinatura</p>
                        <p className="text-sm text-yellow-400/80">Assine digitalmente para validar seus contratos</p>
                    </div>
                    <ChevronRight className="text-yellow-400" size={20} />
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
                    <FileText className="text-[#D4AF37] mx-auto mb-2" size={24} />
                    <p className="text-2xl font-bold text-white">{documents.filter(d => d.type === 'CONTRACT').length}</p>
                    <p className="text-xs text-zinc-400">Contratos</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
                    <Receipt className="text-blue-400 mx-auto mb-2" size={24} />
                    <p className="text-2xl font-bold text-white">{documents.filter(d => d.type === 'RECEIPT').length}</p>
                    <p className="text-xs text-zinc-400">Recibos</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
                    <Award className="text-green-400 mx-auto mb-2" size={24} />
                    <p className="text-2xl font-bold text-white">{documents.filter(d => d.type === 'DISCHARGE').length}</p>
                    <p className="text-xs text-zinc-400">Quitações</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                {(['all', 'contracts', 'receipts'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeTab === tab ? 'bg-[#D4AF37] text-black' : 'bg-zinc-800 text-zinc-400'
                            }`}
                    >
                        {tab === 'all' ? 'Todos' : tab === 'contracts' ? 'Contratos' : 'Recibos'}
                    </button>
                ))}
            </div>

            {/* Document List */}
            {filteredDocs.length === 0 ? (
                <div className="text-center py-16 bg-zinc-900 border border-zinc-800 rounded-2xl">
                    <FileCheck size={64} className="mx-auto mb-4 text-zinc-600" />
                    <p className="text-zinc-400 text-lg">Nenhum documento encontrado</p>
                    <p className="text-sm text-zinc-500">Seus contratos e recibos aparecerão aqui</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredDocs.map(doc => (
                        <div
                            key={doc.id}
                            className={`border rounded-2xl p-4 transition-all ${getStatusColor(doc.status)}`}
                        >
                            <div className="flex items-start gap-4">
                                <div className={`p-3 rounded-xl ${doc.status === 'SIGNED' ? 'bg-green-900/50' :
                                        doc.status === 'DRAFT' ? 'bg-yellow-900/50' : 'bg-zinc-800'
                                    }`}>
                                    {doc.type === 'CONTRACT' ? <FileText size={24} className={doc.status === 'SIGNED' ? 'text-green-400' : 'text-yellow-400'} /> :
                                        doc.type === 'RECEIPT' ? <Receipt size={24} className="text-blue-400" /> :
                                            <Award size={24} className="text-green-400" />}
                                </div>

                                <div className="flex-1">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div>
                                            <h3 className="font-bold text-white">{doc.title}</h3>
                                            <p className="text-sm text-zinc-400 flex items-center gap-2 mt-1">
                                                <Calendar size={14} />
                                                {new Date(doc.createdAt).toLocaleDateString('pt-BR')}
                                            </p>
                                        </div>
                                        <span className={`text-xs px-3 py-1 rounded-full flex items-center gap-1 ${doc.status === 'SIGNED' ? 'bg-green-900/50 text-green-400' :
                                                doc.status === 'DRAFT' ? 'bg-yellow-900/50 text-yellow-400' :
                                                    'bg-zinc-800 text-zinc-400'
                                            }`}>
                                            {getStatusIcon(doc.status)}
                                            {getStatusLabel(doc.status)}
                                        </span>
                                    </div>

                                    {/* Verification */}
                                    <div className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-2 mb-3">
                                        <Shield className="text-[#D4AF37]" size={14} />
                                        <code className="text-xs text-zinc-500 font-mono flex-1 truncate">{doc.hash}</code>
                                        <QrCode className="text-zinc-600" size={14} />
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handlePreview(doc)}
                                            className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-2 px-4 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                                        >
                                            <Eye size={16} /> Visualizar
                                        </button>
                                        {doc.status === 'DRAFT' && doc.type === 'CONTRACT' && (
                                            <button
                                                onClick={() => handleSign(doc)}
                                                className="flex-1 bg-[#D4AF37] hover:bg-yellow-600 text-black py-2 px-4 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                                            >
                                                <Pen size={16} /> Assinar
                                            </button>
                                        )}
                                        {doc.status === 'SIGNED' && (
                                            <button
                                                onClick={() => { setSelectedDoc(doc); handleDownload(); }}
                                                className="flex-1 bg-green-900/50 hover:bg-green-900 text-green-400 py-2 px-4 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                                            >
                                                <Download size={16} /> Baixar
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Signature Modal */}
            {isSigningOpen && selectedDoc && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="w-full max-w-lg">
                        <div className="text-center mb-6">
                            <h2 className="text-2xl font-bold text-white mb-2">Assinar Documento</h2>
                            <p className="text-zinc-400">{selectedDoc.title}</p>
                        </div>
                        <SignaturePad
                            onSave={handleSaveSignature}
                            onCancel={() => setIsSigningOpen(false)}
                        />
                        <p className="text-center text-xs text-zinc-500 mt-4">
                            Ao assinar, você concorda com todos os termos do contrato
                        </p>
                    </div>
                </div>
            )}

            {/* Preview Modal */}
            {isPreviewOpen && selectedDoc && (
                <div className="fixed inset-0 bg-black/95 z-50 flex flex-col">
                    {/* Header */}
                    <div className="bg-zinc-900 border-b border-zinc-800 p-4 flex items-center justify-between shrink-0">
                        <div>
                            <h2 className="text-white font-bold">{selectedDoc.title}</h2>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={`text-xs px-2 py-0.5 rounded ${selectedDoc.status === 'SIGNED' ? 'bg-green-900/50 text-green-400' : 'bg-yellow-900/50 text-yellow-400'
                                    }`}>
                                    {getStatusLabel(selectedDoc.status)}
                                </span>
                                <span className="text-xs text-zinc-500">
                                    {new Date(selectedDoc.createdAt).toLocaleDateString('pt-BR')}
                                </span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {selectedDoc.status === 'SIGNED' && (
                                <Button variant="secondary" onClick={handleDownload}>
                                    <Download size={18} /> Baixar
                                </Button>
                            )}
                            {selectedDoc.status === 'DRAFT' && selectedDoc.type === 'CONTRACT' && (
                                <Button onClick={() => { setIsPreviewOpen(false); handleSign(selectedDoc); }}>
                                    <Pen size={18} /> Assinar Agora
                                </Button>
                            )}
                            <button onClick={() => setIsPreviewOpen(false)} className="p-2 hover:bg-zinc-800 rounded-lg">
                                <X size={24} className="text-white" />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-auto bg-zinc-950 p-4">
                        <iframe
                            srcDoc={previewHTML}
                            className="w-full h-full min-h-[600px] rounded-xl"
                            title="Document Preview"
                            style={{ border: 'none' }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
