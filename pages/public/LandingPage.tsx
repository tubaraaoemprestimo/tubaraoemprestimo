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
    const navigate = useNavigate();

    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
        setIsMenuOpen(false);
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
                        <button onClick={() => scrollToSection('features')} className="text-zinc-400 hover:text-white transition-colors cursor-pointer bg-transparent border-0">Funcionalidades</button>
                        <button onClick={() => scrollToSection('security')} className="text-zinc-400 hover:text-white transition-colors cursor-pointer bg-transparent border-0">Segurança</button>
                        <button onClick={() => scrollToSection('mobile')} className="text-zinc-400 hover:text-white transition-colors cursor-pointer bg-transparent border-0">App Mobile</button>

                        <div className="flex items-center gap-4 pl-4 border-l border-zinc-800">
                            <Link to="/login" className="text-white hover:text-[#D4AF37] font-medium transition-colors border border-zinc-700 px-4 py-2 rounded-lg text-sm">
                                Área do Cliente
                            </Link>
                            <a
                                href="https://wa.me/5511915712203"
                                className="bg-[#D4AF37] hover:bg-[#b5952f] text-black font-bold px-6 py-2.5 rounded-lg transition-all transform hover:scale-105 shadow-lg shadow-[#D4AF37]/20 flex items-center gap-2"
                            >
                                Contratar Sistema <ArrowRight size={18} />
                            </a>
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
                        <button onClick={() => scrollToSection('features')} className="text-zinc-400 text-left">Funcionalidades</button>
                        <button onClick={() => scrollToSection('security')} className="text-zinc-400 text-left">Segurança</button>
                        <button onClick={() => scrollToSection('mobile')} className="text-zinc-400 text-left">App White Label</button>
                        <hr className="border-zinc-800" />
                        <Link to="/login" className="text-white border border-zinc-700 p-2 text-center rounded">Área do Cliente (Login)</Link>
                        <a href="https://wa.me/5511915712203" className="bg-[#D4AF37] text-black font-bold p-4 text-center rounded-lg">
                            Contratar Sistema
                        </a>
                    </div>
                </div>
            )}

            {/* Hero Section - VENDA DO SOFTWARE (B2B) */}
            <section className="relative z-10 pt-24 pb-32">
                <div className="container mx-auto px-6">
                    <div className="flex flex-col md:flex-row items-center gap-12">
                        <div className="flex-1 space-y-8 animate-slide-up">
                            <div className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-[#D4AF37] text-black font-bold text-sm mb-6 shadow-lg shadow-[#D4AF37]/20 uppercase tracking-wide">
                                <Zap size={16} fill="currentColor" />
                                Sistema para Financeiras e Bancos Digitais
                            </div>
                            <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
                                Tenha sua Própria <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] to-[#F2D785]">Techfin</span> em 24 horas.
                            </h1>
                            <p className="text-zinc-400 text-lg md:text-xl leading-relaxed max-w-xl">
                                O único sistema do mercado com <strong>Automação de Cobrança 360º</strong> (WhatsApp, Email e Push), Análise de Crédito com IA e App Mobile White Label incluso.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-4 pt-4">
                                <a
                                    href="https://wa.me/5511915712203?text=Quero%20conhecer%20o%20sistema%20Tubarao"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-[#D4AF37] hover:bg-[#b5952f] text-black font-bold text-lg px-8 py-4 rounded-xl transition-all transform hover:scale-105 shadow-xl shadow-[#D4AF37]/20 flex items-center justify-center gap-2"
                                >
                                    <Smartphone size={20} />
                                    Agendar Demo Grátis
                                </a>
                                <Link
                                    to="/login"
                                    className="bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-lg px-8 py-4 rounded-xl border border-zinc-700 hover:border-[#D4AF37]/50 transition-all flex items-center justify-center gap-2"
                                >
                                    Acesso Administrativo
                                </Link>
                            </div>

                            <div className="flex items-center gap-6 text-sm text-zinc-500 pt-4">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 size={16} className="text-green-500" />
                                    <span>Setup Imediato</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 size={16} className="text-green-500" />
                                    <span>Cobrança Automática</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 size={16} className="text-green-500" />
                                    <span>App Android/iOS</span>
                                </div>
                            </div>
                        </div>

                        {/* MOCKUP DO DASHBOARD (Visual Power) */}
                        <div className="flex-1 relative animate-fade-in group">
                            <div className="relative z-10 bg-zinc-950 p-2 rounded-2xl border border-zinc-800 shadow-2xl rotate-[-2deg] group-hover:rotate-0 transition-all duration-700">
                                <div className="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 relative">
                                    {/* Abstract Dashboard UI Representation */}
                                    <div className="p-6 space-y-6">
                                        <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
                                            <div className="w-32 h-4 bg-zinc-800 rounded"></div>
                                            <div className="flex gap-2">
                                                <div className="w-8 h-8 rounded-full bg-red-500/20"></div>
                                                <div className="w-8 h-8 rounded-full bg-[#D4AF37]/20"></div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-zinc-800/50 p-4 rounded-lg space-y-2">
                                                <p className="text-xs text-zinc-500">Inadimplência</p>
                                                <p className="text-2xl font-bold text-red-400">1.2% <span className="text-xs text-zinc-600">📉 -0.5%</span></p>
                                            </div>
                                            <div className="bg-zinc-800/50 p-4 rounded-lg space-y-2">
                                                <p className="text-xs text-zinc-500">Lucro Líquido</p>
                                                <p className="text-2xl font-bold text-green-400">+ R$ 450k</p>
                                            </div>
                                        </div>
                                        <div className="bg-zinc-800/30 p-4 rounded-lg border border-zinc-800/50">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="w-8 h-8 rounded bg-green-900/30 flex items-center justify-center text-green-400"><Zap size={16} /></div>
                                                <div>
                                                    <p className="text-sm font-bold text-white">Bot de Cobrança</p>
                                                    <p className="text-xs text-zinc-500">Ativo agora</p>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2 text-xs text-zinc-400">
                                                    <CheckCircle2 size={12} className="text-green-500" />
                                                    <span>150 cobranças enviadas via WhatsApp</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-zinc-400">
                                                    <CheckCircle2 size={12} className="text-green-500" />
                                                    <span>98% de taxa de entrega</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Decorative Glow */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[#D4AF37]/10 blur-[100px] -z-10 rounded-full" />
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section id="features" className="py-24 bg-zinc-950 border-y border-zinc-900">
                <div className="container mx-auto px-6">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <h2 className="text-3xl md:text-5xl font-bold mb-6">Tecnologia para <span className="text-[#D4AF37]">Escalar</span> sua Financeira</h2>
                        <p className="text-zinc-400 text-lg">Elimine processos manuais, reduza a inadimplência com Cobrança Automática e aprove clientes em segundos com nossa IA.</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        <FeatureCard
                            icon={<Bot size={32} />}
                            title="Análise de Score IA"
                            description="Nossa inteligência artificial analisa o risco de cada cliente em segundos, sugerindo limites seguros e reduzindo calotes drasticamente."
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
                            title="App White Label"
                            description="Seu próprio aplicativo Android/iOS com sua marca. O cliente instala direto pelo navegador (PWA) e recebe notificações push."
                            color="text-blue-400"
                        />
                        <FeatureCard
                            icon={<Zap size={32} />}
                            title="Cobrança Automática"
                            description="O sistema cobra seus clientes sozinho: WhatsApp, SMS, Email e Push Notification. Diga adeus à cobrança manual cansativa."
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
                            title="Painel Gestão Central"
                            description="Acompanhe fluxo de caixa, DRE, ranking de clientes bons/ruins e produtividade da equipe em um único dashboard."
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

            {/* Mobile App Section */}
            <section id="mobile" className="py-24 bg-zinc-900 border-y border-zinc-800">
                <div className="container mx-auto px-6">
                    <div className="flex flex-col md:flex-row items-center gap-16">
                        <div className="flex-1 space-y-8">
                            <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-blue-500/10 text-blue-400 font-bold text-xs uppercase tracking-wide border border-blue-500/20">
                                <Smartphone size={14} />
                                App White Label
                            </div>
                            <h2 className="text-3xl md:text-5xl font-bold leading-tight">
                                Seu Cliente com o <br />
                                <span className="text-white">Seu App Instalado</span>
                            </h2>
                            <p className="text-zinc-400 text-lg leading-relaxed">
                                Ofereça uma experiência profissional. Seus clientes instalam o aplicativo direto pelo navegador (Tecnologia PWA), recebem notificações de cobrança e acompanham empréstimos na palma da mão.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-4 pt-4">
                                <button className="bg-white text-black hover:bg-zinc-200 font-bold px-8 py-4 rounded-xl flex items-center justify-center gap-3 transition-all" onClick={() => window.open('https://www.tubaraoemprestimo.com.br/#/login', '_blank')}>
                                    <Smartphone className="fill-black" /> Testar App Agora
                                </button>
                                <span className="text-zinc-500 text-sm flex items-center max-w-xs">
                                    *Disponível para Android e iOS sem necessidade de Loja de Aplicativos.
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-6 pt-6">
                                <div>
                                    <h4 className="text-white font-bold mb-1">Push Notifications</h4>
                                    <p className="text-zinc-500 text-sm">Lembretes automáticos de pagamento na tela do celular.</p>
                                </div>
                                <div>
                                    <h4 className="text-white font-bold mb-1">Sem Custo de Store</h4>
                                    <p className="text-zinc-500 text-sm">Não pague taxas da Apple ou Google. Instalação direta.</p>
                                </div>
                            </div>
                        </div>

                        {/* Phone Mockup */}
                        <div className="flex-1 relative">
                            <div className="relative mx-auto border-gray-800 bg-gray-800 border-[14px] rounded-[2.5rem] h-[600px] w-[300px] shadow-xl transform rotate-3 hover:rotate-0 transition-all duration-500">
                                <div className="w-[148px] h-[18px] bg-gray-800 top-0 rounded-b-[1rem] left-1/2 -translate-x-1/2 absolute"></div>
                                <div className="h-[32px] w-[3px] bg-gray-800 absolute -start-[17px] top-[72px] rounded-s-lg"></div>
                                <div className="h-[46px] w-[3px] bg-gray-800 absolute -start-[17px] top-[124px] rounded-s-lg"></div>
                                <div className="h-[46px] w-[3px] bg-gray-800 absolute -start-[17px] top-[178px] rounded-s-lg"></div>
                                <div className="h-[64px] w-[3px] bg-gray-800 absolute -end-[17px] top-[142px] rounded-e-lg"></div>
                                <div className="rounded-[2rem] overflow-hidden w-[272px] h-[572px] bg-zinc-950 relative">
                                    {/* Screen Content */}
                                    <div className="bg-[#D4AF37] h-40 pt-12 px-6 relative">
                                        <p className="text-black/60 text-xs font-bold uppercase">Olá, Cliente</p>
                                        <p className="text-black font-bold text-2xl">R$ 5.000,00</p>
                                        <p className="text-black/80 text-sm">Limite Disponível</p>
                                    </div>
                                    <div className="p-4 space-y-3">
                                        <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                                            <p className="text-zinc-400 text-xs mb-1">Próxima Parcela</p>
                                            <div className="flex justify-between items-center">
                                                <p className="text-white font-bold">R$ 450,00</p>
                                                <span className="text-xs bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded">Vence Hoje</span>
                                            </div>
                                        </div>
                                        <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-500"><CheckCircle2 size={18} /></div>
                                            <div>
                                                <p className="text-white text-sm font-bold">Empréstimo Ativo</p>
                                                <p className="text-zinc-500 text-xs">3/12 parcelas pagas</p>
                                            </div>
                                        </div>
                                        <div className="h-32 bg-zinc-900/50 rounded-xl border border-zinc-900 flex items-center justify-center text-zinc-700">
                                            <div className="text-center">
                                                <p className="text-sm">Histórico</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Install Banner Mockup */}
                                    <div className="absolute bottom-4 left-4 right-4 bg-zinc-800 p-3 rounded-xl border border-zinc-700 flex items-center justify-between shadow-2xl animate-bounce">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-[#D4AF37] rounded-lg flex items-center justify-center"><Logo size="sm" /></div>
                                            <div>
                                                <p className="text-white text-xs font-bold">Instalar App</p>
                                                <p className="text-zinc-400 text-[10px]">Adicionar à Tela Inicial</p>
                                            </div>
                                        </div>
                                        <button className="text-[#D4AF37] text-xs font-bold">Instalar</button>
                                    </div>
                                </div>
                            </div>
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
                                Leve sua Financeira para o Futuro
                            </h2>
                            <p className="text-black/80 text-xl font-medium mb-8 max-w-2xl mx-auto">
                                Pare de perder tempo com planilhas e processos manuais. Teste o Sistema Tubarão e veja seu lucro aumentar.
                            </p>

                            <div className="flex flex-col sm:flex-row justify-center gap-4">
                                <a
                                    href="https://wa.me/5511915712203"
                                    className="bg-black hover:bg-zinc-800 text-white font-bold text-lg px-10 py-5 rounded-xl transition-all shadow-xl hover:shadow-2xl transform hover:-translate-y-1 block md:inline-block"
                                >
                                    Solicitar Orçamento do Sistema
                                </a>
                            </div>

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
