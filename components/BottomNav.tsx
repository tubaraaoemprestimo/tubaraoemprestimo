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
      className={`flex flex-col items-center justify-center w-full h-full gap-1.5 transition-all ${
        isActive(path)
          ? 'text-white'
          : 'text-zinc-500 hover:text-zinc-300'
      }`}
    >
      <div className={`flex items-center justify-center w-12 h-12 rounded-2xl transition-all ${
        isActive(path)
          ? 'bg-[#FF0000] shadow-lg shadow-[#FF0000]/30'
          : 'bg-transparent'
      }`}>
        <Icon size={26} strokeWidth={isActive(path) ? 2.5 : 2} />
      </div>
      <span className={`text-xs font-semibold ${isActive(path) ? 'text-white' : 'text-zinc-500'}`}>
        {label}
      </span>
    </button>
  );

  return (
    <div className="fixed bottom-0 left-0 w-full h-24 bg-black/95 backdrop-blur-xl border-t border-zinc-800 z-40 md:hidden pb-safe">
      <div className="flex justify-around items-center h-full max-w-md mx-auto px-2">
        <NavItem path="/client/dashboard" icon={LayoutDashboard} label="Início" />
        <NavItem path="/client/contracts" icon={FileText} label="Contratos" />
        <NavItem path="/client/documents" icon={FileCheck} label="Documentos" />
        <NavItem path="/client/profile" icon={User} label="Perfil" />
      </div>
    </div>
  );
};