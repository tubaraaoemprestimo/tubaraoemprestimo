import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCheck, UserPlus, ArrowRight, Shield, Clock, Sparkles } from 'lucide-react';
import { Logo } from '../../components/Logo';

export const ClientWelcome: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-black text-white flex flex-col">
            {/* Background Gradient */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#D4AF37]/10 rounded-full blur-[128px]" />
                <div className="absolute bottom-[20%] right-[-10%] w-[400px] h-[400px] bg-emerald-900/10 rounded-full blur-[128px]" />
            </div>

            {/* Header */}
            <header className="relative z-10 border-b border-zinc-800 bg-black/80 backdrop-blur-md">
                <div className="container mx-auto px-6 h-20 flex items-center justify-center">
                    <Logo size="md" />
                </div>
            </header>

            {/* Content */}
            <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
                <div className="max-w-2xl w-full">
                    {/* Title */}
                    <div className="text-center mb-12">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-[#D4AF37] text-sm font-bold mb-6">
                            <Sparkles size={16} />
                            Bem-vindo(a)!
                        </div>
                        <h1 className="text-3xl md:text-4xl font-bold mb-4">
                            Como podemos te ajudar?
                        </h1>
                        <p className="text-zinc-400 text-lg">
                            Escolha uma opção para continuar
                        </p>
                    </div>

                    {/* Options */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Já sou cliente */}
                        <button
                            onClick={() => navigate('/client/returning')}
                            className="group relative bg-gradient-to-br from-emerald-900/30 to-emerald-900/10 border-2 border-emerald-500/50 hover:border-emerald-400 rounded-3xl p-8 text-left transition-all hover:scale-[1.02] hover:shadow-2xl hover:shadow-emerald-500/10"
                        >
                            <div className="absolute top-4 right-4 bg-emerald-500/20 text-emerald-400 text-xs px-3 py-1 rounded-full font-bold">
                                RÁPIDO
                            </div>
                            <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <UserCheck size={32} className="text-emerald-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-3">
                                Já sou cliente
                            </h2>
                            <p className="text-zinc-400 mb-6">
                                Já fiz empréstimo antes e quero renovar ou solicitar um novo.
                            </p>
                            <div className="flex items-center gap-2 text-emerald-400 font-bold">
                                <Clock size={16} />
                                <span>Formulário simplificado</span>
                            </div>
                            <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                                <ArrowRight size={24} className="text-emerald-400" />
                            </div>
                        </button>

                        {/* Sou cliente novo */}
                        <button
                            onClick={() => navigate('/client/wizard')}
                            className="group relative bg-gradient-to-br from-[#D4AF37]/20 to-[#D4AF37]/5 border-2 border-[#D4AF37]/50 hover:border-[#D4AF37] rounded-3xl p-8 text-left transition-all hover:scale-[1.02] hover:shadow-2xl hover:shadow-[#D4AF37]/10"
                        >
                            <div className="absolute top-4 right-4 bg-[#D4AF37]/20 text-[#D4AF37] text-xs px-3 py-1 rounded-full font-bold">
                                COMPLETO
                            </div>
                            <div className="w-16 h-16 bg-[#D4AF37]/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <UserPlus size={32} className="text-[#D4AF37]" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-3">
                                Sou cliente novo
                            </h2>
                            <p className="text-zinc-400 mb-6">
                                Primeiro empréstimo aqui. Vou enviar meus documentos para análise.
                            </p>
                            <div className="flex items-center gap-2 text-[#D4AF37] font-bold">
                                <Shield size={16} />
                                <span>Análise completa</span>
                            </div>
                            <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                                <ArrowRight size={24} className="text-[#D4AF37]" />
                            </div>
                        </button>
                    </div>

                    {/* Login link */}
                    <div className="text-center mt-8">
                        <p className="text-zinc-500">
                            Já tem cadastro?{' '}
                            <button
                                onClick={() => navigate('/login')}
                                className="text-[#D4AF37] hover:underline font-bold"
                            >
                                Fazer login
                            </button>
                        </p>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="relative z-10 border-t border-zinc-800 py-6">
                <div className="container mx-auto px-6 text-center text-zinc-500 text-sm">
                    © 2026 Tubarão Empréstimos. Todos os direitos reservados.
                </div>
            </footer>
        </div>
    );
};
