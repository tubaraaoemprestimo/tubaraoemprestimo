/**
 * 🔒 Permission Gate
 * Bloqueia o app até o usuário conceder:
 * - Permissão de localização (obrigatória)
 * - Permissão de notificação (obrigatória, ou instrução de instalar PWA no iOS)
 *
 * iOS Safari: Notification API não existe fora do PWA instalado.
 * Nesse caso, mostramos guia visual passo-a-passo para o usuário instalar
 * e depois liberamos o acesso (não podemos bloquear para sempre).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, Bell, Shield, CheckCircle2, XCircle, Loader2, AlertTriangle, Lock, ArrowRight, Share2 } from 'lucide-react';
import { Button } from './Button';
import { Logo } from './Logo';

interface PermissionGateProps {
    children: React.ReactNode;
    requirePermissions?: boolean;
}

type PermissionStatus = 'pending' | 'requesting' | 'granted' | 'denied' | 'unavailable';

// Detecta iOS (iPhone/iPad) fora do modo standalone (PWA não instalado)
function detectIOS() {
    const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
    return { isIosDevice, isStandalone };
}

// ──────────────────────────────────────────────────────────────────────────────
// Guia visual de instalação no iOS — passo a passo simples para leigos
// ──────────────────────────────────────────────────────────────────────────────
const IOSInstallGuide: React.FC<{ onDone: () => void }> = ({ onDone }) => {
    const [step, setStep] = useState(0);

    const steps = [
        {
            emoji: '📲',
            title: 'Instalar o App',
            desc: 'Para receber notificações no iPhone, você precisa adicionar este site à sua tela de início. É rápido e fácil!',
            action: 'Vamos lá →',
        },
        {
            emoji: '⬆️',
            title: 'Toque em Compartilhar',
            desc: (
                <span>
                    Na barra inferior do Safari, toque no ícone{' '}
                    <span className="inline-flex items-center gap-1 bg-zinc-700 px-2 py-0.5 rounded text-white font-bold text-xs">
                        <Share2 size={12} /> Compartilhar
                    </span>{' '}
                    (quadrado com seta para cima).
                </span>
            ),
            action: 'Próximo →',
        },
        {
            emoji: '➕',
            title: 'Adicionar à Tela de Início',
            desc: (
                <span>
                    Role a lista para baixo e toque em{' '}
                    <span className="bg-zinc-700 px-2 py-0.5 rounded text-white font-bold text-xs">
                        Adicionar à Tela de Início
                    </span>
                    . Depois toque em <strong className="text-white">Adicionar</strong> no canto superior direito.
                </span>
            ),
            action: 'Próximo →',
        },
        {
            emoji: '🏠',
            title: 'Abra pela Tela de Início',
            desc: 'Pronto! Agora abra o aplicativo Tubarão pelo ícone que apareceu na sua tela de início. As notificações funcionarão automaticamente.',
            action: 'Já abri! Continuar',
        },
    ];

    const current = steps[step];
    const isLast = step === steps.length - 1;

    return (
        <div className="fixed inset-0 bg-black/95 z-[9999] flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                {/* Logo */}
                <div className="text-center mb-6">
                    <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-[#D4AF37] to-[#B8860B] rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(212,175,55,0.3)]">
                        <Shield size={30} className="text-black" />
                    </div>
                    <p className="text-zinc-500 text-xs uppercase tracking-widest">Tubarão Empréstimos</p>
                </div>

                {/* Step indicator */}
                <div className="flex items-center justify-center gap-2 mb-6">
                    {steps.map((_, i) => (
                        <div
                            key={i}
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                                i === step ? 'w-8 bg-[#D4AF37]' : i < step ? 'w-4 bg-green-500' : 'w-4 bg-zinc-700'
                            }`}
                        />
                    ))}
                </div>

                {/* Card do passo atual */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 mb-4 text-center">
                    <div className="text-6xl mb-4">{current.emoji}</div>
                    <h2 className="text-white font-bold text-xl mb-3">{current.title}</h2>
                    <p className="text-zinc-400 text-sm leading-relaxed">
                        {typeof current.desc === 'string' ? current.desc : current.desc}
                    </p>
                </div>

                {/* Botão de ação */}
                <button
                    onClick={() => {
                        if (isLast) {
                            onDone();
                        } else {
                            setStep(s => s + 1);
                        }
                    }}
                    className="w-full py-4 bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black font-bold text-base rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-[0_4px_20px_rgba(212,175,55,0.3)]"
                >
                    {current.action}
                </button>

                {/* Skip apenas nos passos intermediários */}
                {!isLast && (
                    <button
                        onClick={onDone}
                        className="w-full mt-3 py-2 text-zinc-600 text-xs hover:text-zinc-400"
                    >
                        Pular por agora
                    </button>
                )}
            </div>
        </div>
    );
};

// ──────────────────────────────────────────────────────────────────────────────
// PermissionGate principal
// ──────────────────────────────────────────────────────────────────────────────
export const PermissionGate: React.FC<PermissionGateProps> = ({ children, requirePermissions = true }) => {
    // DEMO MODE: bypass permissions completamente
    const IS_DEMO = import.meta.env.VITE_DEMO_MODE === 'true';
    if (IS_DEMO) {
        return <>{children}</>;
    }

    const [locationStatus, setLocationStatus] = useState<PermissionStatus>('pending');
    const [notificationStatus, setNotificationStatus] = useState<PermissionStatus>('pending');
    const [checking, setChecking] = useState(true);
    const [showDeniedHelp, setShowDeniedHelp] = useState(false);
    const [showIOSGuide, setShowIOSGuide] = useState(false);

    useEffect(() => {
        checkExistingPermissions();
    }, []);

    const checkExistingPermissions = async () => {
        setChecking(true);

        // ── Localização ──────────────────────────────────────────────────────
        if ('geolocation' in navigator) {
            try {
                if (navigator.permissions && navigator.permissions.query) {
                    const permResult = await navigator.permissions.query({ name: 'geolocation' });
                    if (permResult.state === 'granted') {
                        setLocationStatus('granted');
                    } else if (permResult.state === 'denied') {
                        setLocationStatus('denied');
                    } else {
                        setLocationStatus('pending');
                    }
                    permResult.onchange = () => {
                        if (permResult.state === 'granted') setLocationStatus('granted');
                        else if (permResult.state === 'denied') setLocationStatus('denied');
                    };
                } else {
                    setLocationStatus('pending');
                }
            } catch {
                setLocationStatus('pending');
            }
        } else {
            setLocationStatus('unavailable');
        }

        // ── Notificações ─────────────────────────────────────────────────────
        if ('Notification' in window) {
            if (Notification.permission === 'granted') {
                setNotificationStatus('granted');
            } else if (Notification.permission === 'denied') {
                setNotificationStatus('denied');
            } else {
                setNotificationStatus('pending');
            }
        } else {
            // iOS Safari sem PWA instalado — API não existe
            // Vamos tratar como "unavailable" mas NÃO bloquear para sempre
            setNotificationStatus('unavailable');
        }

        setChecking(false);
    };

    const requestLocation = useCallback(async () => {
        setLocationStatus('requesting');
        try {
            await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 0
                });
            });
            setLocationStatus('granted');
        } catch (error: any) {
            if (error.code === 1) {
                setLocationStatus('denied');
            } else {
                setLocationStatus('denied');
            }
        }
    }, []);

    const requestNotification = useCallback(async () => {
        setNotificationStatus('requesting');
        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                setNotificationStatus('granted');
            } else {
                setNotificationStatus('denied');
            }
        } catch (error) {
            setNotificationStatus('denied');
        }
    }, []);

    // ── Sem permissões requeridas → passa direto ─────────────────────────────
    if (!requirePermissions) {
        return <>{children}</>;
    }

    // ── iOS sem PWA: notificação indisponível é tratada como "ok" ────────────
    // Não podemos bloquear o usuário para sempre — ele verá o guia de instalação
    const notificationOk =
        notificationStatus === 'granted' ||
        notificationStatus === 'unavailable'; // iOS sem PWA: permitimos passar

    const locationOk =
        locationStatus === 'granted' ||
        locationStatus === 'unavailable'; // sem GPS no dispositivo: não bloqueia

    // Guia de instalação iOS (mostrado ANTES da tela de permissões quando aplicável)
    if (showIOSGuide) {
        return (
            <IOSInstallGuide
                onDone={() => {
                    setShowIOSGuide(false);
                    checkExistingPermissions(); // recheck após instalar
                }}
            />
        );
    }

    // ── Tudo ok → libera ─────────────────────────────────────────────────────
    if (locationOk && notificationOk) {
        // Se iOS sem PWA e nunca mostrou o guia, mostra o guia em banner (não bloqueia)
        // O banner de instalação (InstallPrompt) já cuida disso no App.tsx
        return <>{children}</>;
    }

    // ── Ainda verificando ─────────────────────────────────────────────────────
    if (checking) {
        return (
            <div className="fixed inset-0 bg-black flex items-center justify-center z-[9999]">
                <div className="text-center">
                    <Loader2 size={40} className="text-[#D4AF37] animate-spin mx-auto mb-4" />
                    <p className="text-zinc-400">Verificando permissões...</p>
                </div>
            </div>
        );
    }

    const anyDenied = locationStatus === 'denied' || notificationStatus === 'denied';
    const { isIosDevice, isStandalone } = detectIOS();
    const isIOSWithoutPWA = isIosDevice && !isStandalone;

    return (
        <div className="fixed inset-0 bg-black z-[9999] flex items-center justify-center p-4 overflow-y-auto">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-[#D4AF37] to-[#B8860B] rounded-2xl flex items-center justify-center shadow-[0_0_40px_rgba(212,175,55,0.3)]">
                        <Shield size={36} className="text-black" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Permissões Necessárias</h1>
                    <p className="text-zinc-400 text-sm leading-relaxed">
                        Para sua segurança e melhor experiência, precisamos que você autorize o acesso abaixo.
                    </p>
                </div>

                <div className="space-y-4 mb-8">
                    {/* ── Card Localização ─────────────────────────────────── */}
                    <div className={`relative overflow-hidden rounded-2xl border transition-all duration-500 ${
                        locationStatus === 'granted'
                            ? 'bg-green-900/10 border-green-500/30'
                            : locationStatus === 'denied'
                                ? 'bg-red-900/10 border-red-500/30'
                                : 'bg-zinc-900 border-zinc-800 hover:border-[#D4AF37]/50'
                    }`}>
                        <div className="p-5">
                            <div className="flex items-start gap-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                    locationStatus === 'granted' ? 'bg-green-500/20'
                                        : locationStatus === 'denied' ? 'bg-red-500/20'
                                            : 'bg-blue-500/20'
                                }`}>
                                    {locationStatus === 'granted' ? (
                                        <CheckCircle2 size={24} className="text-green-400" />
                                    ) : locationStatus === 'denied' ? (
                                        <XCircle size={24} className="text-red-400" />
                                    ) : locationStatus === 'requesting' ? (
                                        <Loader2 size={24} className="text-blue-400 animate-spin" />
                                    ) : (
                                        <MapPin size={24} className="text-blue-400" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                        Localização
                                        {locationStatus === 'granted' && (
                                            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">Ativa</span>
                                        )}
                                    </h3>
                                    <p className="text-zinc-400 text-sm mt-1 leading-relaxed">
                                        Usamos sua localização para verificar a segurança do acesso e prevenir fraudes.
                                    </p>

                                    {locationStatus === 'pending' && (
                                        <button
                                            onClick={requestLocation}
                                            className="mt-3 w-full py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:from-blue-500 hover:to-blue-400 transition-all active:scale-[0.98]"
                                        >
                                            <MapPin size={16} /> Permitir Localização
                                        </button>
                                    )}

                                    {locationStatus === 'requesting' && (
                                        <div className="mt-3 py-3 bg-zinc-800 rounded-xl text-center text-zinc-400 text-sm flex items-center justify-center gap-2">
                                            <Loader2 size={16} className="animate-spin" /> Aguardando permissão...
                                        </div>
                                    )}

                                    {locationStatus === 'denied' && (
                                        <div className="mt-3 p-3 bg-red-900/20 border border-red-500/30 rounded-xl">
                                            <p className="text-red-400 text-xs flex items-center gap-1">
                                                <AlertTriangle size={14} />
                                                Permissão negada. Você precisa habilitar nas configurações do navegador.
                                            </p>
                                            <button
                                                onClick={requestLocation}
                                                className="mt-2 w-full py-2 bg-red-900/30 text-red-300 rounded-lg text-xs font-bold hover:bg-red-900/50"
                                            >
                                                Tentar Novamente
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Card Notificações ─────────────────────────────────── */}
                    <div className={`relative overflow-hidden rounded-2xl border transition-all duration-500 ${
                        notificationStatus === 'granted'
                            ? 'bg-green-900/10 border-green-500/30'
                            : notificationStatus === 'denied'
                                ? 'bg-red-900/10 border-red-500/30'
                                : notificationStatus === 'unavailable'
                                    ? 'bg-yellow-900/10 border-yellow-500/30'
                                    : 'bg-zinc-900 border-zinc-800 hover:border-[#D4AF37]/50'
                    }`}>
                        <div className="p-5">
                            <div className="flex items-start gap-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                    notificationStatus === 'granted' ? 'bg-green-500/20'
                                        : notificationStatus === 'denied' ? 'bg-red-500/20'
                                            : notificationStatus === 'unavailable' ? 'bg-yellow-500/20'
                                                : 'bg-yellow-500/20'
                                }`}>
                                    {notificationStatus === 'granted' ? (
                                        <CheckCircle2 size={24} className="text-green-400" />
                                    ) : notificationStatus === 'denied' ? (
                                        <XCircle size={24} className="text-red-400" />
                                    ) : notificationStatus === 'requesting' ? (
                                        <Loader2 size={24} className="text-yellow-400 animate-spin" />
                                    ) : (
                                        <Bell size={24} className="text-yellow-400" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                        Notificações
                                        {notificationStatus === 'granted' && (
                                            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">Ativa</span>
                                        )}
                                    </h3>
                                    <p className="text-zinc-400 text-sm mt-1 leading-relaxed">
                                        Alertas de pagamentos, aprovações e avisos importantes direto no seu celular.
                                    </p>

                                    {notificationStatus === 'pending' && (
                                        <button
                                            onClick={requestNotification}
                                            className="mt-3 w-full py-3 bg-gradient-to-r from-yellow-600 to-yellow-500 text-black rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:from-yellow-500 hover:to-yellow-400 transition-all active:scale-[0.98]"
                                        >
                                            <Bell size={16} /> Permitir Notificações
                                        </button>
                                    )}

                                    {notificationStatus === 'requesting' && (
                                        <div className="mt-3 py-3 bg-zinc-800 rounded-xl text-center text-zinc-400 text-sm flex items-center justify-center gap-2">
                                            <Loader2 size={16} className="animate-spin" /> Aguardando permissão...
                                        </div>
                                    )}

                                    {/* ── iOS sem PWA: guia visual amigável ── */}
                                    {notificationStatus === 'unavailable' && isIOSWithoutPWA && (
                                        <div className="mt-3 rounded-xl overflow-hidden border border-yellow-500/30">
                                            {/* Banner explicativo */}
                                            <div className="bg-yellow-900/20 p-3">
                                                <p className="text-yellow-300 text-xs font-bold mb-1 flex items-center gap-1">
                                                    <span>📱</span> iPhone detectado
                                                </p>
                                                <p className="text-zinc-400 text-xs leading-relaxed">
                                                    Para receber notificações no iPhone, você precisa{' '}
                                                    <strong className="text-white">instalar o app</strong> na sua tela de início.
                                                    É gratuito e leva menos de 1 minuto!
                                                </p>
                                            </div>
                                            {/* Resumo dos passos */}
                                            <div className="bg-black/40 px-3 py-2 flex items-center gap-2 text-xs text-zinc-400">
                                                <span className="text-base">⬆️</span>
                                                <span>Compartilhar</span>
                                                <ArrowRight size={10} className="text-zinc-600" />
                                                <span className="text-base">➕</span>
                                                <span>Adicionar à Tela de Início</span>
                                                <ArrowRight size={10} className="text-zinc-600" />
                                                <span className="text-base">🏠</span>
                                                <span>Abrir</span>
                                            </div>
                                            {/* Botões */}
                                            <div className="p-3 flex flex-col gap-2">
                                                <button
                                                    onClick={() => setShowIOSGuide(true)}
                                                    className="w-full py-3 bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black font-bold text-sm rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                                                >
                                                    <span>📲</span> Ver passo a passo
                                                </button>
                                                <button
                                                    onClick={() => checkExistingPermissions()}
                                                    className="w-full py-2 bg-zinc-800 text-zinc-400 text-xs rounded-lg hover:bg-zinc-700"
                                                >
                                                    ✅ Já instalei — verificar novamente
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* iOS sem PWA mas não detectado como tal (fallback genérico) */}
                                    {notificationStatus === 'unavailable' && !isIOSWithoutPWA && (
                                        <div className="mt-3 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-xl">
                                            <p className="text-yellow-400 text-xs flex items-center gap-1 mb-2">
                                                <AlertTriangle size={14} />
                                                Notificações não disponíveis neste navegador.
                                            </p>
                                            <p className="text-zinc-400 text-xs leading-relaxed">
                                                Tente acessar pelo Chrome ou instalar o app na tela de início.
                                            </p>
                                            <button
                                                onClick={() => checkExistingPermissions()}
                                                className="mt-2 w-full py-2 bg-yellow-900/30 text-yellow-300 rounded-lg text-xs font-bold hover:bg-yellow-900/50"
                                            >
                                                Verificar novamente
                                            </button>
                                        </div>
                                    )}

                                    {notificationStatus === 'denied' && (
                                        <div className="mt-3 p-3 bg-red-900/20 border border-red-500/30 rounded-xl">
                                            <p className="text-red-400 text-xs flex items-center gap-1">
                                                <AlertTriangle size={14} />
                                                Permissão negada. Habilite nas configurações do navegador.
                                            </p>
                                            <button
                                                onClick={requestNotification}
                                                className="mt-2 w-full py-2 bg-red-900/30 text-red-300 rounded-lg text-xs font-bold hover:bg-red-900/50"
                                            >
                                                Tentar Novamente
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Info de segurança */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 mb-6">
                    <div className="flex items-start gap-3">
                        <Lock size={18} className="text-[#D4AF37] flex-shrink-0 mt-0.5" />
                        <p className="text-zinc-400 text-xs leading-relaxed">
                            <strong className="text-zinc-300">Seus dados estão seguros.</strong> A localização é usada apenas
                            para verificação de segurança e as notificações são enviadas apenas sobre seu empréstimo.
                            Não compartilhamos seus dados com terceiros.
                        </p>
                    </div>
                </div>

                {/* Help para quem negou */}
                {anyDenied && (
                    <div className="text-center">
                        <button
                            onClick={() => setShowDeniedHelp(!showDeniedHelp)}
                            className="text-[#D4AF37] text-sm underline hover:text-[#B8860B]"
                        >
                            Como habilitar permissões no navegador?
                        </button>
                        {showDeniedHelp && (
                            <div className="mt-4 p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-left">
                                <h4 className="text-white font-bold text-sm mb-3">Instruções:</h4>
                                <div className="space-y-3 text-zinc-400 text-xs">
                                    <div>
                                        <p className="font-bold text-zinc-300 mb-1">📱 Android (Chrome):</p>
                                        <p>Toque no cadeado 🔒 ao lado da URL → Permissões → Ative Localização e Notificações</p>
                                    </div>
                                    <div>
                                        <p className="font-bold text-zinc-300 mb-1">🍎 iPhone (Safari):</p>
                                        <p>Ajustes → Safari → Localização → Permitir. Para notificações: instale o app na tela de início.</p>
                                    </div>
                                    <div>
                                        <p className="font-bold text-zinc-300 mb-1">💻 Desktop (Chrome):</p>
                                        <p>Clique no cadeado 🔒 ao lado da URL → Permissões do site → Ative Localização e Notificações</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => checkExistingPermissions()}
                                    className="mt-4 w-full py-2 bg-[#D4AF37]/20 text-[#D4AF37] rounded-lg text-sm font-bold hover:bg-[#D4AF37]/30"
                                >
                                    Já habilitei, verificar novamente
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Progresso */}
                <div className="mt-6 flex items-center justify-center gap-3">
                    <div className={`w-3 h-3 rounded-full transition-all ${locationOk ? 'bg-green-500' : 'bg-zinc-700'}`} />
                    <div className={`w-12 h-0.5 ${locationOk && notificationOk ? 'bg-green-500' : 'bg-zinc-700'}`} />
                    <div className={`w-3 h-3 rounded-full transition-all ${notificationOk ? 'bg-green-500' : 'bg-zinc-700'}`} />
                </div>
                <p className="text-center text-zinc-600 text-xs mt-2">
                    {locationOk && notificationOk ? 'Todas as permissões concedidas!' :
                        `${[locationOk, notificationOk].filter(Boolean).length}/2 permissões concedidas`}
                </p>
            </div>
        </div>
    );
};

export default PermissionGate;
