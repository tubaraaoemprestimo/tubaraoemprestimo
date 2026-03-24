
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation, Navigate, useNavigate } from 'react-router-dom';

// Pages - Client
import { Wizard } from './pages/client/Wizard';
import { ClientWelcome } from './pages/client/ClientWelcome';
import { ReturningClientForm } from './pages/client/ReturningClientForm';
import { Login } from './pages/auth/Login';
import { ClientDashboard } from './pages/client/ClientDashboard';
import { Contracts } from './pages/client/Contracts';
import { Profile } from './pages/client/Profile';
import { Statement } from './pages/client/Statement';
import { HelpCenter } from './pages/client/HelpCenter';
import { MyDocuments } from './pages/client/MyDocuments';
import { ReferralsPage } from './pages/client/ReferralsPage';
import { PartnerDashboard } from './pages/client/PartnerDashboard';

// Pages - Admin Core
import { Dashboard } from './pages/admin/Dashboard';
import { Requests } from './pages/admin/Requests';
import { Settings } from './pages/admin/Settings';
import { Customers } from './pages/admin/Customers';
import { Contracts as AdminContracts } from './pages/admin/Contracts';
import { Investors } from './pages/admin/Investors';
import { ImportContacts } from './pages/admin/ImportContacts';
import { DataSearch } from './pages/admin/DataSearch';
import { DataSearchNew } from './pages/admin/DataSearchNew';
import { Partners } from './pages/admin/Partners';
import { QualificationLeadsAdmin } from './pages/admin/QualificationLeadsAdmin';

// Pages - Admin Extended (Hubs Unificados)
import { FinanceHub } from './pages/admin/FinanceHub';
import { CommunicationHub } from './pages/admin/CommunicationHub';
import { SecurityHub } from './pages/admin/SecurityHub';
import { AIHub } from './pages/admin/AIHub';
import { AnalyticsHub } from './pages/admin/AnalyticsHub';
import { ContractMigrations } from './pages/admin/ContractMigrations';
import { CollectionAutomationPanel } from './pages/admin/CollectionAutomationPanel';

// Pages - Admin (mantidas para rotas legadas)
import { FinancePage } from './pages/admin/Finance';
import { AgendaPage } from './pages/admin/Agenda';
import { DocumentsPage } from './pages/admin/Documents';
import { ScorePage } from './pages/admin/Score';

// Pages - Public
import { DemoSimulator } from './pages/public/DemoSimulator';
import { LandingPage } from './pages/public/LandingPage';
import Register from './pages/auth/Register';
import ResetPassword from './pages/auth/ResetPassword';
import { SalesPage } from './pages/public/SalesPage';
import { QualificationPage } from './pages/public/QualificationPage';
import { QualificationSuccess } from './pages/public/QualificationSuccess';

// Funil de Vendas — One Page Funnel (SPA, sem reload entre steps)
import FunnelManager from './pages/funil/FunnelManager';

// Micro-LMS
import { AcessoCurso } from './pages/client/AcessoCurso';
import { CursoAdmin } from './pages/admin/CursoAdmin';
import { MetodoTubarao } from './pages/admin/MetodoTubarao';

// Components
import { Chatbot } from './components/Chatbot';
import { BottomNav } from './components/BottomNav';
import { SplashScreen } from './components/SplashScreen';
import { InstallPrompt } from './components/InstallPrompt';
import { ToastProvider } from './components/Toast';
import { NotificationCenter } from './components/NotificationCenter';
import { PushPermissionBanner } from './components/PushPermissionBanner';
import { OfflineStatus } from './components/OfflineStatus';
import {
  LayoutDashboard, FileText, Settings as SettingsIcon, LogOut, Users, Bot, Menu, X,
  UserCog, Home as HomeIcon, PieChart, User as UserIcon, Megaphone, BarChart3,
  Calendar, Ban, FileCheck, DollarSign, MessageSquare, Star, ChevronDown, ChevronRight,
  MapPin, Landmark, Receipt, Gift, Camera, Shield, Upload, Search, Handshake, TrendingUp, BookOpen
} from 'lucide-react';
import { Logo } from './components/Logo';
import { apiService } from './services/apiService';
import { BrandProvider } from './contexts/BrandContext';
import { firebasePushService } from './services/firebasePushService';
import { themeService } from './services/themeService';
import { PermissionGate } from './components/PermissionGate';
import { BiometricAccessGate } from './components/BiometricAccessGate';
import { locationTrackingService } from './services/locationTrackingService';

