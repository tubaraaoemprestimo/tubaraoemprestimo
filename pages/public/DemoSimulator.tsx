import React, { useState, useEffect } from 'react';
import { Smartphone, RotateCcw, LayoutDashboard, UserPlus, LogIn, ExternalLink, QrCode, Home } from 'lucide-react';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';

export const DemoSimulator: React.FC = () => {
  // Lógica segura para URL: Pega a origem atual (ex: https://meu-app.vercel.app)
  // Remove a rota atual (/demo) para pegar a raiz limpa
  const getCurrentBaseUrl = () => {
      const url = window.location.href;
      const baseUrl = url.split('#')[0]; // Remove hash se existir
      return baseUrl.replace(/\/demo\/?$/, ''); // Remove /demo do final
  };

  const rootUrl = getCurrentBaseUrl();
  const [appUrl, setAppUrl] = useState(`${rootUrl}#/login`);
  const [key, setKey] = useState(0); 

  const navigateIframe = (path: string) => {
    // Garante que o iframe aponte para a rota hash correta
    const newUrl = `${rootUrl}#${path}`;
    setAppUrl(newUrl);
    setKey(prev => prev + 1); 
  };

  const refreshIframe = () => {
    setKey(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col lg:flex-row overflow-hidden font-sans text-white">
      
      {/* --- LEFT CONTROL PANEL --- */}
      <div className="w-full lg:w-[400px] p-8 border-r border-zinc-900 bg-black flex flex-col z-10 overflow-y-auto">
        <div className="mb-8">
          <Logo size="md" />
          <h1 className="text-xl font-bold mt-4 text-white">Ambiente de Demonstração</h1>
          <p className="text-zinc-500 text-sm mt-2">
            Simulador mobile interativo para apresentações.
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-xs font-bold text-[#D4AF37] uppercase tracking-widest mb-4">Navegação Rápida</h3>
            <div className="grid gap-3">
              <ControlBtn 
                icon={Home} 
                label="Landing Page" 
                desc="Tela inicial pública"
                onClick={() => navigateIframe('/')} 
              />
              <ControlBtn 
                icon={UserPlus} 
                label="Wizard de Cadastro" 
                desc="Fluxo de novo cliente"
                onClick={() => navigateIframe('/wizard')} 
              />
              <ControlBtn 
                icon={LogIn} 
                label="Login" 
                desc="Acesso ao sistema"
                onClick={() => navigateIframe('/login')} 
              />
              <ControlBtn 
                icon={LayoutDashboard} 
                label="Dashboard Cliente" 
                desc="Área logada (Requer auth)"
                onClick={() => navigateIframe('/client/dashboard')} 
              />
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Ferramentas</h3>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={refreshIframe} className="flex-1">
                <RotateCcw size={16} className="mr-2" /> Recarregar
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.open(rootUrl, '_blank')} className="flex-1">
                <ExternalLink size={16} className="mr-2" /> Abrir Aba
              </Button>
            </div>
          </div>

          <div className="p-4 bg-zinc-900 rounded-xl border border-zinc-800">
            <div className="flex items-start gap-4">
               <div className="bg-white p-2 rounded-lg">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(rootUrl)}`} 
                    alt="QR" 
                    className="w-20 h-20"
                  />
               </div>
               <div>
                  <h4 className="font-bold text-white flex items-center gap-2"><QrCode size={16} className="text-[#D4AF37]"/> Teste Real</h4>
                  <p className="text-xs text-zinc-400 mt-1">Escaneie para testar no celular.</p>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- RIGHT SIMULATOR AREA --- */}
      <div className="flex-1 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-900 via-black to-black flex items-center justify-center p-8 relative">
        <div className="relative mx-auto border-zinc-800 bg-zinc-950 border-[14px] rounded-[2.5rem] h-[800px] w-[400px] shadow-2xl flex flex-col overflow-hidden z-20 ring-1 ring-white/10">
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 h-[30px] w-[120px] bg-black rounded-b-2xl z-30 flex justify-center items-center">
                <div className="w-16 h-4 bg-zinc-900/50 rounded-full mt-1"></div>
            </div>
            
            <div className="h-full w-full bg-black overflow-hidden rounded-[2rem] relative">
               <iframe 
                 key={key}
                 src={appUrl}
                 className="w-full h-full border-none"
                 title="App Simulator"
               />
            </div>
        </div>
      </div>
    </div>
  );
};

const ControlBtn = ({ icon: Icon, label, desc, onClick }: any) => (
  <button 
    onClick={onClick}
    className="flex items-center gap-3 p-3 w-full bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 hover:border-[#D4AF37]/50 transition-all text-left group"
  >
    <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-zinc-400 group-hover:text-[#D4AF37] group-hover:scale-110 transition-all">
      <Icon size={20} />
    </div>
    <div>
      <div className="font-bold text-white text-sm group-hover:text-[#D4AF37] transition-colors">{label}</div>
      <div className="text-xs text-zinc-500">{desc}</div>
    </div>
  </button>
);