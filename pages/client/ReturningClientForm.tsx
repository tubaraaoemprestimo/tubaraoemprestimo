import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    User, Phone, Mail, Calendar, DollarSign, Instagram,
    ArrowLeft, Send, Loader2, CheckCircle, Clock, UserCheck,
    Shield, Sparkles, Upload, Camera
} from 'lucide-react';
import { Logo } from '../../components/Logo';
import { useToast } from '../../components/Toast';
import { apiService } from '../../services/apiService';
import { api } from '../../services/apiClient';
import { SystemSettings } from '../../types';
import { PaymentReceiptUpload } from '../../components/PaymentReceiptUpload';

// Componente Input
const Input: React.FC<{
    label: string;
    name: string;
    type?: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    icon?: React.ReactNode;
    mask?: (value: string) => string;
    required?: boolean;
}> = ({ label, name, type = 'text', value, onChange, placeholder, icon, mask, required }) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (mask) {
            e.target.value = mask(e.target.value);
        }
        onChange(e);
    };

    return (
        <div className="space-y-2">
            <label className="text-sm text-zinc-400 font-medium flex items-center gap-1">
                {label}
                {required && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
                {icon && (
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
                        {icon}
                    </div>
                )}
                <input
                    type={type}
                    name={name}
                    value={value}
                    onChange={handleChange}
                    placeholder={placeholder}
                    className={`w-full bg-black border border-zinc-700 rounded-xl py-4 text-white placeholder:text-zinc-600 focus:border-emerald-500 outline-none transition-colors ${icon ? 'pl-12 pr-4' : 'px-4'}`}
                />
            </div>
        </div>
    );
};

// Máscaras
const masks = {
    cpf: (value: string) => {
        return value
            .replace(/\D/g, '')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d{1,2})/, '$1-$2')
            .replace(/(-\d{2})\d+?$/, '$1');
    },
    phone: (value: string) => {
        return value
            .replace(/\D/g, '')
            .replace(/(\d{2})(\d)/, '($1) $2')
            .replace(/(\d{5})(\d)/, '$1-$2')
            .replace(/(-\d{4})\d+?$/, '$1');
    },
    date: (value: string) => {
        return value
            .replace(/\D/g, '')
            .replace(/(\d{2})(\d)/, '$1/$2')
            .replace(/(\d{2})(\d)/, '$1/$2')
            .replace(/(\d{4})\d+?$/, '$1');
    }
};

