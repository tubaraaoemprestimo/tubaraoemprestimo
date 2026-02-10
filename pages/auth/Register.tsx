/**
 * 📝 Página de Registro
 * O cliente precisa criar uma conta antes de solicitar qualquer serviço.
 * Após o registro, um email de confirmação é enviado.
 */
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Mail, Lock, ArrowRight, ShieldCheck, Eye, EyeOff, Loader2, CheckCircle2, Phone } from 'lucide-react';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { supabaseService } from '../../services/supabaseService';
import { useToast } from '../../components/Toast';
import { UserRole } from '../../types';

const Register: React.FC = () => {
    const navigate = useNavigate();
    const { addToast } = useToast();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [registered, setRegistered] = useState(false);

    const formatPhone = (value: string) => {
        const digits = value.replace(/\D/g, '');
        if (digits.length <= 2) return `(${digits}`;
        if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim()) {
            addToast('Informe seu nome completo.', 'warning');
            return;
        }

        if (!email.trim() || !email.includes('@')) {
            addToast('Informe um email válido.', 'warning');
            return;
        }

        if (!phone || phone.replace(/\D/g, '').length < 10) {
            addToast('Informe seu WhatsApp.', 'warning');
            return;
        }

        if (password.length < 6) {
            addToast('A senha deve ter pelo menos 6 caracteres.', 'warning');
            return;
        }

        if (password !== confirmPassword) {
            addToast('As senhas não conferem.', 'warning');
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabaseService.auth.signUp(email, password, name, UserRole.CLIENT);

            if (error) {
                const errMsg = (error as any)?.message || '';
                if (errMsg.includes('already registered') || errMsg.includes('already exists')) {
                    addToast('Este email já está cadastrado. Faça login.', 'error');
                } else {
                    addToast(`Erro ao cadastrar: ${errMsg}`, 'error');
                }
                return;
            }

            // Salvar telefone do usuário
            if (data?.user) {
                await supabaseService.updateUser(data.user.id, { phone: phone.replace(/\D/g, '') });
            }

            setRegistered(true);
            addToast('Cadastro realizado! Verifique seu email para confirmar.', 'success');
        } catch (error: any) {
            addToast('Erro ao criar conta. Tente novamente.', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Tela de sucesso - aguardando confirmação de email
    if (registered) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <div className="w-full max-w-md text-center">
                    <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-[0_0_60px_rgba(34,197,94,0.3)]">
                        <CheckCircle2 size={48} className="text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-3">Cadastro Realizado!</h1>
                    <p className="text-zinc-400 mb-6 leading-relaxed">
                        Enviamos um email de confirmação para <strong className="text-[#D4AF37]">{email}</strong>.
                        Clique no link do email para ativar sua conta e poder solicitar serviços.
                    </p>

                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-6">
                        <div className="flex items-start gap-3 text-left">
                            <Mail size={24} className="text-[#D4AF37] flex-shrink-0 mt-1" />
                            <div>
                                <h3 className="text-white font-bold mb-1">Verifique seu email</h3>
                                <ul className="text-zinc-400 text-sm space-y-1">
                                    <li>1. Abra seu email ({email})</li>
                                    <li>2. Procure o email da Tubarão Empréstimos</li>
                                    <li>3. Clique no link de confirmação</li>
                                    <li>4. Volte aqui e faça login</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <Button
                            onClick={() => navigate('/login')}
                            className="w-full bg-[#D4AF37] text-black"
                        >
                            <ArrowRight size={18} className="mr-2" /> Ir para Login
                        </Button>

                        <button
                            onClick={() => {
                                setRegistered(false);
                                setPassword('');
                                setConfirmPassword('');
                            }}
                            className="text-zinc-500 text-sm hover:text-zinc-300"
                        >
                            Tentar com outro email
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-[#D4AF37] to-[#B8860B] rounded-2xl flex items-center justify-center shadow-[0_0_40px_rgba(212,175,55,0.3)]">
                        <ShieldCheck size={36} className="text-black" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-1">Criar Conta</h1>
                    <p className="text-zinc-400 text-sm">Cadastre-se para solicitar empréstimos e serviços</p>
                </div>

                {/* Formulário */}
                <form onSubmit={handleRegister} className="space-y-4">
                    {/* Nome */}
                    <div>
                        <label className="block text-sm font-bold text-zinc-400 mb-1">Nome Completo *</label>
                        <div className="relative">
                            <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="Seu nome completo"
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-zinc-600 focus:border-[#D4AF37] outline-none transition-all"
                            />
                        </div>
                    </div>

                    {/* Email */}
                    <div>
                        <label className="block text-sm font-bold text-zinc-400 mb-1">Email *</label>
                        <div className="relative">
                            <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="seuemail@exemplo.com"
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-zinc-600 focus:border-[#D4AF37] outline-none transition-all"
                            />
                        </div>
                    </div>

                    {/* WhatsApp */}
                    <div>
                        <label className="block text-sm font-bold text-zinc-400 mb-1">WhatsApp *</label>
                        <div className="relative">
                            <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input
                                type="tel"
                                value={phone}
                                onChange={e => setPhone(formatPhone(e.target.value))}
                                placeholder="(00) 00000-0000"
                                maxLength={15}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-zinc-600 focus:border-[#D4AF37] outline-none transition-all"
                            />
                        </div>
                    </div>

                    {/* Senha */}
                    <div>
                        <label className="block text-sm font-bold text-zinc-400 mb-1">Senha *</label>
                        <div className="relative">
                            <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="Mínimo 6 caracteres"
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-10 pr-12 text-white placeholder:text-zinc-600 focus:border-[#D4AF37] outline-none transition-all"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                        {password.length > 0 && password.length < 6 && (
                            <p className="text-red-400 text-xs mt-1">Mínimo 6 caracteres</p>
                        )}
                    </div>

                    {/* Confirmar Senha */}
                    <div>
                        <label className="block text-sm font-bold text-zinc-400 mb-1">Confirmar Senha *</label>
                        <div className="relative">
                            <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                placeholder="Repita a senha"
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-zinc-600 focus:border-[#D4AF37] outline-none transition-all"
                            />
                        </div>
                        {confirmPassword.length > 0 && password !== confirmPassword && (
                            <p className="text-red-400 text-xs mt-1">As senhas não conferem</p>
                        )}
                    </div>

                    {/* Botão Registrar */}
                    <Button
                        type="submit"
                        isLoading={loading}
                        className="w-full bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black py-3 text-lg font-bold"
                    >
                        {loading ? (
                            <><Loader2 size={20} className="animate-spin mr-2" /> Criando conta...</>
                        ) : (
                            <><ArrowRight size={20} className="mr-2" /> Criar Minha Conta</>
                        )}
                    </Button>
                </form>

                {/* Link para Login */}
                <div className="mt-6 text-center">
                    <p className="text-zinc-500 text-sm">
                        Já tem conta?{' '}
                        <Link to="/login" className="text-[#D4AF37] font-bold hover:underline">
                            Fazer Login
                        </Link>
                    </p>
                </div>

                {/* Info de segurança */}
                <div className="mt-6 p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
                    <p className="text-zinc-500 text-xs text-center">
                        🔒 Seus dados são protegidos com criptografia. Ao criar sua conta, você concorda com nossos termos de uso.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Register;
