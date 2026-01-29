import React from 'react';
import { Link } from 'react-router-dom';
import {
    ShieldCheck, Smartphone, Zap, Bot, Lock, CreditCard,
    ArrowRight, CheckCircle2, ChevronRight, Menu, X, Star,
    Globe, LayoutDashboard, Clock, FileCheck, Briefcase, Store, Car, CheckSquare, UploadCloud, Banknote
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../../components/Logo';

export const LandingPage: React.FC = () => {
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const [selectedProfile, setSelectedProfile] = React.useState<'clt' | 'business' | 'vehicle' | null>(null);
    const [hasEntry, setHasEntry] = React.useState(false);
    const navigate = useNavigate();

    const handleStartApplication = () => {
        // Redireciona para cadastro com parâmetros de pré-seleção (pode ser usado no futuro para pré-preencher)
        const params = new URLSearchParams();
        if (selectedProfile) params.append('profile', selectedProfile);
        if (hasEntry) params.append('has_entry', 'true');
        navigate(`/auth/register?${params.toString()}`);
    };

    return (
        <div className="min-h-screen bg-black text-white selection:bg-[#D4AF37] selection:text-black overflow-x-hidden">
            {/* Background Gradients */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#D4AF37]/10 rounded-full blur-[128px]" />
                <div className="absolute bottom-[20%] right-[-10%] w-[400px] h-[400px] bg-red-900/10 rounded-full blur-[128px]" />
            </div>

            {/* Header */}
            <nav className="relative z-50 border-b border-zinc-800 bg-black/80 backdrop-blur-md">
                <div className="container mx-auto px-6 h-20 flex items-center justify-between">
                    <Logo size="md" />

                    <div className="hidden md:flex items-center gap-8">
                        <a href="#features" className="text-zinc-400 hover:text-white transition-colors">Funcionalidades</a>
                        <a href="#security" className="text-zinc-400 hover:text-white transition-colors">Segurança</a>
                        <a href="#mobile" className="text-zinc-400 hover:text-white transition-colors">App Mobile</a>

                        <div className="flex items-center gap-4 pl-4 border-l border-zinc-800">
                            <Link to="/login" className="text-white hover:text-[#D4AF37] font-medium transition-colors">
                                Área do Cliente
                            </Link>
                            <Link
                                to="/wizard"
                                className="bg-[#D4AF37] hover:bg-[#b5952f] text-black font-bold px-6 py-2.5 rounded-lg transition-all transform hover:scale-105 shadow-lg shadow-[#D4AF37]/20 flex items-center gap-2"
                            >
                                Simular Agora <ArrowRight size={18} />
                            </Link>
                        </div>
                    </div>

                    <button
                        className="md:hidden text-white"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                    >
                        {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </nav>

            {/* Mobile Menu */}
            {isMenuOpen && (
                <div className="fixed inset-0 z-40 bg-black pt-24 px-6 md:hidden">
                    <div className="flex flex-col gap-6 text-lg">
                        <a href="#features" onClick={() => setIsMenuOpen(false)} className="text-zinc-400">Funcionalidades</a>
                        <a href="#security" onClick={() => setIsMenuOpen(false)} className="text-zinc-400">Segurança</a>
                        <a href="#mobile" onClick={() => setIsMenuOpen(false)} className="text-zinc-400">App Mobile</a>
                        <hr className="border-zinc-800" />
                        <Link to="/login" className="text-white">Área do Cliente</Link>
                        <Link to="/wizard" className="bg-[#D4AF37] text-black font-bold p-4 text-center rounded-lg">
                            Simular Agora
                        </Link>
                    </div>
                </div>
            )}

            {/* Hero Section - ALTA CONVERSÃO & TRIAGEM */}
            <section className="relative z-10 pt-24 pb-32">
                <div className="container mx-auto px-6">
                    <div className="text-center max-w-4xl mx-auto mb-12 animate-fade-in">
                        <div className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-[#D4AF37] text-black font-bold text-sm mb-6 shadow-lg shadow-[#D4AF37]/20 uppercase tracking-wide">
                            <Zap size={16} fill="currentColor" />
                            Aprovação em segundos via IA
                        </div>
                        <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6">
                            Dinheiro na conta <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] to-[#F2D785]">HOJE.</span><br />
                            Qual o seu perfil?
                        </h1>
                        <p className="text-zinc-400 text-xl md:text-2xl leading-relaxed max-w-2xl mx-auto">
                            Selecione sua categoria abaixo para liberar sua proposta personalizada imediatamente. Sem filas, sem papelada.
                        </p>
                    </div>

                    {/* TRIAGEM - SELETOR DE PERFIL */}
                    <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                        {/* CARD CLT */}
                        <div
                            onClick={() => setSelectedProfile('clt')}
                            className={`cursor-pointer group relative p-8 rounded-2xl border-2 transition-all duration-300 hover:-translate-y-2 ${selectedProfile === 'clt' ? 'bg-zinc-900 border-[#D4AF37] shadow-2xl shadow-[#D4AF37]/10' : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'}`}
                        >
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 text-3xl transition-colors ${selectedProfile === 'clt' ? 'bg-[#D4AF37] text-black' : 'bg-zinc-800 text-zinc-400 group-hover:bg-[#D4AF37]/20 group-hover:text-[#D4AF37]'}`}>
                                <Briefcase />
                            </div>
                            <h3 className={`text-2xl font-bold mb-2 ${selectedProfile === 'clt' ? 'text-white' : 'text-zinc-300'}`}>Sou CLT</h3>
                            <p className="text-zinc-500 text-sm leading-relaxed">Para quem trabalha registrado e quer crédito rápido com as melhores taxas.</p>

                            {selectedProfile === 'clt' && (
                                <div className="mt-6 space-y-3 animate-slide-up">
                                    <div className="p-4 bg-zinc-950/50 rounded-lg border border-zinc-800">
                                        <p className="text-[#D4AF37] text-xs font-bold uppercase mb-2">Documentos Necessários</p>
                                        <ul className="text-sm text-zinc-300 space-y-2">
                                            <li className="flex items-center gap-2"><CheckSquare size={14} className="text-green-500" /> RG ou CNH</li>
                                            <li className="flex items-center gap-2"><CheckSquare size={14} className="text-green-500" /> Holerite Recente</li>
                                            <li className="flex items-center gap-2"><CheckSquare size={14} className="text-green-500" /> Comp. Residência</li>
                                        </ul>
                                    </div>
                                    <button onClick={handleStartApplication} className="w-full bg-[#D4AF37] hover:bg-[#b5952f] text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[#D4AF37]/20 transition-all">
                                        Solicitar Empréstimo <ArrowRight size={18} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* CARD AUTÔNOMO */}
                        <div
                            onClick={() => setSelectedProfile('business')}
                            className={`cursor-pointer group relative p-8 rounded-2xl border-2 transition-all duration-300 hover:-translate-y-2 ${selectedProfile === 'business' ? 'bg-zinc-900 border-[#D4AF37] shadow-2xl shadow-[#D4AF37]/10' : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'}`}
                        >
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 text-3xl transition-colors ${selectedProfile === 'business' ? 'bg-[#D4AF37] text-black' : 'bg-zinc-800 text-zinc-400 group-hover:bg-[#D4AF37]/20 group-hover:text-[#D4AF37]'}`}>
                                <Store />
                            </div>
                            <h3 className={`text-2xl font-bold mb-2 ${selectedProfile === 'business' ? 'text-white' : 'text-zinc-300'}`}>Autônomo / Comerciante</h3>
                            <p className="text-zinc-500 text-sm leading-relaxed">Crédito para impulsionar seu negócio. Sem burocracia bancária.</p>

                            {selectedProfile === 'business' && (
                                <div className="mt-6 space-y-3 animate-slide-up">
                                    <div className="p-4 bg-zinc-950/50 rounded-lg border border-zinc-800">
                                        <p className="text-[#D4AF37] text-xs font-bold uppercase mb-2">Documentos Necessários</p>
                                        <ul className="text-sm text-zinc-300 space-y-2">
                                            <li className="flex items-center gap-2"><CheckSquare size={14} className="text-green-500" /> CNPJ e RG</li>
                                            <li className="flex items-center gap-2"><CheckSquare size={14} className="text-green-500" /> Comp. Endereço (Comercial + Res.)</li>
                                            <li className="flex items-center gap-2"><UploadCloud size={14} className="text-green-500" /> Vídeo do Estabelecimento</li>
                                        </ul>
                                    </div>
                                    <button onClick={handleStartApplication} className="w-full bg-[#D4AF37] hover:bg-[#b5952f] text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[#D4AF37]/20 transition-all">
                                        Solicitar Capital <ArrowRight size={18} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* CARD VEÍCULO */}
                        <div
                            onClick={() => setSelectedProfile('vehicle')}
                            className={`cursor-pointer group relative p-8 rounded-2xl border-2 transition-all duration-300 hover:-translate-y-2 ${selectedProfile === 'vehicle' ? 'bg-zinc-900 border-[#D4AF37] shadow-2xl shadow-[#D4AF37]/10' : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'}`}
                        >
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 text-3xl transition-colors ${selectedProfile === 'vehicle' ? 'bg-[#D4AF37] text-black' : 'bg-zinc-800 text-zinc-400 group-hover:bg-[#D4AF37]/20 group-hover:text-[#D4AF37]'}`}>
                                <Car />
                            </div>
                            <h3 className={`text-2xl font-bold mb-2 ${selectedProfile === 'vehicle' ? 'text-white' : 'text-zinc-300'}`}>Empréstimo c/ Garantia (Moto)</h3>
                            <p className="text-zinc-500 text-sm leading-relaxed">Taxas menores usando sua moto como garantia. Rápido e fácil.</p>

                            {selectedProfile === 'vehicle' && (
                                <div className="mt-6 space-y-3 animate-slide-up">
                                    <div className="p-4 bg-zinc-950/50 rounded-lg border border-zinc-800">
                                        <p className="text-[#D4AF37] text-xs font-bold uppercase mb-2">Documentos Necessários</p>
                                        <ul className="text-sm text-zinc-300 space-y-2">
                                            <li className="flex items-center gap-2"><CheckSquare size={14} className="text-green-500" /> CNH Válida</li>
                                            <li className="flex items-center gap-2"><CheckSquare size={14} className="text-green-500" /> Comp. Endereço</li>
                                        </ul>
                                        <div className="mt-3 pt-3 border-t border-zinc-800">
                                            <label className="flex items-center gap-3 cursor-pointer group">
                                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${hasEntry ? 'bg-[#D4AF37] border-[#D4AF37]' : 'border-zinc-600 group-hover:border-[#D4AF37]'}`}>
                                                    {hasEntry && <CheckSquare size={14} className="text-black" />}
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    className="hidden"
                                                    checked={hasEntry}
                                                    onChange={() => setHasEntry(!hasEntry)}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                                <span className="text-sm text-white">Tenho valor para entrada</span>
                                            </label>
                                        </div>
                                    </div>
                                    <button onClick={handleStartApplication} className="w-full bg-[#D4AF37] hover:bg-[#b5952f] text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[#D4AF37]/20 transition-all">
                                        Simular Financiamento <ArrowRight size={18} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-16 bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 text-center max-w-2xl mx-auto backdrop-blur-sm">
                        <Banknote className="w-8 h-8 text-[#D4AF37] mx-auto mb-3" />
                        <p className="text-zinc-400">
                            Não sabe qual escolher? <Link to="/login" className="text-white underline hover:text-[#D4AF37]">Fale com nosso consultor IA</Link> ou chame no WhatsApp.
                        </p>
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section id="features" className="py-24 bg-zinc-950 border-y border-zinc-900">
                <div className="container mx-auto px-6">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <h2 className="text-3xl md:text-5xl font-bold mb-6">Tecnologia que trabalha por <span className="text-[#D4AF37]">você</span></h2>
                        <p className="text-zinc-400 text-lg">Nosso sistema une Inteligência Artificial e design intuitivo para oferecer a melhor experiência financeira.</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        <FeatureCard
                            icon={<Bot size={32} />}
                            title="IA Avançada"
                            description="Nossa inteligência artificial analisa seu perfil em tempo real e oferece as melhores taxas personalizadas, além de atendimento automático 24h via WhatsApp."
                            color="text-purple-400"
                        />
                        <FeatureCard
                            icon={<ShieldCheck size={32} />}
                            title="Antifraude Robusto"
                            description="Proteção de nível bancário. Utilizamos biometria, análise de dispositivo e geolocalização para garantir que sua conta esteja sempre segura."
                            color="text-green-400"
                        />
                        <FeatureCard
                            icon={<Smartphone size={32} />}
                            title="App PWA"
                            description="Instale nosso aplicativo diretamente no seu celular sem precisar de lojas de app. Leve, rápido e funciona até com internet lenta."
                            color="text-blue-400"
                        />
                        <FeatureCard
                            icon={<Clock size={32} />}
                            title="Pix Imediato"
                            description="Aprovou, caiu. O dinheiro é transferido para sua conta via Pix instantaneamente após a assinatura digital do contrato."
                            color="text-yellow-400"
                        />
                        <FeatureCard
                            icon={<FileCheck size={32} />}
                            title="Sem Burocracia"
                            description="Esqueça filas e papelada. Envie seus documentos tirando foto pelo celular de forma simples e rápida."
                            color="text-red-400"
                        />
                        <FeatureCard
                            icon={<Globe size={32} />}
                            title="Tudo em um Lugar"
                            description="Acompanhe parcelas, emita boletos, renegocie dívidas e veja seu score diretamente pelo nosso painel intuitivo."
                            color="text-cyan-400"
                        />
                    </div>
                </div>
            </section>

            {/* Security Section */}
            <section id="security" className="py-24 relative overflow-hidden">
                <div className="absolute inset-0 bg-green-900/5 pointer-events-none" />
                <div className="container mx-auto px-6">
                    <div className="flex flex-col md:flex-row items-center gap-16">
                        <div className="flex-1 order-2 md:order-1">
                            <div className="relative">
                                <div className="absolute inset-0 bg-green-500/20 blur-[100px] rounded-full" />
                                <div className="relative bg-zinc-900 border border-green-900/50 p-8 rounded-2xl shadow-2xl">
                                    <div className="flex items-center gap-4 mb-8">
                                        <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center text-green-500">
                                            <Lock size={24} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-lg text-white">Criptografia Ponta a Ponta</h4>
                                            <p className="text-zinc-500 text-sm">Seus dados são invioláveis</p>
                                        </div>
                                    </div>
                                    <ul className="space-y-4">
                                        {['Reconhecimento Facial', 'Validação de Documentos via OCR', 'Rastreio de Dispositivo e IP', 'Análise de Comportamento'].map((item, i) => (
                                            <li key={i} className="flex items-center gap-3 text-zinc-300">
                                                <CheckCircle2 size={18} className="text-green-500 shrink-0" />
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 order-1 md:order-2 space-y-6">
                            <h2 className="text-3xl md:text-5xl font-bold">
                                Segurança é nossa <br />
                                <span className="text-green-500">prioridade máxima</span>
                            </h2>
                            <p className="text-zinc-400 text-lg leading-relaxed">
                                Investimos pesado para garantir sua tranquilidade. Nosso sistema antifraude monitora todas as transações em tempo real, bloqueando atividades suspeitas antes que elas aconteçam.
                            </p>
                            <button className="text-white border-b border-[#D4AF37] hover:text-[#D4AF37] transition-colors pb-1 inline-flex items-center gap-2">
                                Conheça nossos protocolos <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-24">
                <div className="container mx-auto px-6">
                    <div className="bg-gradient-to-r from-[#D4AF37] to-[#F2D785] rounded-[3rem] p-12 md:p-24 text-center relative overflow-hidden shadow-2xl shadow-[#D4AF37]/20">
                        {/* Background Pattern */}
                        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

                        <div className="relative z-10 max-w-4xl mx-auto space-y-8">
                            <h2 className="text-4xl md:text-6xl font-bold text-black mb-6">
                                Pronto para realizar seus sonhos?
                            </h2>
                            <p className="text-black/80 text-xl font-medium mb-8 max-w-2xl mx-auto">
                                Não deixe para depois. Simule seu empréstimo agora mesmo e descubra como a Tubarão Empréstimos pode impulsionar sua vida.
                            </p>

                            <div className="flex flex-col sm:flex-row justify-center gap-4">
                                <Link
                                    to="/wizard"
                                    className="bg-black hover:bg-zinc-800 text-white font-bold text-lg px-10 py-5 rounded-xl transition-all shadow-xl hover:shadow-2xl transform hover:-translate-y-1 block md:inline-block"
                                >
                                    Simular Empréstimo Grátis
                                </Link>
                            </div>
                            <p className="text-black/60 text-sm font-medium mt-6">
                                *Sujeito a análise de crédito. Taxas a partir de 1.99% a.m.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-zinc-950 border-t border-zinc-900 pt-16 pb-8">
                <div className="container mx-auto px-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
                        <div className="space-y-6">
                            <Logo size="md" />
                            <p className="text-zinc-500 text-sm leading-relaxed">
                                Tubarão Empréstimos Soluções Financeiras Ltda.<br />
                                CNPJ: 00.000.000/0001-00<br />
                                Av. Paulista, 1000 - São Paulo, SP
                            </p>
                        </div>

                        <div>
                            <h4 className="text-white font-bold mb-6">Produto</h4>
                            <ul className="space-y-4 text-zinc-500 text-sm">
                                <li><a href="#" className="hover:text-[#D4AF37]">Empréstimo Pessoal</a></li>
                                <li><a href="#" className="hover:text-[#D4AF37]">Refinanciamento</a></li>
                                <li><a href="#" className="hover:text-[#D4AF37]">Consignado</a></li>
                                <li><a href="#" className="hover:text-[#D4AF37]">Para Empresas</a></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="text-white font-bold mb-6">Suporte</h4>
                            <ul className="space-y-4 text-zinc-500 text-sm">
                                <li><a href="#" className="hover:text-[#D4AF37]">Central de Ajuda</a></li>
                                <li><a href="#" className="hover:text-[#D4AF37]">Fale Conosco</a></li>
                                <li><a href="#" className="hover:text-[#D4AF37]">Ouvidoria</a></li>
                                <li><a href="#" className="hover:text-[#D4AF37]">Termos de Uso</a></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="text-white font-bold mb-6">Transparência</h4>
                            <p className="text-zinc-500 text-xs leading-relaxed mb-4">
                                Não cobramos valores antecipados para aprovação de crédito. Se alguém solicitar depósitos em nome da Tubarão Empréstimos, denuncie.
                            </p>
                            <div className="flex gap-4">
                                {/* Social Icons would go here */}
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-zinc-900 pt-8 flex flex-col md:flex-row justify-between items-center text-zinc-600 text-sm">
                        <p>&copy; {new Date().getFullYear()} Tubarão Empréstimos. Todos os direitos reservados.</p>
                        <p>Feito com tecnologia de ponta 🦈</p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

const FeatureCard: React.FC<{ icon: React.ReactNode, title: string, description: string, color: string }> = ({ icon, title, description, color }) => (
    <div className="group bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 p-8 rounded-2xl transition-all duration-300 hover:-translate-y-2">
        <div className={`w-14 h-14 bg-zinc-950 rounded-xl border border-zinc-800 flex items-center justify-center ${color} mb-6 group-hover:scale-110 transition-transform`}>
            {icon}
        </div>
        <h3 className="text-xl font-bold text-white mb-4 group-hover:text-[#D4AF37] transition-colors">{title}</h3>
        <p className="text-zinc-400 leading-relaxed text-sm">{description}</p>
    </div>
);
