/**
 * 🚀 Sales Page - Landing Page Premium de Vendas
 * Página institucional para venda do sistema Tubarão Empréstimos
 * 
 * Estrutura:
 * 1. Hero com Headline forte + CTA
 * 2. Problema / dor do público
 * 3. Solução
 * 4. Diferenciais e antifraude
 * 5. Funcionalidades completas
 * 6. Para quem é / não é
 * 7. Como funciona
 * 8. Oferta com valor + relógio de urgência
 * 9. CTA final
 */
import React, { useState, useEffect, useRef } from 'react';
import {
    Shield, ArrowRight, CheckCircle2, X, ChevronDown, Zap, TrendingUp,
    Lock, Eye, Smartphone, Users, FileText, BarChart3, Bot, Bell,
    MapPin, Fingerprint, AlertTriangle, Clock, Phone, Star, Award,
    DollarSign, Target, Layers, Settings, MessageSquare, Globe, Cpu
} from 'lucide-react';

// ========= COUNTDOWN TIMER =========
const CountdownTimer: React.FC<{ targetDate: Date }> = ({ targetDate }) => {
    const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date().getTime();
            const distance = targetDate.getTime() - now;
            if (distance < 0) {
                // Reset para +3 dias quando expirar (sempre ativo)
                targetDate.setDate(targetDate.getDate() + 3);
                return;
            }
            setTimeLeft({
                days: Math.floor(distance / (1000 * 60 * 60 * 24)),
                hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
                seconds: Math.floor((distance % (1000 * 60)) / 1000)
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [targetDate]);

    return (
        <div className="flex gap-3 justify-center">
            {Object.entries(timeLeft).map(([key, val]) => (
                <div key={key} className="flex flex-col items-center">
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-b from-zinc-800 to-zinc-900 border border-[#D4AF37]/30 rounded-xl flex items-center justify-center shadow-lg">
                        <span className="text-2xl md:text-3xl font-black text-[#D4AF37] tabular-nums">{String(val).padStart(2, '0')}</span>
                    </div>
                    <span className="text-[10px] md:text-xs text-zinc-500 mt-1 uppercase tracking-wider">
                        {key === 'days' ? 'Dias' : key === 'hours' ? 'Horas' : key === 'minutes' ? 'Min' : 'Seg'}
                    </span>
                </div>
            ))}
        </div>
    );
};

// ========= ANIMATED SECTION (fade in on scroll) =========
const AnimatedSection: React.FC<{ children: React.ReactNode; className?: string; delay?: number }> = ({ children, className = '', delay = 0 }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => { if (entries[0].isIntersecting) setIsVisible(true); },
            { threshold: 0.1 }
        );
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, []);

    return (
        <div
            ref={ref}
            className={`transition-all duration-700 ease-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'} ${className}`}
            style={{ transitionDelay: `${delay}ms` }}
        >
            {children}
        </div>
    );
};

