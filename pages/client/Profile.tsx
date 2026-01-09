import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, User, Shield, FileText, LogOut, Lock, Camera, Loader2, X } from 'lucide-react';
import { Button } from '../../components/Button';
import { supabaseService } from '../../services/supabaseService';
import { ScoreGauge } from '../../components/ScoreGauge';
import { useToast } from '../../components/Toast';

export const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Modal States
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  
  // Password Form State
  const [passData, setPassData] = useState({ current: '', new: '', confirm: '' });
  const [loadingPass, setLoadingPass] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = () => {
    const u = supabaseService.auth.getUser();
    if (u) {
      setUser(u);
      setLoading(false);
    } else {
      navigate('/login');
    }
  };

  const handleLogout = async () => {
    await supabaseService.auth.signOut();
    navigate('/login');
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = async () => {
            const result = reader.result as string;
            await supabaseService.updateUserAvatar(result);
            setUser((prev: any) => ({ ...prev, avatarUrl: result }));
            addToast("Foto de perfil atualizada!", 'success');
        };
        reader.readAsDataURL(file);
    }
  };

  const handleChangePassword = async () => {
      if (!passData.current || !passData.new || !passData.confirm) {
          addToast("Preencha todos os campos.", 'warning');
          return;
      }
      if (passData.new !== passData.confirm) {
          addToast("As novas senhas não conferem.", 'error');
          return;
      }

      setLoadingPass(true);
      await supabaseService.changePassword(passData.current, passData.new);
      setLoadingPass(false);
      
      addToast("Senha alterada com sucesso!", 'success');
      setIsPasswordModalOpen(false);
      setPassData({ current: '', new: '', confirm: '' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-[#D4AF37] flex-col gap-4">
        <Loader2 size={40} className="animate-spin" />
        <span className="text-sm font-medium animate-pulse">Carregando perfil...</span>
      </div>
    );
  }

  if (!user) return null;

  const userInitials = (user.name || 'CL').substring(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-black text-white p-6 pb-24">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
           <button onClick={() => navigate('/client/dashboard')} className="p-2 hover:bg-zinc-900 rounded-full text-zinc-400 hover:text-white transition-colors">
              <ChevronLeft size={24} />
           </button>
           <h1 className="text-2xl font-bold text-[#D4AF37]">Meu Perfil</h1>
        </div>

        <div className="space-y-6 animate-in slide-in-from-bottom-4">
          
          {/* User Info Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 flex flex-col items-center">
             <div className="relative group cursor-pointer">
                {user.avatarUrl ? (
                    <img 
                        src={user.avatarUrl} 
                        alt="Profile" 
                        className="w-24 h-24 rounded-full object-cover border-2 border-[#D4AF37] shadow-[0_0_20px_rgba(212,175,55,0.2)]"
                    />
                ) : (
                    <div className="w-24 h-24 rounded-full bg-black border-2 border-[#D4AF37] flex items-center justify-center text-[#D4AF37] text-3xl font-bold shadow-[0_0_20px_rgba(212,175,55,0.2)]">
                        {userInitials}
                    </div>
                )}
                
                <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera size={24} className="text-white" />
                </div>
                
                <input 
                    type="file" 
                    accept="image/*" 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={handleAvatarUpload}
                />
             </div>

             <h2 className="text-xl font-bold text-white mt-4">{user.name || 'Cliente'}</h2>
             <p className="text-zinc-500 text-sm mb-6">Cliente Premium</p>

             <div className="w-full space-y-4">
                <InfoRow icon={User} label="CPF" value={user.id === 'admin_1' ? 'ADMINISTRADOR' : '123.***.***-00'} />
                
                <div className="bg-black border border-zinc-800 rounded-xl p-4 flex flex-col items-center">
                    <ScoreGauge score={user.id === 'admin_1' ? 1000 : 850} />
                </div>
             </div>
          </div>

          {/* Settings Section */}
          <div className="space-y-4">
             <h3 className="text-zinc-500 text-sm uppercase tracking-widest pl-2">Configurações</h3>
             
             <button onClick={() => setIsPasswordModalOpen(true)} className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center gap-4 hover:border-[#D4AF37]/50 transition-colors group">
                <div className="p-2 bg-black rounded-lg text-zinc-400 group-hover:text-[#D4AF37] transition-colors">
                   <Lock size={20} />
                </div>
                <div className="flex-1 text-left">
                   <div className="text-white font-medium">Alterar Senha</div>
                   <div className="text-xs text-zinc-500">Proteger minha conta</div>
                </div>
                <ChevronLeft size={16} className="rotate-180 text-zinc-600" />
             </button>

             <button onClick={() => setIsTermsModalOpen(true)} className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center gap-4 hover:border-[#D4AF37]/50 transition-colors group">
                <div className="p-2 bg-black rounded-lg text-zinc-400 group-hover:text-[#D4AF37] transition-colors">
                   <FileText size={20} />
                </div>
                <div className="flex-1 text-left">
                   <div className="text-white font-medium">Termos de Uso</div>
                   <div className="text-xs text-zinc-500">Visualizar contratos aceitos</div>
                </div>
                <ChevronLeft size={16} className="rotate-180 text-zinc-600" />
             </button>
          </div>

          <div className="pt-8">
             <Button variant="danger" onClick={handleLogout} className="w-full bg-red-900/20 text-red-500 border border-red-900/50 hover:bg-red-900/40">
                <LogOut size={18} /> Sair do App
             </Button>
          </div>

        </div>
      </div>

      {/* Change Password Modal */}
      {isPasswordModalOpen && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-white">Alterar Senha</h3>
                      <button onClick={() => setIsPasswordModalOpen(false)} className="text-zinc-500 hover:text-white"><X /></button>
                  </div>
                  <div className="space-y-4">
                      <input 
                        type="password" 
                        placeholder="Senha Atual"
                        value={passData.current}
                        onChange={e => setPassData({...passData, current: e.target.value})}
                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                      />
                      <input 
                        type="password" 
                        placeholder="Nova Senha"
                        value={passData.new}
                        onChange={e => setPassData({...passData, new: e.target.value})}
                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                      />
                      <input 
                        type="password" 
                        placeholder="Confirmar Nova Senha"
                        value={passData.confirm}
                        onChange={e => setPassData({...passData, confirm: e.target.value})}
                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                      />
                      <Button onClick={handleChangePassword} isLoading={loadingPass} className="w-full mt-4">
                          Atualizar Senha
                      </Button>
                  </div>
              </div>
          </div>
      )}

      {/* Terms Modal */}
      {isTermsModalOpen && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl">
                  <div className="p-6 border-b border-zinc-800 flex justify-between items-center shrink-0">
                      <h3 className="text-xl font-bold text-white">Termos de Uso</h3>
                      <button onClick={() => setIsTermsModalOpen(false)} className="text-zinc-500 hover:text-white"><X /></button>
                  </div>
                  <div className="p-6 overflow-y-auto text-sm text-zinc-300 space-y-4">
                      <p><strong>1. ACEITAÇÃO</strong><br/>Ao utilizar a plataforma, você concorda com a coleta e processamento de seus dados para fins de análise de crédito.</p>
                      <p><strong>2. VERACIDADE</strong><br/>Você declara que todas as informações, documentos e biometria fornecidos são verdadeiros e autênticos.</p>
                      <p><strong>3. JUROS E MULTAS</strong><br/>Estou ciente das taxas de juros aplicadas e que o atraso no pagamento acarretará multas e juros moratórios conforme contrato.</p>
                      <p><strong>4. PRIVACIDADE</strong><br/>Seus dados estão protegidos conforme a LGPD e são utilizados exclusivamente para fins de concessão de crédito.</p>
                  </div>
                  <div className="p-6 border-t border-zinc-800 bg-black/50 rounded-b-2xl shrink-0">
                      <Button onClick={() => setIsTermsModalOpen(false)} className="w-full">
                          Fechar
                      </Button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

const InfoRow = ({ icon: Icon, label, value }: any) => (
   <div className="flex items-center justify-between p-3 rounded-xl bg-black border border-zinc-800">
      <div className="flex items-center gap-3">
         <Icon size={18} className="text-zinc-500" />
         <span className="text-zinc-400 text-sm">{label}</span>
      </div>
      <span className="font-mono text-sm text-white">{value}</span>
   </div>
);