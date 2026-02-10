import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Fingerprint, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from './Button';
import { biometricService } from '../services/biometricService';
import { antifraudService } from '../services/antifraudService';
import { supabaseService } from '../services/supabaseService';

interface BiometricAccessGateProps {
  children: React.ReactNode;
}

const getSessionKey = (userId: string) => `biometric_verified_${userId}`;

export const BiometricAccessGate: React.FC<BiometricAccessGateProps> = ({ children }) => {
  const navigate = useNavigate();
  const user = useMemo(() => supabaseService.auth.getUser(), []);

  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const runVerification = async () => {
      if (!user || user.role !== 'CLIENT') {
        if (!cancelled) setVerifying(false);
        return;
      }

      const sessionKey = getSessionKey(user.id);
      const alreadyVerified = sessionStorage.getItem(sessionKey);
      if (alreadyVerified) {
        if (!cancelled) setVerifying(false);
        return;
      }

      try {
        const platformAvailable = await biometricService.isPlatformAuthenticatorAvailable();
        if (!platformAvailable) {
          await antifraudService.logRiskEvent('BIOMETRIC_UNAVAILABLE', user.id, {
            flow: 'APP_ACCESS_GATE',
            reason: 'platform_authenticator_unavailable',
          });
          if (!cancelled) {
            setError('Este dispositivo não possui biometria/facial ativa. Ative Face ID ou impressão digital para acessar.');
            setVerifying(false);
          }
          return;
        }

        await antifraudService.logRiskEvent('BIOMETRIC_CHALLENGE', user.id, {
          flow: 'APP_ACCESS_GATE',
          stage: 'challenge_started',
        });

        let hasCredential = await biometricService.hasCredential(user.id);

        if (!hasCredential) {
          const registerResult = await biometricService.register(user.id, user.email, user.name || 'Usuário');

          if (!registerResult.success) {
            await antifraudService.logRiskEvent('BIOMETRIC_REGISTER_FAILED', user.id, {
              flow: 'APP_ACCESS_GATE',
              reason: registerResult.error || 'register_failed',
            });

            if (!cancelled) {
              setError(registerResult.error || 'Não foi possível cadastrar biometria neste dispositivo.');
              setVerifying(false);
            }
            return;
          }

          await antifraudService.logRiskEvent('BIOMETRIC_REGISTER_SUCCESS', user.id, {
            flow: 'APP_ACCESS_GATE',
          });

          hasCredential = true;
        }

        if (!hasCredential) {
          if (!cancelled) {
            setError('Nenhuma credencial biométrica encontrada para este usuário.');
            setVerifying(false);
          }
          return;
        }

        const authResult = await biometricService.authenticateForUser(user.id);
        if (!authResult.success) {
          await antifraudService.logRiskEvent('BIOMETRIC_FAILED', user.id, {
            flow: 'APP_ACCESS_GATE',
            reason: authResult.error || 'auth_failed',
          });

          if (!cancelled) {
            setError(authResult.error || 'Autenticação biométrica falhou.');
            setVerifying(false);
          }
          return;
        }

        sessionStorage.setItem(sessionKey, new Date().toISOString());

        await antifraudService.logRiskEvent('BIOMETRIC_SUCCESS', user.id, {
          flow: 'APP_ACCESS_GATE',
          credentialId: authResult.credentialId,
        });

        if (!cancelled) {
          setError(null);
          setVerifying(false);
        }
      } catch (err: any) {
        await antifraudService.logRiskEvent('BIOMETRIC_FAILED', user?.id, {
          flow: 'APP_ACCESS_GATE',
          reason: err?.message || 'unexpected_error',
        });

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
      }
      await supabaseService.auth.signOut();
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
