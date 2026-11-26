import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Fingerprint, Loader2, ScanFace, AlertCircle } from 'lucide-react';
import { Button } from './Button';
import { biometricService } from '../services/biometricService';
import { apiService } from '../services/apiService';

/**
 * Desbloqueio do app com a biometria do aparelho.
 * - Entrou nesta sessão (senha ou biometria)? Passa direto.
 * - Reabriu o app com a sessão salva e a biometria está ativada aqui? Pede a digital/rosto (um toque).
 * - Sem biometria ativada neste aparelho: passa direto (o convite para ativar aparece no login).
 * Nunca prende o cliente: sempre há "Entrar com senha".
 */
const verifiedKey = (id: string) => `biometric_verified_${id}`;
const IS_DEMO = import.meta.env.VITE_DEMO_MODE === 'true';
const isApple = () => /iPhone|iPad|Mac/i.test(navigator.userAgent);

export const BiometricAccessGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const user = useMemo(() => apiService.auth.getUser() as any, []);
  const [state, setState] = useState<'checking' | 'locked' | 'open'>('checking');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (IS_DEMO || !user || user.role !== 'CLIENT' || sessionStorage.getItem(verifiedKey(user.id))) { setState('open'); return; }
    // Só pede biometria se ela está ativada neste aparelho para esta conta.
    let local: any = null;
    try { local = JSON.parse(localStorage.getItem('biometric_credential') || 'null'); } catch { /* ok */ }
    if (!local || local.userId !== user.id) { setState('open'); return; }
    biometricService.isPlatformAuthenticatorAvailable().then(ok => setState(ok ? 'locked' : 'open'));
  }, [user]);

  const unlock = async () => {
    setBusy(true); setError(null);
    const r = await biometricService.login();
    setBusy(false);
    if (r.success && r.user?.id === user.id) { sessionStorage.setItem(verifiedKey(user.id), new Date().toISOString()); setState('open'); return; }
    if (r.success) { window.location.reload(); return; } // entrou em outra conta deste aparelho
    setError(r.error || 'Não foi possível confirmar. Tente de novo ou entre com a senha.');
  };

  const usePassword = async () => { await apiService.auth.signOut(); navigate('/login'); };

  if (state === 'open') return <>{children}</>;
  if (state === 'checking') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 size={32} className="text-[#D4AF37] animate-spin" />
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <button onClick={unlock} disabled={busy} aria-label="Desbloquear com biometria"
          className="w-28 h-28 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/40 flex items-center justify-center mx-auto mb-6 active:scale-95 transition-transform">
          {busy ? <Loader2 size={44} className="text-[#D4AF37] animate-spin" /> : isApple() ? <ScanFace size={52} className="text-[#D4AF37]" /> : <Fingerprint size={52} className="text-[#D4AF37]" />}
        </button>
        <h2 className="text-white text-2xl font-bold mb-2">Olá{user?.name ? `, ${String(user.name).split(' ')[0]}` : ''}!</h2>
        <p className="text-zinc-400 text-sm mb-6">Toque para entrar com {isApple() ? 'Face ID ou Touch ID' : 'a digital ou o rosto'}.</p>
        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/10 p-3 rounded-lg border border-red-900/50 mb-4 text-left">
            <AlertCircle size={16} className="flex-shrink-0" /> {error}
          </div>
        )}
        <Button className="w-full py-4 font-bold" onClick={unlock} isLoading={busy}>
          {isApple() ? <ScanFace size={20} /> : <Fingerprint size={20} />} Desbloquear
        </Button>
        <button onClick={usePassword} className="w-full text-zinc-500 hover:text-white text-sm py-3 mt-2">Entrar com senha</button>
      </div>
    </div>
  );
};

export default BiometricAccessGate;
