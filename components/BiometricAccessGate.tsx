import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Fingerprint, Loader2, Monitor, ShieldCheck } from 'lucide-react';
import { Button } from './Button';
import { biometricService } from '../services/biometricService';
import { antifraudService } from '../services/antifraudService';
import { apiService } from '../services/apiService';

interface BiometricAccessGateProps {
  children: React.ReactNode;
}

const getSessionKey = (userId: string) => `biometric_verified_${userId}`;
const getSkipKey = (userId: string) => `biometric_skipped_${userId}`;

// Detecta se o dispositivo e mobile (onde biometria faz sentido)
const isMobileDevice = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

export const BiometricAccessGate: React.FC<BiometricAccessGateProps> = ({ children }) => {
  const navigate = useNavigate();
  const user = useMemo(() => apiService.auth.getUser(), []);

  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const runVerification = async () => {
      // Admin nao precisa de biometria
      if (!user || user.role !== 'CLIENT') {
        if (!cancelled) setVerifying(false);
        return;
      }

      const sessionKey = getSessionKey(user.id);
      const skipKey = getSkipKey(user.id);

      // Ja verificou ou pulou nesta sessao
      const alreadyVerified = sessionStorage.getItem(sessionKey);
      const alreadySkipped = sessionStorage.getItem(skipKey);
      if (alreadyVerified || alreadySkipped) {
        if (!cancelled) setVerifying(false);
        return;
      }

      try {
        const platformAvailable = await biometricService.isPlatformAuthenticatorAvailable();

        // Se biometria nao esta disponivel (PC sem Windows Hello, etc), pula automaticamente
        if (!platformAvailable) {
          antifraudService.logRiskEvent('BIOMETRIC_UNAVAILABLE', user.id, {
            flow: 'APP_ACCESS_GATE',
            reason: 'platform_authenticator_unavailable',
            isMobile: isMobileDevice(),
          }).catch(() => {});

          // No PC: pula silenciosamente. No mobile: mostra aviso mas permite continuar
          sessionStorage.setItem(skipKey, new Date().toISOString());
          if (!cancelled) setVerifying(false);
          return;
        }

        // So tenta biometria automatica em dispositivos moveis
        // No PC, pula para evitar prompts de chave de acesso Google/Windows Hello indesejados
        if (!isMobileDevice()) {
          antifraudService.logRiskEvent('BIOMETRIC_SKIPPED_DESKTOP', user.id, {
            flow: 'APP_ACCESS_GATE',
            reason: 'desktop_device',
          }).catch(() => {});

          sessionStorage.setItem(skipKey, new Date().toISOString());
          if (!cancelled) setVerifying(false);
          return;
        }

        // Mobile: tenta biometria normalmente
        antifraudService.logRiskEvent('BIOMETRIC_CHALLENGE', user.id, {
          flow: 'APP_ACCESS_GATE',
          stage: 'challenge_started',
        }).catch(() => {});

        let hasCredential = await biometricService.hasCredential(user.id);

        if (!hasCredential) {
          const registerResult = await biometricService.register(user.id, user.email, user.name || 'Usuário');

          if (!registerResult.success) {
            antifraudService.logRiskEvent('BIOMETRIC_REGISTER_FAILED', user.id, {
              flow: 'APP_ACCESS_GATE',
              reason: registerResult.error || 'register_failed',
            }).catch(() => {});

            // Falhou registrar: permite continuar sem biometria
            if (!cancelled) {
              setError(registerResult.error || 'Não foi possível cadastrar biometria neste dispositivo.');
              setVerifying(false);
            }
            return;
          }

          antifraudService.logRiskEvent('BIOMETRIC_REGISTER_SUCCESS', user.id, {
            flow: 'APP_ACCESS_GATE',
          }).catch(() => {});

          hasCredential = true;
        }

        if (!hasCredential) {
          // Sem credencial: permite continuar
          sessionStorage.setItem(skipKey, new Date().toISOString());
          if (!cancelled) setVerifying(false);
          return;
        }

        const authResult = await biometricService.authenticateForUser(user.id);
        if (!authResult.success) {
          antifraudService.logRiskEvent('BIOMETRIC_FAILED', user.id, {
            flow: 'APP_ACCESS_GATE',
            reason: authResult.error || 'auth_failed',
          }).catch(() => {});

          if (!cancelled) {
            setError(authResult.error || 'Autenticação biométrica falhou.');
            setVerifying(false);
          }
          return;
        }

        sessionStorage.setItem(sessionKey, new Date().toISOString());

        antifraudService.logRiskEvent('BIOMETRIC_SUCCESS', user.id, {
          flow: 'APP_ACCESS_GATE',
          credentialId: authResult.credentialId,
        }).catch(() => {});

        if (!cancelled) {
          setError(null);
          setVerifying(false);
        }
      } catch (err: any) {
        antifraudService.logRiskEvent('BIOMETRIC_FAILED', user?.id, {
          flow: 'APP_ACCESS_GATE',
          reason: err?.message || 'unexpected_error',
        }).catch(() => {});

        if (!cancelled) {
          setError('Falha na validação biométrica. Tente novamente.');
          setVerifying(false);
        }
      }
    };

    runVerification();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // Pular biometria e continuar
  const handleSkip = () => {
    if (user) {
      sessionStorage.setItem(getSkipKey(user.id), new Date().toISOString());
      antifraudService.logRiskEvent('BIOMETRIC_SKIPPED_BY_USER', user.id, {
        flow: 'APP_ACCESS_GATE',
      }).catch(() => {});
    }
    setError(null);
    setVerifying(false);
  };

  const handleTryAgain = () => {
    setError(null);
    setVerifying(true);
    const sessionKey = user ? getSessionKey(user.id) : '';
    if (sessionKey) {
      sessionStorage.removeItem(sessionKey);
    }
    window.location.reload();
  };

  const handleBackToLogin = async () => {
    try {
      if (user) {
        sessionStorage.removeItem(getSessionKey(user.id));
        sessionStorage.removeItem(getSkipKey(user.id));
      }
      await apiService.auth.signOut();
    } finally {
      navigate('/login');
    }
  };

  if (!user || user.role !== 'CLIENT') {
    return <>{children}</>;
  }

  if (verifying) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center mx-auto mb-4">
            <Fingerprint size={30} className="text-[#D4AF37]" />
          </div>
          <h2 className="text-white text-xl font-bold mb-2">Validando acesso com biometria</h2>
          <p className="text-zinc-400 text-sm mb-6">Use Face ID, Touch ID ou impressão digital para entrar.</p>
          <div className="flex items-center justify-center text-zinc-300 gap-2">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Aguardando autenticação do dispositivo...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <div className="w-14 h-14 rounded-full bg-red-900/20 border border-red-500/30 flex items-center justify-center mb-4">
            <AlertCircle size={24} className="text-red-400" />
          </div>
          <h2 className="text-white text-xl font-bold mb-2">Falha na autenticação biométrica</h2>
          <p className="text-zinc-300 text-sm mb-6">{error}</p>

          <div className="space-y-3">
            <Button className="w-full" onClick={handleTryAgain}>
              <ShieldCheck size={18} /> Tentar novamente
            </Button>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleSkip}>
              <Monitor size={18} /> Continuar sem biometria
            </Button>
            <Button variant="secondary" className="w-full" onClick={handleBackToLogin}>
              Voltar para login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default BiometricAccessGate;
