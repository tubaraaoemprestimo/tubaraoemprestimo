/**
 * 📝 Página de Registro
 * O cliente precisa criar uma conta antes de solicitar qualquer serviço.
 * Após o registro, um email de confirmação é enviado.
 */
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Mail, Lock, ArrowRight, ShieldCheck, Eye, EyeOff, Loader2, Phone } from 'lucide-react';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { apiService } from '../../services/apiService';
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
    const [referralCode, setReferralCode] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

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
            const cleanPhone = phone.replace(/\D/g, '');
            const { data, error } = await apiService.auth.signUp({
                email,
                password,
                name,
                phone: cleanPhone,
                referralCode
            });

            if (error) {
                const errObj = error as any;
                const errMsg = errObj?.error || errObj?.message || '';

                if (errMsg.includes('already') || errMsg.includes('exists') || errMsg.includes('cadastrado')) {
                    addToast('Este email já está cadastrado. Faça login.', 'error');
                } else {
                    addToast(errMsg ? `Erro ao cadastrar: ${errMsg}` : 'Erro ao cadastrar. Tente novamente.', 'error');
                }
                return;
            }

            // Login automatico apos cadastro - redireciona direto para o app
            addToast('Cadastro realizado com sucesso!', 'success');

            try {
                const loginResult = await apiService.auth.signIn({ identifier: email, password }) as any;
                if (loginResult.user) {
                    navigate('/client/dashboard');
                    return;
                }
            } catch {
                // Se auto-login falhar, vai para tela de login
            }

            // Fallback: redireciona para login
            navigate('/login');
        } catch (error: any) {
            addToast('Erro ao criar conta. Tente novamente.', 'error');
        } finally {
            setLoading(false);
        }
    };

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
                                autoComplete="name"
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
                                autoComplete="email"
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
                                autoComplete="tel"
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
                                autoComplete="new-password"
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
                                autoComplete="new-password"
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

                    {/* Código de Indicação (Opcional) */}
                    <div>
                        <label className="block text-sm font-bold text-zinc-400 mb-1">Código de Indicação (Opcional)</label>
                        <div className="relative">
                            <ShieldCheck size={18} className="text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                autoComplete="off"
                                value={referralCode}
                                onChange={e => setReferralCode(e.target.value.toUpperCase())}
                                placeholder="Código do amigo que te indicou"
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-zinc-600 focus:border-[#D4AF37] outline-none transition-all uppercase"
                            />
                        </div>
                        <p className="text-zinc-600 text-xs mt-1">Insira o código para ganhar benefícios exclusivos.</p>
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