export const ReturningClientForm: React.FC = () => {
    const navigate = useNavigate();
    const { addToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [settings, setSettings] = useState<SystemSettings | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        cpf: '',
        rg: '',
        birthDate: '',
        phone: '',
        email: '',
        address: '',
        neighborhood: '',
        city: '',
        state: '',
        zipCode: '',
        instagram: '',
        loanAmount: '',
        interestRate: '',
        dueDate: '',
        chargeType: 'MENSAL',
        notes: '',
        proofOfResidenceUrl: '',
        selfieUrl: ''
    });

    useEffect(() => {
        apiService.getSettings().then(setSettings);
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };

    const validateCPF = (cpf: string) => {
        const cleanCpf = cpf.replace(/\D/g, '');
        if (cleanCpf.length !== 11) return false;
        if (/^(\d)\1+$/.test(cleanCpf)) return false;
        // Validação de dígitos verificadores
        let sum = 0;
        for (let i = 0; i < 9; i++) sum += parseInt(cleanCpf[i]) * (10 - i);
        let digit = (sum * 10) % 11;
        if (digit === 10) digit = 0;
        if (digit !== parseInt(cleanCpf[9])) return false;
        sum = 0;
        for (let i = 0; i < 10; i++) sum += parseInt(cleanCpf[i]) * (11 - i);
        digit = (sum * 10) % 11;
        if (digit === 10) digit = 0;
        return digit === parseInt(cleanCpf[10]);
    };

    const handleSubmit = async () => {
        // Validação
        if (!formData.name.trim()) {
            addToast('Informe seu nome completo.', 'warning');
            return;
        }
        if (!validateCPF(formData.cpf)) {
            addToast('CPF inválido.', 'error');
            return;
        }
        if (!formData.phone || formData.phone.replace(/\D/g, '').length < 11) {
            addToast('Informe um telefone válido.', 'warning');
            return;
        }
        if (!formData.email || !formData.email.includes('@')) {
            addToast('Informe um e-mail válido.', 'warning');
            return;
        }
        if (!formData.proofOfResidenceUrl) {
            addToast('Envie o comprovante de residência.', 'warning');
            return;
        }
        if (!formData.selfieUrl) {
            addToast('Envie uma selfie para validação.', 'warning');
            return;
        }
        if (!formData.loanAmount || Number(formData.loanAmount) < 100) {
            addToast('Informe o valor do empréstimo.', 'warning');
            return;
        }
        if (!formData.interestRate) {
            addToast('Informe a taxa de juros.', 'warning');
            return;
        }
        if (!formData.dueDate) {
            addToast('Informe a data de vencimento.', 'warning');
            return;
        }

        setLoading(true);

        try {
            // Enviar para API de clientes recorrentes
            const response = await api.post('/api/returning-clients', {
                // Etapa 1: Atualização Cadastral
                name: formData.name,
                cpf: formData.cpf,
                rg: formData.rg,
                birthDate: formData.birthDate,
                phone: formData.phone,
                email: formData.email,
                address: formData.address,
                neighborhood: formData.neighborhood,
                city: formData.city,
                state: formData.state,
                zipCode: formData.zipCode,
                proofOfResidenceUrl: formData.proofOfResidenceUrl,
                selfieUrl: formData.selfieUrl,

                // Etapa 2: Dados do Contrato Atual
                loanAmount: Number(formData.loanAmount),
                interestRate: Number(formData.interestRate),
                dueDate: formData.dueDate,
                chargeType: formData.chargeType,
                notes: formData.notes
            });

            if (response.data.success) {
                setSuccess(true);
                addToast('Solicitação enviada com sucesso!', 'success');
            } else {
                throw new Error('Falha ao enviar');
            }
        } catch (error: any) {
            console.error(error);
            addToast(error.response?.data?.error || 'Erro ao enviar. Tente novamente.', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Tela de sucesso
    if (success) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center px-4">
                <div className="max-w-md w-full text-center">
                    <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                        <CheckCircle size={48} className="text-emerald-400" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-4">
                        Solicitação Enviada!
                    </h1>
                    <p className="text-zinc-400 mb-8">
                        Recebemos sua solicitação de migração de contrato. Nossa equipe irá validar os dados e entrar em contato em breve.
                    </p>
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 mb-8">
                        <div className="flex items-center gap-3 text-left mb-4">
                            <Clock size={24} className="text-[#D4AF37]" />
                            <div>
                                <div className="font-bold text-white">Status: Pendente Validação</div>
                                <div className="text-sm text-zinc-400">Aguardando análise manual</div>
                            </div>
                        </div>
                        <div className="text-sm text-zinc-500 bg-black/30 rounded-lg p-4">
                            <p className="mb-2">📋 Próximos passos:</p>
                            <ul className="list-disc list-inside space-y-1">
                                <li>Nossa equipe irá validar seus dados cadastrais</li>
                                <li>Verificaremos as informações do contrato atual</li>
                                <li>Você receberá uma notificação quando o contrato for ativado</li>
                            </ul>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate('/client/dashboard')}
                        className="w-full bg-[#D4AF37] hover:bg-[#b5952f] text-black font-bold py-4 rounded-xl transition-colors"
                    >
                        Voltar ao início
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Background */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-900/15 rounded-full blur-[128px]" />
                <div className="absolute bottom-[20%] right-[-10%] w-[400px] h-[400px] bg-[#D4AF37]/10 rounded-full blur-[128px]" />
            </div>

            {/* Header */}
            <header className="relative z-10 border-b border-zinc-800 bg-black/80 backdrop-blur-md">
                <div className="container mx-auto px-6 h-20 flex items-center justify-between">
                    <button
                        onClick={() => navigate('/client/welcome')}
                        className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={20} />
                        Voltar
                    </button>
                    <Logo size="sm" />
                    <div className="w-20" />
                </div>
            </header>

            {/* Form */}
            <main className="relative z-10 container mx-auto px-4 py-8 max-w-lg">
                {/* Title */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <UserCheck size={32} className="text-emerald-400" />
                    </div>
                    <h1 className="text-2xl font-bold mb-2">Bem-vindo de volta!</h1>
                    <p className="text-zinc-400">Preencha seus dados para renovar seu empréstimo</p>
                </div>

                {/* Badge */}
                <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-2xl p-4 mb-8 flex items-center gap-3">
                    <Sparkles size={20} className="text-emerald-400" />
                    <div>
                        <div className="font-bold text-emerald-400">Processo Simplificado</div>
                        <div className="text-sm text-zinc-400">Sem necessidade de enviar documentos novamente</div>
                    </div>
                </div>

                {/* Form Card */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 space-y-5">
                    {/* Etapa 1: Atualização Cadastral */}
                    <div className="mb-6">
                        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                            <User size={18} className="text-emerald-400" />
                            Etapa 1: Atualização Cadastral
                        </h3>

                        <div className="space-y-4">
                            <Input
                                label="Nome Completo"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="Seu nome completo"
                                icon={<User size={18} />}
                                required
                            />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input
                                    label="CPF"
                                    name="cpf"
                                    value={formData.cpf}
                                    onChange={handleChange}
                                    placeholder="000.000.000-00"
                                    icon={<Shield size={18} />}
                                    mask={masks.cpf}
                                    required
                                />
                                <Input
                                    label="RG"
                                    name="rg"
                                    value={formData.rg}
                                    onChange={handleChange}
                                    placeholder="00.000.000-0"
                                    icon={<Shield size={18} />}
                                />
                            </div>

                            <Input
                                label="Data de Nascimento"
                                name="birthDate"
                                value={formData.birthDate}
                                onChange={handleChange}
                                placeholder="DD/MM/AAAA"
                                icon={<Calendar size={18} />}
                                mask={masks.date}
                            />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input
                                    label="Telefone/WhatsApp"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    placeholder="(00) 00000-0000"
                                    icon={<Phone size={18} />}
                                    mask={masks.phone}
                                    required
                                />
                                <Input
                                    label="E-mail"
                                    name="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="seu@email.com"
                                    icon={<Mail size={18} />}
                                    required
                                />
                            </div>

                            <Input
                                label="Endereço"
                                name="address"
                                value={formData.address}
                                onChange={handleChange}
                                placeholder="Rua, número, complemento"
                            />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input
                                    label="Bairro"
                                    name="neighborhood"
                                    value={formData.neighborhood}
                                    onChange={handleChange}
                                    placeholder="Seu bairro"
                                />
                                <Input
                                    label="Cidade"
                                    name="city"
                                    value={formData.city}
                                    onChange={handleChange}
                                    placeholder="Sua cidade"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input
                                    label="Estado"
                                    name="state"
                                    value={formData.state}
                                    onChange={handleChange}
                                    placeholder="UF"
                                />
                                <Input
                                    label="CEP"
                                    name="zipCode"
                                    value={formData.zipCode}
                                    onChange={handleChange}
                                    placeholder="00000-000"
                                />
                            </div>

                            {/* Upload de Comprovante de Residência */}
                            <div className="space-y-2">
                                <label className="text-sm text-zinc-400 font-medium flex items-center gap-1">
                                    Comprovante de Residência
                                    <span className="text-red-500">*</span>
                                </label>
                                <PaymentReceiptUpload
                                    onUpload={(url) => setFormData(prev => ({ ...prev, proofOfResidenceUrl: url }))}
                                    receiptUrl={formData.proofOfResidenceUrl}
                                    onRemove={() => setFormData(prev => ({ ...prev, proofOfResidenceUrl: '' }))}
                                />
                                {formData.proofOfResidenceUrl && (
                                    <div className="flex items-center gap-2 text-sm text-emerald-400">
                                        <CheckCircle size={16} />
                                        Comprovante enviado
                                    </div>
                                )}
                            </div>

                            {/* Upload de Selfie */}
                            <div className="space-y-2">
                                <label className="text-sm text-zinc-400 font-medium flex items-center gap-1">
                                    Selfie para Validação
                                    <span className="text-red-500">*</span>
                                </label>
                                <PaymentReceiptUpload
                                    onUpload={(url) => setFormData(prev => ({ ...prev, selfieUrl: url }))}
                                    receiptUrl={formData.selfieUrl}
                                    onRemove={() => setFormData(prev => ({ ...prev, selfieUrl: '' }))}
                                />
                                {formData.selfieUrl && (
                                    <div className="flex items-center gap-2 text-sm text-emerald-400">
                                        <CheckCircle size={16} />
                                        Selfie enviada
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Etapa 2: Dados do Contrato Atual */}
                    <div className="pt-6 border-t border-zinc-800">
                        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                            <DollarSign size={18} className="text-[#D4AF37]" />
                            Etapa 2: Dados do Contrato Atual
                        </h3>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm text-zinc-400 font-medium">
                                    Valor do Empréstimo <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">R$</span>
                                    <input
                                        type="number"
                                        name="loanAmount"
                                        value={formData.loanAmount}
                                        onChange={handleChange}
                                        placeholder="0,00"
                                        className="w-full bg-black border border-zinc-700 rounded-xl pl-12 pr-4 py-4 text-white text-xl font-bold focus:border-emerald-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm text-zinc-400 font-medium">
                                        Taxa de Juros (%) <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        name="interestRate"
                                        value={formData.interestRate}
                                        onChange={handleChange}
                                        placeholder="10.00"
                                        className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-4 text-white focus:border-emerald-500 outline-none"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm text-zinc-400 font-medium">
                                        Data de Vencimento <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        name="dueDate"
                                        value={formData.dueDate}
                                        onChange={handleChange}
                                        className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-4 text-white focus:border-emerald-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm text-zinc-400 font-medium">
                                    Tipo de Cobrança <span className="text-red-500">*</span>
                                </label>
                                <select
                                    name="chargeType"
                                    value={formData.chargeType}
                                    onChange={handleChange}
                                    className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-4 text-white focus:border-emerald-500 outline-none"
                                >
                                    <option value="MENSAL">Mensal</option>
                                    <option value="DIARIA">Diária</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm text-zinc-400 font-medium">
                                    Observações (opcional)
                                </label>
                                <textarea
                                    name="notes"
                                    value={formData.notes}
                                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                    placeholder="Informações adicionais sobre o contrato..."
                                    className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-4 text-white focus:border-emerald-500 outline-none resize-none"
                                    rows={3}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 mt-6"
                    >
                        {loading ? (
                            <>
                                <Loader2 size={20} className="animate-spin" />
                                Enviando...
                            </>
                        ) : (
                            <>
                                <Send size={20} />
                                Enviar Solicitação
                            </>
                        )}
                    </button>

                    <p className="text-center text-xs text-zinc-500 mt-4">
                        Ao enviar, você concorda com nossos termos de uso e política de privacidade.
                    </p>
                </div>
            </main>
        </div>
    );
};