// Demo Mode
const IS_DEMO = import.meta.env.VITE_DEMO_MODE === 'true';
// DemoBar e seedDemoData são importados de forma lazy — não aumentam o bundle de produção
const DemoBar = IS_DEMO ? React.lazy(() => import('./components/DemoBar').then(m => ({ default: m.DemoBar }))) : null;

// --- Expandable Menu Item ---
interface ExpandableMenuProps {
  icon: React.ReactNode;
  label: string;
  badge?: string;
  items: { to: string; label: string; icon?: React.ReactNode }[];
  isActive: (path: string) => string;
  onItemClick: () => void;
}

const ExpandableMenu: React.FC<ExpandableMenuProps> = ({ icon, label, badge, items, isActive, onItemClick }) => {
  const location = useLocation();
  // Extract pathname from item.to (which may contain query params like ?tab=xxx)
  const getPathname = (to: string) => to.split('?')[0];
  const [isOpen, setIsOpen] = useState(() => items.some(item => location.pathname === getPathname(item.to)));

  const isAnyItemActive = items.some(item => location.pathname === getPathname(item.to));


  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg transition-all ${isAnyItemActive ? 'text-[#D4AF37] bg-zinc-800' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
          }`}
      >
        <div className="flex items-center gap-3">
          {icon}
          <span>{label}</span>
          {badge && (
            <span className="text-[10px] bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-1.5 py-0.5 rounded-full font-bold">
              {badge}
            </span>
          )}
        </div>
        <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="ml-4 mt-1 space-y-0.5 border-l border-zinc-800 pl-4">
          {items.map(item => (
            <Link
              key={item.to}
              to={item.to}
              onClick={onItemClick}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${isActive(item.to)}`}
            >
              {item.icon || <ChevronRight size={14} />}
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

// --- Layouts ---

