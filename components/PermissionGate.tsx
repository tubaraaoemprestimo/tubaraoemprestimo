/**
 * 🔒 Permission Gate
 * Bloqueia o app até o usuário conceder:
 * - Permissão de localização (obrigatória)
 * - Permissão de notificação (obrigatória)
 * 
 * Mostra tela bonita explicando por que precisa das permissões.
 * Só libera o conteúdo quando AMBAS estiverem concedidas.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, Bell, Shield, CheckCircle2, XCircle, Loader2, AlertTriangle, Lock, ArrowRight } from 'lucide-react';
import { Button } from './Button';
import { Logo } from './Logo';

interface PermissionGateProps {
    children: React.ReactNode;
    /** Se true, exige permissões. Se false, passa direto (ex: admin pode não precisar) */
    requirePermissions?: boolean;
}

type PermissionStatus = 'pending' | 'requesting' | 'granted' | 'denied' | 'unavailable';

export const PermissionGate: React.FC<PermissionGateProps> = ({ children, requirePermissions = true }) => {
    const [locationStatus, setLocationStatus] = useState<PermissionStatus>('pending');
    const [notificationStatus, setNotificationStatus] = useState<PermissionStatus>('pending');
    const [checking, setChecking] = useState(true);
    const [showDeniedHelp, setShowDeniedHelp] = useState(false);

    // Verificar permissões existentes ao montar
    useEffect(() => {
        checkExistingPermissions();
    }, []);

    const checkExistingPermissions = async () => {
        setChecking(true);

        // Verificar localização
        if ('geolocation' in navigator) {
            try {
                const permResult = await navigator.permissions.query({ name: 'geolocation' });
                if (permResult.state === 'granted') {
                    setLocationStatus('granted');
                } else if (permResult.state === 'denied') {
                    setLocationStatus('denied');
                } else {
                    setLocationStatus('pending');
                }
                // Ouvir mudanças
                permResult.onchange = () => {
                    if (permResult.state === 'granted') setLocationStatus('granted');
                    else if (permResult.state === 'denied') setLocationStatus('denied');
                };
            } catch {
                setLocationStatus('pending');
            }
        } else {
            setLocationStatus('unavailable');
        }

        // Verificar notificação
        if ('Notification' in window) {
            if (Notification.permission === 'granted') {
                setNotificationStatus('granted');
            } else if (Notification.permission === 'denied') {
                setNotificationStatus('denied');
            } else {
                setNotificationStatus('pending');
            }
        } else {
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
            console.error('Localização negada:', error);
            if (error.code === 1) {
                setLocationStatus('denied');
            } else {
                // Timeout ou erro - tentar novamente
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
            console.error('Notificação negada:', error);
            setNotificationStatus('denied');
        }
    }, []);

    // Se não precisa de permissões, passa direto
    if (!requirePermissions) {
        return <>{children}</>;
    }

    // Localização é OBRIGATÓRIA - se indisponível no browser, bloqueia
    const locationOk = locationStatus === 'granted';
    // Notificação: ok se concedida OU se indisponível (alguns browsers mobile não suportam)
    const notificationOk = notificationStatus === 'granted' || notificationStatus === 'unavailable';

    if (locationOk && notificationOk) {
        return <>{children}</>;
    }

    // Se ainda verificando
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

    return (
        <div className="fixed inset-0 bg-black z-[9999] flex items-center justify-center p-4 overflow-y-auto">
            <div className="w-full max-w-md">
                {/* Logo e Header */}
                <div className="text-center mb-8">
                    <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-[#D4AF37] to-[#B8860B] rounded-2xl flex items-center justify-center shadow-[0_0_40px_rgba(212,175,55,0.3)]">
                        <Shield size={36} className="text-black" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Permissões Necessárias</h1>
                    <p className="text-zinc-400 text-sm leading-relaxed">
                        Para sua segurança e melhor experiência, precisamos que você autorize o acesso abaixo antes de continuar.
                    </p>
                </div>

                {/* Cards de Permissão */}
                <div className="space-y-4 mb-8">
                    {/* Localização */}
                    <div className={`relative overflow-hidden rounded-2xl border transition-all duration-500 ${locationStatus === 'granted'
                        ? 'bg-green-900/10 border-green-500/30'
                        : locationStatus === 'denied'
                            ? 'bg-red-900/10 border-red-500/30'
                            : 'bg-zinc-900 border-zinc-800 hover:border-[#D4AF37]/50'
                        }`}>
                        <div className="p-5">
                            <div className="flex items-start gap-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${locationStatus === 'granted'
                                    ? 'bg-green-500/20'
                                    : locationStatus === 'denied'
                                        ? 'bg-red-500/20'
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
                                        Isso protege sua conta contra acessos não autorizados.
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

                    {/* Notificações */}
                    <div className={`relative overflow-hidden rounded-2xl border transition-all duration-500 ${notificationStatus === 'granted'
                        ? 'bg-green-900/10 border-green-500/30'
                        : notificationStatus === 'denied'
                            ? 'bg-red-900/10 border-red-500/30'
                            : 'bg-zinc-900 border-zinc-800 hover:border-[#D4AF37]/50'
                        }`}>
                        <div className="p-5">
                            <div className="flex items-start gap-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${notificationStatus === 'granted'
                                    ? 'bg-green-500/20'
                                    : notificationStatus === 'denied'
                                        ? 'bg-red-500/20'
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
                                        Enviamos notificações sobre o status do seu empréstimo, pagamentos e alertas
                                        de segurança. É essencial para acompanhar suas solicitações.
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
                        <div>
                            <p className="text-zinc-400 text-xs leading-relaxed">
                                <strong className="text-zinc-300">Seus dados estão seguros.</strong> A localização é usada apenas
                                para verificação de segurança e as notificações são enviadas apenas sobre seu empréstimo.
                                Não compartilhamos seus dados com terceiros.
                            </p>
                        </div>
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
                                        <p>Ajustes → Safari → Localização → Permitir. Para notificações: Ajustes → Notificações → Safari</p>
                                    </div>
                                    <div>
                                        <p className="font-bold text-zinc-300 mb-1">💻 Desktop (Chrome):</p>
                                        <p>Clique no cadeado 🔒 ao lado da URL → Permissões do site → Ative Localização e Notificações</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        checkExistingPermissions();
                                    }}
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
