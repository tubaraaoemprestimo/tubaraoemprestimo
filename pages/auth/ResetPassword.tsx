/**
 * 🔑 Página de Redefinir Senha
 * O usuário chega aqui pelo link do email de recuperação.
 * Captura o token da URL e permite definir nova senha.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, ShieldCheck, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '../../components/Button';
import { api } from '../../services/apiClient';
import { useToast } from '../../components/Toast';

const ResetPassword: React.FC = () => {
    const navigate = useNavigate();
    const { addToast } = useToast();

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');
    const [sessionReady, setSessionReady] = useState(false);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        // Supabase detecta o token na URL automaticamente via detectSessionInUrl
        // Precisamos aguardar a sessão ser restaurada
        const checkSession = async () => {
            setChecking(true);

            // Ouvir evento de PASSWORD_RECOVERY
            const { data: { subscription } } = api.auth.onAuthStateChange((event, session) => {
                console.log('[ResetPassword] Auth event:', event);
                if (event === 'PASSWORD_RECOVERY') {
                    setSessionReady(true);
                    setChecking(false);
                } else if (event === 'SIGNED_IN' && session) {
                    // Pode chegar como SIGNED_IN com token de recovery
                    setSessionReady(true);
                    setChecking(false);
                }
            });

            // Verificar se já tem sessão ativa (caso o evento já tenha disparado)
            const { data: { session } } = await api.auth.getSession();
            if (session) {
                setSessionReady(true);
            }

            // Timeout de segurança
            setTimeout(() => {
                setChecking(false);
            }, 5000);

            return () => subscription.unsubscribe();
        };

        checkSession();
    }, []);

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword.length < 6) {
            setError('A senha deve ter pelo menos 6 caracteres.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('As senhas não conferem.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const { error: updateError } = await api.auth.updateUser({
                password: newPassword
            });

            if (updateError) {
                console.error('Reset error:', updateError);
                setError(updateError.message || 'Erro ao redefinir senha. Tente novamente.');
                return;
            }

            setSuccess(true);
            addToast('Senha redefinida com sucesso!', 'success');

            // Fazer logout para limpar sessão de recovery
            await api.auth.signOut();
        } catch (err: any) {
            setError('Erro ao redefinir senha. Tente solicitar um novo link.');
        } finally {
            setLoading(false);
        }
    };

    // Tela de sucesso
    if (success) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <div className="w-full max-w-md text-center">
                    <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-[0_0_60px_rgba(34,197,94,0.3)]">
                        <CheckCircle2 size={48} className="text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-3">Senha Redefinida!</h1>
                    <p className="text-zinc-400 mb-8">
                        Sua senha foi alterada com sucesso. Faça login com a nova senha.
                    </p>
                    <Button
                        onClick={() => navigate('/login')}
                        className="w-full bg-[#D4AF37] text-black py-3 text-lg font-bold"
                    >
                        <ArrowRight size={20} className="mr-2" /> Ir para Login
                    </Button>
                </div>
            </div>
        );
    }

    // Verificando token
    if (checking) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <div className="text-center">
                    <Loader2 size={40} className="text-[#D4AF37] animate-spin mx-auto mb-4" />
                    <p className="text-zinc-400">Verificando link de recuperação...</p>
                </div>
            </div>
        );
    }

    // Token inválido ou expirado
    if (!sessionReady) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <div className="w-full max-w-md text-center">
                    <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-red-500 to-red-700 rounded-full flex items-center justify-center shadow-[0_0_60px_rgba(239,68,68,0.3)]">
                        <AlertCircle size={48} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-3">Link Expirado</h1>
                    <p className="text-zinc-400 mb-6">
                        Este link de recuperação já expirou ou é inválido.
                        Solicite um novo link na tela de login.
                    </p>
                    <Button
                        onClick={() => navigate('/login')}
                        className="w-full bg-[#D4AF37] text-black py-3"
                    >
                        Voltar ao Login
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-[#D4AF37] to-[#B8860B] rounded-2xl flex items-center justify-center shadow-[0_0_40px_rgba(212,175,55,0.3)]">
                        <ShieldCheck size={36} className="text-black" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-1">Nova Senha</h1>
                    <p className="text-zinc-400 text-sm">Defina sua nova senha de acesso</p>
                </div>

                {/* Formulário */}
                <form onSubmit={handleResetPassword} className="space-y-4">
                    {/* Nova Senha */}
                    <div>
                        <label className="block text-sm font-bold text-zinc-400 mb-1">Nova Senha *</label>
                        <div className="relative">
                            <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={newPassword}
                                onChange={e => { setNewPassword(e.target.value); setError(''); }}
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
                    </div>

                    {/* Confirmar Senha */}
                    <div>
                        <label className="block text-sm font-bold text-zinc-400 mb-1">Confirmar Nova Senha *</label>
                        <div className="relative">
                            <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
                                placeholder="Repita a nova senha"
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-zinc-600 focus:border-[#D4AF37] outline-none transition-all"
                            />
                        </div>
                    </div>

                    {/* Erro */}
                    {error && (
                        <div className="flex items-center gap-2 text-red-500 text-sm bg-red-900/10 p-3 rounded-lg border border-red-900/50">
                            <AlertCircle size={16} /> {error}
                        </div>
                    )}

                    {/* Botão */}
                    <Button
                        type="submit"
                        isLoading={loading}
                        className="w-full bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black py-3 text-lg font-bold"
                    >
                        {loading ? (
                            <><Loader2 size={20} className="animate-spin mr-2" /> Salvando...</>
                        ) : (
                            <><Lock size={20} className="mr-2" /> Redefinir Senha</>
                        )}
                    </Button>
                </form>

                <div className="mt-6 p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
                    <p className="text-zinc-500 text-xs text-center">
                        🔒 Sua nova senha será criptografada. Não compartilhe com ninguém.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;