// ========= FEATURE CARD =========
const FeatureCard: React.FC<{ icon: React.ReactNode; title: string; desc: string }> = ({ icon, title, desc }) => (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 hover:border-[#D4AF37]/50 transition-all group">
        <div className="w-12 h-12 rounded-xl bg-[#D4AF37]/10 flex items-center justify-center text-[#D4AF37] mb-4 group-hover:scale-110 transition-transform">
            {icon}
        </div>
        <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
        <p className="text-zinc-400 text-sm leading-relaxed">{desc}</p>
    </div>
);

// ========= CTA WHATSAPP =========
const WHATSAPP_NUMBER = '5511987577050';
const WHATSAPP_MSG = encodeURIComponent('Olá! Vi a oferta do sistema Tubarão Empréstimo e quero saber mais sobre a plataforma. 🦈');
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MSG}`;

// ========= MAIN =========
export const SalesPage: React.FC = () => {
    const [showFloatingCTA, setShowFloatingCTA] = useState(false);
    const offerDate = useRef(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000));

    useEffect(() => {
        const handleScroll = () => setShowFloatingCTA(window.scrollY > 600);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToOffer = () => {
        document.getElementById('oferta')?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div className="min-h-screen bg-black text-white overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
            {/* GOOGLE FONT */}
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet" />

            {/* ===== HERO ===== */}
            <section className="relative min-h-screen flex items-center justify-center px-6 py-20 overflow-hidden">
                {/* BG Effects */}
                <div className="absolute inset-0 bg-gradient-to-b from-[#D4AF37]/5 via-transparent to-transparent" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-[#D4AF37]/5 blur-[200px]" />
                <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-red-600/5 blur-[150px]" />

                <div className="relative z-10 max-w-4xl mx-auto text-center">
                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-full px-4 py-2 mb-8">
                        <Zap size={14} className="text-[#D4AF37]" />
                        <span className="text-[#D4AF37] text-xs font-bold uppercase tracking-wider">Plataforma Completa para Empréstimos</span>
                    </div>

                    {/* Logo */}
                    <div className="mb-8">
                        <img src="/Logo.png" alt="Tubarão Empréstimo" className="h-20 md:h-28 mx-auto" />
                    </div>

                    {/* Headline */}
                    <h1 className="text-4xl md:text-6xl lg:text-7xl font-black leading-tight mb-6">
                        O Sistema <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] to-[#FDB931]">Mais Completo</span> para Gerenciar
                        <br className="hidden md:block" /> Empréstimos Pessoais
                    </h1>

                    <p className="text-lg md:text-xl text-zinc-400 leading-relaxed mb-10 max-w-2xl mx-auto">
                        Controle total, antifraude inteligente, cobrança automatizada e tudo que você precisa para
                        <strong className="text-white"> escalar seu negócio de crédito com segurança</strong>.
                    </p>

                    {/* CTA */}
                    <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
                        <a
                            href={WHATSAPP_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex items-center justify-center gap-3 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white px-8 py-4 rounded-2xl text-lg font-bold shadow-lg shadow-green-600/30 transition-all hover:scale-105 active:scale-95"
                        >
                            <Phone size={22} /> Quero Contratar
                            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </a>
                        <button
                            onClick={scrollToOffer}
                            className="flex items-center justify-center gap-2 bg-zinc-900 border border-zinc-700 hover:border-[#D4AF37]/50 text-white px-8 py-4 rounded-2xl text-lg font-bold transition-all"
                        >
                            Ver Oferta <ChevronDown size={18} />
                        </button>
                    </div>

                    {/* Trust Badges */}
                    <div className="flex flex-wrap items-center justify-center gap-6 text-zinc-500 text-xs">
                        <div className="flex items-center gap-2"><Shield size={14} className="text-[#D4AF37]" /> Antifraude Integrado</div>
                        <div className="flex items-center gap-2"><Lock size={14} className="text-[#D4AF37]" /> 100% Seguro</div>
                        <div className="flex items-center gap-2"><Smartphone size={14} className="text-[#D4AF37]" /> App PWA Mobile</div>
                        <div className="flex items-center gap-2"><Bot size={14} className="text-[#D4AF37]" /> IA Integrada</div>
                    </div>
                </div>

                {/* Scroll Indicator */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
                    <ChevronDown size={24} className="text-zinc-600" />
                </div>
            </section>

            {/* ===== PROBLEMA ===== */}
            <section className="px-6 py-20 md:py-28 bg-gradient-to-b from-black to-zinc-950">
                <div className="max-w-4xl mx-auto">
                    <AnimatedSection>
                        <div className="text-center mb-16">
                            <span className="text-red-500 text-sm font-bold uppercase tracking-widest block mb-4">O Problema</span>
                            <h2 className="text-3xl md:text-5xl font-black mb-6">
                                Você Ainda <span className="text-red-500">Perde Dinheiro</span> Gerenciando Empréstimos no Caderninho?
                            </h2>
                            <p className="text-zinc-400 text-lg max-w-2xl mx-auto leading-relaxed">
                                A maioria dos empreendedores de crédito pessoal enfrenta os mesmos problemas todo dia:
                            </p>
                        </div>
                    </AnimatedSection>

                    <div className="grid md:grid-cols-2 gap-6">
                        {[
                            { icon: <AlertTriangle size={20} />, title: 'Calotes e Fraudes', desc: 'Sem análise antifraude, você aprova clientes de alto risco e toma calote atrás de calote.' },
                            { icon: <Clock size={20} />, title: 'Tempo Perdido', desc: 'Horas calculando juros, cobrando manualmente, organizando papéis e planilhas desatualizadas.' },
                            { icon: <Eye size={20} />, title: 'Falta de Controle', desc: 'Não sabe quem pagou, quem deve, qual o total emprestado, qual seu lucro real.' },
                            { icon: <X size={20} />, title: 'Cobrança Ineficiente', desc: 'Cobra manualmente pelo WhatsApp, esquece datas, perde a paciência com inadimplentes.' },
                        ].map((item, i) => (
                            <AnimatedSection key={i} delay={i * 150}>
                                <div className="flex gap-4 p-6 bg-red-900/5 border border-red-900/20 rounded-2xl">
                                    <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 flex-shrink-0">
                                        {item.icon}
                                    </div>
                                    <div>
                                        <h3 className="text-white font-bold text-lg mb-1">{item.title}</h3>
                                        <p className="text-zinc-400 text-sm">{item.desc}</p>
                                    </div>
                                </div>
                            </AnimatedSection>
                        ))}
                    </div>
                </div>
            </section>

            {/* ===== SOLUÇÃO ===== */}
            <section className="px-6 py-20 md:py-28">
                <div className="max-w-4xl mx-auto text-center">
                    <AnimatedSection>
                        <span className="text-[#D4AF37] text-sm font-bold uppercase tracking-widest block mb-4">A Solução</span>
                        <h2 className="text-3xl md:text-5xl font-black mb-6">
                            Chegou o <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] to-[#FDB931]">Tubarão Empréstimo</span>
                        </h2>
                        <p className="text-zinc-400 text-lg max-w-2xl mx-auto mb-16 leading-relaxed">
                            Uma plataforma completa que centraliza <strong className="text-white">tudo que você precisa</strong> em um só lugar:
                            gestão de clientes, análise de risco, cobrança automática, painel financeiro e muito mais.
                        </p>
                    </AnimatedSection>

                    <div className="grid md:grid-cols-3 gap-6">
                        {[
                            { icon: <Shield size={24} />, title: 'Seguro', desc: 'Antifraude com verificação de identidade, geolocalização e análise de risco.' },
                            { icon: <Zap size={24} />, title: 'Rápido', desc: 'Solicitar e aprovar empréstimos em minutos. Tudo digital, sem papel.' },
                            { icon: <TrendingUp size={24} />, title: 'Lucrativo', desc: 'Relatórios financeiros, metas, projeções e controle total do faturamento.' },
                        ].map((item, i) => (
                            <AnimatedSection key={i} delay={i * 200}>
                                <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800 rounded-3xl p-8 hover:border-[#D4AF37]/50 transition-all">
                                    <div className="w-16 h-16 rounded-2xl bg-[#D4AF37]/10 flex items-center justify-center text-[#D4AF37] mx-auto mb-6">
                                        {item.icon}
                                    </div>
                                    <h3 className="text-white font-bold text-xl mb-3">{item.title}</h3>
                                    <p className="text-zinc-400 text-sm">{item.desc}</p>
                                </div>
                            </AnimatedSection>
                        ))}
                    </div>
                </div>
            </section>

            {/* ===== FUNCIONALIDADES ===== */}
            <section className="px-6 py-20 md:py-28 bg-gradient-to-b from-zinc-950 to-black">
                <div className="max-w-6xl mx-auto">
                    <AnimatedSection>
                        <div className="text-center mb-16">
                            <span className="text-[#D4AF37] text-sm font-bold uppercase tracking-widest block mb-4">Funcionalidades</span>
                            <h2 className="text-3xl md:text-5xl font-black mb-4">
                                Tudo que Você Precisa. <span className="text-[#D4AF37]">Em Um Só Lugar.</span>
                            </h2>
                        </div>
                    </AnimatedSection>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                        <AnimatedSection delay={0}><FeatureCard icon={<Users size={24} />} title="Gestão de Clientes" desc="Cadastro completo, histórico de empréstimos, score interno e controle de inadimplência." /></AnimatedSection>
                        <AnimatedSection delay={100}><FeatureCard icon={<FileText size={24} />} title="Solicitações Digitais" desc="Wizard inteligente com upload de documentos, selfie, vídeos e assinatura digital." /></AnimatedSection>
                        <AnimatedSection delay={200}><FeatureCard icon={<Shield size={24} />} title="Antifraude Completo" desc="Verificação de CPF, geolocalização, bloqueio de dispositivos, cooldown de 30 dias." /></AnimatedSection>
                        <AnimatedSection delay={300}><FeatureCard icon={<BarChart3 size={24} />} title="Painel Financeiro" desc="Dashboard com receitas, despesas, faturamento, metas e projeções de crescimento." /></AnimatedSection>
                        <AnimatedSection delay={400}><FeatureCard icon={<Bell size={24} />} title="Cobrança Automática" desc="Notificações programadas antes e depois do vencimento via WhatsApp e push." /></AnimatedSection>
                        <AnimatedSection delay={500}><FeatureCard icon={<Bot size={24} />} title="Chatbot com IA" desc="Atendimento inteligente via WhatsApp com Gemini AI integrado, 24h por dia." /></AnimatedSection>
                        <AnimatedSection delay={600}><FeatureCard icon={<MapPin size={24} />} title="Rastreamento" desc="Geolocalização em tempo real dos clientes para garantir cobrança efetiva." /></AnimatedSection>
                        <AnimatedSection delay={700}><FeatureCard icon={<Fingerprint size={24} />} title="Biometria e Selfie" desc="Validação facial com selfie segurando documento, vídeo de aceite e confirmação." /></AnimatedSection>
                        <AnimatedSection delay={800}><FeatureCard icon={<Smartphone size={24} />} title="App PWA Mobile" desc="Instala como aplicativo no celular do cliente. Push notifications, offline ready." /></AnimatedSection>
                        <AnimatedSection delay={900}><FeatureCard icon={<MessageSquare size={24} />} title="WhatsApp Integrado" desc="Envio de mensagens, cobranças e marketing direto pelo WhatsApp integrado." /></AnimatedSection>
                        <AnimatedSection delay={1000}><FeatureCard icon={<DollarSign size={24} />} title="Limpa Nome" desc="Serviço de análise de crédito integrado com contrato digital e assinatura." /></AnimatedSection>
                        <AnimatedSection delay={1100}><FeatureCard icon={<Settings size={24} />} title="100% Personalizável" desc="Logo, cores, textos, taxas, parcelas — tudo pode ser configurado conforme seu negócio." /></AnimatedSection>
                    </div>
                </div>
            </section>

            {/* ===== ANTIFRAUDE ===== */}
            <section className="px-6 py-20 md:py-28">
                <div className="max-w-4xl mx-auto">
                    <AnimatedSection>
                        <div className="text-center mb-16">
                            <span className="text-red-500 text-sm font-bold uppercase tracking-widest block mb-4">Segurança</span>
                            <h2 className="text-3xl md:text-5xl font-black mb-6">
                                Sistema <span className="text-red-500">Antifraude</span> de Nível Bancário
                            </h2>
                            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
                                Proteja seu capital com as mesmas tecnologias usadas por fintechs e bancos digitais.
                            </p>
                        </div>
                    </AnimatedSection>

                    <div className="grid md:grid-cols-2 gap-6">
                        {[
                            { icon: <MapPin size={20} />, title: 'Geolocalização Obrigatória', desc: 'Captura localização em tempo real. O cliente não avança sem permitir.' },
                            { icon: <Fingerprint size={20} />, title: 'Verificação Facial', desc: 'Selfie segurando RG/CNH + vídeo de confirmação. Impossível fraudar.' },
                            { icon: <Lock size={20} />, title: 'Bloqueio por Dispositivo', desc: 'Detecta e bloqueia dispositivos suspeitos. Admin controla tudo.' },
                            { icon: <Clock size={20} />, title: 'Cooldown de 30 Dias', desc: 'CPF reprovado fica bloqueado por 30 dias. Sem exceções.' },
                            { icon: <Eye size={20} />, title: 'Monitor em Tempo Real', desc: 'Dashboard antifraude com alertas, logs de risco e eventos suspeitos.' },
                            { icon: <Shield size={20} />, title: 'Blacklist de CPFs', desc: 'Lista negra com CPFs bloqueados permanentemente. Nunca mais cai em golpe.' },
                        ].map((item, i) => (
                            <AnimatedSection key={i} delay={i * 100}>
                                <div className="flex gap-4 p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:border-red-500/30 transition-all">
                                    <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 flex-shrink-0">
                                        {item.icon}
                                    </div>
                                    <div>
                                        <h3 className="text-white font-bold mb-1">{item.title}</h3>
                                        <p className="text-zinc-500 text-sm">{item.desc}</p>
                                    </div>
                                </div>
                            </AnimatedSection>
                        ))}
                    </div>
                </div>
            </section>

            {/* ===== PARA QUEM É ===== */}
            <section className="px-6 py-20 md:py-28 bg-gradient-to-b from-black to-zinc-950">
                <div className="max-w-4xl mx-auto">
                    <AnimatedSection>
                        <div className="text-center mb-16">
                            <h2 className="text-3xl md:text-5xl font-black mb-6">
                                Para Quem <span className="text-[#D4AF37]">É</span> e Para Quem <span className="text-red-500">Não É</span>
                            </h2>
                        </div>
                    </AnimatedSection>

                    <div className="grid md:grid-cols-2 gap-8">
                        <AnimatedSection delay={0}>
                            <div className="bg-green-900/10 border border-green-500/20 rounded-2xl p-8">
                                <h3 className="text-green-400 font-bold text-xl mb-6 flex items-center gap-2">
                                    <CheckCircle2 size={24} /> É Para Você Se:
                                </h3>
                                <div className="space-y-4">
                                    {[
                                        'Trabalha com empréstimo pessoal e quer profissionalizar',
                                        'Quer automatizar cobranças e reduzir inadimplência',
                                        'Precisa de antifraude para não tomar calote',
                                        'Quer ter controle financeiro total do seu negócio',
                                        'Deseja escalar e atender mais clientes com segurança',
                                        'Busca um sistema pronto, sem precisar contratar programador',
                                    ].map((item, i) => (
                                        <div key={i} className="flex gap-3 text-sm">
                                            <CheckCircle2 size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
                                            <span className="text-zinc-300">{item}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </AnimatedSection>

                        <AnimatedSection delay={200}>
                            <div className="bg-red-900/10 border border-red-500/20 rounded-2xl p-8">
                                <h3 className="text-red-400 font-bold text-xl mb-6 flex items-center gap-2">
                                    <X size={24} /> NÃO É Para Você Se:
                                </h3>
                                <div className="space-y-4">
                                    {[
                                        'Quer ferramentas gratuitas e não pretende investir',
                                        'Não trabalha com crédito pessoal ou empréstimos',
                                        'Prefere usar caderninho e planilhas pra sempre',
                                        'Não está disposto a usar tecnologia no seu negócio',
                                        'Procura um sistema bancário regulado pelo Bacen',
                                    ].map((item, i) => (
                                        <div key={i} className="flex gap-3 text-sm">
                                            <X size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                                            <span className="text-zinc-300">{item}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </AnimatedSection>
                    </div>
                </div>
            </section>

            {/* ===== COMO FUNCIONA ===== */}
            <section className="px-6 py-20 md:py-28">
                <div className="max-w-4xl mx-auto">
                    <AnimatedSection>
                        <div className="text-center mb-16">
                            <span className="text-[#D4AF37] text-sm font-bold uppercase tracking-widest block mb-4">Processo</span>
                            <h2 className="text-3xl md:text-5xl font-black">
                                Como <span className="text-[#D4AF37]">Funciona</span>
                            </h2>
                        </div>
                    </AnimatedSection>

                    <div className="space-y-8">
                        {[
                            { step: '01', title: 'Fechamento e Personalização', desc: 'Após a contratação, personalizamos o sistema com sua marca, logo, cores e configurações de taxa e prazos.', icon: <Settings size={28} /> },
                            { step: '02', title: 'Deploy na Nuvem', desc: 'Publicamos seu sistema em um domínio próprio, pronto para uso. O app PWA fica disponível para instalação no celular.', icon: <Globe size={28} /> },
                            { step: '03', title: 'Treinamento', desc: 'Receba um treinamento completo de como usar todas as funcionalidades: cadastro, aprovação, cobrança e antifraude.', icon: <Target size={28} /> },
                            { step: '04', title: 'Operação e Suporte', desc: 'Comece a operar! Conte com suporte técnico dedicado para dúvidas e atualizações do sistema.', icon: <Cpu size={28} /> },
                        ].map((item, i) => (
                            <AnimatedSection key={i} delay={i * 150}>
                                <div className="flex gap-6 items-start">
                                    <div className="flex-shrink-0">
                                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#D4AF37] to-[#B8860B] flex items-center justify-center text-black shadow-lg shadow-[#D4AF37]/20">
                                            {item.icon}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-[#D4AF37] text-sm font-black">PASSO {item.step}</span>
                                        </div>
                                        <h3 className="text-white font-bold text-xl mb-1">{item.title}</h3>
                                        <p className="text-zinc-400 text-sm leading-relaxed">{item.desc}</p>
                                    </div>
                                </div>
                            </AnimatedSection>
                        ))}
                    </div>
                </div>
            </section>

            {/* ===== OFERTA ===== */}
            <section id="oferta" className="px-6 py-20 md:py-28 bg-gradient-to-b from-zinc-950 to-black">
                <div className="max-w-3xl mx-auto">
                    <AnimatedSection>
                        <div className="relative bg-gradient-to-b from-zinc-900 to-zinc-950 border-2 border-[#D4AF37]/50 rounded-3xl p-8 md:p-12 text-center overflow-hidden shadow-2xl shadow-[#D4AF37]/10">
                            {/* Glow */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-[#D4AF37]/10 blur-[100px]" />

                            <div className="relative z-10">
                                {/* Badge */}
                                <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-full px-4 py-1 mb-6">
                                    <Clock size={14} className="text-red-400" />
                                    <span className="text-red-400 text-xs font-bold uppercase tracking-wider">Oferta por Tempo Limitado</span>
                                </div>

                                <h2 className="text-3xl md:text-4xl font-black mb-3">
                                    Leve o Sistema <span className="text-[#D4AF37]">Completo</span>
                                </h2>

                                <p className="text-zinc-400 mb-8 max-w-lg mx-auto">
                                    Com todas as funcionalidades, antifraude, IA, cobrança automática,
                                    app mobile e suporte dedicado.
                                </p>

                                {/* Countdown */}
                                <div className="mb-8">
                                    <p className="text-zinc-500 text-sm mb-4 uppercase tracking-wider">Essa oferta expira em:</p>
                                    <CountdownTimer targetDate={offerDate.current} />
                                </div>

                                {/* Preço */}
                                <div className="mb-8">
                                    <p className="text-zinc-500 text-sm line-through mb-1">De R$ 4.997,00</p>
                                    <div className="flex items-center justify-center gap-2">
                                        <span className="text-zinc-500 text-2xl">Por apenas</span>
                                    </div>
                                    <div className="text-6xl md:text-7xl font-black text-[#D4AF37] my-2">
                                        R$ 2.497
                                    </div>
                                    <p className="text-zinc-400 text-sm">
                                        ou <strong className="text-white">12x de R$ 249,70</strong> no cartão
                                    </p>
                                </div>

                                {/* What's Included */}
                                <div className="text-left max-w-sm mx-auto mb-8 space-y-3">
                                    {[
                                        'Sistema completo com todas as funcionalidades',
                                        'Deploy em domínio próprio',
                                        'App PWA para clientes',
                                        'Antifraude inteligente',
                                        'Chatbot IA WhatsApp',
                                        'Cobrança automática',
                                        'Treinamento completo',
                                        'Suporte por 90 dias',
                                        'Atualizações inclusas',
                                    ].map((item, i) => (
                                        <div key={i} className="flex items-center gap-3">
                                            <CheckCircle2 size={16} className="text-[#D4AF37] flex-shrink-0" />
                                            <span className="text-zinc-300 text-sm">{item}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* CTA */}
                                <a
                                    href={WHATSAPP_URL}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group inline-flex items-center justify-center gap-3 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white px-10 py-5 rounded-2xl text-xl font-black shadow-lg shadow-green-600/30 transition-all hover:scale-105 active:scale-95 w-full"
                                >
                                    <Phone size={24} /> QUERO CONTRATAR AGORA
                                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                </a>

                                <p className="text-zinc-600 text-xs mt-4">
                                    💬 Ao clicar, você será redirecionado para o WhatsApp para finalizar a contratação.
                                </p>
                            </div>
                        </div>
                    </AnimatedSection>
                </div>
            </section>

            {/* ===== DEPOIMENTOS ===== */}
            <section className="px-6 py-20 md:py-28">
                <div className="max-w-4xl mx-auto text-center">
                    <AnimatedSection>
                        <span className="text-[#D4AF37] text-sm font-bold uppercase tracking-widest block mb-4">Resultados</span>
                        <h2 className="text-3xl md:text-4xl font-black mb-12">
                            Quem Usa, <span className="text-[#D4AF37]">Recomenda</span>
                        </h2>
                    </AnimatedSection>

                    <div className="grid md:grid-cols-3 gap-6">
                        {[
                            { name: 'Ricardo S.', city: 'São Paulo - SP', text: 'Reduzi 80% dos calotes depois que comecei a usar o antifraude. O sistema se paga no primeiro mês.' },
                            { name: 'Ana Paula M.', city: 'Rio de Janeiro - RJ', text: 'A cobrança automática mudou minha vida. Não preciso mais ficar mandando mensagem um por um.' },
                            { name: 'Carlos E.', city: 'Belo Horizonte - MG', text: 'Profissionalizou meu negócio. Meus clientes ficam impressionados com o app e a organização.' },
                        ].map((item, i) => (
                            <AnimatedSection key={i} delay={i * 200}>
                                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-left">
                                    <div className="flex gap-1 mb-3">
                                        {[1, 2, 3, 4, 5].map(s => <Star key={s} size={14} className="text-[#D4AF37] fill-[#D4AF37]" />)}
                                    </div>
                                    <p className="text-zinc-300 text-sm mb-4 italic">"{item.text}"</p>
                                    <div>
                                        <p className="text-white font-bold text-sm">{item.name}</p>
                                        <p className="text-zinc-500 text-xs">{item.city}</p>
                                    </div>
                                </div>
                            </AnimatedSection>
                        ))}
                    </div>
                </div>
            </section>

            {/* ===== CTA FINAL ===== */}
            <section className="px-6 py-20 md:py-28 bg-gradient-to-b from-black via-[#D4AF37]/5 to-black">
                <div className="max-w-3xl mx-auto text-center">
                    <AnimatedSection>
                        <h2 className="text-3xl md:text-5xl font-black mb-6">
                            Pronto Para <span className="text-[#D4AF37]">Transformar</span> Seu Negócio?
                        </h2>
                        <p className="text-zinc-400 text-lg mb-10 max-w-xl mx-auto">
                            Não fique para trás usando caderninho enquanto seus concorrentes já estão usando tecnologia.
                            Entre em contato agora e comece a lucrar mais com segurança.
                        </p>

                        <a
                            href={WHATSAPP_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group inline-flex items-center justify-center gap-3 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white px-10 py-5 rounded-2xl text-xl font-black shadow-lg shadow-green-600/30 transition-all hover:scale-105 active:scale-95"
                        >
                            <Phone size={24} /> FALAR COM CONSULTOR
                            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                        </a>

                        <p className="text-zinc-600 text-sm mt-6">
                            Atendimento 100% humanizado via WhatsApp
                        </p>
                    </AnimatedSection>
                </div>
            </section>

            {/* ===== FOOTER ===== */}
            <footer className="border-t border-zinc-900 px-6 py-10">
                <div className="max-w-4xl mx-auto text-center">
                    <img src="/Logo.png" alt="Tubarão Empréstimo" className="h-12 mx-auto mb-4" />
                    <p className="text-zinc-600 text-xs mb-2">
                        Tubarão Empréstimo — Sistema de Gestão de Crédito Pessoal
                    </p>
                    <p className="text-zinc-700 text-xs">
                        © {new Date().getFullYear()} Todos os direitos reservados. Este site não é um banco ou instituição financeira regulada pelo Banco Central.
                    </p>
                </div>
            </footer>

            {/* ===== FLOATING CTA (Mobile) ===== */}
            <div className={`fixed bottom-0 left-0 right-0 z-50 p-4 bg-gradient-to-t from-black via-black/95 to-transparent transition-all duration-500 ${showFloatingCTA ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}>
                <a
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-3 w-full bg-gradient-to-r from-green-600 to-green-500 text-white py-4 rounded-xl text-base font-black shadow-lg shadow-green-600/30"
                >
                    <Phone size={20} /> QUERO CONTRATAR AGORA
                </a>
            </div>
        </div>
    );
};

export default SalesPage;
