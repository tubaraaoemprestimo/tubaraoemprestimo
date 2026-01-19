import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, User, FileCheck } from 'lucide-react';

export const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const NavItem = ({ path, icon: Icon, label }: { path: string, icon: any, label: string }) => (
    <button
      onClick={() => navigate(path)}
      className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${isActive(path) ? 'text-[#D4AF37]' : 'text-zinc-500 hover:text-zinc-300'}`}
    >
      <Icon size={22} strokeWidth={isActive(path) ? 2.5 : 2} />
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );

  return (
    <div className="fixed bottom-0 left-0 w-full h-16 bg-black/90 backdrop-blur-lg border-t border-zinc-800 z-40 md:hidden pb-safe">
      <div className="flex justify-around items-center h-full max-w-md mx-auto">
        <NavItem path="/client/dashboard" icon={LayoutDashboard} label="Início" />
        <NavItem path="/client/contracts" icon={FileText} label="Contratos" />
        <NavItem path="/client/documents" icon={FileCheck} label="Documentos" />
        <NavItem path="/client/profile" icon={User} label="Perfil" />
      </div>
    </div>
  );
};