import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, ArrowRight, ShieldCheck, ScanFace, AlertCircle, Smartphone, Mail, Loader2, CheckCircle2, X, Fingerprint } from 'lucide-react';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { apiService } from '../../services/apiService';
import { InstallPwaButton } from '../../components/InstallPwaButton';
import { biometricService } from '../../services/biometricService';
import { antifraudService } from '../../services/antifraudService';
import { locationTrackingService } from '../../services/locationTrackingService';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const IS_DEMO = import.meta.env.VITE_DEMO_MODE === 'true';
  const [formData, setFormData] = useState({ identifier: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricHasCredential, setBiometricHasCredential] = useState(false);
  // Depois do login com senha: oferecer ativar a biometria do aparelho (um toque).
  const [offerBio, setOfferBio] = useState<null | { user: any; go: string }>(null);
  const [bioActivating, setBioActivating] = useState(false);
  const [bioActivateError, setBioActivateError] = useState<string | null>(null);

  // Modal Esqueceu Senha
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [emailConfirmed, setEmailConfirmed] = useState(false);

  useEffect(() => {
    // Detectar se veio da confirmação de email
    const hash = window.location.hash;
    if (hash.includes('confirmed=true')) {
      setEmailConfirmed(true);
      // Limpar URL
      window.history.replaceState(null, '', window.location.pathname + '#/login');
    }

    // Verificar suporte a biometria
    const checkBiometric = async () => {
      biometricService.purgeLegacyPasswords();
      const supported = await biometricService.isPlatformAuthenticatorAvailable();
      setBiometricAvailable(supported);
      if (supported) {
        const hasLocal = biometricService.hasLocalCredential();
        setBiometricHasCredential(hasLocal);
      }
    };
    checkBiometric();

    // Limpar sessão para fresh login (skip em DEMO)
    if (!IS_DEMO) {
      apiService.auth.signOut();
    }
  }, [IS_DEMO]);

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

    // Captura localização ANTES de qualquer outra operação (skip em DEMO)
    let locationData: { latitude: number; longitude: number; accuracy: number } | null = null;
    if (!IS_DEMO) {
      try {
        locationData = await antifraudService.requestLocation();
        console.log('[Antifraud] Location captured:', locationData);
      } catch (e) {
        console.log('[Antifraud] Location request failed or denied', e);
      }
    }

    try {
      const result = await apiService.auth.signIn(creds) as any;
      if (result.user) {
        // Antifraud Log com localização capturada (skip em DEMO)
        if (!IS_DEMO) {
          await antifraudService.logRiskEvent('LOGIN_SUCCESS', result.user.id, {
            role: result.user.role,
            method: creds.identifier === 'admin' ? 'PASSWORD_ADMIN' : 'PASSWORD_CLIENT',
            locationCaptured: locationData
          });
        }

        // Verificação de dispositivo (limite 2 por usuário) (skip em DEMO)
        if (!IS_DEMO && result.user.role !== 'ADMIN') {
          const deviceCheck = await antifraudService.checkDevice();
          if (!deviceCheck.allowed) {
            setError(deviceCheck.message || 'Acesso bloqueado por segurança do dispositivo.');
            apiService.auth.signOut();
            setLoading(false);
            return;
          }
        }

        // 🔐 Biometria do aparelho: oferecer ativar (cliente, celular com digital/rosto, ainda não ativada aqui)
        if (!IS_DEMO && biometricAvailable && result.user.role !== 'ADMIN') {
          const active = await biometricService.isActiveHere(result.user.id).catch(() => false);
          let skipped = false;
          try { skipped = localStorage.getItem(`bio_offer_skip_${result.user.id}`) === '1'; } catch { /* ok */ }
          if (!active && !skipped) {
            if (!IS_DEMO) locationTrackingService.captureAndSave().catch(() => { });
            setOfferBio({ user: result.user, go: '/client/dashboard' });
            return;
          }
          if (active) sessionStorage.setItem(`biometric_verified_${result.user.id}`, new Date().toISOString());
        }

        if (result.user.role === 'ADMIN') {
          navigate('/admin');
        } else {
          // Salvar localização do cliente após login (background) (skip em DEMO)
          if (!IS_DEMO) {
            locationTrackingService.captureAndSave().catch(() => { });
          }
          navigate('/client/dashboard');
        }
      } else {
        // Tratar erros específicos
        const errMsg = result.error?.message || '';
        const errCode = result.error?.code || '';

        if (errCode === 'DEVICE_BLOCKED') {
          setError(errMsg);
        } else {
          // Antifraud Log - Failed Attempt (skip em DEMO)
          if (!IS_DEMO) {
            await antifraudService.logRiskEvent('LOGIN_FAILED', undefined, {
              identifier: creds.identifier,
              reason: errMsg || 'Invalid Credentials',
              locationCaptured: locationData
            });
          }
          setError('Credenciais inválidas.');
        }
      }
    } catch (error) {
      console.error(error);
      setError('Erro ao fazer login. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };


  // Entrar com a biometria do aparelho: o servidor confere a assinatura e devolve a sessão.
  const handleFaceIDLogin = async () => {
    if (!biometricAvailable) {
      setError('Este aparelho não tem digital ou rosto configurado. Ative nos ajustes do celular ou entre com a senha.');
      return;
    }
    setIsScanning(true);
    setError(null);
    const result = await biometricService.login();
    if (!result.success || !result.user) {
      setIsScanning(false);
      if (!IS_DEMO) antifraudService.logRiskEvent('BIOMETRIC_FAILED', undefined, { flow: 'LOGIN_BIOMETRIC_BUTTON', reason: result.error || 'auth_failed' }).catch(() => { });
      setBiometricHasCredential(biometricService.hasLocalCredential());
      setError(result.needsPassword
        ? 'Biometria ainda não ativada neste aparelho. Entre com email e senha uma vez — depois é só a digital ou o rosto.'
        : result.error || 'Não foi possível entrar com a biometria. Use a senha.');
      return;
    }
    const user = result.user;
    if (!IS_DEMO) {
      antifraudService.logRiskEvent('LOGIN_SUCCESS', user.id, { role: user.role, method: 'BIOMETRIC' }).catch(() => { });
      if (user.role !== 'ADMIN') {
        const deviceCheck = await antifraudService.checkDevice();
        if (!deviceCheck.allowed) {
          setIsScanning(false);
          setError(deviceCheck.message || 'Acesso bloqueado por segurança do dispositivo.');
          apiService.auth.signOut();
          return;
        }
        locationTrackingService.captureAndSave().catch(() => { });
      }
    }
    sessionStorage.setItem(`biometric_verified_${user.id}`, new Date().toISOString());
    setIsScanning(false);
    navigate(user.role === 'ADMIN' ? '/admin' : '/client/dashboard');
  };

  const finishBioOffer = (activated: boolean) => {
    if (!offerBio) return;
    const { user, go } = offerBio;
    if (activated) sessionStorage.setItem(`biometric_verified_${user.id}`, new Date().toISOString());
    else { try { localStorage.setItem(`bio_offer_skip_${user.id}`, '1'); } catch { /* ok */ } }
    setOfferBio(null);
    navigate(go);
  };

  const activateBio = async () => {
    if (!offerBio) return;
    setBioActivating(true);
    setBioActivateError(null);
    const r = await biometricService.activate(offerBio.user);
    setBioActivating(false);
    if (r.success) {
      setBiometricHasCredential(true);
      if (!IS_DEMO) antifraudService.logRiskEvent('BIOMETRIC_REGISTER_SUCCESS', offerBio.user.id, { flow: 'LOGIN_OFFER' }).catch(() => { });
      finishBioOffer(true);
    } else {
      setBioActivateError(r.error || 'Não foi possível ativar agora.');
    }
  };

  const handleForgotPassword = async () => {
    if (!resetEmail) {
      setResetError('Digite seu email.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail.trim())) {
      setResetError('Digite um email válido.');
      return;
    }

    setResetLoading(true);
    setResetError(null);

    const result = await apiService.resetPassword(resetEmail);

    setResetLoading(false);

    // apiService devolve { data, error } (não { success })
    if (!result.error) {
      setResetSuccess(true);
    } else {
      setResetError(result.error?.error || 'Não foi possível enviar agora. Tente de novo em instantes.');
    }
  };

  const closeForgotPasswordModal = () => {
    setForgotPasswordOpen(false);
    setResetEmail('');
    setResetSuccess(false);
    setResetError(null);
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0,rgba(255,0,0,0.1),transparent_70%)] pointer-events-none"></div>

      {isScanning && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center animate-in fade-in">
          <div className="relative w-64 h-64 border-2 border-zinc-800 rounded-full flex items-center justify-center overflow-hidden mb-8">
            {/* Scanning Laser */}
            <div className="absolute top-0 left-0 w-full h-1 bg-[#D4AF37] shadow-[0_0_15px_#D4AF37] animate-[scan_2s_ease-in-out_infinite]"></div>

            {/* Grid Overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(212,175,55,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(212,175,55,0.1)_1px,transparent_1px)] bg-[size:20px_20px]"></div>

            <Fingerprint size={120} className="text-[#D4AF37]/50 animate-pulse" />

            {/* Face Corners */}
            <div className="absolute top-8 left-8 w-8 h-8 border-t-2 border-l-2 border-[#D4AF37] rounded-tl-xl"></div>
            <div className="absolute top-8 right-8 w-8 h-8 border-t-2 border-r-2 border-[#D4AF37] rounded-tr-xl"></div>
            <div className="absolute bottom-8 left-8 w-8 h-8 border-b-2 border-l-2 border-[#D4AF37] rounded-bl-xl"></div>
            <div className="absolute bottom-8 right-8 w-8 h-8 border-b-2 border-r-2 border-[#D4AF37] rounded-br-xl"></div>
          </div>
          <h2 className="text-xl font-bold text-[#D4AF37] tracking-widest animate-pulse">VERIFICANDO BIOMETRIA...</h2>
          <p className="text-zinc-500 text-sm mt-3">Use Face ID ou impressão digital</p>
          <button
            onClick={() => setIsScanning(false)}
            className="mt-6 text-zinc-500 hover:text-white text-sm"
          >
            Cancelar
          </button>
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
        {/* Banner de Email Confirmado */}
        {emailConfirmed && (
          <div className="flex items-center gap-3 p-4 bg-green-900/20 border border-green-500/30 rounded-xl mb-4 animate-in fade-in">
            <CheckCircle2 size={20} className="text-green-400 flex-shrink-0" />
            <p className="text-green-300 text-sm font-medium">Email confirmado com sucesso! Agora faça login para acessar os serviços.</p>
          </div>
        )}

        {/* Banner de Erro */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-900/20 border border-red-500/30 rounded-xl mb-4">
            <AlertCircle size={20} className="text-red-400 flex-shrink-0" />
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-shark transition-colors">
                <User size={20} />
              </div>
              <input
                type="email"
                autoComplete="username"
                placeholder="Email"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-zinc-600 focus:outline-none focus:border-shark focus:ring-1 focus:ring-shark transition-all"
                value={formData.identifier}
                onChange={(e) => setFormData({ ...formData, identifier: e.target.value })}
              />
            </div>

            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-shark transition-colors">
                <Lock size={20} />
              </div>
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Senha"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-zinc-600 focus:outline-none focus:border-shark focus:ring-1 focus:ring-shark transition-all"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-500 text-sm bg-red-900/10 p-3 rounded-lg border border-red-900/50">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <div className="flex justify-end">
            <button type="button" onClick={() => setForgotPasswordOpen(true)} className="text-sm text-zinc-500 hover:text-shark transition-colors">
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

            {biometricAvailable && (
              <button
                type="button"
                onClick={handleFaceIDLogin}
                className={`bg-zinc-900 border rounded-xl px-4 flex items-center justify-center transition-all shadow-lg ${biometricHasCredential
                  ? 'border-[#D4AF37]/50 text-[#D4AF37] hover:border-[#D4AF37] hover:bg-zinc-800/80'
                  : 'border-zinc-700 text-[#D4AF37] hover:border-[#D4AF37]/50 hover:bg-zinc-800/80'
                  }`}
                title="Entrar com biometria" aria-label="Entrar com biometria"
              >
                <Fingerprint size={24} />
              </button>
            )}
          </div>
        </form>

        {/* Biometria já ativada neste aparelho: entrada principal em um toque */}
        {biometricAvailable && biometricHasCredential && (
          <button
            type="button"
            onClick={handleFaceIDLogin}
            className="mt-4 w-full py-4 rounded-xl border border-[#D4AF37]/50 bg-[#D4AF37]/10 text-[#D4AF37] font-bold flex items-center justify-center gap-3 hover:bg-[#D4AF37]/20 active:scale-[0.98] transition-all"
          >
            {/iPhone|iPad|Mac/i.test(navigator.userAgent) ? <ScanFace size={24} /> : <Fingerprint size={24} />}
            Entrar com {/iPhone|iPad/i.test(navigator.userAgent) ? 'Face ID / Touch ID' : 'biometria'}
          </button>
        )}

        <div className="mt-8 text-center">
          <p className="text-zinc-400 text-base">
            Não tem uma conta? <button onClick={() => navigate('/register')} className="text-[#FFD700] hover:text-[#FFF176] transition-colors font-bold text-lg underline underline-offset-4">Cadastre-se</button>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes scan {
            0% { top: 0%; opacity: 0.5; }
            50% { top: 100%; opacity: 1; }
            100% { top: 0%; opacity: 0.5; }
        }
      `}</style>

      {/* Modal Esqueceu Senha */}
      {forgotPasswordOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Mail className="text-[#D4AF37]" size={24} /> Recuperar Senha
              </h2>
              <button onClick={closeForgotPasswordModal} className="text-zinc-500 hover:text-white">
                <X size={24} />
              </button>
            </div>

            {resetSuccess ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-green-900/20 border border-green-700 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={32} className="text-green-500" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Email Enviado!</h3>
                <p className="text-zinc-400 text-sm mb-6">
                  Se o email estiver cadastrado, o link chega em instantes. Veja também a caixa de Spam e Promoções. O link vale 1 hora e funciona uma vez.
                </p>
                <Button onClick={closeForgotPasswordModal} className="w-full">
                  Voltar ao Login
                </Button>
              </div>
            ) : (
              <>
                <p className="text-zinc-400 text-sm mb-6">
                  Digite seu email para receber um link de recuperação de senha.
                </p>

                <div className="space-y-4">
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
                      <Mail size={20} />
                    </div>
                    <input
                      type="email"
                      autoComplete="email"
                      placeholder="Seu email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="w-full bg-black border border-zinc-700 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all"
                    />
                  </div>

                  {resetError && (
                    <div className="flex items-center gap-2 text-red-500 text-sm bg-red-900/10 p-3 rounded-lg border border-red-900/50">
                      <AlertCircle size={16} /> {resetError}
                    </div>
                  )}

                  <Button
                    onClick={handleForgotPassword}
                    isLoading={resetLoading}
                    className="w-full py-4"
                  >
                    {resetLoading ? (
                      <>
                        <Loader2 className="animate-spin mr-2" size={20} /> Enviando...
                      </>
                    ) : (
                      'Enviar Email de Recuperação'
                    )}
                  </Button>

                  <button
                    onClick={closeForgotPasswordModal}
                    className="w-full text-zinc-500 hover:text-white text-sm py-2 transition-colors"
                  >
                    Voltar ao Login
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Convite: ativar a biometria do aparelho (aparece uma vez, logo depois do login com senha) */}
      {offerBio && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center mx-auto mb-4">
                {/iPhone|iPad|Mac/i.test(navigator.userAgent) ? <ScanFace size={40} className="text-[#D4AF37]" /> : <Fingerprint size={40} className="text-[#D4AF37]" />}
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Entrar só com a biometria?</h2>
              <p className="text-zinc-400 text-sm mb-6">
                Use a mesma digital ou o rosto que você já usa para desbloquear o celular.
                Nas próximas vezes é só tocar no ícone — sem digitar senha.
              </p>
            </div>
            {bioActivateError && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/10 p-3 rounded-lg border border-red-900/50 mb-4">
                <AlertCircle size={16} className="flex-shrink-0" /> {bioActivateError}
              </div>
            )}
            <Button onClick={activateBio} isLoading={bioActivating} className="w-full py-4 bg-[#D4AF37] hover:bg-[#FFF176] text-black font-bold">
              {bioActivating ? <><Loader2 className="animate-spin mr-2" size={20} /> Aguardando o celular...</> : <><ShieldCheck size={20} className="mr-2" /> Ativar biometria</>}
            </Button>
            <button onClick={() => finishBioOffer(false)} className="w-full text-zinc-500 hover:text-white text-sm py-3 mt-1 transition-colors">
              Agora não
            </button>
          </div>
        </div>
      )}
    </div>
  );
};