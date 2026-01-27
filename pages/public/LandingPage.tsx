import React from 'react';
import { Link } from 'react-router-dom';
import {
    ShieldCheck, Smartphone, Zap, Bot, Lock, CreditCard,
    ArrowRight, CheckCircle2, ChevronRight, Menu, X, Star,
    Globe, LayoutDashboard, Clock, FileCheck
} from 'lucide-react';
import { Logo } from '../../components/Logo';

export const LandingPage: React.FC = () => {
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);

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

            {/* Hero Section */}
            <section className="relative z-10 pt-20 pb-32 overflow-hidden">
                <div className="container mx-auto px-6">
                    <div className="flex flex-col md:flex-row items-center gap-12">
                        <div className="flex-1 space-y-8 animate-slide-up">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900 border border-zinc-700 text-[#D4AF37] text-sm font-medium">
                                <Star size={16} fill="currentColor" />
                                <span>O sistema de crédito mais completo do mercado</span>
                            </div>

                            <h1 className="text-5xl md:text-7xl font-bold leading-tight">
                                Crédito rápido, <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] to-[#F2D785]">inteligente</span> e seguro.
                            </h1>

                            <p className="text-zinc-400 text-lg md:text-xl max-w-xl leading-relaxed">
                                A Tubarão Empréstimos revoluciona a forma como você acessa crédito.
                                Sem burocracia, com aprovação via IA e dinheiro na conta em segundos via Pix.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-4 pt-4">
                                <Link
                                    to="/wizard"
                                    className="bg-[#D4AF37] hover:bg-[#b5952f] text-black font-bold text-lg px-8 py-4 rounded-xl transition-all transform hover:scale-105 shadow-xl shadow-[#D4AF37]/20 flex items-center justify-center gap-2"
                                >
                                    <Zap size={20} fill="currentColor" />
                                    Quero Empréstimo
                                </Link>
                                <Link
                                    to="/login"
                                    className="bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-lg px-8 py-4 rounded-xl border border-zinc-700 hover:border-[#D4AF37]/50 transition-all flex items-center justify-center gap-2"
                                >
                                    Já sou Cliente
                                </Link>
                            </div>

                            <div className="flex items-center gap-6 text-sm text-zinc-500 pt-4">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 size={16} className="text-green-500" />
                                    <span>Aprovação em minutos</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 size={16} className="text-green-500" />
                                    <span>Sem taxas escondidas</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 size={16} className="text-green-500" />
                                    <span>Segurança bancária</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 relative animate-fade-in">
                            <div className="relative z-10 bg-gradient-to-tr from-zinc-900 to-black p-6 rounded-[2rem] border border-zinc-800 shadow-2xl rotate-[-2deg] hover:rotate-0 transition-all duration-500 hover:scale-105">
                                <div className="absolute inset-0 bg-gradient-to-br from-[#D4AF37]/5 to-transparent rounded-[2rem] pointer-events-none" />

                                {/* Mockup Content */}
                                <div className="bg-black/50 backdrop-blur-xl rounded-xl p-6 border border-zinc-800 space-y-6">
                                    <div className="flex justify-between items-center pb-6 border-b border-zinc-800">
                                        <div>
                                            <p className="text-zinc-400 text-sm">Saldo Disponível</p>
                                            <h3 className="text-3xl font-bold text-white">R$ 12.500,00</h3>
                                        </div>
                                        <div className="w-12 h-12 bg-[#D4AF37]/20 rounded-full flex items-center justify-center text-[#D4AF37]">
                                            <CreditCard size={24} />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700/50">
                                            <Clock className="text-[#D4AF37] mb-2" size={24} />
                                            <p className="font-bold">Aprovação</p>
                                            <p className="text-xs text-zinc-400">Em 2 minutos</p>
                                        </div>
                                        <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700/50">
                                            <Smartphone className="text-[#D4AF37] mb-2" size={24} />
                                            <p className="font-bold">100% Digital</p>
                                            <p className="text-xs text-zinc-400">Sem papelada</p>
                                        </div>
                                    </div>

                                    <div className="bg-[#D4AF37] p-4 rounded-lg text-black font-bold text-center">
                                        Dinheiro na conta AGORA
                                    </div>
                                </div>
                            </div>

                            {/* Decorative Elements */}
                            <div className="absolute bg-zinc-800 w-full h-full top-4 left-4 rounded-[2rem] -z-10 opacity-30 rotate-[2deg]" />
                        </div>
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