const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Compare full path including query params for expandable menu items
  const isActive = (path: string) => {
    const [targetPath, targetSearch] = path.split('?');
    const isPathMatch = location.pathname === targetPath;
    const isSearchMatch = targetSearch ? location.search === `?${targetSearch}` : !location.search;
    return isPathMatch && isSearchMatch ? 'text-[#D4AF37] bg-zinc-800' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50';
  };
  const user = apiService.auth.getUser();
  const [accessChecked, setAccessChecked] = useState(IS_DEMO); // Em DEMO, pula verificação

  useEffect(() => {
    if (IS_DEMO) return; // Em DEMO, não verifica managed access (não há backend)

    let active = true;

    const validateManagedAccess = async () => {
      if (!user) {
        if (active) setAccessChecked(true);
        return;
      }

      const hasAccess = await apiService.auth.hasManagedAccess(user.id);
      if (!hasAccess) {
        await apiService.auth.signOut();
        navigate('/login', { replace: true });
        return;
      }

      if (active) setAccessChecked(true);
    };

    validateManagedAccess();

    return () => {
      active = false;
    };
  }, [user?.id]);

  if (!user || user.role !== 'ADMIN') {
    return <Navigate to="/login" replace />;
  }

  if (!accessChecked) {
    return <div className="min-h-screen bg-black" />;
  }

  const NavContent = () => (
    <>
      <div className="p-6 border-b border-zinc-800 flex justify-between items-center shrink-0">
        <Logo size="sm" />
        <div className="hidden md:block">
          <NotificationCenter />
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto text-sm">
        {/* Principal */}
        <p className="text-[10px] text-zinc-600 uppercase font-bold px-4 pt-2 pb-1">Principal</p>
        <Link to="/admin" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${isActive('/admin')}`}><LayoutDashboard size={18} /> Dashboard</Link>
        <Link to="/admin/customers" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${isActive('/admin/customers')}`}><Users size={18} /> Clientes</Link>
        <Link to="/admin/contracts" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${isActive('/admin/contracts')}`}><FileCheck size={18} /> Contratos</Link>
        <Link to="/admin/requests" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${isActive('/admin/requests')}`}><FileText size={18} /> Solicitações</Link>
        <Link to="/admin/investors" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${isActive('/admin/investors')}`}><Landmark size={18} /> Solicitações de Investidores</Link>
        <Link to="/admin/contract-migrations" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${isActive('/admin/contract-migrations')}`}><Users size={18} /> Migração de Contratos</Link>
        <Link to="/admin/collection-automation" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${isActive('/admin/collection-automation')}`}><TrendingUp size={18} /> Réguas de Cobrança</Link>
        <Link to="/admin/import-contacts" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${isActive('/admin/import-contacts')}`}><Upload size={18} /> Importar Contatos</Link>
        <Link to="/admin/data-search" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${isActive('/admin/data-search')}`}><Search size={18} /> Investigação</Link>
        <Link to="/admin/partners" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${isActive('/admin/partners')}`}><Handshake size={18} /> Parceiros</Link>

        {/* Financeiro */}
        <p className="text-[10px] text-zinc-600 uppercase font-bold px-4 pt-4 pb-1">Financeiro</p>
        <ExpandableMenu
          icon={<Receipt size={18} />}
          label="Central Financeira"
          badge="🎮"
          isActive={isActive}
          onItemClick={() => setIsMobileMenuOpen(false)}
          items={[
            { to: '/admin/finance-hub', label: 'Visão Geral', icon: <PieChart size={14} /> },
            { to: '/admin/finance', label: 'Fluxo de Caixa', icon: <DollarSign size={14} /> },
            { to: '/admin/agenda', label: 'Agenda', icon: <Calendar size={14} /> },
            { to: '/admin/score', label: 'Score & Renegociação', icon: <Star size={14} /> },
            { to: '/admin/documents', label: 'Documentos', icon: <FileCheck size={14} /> },
          ]}
        />

        {/* Comunicação */}
        <p className="text-[10px] text-zinc-600 uppercase font-bold px-4 pt-4 pb-1">Comunicação</p>
        <ExpandableMenu
          icon={<Megaphone size={18} />}
          label="Central de Comunicação"
          isActive={isActive}
          onItemClick={() => setIsMobileMenuOpen(false)}
          items={[
            { to: '/admin/communication-hub', label: 'Visão Geral', icon: <PieChart size={14} /> },
            { to: '/admin/communication-hub?tab=templates', label: 'Templates', icon: <MessageSquare size={14} /> },
            { to: '/admin/communication-hub?tab=campaigns', label: 'Campanhas', icon: <Megaphone size={14} /> },
            { to: '/admin/communication-hub?tab=status', label: 'Agendar Status', icon: <Camera size={14} /> },
            { to: '/admin/communication-hub?tab=referrals', label: 'Indicações', icon: <Gift size={14} /> },
          ]}
        />

        {/* Análises */}
        <p className="text-[10px] text-zinc-600 uppercase font-bold px-4 pt-4 pb-1">Análises</p>
        <ExpandableMenu
          icon={<BarChart3 size={18} />}
          label="Central de Análises"
          isActive={isActive}
          onItemClick={() => setIsMobileMenuOpen(false)}
          items={[
            { to: '/admin/analytics-hub', label: 'Relatórios', icon: <BarChart3 size={14} /> },
            { to: '/admin/analytics-hub?tab=audit', label: 'Auditoria', icon: <FileText size={14} /> },
            { to: '/admin/analytics-hub?tab=geo', label: 'Geolocalização', icon: <MapPin size={14} /> },
            { to: '/admin/analytics-hub?tab=openfinance', label: 'Open Finance', icon: <Landmark size={14} /> },
            { to: '/admin/qualification-leads', label: 'Qualificação de Leads', icon: <Users size={14} /> },
          ]}
        />

        {/* Segurança */}
        <p className="text-[10px] text-zinc-600 uppercase font-bold px-4 pt-4 pb-1">Segurança</p>
        <ExpandableMenu
          icon={<Shield size={18} />}
          label="Central de Segurança"
          isActive={isActive}
          onItemClick={() => setIsMobileMenuOpen(false)}
          items={[
            { to: '/admin/security-hub', label: 'Antifraude', icon: <Shield size={14} /> },
            { to: '/admin/security-hub?tab=blacklist', label: 'Blacklist', icon: <Ban size={14} /> },
            { to: '/admin/security-hub?tab=users', label: 'Acessos', icon: <UserCog size={14} /> },
          ]}
        />

        {/* Sistema */}
        <p className="text-[10px] text-zinc-600 uppercase font-bold px-4 pt-4 pb-1">Sistema</p>
        <ExpandableMenu
          icon={<Bot size={18} />}
          label="Central de IA"
          isActive={isActive}
          onItemClick={() => setIsMobileMenuOpen(false)}
          items={[
            { to: '/admin/ai-hub', label: 'Configurar', icon: <SettingsIcon size={14} /> },
            { to: '/admin/ai-hub?tab=conversations', label: 'Conversas', icon: <MessageSquare size={14} /> },
            { to: '/admin/ai-hub?tab=logs', label: 'Logs', icon: <FileText size={14} /> },
            { to: '/admin/ai-hub?tab=test', label: 'Testar', icon: <Bot size={14} /> },
          ]}
        />
        {/* Curso */}
        <p className="text-[10px] text-zinc-600 uppercase font-bold px-4 pt-4 pb-1">Método Tubarão</p>
        <Link to="/admin/curso" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${isActive('/admin/curso')}`}><BookOpen size={18} /> Conteúdo & Vídeos</Link>
        <Link to="/admin/metodo-tubarao" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${isActive('/admin/metodo-tubarao')}`}><TrendingUp size={18} /> Leads & Quiz & Automação</Link>

        <Link to="/admin/settings" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${isActive('/admin/settings')}`}><SettingsIcon size={18} /> Configurações</Link>
      </nav>
      <div className="p-4 border-t border-zinc-800 shrink-0">
        <Link to="/login" className="flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-900/10 rounded-lg transition-all"><LogOut size={20} /> Sair</Link>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden font-sans">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-zinc-950 border-r border-zinc-800 flex-col shrink-0">
        <NavContent />
      </aside>

      {/* Mobile Header & Menu */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-zinc-950 border-b border-zinc-800 z-40 p-4 flex justify-between items-center">
        <Logo size="xs" />
        <div className="flex items-center gap-2">
          <NotificationCenter />
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-zinc-400 hover:text-white">
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-black/90 backdrop-blur-sm pt-16 flex flex-col">
          <NavContent />
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pt-16 md:pt-0">
        {children}
      </main>
    </div>
  );
};

const ClientLayout: React.FC<{ children: React.ReactNode; showNav?: boolean; showBottomNav?: boolean }> = ({ children, showNav = true, showBottomNav = false }) => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isActive = (path: string) =>
    location.pathname === path
      ? 'text-[#D4AF37] bg-zinc-800 font-bold'
      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50';

  const user = apiService.auth.getUser();
  const [accessChecked, setAccessChecked] = useState(IS_DEMO); // Em DEMO, pula verificação

  useEffect(() => {
    if (IS_DEMO) return; // Em DEMO, não verifica managed access (não há backend)

    let active = true;

    const validateManagedAccess = async () => {
      if (!user) {
        if (active) setAccessChecked(true);
        return;
      }

      const hasAccess = await apiService.auth.hasManagedAccess(user.id);
      if (!hasAccess) {
        await apiService.auth.signOut();
        window.location.hash = '#/login';
        return;
      }

      if (active) setAccessChecked(true);
    };

    validateManagedAccess();

    return () => {
      active = false;
    };
  }, [user?.id]);

  if (!accessChecked) {
    return <div className="min-h-screen bg-black" />;
  }

  const ClientNavContent = () => (
    <>
      <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
        <Logo size="sm" />
      </div>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <Link to="/client/dashboard" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive('/client/dashboard')}`}>
          <HomeIcon size={20} /> Início
        </Link>
        <Link to="/client/contracts" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive('/client/contracts')}`}>
          <FileText size={20} /> Meus Contratos
        </Link>
        <Link to="/client/statement" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive('/client/statement')}`}>
          <PieChart size={20} /> Extrato
        </Link>
        <Link to="/client/documents" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive('/client/documents')}`}>
          <FileCheck size={20} /> Documentos
        </Link>
        <Link to="/client/profile" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive('/client/profile')}`}>
          <UserIcon size={20} /> Meu Perfil
        </Link>
        <Link to="/client/help" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive('/client/help')}`}>
          <MessageSquare size={20} /> Ajuda
        </Link>
        <Link to="/client/referrals" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive('/client/referrals')}`}>
          <Gift size={20} /> Indicações
        </Link>
        <Link to="/client/partner" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive('/client/partner')}`}>
          <Handshake size={20} /> Parceiro
        </Link>
      </nav>
      <div className="p-4 border-t border-zinc-800">
        <Link to="/login" className="flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-900/10 rounded-lg transition-all">
          <LogOut size={20} /> Sair
        </Link>
      </div>
    </>
  );

  return (
    <div className="flex flex-col min-h-screen bg-black text-white font-sans">
      {/* Header para mobile ou sidebar para desktop */}
      {showNav && (
        <>
          {/* Desktop Sidebar */}
          <aside className="hidden md:flex w-64 fixed inset-y-0 left-0 bg-zinc-950 border-r border-zinc-800 flex-col z-40">
            <ClientNavContent />
          </aside>

          {/* Mobile Header */}
          <header className="md:hidden fixed top-0 left-0 right-0 bg-zinc-950 border-b border-zinc-800 z-40 p-4 flex justify-between items-center">
            <Logo size="xs" />
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-zinc-400 hover:text-white">
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </header>

          {/* Mobile Menu Overlay */}
          {isMobileMenuOpen && (
            <div className="md:hidden fixed inset-0 z-30 bg-black/90 backdrop-blur-sm pt-16 flex flex-col">
              <ClientNavContent />
            </div>
          )}
        </>
      )}
      {/* Main Content */}
      <main className={`flex-1 ${showNav ? 'md:ml-64' : ''} ${showNav ? 'pt-16 md:pt-0' : ''} ${showBottomNav ? 'pb-20' : ''}`}>
        {children}
      </main>

      {/* Bottom Navigation for mobile */}
      {showBottomNav && <BottomNav />}

      {/* Chatbot only visible in client area */}
      <Chatbot />
    </div>
  );
};

// --- App ---

function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Demo Mode: semear dados iniciais
    if (IS_DEMO) {
      import('./services/demoSeed').then(({ seedDemoData }) => seedDemoData()).catch(() => {});
    }

    // Try to initialize push notifications
    if (!IS_DEMO) {
      firebasePushService.init().catch(console.error);
    }

    // Initialize theme service
    themeService.init().catch(console.error);

    // Capturar localização em cada acesso (se usuário logado)
    const user = localStorage.getItem('tubarao_user');
    if (user) {
      locationTrackingService.captureAndSave().catch(() => { });
    }

    // Recapturar a cada 5 minutos enquanto o app está aberto
    const locationInterval = setInterval(() => {
      const u = localStorage.getItem('tubarao_user');
      if (u) {
        locationTrackingService.captureAndSave().catch(() => { });
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(locationInterval);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  if (showSplash) {
    return <SplashScreen />;
  }

  return (
    <BrandProvider>
      <ToastProvider>
        <Router>
          <OfflineStatus />
          <InstallPrompt />
          <PushPermissionBanner />
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Login />} />
            <Route path="/site" element={<SalesPage />} />
            <Route path="/qualificacao" element={<QualificationPage />} />
            <Route path="/qualificacao/sucesso" element={<QualificationSuccess />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/wizard" element={<BiometricAccessGate><PermissionGate><ClientLayout><Wizard /></ClientLayout></PermissionGate></BiometricAccessGate>} />
            <Route path="/demo" element={<DemoSimulator />} />

            {/* Funil de Vendas — One Page Funnel SPA */}
            <Route path="/funil" element={<FunnelManager />} />

            {/* Client Welcome & Onboarding */}
            <Route path="/client/welcome" element={<BiometricAccessGate><PermissionGate><ClientWelcome /></PermissionGate></BiometricAccessGate>} />
            <Route path="/client/returning" element={<BiometricAccessGate><PermissionGate><ReturningClientForm /></PermissionGate></BiometricAccessGate>} />
            <Route path="/client/wizard" element={<BiometricAccessGate><PermissionGate><ClientLayout><Wizard /></ClientLayout></PermissionGate></BiometricAccessGate>} />

            {/* Client Protected */}
            <Route path="/client/dashboard" element={<BiometricAccessGate><PermissionGate><ClientLayout showNav={false} showBottomNav={true}><ClientDashboard /></ClientLayout></PermissionGate></BiometricAccessGate>} />
            <Route path="/client/contracts" element={<BiometricAccessGate><PermissionGate><ClientLayout showNav={true} showBottomNav={true}><Contracts /></ClientLayout></PermissionGate></BiometricAccessGate>} />
            <Route path="/client/profile" element={<BiometricAccessGate><PermissionGate><ClientLayout showNav={true} showBottomNav={true}><Profile /></ClientLayout></PermissionGate></BiometricAccessGate>} />
            <Route path="/client/statement" element={<BiometricAccessGate><PermissionGate><ClientLayout showNav={true} showBottomNav={true}><Statement /></ClientLayout></PermissionGate></BiometricAccessGate>} />
            <Route path="/client/help" element={<BiometricAccessGate><PermissionGate><ClientLayout showNav={true} showBottomNav={true}><HelpCenter /></ClientLayout></PermissionGate></BiometricAccessGate>} />
            <Route path="/client/documents" element={<BiometricAccessGate><PermissionGate><ClientLayout showNav={true} showBottomNav={true}><MyDocuments /></ClientLayout></PermissionGate></BiometricAccessGate>} />
            <Route path="/client/referrals" element={<BiometricAccessGate><PermissionGate><ClientLayout showNav={true} showBottomNav={true}><ReferralsPage /></ClientLayout></PermissionGate></BiometricAccessGate>} />
            <Route path="/client/partner" element={<BiometricAccessGate><PermissionGate><ClientLayout showNav={true} showBottomNav={true}><PartnerDashboard /></ClientLayout></PermissionGate></BiometricAccessGate>} />
            <Route path="/acesso" element={<BiometricAccessGate><PermissionGate><AcessoCurso /></PermissionGate></BiometricAccessGate>} />

            {/* Admin Protected - Core */}
            <Route path="/admin" element={<AdminLayout><Dashboard /></AdminLayout>} />
            <Route path="/admin/requests" element={<AdminLayout><Requests /></AdminLayout>} />
            <Route path="/admin/customers" element={<AdminLayout><Customers /></AdminLayout>} />
            <Route path="/admin/contracts" element={<AdminLayout><AdminContracts /></AdminLayout>} />
            <Route path="/admin/investors" element={<AdminLayout><Investors /></AdminLayout>} />
            <Route path="/admin/contract-migrations" element={<AdminLayout><ContractMigrations /></AdminLayout>} />
            <Route path="/admin/collection-automation" element={<AdminLayout><CollectionAutomationPanel /></AdminLayout>} />
            <Route path="/admin/import-contacts" element={<AdminLayout><ImportContacts /></AdminLayout>} />
            <Route path="/admin/data-search" element={<AdminLayout><DataSearchNew /></AdminLayout>} />
            <Route path="/admin/data-search-old" element={<AdminLayout><DataSearch /></AdminLayout>} />
            <Route path="/admin/partners" element={<AdminLayout><Partners /></AdminLayout>} />
            <Route path="/admin/qualification-leads" element={<AdminLayout><QualificationLeadsAdmin /></AdminLayout>} />
            <Route path="/admin/settings" element={<AdminLayout><Settings /></AdminLayout>} />
            <Route path="/admin/curso" element={<AdminLayout><CursoAdmin /></AdminLayout>} />
            <Route path="/admin/metodo-tubarao" element={<AdminLayout><MetodoTubarao /></AdminLayout>} />

            {/* Admin Protected - Hubs Unificados */}
            <Route path="/admin/finance-hub" element={<AdminLayout><FinanceHub /></AdminLayout>} />
            <Route path="/admin/communication-hub" element={<AdminLayout><CommunicationHub /></AdminLayout>} />
            <Route path="/admin/security-hub" element={<AdminLayout><SecurityHub /></AdminLayout>} />
            <Route path="/admin/ai-hub" element={<AdminLayout><AIHub /></AdminLayout>} />
            <Route path="/admin/analytics-hub" element={<AdminLayout><AnalyticsHub /></AdminLayout>} />

            {/* Admin Protected - Páginas legadas (ainda acessíveis) */}
            <Route path="/admin/finance" element={<AdminLayout><FinancePage /></AdminLayout>} />
            <Route path="/admin/agenda" element={<AdminLayout><AgendaPage /></AdminLayout>} />
            <Route path="/admin/score" element={<AdminLayout><ScorePage /></AdminLayout>} />
            <Route path="/admin/documents" element={<AdminLayout><DocumentsPage /></AdminLayout>} />
          </Routes>
          {IS_DEMO && DemoBar && (
            <React.Suspense fallback={null}>
              <DemoBar />
            </React.Suspense>
          )}
        </Router>
      </ToastProvider>
    </BrandProvider>
  );
}

export default App;
