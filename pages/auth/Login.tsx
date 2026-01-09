import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, ArrowRight, ShieldCheck, ScanFace, AlertCircle, Smartphone } from 'lucide-react';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { supabaseService } from '../../services/supabaseService';
import { InstallPwaButton } from '../../components/InstallPwaButton';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ identifier: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If we are visiting login, we usually want to ensure we are logged out
    // or if the user is already valid, redirect to dashboard.
    // For this specific request ("Start from Login"), we will force logout 
    // to ensure a clean slate, unless we want to auto-redirect.
    // Let's stick to cleaning session to behave like a true "Entry Gate".
    supabaseService.auth.signOut();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.identifier || !formData.password) {
        setError("Preencha todos os campos.");
        return;
    }
    await performLogin(formData);
  };

  const performLogin = async (creds: any) => {
    setLoading(true);
    setError(null);
    try {
      const { user } = await supabaseService.auth.signIn(creds) as any;
      if (user) {
        if (user.role === 'ADMIN') {
          navigate('/admin');
        } else {
          navigate('/client/dashboard');
        }
      } else {
        setError('Credenciais inválidas.');
      }
    } catch (error) {
      console.error(error);
      setError('Erro ao fazer login. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async () => {
    await performLogin({ identifier: 'admin', password: 'admin' });
  };

  const handleFaceIDLogin = () => {
    setIsScanning(true);
    // Simulate scanning process
    setTimeout(() => {
        // Automatically login as client after scan
        performLogin({ identifier: '123.456.789-00', password: 'mock_password' });
    }, 2500);
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0,rgba(255,0,0,0.1),transparent_70%)] pointer-events-none"></div>

      {isScanning && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center animate-in fade-in">
            <div className="relative w-64 h-64 border-2 border-zinc-800 rounded-full flex items-center justify-center overflow-hidden mb-8">
                {/* Scanning Laser */}
                <div className="absolute top-0 left-0 w-full h-1 bg-green-500 shadow-[0_0_15px_#22c55e] animate-[scan_2s_ease-in-out_infinite]"></div>
                
                {/* Grid Overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,0,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,0,0.1)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
                
                <ScanFace size={120} className="text-zinc-700 animate-pulse" />
                
                {/* Face Corners */}
                <div className="absolute top-8 left-8 w-8 h-8 border-t-2 border-l-2 border-green-500 rounded-tl-xl"></div>
                <div className="absolute top-8 right-8 w-8 h-8 border-t-2 border-r-2 border-green-500 rounded-tr-xl"></div>
                <div className="absolute bottom-8 left-8 w-8 h-8 border-b-2 border-l-2 border-green-500 rounded-bl-xl"></div>
                <div className="absolute bottom-8 right-8 w-8 h-8 border-b-2 border-r-2 border-green-500 rounded-br-xl"></div>
            </div>
            <h2 className="text-xl font-bold text-white tracking-widest animate-pulse">VERIFICANDO BIOMETRIA...</h2>
        </div>
      )}

      <div className="w-full max-w-md z-10">
        {/* Logo */}
        <div className="flex flex-col items-center justify-center gap-3 mb-8">
             <Logo size="lg" />
             <p className="text-zinc-500 uppercase tracking-widest text-xs mt-2">Portal de Acesso</p>
             
             {/* Install App Button */}
             <div className="mt-2">
                <InstallPwaButton />
             </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-shark transition-colors">
                <User size={20} />
              </div>
              <input 
                type="text" 
                placeholder="CPF ou CNPJ" 
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-zinc-600 focus:outline-none focus:border-shark focus:ring-1 focus:ring-shark transition-all"
                value={formData.identifier}
                onChange={(e) => setFormData({...formData, identifier: e.target.value})}
              />
            </div>

            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-shark transition-colors">
                <Lock size={20} />
              </div>
              <input 
                type="password" 
                placeholder="Senha" 
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-zinc-600 focus:outline-none focus:border-shark focus:ring-1 focus:ring-shark transition-all"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-500 text-sm bg-red-900/10 p-3 rounded-lg border border-red-900/50">
                <AlertCircle size={16} /> {error}
            </div>
          )}

          <div className="flex justify-end">
            <button type="button" className="text-sm text-zinc-500 hover:text-shark transition-colors">
              Esqueceu sua senha?
            </button>
          </div>

          <div className="flex gap-4">
            <Button 
                variant="primary" 
                className="flex-1 py-4 text-lg uppercase tracking-wide" 
                isLoading={loading}
            >
                ENTRAR <ArrowRight size={20} />
            </Button>
            
            <button 
                type="button"
                onClick={handleFaceIDLogin}
                className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 flex items-center justify-center text-[#D4AF37] hover:border-[#D4AF37] hover:bg-zinc-800/80 transition-all shadow-lg"
                title="Entrar com Face ID"
            >
                <ScanFace size={24} />
            </button>
          </div>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-zinc-800"></div>
            <span className="flex-shrink-0 mx-4 text-zinc-600 text-xs uppercase tracking-widest">Ou</span>
            <div className="flex-grow border-t border-zinc-800"></div>
          </div>

          <Button 
            type="button"
            variant="secondary" 
            className="w-full py-4 text-sm font-semibold tracking-wide bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 border-zinc-800" 
            onClick={handleAdminLogin}
            disabled={loading}
          >
            <ShieldCheck size={18} /> ACESSAR COMO ADMIN
          </Button>
        </form>
        
        <div className="mt-8 text-center flex flex-col gap-4">
          <p className="text-zinc-500 text-sm">
            Não tem uma conta? <button onClick={() => navigate('/wizard')} className="text-gold hover:text-white transition-colors font-semibold">Cadastre-se</button>
          </p>
          
          <button 
            onClick={() => navigate('/demo')} 
            className="text-xs text-zinc-600 hover:text-[#D4AF37] transition-colors flex items-center justify-center gap-2"
          >
            <Smartphone size={14} /> Modo Apresentação (Demo)
          </button>
        </div>
      </div>
      
      <style>{`
        @keyframes scan {
            0% { top: 0%; opacity: 0.5; }
            50% { top: 100%; opacity: 1; }
            100% { top: 0%; opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};